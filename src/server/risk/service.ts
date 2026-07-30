import { createHash, randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  accounts,
  adminTaskAssignments,
  buyerRefundDestinations,
  cancellationRequests,
  complaintFinancialHandoffs,
  complaintHolds,
  financialOperations,
  riskEvents,
  riskFinancialHandoffs,
  riskHolds,
  riskReviewApprovals,
  riskReviews,
  transactionParticipants,
  transactionTerms,
  transactions
} from "@/server/db/schema";
import { recordRejectedMutationEvent, recordTransactionEvent } from "@/server/transaction/audit";
import { findIdempotentResult, saveIdempotentResult } from "@/server/transaction/mutation";
import type {
  RiskCorrectionInput,
  RiskDecisionInput,
  RiskIntakeInput,
  RiskReviewInput
} from "./contracts";

type Admin = { id: string; isAdmin: boolean };
type Idempotency = { key: string; requestHash: string };
type RiskScope = "RISK_INTAKE" | "RISK_APPROVAL";

const ACTIVE_STATES = new Set([
  "PAYMENT_CONFIRMED", "READY_FOR_FULFILLMENT", "WAITING_COMPLETION_REPORTS",
  "WAITING_OTHER_COMPLETION_REPORT", "READY_FOR_BUYER_CONFIRMATION",
  "WAITING_BUYER_CONFIRMATION", "BUYER_CONFIRMATION_OVERDUE",
  "READY_FOR_PAYOUT", "MANUAL_REVIEW_REQUIRED"
]);
const PRE_AUTHORITY_STATES = new Set([
  "WAITING_COUNTERPARTY", "WAITING_COUNTERPARTY_DATA",
  "WAITING_BUYER_PAYMENT", "PAYMENT_UNDER_REVIEW", "PAYMENT_EXCEPTION_REVIEW"
]);
const CANCELLATION_STATES = new Set([
  "CANCELLATION_REQUESTED", "CANCELLATION_PENDING_RECONCILIATION",
  "FUNDED_CANCELLATION_REVIEW"
]);
const PROCESSING_STATES = new Set([
  "PAYOUT_PROCESSING", "REFUND_PROCESSING", "SPLIT_PROCESSING"
]);
const TERMINAL_STATES = new Set([
  "PAID_OUT", "REFUNDED", "SPLIT_SETTLED", "PAYMENT_EXPIRED", "CANCELLED"
]);

function hash(value: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function requireAssignment(tx: any, admin: Admin, scope: RiskScope) {
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
  if (!assignment) throw new Error("RISK_ASSIGNMENT_REQUIRED");
}

async function requireReadAssignment(tx: any, admin: Admin) {
  if (!admin.isAdmin) throw new Error("FORBIDDEN");
  const [assignment] = await tx.select({ id: adminTaskAssignments.id })
    .from(adminTaskAssignments)
    .where(and(
      eq(adminTaskAssignments.accountId, admin.id),
      inArray(adminTaskAssignments.taskScope, ["RISK_INTAKE", "RISK_APPROVAL"]),
      isNull(adminTaskAssignments.revokedAt)
    )).limit(1);
  if (!assignment) throw new Error("RISK_ASSIGNMENT_REQUIRED");
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

async function currentActiveCase(tx: any, transactionId: string, lock = false) {
  if (lock) {
    await tx.execute(sql`
      SELECT id FROM risk_holds
      WHERE transaction_id = ${transactionId} AND active = true
      FOR UPDATE
    `);
  }
  const [risk] = await tx.select().from(riskHolds).where(and(
    eq(riskHolds.transactionId, transactionId),
    eq(riskHolds.active, true)
  )).limit(1);
  return risk;
}

async function appendEvent(tx: any, input: {
  riskCaseId: string;
  eventType: string;
  actorAccountId: string;
  summary: string;
  evidenceReference?: string;
  evidenceHash: string;
  correlationId: string;
  idempotencyKey: string;
  correctedEventId?: string;
  correctionReason?: string;
}) {
  const [event] = await tx.insert(riskEvents).values({
    riskCaseId: input.riskCaseId,
    eventType: input.eventType,
    actorAccountId: input.actorAccountId,
    summarySnapshot: input.summary,
    evidenceReference: input.evidenceReference,
    evidenceHash: input.evidenceHash,
    correlationId: input.correlationId,
    idempotencyKey: input.idempotencyKey,
    correctedEventId: input.correctedEventId,
    correctionReason: input.correctionReason
  }).returning();
  if (!event) throw new Error("RISK_EVENT_CREATE_FAILED");
  return event;
}

async function recordOnlyOwner(tx: any, transactionId: string, state: string) {
  const [cancellationOwner] = await tx.select({ id: cancellationRequests.id })
    .from(cancellationRequests)
    .where(and(
      eq(cancellationRequests.transactionId, transactionId),
      eq(cancellationRequests.status, "ACTIVE"),
      eq(cancellationRequests.delegationType, "RISK"),
      eq(cancellationRequests.delegationStatus, "REQUIRED")
    )).limit(1);
  if (cancellationOwner) {
    return { sourceOwnerType: "CANCELLATION_CASE", sourceOwnerId: cancellationOwner.id };
  }
  if (state === "PAYOUT_ON_HOLD") {
    const [owner] = await tx.select({ id: complaintHolds.id }).from(complaintHolds)
      .where(and(eq(complaintHolds.transactionId, transactionId), eq(complaintHolds.active, true))).limit(1);
    if (!owner) throw new Error("RISK_SOURCE_OWNER_NOT_FOUND");
    return { sourceOwnerType: "COMPLAINT_CASE", sourceOwnerId: owner.id };
  }
  if (CANCELLATION_STATES.has(state)) {
    const [owner] = await tx.select({ id: cancellationRequests.id }).from(cancellationRequests)
      .where(and(eq(cancellationRequests.transactionId, transactionId), eq(cancellationRequests.status, "ACTIVE"))).limit(1);
    if (!owner) throw new Error("RISK_SOURCE_OWNER_NOT_FOUND");
    return { sourceOwnerType: "CANCELLATION_CASE", sourceOwnerId: owner.id };
  }
  if (state === "REFUND_READY") {
    const [complaint] = await tx.select({ id: complaintFinancialHandoffs.id })
      .from(complaintFinancialHandoffs)
      .where(eq(complaintFinancialHandoffs.transactionId, transactionId)).limit(1);
    const [cancellation] = await tx.select({ id: cancellationRequests.id })
      .from(cancellationRequests)
      .where(eq(cancellationRequests.transactionId, transactionId))
      .orderBy(desc(cancellationRequests.createdAt)).limit(1);
    const ownerId = complaint?.id ?? cancellation?.id;
    if (!ownerId) throw new Error("RISK_SOURCE_OWNER_NOT_FOUND");
    return { sourceOwnerType: "REFUND_CASE", sourceOwnerId: ownerId };
  }
  if (PROCESSING_STATES.has(state)) {
    const [operation] = await tx.select({ id: financialOperations.id })
      .from(financialOperations)
      .where(eq(financialOperations.transactionId, transactionId))
      .orderBy(desc(financialOperations.createdAt)).limit(1);
    if (!operation) throw new Error("RISK_SOURCE_OWNER_NOT_FOUND");
    return { sourceOwnerType: "FINANCIAL_OPERATION", sourceOwnerId: operation.id };
  }
  return { sourceOwnerType: "TERMINAL_TRANSACTION", sourceOwnerId: transactionId };
}

async function runMutation<T>(
  admin: Admin,
  transactionId: string,
  eventType: string,
  correlationId: string,
  mutation: () => Promise<T>
): Promise<T> {
  try {
    return await mutation();
  } catch (error) {
    try {
      await recordRejectedMutationEvent({
        transactionId,
        actorAccountId: admin.id,
        eventType,
        correlationId,
        reason: error instanceof Error ? error.message : "RISK_MUTATION_REJECTED"
      });
    } catch {
      // Preserve the domain error if rejection-audit storage is unavailable.
    }
    throw error;
  }
}

export async function recordRisk(
  admin: Admin,
  transactionId: string,
  input: RiskIntakeInput,
  idempotency: Idempotency
) {
  const correlationId = randomUUID();
  return runMutation(admin, transactionId, "RISK_INTAKE_REJECTED", correlationId, () =>
    db.transaction(async (tx) => {
      await requireAssignment(tx, admin, "RISK_INTAKE");
      const command = "RISK_RECORD";
      const prior = await findIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash);
      if (prior) return prior;
      const transaction = await lockTransaction(tx, transactionId);
      assertVersion(transaction.stateVersion, input.expectedStateVersion);
      const [cancellationOwner] = await tx.select().from(cancellationRequests)
        .where(and(
          eq(cancellationRequests.transactionId, transactionId),
          eq(cancellationRequests.status, "ACTIVE"),
          eq(cancellationRequests.delegationType, "RISK"),
          eq(cancellationRequests.delegationStatus, "REQUIRED")
        )).limit(1);
      if (cancellationOwner && cancellationOwner.cause !== input.category) {
        throw new Error("RISK_CANCELLATION_CAUSE_MISMATCH");
      }
      if (transaction.state === "RISK_HOLD") {
        const existing = await currentActiveCase(tx, transactionId, true);
        if (!existing) throw new Error("RISK_CASE_REQUIRED");
        throw new Error("RISK_ALREADY_ACTIVE");
      }

      const active = ACTIVE_STATES.has(transaction.state);
      const postProcessing = PROCESSING_STATES.has(transaction.state) || TERMINAL_STATES.has(transaction.state);
      const recordOnly = PRE_AUTHORITY_STATES.has(transaction.state) ||
        CANCELLATION_STATES.has(transaction.state) ||
        ["PAYOUT_ON_HOLD", "REFUND_READY"].includes(transaction.state) ||
        postProcessing;
      if (!active && !recordOnly) throw new Error("RISK_NOT_ELIGIBLE");
      if (active && await currentActiveCase(tx, transactionId, true)) throw new Error("RISK_ALREADY_ACTIVE");

      const owner = cancellationOwner
        ? { sourceOwnerType: "CANCELLATION_CASE", sourceOwnerId: cancellationOwner.id }
        : active ? { sourceOwnerType: null, sourceOwnerId: null } :
          await recordOnlyOwner(tx, transactionId, transaction.state);
      const lifecycle = active ? "OPEN" : postProcessing ? "POST_PROCESSING_RECORDED" : "RECORD_ONLY";
      const [risk] = await tx.insert(riskHolds).values({
        transactionId,
        category: input.category,
        reason: input.reason,
        note: input.note,
        evidenceReference: input.evidenceReference,
        mode: active ? "ACTIVE_HOLD" : "RECORD_ONLY",
        lifecycle,
        active,
        sourceState: transaction.state,
        sourceStateVersion: transaction.stateVersion,
        sourceOwnerType: owner.sourceOwnerType,
        sourceOwnerId: owner.sourceOwnerId,
        createdByAccountId: admin.id,
        resolvedAt: active ? null : new Date()
      }).returning();
      if (!risk) throw new Error("RISK_CREATE_FAILED");
      const event = await appendEvent(tx, {
        riskCaseId: risk.id,
        eventType: postProcessing ? "POST_PROCESSING_RECORDED" : "RISK_RECORDED",
        actorAccountId: admin.id,
        summary: active ? "Risiko dicatat untuk review Admin." : "Catatan risiko diteruskan ke workflow yang berwenang.",
        evidenceReference: input.evidenceReference,
        evidenceHash: input.evidenceHash,
        correlationId,
        idempotencyKey: idempotency.key
      });
      await tx.update(riskHolds).set({ currentEventId: event.id, updatedAt: new Date() })
        .where(eq(riskHolds.id, risk.id));
      if (cancellationOwner) {
        const [closed] = await tx.update(cancellationRequests).set({
          status: "CLOSED",
          lifecycle: "REFERRED_TO_RISK",
          decision: "RISK_HANDOFF",
          delegationStatus: "REFERRED",
          riskCaseId: risk.id,
          resolvedAt: new Date(),
          stateVersion: cancellationOwner.stateVersion + 1
        }).where(and(
          eq(cancellationRequests.id, cancellationOwner.id),
          eq(cancellationRequests.status, "ACTIVE"),
          eq(cancellationRequests.delegationType, "RISK"),
          eq(cancellationRequests.delegationStatus, "REQUIRED"),
          eq(cancellationRequests.stateVersion, cancellationOwner.stateVersion)
        )).returning({ id: cancellationRequests.id });
        if (!closed) throw new Error("CANCELLATION_DELEGATION_CONFLICT");
      }

      let nextState = transaction.state;
      let nextVersion = transaction.stateVersion;
      if (active) {
        nextState = "RISK_HOLD";
        nextVersion += 1;
        const [updated] = await tx.update(transactions).set({
          state: "RISK_HOLD", stateVersion: nextVersion, updatedAt: new Date()
        }).where(and(
          eq(transactions.id, transactionId),
          eq(transactions.state, transaction.state),
          eq(transactions.stateVersion, transaction.stateVersion)
        )).returning({ id: transactions.id });
        if (!updated) throw new Error("STATE_VERSION_CONFLICT");
      }
      await recordTransactionEvent(tx, {
        transactionId,
        actorAccountId: admin.id,
        eventType: active ? "RISK_HOLD_CREATED" : "RISK_RECORD_ONLY_CREATED",
        beforeState: transaction.state,
        afterState: nextState,
        stateVersion: nextVersion,
        correlationId,
        evidenceReference: event.id,
        payload: { category: input.category, lifecycle }
      });
      const result = {
        riskCaseId: risk.id, state: nextState, stateVersion: nextVersion,
        lifecycle, mode: risk.mode
      };
      await saveIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash, result);
      return result;
    })
  );
}

export async function correctRiskEvidence(
  admin: Admin,
  transactionId: string,
  riskCaseId: string,
  input: RiskCorrectionInput,
  idempotency: Idempotency
) {
  const correlationId = randomUUID();
  return runMutation(admin, transactionId, "RISK_EVIDENCE_CORRECTION_REJECTED", correlationId, () =>
    db.transaction(async (tx) => {
      await requireAssignment(tx, admin, "RISK_INTAKE");
      const command = "RISK_EVIDENCE_CORRECT";
      const prior = await findIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash);
      if (prior) return prior;
      const transaction = await lockTransaction(tx, transactionId);
      assertVersion(transaction.stateVersion, input.expectedStateVersion);
      await tx.execute(sql`SELECT id FROM risk_holds WHERE id = ${riskCaseId} FOR UPDATE`);
      const [risk] = await tx.select().from(riskHolds).where(and(
        eq(riskHolds.id, riskCaseId),
        eq(riskHolds.transactionId, transactionId)
      )).limit(1);
      if (!risk || risk.currentEventId !== input.correctedEventId) throw new Error("RISK_CORRECTION_TARGET_INVALID");
      const event = await appendEvent(tx, {
        riskCaseId,
        eventType: "EVIDENCE_CORRECTED",
        actorAccountId: admin.id,
        summary: input.summary,
        evidenceReference: input.evidenceReference,
        evidenceHash: input.evidenceHash,
        correctedEventId: input.correctedEventId,
        correctionReason: input.correctionReason,
        correlationId,
        idempotencyKey: idempotency.key
      });
      const [updated] = await tx.update(riskHolds).set({
        currentEventId: event.id, updatedAt: new Date()
      }).where(and(
        eq(riskHolds.id, riskCaseId),
        eq(riskHolds.currentEventId, input.correctedEventId)
      )).returning({ id: riskHolds.id });
      if (!updated) throw new Error("RISK_CORRECTION_CONFLICT");
      await recordTransactionEvent(tx, {
        transactionId, actorAccountId: admin.id, eventType: "RISK_EVIDENCE_CORRECTED",
        stateVersion: transaction.stateVersion, correlationId, evidenceReference: event.id
      });
      const result = { riskCaseId, currentEventId: event.id, state: transaction.state, stateVersion: transaction.stateVersion };
      await saveIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash, result);
      return result;
    })
  );
}

export async function proposeRiskReview(
  admin: Admin,
  transactionId: string,
  riskCaseId: string,
  input: RiskReviewInput,
  idempotency: Idempotency
) {
  const correlationId = randomUUID();
  return runMutation(admin, transactionId, "RISK_REVIEW_PROPOSAL_REJECTED", correlationId, () =>
    db.transaction(async (tx) => {
      await requireAssignment(tx, admin, "RISK_APPROVAL");
      const command = "RISK_REVIEW_PROPOSE";
      const prior = await findIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash);
      if (prior) return prior;
      const transaction = await lockTransaction(tx, transactionId);
      assertVersion(transaction.stateVersion, input.expectedStateVersion);
      if (transaction.state !== "RISK_HOLD") throw new Error("RISK_REVIEW_NOT_ELIGIBLE");
      const risk = await currentActiveCase(tx, transactionId, true);
      if (!risk || risk.id !== riskCaseId || risk.mode !== "ACTIVE_HOLD") throw new Error("RISK_CASE_NOT_ACTIVE");
      if (risk.currentEventId !== input.evidenceEventId) throw new Error("RISK_EVIDENCE_NOT_CURRENT");
      if (risk.currentReviewId) {
        const [current] = await tx.select({ status: riskReviews.status, evidenceEventId: riskReviews.evidenceEventId })
          .from(riskReviews).where(eq(riskReviews.id, risk.currentReviewId)).limit(1);
        if (current?.status === "PENDING") throw new Error("RISK_REVIEW_ALREADY_PENDING");
        if (current?.evidenceEventId === input.evidenceEventId) throw new Error("RISK_NEW_EVIDENCE_REQUIRED");
      }

      let buyerAmount = 0;
      let buyerDestinationBindingId: string | undefined;
      if (input.outcome === "BUYER_REFUND") {
        const [terms] = await tx.select().from(transactionTerms)
          .where(eq(transactionTerms.transactionId, transactionId)).limit(1);
        const [buyer] = await tx.select({ accountId: transactionParticipants.accountId })
          .from(transactionParticipants).where(and(
            eq(transactionParticipants.transactionId, transactionId),
            eq(transactionParticipants.role, "BUYER")
          )).limit(1);
        if (!terms?.frozenAt || !buyer) throw new Error("RISK_FROZEN_DATA_REQUIRED");
        const [destination] = await tx.select().from(buyerRefundDestinations).where(and(
          eq(buyerRefundDestinations.transactionId, transactionId),
          eq(buyerRefundDestinations.participantAccountId, buyer.accountId)
        )).limit(1);
        if (!destination?.lockedAt) throw new Error("BUYER_DESTINATION_NOT_FROZEN");
        buyerAmount = terms.totalAmount;
        buyerDestinationBindingId = destination.participantAccountId;
      }
      const [last] = await tx.select({ version: riskReviews.version }).from(riskReviews)
        .where(eq(riskReviews.riskCaseId, riskCaseId))
        .orderBy(desc(riskReviews.version)).limit(1);
      const version = (last?.version ?? 0) + 1;
      const calculationHash = hash({
        transactionId, outcome: input.outcome, buyerAmount,
        buyerDestinationBindingId: buyerDestinationBindingId ?? null,
        currency: "IDR", evidenceEventId: input.evidenceEventId
      });
      const [review] = await tx.insert(riskReviews).values({
        riskCaseId, version, outcome: input.outcome, buyerAmount,
        calculationHash, buyerDestinationBindingId,
        evidenceEventId: input.evidenceEventId,
        decisionNote: input.decisionNote,
        proposedByAccountId: admin.id
      }).returning();
      if (!review) throw new Error("RISK_REVIEW_CREATE_FAILED");
      const [evidence] = await tx.select().from(riskEvents)
        .where(eq(riskEvents.id, input.evidenceEventId)).limit(1);
      if (!evidence) throw new Error("RISK_EVIDENCE_NOT_FOUND");
      const event = await appendEvent(tx, {
        riskCaseId, eventType: "REVIEW_PROPOSED", actorAccountId: admin.id,
        summary: "Review risiko diajukan untuk persetujuan.",
        evidenceReference: review.id, evidenceHash: evidence.evidenceHash,
        correlationId, idempotencyKey: idempotency.key
      });
      await tx.update(riskHolds).set({
        lifecycle: "REVIEW_PENDING_APPROVAL",
        currentReviewId: review.id,
        updatedAt: new Date()
      }).where(eq(riskHolds.id, riskCaseId));
      await recordTransactionEvent(tx, {
        transactionId, actorAccountId: admin.id, eventType: "RISK_REVIEW_PROPOSED",
        stateVersion: transaction.stateVersion, correlationId, evidenceReference: review.id,
        payload: { outcome: input.outcome, version }
      });
      const result = { riskCaseId, reviewId: review.id, version, status: "PENDING", state: transaction.state, stateVersion: transaction.stateVersion };
      await saveIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash, result);
      return result;
    })
  );
}

export async function decideRiskReview(
  admin: Admin,
  transactionId: string,
  riskCaseId: string,
  reviewId: string,
  input: RiskDecisionInput,
  idempotency: Idempotency
) {
  const correlationId = randomUUID();
  return runMutation(admin, transactionId, "RISK_REVIEW_DECISION_REJECTED", correlationId, () =>
    db.transaction(async (tx) => {
      await requireAssignment(tx, admin, "RISK_APPROVAL");
      const command = "RISK_REVIEW_DECIDE";
      const prior = await findIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash);
      if (prior) return prior;
      const transaction = await lockTransaction(tx, transactionId);
      assertVersion(transaction.stateVersion, input.expectedStateVersion);
      if (transaction.state !== "RISK_HOLD") throw new Error("RISK_REVIEW_NOT_ELIGIBLE");
      const risk = await currentActiveCase(tx, transactionId, true);
      if (!risk || risk.id !== riskCaseId || risk.currentReviewId !== reviewId) throw new Error("RISK_REVIEW_NOT_CURRENT");
      await tx.execute(sql`SELECT id FROM risk_reviews WHERE id = ${reviewId} FOR UPDATE`);
      const [review] = await tx.select().from(riskReviews)
        .where(eq(riskReviews.id, reviewId)).limit(1);
      if (!review || review.status !== "PENDING") throw new Error("RISK_REVIEW_FINAL");
      await tx.insert(riskReviewApprovals).values({
        reviewId, adminAccountId: admin.id, decision: input.decision,
        correlationId, idempotencyKey: idempotency.key
      });
      const [evidence] = await tx.select().from(riskEvents)
        .where(eq(riskEvents.id, review.evidenceEventId)).limit(1);
      if (!evidence) throw new Error("RISK_EVIDENCE_NOT_FOUND");

      if (input.decision === "REJECTED") {
        const now = new Date();
        await tx.update(riskReviews).set({ status: "REJECTED", decidedAt: now })
          .where(and(eq(riskReviews.id, reviewId), eq(riskReviews.status, "PENDING")));
        const event = await appendEvent(tx, {
          riskCaseId, eventType: "REVIEW_REJECTED", actorAccountId: admin.id,
          summary: "Review risiko ditolak.", evidenceReference: reviewId,
          evidenceHash: evidence.evidenceHash, correlationId,
          idempotencyKey: idempotency.key
        });
        await tx.update(riskHolds).set({
          lifecycle: "OPEN", updatedAt: now
        }).where(eq(riskHolds.id, riskCaseId));
        await recordTransactionEvent(tx, {
          transactionId, actorAccountId: admin.id, eventType: "RISK_REVIEW_REJECTED",
          stateVersion: transaction.stateVersion, correlationId, evidenceReference: reviewId
        });
        const result = { riskCaseId, reviewId, status: "REJECTED", state: transaction.state, stateVersion: transaction.stateVersion };
        await saveIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash, result);
        return result;
      }

      const approvals = await tx.select({ adminId: riskReviewApprovals.adminAccountId })
        .from(riskReviewApprovals).where(and(
          eq(riskReviewApprovals.reviewId, reviewId),
          eq(riskReviewApprovals.decision, "APPROVED")
        ));
      const approvalCount = new Set(approvals.map((approval) => approval.adminId)).size;
      if (review.outcome === "BUYER_REFUND" && approvalCount < 2) {
        const result = { riskCaseId, reviewId, status: "PENDING", approvals: approvalCount, state: transaction.state, stateVersion: transaction.stateVersion };
        await saveIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash, result);
        return result;
      }

      const now = new Date();
      let nextState = transaction.state;
      let nextVersion = transaction.stateVersion;
      let lifecycle = "REVIEWED_HOLD";
      let active = true;
      if (review.outcome === "CLEAR_TO_MANUAL_REVIEW") {
        nextState = "MANUAL_REVIEW_REQUIRED";
        nextVersion += 1;
        lifecycle = "CLEARED_TO_MANUAL_REVIEW";
        active = false;
      } else if (review.outcome === "BUYER_REFUND") {
        nextState = "REFUND_READY";
        nextVersion += 1;
        lifecycle = "REVIEW_APPROVED";
        active = false;
      }
      if (nextVersion !== transaction.stateVersion) {
        const [updated] = await tx.update(transactions).set({
          state: nextState, stateVersion: nextVersion, updatedAt: now
        }).where(and(
          eq(transactions.id, transactionId),
          eq(transactions.state, "RISK_HOLD"),
          eq(transactions.stateVersion, transaction.stateVersion)
        )).returning({ id: transactions.id });
        if (!updated) throw new Error("STATE_VERSION_CONFLICT");
      }
      await tx.update(riskReviews).set({ status: "APPROVED", decidedAt: now })
        .where(and(eq(riskReviews.id, reviewId), eq(riskReviews.status, "PENDING")));

      let handoffId: string | undefined;
      if (review.outcome === "BUYER_REFUND") {
        if (!review.buyerDestinationBindingId || review.buyerAmount <= 0) throw new Error("RISK_REFUND_SNAPSHOT_INVALID");
        const [handoff] = await tx.insert(riskFinancialHandoffs).values({
          riskCaseId, reviewId, transactionId,
          buyerAmount: review.buyerAmount,
          buyerDestinationBindingId: review.buyerDestinationBindingId,
          calculationHash: review.calculationHash,
          evidenceReference: evidence.evidenceReference ?? reviewId,
          evidenceHash: evidence.evidenceHash,
          sourceState: "REFUND_READY",
          sourceStateVersion: nextVersion,
          approvedAt: now
        }).returning();
        if (!handoff) throw new Error("RISK_HANDOFF_CREATE_FAILED");
        handoffId = handoff.id;
      }
      const event = await appendEvent(tx, {
        riskCaseId, eventType: "REVIEW_APPROVED", actorAccountId: admin.id,
        summary: review.outcome === "BUYER_REFUND"
          ? "Refund Buyer telah diotorisasi dan menunggu proses finansial terpisah."
          : "Review risiko telah disetujui.",
        evidenceReference: handoffId ?? reviewId,
        evidenceHash: evidence.evidenceHash,
        correlationId, idempotencyKey: idempotency.key
      });
      await tx.update(riskHolds).set({
        lifecycle, active,
        updatedAt: now, resolvedAt: active ? null : now
      }).where(eq(riskHolds.id, riskCaseId));
      await recordTransactionEvent(tx, {
        transactionId, actorAccountId: admin.id, eventType: "RISK_REVIEW_APPROVED",
        beforeState: transaction.state, afterState: nextState,
        stateVersion: nextVersion, correlationId,
        evidenceReference: handoffId ?? reviewId,
        payload: { outcome: review.outcome, approvals: approvalCount }
      });
      const result = {
        riskCaseId, reviewId, handoffId, status: "APPROVED",
        state: nextState, stateVersion: nextVersion, lifecycle
      };
      await saveIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash, result);
      return result;
    })
  );
}

export async function readAdminRisks(admin: Admin, transactionId: string) {
  return db.transaction(async (tx) => {
    await requireReadAssignment(tx, admin);
    const [transaction] = await tx.select({
      state: transactions.state, stateVersion: transactions.stateVersion
    }).from(transactions).where(eq(transactions.id, transactionId)).limit(1);
    if (!transaction) throw new Error("TRANSACTION_NOT_FOUND");
    const cases = await tx.select().from(riskHolds)
      .where(eq(riskHolds.transactionId, transactionId))
      .orderBy(desc(riskHolds.createdAt));
    const details = [];
    for (const risk of cases) {
      const events = await tx.select().from(riskEvents)
        .where(eq(riskEvents.riskCaseId, risk.id))
        .orderBy(asc(riskEvents.createdAt));
      const reviews = await tx.select().from(riskReviews)
        .where(eq(riskReviews.riskCaseId, risk.id))
        .orderBy(asc(riskReviews.version));
      const handoff = (await tx.select().from(riskFinancialHandoffs)
        .where(eq(riskFinancialHandoffs.riskCaseId, risk.id)).limit(1))[0] ?? null;
      details.push({ ...risk, events, reviews, handoff });
    }
    return { transactionId, ...transaction, risks: details };
  });
}

export async function readParticipantRisk(transactionId: string, actorAccountId: string) {
  const [participant] = await db.select({ id: transactionParticipants.accountId })
    .from(transactionParticipants).where(and(
      eq(transactionParticipants.transactionId, transactionId),
      eq(transactionParticipants.accountId, actorAccountId)
    )).limit(1);
  if (!participant) throw new Error("TRANSACTION_FORBIDDEN");
  const [risk] = await db.select({
    lifecycle: riskHolds.lifecycle,
    createdAt: riskHolds.createdAt,
    updatedAt: riskHolds.updatedAt
  }).from(riskHolds).where(and(
    eq(riskHolds.transactionId, transactionId),
    eq(riskHolds.active, true)
  )).limit(1);
  if (!risk) return null;
  return {
    transactionId,
    status: risk.lifecycle === "REVIEW_PENDING_APPROVAL" ? "REVIEW_IN_PROGRESS" : "HOLD_ACTIVE",
    summary: "Transaksi sedang ditinjau Admin.",
    nextResponsibleActor: "ADMIN",
    recordedAt: risk.createdAt.toISOString(),
    updatedAt: risk.updatedAt.toISOString()
  };
}
