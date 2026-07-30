import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  cancellationEvents,
  cancellationEvidence,
  cancellationEvidenceHeads,
  cancellationProviderResolutions,
  cancellationReconciliations,
  cancellationRequests,
  financialOperations,
  invitations,
  paymentInvoices,
  paymentProviderEvents,
  paymentReconciliations,
  riskHolds,
  complaintHolds,
  transactionParticipants,
  transactions,
  whatsappCheckpointHeads,
  whatsappCheckpoints
} from "@/server/db/schema";
import { addOperatingMinutesWib } from "@/server/domain/time/operating-hours";
import { ensurePaymentReconciliation } from "@/server/payment/reconciliation-repository";
import {
  findIdempotentResult,
  saveIdempotentResult
} from "@/server/transaction/mutation";
import { recordTransactionEvent } from "@/server/transaction/audit";
import {
  requireAnyCancellationAssignment,
  requireCancellationAssignment,
  requireParticipant
} from "./authorization";
import type {
  CancellationDecisionInput,
  CancellationRequestInput
} from "./contracts";

type Idempotency = { key: string; requestHash: string };
type ParticipantAccount = {
  id: string;
  whatsappVerifiedAt: Date | null;
};
type Admin = { id: string; isAdmin: boolean };

const DIRECT_STATES = new Set(["WAITING_COUNTERPARTY", "WAITING_COUNTERPARTY_DATA"]);
const REVIEW_STATES = new Set(["PAYMENT_UNDER_REVIEW", "PAYMENT_EXCEPTION_REVIEW"]);
const FUNDED_STATES = new Set(["PAYMENT_CONFIRMED", "READY_FOR_FULFILLMENT"]);
const CUTOFF_STATES = new Set([
  "WAITING_COMPLETION_REPORTS",
  "WAITING_OTHER_COMPLETION_REPORT",
  "READY_FOR_BUYER_CONFIRMATION",
  "WAITING_BUYER_CONFIRMATION",
  "BUYER_CONFIRMATION_OVERDUE",
  "READY_FOR_PAYOUT",
  "PAYOUT_ON_HOLD",
  "PAYOUT_PROCESSING",
  "PAID_OUT",
  "REFUND_PROCESSING",
  "REFUNDED",
  "SPLIT_PROCESSING",
  "SPLIT_SETTLED",
  "RISK_HOLD"
]);
const RISK_CAUSES = new Set(["PROHIBITED_OR_POLICY", "SUSPECTED_FRAUD"]);

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

async function appendEvent(tx: any, input: {
  requestId: string;
  eventType: typeof cancellationEvents.$inferInsert.eventType;
  actorId?: string;
  summary: string;
  evidenceReference?: string;
  correlationId: string;
  idempotencyKey: string;
}) {
  const [event] = await tx.insert(cancellationEvents).values({
    cancellationRequestId: input.requestId,
    eventType: input.eventType,
    actorAccountId: input.actorId,
    summary: input.summary,
    evidenceReference: input.evidenceReference,
    correlationId: input.correlationId,
    idempotencyKey: input.idempotencyKey
  }).returning();
  if (!event) throw new Error("CANCELLATION_EVENT_CREATE_FAILED");
  return event;
}

async function activeRequest(tx: any, transactionId: string, lock = false) {
  if (lock) {
    await tx.execute(sql`
      SELECT id FROM cancellation_requests
      WHERE transaction_id = ${transactionId} AND status = 'ACTIVE'
      FOR UPDATE
    `);
  }
  const [request] = await tx.select().from(cancellationRequests).where(and(
    eq(cancellationRequests.transactionId, transactionId),
    eq(cancellationRequests.status, "ACTIVE")
  )).limit(1);
  return request;
}

async function hasShipment(tx: any, transactionId: string) {
  const [head] = await tx.select({ id: whatsappCheckpointHeads.id })
    .from(whatsappCheckpointHeads)
    .innerJoin(
      whatsappCheckpoints,
      eq(whatsappCheckpointHeads.currentCheckpointId, whatsappCheckpoints.id)
    )
    .where(and(
      eq(whatsappCheckpointHeads.transactionId, transactionId),
      eq(whatsappCheckpointHeads.checkpointType, "SELLER_SHIPMENT"),
      eq(whatsappCheckpoints.deliveryResult, "SENT")
    )).limit(1);
  return Boolean(head);
}

async function hasHoldOrFinancialOperation(tx: any, transactionId: string) {
  const [operation] = await tx.select({ id: financialOperations.id })
    .from(financialOperations)
    .where(and(
      eq(financialOperations.transactionId, transactionId),
      inArray(financialOperations.result, ["PROCESSING", "SUCCESS", "UNKNOWN"])
    )).limit(1);
  const [complaint] = await tx.select({ id: complaintHolds.id })
    .from(complaintHolds)
    .where(and(eq(complaintHolds.transactionId, transactionId), eq(complaintHolds.active, true)))
    .limit(1);
  const [risk] = await tx.select({ id: riskHolds.id })
    .from(riskHolds)
    .where(and(eq(riskHolds.transactionId, transactionId), eq(riskHolds.active, true)))
    .limit(1);
  return Boolean(operation || complaint || risk);
}

function commandResult(transaction: typeof transactions.$inferSelect, request: typeof cancellationRequests.$inferSelect) {
  return {
    transactionId: transaction.id,
    cancellationRequestId: request.id,
    transactionState: transaction.state,
    stateVersion: transaction.stateVersion,
    requestStatus: request.status,
    lifecycle: request.lifecycle,
    delegationType: request.delegationType,
    delegationStatus: request.delegationStatus,
    linkedCaseId: request.riskCaseId ?? request.complaintCaseId ?? undefined,
    manualReviewReason: request.manualReviewReason ?? undefined
  };
}

export async function requestCancellation(
  account: ParticipantAccount,
  transactionId: string,
  input: CancellationRequestInput,
  idempotency: Idempotency
) {
  return db.transaction(async (tx) => {
    const command = "CANCELLATION_REQUEST";
    const prior = await findIdempotentResult(tx, account.id, command, idempotency.key, idempotency.requestHash);
    if (prior) return prior;
    const transaction = await lockTransaction(tx, transactionId);
    assertVersion(transaction.stateVersion, input.expectedStateVersion);
    const participant = await requireParticipant(tx, transactionId, account);
    const existing = await activeRequest(tx, transactionId, true);
    if (existing) {
      if (existing.requestedByAccountId === account.id) {
        const result = commandResult(transaction, existing);
        await saveIdempotentResult(tx, account.id, command, idempotency.key, idempotency.requestHash, result);
        return result;
      }
      throw new Error("CANCELLATION_ALREADY_ACTIVE");
    }
    if (CUTOFF_STATES.has(transaction.state)) throw new Error("CANCELLATION_CUTOFF");
    if (await hasShipment(tx, transactionId)) throw new Error("CANCELLATION_CUTOFF");

    const correlationId = randomUUID();
    const risk = RISK_CAUSES.has(input.cause);
    let nextState = transaction.state;
    let nextVersion = transaction.stateVersion;
    let status = "ACTIVE";
    let lifecycle = "ACTIVE";
    let decision: string | null = null;
    let delegationType = risk ? "RISK" : "NONE";
    let delegationStatus = risk ? "REQUIRED" : "NOT_REQUIRED";
    let resolvedAt: Date | null = null;
    let paymentReconciliationId: string | null = null;

    if (DIRECT_STATES.has(transaction.state)) {
      if (transaction.state === "WAITING_COUNTERPARTY" &&
          transaction.creatorAccountId !== account.id) {
        throw new Error("CANCELLATION_INITIATOR_REQUIRED");
      }
      nextState = "CANCELLED";
      nextVersion += 1;
      decision = "DIRECT_CANCELLED";
      if (!risk) {
        status = "CLOSED";
        lifecycle = "RESOLVED";
        resolvedAt = new Date();
      }
      await tx.update(invitations).set({ revokedAt: new Date() }).where(and(
        eq(invitations.transactionId, transactionId),
        isNull(invitations.revokedAt),
        isNull(invitations.usedAt)
      ));
    } else if (transaction.state === "WAITING_BUYER_PAYMENT") {
      const [invoice] = await tx.select().from(paymentInvoices).where(and(
        eq(paymentInvoices.transactionId, transactionId),
        eq(paymentInvoices.isActive, true),
        isNull(paymentInvoices.authoritativeProviderEventId)
      )).orderBy(desc(paymentInvoices.createdAt)).limit(1);
      if (!invoice) throw new Error("CANCELLATION_INVOICE_NOT_ELIGIBLE");
      const reconciliation = await ensurePaymentReconciliation(
        tx,
        invoice.id,
        "PROVIDER_STATUS_REVIEW"
      );
      paymentReconciliationId = reconciliation.id;
      await tx.update(paymentInvoices).set({
        isActive: false,
        retiredAt: new Date()
      }).where(and(eq(paymentInvoices.id, invoice.id), eq(paymentInvoices.isActive, true)));
      nextState = "CANCELLATION_PENDING_RECONCILIATION";
      nextVersion += 1;
    } else if (REVIEW_STATES.has(transaction.state)) {
      const [reconciliation] = await tx.select().from(paymentReconciliations)
        .where(and(
          eq(paymentReconciliations.transactionId, transactionId),
          isNull(paymentReconciliations.completedAt)
        )).orderBy(desc(paymentReconciliations.createdAt)).limit(1);
      if (!reconciliation) throw new Error("PAYMENT_RECONCILIATION_NOT_FOUND");
      paymentReconciliationId = reconciliation.id;
    } else if (FUNDED_STATES.has(transaction.state)) {
      if (await hasHoldOrFinancialOperation(tx, transactionId)) {
        throw new Error("CANCELLATION_CUTOFF");
      }
      nextState = "FUNDED_CANCELLATION_REVIEW";
      nextVersion += 1;
      decision = "FUNDED_REVIEW";
    } else {
      throw new Error("CANCELLATION_NOT_ELIGIBLE");
    }

    const [request] = await tx.insert(cancellationRequests).values({
      transactionId,
      requestedByAccountId: account.id,
      cause: input.cause,
      note: input.note,
      status,
      lifecycle,
      decision,
      delegationType,
      delegationStatus,
      priorState: transaction.state,
      paymentReconciliationId,
      resolvedAt,
      stateVersion: 0
    }).returning();
    if (!request) throw new Error("CANCELLATION_CREATE_FAILED");

    if (paymentReconciliationId) {
      await tx.insert(cancellationReconciliations).values({
        cancellationRequestId: request.id,
        paymentReconciliationId,
        deadlineAt: addOperatingMinutesWib(new Date(), 120)
      });
    }
    if (nextState !== transaction.state) {
      const [updated] = await tx.update(transactions).set({
        state: nextState,
        stateVersion: nextVersion,
        updatedAt: new Date()
      }).where(and(
        eq(transactions.id, transactionId),
        eq(transactions.state, transaction.state),
        eq(transactions.stateVersion, transaction.stateVersion)
      )).returning({ id: transactions.id });
      if (!updated) throw new Error("STATE_VERSION_CONFLICT");
    }
    const event = await appendEvent(tx, {
      requestId: request.id,
      eventType: "REQUESTED",
      actorId: account.id,
      summary: `Cancellation requested by ${participant.role}`,
      correlationId,
      idempotencyKey: idempotency.key
    });
    await recordTransactionEvent(tx, {
      transactionId,
      actorAccountId: account.id,
      eventType: risk ? "CANCELLATION_REQUESTED_RISK_REQUIRED" : "CANCELLATION_REQUESTED",
      beforeState: transaction.state,
      afterState: nextState,
      stateVersion: nextVersion,
      correlationId,
      evidenceReference: event.id,
      payload: { cancellationRequestId: request.id, cause: input.cause }
    });
    const finalTransaction = { ...transaction, state: nextState, stateVersion: nextVersion };
    const finalRequest = { ...request, status, lifecycle, decision, delegationType, delegationStatus };
    const result = commandResult(finalTransaction as typeof transaction, finalRequest as typeof request);
    await saveIdempotentResult(tx, account.id, command, idempotency.key, idempotency.requestHash, result);
    return result;
  });
}

async function safeRestore(
  actor: { id: string },
  transactionId: string,
  input: CancellationDecisionInput,
  idempotency: Idempotency,
  action: "WITHDRAWN" | "REJECTED"
) {
  return db.transaction(async (tx) => {
    const command = `CANCELLATION_${action}`;
    const prior = await findIdempotentResult(tx, actor.id, command, idempotency.key, idempotency.requestHash);
    if (prior) return prior;
    const transaction = await lockTransaction(tx, transactionId);
    assertVersion(transaction.stateVersion, input.expectedStateVersion);
    const request = await activeRequest(tx, transactionId, true);
    if (!request || request.id !== input.cancellationRequestId) throw new Error("CANCELLATION_NOT_FOUND");
    if (action === "WITHDRAWN" && request.requestedByAccountId !== actor.id) {
      throw new Error("CANCELLATION_REQUESTER_REQUIRED");
    }
    if (request.decision === "DIRECT_CANCELLED" ||
        request.delegationStatus !== "NOT_REQUIRED") {
      throw new Error("CANCELLATION_FINAL");
    }
    const [providerResolution] = await tx.select({ id: cancellationProviderResolutions.id })
      .from(cancellationProviderResolutions)
      .where(eq(cancellationProviderResolutions.cancellationRequestId, request.id))
      .limit(1);
    if (providerResolution) throw new Error("CANCELLATION_FINAL");
    let restorable = false;
    if (
      request.priorState === "WAITING_BUYER_PAYMENT" &&
      transaction.state === "CANCELLATION_PENDING_RECONCILIATION"
    ) {
      const [invoice] = await tx.select().from(paymentInvoices)
        .where(eq(paymentInvoices.transactionId, transactionId))
        .orderBy(desc(paymentInvoices.createdAt)).limit(1);
      const [unsafeEvent] = invoice
        ? await tx.select({ id: paymentProviderEvents.id }).from(paymentProviderEvents)
          .where(and(
            eq(paymentProviderEvents.invoiceId, invoice.id),
            inArray(paymentProviderEvents.validationOutcome, [
              "ACCEPTED",
              "UNKNOWN",
              "IDENTITY_MISMATCH",
              "AMOUNT_MISMATCH",
              "CURRENCY_MISMATCH",
              "FRAUD_MISMATCH",
              "CONFLICT"
            ])
          )).limit(1)
        : [];
      restorable = Boolean(
        invoice &&
        !invoice.authoritativeProviderEventId &&
        invoice.deadlineAt.getTime() > Date.now() &&
        !unsafeEvent &&
        !await hasShipment(tx, transactionId) &&
        !await hasHoldOrFinancialOperation(tx, transactionId)
      );
      if (restorable && invoice) {
        await tx.update(paymentInvoices).set({
          isActive: true,
          retiredAt: null
        }).where(and(
          eq(paymentInvoices.id, invoice.id),
          eq(paymentInvoices.isActive, false)
        ));
      }
    } else if (REVIEW_STATES.has(request.priorState) &&
               transaction.state === request.priorState &&
               request.paymentReconciliationId) {
      const [reconciliation] = await tx.select({ id: paymentReconciliations.id })
        .from(paymentReconciliations).where(and(
          eq(paymentReconciliations.id, request.paymentReconciliationId),
          isNull(paymentReconciliations.completedAt)
        )).limit(1);
      restorable = Boolean(reconciliation);
    } else if (
      FUNDED_STATES.has(request.priorState) &&
      transaction.state === "FUNDED_CANCELLATION_REVIEW"
    ) {
      restorable = !await hasShipment(tx, transactionId) &&
        !await hasHoldOrFinancialOperation(tx, transactionId);
    }
    const nextState = restorable ? request.priorState : "MANUAL_REVIEW_REQUIRED";
    const nextVersion = nextState === transaction.state
      ? transaction.stateVersion
      : transaction.stateVersion + 1;
    if (nextState !== transaction.state) {
      const [updated] = await tx.update(transactions).set({
        state: nextState,
        stateVersion: nextVersion,
        updatedAt: new Date()
      }).where(and(
        eq(transactions.id, transactionId),
        eq(transactions.state, transaction.state),
        eq(transactions.stateVersion, transaction.stateVersion)
      )).returning({ id: transactions.id });
      if (!updated) throw new Error("STATE_VERSION_CONFLICT");
    }
    const [closed] = await tx.update(cancellationRequests).set({
      status: "CLOSED",
      lifecycle: action,
      manualReviewReason: restorable ? null : "UNSAFE_WITHDRAWAL_OR_REJECTION",
      resolvedAt: new Date(),
      stateVersion: request.stateVersion + 1
    }).where(and(
      eq(cancellationRequests.id, request.id),
      eq(cancellationRequests.status, "ACTIVE"),
      eq(cancellationRequests.stateVersion, request.stateVersion)
    )).returning();
    if (!closed) throw new Error("CANCELLATION_CONFLICT");
    const correlationId = randomUUID();
    await appendEvent(tx, {
      requestId: request.id,
      eventType: action,
      actorId: actor.id,
      summary: input.reason,
      correlationId,
      idempotencyKey: idempotency.key
    });
    const result = commandResult(
      { ...transaction, state: nextState, stateVersion: nextVersion },
      closed
    );
    await saveIdempotentResult(tx, actor.id, command, idempotency.key, idempotency.requestHash, result);
    return result;
  });
}

export async function withdrawCancellation(
  account: ParticipantAccount,
  transactionId: string,
  input: CancellationDecisionInput,
  idempotency: Idempotency
) {
  await db.transaction((tx) => requireParticipant(tx, transactionId, account));
  return safeRestore(account, transactionId, input, idempotency, "WITHDRAWN");
}

export async function rejectCancellation(
  admin: Admin,
  transactionId: string,
  input: CancellationDecisionInput,
  idempotency: Idempotency
) {
  await db.transaction((tx) =>
    requireCancellationAssignment(tx, admin, "CANCELLATION_RECONCILIATION")
  );
  return safeRestore(admin, transactionId, input, idempotency, "REJECTED");
}

export async function readParticipantCancellation(transactionId: string, accountId: string) {
  const [participant] = await db.select({ role: transactionParticipants.role })
    .from(transactionParticipants)
    .where(and(
      eq(transactionParticipants.transactionId, transactionId),
      eq(transactionParticipants.accountId, accountId)
    )).limit(1);
  if (!participant) throw new Error("TRANSACTION_FORBIDDEN");
  const [transaction] = await db.select().from(transactions)
    .where(eq(transactions.id, transactionId)).limit(1);
  if (!transaction) throw new Error("TRANSACTION_NOT_FOUND");
  const [request] = await db.select({
    id: cancellationRequests.id,
    requestedByAccountId: cancellationRequests.requestedByAccountId,
    cause: cancellationRequests.cause,
    status: cancellationRequests.status,
    lifecycle: cancellationRequests.lifecycle,
    decision: cancellationRequests.decision,
    delegationType: cancellationRequests.delegationType,
    delegationStatus: cancellationRequests.delegationStatus,
    responseDeadlineAt: cancellationRequests.responseDeadlineAt,
    manualReviewReason: cancellationRequests.manualReviewReason,
    createdAt: cancellationRequests.createdAt
  }).from(cancellationRequests).where(eq(cancellationRequests.transactionId, transactionId))
    .orderBy(desc(cancellationRequests.createdAt)).limit(1);
  return {
    transactionId,
    state: transaction.state,
    stateVersion: transaction.stateVersion,
    role: participant.role,
    cancellation: request ? {
      id: request.id,
      ownRequest: request.requestedByAccountId === accountId,
      cause: request.cause,
      status: request.status,
      lifecycle: request.lifecycle,
      decision: request.decision,
      delegationType: request.delegationType,
      delegationStatus: request.delegationStatus,
      responseDeadlineAt: request.responseDeadlineAt,
      manualReviewReason: request.manualReviewReason,
      createdAt: request.createdAt
    } : null
  };
}

export async function readAdminCancellation(admin: Admin, transactionId: string) {
  await db.transaction((tx) => requireAnyCancellationAssignment(tx, admin));
  const [transaction] = await db.select().from(transactions)
    .where(eq(transactions.id, transactionId)).limit(1);
  if (!transaction) throw new Error("TRANSACTION_NOT_FOUND");
  const requests = await db.select().from(cancellationRequests)
    .where(eq(cancellationRequests.transactionId, transactionId))
    .orderBy(desc(cancellationRequests.createdAt));
  const requestIds = requests.map((request) => request.id);
  const evidence = requestIds.length
    ? await db.select({
      id: cancellationEvidence.id,
      cancellationRequestId: cancellationEvidence.cancellationRequestId,
      evidenceKey: cancellationEvidence.evidenceKey,
      sourceAuthorRole: cancellationEvidence.sourceAuthorRole,
      evidenceReference: cancellationEvidence.evidenceReference,
      messageReference: cancellationEvidence.messageReference,
      deliveryResult: cancellationEvidence.deliveryResult,
      responseValue: cancellationEvidence.responseValue,
      correctedEvidenceId: cancellationEvidence.correctedEvidenceId,
      recordedAt: cancellationEvidence.recordedAt
    }).from(cancellationEvidence)
      .where(inArray(cancellationEvidence.cancellationRequestId, requestIds))
      .orderBy(desc(cancellationEvidence.recordedAt))
    : [];
  return { transaction, requests, evidence };
}
