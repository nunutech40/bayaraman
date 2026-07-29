import { and, eq, lte, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { paymentInvoices, transactions } from "@/server/db/schema";
import { recordTransactionEvent } from "@/server/transaction/audit";

export async function expirePaymentInvoices(now = new Date()): Promise<number> {
  const candidates = await db.select({
    transactionId: transactions.id,
    stateVersion: transactions.stateVersion,
    deadlineAt: paymentInvoices.deadlineAt
  }).from(transactions)
    .innerJoin(paymentInvoices, and(
      eq(paymentInvoices.transactionId, transactions.id),
      eq(paymentInvoices.isActive, true)
    ))
    .where(and(
      eq(transactions.state, "WAITING_BUYER_PAYMENT"),
      lte(paymentInvoices.deadlineAt, now)
    ));

  let expired = 0;
  for (const candidate of candidates) {
    await db.transaction(async (tx) => {
      const [updated] = await tx.update(transactions).set({
          state: "PAYMENT_EXPIRED",
          stateVersion: candidate.stateVersion + 1,
          updatedAt: now
        }).where(and(
          eq(transactions.id, candidate.transactionId),
          eq(transactions.state, "WAITING_BUYER_PAYMENT"),
          eq(transactions.stateVersion, candidate.stateVersion),
          sql`EXISTS (
            SELECT 1 FROM payment_invoices
            WHERE payment_invoices.transaction_id = ${transactions.id}
              AND payment_invoices.is_active = true
              AND payment_invoices.deadline_at <= ${now}
          )`
        )).returning({ id: transactions.id })
      ;

      if (!updated) return;
      expired += 1;
      await recordTransactionEvent(tx, {
        transactionId: candidate.transactionId,
        eventType: "PAYMENT_EXPIRED",
        beforeState: "WAITING_BUYER_PAYMENT",
        afterState: "PAYMENT_EXPIRED",
        stateVersion: candidate.stateVersion + 1,
        payload: { expiredAt: now.toISOString() }
      });
    });
  }

  return expired;
}
