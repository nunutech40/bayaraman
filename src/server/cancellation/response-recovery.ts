import { randomUUID } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  cancellationEvents,
  cancellationEvidenceHeads,
  cancellationRequests,
  transactions
} from "@/server/db/schema";
import { findIdempotentResult, saveIdempotentResult } from "@/server/transaction/mutation";
import { recordTransactionEvent } from "@/server/transaction/audit";
import { requireCancellationAssignment } from "./authorization";
import type { CancellationResponseRecoveryInput } from "./contracts";

type Admin = { id: string; isAdmin: boolean };
type Idempotency = { key: string; requestHash: string };

export async function recoverCancellationResponse(
  admin: Admin,
  transactionId: string,
  input: CancellationResponseRecoveryInput,
  idempotency: Idempotency
) {
  return db.transaction(async (tx) => {
    await requireCancellationAssignment(tx, admin, "CANCELLATION_EVIDENCE");
    const command = "CANCELLATION_RESPONSE_RECOVERY";
    const prior = await findIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash);
    if (prior) return prior;
    await tx.execute(sql`SELECT id FROM transactions WHERE id = ${transactionId} FOR UPDATE`);
    const [transaction] = await tx.select().from(transactions)
      .where(eq(transactions.id, transactionId)).limit(1);
    const [request] = await tx.select().from(cancellationRequests).where(and(
      eq(cancellationRequests.id, input.cancellationRequestId),
      eq(cancellationRequests.transactionId, transactionId),
      eq(cancellationRequests.status, "ACTIVE")
    )).limit(1);
    if (!transaction || !request) throw new Error("CANCELLATION_NOT_FOUND");
    if (transaction.stateVersion !== input.expectedStateVersion) throw new Error("STATE_VERSION_CONFLICT");
    if (
      transaction.state !== "MANUAL_REVIEW_REQUIRED" ||
      request.manualReviewReason !== "FUNDED_RESPONSE_TIMEOUT"
    ) throw new Error("CANCELLATION_RESPONSE_RECOVERY_NOT_ELIGIBLE");
    const heads = await tx.select().from(cancellationEvidenceHeads)
      .where(eq(cancellationEvidenceHeads.cancellationRequestId, request.id))
      .orderBy(asc(cancellationEvidenceHeads.evidenceKey));
    const canonical = heads.map((head) => head.currentEvidenceId).sort();
    const supplied = [...input.currentEvidenceHeadIds].sort();
    if (canonical.length !== supplied.length ||
        canonical.some((id, index) => id !== supplied[index])) {
      throw new Error("CANCELLATION_EVIDENCE_CONFLICT");
    }
    const shipped = heads.some((head) => head.evidenceKey === "SELLER_SHIPMENT");
    const nextState = shipped ? "MANUAL_REVIEW_REQUIRED" : "FUNDED_CANCELLATION_REVIEW";
    const nextVersion = shipped ? transaction.stateVersion : transaction.stateVersion + 1;
    if (!shipped) {
      const [updated] = await tx.update(transactions).set({
        state: nextState,
        stateVersion: nextVersion,
        updatedAt: new Date()
      }).where(and(
        eq(transactions.id, transactionId),
        eq(transactions.state, "MANUAL_REVIEW_REQUIRED"),
        eq(transactions.stateVersion, transaction.stateVersion)
      )).returning({ id: transactions.id });
      if (!updated) throw new Error("STATE_VERSION_CONFLICT");
    }
    const [updatedRequest] = await tx.update(cancellationRequests).set({
      decision: shipped ? "MANUAL_REVIEW" : "FUNDED_REVIEW",
      manualReviewReason: shipped ? "SHIPMENT_OR_CONFLICT_EVIDENCE" : null,
      responseDeadlineAt: null,
      delegationType: shipped && request.delegationType !== "RISK"
        ? "COMPLAINT"
        : request.delegationType,
      delegationStatus: shipped && request.delegationType !== "RISK"
        ? "REQUIRED"
        : request.delegationStatus,
      stateVersion: request.stateVersion + 1
    }).where(and(
      eq(cancellationRequests.id, request.id),
      eq(cancellationRequests.stateVersion, request.stateVersion)
    )).returning();
    if (!updatedRequest) throw new Error("CANCELLATION_CONFLICT");
    const correlationId = randomUUID();
    await tx.insert(cancellationEvents).values({
      cancellationRequestId: request.id,
      eventType: "MANUAL_REVIEW_RECOVERY_RECORDED",
      actorAccountId: admin.id,
      summary: shipped
        ? "Late evidence requires complaint handoff"
        : "Late evidence restored funded cancellation review",
      correlationId,
      idempotencyKey: idempotency.key
    });
    await recordTransactionEvent(tx, {
      transactionId,
      actorAccountId: admin.id,
      eventType: "CANCELLATION_RESPONSE_RECOVERED",
      beforeState: transaction.state,
      afterState: nextState,
      stateVersion: nextVersion,
      correlationId
    });
    const result = {
      cancellationRequestId: request.id,
      state: nextState,
      stateVersion: nextVersion,
      delegationType: updatedRequest.delegationType,
      delegationStatus: updatedRequest.delegationStatus
    };
    await saveIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash, result);
    return result;
  });
}
