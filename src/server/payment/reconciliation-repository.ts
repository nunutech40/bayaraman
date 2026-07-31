import { and, desc, eq, sql } from "drizzle-orm";
import {
  paymentInvoices,
  paymentReconciliations
} from "@/server/db/schema";

export type PaymentReconciliationDecisionCode =
  | "PROVIDER_STATUS_REVIEW"
  | "LATE_FUND_HANDOFF"
  | "CONTROLLED_EXCEPTION_HANDOFF";

export async function ensurePaymentReconciliation(
  tx: any,
  invoiceId: string | null,
  decisionCode: PaymentReconciliationDecisionCode
) {
  if (!invoiceId) throw new Error("RECONCILIATION_INVOICE_REQUIRED");
  const [invoice] = await tx.select().from(paymentInvoices)
    .where(eq(paymentInvoices.id, invoiceId)).limit(1);
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

export async function completeOpenPaymentReconciliations(
  tx: any,
  invoiceId: string,
  evidenceReference: string,
  completedAt = new Date()
) {
  return tx.update(paymentReconciliations).set({
    result: "SUCCESS",
    evidenceReference,
    completedAt
  }).where(and(
    eq(paymentReconciliations.invoiceId, invoiceId),
    sql`completed_at IS NULL`
  )).returning({ id: paymentReconciliations.id });
}
