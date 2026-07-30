import { randomUUID } from "node:crypto";
import { and, eq, lte, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  cancellationEvents,
  cancellationRequests,
  transactions
} from "@/server/db/schema";
import { recordTransactionEvent } from "@/server/transaction/audit";

export async function runCancellationResponseTimeout(now = new Date()) {
  const candidates = await db.select({
    requestId: cancellationRequests.id,
    transactionId: cancellationRequests.transactionId,
    requestVersion: cancellationRequests.stateVersion,
    state: transactions.state,
    stateVersion: transactions.stateVersion
  }).from(cancellationRequests)
    .innerJoin(transactions, eq(transactions.id, cancellationRequests.transactionId))
    .where(and(
      eq(cancellationRequests.status, "ACTIVE"),
      lte(cancellationRequests.responseDeadlineAt, now),
      sql`NOT EXISTS (
        SELECT 1 FROM cancellation_evidence_heads h
        WHERE h.cancellation_request_id = cancellation_requests.id
          AND h.evidence_key IN ('BUYER_RESPONSE', 'SELLER_RESPONSE')
      )`
    ));
  let transitioned = 0;
  for (const candidate of candidates) {
    const changed = await db.transaction(async (tx) => {
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
      if (!updated) return false;
      await tx.update(cancellationRequests).set({
        decision: "MANUAL_REVIEW",
        manualReviewReason: "FUNDED_RESPONSE_TIMEOUT",
        stateVersion: candidate.requestVersion + 1
      }).where(and(
        eq(cancellationRequests.id, candidate.requestId),
        eq(cancellationRequests.stateVersion, candidate.requestVersion)
      ));
      const correlationId = randomUUID();
      await tx.insert(cancellationEvents).values({
        cancellationRequestId: candidate.requestId,
        eventType: "RESPONSE_TIMEOUT_RECORDED",
        summary: "Funded cancellation response exceeded 1x24 hours",
        correlationId,
        idempotencyKey: `SYSTEM:${candidate.requestId}:response-timeout`
      });
      await recordTransactionEvent(tx, {
        transactionId: candidate.transactionId,
        eventType: "CANCELLATION_RESPONSE_TIMED_OUT",
        beforeState: candidate.state,
        afterState: "MANUAL_REVIEW_REQUIRED",
        stateVersion: nextVersion,
        correlationId
      });
      return true;
    });
    if (changed) transitioned += 1;
  }
  return transitioned;
}
