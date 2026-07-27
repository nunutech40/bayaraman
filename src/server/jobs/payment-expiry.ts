import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { paymentClaims, paymentInstructions, transactions } from "@/server/db/schema";
import { recordTransactionEvent } from "@/server/transaction/audit";

export async function expireDuePaymentInstructions(now = new Date()): Promise<number> {
  const candidates = await db.select({
    transactionId: transactions.id,
    stateVersion: transactions.stateVersion
  }).from(transactions)
    .innerJoin(paymentInstructions, eq(paymentInstructions.transactionId, transactions.id))
    .leftJoin(paymentClaims, and(
      eq(paymentClaims.transactionId, transactions.id),
      eq(paymentClaims.active, true)
    ))
    .where(and(
      eq(transactions.state, "WAITING_BUYER_PAYMENT"),
      isNull(paymentClaims.id)
    ));

  let expired = 0;
  for (const candidate of candidates) {
    await db.transaction(async (tx) => {
      const [instruction] = await tx.select().from(paymentInstructions)
        .where(eq(paymentInstructions.transactionId, candidate.transactionId)).limit(1);
      const [updated] = instruction && instruction.deadlineAt.getTime() <= now.getTime()
        ? await tx.update(transactions).set({
          state: "PAYMENT_EXPIRED",
          stateVersion: candidate.stateVersion + 1,
          updatedAt: now
        }).where(and(
          eq(transactions.id, candidate.transactionId),
          eq(transactions.state, "WAITING_BUYER_PAYMENT"),
          eq(transactions.stateVersion, candidate.stateVersion)
        )).returning({ id: transactions.id })
        : [];

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
