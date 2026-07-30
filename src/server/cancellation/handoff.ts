import { and, eq, sql } from "drizzle-orm";
import {
  cancellationFinancialHandoffs,
  financialOperations,
  transactions
} from "@/server/db/schema";
import { recordTransactionEvent } from "@/server/transaction/audit";

type DatabaseTransaction = any;
export type CancellationFinancialHandoffSnapshot =
  typeof cancellationFinancialHandoffs.$inferSelect;

export async function readCancellationFinancialHandoffForUpdate(
  tx: DatabaseTransaction,
  handoffId: string,
  transactionId: string
): Promise<CancellationFinancialHandoffSnapshot> {
  await tx.execute(sql`
    SELECT id FROM cancellation_financial_handoffs
    WHERE id = ${handoffId} AND transaction_id = ${transactionId}
    FOR UPDATE
  `);
  const [handoff] = await tx.select().from(cancellationFinancialHandoffs).where(and(
    eq(cancellationFinancialHandoffs.id, handoffId),
    eq(cancellationFinancialHandoffs.transactionId, transactionId)
  )).limit(1);
  if (!handoff) throw new Error("CANCELLATION_HANDOFF_NOT_FOUND");
  return handoff;
}

export async function claimCancellationFinancialHandoff(
  tx: DatabaseTransaction,
  input: {
    handoffId: string;
    transactionId: string;
    expectedSourceStateVersion: number;
    parentOperationId: string;
    actorAccountId: string;
    correlationId: string;
  }
): Promise<CancellationFinancialHandoffSnapshot> {
  const handoff = await readCancellationFinancialHandoffForUpdate(
    tx,
    input.handoffId,
    input.transactionId
  );
  if (handoff.consumedByOperationId === input.parentOperationId) return handoff;
  if (handoff.consumedByOperationId) throw new Error("CANCELLATION_HANDOFF_ALREADY_CLAIMED");
  const [transaction] = await tx.select({
    state: transactions.state,
    stateVersion: transactions.stateVersion
  }).from(transactions).where(eq(transactions.id, input.transactionId)).limit(1);
  const [operation] = await tx.select({
    transactionId: financialOperations.transactionId,
    type: financialOperations.type
  }).from(financialOperations).where(eq(financialOperations.id, input.parentOperationId)).limit(1);
  if (!transaction || transaction.state !== "REFUND_READY" ||
      transaction.state !== handoff.sourceState ||
      transaction.stateVersion !== handoff.sourceStateVersion ||
      transaction.stateVersion !== input.expectedSourceStateVersion) {
    throw new Error("STATE_VERSION_CONFLICT");
  }
  if (operation?.transactionId !== input.transactionId || operation.type !== "REFUND") {
    throw new Error("CANCELLATION_HANDOFF_OPERATION_MISMATCH");
  }
  const [claimed] = await tx.update(cancellationFinancialHandoffs).set({
    consumedByOperationId: input.parentOperationId,
    consumedAt: new Date()
  }).where(and(
    eq(cancellationFinancialHandoffs.id, handoff.id),
    sql`${cancellationFinancialHandoffs.consumedByOperationId} IS NULL`
  )).returning();
  if (!claimed) throw new Error("CANCELLATION_HANDOFF_ALREADY_CLAIMED");
  await recordTransactionEvent(tx, {
    transactionId: input.transactionId,
    actorAccountId: input.actorAccountId,
    eventType: "CANCELLATION_FINANCIAL_HANDOFF_CLAIMED",
    stateVersion: transaction.stateVersion,
    correlationId: input.correlationId,
    evidenceReference: handoff.id,
    payload: { sourceType: handoff.sourceType }
  });
  return claimed;
}
