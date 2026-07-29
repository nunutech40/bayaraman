import { and, asc, desc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import {
  transactionParticipants,
  transactions,
  whatsappCheckpointHeads,
  whatsappCheckpoints,
  whatsappGroups
} from "@/server/db/schema";
import { findIdempotentResult, saveIdempotentResult } from "@/server/transaction/mutation";
import { recordTransactionEvent } from "@/server/transaction/audit";
import type { WhatsAppCheckpointInput, WhatsAppGroupInput } from "./contracts";

const CHECKPOINT_TYPES = ["PAYMENT_ANNOUNCED", "SELLER_SHIPMENT", "SELLER_COMPLETION", "BUYER_COMPLETION"] as const;
type CheckpointType = typeof CHECKPOINT_TYPES[number];
type DeliveryResult = "PENDING" | "SENT" | "FAILED" | "UNKNOWN";

const roleForType: Record<CheckpointType, "BUYER" | "SELLER" | "ADMIN"> = {
  PAYMENT_ANNOUNCED: "ADMIN",
  SELLER_SHIPMENT: "SELLER",
  SELLER_COMPLETION: "SELLER",
  BUYER_COMPLETION: "BUYER"
};

function lastFour(value: string): string {
  return value.replace(/\D/g, "").slice(-4);
}

function assertDeliveryTrusted(result: DeliveryResult) {
  if (result !== "SENT") throw new Error("WHATSAPP_DELIVERY_NOT_CONFIRMED");
}

export function transitionFor(input: { state: string; type: CheckpointType; existingTypes: Set<string> }) {
  if (input.type === "PAYMENT_ANNOUNCED" && input.state === "PAYMENT_CONFIRMED" && !input.existingTypes.has(input.type)) return "READY_FOR_FULFILLMENT";
  if (input.type === "SELLER_SHIPMENT" && input.state === "READY_FOR_FULFILLMENT" && input.existingTypes.has("PAYMENT_ANNOUNCED")) return "WAITING_COMPLETION_REPORTS";
  if ((input.type === "SELLER_COMPLETION" || input.type === "BUYER_COMPLETION") && input.existingTypes.has("SELLER_SHIPMENT")) {
    if (input.state === "WAITING_COMPLETION_REPORTS") return "WAITING_OTHER_COMPLETION_REPORT";
    if (input.state === "WAITING_OTHER_COMPLETION_REPORT") return "READY_FOR_BUYER_CONFIRMATION";
  }
  throw new Error("WHATSAPP_CHECKPOINT_NOT_ELIGIBLE");
}

async function lockTransaction(tx: any, transactionId: string) {
  await tx.execute(sql`SELECT id FROM transactions WHERE id = ${transactionId} FOR UPDATE`);
  const [transaction] = await tx.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
  if (!transaction) throw new Error("TRANSACTION_NOT_FOUND");
  return transaction;
}

async function checkpointTypes(tx: any, transactionId: string) {
  const rows = await tx.select({ checkpointType: whatsappCheckpoints.checkpointType })
    .from(whatsappCheckpointHeads)
    .innerJoin(whatsappCheckpoints, eq(whatsappCheckpointHeads.currentCheckpointId, whatsappCheckpoints.id))
    .where(and(eq(whatsappCheckpointHeads.transactionId, transactionId), eq(whatsappCheckpoints.deliveryResult, "SENT")));
  return new Set<string>(rows.map((row: { checkpointType: string }) => row.checkpointType));
}

export async function recordWhatsAppGroup(adminId: string, transactionId: string, input: WhatsAppGroupInput, idempotency: { key: string; requestHash: string }) {
  return db.transaction(async (tx) => {
    const command = "WHATSAPP_GROUP_CREATE";
    const prior = await findIdempotentResult(tx, adminId, command, idempotency.key, idempotency.requestHash);
    if (prior) return prior;
    const transaction = await lockTransaction(tx, transactionId);
    if (transaction.stateVersion !== input.expectedStateVersion) throw new Error("STATE_VERSION_CONFLICT");
    if (transaction.state !== "PAYMENT_CONFIRMED") throw new Error("WHATSAPP_GROUP_PAYMENT_REQUIRED");
    const participants = await tx.select().from(transactionParticipants).where(eq(transactionParticipants.transactionId, transactionId));
    const buyer = participants.find((p: any) => p.role === "BUYER");
    const seller = participants.find((p: any) => p.role === "SELLER");
    if (!buyer || !seller) throw new Error("PARTICIPANTS_INCOMPLETE");
    if (lastFour(buyer.whatsappSnapshot) !== input.buyerSnapshotConfirmation.lastFour || lastFour(seller.whatsappSnapshot) !== input.sellerSnapshotConfirmation.lastFour) {
      throw new Error("PARTICIPANT_SNAPSHOT_MISMATCH");
    }
    const [existing] = await tx.select().from(whatsappGroups).where(eq(whatsappGroups.transactionId, transactionId)).limit(1);
    if (existing) {
      const result = { transactionId, groupId: existing.id, state: transaction.state, stateVersion: transaction.stateVersion };
      await saveIdempotentResult(tx, adminId, command, idempotency.key, idempotency.requestHash, result);
      return result;
    }
    const [group] = await tx.insert(whatsappGroups).values({ transactionId, groupReference: input.groupReference, createdByAccountId: adminId }).returning();
    if (!group) throw new Error("WHATSAPP_GROUP_CREATE_FAILED");
    await recordTransactionEvent(tx, { transactionId, actorAccountId: adminId, eventType: "GROUP_CREATED", stateVersion: transaction.stateVersion, correlationId: randomUUID(), evidenceReference: input.evidenceReference, payload: { groupReference: input.groupReference, buyerWhatsappLastFour: input.buyerSnapshotConfirmation.lastFour, sellerWhatsappLastFour: input.sellerSnapshotConfirmation.lastFour } });
    const result = { transactionId, groupId: group.id, state: transaction.state, stateVersion: transaction.stateVersion };
    await saveIdempotentResult(tx, adminId, command, idempotency.key, idempotency.requestHash, result);
    return result;
  });
}

export async function recordWhatsAppCheckpoint(adminId: string, transactionId: string, input: WhatsAppCheckpointInput, idempotency: { key: string; requestHash: string }) {
  return db.transaction(async (tx) => {
    const command = "WHATSAPP_CHECKPOINT_RECORD";
    const prior = await findIdempotentResult(tx, adminId, command, idempotency.key, idempotency.requestHash);
    if (prior) return prior;
    const transaction = await lockTransaction(tx, transactionId);
    if (transaction.stateVersion !== input.expectedStateVersion) throw new Error("STATE_VERSION_CONFLICT");
    const [group] = await tx.select().from(whatsappGroups).where(eq(whatsappGroups.transactionId, transactionId)).limit(1);
    if (!group) throw new Error("WHATSAPP_GROUP_REQUIRED");
    if (input.sourceAuthorRole !== roleForType[input.checkpointType]) throw new Error("CHECKPOINT_AUTHOR_ROLE_MISMATCH");
    if (input.correctedCheckpointId && input.deliveryResult !== "SENT") throw new Error("CORRECTION_MUST_BE_TRUSTED");
    const existingTypes = await checkpointTypes(tx, transactionId);
    const existingHead = (await tx.select().from(whatsappCheckpointHeads).where(and(eq(whatsappCheckpointHeads.transactionId, transactionId), eq(whatsappCheckpointHeads.checkpointType, input.checkpointType))).limit(1))[0];
    if (input.correctedCheckpointId) {
      const [original] = await tx.select().from(whatsappCheckpoints).where(and(eq(whatsappCheckpoints.id, input.correctedCheckpointId), eq(whatsappCheckpoints.transactionId, transactionId), eq(whatsappCheckpoints.checkpointType, input.checkpointType))).limit(1);
      if (!original || !existingHead || existingHead.currentCheckpointId !== original.id) throw new Error("CHECKPOINT_CORRECTION_TARGET_INVALID");
    } else if (existingHead && input.deliveryResult === "SENT") {
      const [current] = await tx.select({ deliveryResult: whatsappCheckpoints.deliveryResult }).from(whatsappCheckpoints).where(eq(whatsappCheckpoints.id, existingHead.currentCheckpointId)).limit(1);
      if (current?.deliveryResult === "SENT") throw new Error("CHECKPOINT_ALREADY_RECORDED");
    }
    let nextState = transaction.state;
    const isCorrection = Boolean(input.correctedCheckpointId);
    if (input.deliveryResult === "SENT" && !isCorrection) {
      assertDeliveryTrusted(input.deliveryResult);
      nextState = transitionFor({ state: transaction.state, type: input.checkpointType, existingTypes });
    }
    const [event] = await tx.insert(whatsappCheckpoints).values({ transactionId, groupId: group.id, checkpointType: input.checkpointType, authorAccountId: adminId, messageReference: input.messageReference, evidenceReference: input.evidenceReference, snapshotHash: input.snapshotHash, recordedByAccountId: adminId, recordedAt: input.recordedAt ?? new Date(), idempotencyKey: `${adminId}:${idempotency.key}`, deliveryResult: input.deliveryResult, correctedCheckpointId: input.correctedCheckpointId, correctionReason: input.correctionReason }).returning();
    if (!event) throw new Error("WHATSAPP_CHECKPOINT_CREATE_FAILED");
    if (existingHead) {
      await tx.update(whatsappCheckpointHeads).set({ currentCheckpointId: event.id, updatedAt: new Date() }).where(eq(whatsappCheckpointHeads.id, existingHead.id));
    } else {
      await tx.insert(whatsappCheckpointHeads).values({ transactionId, checkpointType: input.checkpointType, currentCheckpointId: event.id });
    }
    if (isCorrection) {
      await recordTransactionEvent(tx, {
        transactionId,
        actorAccountId: adminId,
        eventType: "WHATSAPP_CHECKPOINT_CORRECTED",
        stateVersion: transaction.stateVersion,
        correlationId: randomUUID(),
        evidenceReference: event.id,
        payload: { checkpointId: event.id, correctedCheckpointId: input.correctedCheckpointId, deliveryResult: input.deliveryResult }
      });
    } else if (nextState !== transaction.state) {
      const [updated] = await tx.update(transactions).set({ state: nextState, stateVersion: transaction.stateVersion + 1, updatedAt: new Date() }).where(and(eq(transactions.id, transactionId), eq(transactions.state, transaction.state), eq(transactions.stateVersion, transaction.stateVersion))).returning({ id: transactions.id });
      if (!updated) throw new Error("STATE_VERSION_CONFLICT");
      await recordTransactionEvent(tx, { transactionId, actorAccountId: adminId, eventType: `WHATSAPP_${input.checkpointType}`, beforeState: transaction.state, afterState: nextState, stateVersion: transaction.stateVersion + 1, correlationId: randomUUID(), evidenceReference: event.id, payload: { deliveryResult: input.deliveryResult, checkpointId: event.id } });
    } else {
      await recordTransactionEvent(tx, { transactionId, actorAccountId: adminId, eventType: `WHATSAPP_${input.checkpointType}_RECORDED`, stateVersion: transaction.stateVersion, correlationId: randomUUID(), evidenceReference: event.id, payload: { deliveryResult: input.deliveryResult, checkpointId: event.id } });
    }
    const result = { transactionId, checkpointId: event.id, checkpointType: input.checkpointType, state: nextState, stateVersion: nextState === transaction.state ? transaction.stateVersion : transaction.stateVersion + 1, deliveryResult: input.deliveryResult };
    await saveIdempotentResult(tx, adminId, command, idempotency.key, idempotency.requestHash, result);
    return result;
  });
}

export async function readWhatsAppSummary(transactionId: string, actorAccountId: string, admin = false) {
  const [transaction] = await db.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
  if (!transaction) throw new Error("TRANSACTION_NOT_FOUND");
  const participants = await db.select().from(transactionParticipants).where(eq(transactionParticipants.transactionId, transactionId));
  if (!admin && !participants.some((p) => p.accountId === actorAccountId)) throw new Error("TRANSACTION_FORBIDDEN");
  const [group] = await db.select().from(whatsappGroups).where(eq(whatsappGroups.transactionId, transactionId)).limit(1);
  const heads = await db.select({ type: whatsappCheckpointHeads.checkpointType, checkpoint: whatsappCheckpoints }).from(whatsappCheckpointHeads).innerJoin(whatsappCheckpoints, eq(whatsappCheckpointHeads.currentCheckpointId, whatsappCheckpoints.id)).where(eq(whatsappCheckpointHeads.transactionId, transactionId));
  return {
    transactionId, state: transaction.state, stateVersion: transaction.stateVersion,
    group: group ? { id: group.id, groupReference: admin ? group.groupReference : "GROUP_CREATED" } : null,
    checkpoints: heads.map(({ type, checkpoint }: any) => admin ? checkpoint : { checkpointType: type, deliveryResult: checkpoint.deliveryResult },),
    missing: CHECKPOINT_TYPES.filter((type) => !heads.some(({ type: found }: any) => found === type))
  };
}
