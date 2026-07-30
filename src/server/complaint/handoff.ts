import { and, eq, sql } from "drizzle-orm";
import {
  complaintAgreements,
  complaintEvents,
  complaintFinancialHandoffs,
  financialOperations,
  transactions
} from "@/server/db/schema";
import { recordTransactionEvent } from "@/server/transaction/audit";

type DatabaseTransaction = any;

export type ComplaintHandoffSnapshot = typeof complaintFinancialHandoffs.$inferSelect;

export async function readComplaintHandoffForUpdate(
  tx: DatabaseTransaction,
  handoffId: string,
  transactionId: string
): Promise<ComplaintHandoffSnapshot> {
  await tx.execute(sql`
    SELECT id FROM complaint_financial_handoffs
    WHERE id = ${handoffId} AND transaction_id = ${transactionId}
    FOR UPDATE
  `);
  const [handoff] = await tx.select().from(complaintFinancialHandoffs).where(and(
    eq(complaintFinancialHandoffs.id, handoffId),
    eq(complaintFinancialHandoffs.transactionId, transactionId)
  )).limit(1);
  if (!handoff) throw new Error("COMPLAINT_HANDOFF_NOT_FOUND");
  return handoff;
}

export async function claimComplaintHandoff(
  tx: DatabaseTransaction,
  input: {
    handoffId: string;
    transactionId: string;
    expectedSourceStateVersion: number;
    parentOperationId: string;
    actorAccountId: string;
    correlationId: string;
  }
): Promise<ComplaintHandoffSnapshot> {
  const handoff = await readComplaintHandoffForUpdate(tx, input.handoffId, input.transactionId);
  if (handoff.consumedByOperationId === input.parentOperationId) return handoff;
  if (handoff.consumedByOperationId) throw new Error("COMPLAINT_HANDOFF_ALREADY_CLAIMED");
  const [agreement] = await tx.select({ status: complaintAgreements.status })
    .from(complaintAgreements)
    .where(eq(complaintAgreements.id, handoff.agreementId))
    .limit(1);
  const [transaction] = await tx.select({ state: transactions.state, stateVersion: transactions.stateVersion })
    .from(transactions)
    .where(eq(transactions.id, input.transactionId))
    .limit(1);
  const [operation] = await tx.select({ transactionId: financialOperations.transactionId })
    .from(financialOperations)
    .where(eq(financialOperations.id, input.parentOperationId))
    .limit(1);
  if (agreement?.status !== "APPROVED") throw new Error("COMPLAINT_AGREEMENT_NOT_APPROVED");
  if (!transaction || transaction.state !== handoff.sourceState ||
      transaction.stateVersion !== handoff.sourceStateVersion ||
      transaction.stateVersion !== input.expectedSourceStateVersion) {
    throw new Error("STATE_VERSION_CONFLICT");
  }
  if (operation?.transactionId !== input.transactionId) throw new Error("COMPLAINT_HANDOFF_OPERATION_MISMATCH");

  const now = new Date();
  const [claimed] = await tx.update(complaintFinancialHandoffs).set({
    consumedByOperationId: input.parentOperationId,
    consumedAt: now
  }).where(and(
    eq(complaintFinancialHandoffs.id, handoff.id),
    sql`${complaintFinancialHandoffs.consumedByOperationId} IS NULL`
  )).returning();
  if (!claimed) throw new Error("COMPLAINT_HANDOFF_ALREADY_CLAIMED");

  await tx.insert(complaintEvents).values({
    complaintCaseId: handoff.complaintCaseId,
    eventType: "HANDOFF_CLAIMED",
    actorAccountId: input.actorAccountId,
    summarySnapshot: "Rute finansial telah diambil untuk diproses.",
    evidenceReference: input.parentOperationId,
    evidenceHash: handoff.evidenceHash,
    correlationId: input.correlationId,
    idempotencyKey: `HANDOFF:${input.parentOperationId}`
  });
  await recordTransactionEvent(tx, {
    transactionId: input.transactionId,
    actorAccountId: input.actorAccountId,
    eventType: "COMPLAINT_HANDOFF_CLAIMED",
    stateVersion: transaction.stateVersion,
    correlationId: input.correlationId,
    evidenceReference: handoff.id,
    payload: { outcome: handoff.outcome }
  });
  return claimed;
}

