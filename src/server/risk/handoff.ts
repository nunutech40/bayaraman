import { and, eq, sql } from "drizzle-orm";
import {
  financialOperations,
  riskEvents,
  riskFinancialHandoffs,
  riskReviews,
  transactions
} from "@/server/db/schema";
import { recordTransactionEvent } from "@/server/transaction/audit";

type DatabaseTransaction = any;
export type RiskRefundHandoffSnapshot = typeof riskFinancialHandoffs.$inferSelect;

export async function readRiskRefundHandoffForUpdate(
  tx: DatabaseTransaction,
  handoffId: string,
  transactionId: string
): Promise<RiskRefundHandoffSnapshot> {
  await tx.execute(sql`
    SELECT id FROM risk_financial_handoffs
    WHERE id = ${handoffId} AND transaction_id = ${transactionId}
    FOR UPDATE
  `);
  const [handoff] = await tx.select().from(riskFinancialHandoffs).where(and(
    eq(riskFinancialHandoffs.id, handoffId),
    eq(riskFinancialHandoffs.transactionId, transactionId)
  )).limit(1);
  if (!handoff) throw new Error("RISK_HANDOFF_NOT_FOUND");
  return handoff;
}

export async function claimRiskRefundHandoff(
  tx: DatabaseTransaction,
  input: {
    handoffId: string;
    transactionId: string;
    expectedSourceStateVersion: number;
    parentOperationId: string;
    actorAccountId: string;
    correlationId: string;
  }
): Promise<RiskRefundHandoffSnapshot> {
  const handoff = await readRiskRefundHandoffForUpdate(tx, input.handoffId, input.transactionId);
  if (handoff.consumedByOperationId === input.parentOperationId) return handoff;
  if (handoff.consumedByOperationId) throw new Error("RISK_HANDOFF_ALREADY_CLAIMED");
  const [review] = await tx.select({ status: riskReviews.status })
    .from(riskReviews).where(eq(riskReviews.id, handoff.reviewId)).limit(1);
  const [transaction] = await tx.select({
    state: transactions.state, stateVersion: transactions.stateVersion
  }).from(transactions).where(eq(transactions.id, input.transactionId)).limit(1);
  const [operation] = await tx.select({
    transactionId: financialOperations.transactionId,
    type: financialOperations.type
  }).from(financialOperations).where(eq(financialOperations.id, input.parentOperationId)).limit(1);
  if (review?.status !== "APPROVED") throw new Error("RISK_REVIEW_NOT_APPROVED");
  if (!transaction || transaction.state !== "REFUND_READY" ||
      transaction.state !== handoff.sourceState ||
      transaction.stateVersion !== handoff.sourceStateVersion ||
      transaction.stateVersion !== input.expectedSourceStateVersion) {
    throw new Error("STATE_VERSION_CONFLICT");
  }
  if (operation?.transactionId !== input.transactionId || operation.type !== "REFUND") {
    throw new Error("RISK_HANDOFF_OPERATION_MISMATCH");
  }
  const now = new Date();
  const [claimed] = await tx.update(riskFinancialHandoffs).set({
    consumedByOperationId: input.parentOperationId,
    consumedAt: now
  }).where(and(
    eq(riskFinancialHandoffs.id, handoff.id),
    sql`${riskFinancialHandoffs.consumedByOperationId} IS NULL`
  )).returning();
  if (!claimed) throw new Error("RISK_HANDOFF_ALREADY_CLAIMED");
  await tx.insert(riskEvents).values({
    riskCaseId: handoff.riskCaseId,
    eventType: "HANDOFF_CLAIMED",
    actorAccountId: input.actorAccountId,
    summarySnapshot: "Refund Buyer telah diambil untuk diproses.",
    evidenceReference: input.parentOperationId,
    evidenceHash: handoff.evidenceHash,
    correlationId: input.correlationId,
    idempotencyKey: `HANDOFF:${input.parentOperationId}`
  });
  await recordTransactionEvent(tx, {
    transactionId: input.transactionId,
    actorAccountId: input.actorAccountId,
    eventType: "RISK_HANDOFF_CLAIMED",
    stateVersion: transaction.stateVersion,
    correlationId: input.correlationId,
    evidenceReference: handoff.id,
    payload: { outcome: "BUYER_REFUND" }
  });
  return claimed;
}
