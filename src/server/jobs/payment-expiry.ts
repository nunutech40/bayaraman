import { and, eq, lte, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { paymentInvoices, transactionParticipants, transactions } from "@/server/db/schema";
import { notificationPayloadHash } from "@/server/notifications/factory";
import { createNotificationIntent } from "@/server/notifications/repository";
import { recordTransactionEvent } from "@/server/transaction/audit";

export async function expirePaymentInvoices(
  now = new Date(),
  context?: { correlationId?: string; jobRunId?: string }
): Promise<number> {
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
    )).limit(100);

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
      const participants = await tx.select({
        accountId: transactionParticipants.accountId
      }).from(transactionParticipants).where(
        eq(transactionParticipants.transactionId, candidate.transactionId)
      );
      const correlationId = context?.correlationId ?? randomUUID();
      for (const participant of participants) {
        await createNotificationIntent(tx, {
          transactionId: candidate.transactionId,
          notificationType: "PAYMENT_EXPIRED",
          sourceType: "PAYMENT_INVOICE",
          sourceId: candidate.transactionId,
          recipientScope: `ACCOUNT:${participant.accountId}`,
          recipientAccountId: participant.accountId,
          channel: "IN_APP",
          occurrenceKey: "ONCE",
          payloadSnapshotHash: notificationPayloadHash({
            transactionId: candidate.transactionId,
            expiredAt: now.toISOString()
          }),
          correlationId
        }, now);
      }
      await recordTransactionEvent(tx, {
        transactionId: candidate.transactionId,
        systemActorName: "payment-expiry",
        eventType: "PAYMENT_EXPIRED",
        beforeState: "WAITING_BUYER_PAYMENT",
        afterState: "PAYMENT_EXPIRED",
        stateVersion: candidate.stateVersion + 1,
        correlationId,
        payload: {
          expiredAt: now.toISOString(),
          jobRunId: context?.jobRunId ?? null
        }
      });
    });
  }

  return expired;
}
