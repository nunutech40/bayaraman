import { and, desc, eq, sql } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import { db } from "@/server/db";
import {
  paymentInvoices,
  paymentProviderEvents,
  paymentReconciliationEvents,
  paymentReconciliations,
  transactions
} from "@/server/db/schema";
import { findIdempotentResult, saveIdempotentResult } from "@/server/transaction/mutation";
import { recordTransactionEvent } from "@/server/transaction/audit";
import { isAuthoritativePayment, type PaymentStatusAdapter } from "@/server/providers/payment-status";
import { MidtransPaymentStatusAdapter } from "@/server/providers/midtrans/status";

const COMMAND = "MIDTRANS_PAYMENT_RECONCILIATION";

export async function reconcileMidtransStatus(
  adminId: string,
  transactionId: string,
  expectedStateVersion: number | undefined,
  idempotency: { key: string; requestHash: string },
  adapter: PaymentStatusAdapter = new MidtransPaymentStatusAdapter()
) {
  return db.transaction(async (tx) => {
    const prior = await findIdempotentResult(tx, adminId, COMMAND, idempotency.key, idempotency.requestHash);
    if (prior) return prior;

    await tx.execute(sql`SELECT id FROM transactions WHERE id = ${transactionId} FOR UPDATE`);
    const [transaction] = await tx.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
    if (!transaction) throw new Error("TRANSACTION_NOT_FOUND");
    if (expectedStateVersion !== undefined && transaction.stateVersion !== expectedStateVersion) {
      throw new Error("STATE_VERSION_CONFLICT");
    }
    const [invoice] = await tx.select().from(paymentInvoices).where(and(
      eq(paymentInvoices.transactionId, transactionId),
      eq(paymentInvoices.isActive, true)
    )).orderBy(desc(paymentInvoices.createdAt)).limit(1);
    if (!invoice) throw new Error("PAYMENT_INVOICE_NOT_READY");

    const status = await adapter.getStatus(invoice.providerOrderId);
    const statusPayload = JSON.stringify(status);
    const eventId = status.providerEventId ?? `STATUS:${createHash("sha256").update(statusPayload).digest("hex")}`;
    const hash = createHash("sha256").update(statusPayload).digest("hex");
    const amountMatches = status.amount === invoice.amount;
    const currencyMatches = status.currency === invoice.currency;
    const identityMatches = status.providerOrderId === invoice.providerOrderId;
    const authoritative = isAuthoritativePayment(status) && identityMatches && amountMatches && currencyMatches;
    const outcome = status.outcome === "UNKNOWN"
      ? "UNKNOWN"
      : authoritative
        ? "ACCEPTED"
        : status.transactionStatus === "unknown"
          ? "UNKNOWN"
            : !identityMatches
              ? "IDENTITY_MISMATCH"
              : !amountMatches
            ? "AMOUNT_MISMATCH"
            : !currencyMatches
              ? "CURRENCY_MISMATCH"
              : "NON_AUTHORITATIVE";

    const [existingEvent] = await tx.select().from(paymentProviderEvents).where(and(
      eq(paymentProviderEvents.provider, "MIDTRANS"),
      eq(paymentProviderEvents.providerEventId, eventId)
    )).limit(1);
    const event = existingEvent ?? (await tx.insert(paymentProviderEvents).values({
      invoiceId: invoice.id,
      provider: "MIDTRANS",
      providerEventId: eventId,
      payloadHash: hash,
      eventOccurredAt: status.eventOccurredAt,
      providerOrderId: invoice.providerOrderId,
      amount: status.amount,
      currency: status.currency,
      providerStatus: status.transactionStatus,
      fraudStatus: status.fraudStatus,
      signatureValid: null,
      validationOutcome: outcome
    }).returning())[0];
    if (!event) throw new Error("MIDTRANS_EVENT_PERSIST_FAILED");

    let result: Record<string, unknown> = {
      transactionId,
      eventId: event.id,
      providerStatus: status.transactionStatus,
      validationOutcome: outcome,
      authoritative: false
    };

    if (authoritative && transaction.state === "WAITING_BUYER_PAYMENT" && invoice.deadlineAt.getTime() > Date.now()) {
      const nextVersion = transaction.stateVersion + 1;
      const [updated] = await tx.update(transactions).set({
        state: "PAYMENT_CONFIRMED",
        stateVersion: nextVersion,
        updatedAt: new Date()
      }).where(and(
        eq(transactions.id, transactionId),
        eq(transactions.state, "WAITING_BUYER_PAYMENT"),
        eq(transactions.stateVersion, transaction.stateVersion)
      )).returning({ id: transactions.id });
      if (!updated) throw new Error("STATE_VERSION_CONFLICT");
      await tx.update(paymentInvoices).set({ authoritativeProviderEventId: event.id }).where(eq(paymentInvoices.id, invoice.id));
      await recordTransactionEvent(tx, {
        transactionId,
        eventType: "PAYMENT_CONFIRMED_MIDTRANS_STATUS",
        beforeState: "WAITING_BUYER_PAYMENT",
        afterState: "PAYMENT_CONFIRMED",
        stateVersion: nextVersion,
        correlationId: randomUUID(),
        evidenceReference: event.id,
        payload: { provider: "MIDTRANS", providerStatus: status.transactionStatus }
      });
      result = { ...result, authoritative: true, state: "PAYMENT_CONFIRMED" };
    } else {
      const decisionCode = outcome === "UNKNOWN" || !amountMatches || !currencyMatches
        ? "PROVIDER_STATUS_REVIEW" as const
        : "LATE_FUND_HANDOFF" as const;
      const reconciliation = await ensureReconciliation(tx, invoice.id, decisionCode, randomUUID());
      await tx.insert(paymentReconciliationEvents).values({
        reconciliationId: reconciliation.id,
        providerEventId: event.id,
        relationType: invoice.deadlineAt.getTime() <= Date.now() ? "LATE_EVENT" : "UNKNOWN_EVENT",
        incomingPayloadHash: hash,
        sanitizedReason: outcome,
        correlationId: randomUUID(),
        idempotencyKey: `${COMMAND}:${idempotency.key}`
      }).onConflictDoNothing();
      await recordTransactionEvent(tx, {
        transactionId,
        eventType: "MIDTRANS_STATUS_RECONCILIATED",
        correlationId: randomUUID(),
        evidenceReference: event.id,
        payload: { provider: "MIDTRANS", validationOutcome: outcome, reconciliationId: reconciliation.id }
      });
      result = { ...result, reconciliationId: reconciliation.id };
    }

    await saveIdempotentResult(tx, adminId, COMMAND, idempotency.key, idempotency.requestHash, result);
    return result;
  });
}

export async function readPaymentReconciliation(transactionId: string) {
  const [transaction] = await db.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
  if (!transaction) throw new Error("TRANSACTION_NOT_FOUND");
  const events = await db.select({
    id: paymentProviderEvents.id,
    providerEventId: paymentProviderEvents.providerEventId,
    providerStatus: paymentProviderEvents.providerStatus,
    fraudStatus: paymentProviderEvents.fraudStatus,
    validationOutcome: paymentProviderEvents.validationOutcome,
    eventOccurredAt: paymentProviderEvents.eventOccurredAt,
    receivedAt: paymentProviderEvents.receivedAt
  }).from(paymentProviderEvents).innerJoin(paymentInvoices, eq(paymentProviderEvents.invoiceId, paymentInvoices.id)).where(eq(paymentInvoices.transactionId, transactionId));
  const reconciliations = await db.select({
    id: paymentReconciliations.id,
    decisionCode: paymentReconciliations.decisionCode,
    result: paymentReconciliations.result,
    deadlineAt: paymentReconciliations.deadlineAt,
    completedAt: paymentReconciliations.completedAt,
    providerStatusReference: paymentReconciliations.providerStatusReference
  }).from(paymentReconciliations).where(eq(paymentReconciliations.transactionId, transactionId));
  return { transactionId, state: transaction.state, stateVersion: transaction.stateVersion, events, reconciliations };
}

export async function ensureReconciliation(
  tx: any,
  invoiceId: string | null,
  decisionCode: "PROVIDER_STATUS_REVIEW" | "LATE_FUND_HANDOFF" | "CONTROLLED_EXCEPTION_HANDOFF",
  _correlationId: string
) {
  if (!invoiceId) throw new Error("RECONCILIATION_INVOICE_REQUIRED");
  const [invoice] = await tx.select().from(paymentInvoices).where(eq(paymentInvoices.id, invoiceId)).limit(1);
  if (!invoice) throw new Error("RECONCILIATION_INVOICE_NOT_FOUND");
  const [existing] = await tx.select().from(paymentReconciliations).where(and(
    eq(paymentReconciliations.invoiceId, invoiceId),
    sql`completed_at IS NULL`
  )).orderBy(desc(paymentReconciliations.createdAt)).limit(1);
  if (existing) return existing;
  const [created] = await tx.insert(paymentReconciliations).values({
    transactionId: invoice.transactionId,
    invoiceId,
    decision: decisionCode,
    decisionCode,
    providerStatusReference: invoice.providerOrderId,
    deadlineAt: invoice.deadlineAt,
    result: "UNKNOWN"
  }).returning();
  if (!created) throw new Error("RECONCILIATION_CREATE_FAILED");
  return created;
}
