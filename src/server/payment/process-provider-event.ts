import { desc, eq } from "drizzle-orm";
import {
  cancellationRequests,
  paymentInvoices,
  paymentReconciliations,
  transactions
} from "@/server/db/schema";
import { resolveCancellationProviderStatus, type CancellationResolutionSource } from "@/server/cancellation/provider-resolution";
import { ensurePaymentReconciliation } from "./reconciliation-repository";

export async function processProviderEvent(
  tx: any,
  input: {
    transactionId: string;
    invoiceId: string;
    providerEventId: string;
    source: CancellationResolutionSource;
    correlationId: string;
    idempotencyKey: string;
  }
) {
  const [transaction] = await tx.select().from(transactions)
    .where(eq(transactions.id, input.transactionId)).limit(1);
  const [invoice] = await tx.select().from(paymentInvoices)
    .where(eq(paymentInvoices.id, input.invoiceId)).limit(1);
  if (!transaction || !invoice) throw new Error("PAYMENT_PROVIDER_REFERENCE_INVALID");
  const cancellationState = [
    "CANCELLATION_PENDING_RECONCILIATION",
    "FUNDED_CANCELLATION_REVIEW",
    "PAYMENT_UNDER_REVIEW",
    "PAYMENT_EXCEPTION_REVIEW",
    "PAYMENT_EXPIRED",
    "CANCELLED"
  ].includes(transaction.state);
  if (!cancellationState) return null;
  const [request] = await tx.select().from(cancellationRequests)
    .where(eq(cancellationRequests.transactionId, transaction.id))
    .orderBy(desc(cancellationRequests.createdAt)).limit(1);
  const reconciliation = request?.paymentReconciliationId
    ? (await tx.select().from(paymentReconciliations)
      .where(eq(paymentReconciliations.id, request.paymentReconciliationId))
      .limit(1))[0]
    : await ensurePaymentReconciliation(
      tx,
      invoice.id,
      "LATE_FUND_HANDOFF"
    );
  if (!reconciliation) throw new Error("PAYMENT_RECONCILIATION_NOT_FOUND");
  return resolveCancellationProviderStatus(tx, {
    transactionId: transaction.id,
    invoiceId: invoice.id,
    cancellationRequestId: request?.status === "ACTIVE" ? request.id : null,
    paymentReconciliationId: reconciliation.id,
    providerEventId: input.providerEventId,
    expectedStateVersion: transaction.stateVersion,
    source: input.source,
    correlationId: input.correlationId,
    idempotencyKey: input.idempotencyKey
  });
}
