import { createHash, randomUUID } from "node:crypto";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  buyerRefundDestinations,
  cancellationEvents,
  cancellationEvidenceHeads,
  cancellationRefundCalculations,
  cancellationRequests,
  transactionParticipants,
  transactionTerms,
  transactions
} from "@/server/db/schema";
import { findIdempotentResult, saveIdempotentResult } from "@/server/transaction/mutation";
import { recordTransactionEvent } from "@/server/transaction/audit";
import { requireCancellationAssignment } from "./authorization";
import type { CancellationCalculationInput } from "./contracts";

type Admin = { id: string; isAdmin: boolean };
type Idempotency = { key: string; requestHash: string };

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function buyerAmount(cause: string, terms: typeof transactionTerms.$inferSelect) {
  if (["BUYER_CHANGE_OF_MIND", "MUTUAL_NEUTRAL"].includes(cause)) {
    return terms.itemPrice + terms.shippingCost;
  }
  if (["SELLER_UNABLE_TO_FULFILL", "BAYARAMAN_ERROR"].includes(cause)) {
    return terms.totalAmount;
  }
  throw new Error("CANCELLATION_CALCULATION_MANUAL_REVIEW_REQUIRED");
}

export async function proposeCancellationCalculation(
  admin: Admin,
  transactionId: string,
  input: CancellationCalculationInput,
  idempotency: Idempotency
) {
  return db.transaction(async (tx) => {
    await requireCancellationAssignment(tx, admin, "CANCELLATION_APPROVAL");
    const command = "CANCELLATION_CALCULATION_PROPOSE";
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
    if (transaction.state !== "FUNDED_CANCELLATION_REVIEW" ||
        request.delegationType !== "NONE") {
      throw new Error("CANCELLATION_CALCULATION_NOT_ELIGIBLE");
    }
    const [terms] = await tx.select().from(transactionTerms)
      .where(eq(transactionTerms.transactionId, transactionId)).limit(1);
    const [buyer] = await tx.select().from(transactionParticipants).where(and(
      eq(transactionParticipants.transactionId, transactionId),
      eq(transactionParticipants.role, "BUYER")
    )).limit(1);
    if (!terms || !buyer) throw new Error("CANCELLATION_DATA_INCOMPLETE");
    const [destination] = await tx.select().from(buyerRefundDestinations).where(and(
      eq(buyerRefundDestinations.transactionId, transactionId),
      eq(buyerRefundDestinations.participantAccountId, buyer.accountId)
    )).limit(1);
    if (!destination?.lockedAt) throw new Error("REFUND_DESTINATION_NOT_LOCKED");
    const heads = await tx.select().from(cancellationEvidenceHeads)
      .where(eq(cancellationEvidenceHeads.cancellationRequestId, request.id))
      .orderBy(asc(cancellationEvidenceHeads.evidenceKey));
    const canonicalEvidenceHash = hash(heads.map((head) => ({
      key: head.evidenceKey,
      id: head.currentEvidenceId
    })));
    if (canonicalEvidenceHash !== input.evidenceSnapshotHash) {
      throw new Error("CANCELLATION_EVIDENCE_CONFLICT");
    }
    const [latest] = await tx.select({ version: cancellationRefundCalculations.version })
      .from(cancellationRefundCalculations)
      .where(eq(cancellationRefundCalculations.cancellationRequestId, request.id))
      .orderBy(desc(cancellationRefundCalculations.version)).limit(1);
    const amount = buyerAmount(request.cause, terms);
    const version = (latest?.version ?? 0) + 1;
    const calculationHash = hash({
      cancellationRequestId: request.id,
      version,
      cause: request.cause,
      buyerAmount: amount,
      currency: "IDR",
      evidenceSnapshotHash: canonicalEvidenceHash,
      buyerDestinationBindingId: buyer.accountId
    });
    const [calculation] = await tx.insert(cancellationRefundCalculations).values({
      cancellationRequestId: request.id,
      version,
      buyerAmount: amount,
      calculationHash,
      evidenceSnapshotHash: canonicalEvidenceHash,
      buyerDestinationBindingId: buyer.accountId,
      proposedByAccountId: admin.id
    }).returning();
    if (!calculation) throw new Error("CANCELLATION_CALCULATION_CREATE_FAILED");
    const correlationId = randomUUID();
    await tx.insert(cancellationEvents).values({
      cancellationRequestId: request.id,
      eventType: "REFUND_CALCULATION_PROPOSED",
      actorAccountId: admin.id,
      summary: "Cause-based refund calculation proposed",
      evidenceReference: calculation.id,
      correlationId,
      idempotencyKey: idempotency.key
    });
    await recordTransactionEvent(tx, {
      transactionId,
      actorAccountId: admin.id,
      eventType: "CANCELLATION_REFUND_CALCULATION_PROPOSED",
      stateVersion: transaction.stateVersion,
      correlationId,
      evidenceReference: calculation.id
    });
    const result = {
      cancellationRequestId: request.id,
      calculationId: calculation.id,
      version,
      buyerAmount: amount,
      currency: "IDR",
      status: "PENDING"
    };
    await saveIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash, result);
    return result;
  });
}
