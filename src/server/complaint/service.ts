import { createHash, randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  accounts,
  adminTaskAssignments,
  buyerRefundDestinations,
  complaintAgreementApprovals,
  complaintAgreements,
  complaintEvents,
  complaintFinancialHandoffs,
  complaintHolds,
  sellerPayoutDestinations,
  transactionParticipants,
  transactionTerms,
  transactions
} from "@/server/db/schema";
import { findIdempotentResult, saveIdempotentResult } from "@/server/transaction/mutation";
import { recordTransactionEvent } from "@/server/transaction/audit";
import type {
  ComplaintAgreementInput,
  ComplaintApprovalInput,
  ComplaintCorrectionInput,
  ComplaintIntakeInput,
  ComplaintNoAgreementInput
} from "./contracts";

type Idempotency = { key: string; requestHash: string };
type Admin = { id: string; isAdmin: boolean };
type AssignmentScope = "COMPLAINT_INTAKE" | "COMPLAINT_APPROVAL";

const ELIGIBLE_STATES = new Set([
  "PAYMENT_CONFIRMED", "READY_FOR_FULFILLMENT", "WAITING_COMPLETION_REPORTS",
  "WAITING_OTHER_COMPLETION_REPORT", "READY_FOR_BUYER_CONFIRMATION",
  "WAITING_BUYER_CONFIRMATION", "BUYER_CONFIRMATION_OVERDUE",
  "READY_FOR_PAYOUT", "MANUAL_REVIEW_REQUIRED"
]);
const POST_PROCESSING_STATES = new Set([
  "PAYOUT_PROCESSING", "PAID_OUT", "REFUND_PROCESSING",
  "REFUNDED", "SPLIT_PROCESSING", "SPLIT_SETTLED"
]);

async function requireAssignment(tx: any, admin: Admin, scope: AssignmentScope) {
  if (!admin.isAdmin) throw new Error("FORBIDDEN");
  const [assignment] = await tx.select({ id: adminTaskAssignments.id })
    .from(adminTaskAssignments)
    .innerJoin(accounts, eq(adminTaskAssignments.accountId, accounts.id))
    .where(and(
      eq(adminTaskAssignments.accountId, admin.id),
      eq(adminTaskAssignments.taskScope, scope),
      isNull(adminTaskAssignments.revokedAt),
      eq(accounts.isAdmin, true)
    )).limit(1);
  if (!assignment) throw new Error("COMPLAINT_ASSIGNMENT_REQUIRED");
}

async function requireComplaintReadAssignment(tx: any, admin: Admin) {
  if (!admin.isAdmin) throw new Error("FORBIDDEN");
  const [assignment] = await tx.select({ id: adminTaskAssignments.id })
    .from(adminTaskAssignments)
    .innerJoin(accounts, eq(adminTaskAssignments.accountId, accounts.id))
    .where(and(
      eq(adminTaskAssignments.accountId, admin.id),
      inArray(adminTaskAssignments.taskScope, ["COMPLAINT_INTAKE", "COMPLAINT_APPROVAL"]),
      isNull(adminTaskAssignments.revokedAt),
      eq(accounts.isAdmin, true)
    )).limit(1);
  if (!assignment) throw new Error("COMPLAINT_ASSIGNMENT_REQUIRED");
}

async function lockTransaction(tx: any, transactionId: string) {
  await tx.execute(sql`SELECT id FROM transactions WHERE id = ${transactionId} FOR UPDATE`);
  const [transaction] = await tx.select().from(transactions)
    .where(eq(transactions.id, transactionId)).limit(1);
  if (!transaction) throw new Error("TRANSACTION_NOT_FOUND");
  return transaction;
}

function assertVersion(actual: number, expected: number) {
  if (actual !== expected) throw new Error("STATE_VERSION_CONFLICT");
}

function calculationHash(value: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function activeCase(tx: any, transactionId: string, lock = false) {
  if (lock) {
    await tx.execute(sql`
      SELECT id FROM complaint_holds
      WHERE transaction_id = ${transactionId} AND active = true
      FOR UPDATE
    `);
  }
  const [complaint] = await tx.select().from(complaintHolds).where(and(
    eq(complaintHolds.transactionId, transactionId),
    eq(complaintHolds.active, true)
  )).limit(1);
  return complaint;
}

async function appendEvent(tx: any, input: {
  caseId: string;
  eventType: typeof complaintEvents.$inferInsert.eventType;
  adminId: string;
  summary: string;
  evidenceReference?: string;
  evidenceHash: string;
  idempotencyKey: string;
  correlationId: string;
  sourceAuthorRole?: string;
  correctedEventId?: string;
  correctionReason?: string;
}) {
  const [event] = await tx.insert(complaintEvents).values({
    complaintCaseId: input.caseId,
    eventType: input.eventType,
    actorAccountId: input.adminId,
    summarySnapshot: input.summary,
    evidenceReference: input.evidenceReference,
    evidenceHash: input.evidenceHash,
    idempotencyKey: input.idempotencyKey,
    correlationId: input.correlationId,
    sourceAuthorRole: input.sourceAuthorRole,
    correctedEventId: input.correctedEventId,
    correctionReason: input.correctionReason
  }).returning();
  if (!event) throw new Error("COMPLAINT_EVENT_CREATE_FAILED");
  return event;
}

export async function recordComplaint(
  admin: Admin,
  transactionId: string,
  input: ComplaintIntakeInput,
  idempotency: Idempotency
) {
  return db.transaction(async (tx) => {
    await requireAssignment(tx, admin, "COMPLAINT_INTAKE");
    const command = "COMPLAINT_RECORD";
    const prior = await findIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash);
    if (prior) return prior;
    const transaction = await lockTransaction(tx, transactionId);
    assertVersion(transaction.stateVersion, input.expectedStateVersion);
    const correlationId = randomUUID();
    const existing = await activeCase(tx, transactionId, true);

    if (transaction.state === "PAYOUT_ON_HOLD") {
      if (!existing) throw new Error("COMPLAINT_CASE_REQUIRED");
      const event = await appendEvent(tx, {
        caseId: existing.id, eventType: "COMPLAINT_RECORDED", adminId: admin.id,
        summary: input.summary, evidenceReference: input.evidenceReference,
        evidenceHash: input.evidenceHash, idempotencyKey: idempotency.key,
        correlationId, sourceAuthorRole: input.sourceAuthorRole
      });
      await tx.update(complaintHolds).set({
        currentEventId: event.id, updatedAt: new Date()
      }).where(and(eq(complaintHolds.id, existing.id), eq(complaintHolds.currentEventId, existing.currentEventId)));
      const result = { complaintCaseId: existing.id, state: transaction.state, stateVersion: transaction.stateVersion, lifecycle: existing.lifecycle };
      await saveIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash, result);
      return result;
    }

    const postProcessing = POST_PROCESSING_STATES.has(transaction.state);
    if (!postProcessing && !ELIGIBLE_STATES.has(transaction.state)) throw new Error("COMPLAINT_NOT_ELIGIBLE");
    if (existing) throw new Error("COMPLAINT_ALREADY_ACTIVE");

    const [complaint] = await tx.insert(complaintHolds).values({
      transactionId,
      summary: input.summary,
      evidenceReference: input.evidenceReference,
      lifecycle: postProcessing ? "POST_PROCESSING_RECORDED" : "OPEN",
      active: !postProcessing,
      sourceState: transaction.state,
      sourceStateVersion: transaction.stateVersion,
      createdByAccountId: admin.id,
      resolvedAt: postProcessing ? new Date() : null
    }).returning();
    if (!complaint) throw new Error("COMPLAINT_CREATE_FAILED");
    const event = await appendEvent(tx, {
      caseId: complaint.id,
      eventType: postProcessing ? "POST_PROCESSING_RECORDED" : "COMPLAINT_RECORDED",
      adminId: admin.id,
      summary: input.summary,
      evidenceReference: input.evidenceReference,
      evidenceHash: input.evidenceHash,
      idempotencyKey: idempotency.key,
      correlationId,
      sourceAuthorRole: input.sourceAuthorRole
    });
    await tx.update(complaintHolds).set({ currentEventId: event.id }).where(eq(complaintHolds.id, complaint.id));

    let nextState = transaction.state;
    let nextVersion = transaction.stateVersion;
    if (!postProcessing) {
      nextState = "PAYOUT_ON_HOLD";
      nextVersion += 1;
      const [updated] = await tx.update(transactions).set({
        state: nextState, stateVersion: nextVersion, updatedAt: new Date()
      }).where(and(
        eq(transactions.id, transactionId),
        eq(transactions.state, transaction.state),
        eq(transactions.stateVersion, transaction.stateVersion)
      )).returning({ id: transactions.id });
      if (!updated) throw new Error("STATE_VERSION_CONFLICT");
    }
    await recordTransactionEvent(tx, {
      transactionId, actorAccountId: admin.id,
      eventType: postProcessing ? "COMPLAINT_POST_PROCESSING_RECORDED" : "COMPLAINT_HOLD_CREATED",
      beforeState: transaction.state, afterState: nextState,
      stateVersion: nextVersion, correlationId, evidenceReference: event.id
    });
    const result = { complaintCaseId: complaint.id, state: nextState, stateVersion: nextVersion, lifecycle: complaint.lifecycle };
    await saveIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash, result);
    return result;
  });
}

export async function correctComplaintEvidence(
  admin: Admin,
  transactionId: string,
  complaintCaseId: string,
  input: ComplaintCorrectionInput,
  idempotency: Idempotency
) {
  return db.transaction(async (tx) => {
    await requireAssignment(tx, admin, "COMPLAINT_INTAKE");
    const command = "COMPLAINT_EVIDENCE_CORRECT";
    const prior = await findIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash);
    if (prior) return prior;
    const transaction = await lockTransaction(tx, transactionId);
    assertVersion(transaction.stateVersion, input.expectedStateVersion);
    const complaint = await activeCase(tx, transactionId, true);
    if (!complaint || complaint.id !== complaintCaseId || complaint.currentEventId !== input.correctedEventId) {
      throw new Error("COMPLAINT_CORRECTION_TARGET_INVALID");
    }
    const correlationId = randomUUID();
    const event = await appendEvent(tx, {
      caseId: complaint.id, eventType: "EVIDENCE_CORRECTED", adminId: admin.id,
      summary: input.summary, evidenceReference: input.evidenceReference,
      evidenceHash: input.evidenceHash, idempotencyKey: idempotency.key,
      correlationId, sourceAuthorRole: input.sourceAuthorRole,
      correctedEventId: input.correctedEventId, correctionReason: input.correctionReason
    });
    const [updated] = await tx.update(complaintHolds).set({
      currentEventId: event.id, summary: input.summary,
      evidenceReference: input.evidenceReference, updatedAt: new Date()
    }).where(and(
      eq(complaintHolds.id, complaint.id),
      eq(complaintHolds.currentEventId, input.correctedEventId)
    )).returning({ id: complaintHolds.id });
    if (!updated) throw new Error("COMPLAINT_CORRECTION_CONFLICT");
    await recordTransactionEvent(tx, {
      transactionId, actorAccountId: admin.id, eventType: "COMPLAINT_EVIDENCE_CORRECTED",
      stateVersion: transaction.stateVersion, correlationId, evidenceReference: event.id
    });
    const result = { complaintCaseId, currentEventId: event.id, state: transaction.state, stateVersion: transaction.stateVersion };
    await saveIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash, result);
    return result;
  });
}

export async function recordNoAgreement(
  admin: Admin,
  transactionId: string,
  complaintCaseId: string,
  input: ComplaintNoAgreementInput,
  idempotency: Idempotency
) {
  return db.transaction(async (tx) => {
    await requireAssignment(tx, admin, "COMPLAINT_INTAKE");
    const command = "COMPLAINT_NO_AGREEMENT";
    const prior = await findIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash);
    if (prior) return prior;
    const transaction = await lockTransaction(tx, transactionId);
    assertVersion(transaction.stateVersion, input.expectedStateVersion);
    const complaint = await activeCase(tx, transactionId, true);
    if (!complaint || complaint.id !== complaintCaseId) throw new Error("COMPLAINT_CASE_NOT_FOUND");
    if (!["PAYOUT_ON_HOLD", "MANUAL_REVIEW_REQUIRED"].includes(transaction.state)) throw new Error("COMPLAINT_NO_AGREEMENT_NOT_ELIGIBLE");
    const correlationId = randomUUID();
    const event = await appendEvent(tx, {
      caseId: complaint.id, eventType: "NO_AGREEMENT_RECORDED", adminId: admin.id,
      summary: input.summary, evidenceReference: input.evidenceReference,
      evidenceHash: input.evidenceHash, idempotencyKey: idempotency.key, correlationId
    });
    let nextVersion = transaction.stateVersion;
    if (transaction.state === "PAYOUT_ON_HOLD") {
      nextVersion += 1;
      const [updated] = await tx.update(transactions).set({
        state: "MANUAL_REVIEW_REQUIRED", stateVersion: nextVersion, updatedAt: new Date()
      }).where(and(
        eq(transactions.id, transactionId),
        eq(transactions.state, "PAYOUT_ON_HOLD"),
        eq(transactions.stateVersion, transaction.stateVersion)
      )).returning({ id: transactions.id });
      if (!updated) throw new Error("STATE_VERSION_CONFLICT");
    }
    await tx.update(complaintHolds).set({
      lifecycle: "NO_AGREEMENT", currentEventId: event.id, updatedAt: new Date()
    }).where(eq(complaintHolds.id, complaint.id));
    await recordTransactionEvent(tx, {
      transactionId, actorAccountId: admin.id, eventType: "COMPLAINT_NO_AGREEMENT",
      beforeState: transaction.state, afterState: "MANUAL_REVIEW_REQUIRED",
      stateVersion: nextVersion, correlationId, evidenceReference: event.id
    });
    const result = { complaintCaseId, state: "MANUAL_REVIEW_REQUIRED", stateVersion: nextVersion, lifecycle: "NO_AGREEMENT" };
    await saveIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash, result);
    return result;
  });
}

export async function proposeComplaintAgreement(
  admin: Admin,
  transactionId: string,
  complaintCaseId: string,
  input: ComplaintAgreementInput,
  idempotency: Idempotency
) {
  return db.transaction(async (tx) => {
    await requireAssignment(tx, admin, "COMPLAINT_INTAKE");
    const command = "COMPLAINT_AGREEMENT_PROPOSE";
    const prior = await findIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash);
    if (prior) return prior;
    const transaction = await lockTransaction(tx, transactionId);
    assertVersion(transaction.stateVersion, input.expectedStateVersion);
    if (!["PAYOUT_ON_HOLD", "MANUAL_REVIEW_REQUIRED"].includes(transaction.state)) throw new Error("COMPLAINT_AGREEMENT_NOT_ELIGIBLE");
    const complaint = await activeCase(tx, transactionId, true);
    if (!complaint || complaint.id !== complaintCaseId || complaint.currentEventId !== input.evidenceEventId) {
      throw new Error("COMPLAINT_EVIDENCE_NOT_CURRENT");
    }
    if (complaint.currentAgreementId) {
      const [current] = await tx.select({ status: complaintAgreements.status })
        .from(complaintAgreements).where(eq(complaintAgreements.id, complaint.currentAgreementId)).limit(1);
      if (current?.status !== "REJECTED") throw new Error("COMPLAINT_AGREEMENT_ALREADY_ACTIVE");
    }
    const [terms] = await tx.select().from(transactionTerms)
      .where(eq(transactionTerms.transactionId, transactionId)).limit(1);
    if (!terms?.frozenAt) throw new Error("FROZEN_TERMS_REQUIRED");
    const participants = await tx.select().from(transactionParticipants)
      .where(eq(transactionParticipants.transactionId, transactionId));
    const buyer = participants.find((participant) => participant.role === "BUYER");
    const seller = participants.find((participant) => participant.role === "SELLER");
    if (!buyer || !seller) throw new Error("PARTICIPANTS_INCOMPLETE");
    const [buyerDestination] = await tx.select().from(buyerRefundDestinations).where(and(
      eq(buyerRefundDestinations.transactionId, transactionId),
      eq(buyerRefundDestinations.participantAccountId, buyer.accountId)
    )).limit(1);
    const [sellerDestination] = await tx.select().from(sellerPayoutDestinations).where(and(
      eq(sellerPayoutDestinations.transactionId, transactionId),
      eq(sellerPayoutDestinations.participantAccountId, seller.accountId)
    )).limit(1);
    const settlementPool = terms.itemPrice + terms.shippingCost;
    let buyerAmount = 0;
    let sellerAmount = 0;
    if (input.outcome === "SELLER_RELEASE") {
      if (!sellerDestination?.lockedAt) throw new Error("SELLER_DESTINATION_NOT_FROZEN");
      sellerAmount = settlementPool;
    } else if (input.outcome === "BUYER_REFUND") {
      if (!buyerDestination?.lockedAt) throw new Error("BUYER_DESTINATION_NOT_FROZEN");
      buyerAmount = terms.totalAmount;
    } else {
      if (!buyerDestination?.lockedAt || !sellerDestination?.lockedAt) throw new Error("SPLIT_DESTINATIONS_NOT_FROZEN");
      buyerAmount = input.buyerAmount ?? 0;
      sellerAmount = input.sellerAmount ?? 0;
      if (buyerAmount <= 0 || sellerAmount <= 0 || buyerAmount + sellerAmount !== settlementPool) {
        throw new Error("SPLIT_AMOUNT_INVALID");
      }
    }
    const [lastVersion] = await tx.select({ version: complaintAgreements.version })
      .from(complaintAgreements)
      .where(eq(complaintAgreements.complaintCaseId, complaint.id))
      .orderBy(desc(complaintAgreements.version)).limit(1);
    const version = (lastVersion?.version ?? 0) + 1;
    const hash = calculationHash({
      transactionId, itemPrice: terms.itemPrice, shippingCost: terms.shippingCost,
      serviceFee: terms.serviceFee, totalAmount: terms.totalAmount,
      outcome: input.outcome, buyerAmount, sellerAmount,
      buyerDestinationBindingId: buyerDestination?.participantAccountId ?? null,
      sellerDestinationBindingId: sellerDestination?.participantAccountId ?? null,
      currency: "IDR"
    });
    const [agreement] = await tx.insert(complaintAgreements).values({
      complaintCaseId: complaint.id, version, outcome: input.outcome,
      buyerAmount, sellerAmount, calculationHash: hash,
      buyerDestinationBindingId: buyerDestination?.participantAccountId,
      sellerDestinationBindingId: sellerDestination?.participantAccountId,
      evidenceEventId: input.evidenceEventId,
      evidenceReference: input.evidenceReference,
      evidenceHash: input.evidenceHash,
      proposedByAccountId: admin.id
    }).returning();
    if (!agreement) throw new Error("COMPLAINT_AGREEMENT_CREATE_FAILED");
    const correlationId = randomUUID();
    const event = await appendEvent(tx, {
      caseId: complaint.id, eventType: "AGREEMENT_PROPOSED", adminId: admin.id,
      summary: "Kesepakatan tertulis diajukan untuk persetujuan Admin.",
      evidenceReference: input.evidenceReference, evidenceHash: input.evidenceHash,
      idempotencyKey: idempotency.key, correlationId
    });
    await tx.update(complaintHolds).set({
      lifecycle: "AGREEMENT_PENDING_APPROVAL", currentAgreementId: agreement.id,
      currentEventId: event.id, updatedAt: new Date()
    }).where(eq(complaintHolds.id, complaint.id));
    await recordTransactionEvent(tx, {
      transactionId, actorAccountId: admin.id, eventType: "COMPLAINT_AGREEMENT_PROPOSED",
      stateVersion: transaction.stateVersion, correlationId, evidenceReference: agreement.id,
      payload: { outcome: input.outcome, version }
    });
    const result = { complaintCaseId, agreementId: agreement.id, version, status: "PENDING", state: transaction.state, stateVersion: transaction.stateVersion };
    await saveIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash, result);
    return result;
  });
}

export async function decideComplaintAgreement(
  admin: Admin,
  transactionId: string,
  complaintCaseId: string,
  agreementId: string,
  input: ComplaintApprovalInput,
  idempotency: Idempotency
) {
  return db.transaction(async (tx) => {
    await requireAssignment(tx, admin, "COMPLAINT_APPROVAL");
    const command = "COMPLAINT_AGREEMENT_DECIDE";
    const prior = await findIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash);
    if (prior) return prior;
    const transaction = await lockTransaction(tx, transactionId);
    assertVersion(transaction.stateVersion, input.expectedStateVersion);
    const complaint = await activeCase(tx, transactionId, true);
    if (!complaint || complaint.id !== complaintCaseId || complaint.currentAgreementId !== agreementId) {
      throw new Error("COMPLAINT_AGREEMENT_NOT_CURRENT");
    }
    await tx.execute(sql`SELECT id FROM complaint_agreements WHERE id = ${agreementId} FOR UPDATE`);
    const [agreement] = await tx.select().from(complaintAgreements)
      .where(eq(complaintAgreements.id, agreementId)).limit(1);
    if (!agreement || agreement.status !== "PENDING") throw new Error("COMPLAINT_AGREEMENT_FINAL");
    const correlationId = randomUUID();
    await tx.insert(complaintAgreementApprovals).values({
      agreementId, adminAccountId: admin.id, decision: input.decision,
      correlationId, idempotencyKey: idempotency.key
    });
    if (input.decision === "REJECTED") {
      await tx.update(complaintAgreements).set({ status: "REJECTED", decidedAt: new Date() })
        .where(and(eq(complaintAgreements.id, agreementId), eq(complaintAgreements.status, "PENDING")));
      await tx.update(complaintHolds).set({ lifecycle: "NO_AGREEMENT", updatedAt: new Date() })
        .where(eq(complaintHolds.id, complaint.id));
      await recordTransactionEvent(tx, {
        transactionId, actorAccountId: admin.id, eventType: "COMPLAINT_AGREEMENT_REJECTED",
        stateVersion: transaction.stateVersion, correlationId, evidenceReference: agreement.id
      });
      const result = { complaintCaseId, agreementId, status: "REJECTED", state: transaction.state, stateVersion: transaction.stateVersion };
      await saveIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash, result);
      return result;
    }
    const approvals = await tx.select({ adminId: complaintAgreementApprovals.adminAccountId })
      .from(complaintAgreementApprovals)
      .where(and(
        eq(complaintAgreementApprovals.agreementId, agreementId),
        eq(complaintAgreementApprovals.decision, "APPROVED")
      ));
    if (new Set(approvals.map((approval) => approval.adminId)).size < 2) {
      const result = { complaintCaseId, agreementId, status: "PENDING", approvals: 1, state: transaction.state, stateVersion: transaction.stateVersion };
      await saveIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash, result);
      return result;
    }
    if (!["PAYOUT_ON_HOLD", "MANUAL_REVIEW_REQUIRED"].includes(transaction.state)) throw new Error("COMPLAINT_HANDOFF_NOT_ELIGIBLE");
    const targetState = agreement.outcome === "SELLER_RELEASE"
      ? "READY_FOR_PAYOUT"
      : agreement.outcome === "BUYER_REFUND"
        ? "REFUND_READY"
        : "PAYOUT_ON_HOLD";
    const nextVersion = transaction.stateVersion + 1;
    const now = new Date();
    const [updated] = await tx.update(transactions).set({
      state: targetState, stateVersion: nextVersion, updatedAt: now
    }).where(and(
      eq(transactions.id, transactionId),
      eq(transactions.state, transaction.state),
      eq(transactions.stateVersion, transaction.stateVersion)
    )).returning({ id: transactions.id });
    if (!updated) throw new Error("STATE_VERSION_CONFLICT");
    await tx.update(complaintAgreements).set({ status: "APPROVED", decidedAt: now })
      .where(and(eq(complaintAgreements.id, agreementId), eq(complaintAgreements.status, "PENDING")));
    const [handoff] = await tx.insert(complaintFinancialHandoffs).values({
      complaintCaseId, agreementId, transactionId, outcome: agreement.outcome,
      buyerAmount: agreement.buyerAmount, sellerAmount: agreement.sellerAmount,
      calculationHash: agreement.calculationHash,
      buyerDestinationBindingId: agreement.buyerDestinationBindingId,
      sellerDestinationBindingId: agreement.sellerDestinationBindingId,
      evidenceReference: agreement.evidenceReference,
      evidenceHash: agreement.evidenceHash,
      sourceState: targetState, sourceStateVersion: nextVersion, approvedAt: now
    }).returning();
    if (!handoff) throw new Error("COMPLAINT_HANDOFF_CREATE_FAILED");
    const event = await appendEvent(tx, {
      caseId: complaint.id, eventType: "AGREEMENT_APPROVED", adminId: admin.id,
      summary: "Kesepakatan telah disetujui dua Admin dan siap diteruskan.",
      evidenceReference: handoff.id, evidenceHash: agreement.evidenceHash,
      idempotencyKey: idempotency.key, correlationId
    });
    await tx.update(complaintHolds).set({
      lifecycle: "AGREEMENT_APPROVED", active: false, currentEventId: event.id,
      resolvedAt: now, updatedAt: now
    }).where(eq(complaintHolds.id, complaint.id));
    await recordTransactionEvent(tx, {
      transactionId, actorAccountId: admin.id, eventType: "COMPLAINT_AGREEMENT_APPROVED",
      beforeState: transaction.state, afterState: targetState, stateVersion: nextVersion,
      correlationId, evidenceReference: handoff.id, payload: { outcome: agreement.outcome }
    });
    const result = { complaintCaseId, agreementId, handoffId: handoff.id, status: "APPROVED", state: targetState, stateVersion: nextVersion };
    await saveIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash, result);
    return result;
  });
}

export async function readAdminComplaints(admin: Admin, transactionId: string) {
  return db.transaction(async (tx) => {
    await requireComplaintReadAssignment(tx, admin);
    const [transaction] = await tx.select({ state: transactions.state, stateVersion: transactions.stateVersion })
      .from(transactions).where(eq(transactions.id, transactionId)).limit(1);
    if (!transaction) throw new Error("TRANSACTION_NOT_FOUND");
    const cases = await tx.select().from(complaintHolds)
      .where(eq(complaintHolds.transactionId, transactionId))
      .orderBy(desc(complaintHolds.createdAt));
    const details = [];
    for (const complaint of cases) {
      const events = await tx.select().from(complaintEvents)
        .where(eq(complaintEvents.complaintCaseId, complaint.id))
        .orderBy(asc(complaintEvents.createdAt));
      const agreements = await tx.select().from(complaintAgreements)
        .where(eq(complaintAgreements.complaintCaseId, complaint.id))
        .orderBy(asc(complaintAgreements.version));
      const handoff = (await tx.select().from(complaintFinancialHandoffs)
        .where(eq(complaintFinancialHandoffs.complaintCaseId, complaint.id)).limit(1))[0] ?? null;
      details.push({ ...complaint, events, agreements, handoff });
    }
    return { transactionId, ...transaction, complaints: details };
  });
}

export async function readAdminComplaint(admin: Admin, transactionId: string, complaintCaseId: string) {
  const result = await readAdminComplaints(admin, transactionId);
  const complaint = result.complaints.find((item) => item.id === complaintCaseId);
  if (!complaint) throw new Error("COMPLAINT_CASE_NOT_FOUND");
  return { transactionId, state: result.state, stateVersion: result.stateVersion, complaint };
}

export async function readParticipantComplaint(transactionId: string, actorAccountId: string) {
  const [participant] = await db.select({ role: transactionParticipants.role })
    .from(transactionParticipants).where(and(
      eq(transactionParticipants.transactionId, transactionId),
      eq(transactionParticipants.accountId, actorAccountId)
    )).limit(1);
  if (!participant) throw new Error("TRANSACTION_FORBIDDEN");
  const [complaint] = await db.select().from(complaintHolds)
    .where(eq(complaintHolds.transactionId, transactionId))
    .orderBy(desc(complaintHolds.createdAt)).limit(1);
  if (!complaint) return null;
  const publicStatus = complaint.lifecycle === "POST_PROCESSING_RECORDED"
    ? "POST_PROCESSING_RECORDED"
    : complaint.lifecycle === "AGREEMENT_APPROVED"
      ? "AGREEMENT_RECORDED"
      : complaint.lifecycle === "NO_AGREEMENT"
        ? "MANUAL_REVIEW"
        : "HOLD_ACTIVE";
  return {
    transactionId,
    status: publicStatus,
    summary: publicStatus === "AGREEMENT_RECORDED"
      ? "Kesepakatan sudah dicatat dan menunggu proses berikutnya."
      : publicStatus === "POST_PROCESSING_RECORDED"
        ? "Laporan dicatat setelah proses finansial dimulai."
        : "Transaksi ditahan sementara untuk penyelesaian di luar sistem.",
    nextResponsibleActor: publicStatus === "AGREEMENT_RECORDED" ? "ADMIN" : "BUYER_SELLER",
    recordedAt: complaint.createdAt.toISOString(),
    updatedAt: complaint.updatedAt.toISOString()
  };
}
