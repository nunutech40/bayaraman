import { and, desc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import {
  paymentInvoices,
  transactionParticipants,
  transactionTerms,
  transactions
} from "@/server/db/schema";
import { canParticipate } from "@/server/auth/authorization";
import { assertExpectedStateVersion } from "@/server/domain/transaction/state";
import { findIdempotentResult, saveIdempotentResult } from "@/server/transaction/mutation";
import { recordTransactionEvent } from "@/server/transaction/audit";
import { formatWib } from "./projection";
import {
  MidtransPaymentInvoiceAdapter
} from "@/server/providers/midtrans/invoice";
import type {
  PaymentInvoiceAdapter,
  PaymentInvoiceResult
} from "@/server/providers/payment-invoice";

const INVOICE_TTL_MS = 24 * 60 * 60 * 1000;
const INVOICE_COMMAND = "PAYMENT_INVOICE_CREATE";

type InvoiceActor = {
  id: string;
  whatsappVerifiedAt: Date | null;
  isAdmin: boolean;
};

type InvoiceProjection = {
  transactionId: string;
  invoiceId: string;
  provider: string;
  providerInvoiceId: string | null;
  providerOrderId: string;
  hostedPaymentUrl: string | null;
  providerStatus: string | null;
  amount: number;
  currency: string;
  issuedAt: Date;
  deadlineAt: Date;
  deadlineWib: string;
  dueDateAt: Date | null;
  state: "WAITING_BUYER_PAYMENT";
  stateVersion: number;
};

function toProjection(
  transactionId: string,
  stateVersion: number,
  invoice: typeof paymentInvoices.$inferSelect
): InvoiceProjection {
  if (!invoice.issuedAt) throw new Error("PAYMENT_INVOICE_NOT_ISSUED");
  return {
    transactionId,
    invoiceId: invoice.id,
    provider: invoice.provider,
    providerInvoiceId: invoice.providerInvoiceId,
    providerOrderId: invoice.providerOrderId,
    hostedPaymentUrl: invoice.hostedPaymentUrl,
    providerStatus: invoice.providerStatus,
    amount: invoice.amount,
    currency: invoice.currency,
    issuedAt: invoice.issuedAt,
    deadlineAt: invoice.deadlineAt,
    deadlineWib: formatWib(invoice.deadlineAt),
    dueDateAt: invoice.dueDateAt,
    state: "WAITING_BUYER_PAYMENT",
    stateVersion
  };
}

function providerOrderId(transactionId: string): string {
  return `bayaraman-${transactionId}`;
}

function idempotencyReference(actorId: string, key: string): string {
  return `${INVOICE_COMMAND}:ACCOUNT:${actorId}:${key}`;
}

export async function ensurePaymentLink(
  actor: InvoiceActor,
  transactionId: string,
  expectedStateVersion: number | undefined,
  idempotency: { key: string; requestHash: string },
  adapter: PaymentInvoiceAdapter = new MidtransPaymentInvoiceAdapter()
) {
  if (!canParticipate(actor) || actor.isAdmin) throw new Error("PARTICIPATION_NOT_ALLOWED");

  return db.transaction(async (tx) => {
    const prior = await findIdempotentResult(tx, actor.id, INVOICE_COMMAND, idempotency.key, idempotency.requestHash);
    if (prior) return prior as InvoiceProjection;

    await tx.execute(sql`SELECT id FROM transactions WHERE id = ${transactionId} FOR UPDATE`);
    const [transaction] = await tx.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
    const [participant] = await tx.select().from(transactionParticipants).where(and(
      eq(transactionParticipants.transactionId, transactionId),
      eq(transactionParticipants.accountId, actor.id)
    )).limit(1);
    if (!transaction || !participant || participant.role === "ADMIN") throw new Error("TRANSACTION_FORBIDDEN");
    if (transaction.state !== "WAITING_COUNTERPARTY_DATA") throw new Error("PAYMENT_LINK_NOT_READY");
    if (expectedStateVersion !== undefined) assertExpectedStateVersion(transaction.stateVersion, expectedStateVersion);

    const [terms] = await tx.select().from(transactionTerms).where(eq(transactionTerms.transactionId, transactionId)).limit(1);
    const [otherParticipant] = await tx.select().from(transactionParticipants).where(and(
      eq(transactionParticipants.transactionId, transactionId),
      sql`${transactionParticipants.accountId} <> ${actor.id}`
    )).limit(1);
    if (!terms || !terms.frozenAt || !otherParticipant) throw new Error("PAYMENT_LINK_NOT_READY");

    const [existing] = await tx.select().from(paymentInvoices).where(and(
      eq(paymentInvoices.transactionId, transactionId),
      eq(paymentInvoices.isActive, true)
    )).orderBy(desc(paymentInvoices.createdAt)).limit(1);
    if (existing?.issuedAt) {
      const result = toProjection(transactionId, transaction.stateVersion, existing);
      await saveIdempotentResult(tx, actor.id, INVOICE_COMMAND, idempotency.key, idempotency.requestHash, result);
      return result;
    }

    const issuedAt = new Date();
    const deadlineAt = new Date(issuedAt.getTime() + INVOICE_TTL_MS);
    const orderId = providerOrderId(transactionId);
    const providerResult: PaymentInvoiceResult = await adapter.createPaymentLink({
      orderId,
      amount: terms.totalAmount,
      currency: "IDR",
      expiresAt: deadlineAt
    });
    const invoiceReference = idempotencyReference(actor.id, idempotency.key);
    const [invoice] = await tx.insert(paymentInvoices).values({
      transactionId,
      provider: providerResult.provider,
      providerInvoiceId: providerResult.providerInvoiceId,
      providerOrderId: providerResult.providerOrderId,
      hostedPaymentUrl: providerResult.hostedPaymentUrl,
      amount: terms.totalAmount,
      currency: "IDR",
      providerStatus: providerResult.providerStatus,
      idempotencyReference: invoiceReference,
      issuedAt,
      deadlineAt,
      dueDateAt: providerResult.dueDateAt,
      isActive: true
    }).returning();
    if (!invoice) throw new Error("PAYMENT_INVOICE_CREATE_FAILED");

    const nextStateVersion = transaction.stateVersion + 1;
    const [updated] = await tx.update(transactions).set({
      state: "WAITING_BUYER_PAYMENT",
      stateVersion: nextStateVersion,
      updatedAt: issuedAt
    }).where(and(
      eq(transactions.id, transactionId),
      eq(transactions.state, "WAITING_COUNTERPARTY_DATA"),
      eq(transactions.stateVersion, transaction.stateVersion)
    )).returning({ id: transactions.id });
    if (!updated) throw new Error("STATE_VERSION_CONFLICT");

    await recordTransactionEvent(tx, {
      transactionId,
      actorAccountId: actor.id,
      eventType: "PAYMENT_INVOICE_ISSUED",
      beforeState: "WAITING_COUNTERPARTY_DATA",
      afterState: "WAITING_BUYER_PAYMENT",
      stateVersion: nextStateVersion,
      payload: {
        invoiceId: invoice.id,
        provider: invoice.provider,
        providerInvoiceId: invoice.providerInvoiceId,
        amount: invoice.amount,
        issuedAt: issuedAt.toISOString(),
        deadlineAt: deadlineAt.toISOString()
      }
    });

    const result = toProjection(transactionId, nextStateVersion, invoice);
    await saveIdempotentResult(tx, actor.id, INVOICE_COMMAND, idempotency.key, idempotency.requestHash, result);
    return result;
  });
}

export async function readPaymentStatus(transactionId: string, actorAccountId: string) {
  const [participant] = await db.select().from(transactionParticipants).where(and(
    eq(transactionParticipants.transactionId, transactionId),
    eq(transactionParticipants.accountId, actorAccountId)
  )).limit(1);
  if (!participant || participant.role === "ADMIN") throw new Error("TRANSACTION_FORBIDDEN");

  const [transaction] = await db.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
  if (!transaction) throw new Error("TRANSACTION_NOT_FOUND");
  const [invoice] = await db.select().from(paymentInvoices).where(and(
    eq(paymentInvoices.transactionId, transactionId),
    eq(paymentInvoices.isActive, true)
  )).orderBy(desc(paymentInvoices.createdAt)).limit(1);
  if (!invoice?.issuedAt) throw new Error("PAYMENT_INVOICE_NOT_READY");
  return toProjection(transactionId, transaction.stateVersion, invoice);
}
