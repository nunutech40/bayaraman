import { createHash } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  cancellationEvents,
  cancellationFinancialHandoffs,
  cancellationProviderResolutions,
  cancellationReconciliations,
  cancellationRequests,
  paymentInvoices,
  paymentProviderEvents,
  paymentReconciliations,
  transactionParticipants,
  transactions
} from "@/server/db/schema";
import { recordTransactionEvent } from "@/server/transaction/audit";

export type CancellationProviderClassification =
  | "AUTHORITATIVE"
  | "DEFINITIVE_NON_PAID"
  | "WAITING"
  | "MISMATCH"
  | "UNKNOWN";

export type CancellationResolutionSource =
  | "WEBHOOK"
  | "GET_STATUS"
  | "ADMIN_RECOVERY";

export type ResolveCancellationProviderStatusInput = {
  transactionId: string;
  invoiceId: string;
  cancellationRequestId: string | null;
  paymentReconciliationId: string;
  providerEventId: string;
  expectedStateVersion: number;
  source: CancellationResolutionSource;
  correlationId: string;
  idempotencyKey: string;
};

const DEFINITIVE_NON_PAID = new Set(["deny", "cancel", "failure", "expire"]);
const WAITING = new Set(["pending", "capture"]);

export function classifyCancellationProviderEvent(
  event: Pick<typeof paymentProviderEvents.$inferSelect,
    "provider" | "providerOrderId" | "amount" | "currency" |
    "providerStatus" | "fraudStatus" | "signatureValid" | "validationOutcome">,
  invoice: Pick<typeof paymentInvoices.$inferSelect,
    "provider" | "providerOrderId" | "amount" | "currency">
): CancellationProviderClassification {
  if (
    event.validationOutcome === "INVALID_SIGNATURE" ||
    event.validationOutcome === "UNKNOWN_ORDER" ||
    event.validationOutcome === "UNKNOWN" ||
    !event.providerStatus
  ) return "UNKNOWN";
  if (
    event.validationOutcome === "IDENTITY_MISMATCH" ||
    event.provider !== invoice.provider ||
    event.providerOrderId !== invoice.providerOrderId
  ) return "MISMATCH";
  if (
    event.validationOutcome === "AMOUNT_MISMATCH" ||
    event.validationOutcome === "CURRENCY_MISMATCH" ||
    event.amount !== invoice.amount ||
    event.currency !== invoice.currency
  ) return "MISMATCH";
  if (
    event.providerStatus === "settlement" &&
    event.fraudStatus === "accept" &&
    event.validationOutcome === "ACCEPTED"
  ) return "AUTHORITATIVE";
  if (DEFINITIVE_NON_PAID.has(event.providerStatus)) return "DEFINITIVE_NON_PAID";
  if (WAITING.has(event.providerStatus)) return "WAITING";
  return "UNKNOWN";
}

function sourceHash(value: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function resolveCancellationProviderStatus(
  tx: any,
  input: ResolveCancellationProviderStatusInput
) {
  await tx.execute(sql`SELECT id FROM transactions WHERE id = ${input.transactionId} FOR UPDATE`);
  const [transaction] = await tx.select().from(transactions)
    .where(eq(transactions.id, input.transactionId)).limit(1);
  const [invoice] = await tx.select().from(paymentInvoices)
    .where(eq(paymentInvoices.id, input.invoiceId)).limit(1);
  const [event] = await tx.select().from(paymentProviderEvents)
    .where(eq(paymentProviderEvents.id, input.providerEventId)).limit(1);
  const [paymentReconciliation] = await tx.select().from(paymentReconciliations)
    .where(eq(paymentReconciliations.id, input.paymentReconciliationId)).limit(1);
  if (!transaction || !invoice || !event || !paymentReconciliation) {
    throw new Error("CANCELLATION_PROVIDER_REFERENCE_INVALID");
  }
  if (
    invoice.transactionId !== transaction.id ||
    event.invoiceId !== invoice.id ||
    paymentReconciliation.transactionId !== transaction.id ||
    paymentReconciliation.invoiceId !== invoice.id
  ) throw new Error("CANCELLATION_PROVIDER_REFERENCE_MISMATCH");
  if (transaction.stateVersion !== input.expectedStateVersion) {
    throw new Error("STATE_VERSION_CONFLICT");
  }

  const [existing] = await tx.select().from(cancellationProviderResolutions)
    .where(eq(cancellationProviderResolutions.providerEventId, event.id)).limit(1);
  if (existing) {
    return {
      classification: existing.classification,
      state: existing.outcomeState,
      stateVersion: transaction.stateVersion,
      idempotentReplay: true
    };
  }

  const request = input.cancellationRequestId
    ? (await tx.select().from(cancellationRequests).where(and(
      eq(cancellationRequests.id, input.cancellationRequestId),
      eq(cancellationRequests.transactionId, transaction.id),
      eq(cancellationRequests.status, "ACTIVE")
    )).limit(1))[0]
    : (await tx.select().from(cancellationRequests)
      .where(eq(cancellationRequests.transactionId, transaction.id))
      .orderBy(desc(cancellationRequests.createdAt)).limit(1))[0];
  if (input.cancellationRequestId && !request) throw new Error("CANCELLATION_NOT_FOUND");
  if (!request && transaction.state !== "PAYMENT_EXPIRED") {
    throw new Error("CANCELLATION_REQUEST_REQUIRED");
  }
  const classification = classifyCancellationProviderEvent(event, invoice);
  let nextState = transaction.state;
  let nextVersion = transaction.stateVersion;
  let handoffId: string | undefined;

  if (request?.status === "ACTIVE") {
    if (classification === "AUTHORITATIVE") {
      nextState = "FUNDED_CANCELLATION_REVIEW";
      nextVersion += 1;
      await tx.update(cancellationRequests).set({
        decision: "FUNDED_REVIEW",
        stateVersion: request.stateVersion + 1
      }).where(and(
        eq(cancellationRequests.id, request.id),
        eq(cancellationRequests.stateVersion, request.stateVersion)
      ));
    } else if (classification === "DEFINITIVE_NON_PAID") {
      nextState = "CANCELLED";
      nextVersion += 1;
      await tx.update(cancellationRequests).set({
        status: "CLOSED",
        lifecycle: "RESOLVED",
        decision: "DEFINITIVE_NON_PAID",
        resolvedAt: new Date(),
        stateVersion: request.stateVersion + 1
      }).where(and(
        eq(cancellationRequests.id, request.id),
        eq(cancellationRequests.stateVersion, request.stateVersion)
      ));
    }
  } else if (
    classification === "AUTHORITATIVE" &&
    ["PAYMENT_EXPIRED", "CANCELLED"].includes(transaction.state)
  ) {
    const [buyer] = await tx.select().from(transactionParticipants).where(and(
      eq(transactionParticipants.transactionId, transaction.id),
      eq(transactionParticipants.role, "BUYER")
    )).limit(1);
    if (!buyer) throw new Error("BUYER_PARTICIPANT_REQUIRED");
    if (invoice.authoritativeProviderEventId) {
      throw new Error("LATE_FUND_AUTHORITY_POINTER_FORBIDDEN");
    }
    const finalizedAt = event.eventOccurredAt ?? event.receivedAt;
    nextState = "REFUND_READY";
    nextVersion += 1;
    const canonicalHash = sourceHash({
      providerEventId: event.id,
      invoiceId: invoice.id,
      providerOrderId: invoice.providerOrderId,
      amount: invoice.amount,
      currency: invoice.currency,
      reconciliationId: paymentReconciliation.id
    });
    const [handoff] = await tx.insert(cancellationFinancialHandoffs).values({
      transactionId: transaction.id,
      cancellationRequestId: request?.id ?? null,
      paymentReconciliationId: paymentReconciliation.id,
      providerEventId: event.id,
      sourceType: "LATE_FUND",
      buyerAmount: invoice.amount,
      buyerAccountId: buyer.accountId,
      calculationId: null,
      sourceHash: canonicalHash,
      evidenceReference: event.id,
      evidenceHash: event.payloadHash,
      providerOrderId: invoice.providerOrderId,
      sourceState: "REFUND_READY",
      sourceStateVersion: nextVersion,
      sourceFinalizedAt: finalizedAt
    }).returning();
    if (!handoff) throw new Error("LATE_FUND_HANDOFF_CREATE_FAILED");
    handoffId = handoff.id;
    await tx.update(paymentReconciliations).set({
      decision: "LATE_FUND_HANDOFF",
      decisionCode: "LATE_FUND_HANDOFF",
      result: "SUCCESS",
      evidenceReference: event.id,
      completedAt: new Date()
    }).where(eq(paymentReconciliations.id, paymentReconciliation.id));
  }

  if (nextState !== transaction.state) {
    const [updated] = await tx.update(transactions).set({
      state: nextState,
      stateVersion: nextVersion,
      updatedAt: new Date()
    }).where(and(
      eq(transactions.id, transaction.id),
      eq(transactions.state, transaction.state),
      eq(transactions.stateVersion, transaction.stateVersion)
    )).returning({ id: transactions.id });
    if (!updated) throw new Error("STATE_VERSION_CONFLICT");
  }
  const [resolution] = await tx.insert(cancellationProviderResolutions).values({
    transactionId: transaction.id,
    cancellationRequestId: request?.id ?? null,
    paymentReconciliationId: paymentReconciliation.id,
    providerEventId: event.id,
    source: input.source,
    classification,
    outcomeState: nextState,
    correlationId: input.correlationId,
    idempotencyKey: input.idempotencyKey
  }).returning();
  if (!resolution) throw new Error("CANCELLATION_RESOLUTION_CREATE_FAILED");
  if (request) {
    await tx.update(cancellationReconciliations).set({
      status: ["AUTHORITATIVE", "DEFINITIVE_NON_PAID"].includes(classification)
        ? "RESOLVED"
        : "OPEN",
      classification,
      providerEventId: event.id,
      evidenceReference: resolution.id,
      completedAt: ["AUTHORITATIVE", "DEFINITIVE_NON_PAID"].includes(classification)
        ? new Date()
        : null
    }).where(and(
      eq(cancellationReconciliations.cancellationRequestId, request.id),
      eq(cancellationReconciliations.status, "OPEN")
    ));
    await tx.insert(cancellationEvents).values({
      cancellationRequestId: request.id,
      eventType: "PROVIDER_RESULT_RECORDED",
      summary: `Provider classification ${classification}`,
      evidenceReference: resolution.id,
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey
    });
  }
  await recordTransactionEvent(tx, {
    transactionId: transaction.id,
    eventType: handoffId ? "LATE_FUND_REFUND_READY" : "CANCELLATION_PROVIDER_RESOLVED",
    beforeState: transaction.state,
    afterState: nextState,
    stateVersion: nextVersion,
    correlationId: input.correlationId,
    evidenceReference: handoffId ?? resolution.id,
    payload: { classification, source: input.source }
  });
  return {
    classification,
    state: nextState,
    stateVersion: nextVersion,
    handoffId,
    idempotentReplay: false
  };
}

export async function applyCompletedPaymentReconciliationToCancellation(
  tx: any,
  input: Omit<ResolveCancellationProviderStatusInput, "source" | "invoiceId">
) {
  const [reconciliation] = await tx.select().from(paymentReconciliations)
    .where(eq(paymentReconciliations.id, input.paymentReconciliationId)).limit(1);
  if (!reconciliation?.invoiceId) throw new Error("PAYMENT_RECONCILIATION_NOT_FOUND");
  return resolveCancellationProviderStatus(tx, {
    ...input,
    invoiceId: reconciliation.invoiceId,
    source: "GET_STATUS"
  });
}
