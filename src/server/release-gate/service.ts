import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  accounts,
  adminTaskAssignments,
  releaseGateItemEvents,
  releaseGateItems,
  releaseGateReviews,
  releaseGates
} from "@/server/db/schema";
import { findIdempotentResult, saveIdempotentResult } from "@/server/transaction/mutation";
import type {
  ReleaseGateEvaluationInput,
  ReleaseGateEvidenceInput,
  ReleaseGateItemKey
} from "./contracts";

type Admin = { id: string; isAdmin: boolean };
type Idempotency = { key: string; requestHash: string };

async function requireGateAssignment(tx: any, admin: Admin) {
  if (!admin.isAdmin) throw new Error("FORBIDDEN");
  const [assignment] = await tx.select({ id: adminTaskAssignments.id })
    .from(adminTaskAssignments)
    .innerJoin(accounts, eq(adminTaskAssignments.accountId, accounts.id))
    .where(and(
      eq(adminTaskAssignments.accountId, admin.id),
      eq(adminTaskAssignments.taskScope, "RELEASE_GATE_REVIEW"),
      isNull(adminTaskAssignments.revokedAt),
      eq(accounts.isAdmin, true)
    )).limit(1);
  if (!assignment) throw new Error("RELEASE_GATE_ASSIGNMENT_REQUIRED");
}

async function lockGate(tx: any) {
  await tx.execute(sql`
    SELECT id FROM release_gates
    WHERE gate_key = 'REAL_MONEY_PILOT'
    FOR UPDATE
  `);
  const [gate] = await tx.select().from(releaseGates)
    .where(eq(releaseGates.gateKey, "REAL_MONEY_PILOT")).limit(1);
  if (!gate) throw new Error("RELEASE_GATE_NOT_FOUND");
  return gate;
}

export async function readReleaseGate(admin: Admin) {
  return db.transaction(async (tx) => {
    await requireGateAssignment(tx, admin);
    const gate = await lockGate(tx);
    const items = await tx.select().from(releaseGateItems)
      .where(eq(releaseGateItems.gateId, gate.id))
      .orderBy(asc(releaseGateItems.itemKey));
    const reviews = await tx.select().from(releaseGateReviews)
      .where(eq(releaseGateReviews.gateId, gate.id))
      .orderBy(asc(releaseGateReviews.createdAt));
    return { ...gate, items, reviews };
  });
}

export async function recordReleaseGateEvidence(
  admin: Admin,
  itemKey: ReleaseGateItemKey,
  input: ReleaseGateEvidenceInput,
  idempotency: Idempotency
) {
  return db.transaction(async (tx) => {
    await requireGateAssignment(tx, admin);
    const command = `RELEASE_GATE_ITEM:${itemKey}`;
    const prior = await findIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash);
    if (prior) return prior;
    const gate = await lockGate(tx);
    if (gate.stateVersion !== input.expectedGateVersion) throw new Error("GATE_VERSION_CONFLICT");
    await tx.execute(sql`
      SELECT id FROM release_gate_items
      WHERE gate_id = ${gate.id} AND item_key = ${itemKey}
      FOR UPDATE
    `);
    const [item] = await tx.select().from(releaseGateItems).where(and(
      eq(releaseGateItems.gateId, gate.id),
      eq(releaseGateItems.itemKey, itemKey)
    )).limit(1);
    if (!item) throw new Error("RELEASE_GATE_ITEM_NOT_FOUND");
    if (input.correctedEventId && item.currentEventId !== input.correctedEventId) {
      throw new Error("RELEASE_GATE_CORRECTION_TARGET_INVALID");
    }
    const correlationId = randomUUID();
    const [event] = await tx.insert(releaseGateItemEvents).values({
      itemId: item.id,
      status: input.status,
      evidenceReference: input.evidenceReference,
      externalApproverReference: input.externalApproverReference,
      correctedEventId: input.correctedEventId,
      correctionReason: input.correctionReason,
      actorAccountId: admin.id,
      correlationId,
      idempotencyKey: idempotency.key
    }).returning();
    if (!event) throw new Error("RELEASE_GATE_EVENT_CREATE_FAILED");
    const [updated] = await tx.update(releaseGateItems).set({
      status: input.status,
      currentEventId: event.id,
      updatedAt: new Date()
    }).where(and(
      eq(releaseGateItems.id, item.id),
      input.correctedEventId
        ? eq(releaseGateItems.currentEventId, input.correctedEventId)
        : item.currentEventId
          ? eq(releaseGateItems.currentEventId, item.currentEventId)
          : isNull(releaseGateItems.currentEventId)
    )).returning({ id: releaseGateItems.id });
    if (!updated) throw new Error("RELEASE_GATE_EVIDENCE_CONFLICT");
    const result = {
      gateKey: gate.gateKey,
      itemKey,
      itemStatus: input.status,
      currentEventId: event.id,
      gateVersion: gate.stateVersion
    };
    await saveIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash, result);
    return result;
  });
}

export async function evaluateReleaseGate(
  admin: Admin,
  input: ReleaseGateEvaluationInput,
  idempotency: Idempotency
) {
  return db.transaction(async (tx) => {
    await requireGateAssignment(tx, admin);
    const command = "RELEASE_GATE_EVALUATE";
    const prior = await findIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash);
    if (prior) return prior;
    const gate = await lockGate(tx);
    if (gate.stateVersion !== input.expectedGateVersion) throw new Error("GATE_VERSION_CONFLICT");
    const items = await tx.select().from(releaseGateItems)
      .where(eq(releaseGateItems.gateId, gate.id));
    if (items.length !== 8) throw new Error("RELEASE_GATE_ITEMS_INCOMPLETE");
    const allApproved = items.every((item) => item.status === "APPROVED");
    if (allApproved && !input.externalDecisionReference) {
      throw new Error("EXTERNAL_DECISION_REFERENCE_REQUIRED");
    }
    const resultingStatus = allApproved ? "APPROVED" : "BLOCKED";
    const correlationId = randomUUID();
    const nextVersion = gate.stateVersion + 1;
    const [review] = await tx.insert(releaseGateReviews).values({
      gateId: gate.id,
      resultingStatus,
      externalDecisionReference: allApproved ? input.externalDecisionReference : null,
      actorAccountId: admin.id,
      correlationId,
      idempotencyKey: idempotency.key,
      gateVersion: nextVersion
    }).returning();
    if (!review) throw new Error("RELEASE_GATE_REVIEW_CREATE_FAILED");
    const [updated] = await tx.update(releaseGates).set({
      status: resultingStatus,
      stateVersion: nextVersion,
      currentReviewId: review.id,
      updatedAt: new Date()
    }).where(and(
      eq(releaseGates.id, gate.id),
      eq(releaseGates.stateVersion, gate.stateVersion)
    )).returning({ id: releaseGates.id });
    if (!updated) throw new Error("GATE_VERSION_CONFLICT");
    const result = {
      gateKey: gate.gateKey,
      status: resultingStatus,
      stateVersion: nextVersion,
      reviewId: review.id
    };
    await saveIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash, result);
    return result;
  });
}
