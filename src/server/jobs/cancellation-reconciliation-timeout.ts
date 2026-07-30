import { randomUUID } from "node:crypto";
import { and, eq, lte } from "drizzle-orm";
import { db } from "@/server/db";
import {
  cancellationEvents,
  cancellationReconciliations,
  cancellationRequests,
  transactions
} from "@/server/db/schema";
import { recordTransactionEvent } from "@/server/transaction/audit";

export async function runCancellationReconciliationTimeout(now = new Date()) {
  const candidates = await db.select({
    reconciliationId: cancellationReconciliations.id,
    requestId: cancellationRequests.id,
    transactionId: cancellationRequests.transactionId,
    requestVersion: cancellationRequests.stateVersion,
    state: transactions.state,
    stateVersion: transactions.stateVersion
  }).from(cancellationReconciliations)
    .innerJoin(
      cancellationRequests,
      eq(cancellationRequests.id, cancellationReconciliations.cancellationRequestId)
    )
    .innerJoin(transactions, eq(transactions.id, cancellationRequests.transactionId))
    .where(and(
      eq(cancellationReconciliations.status, "OPEN"),
      lte(cancellationReconciliations.deadlineAt, now),
      eq(cancellationRequests.status, "ACTIVE")
    ));
  let transitioned = 0;
  for (const candidate of candidates) {
    const changed = await db.transaction(async (tx) => {
      const [timedOut] = await tx.update(cancellationReconciliations).set({
        status: "TIMED_OUT",
        classification: "UNKNOWN",
        completedAt: now
      }).where(and(
        eq(cancellationReconciliations.id, candidate.reconciliationId),
        eq(cancellationReconciliations.status, "OPEN")
      )).returning({ id: cancellationReconciliations.id });
      if (!timedOut) return false;
      const nextVersion = candidate.stateVersion + 1;
      const [updated] = await tx.update(transactions).set({
        state: "MANUAL_REVIEW_REQUIRED",
        stateVersion: nextVersion,
        updatedAt: now
      }).where(and(
        eq(transactions.id, candidate.transactionId),
        eq(transactions.state, candidate.state),
        eq(transactions.stateVersion, candidate.stateVersion)
      )).returning({ id: transactions.id });
      if (!updated) throw new Error("STATE_VERSION_CONFLICT");
      await tx.update(cancellationRequests).set({
        decision: "MANUAL_REVIEW",
        manualReviewReason: "CANCELLATION_RECONCILIATION_TIMEOUT",
        stateVersion: candidate.requestVersion + 1
      }).where(and(
        eq(cancellationRequests.id, candidate.requestId),
        eq(cancellationRequests.stateVersion, candidate.requestVersion)
      ));
      const correlationId = randomUUID();
      await tx.insert(cancellationEvents).values({
        cancellationRequestId: candidate.requestId,
        eventType: "RECONCILIATION_TIMEOUT_RECORDED",
        summary: "Provider reconciliation exceeded two operating hours",
        evidenceReference: candidate.reconciliationId,
        correlationId,
        idempotencyKey: `SYSTEM:${candidate.reconciliationId}:timeout`
      });
      await recordTransactionEvent(tx, {
        transactionId: candidate.transactionId,
        eventType: "CANCELLATION_RECONCILIATION_TIMED_OUT",
        beforeState: candidate.state,
        afterState: "MANUAL_REVIEW_REQUIRED",
        stateVersion: nextVersion,
        correlationId,
        evidenceReference: candidate.reconciliationId
      });
      return true;
    });
    if (changed) transitioned += 1;
  }
  return transitioned;
}
