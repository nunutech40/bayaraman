import { and, desc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/server/db";
import {
  paymentInvoices,
  paymentProviderEvents,
  paymentReconciliationEvents,
  paymentReconciliations,
  transactions
} from "@/server/db/schema";
import { recordTransactionEvent } from "@/server/transaction/audit";
import { processProviderEvent } from "@/server/payment/process-provider-event";
import {
  deterministicProviderEventId,
  payloadHash,
  verifyMidtransSignature
} from "@/server/providers/midtrans/signature";
import { isAuthoritativePayment } from "@/server/providers/payment-status";
import { completeOpenPaymentReconciliations } from "./reconciliation-repository";

export const midtransWebhookSchema = z.object({
  order_id: z.string().trim().min(1).max(200),
  transaction_id: z.string().trim().min(1).max(200).optional(),
  event_id: z.string().trim().min(1).max(200).optional(),
  status_code: z.union([z.string(), z.number()]).transform(String),
  gross_amount: z.string().trim().min(1).max(40),
  currency: z.string().trim().length(3).default("IDR"),
  signature_key: z.string().trim().min(1),
  transaction_status: z.string().trim().min(1),
  fraud_status: z.string().trim().nullable().optional(),
  transaction_time: z.string().datetime().nullable().optional(),
  settlement_time: z.string().datetime().nullable().optional(),
  event_time: z.string().datetime().nullable().optional()
});

export type MidtransWebhookInput = z.infer<typeof midtransWebhookSchema>;

const NON_PAID_STATUSES = new Set(["capture", "pending", "deny", "cancel", "failure", "expire"]);

function parseAmount(value: string): number | null {
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}

function eventTime(input: MidtransWebhookInput): Date | null {
  const value = input.event_time ?? input.settlement_time ?? input.transaction_time;
  return value ? new Date(value) : null;
}

function statusOutcome(status: string): "NON_AUTHORITATIVE" | "UNKNOWN" {
  return NON_PAID_STATUSES.has(status.toLowerCase()) ? "NON_AUTHORITATIVE" : "UNKNOWN";
}

function validationOutcome(input: MidtransWebhookInput, signatureValid: boolean, invoice: typeof paymentInvoices.$inferSelect | undefined) {
  if (!signatureValid) return "INVALID_SIGNATURE" as const;
  if (!invoice) return "UNKNOWN_ORDER" as const;
  const amount = parseAmount(input.gross_amount);
  if (invoice.providerOrderId !== input.order_id) return "IDENTITY_MISMATCH" as const;
  if (amount === null || invoice.amount !== amount) return "AMOUNT_MISMATCH" as const;
  if (invoice.currency !== input.currency) return "CURRENCY_MISMATCH" as const;
  if (input.transaction_status.toLowerCase() === "settlement" && input.fraud_status !== "accept") {
    return "FRAUD_MISMATCH" as const;
  }
  return isAuthoritativePayment({
    transactionStatus: input.transaction_status.toLowerCase() as "settlement",
    fraudStatus: input.fraud_status ?? null
  }) ? "ACCEPTED" as const : statusOutcome(input.transaction_status);
}

export async function ingestMidtransWebhook(input: unknown) {
  const parsed = midtransWebhookSchema.parse(input);
  const normalized = {
    orderId: parsed.order_id,
    transactionStatus: parsed.transaction_status.toLowerCase(),
    statusCode: parsed.status_code,
    grossAmount: parsed.gross_amount,
    currency: parsed.currency,
    fraudStatus: parsed.fraud_status ?? "",
    eventTime: parsed.event_time ?? parsed.settlement_time ?? parsed.transaction_time ?? null,
    settlementTime: parsed.settlement_time ?? null
  };
  const providerEventId = parsed.event_id ?? parsed.transaction_id ?? deterministicProviderEventId(normalized);
  const hash = payloadHash(parsed);
  const correlationId = randomUUID();
  const signatureValid = verifyMidtransSignature({
    orderId: parsed.order_id,
    statusCode: parsed.status_code,
    grossAmount: parsed.gross_amount,
    signatureKey: parsed.signature_key
  });

  return db.transaction(async (tx) => {
    const [existingEvent] = await tx.select().from(paymentProviderEvents).where(and(
      eq(paymentProviderEvents.provider, "MIDTRANS"),
      eq(paymentProviderEvents.providerEventId, providerEventId)
    )).limit(1);

    if (existingEvent) {
      if (existingEvent.payloadHash === hash) {
        return { kind: "duplicate" as const, eventId: existingEvent.id, authoritative: existingEvent.validationOutcome === "ACCEPTED" };
      }
      const reconciliation = existingEvent.invoiceId
        ? await ensureReconciliation(tx, existingEvent.invoiceId, "CONTROLLED_EXCEPTION_HANDOFF", correlationId)
        : null;
      const [conflict] = reconciliation ? await tx.insert(paymentReconciliationEvents).values({
        reconciliationId: reconciliation.id,
        providerEventId: existingEvent.id,
        relationType: "CONFLICT_EVENT",
        incomingPayloadHash: hash,
        sanitizedReason: "SAME_EVENT_ID_DIFFERENT_PAYLOAD",
        correlationId,
        idempotencyKey: `webhook-conflict:${providerEventId}:${hash}`
      }).onConflictDoNothing().returning({ id: paymentReconciliationEvents.id }) : [];
      await recordTransactionEvent(tx, {
        transactionId: await transactionIdForInvoice(tx, existingEvent.invoiceId),
        eventType: "MIDTRANS_WEBHOOK_CONFLICT",
        correlationId,
        payload: { provider: "MIDTRANS", providerEventId, payloadHash: hash, conflictId: conflict?.id ?? null }
      });
      return { kind: "conflict" as const, eventId: existingEvent.id, reconciliationId: reconciliation?.id ?? null };
    }

    const [invoice] = await tx.select().from(paymentInvoices).where(and(
      eq(paymentInvoices.provider, "MIDTRANS"),
      eq(paymentInvoices.providerOrderId, parsed.order_id)
    )).limit(1);
    const outcome = validationOutcome(parsed, signatureValid, invoice);
    const amount = parseAmount(parsed.gross_amount);
    const [event] = await tx.insert(paymentProviderEvents).values({
      invoiceId: invoice?.id,
      provider: "MIDTRANS",
      providerEventId,
      payloadHash: hash,
      eventOccurredAt: eventTime(parsed),
      providerOrderId: parsed.order_id,
      amount,
      currency: parsed.currency,
      providerStatus: parsed.transaction_status.toLowerCase(),
      fraudStatus: parsed.fraud_status ?? null,
      signatureValid,
      validationOutcome: outcome
    }).returning();
    if (!event) throw new Error("MIDTRANS_EVENT_PERSIST_FAILED");

    const transaction = invoice ? (await tx.select().from(transactions).where(eq(transactions.id, invoice.transactionId)).limit(1))[0] : undefined;
    if (invoice && transaction) {
      const cancellationResult = await processProviderEvent(tx, {
        transactionId: transaction.id,
        invoiceId: invoice.id,
        providerEventId: event.id,
        source: "WEBHOOK",
        correlationId,
        idempotencyKey: `webhook-cancellation:${event.id}`
      });
      if (cancellationResult) {
        return {
          kind: "recorded" as const,
          eventId: event.id,
          transactionId: transaction.id,
          authoritative: false,
          cancellationResult
        };
      }
    }
    const authoritative = outcome === "ACCEPTED" && invoice && transaction
      && transaction.state === "WAITING_BUYER_PAYMENT"
      && invoice.isActive
      && invoice.deadlineAt.getTime() > Date.now();

    if (authoritative) {
      const nextVersion = transaction.stateVersion + 1;
      const [updated] = await tx.update(transactions).set({
        state: "PAYMENT_CONFIRMED",
        stateVersion: nextVersion,
        updatedAt: new Date()
      }).where(and(
        eq(transactions.id, transaction.id),
        eq(transactions.state, "WAITING_BUYER_PAYMENT"),
        eq(transactions.stateVersion, transaction.stateVersion)
      )).returning({ id: transactions.id });
      if (!updated) throw new Error("STATE_VERSION_CONFLICT");
      await tx.update(paymentInvoices).set({ authoritativeProviderEventId: event.id }).where(eq(paymentInvoices.id, invoice.id));
      await completeOpenPaymentReconciliations(tx, invoice.id, event.id);
      await recordTransactionEvent(tx, {
        transactionId: transaction.id,
        eventType: "PAYMENT_CONFIRMED_MIDTRANS",
        beforeState: "WAITING_BUYER_PAYMENT",
        afterState: "PAYMENT_CONFIRMED",
        stateVersion: nextVersion,
        correlationId,
        evidenceReference: event.id,
        payload: { provider: "MIDTRANS", providerEventId, eventId: event.id }
      });
      return { kind: "accepted" as const, eventId: event.id, transactionId: transaction.id, authoritative: true };
    }

    if (invoice && signatureValid &&
        ["deny", "cancel", "failure", "expire"].includes(parsed.transaction_status.toLowerCase()) &&
        outcome === "NON_AUTHORITATIVE") {
      await completeOpenPaymentReconciliations(tx, invoice.id, event.id);
    }

    if (invoice && transaction && (
      outcome === "UNKNOWN"
      || (outcome === "ACCEPTED" && (
        transaction.state !== "WAITING_BUYER_PAYMENT"
        || !invoice.isActive
        || invoice.deadlineAt.getTime() <= Date.now()
      ))
    )) {
      const relationType = invoice.deadlineAt.getTime() <= Date.now() || !invoice.isActive ? "LATE_EVENT" : "UNKNOWN_EVENT";
      const reconciliation = await ensureReconciliation(tx, invoice.id, relationType === "LATE_EVENT" ? "LATE_FUND_HANDOFF" : "PROVIDER_STATUS_REVIEW", correlationId);
      await tx.insert(paymentReconciliationEvents).values({
        reconciliationId: reconciliation.id,
        providerEventId: event.id,
        relationType,
        incomingPayloadHash: hash,
        sanitizedReason: outcome === "UNKNOWN" ? "PROVIDER_STATUS_UNKNOWN" : "AUTHORITY_NOT_ELIGIBLE",
        correlationId,
        idempotencyKey: `webhook-event:${event.id}`
      }).onConflictDoNothing();
    }

    if (transaction) {
      await recordTransactionEvent(tx, {
        transactionId: transaction.id,
        eventType: `MIDTRANS_${outcome}`,
        correlationId,
        evidenceReference: event.id,
        payload: { provider: "MIDTRANS", providerEventId, validationOutcome: outcome }
      });
    }
    return { kind: outcome === "UNKNOWN" ? "unknown" as const : "recorded" as const, eventId: event.id, authoritative: false };
  });
}

async function transactionIdForInvoice(tx: any, invoiceId: string | null): Promise<string | undefined> {
  if (!invoiceId) return undefined;
  const [invoice] = await tx.select({ transactionId: paymentInvoices.transactionId }).from(paymentInvoices).where(eq(paymentInvoices.id, invoiceId)).limit(1);
  return invoice?.transactionId;
}

async function ensureReconciliation(tx: any, invoiceId: string | null, decisionCode: "PROVIDER_STATUS_REVIEW" | "LATE_FUND_HANDOFF" | "CONTROLLED_EXCEPTION_HANDOFF", correlationId: string) {
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
    result: "UNKNOWN",
    completedAt: null
  }).returning();
  if (!created) throw new Error("RECONCILIATION_CREATE_FAILED");
  await recordTransactionEvent(tx, {
    transactionId: invoice.transactionId,
    eventType: "PAYMENT_RECONCILIATION_OPENED",
    correlationId,
    payload: { reconciliationId: created.id, decisionCode }
  });
  return created;
}
