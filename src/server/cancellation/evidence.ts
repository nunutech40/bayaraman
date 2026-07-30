import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  cancellationEvents,
  cancellationEvidence,
  cancellationEvidenceHeads,
  cancellationRequests,
  transactions
} from "@/server/db/schema";
import {
  findIdempotentResult,
  saveIdempotentResult
} from "@/server/transaction/mutation";
import { recordTransactionEvent } from "@/server/transaction/audit";
import { requireCancellationAssignment } from "./authorization";
import type { CancellationEvidenceInput } from "./contracts";

type Admin = { id: string; isAdmin: boolean };
type Idempotency = { key: string; requestHash: string };

export async function recordCancellationEvidence(
  admin: Admin,
  transactionId: string,
  input: CancellationEvidenceInput,
  idempotency: Idempotency
) {
  return db.transaction(async (tx) => {
    await requireCancellationAssignment(tx, admin, "CANCELLATION_EVIDENCE");
    const command = "CANCELLATION_EVIDENCE_RECORD";
    const prior = await findIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash);
    if (prior) return prior;
    await tx.execute(sql`SELECT id FROM transactions WHERE id = ${transactionId} FOR UPDATE`);
    await tx.execute(sql`
      SELECT id FROM cancellation_requests
      WHERE id = ${input.cancellationRequestId} FOR UPDATE
    `);
    const [transaction] = await tx.select().from(transactions)
      .where(eq(transactions.id, transactionId)).limit(1);
    const [request] = await tx.select().from(cancellationRequests).where(and(
      eq(cancellationRequests.id, input.cancellationRequestId),
      eq(cancellationRequests.transactionId, transactionId),
      eq(cancellationRequests.status, "ACTIVE")
    )).limit(1);
    if (!transaction || !request) throw new Error("CANCELLATION_NOT_FOUND");
    if (transaction.stateVersion !== input.expectedStateVersion) {
      throw new Error("STATE_VERSION_CONFLICT");
    }

    const [head] = await tx.select().from(cancellationEvidenceHeads).where(and(
      eq(cancellationEvidenceHeads.cancellationRequestId, request.id),
      eq(cancellationEvidenceHeads.evidenceKey, input.evidenceKey)
    )).limit(1);
    if (input.correctedEvidenceId && head?.currentEvidenceId !== input.correctedEvidenceId) {
      throw new Error("CANCELLATION_EVIDENCE_CORRECTION_CONFLICT");
    }
    if (!input.correctedEvidenceId && head) {
      throw new Error("CANCELLATION_EVIDENCE_ALREADY_RECORDED");
    }

    const correlationId = randomUUID();
    const [evidence] = await tx.insert(cancellationEvidence).values({
      cancellationRequestId: request.id,
      evidenceKey: input.evidenceKey,
      sourceAuthorRole: input.sourceAuthorRole,
      sourceAccountId: input.sourceAccountId,
      evidenceReference: input.evidenceReference,
      messageReference: input.messageReference,
      snapshotHash: input.snapshotHash,
      deliveryResult: input.deliveryResult,
      responseValue: input.responseValue,
      correctedEvidenceId: input.correctedEvidenceId,
      correctionReason: input.correctionReason,
      recordedByAccountId: admin.id,
      correlationId,
      idempotencyKey: idempotency.key
    }).returning();
    if (!evidence) throw new Error("CANCELLATION_EVIDENCE_CREATE_FAILED");

    if (head) {
      const [updated] = await tx.update(cancellationEvidenceHeads).set({
        currentEvidenceId: evidence.id,
        updatedAt: new Date()
      }).where(and(
        eq(cancellationEvidenceHeads.id, head.id),
        eq(cancellationEvidenceHeads.currentEvidenceId, head.currentEvidenceId)
      )).returning({ id: cancellationEvidenceHeads.id });
      if (!updated) throw new Error("CANCELLATION_EVIDENCE_CONFLICT");
    } else {
      await tx.insert(cancellationEvidenceHeads).values({
        cancellationRequestId: request.id,
        evidenceKey: input.evidenceKey,
        currentEvidenceId: evidence.id
      });
    }

    const requestUpdate: Partial<typeof cancellationRequests.$inferInsert> = {
      stateVersion: request.stateVersion + 1
    };
    if (input.evidenceKey === "WA_REQUEST" &&
        input.deliveryResult === "SENT" &&
        !request.responseDeadlineAt) {
      requestUpdate.responseDeadlineAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
    if (input.evidenceKey === "SELLER_SHIPMENT" &&
        input.deliveryResult === "SENT" &&
        request.delegationType !== "RISK") {
      requestUpdate.delegationType = "COMPLAINT";
      requestUpdate.delegationStatus = "REQUIRED";
    }
    const [updatedRequest] = await tx.update(cancellationRequests).set(requestUpdate)
      .where(and(
        eq(cancellationRequests.id, request.id),
        eq(cancellationRequests.stateVersion, request.stateVersion)
      )).returning();
    if (!updatedRequest) throw new Error("CANCELLATION_CONFLICT");

    await tx.insert(cancellationEvents).values({
      cancellationRequestId: request.id,
      eventType: input.correctedEvidenceId
        ? "EVIDENCE_CORRECTED"
        : input.evidenceKey === "SELLER_SHIPMENT"
          ? "SELLER_SHIPMENT_RECORDED"
          : input.evidenceKey === "WA_REQUEST"
            ? "WA_REQUEST_RECORDED"
            : "PARTICIPANT_RESPONSE_RECORDED",
      actorAccountId: admin.id,
      summary: `Cancellation evidence ${input.evidenceKey}`,
      evidenceReference: evidence.id,
      correlationId,
      idempotencyKey: `${idempotency.key}:event`
    });
    await recordTransactionEvent(tx, {
      transactionId,
      actorAccountId: admin.id,
      eventType: input.correctedEvidenceId
        ? "CANCELLATION_EVIDENCE_CORRECTED"
        : "CANCELLATION_EVIDENCE_RECORDED",
      stateVersion: transaction.stateVersion,
      correlationId,
      evidenceReference: evidence.id,
      payload: {
        cancellationRequestId: request.id,
        evidenceKey: input.evidenceKey,
        deliveryResult: input.deliveryResult
      }
    });
    const result = {
      cancellationRequestId: request.id,
      evidenceId: evidence.id,
      evidenceKey: input.evidenceKey,
      responseDeadlineAt: updatedRequest.responseDeadlineAt,
      delegationType: updatedRequest.delegationType,
      delegationStatus: updatedRequest.delegationStatus,
      state: transaction.state,
      stateVersion: transaction.stateVersion
    };
    await saveIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash, result);
    return result;
  });
}
