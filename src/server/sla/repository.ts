import { and, eq, isNull, lte } from "drizzle-orm";
import { db } from "@/server/db";
import { slaTrackers } from "@/server/db/schema";
import type { SlaType } from "./contracts";

export type SlaSource = {
  transactionId: string;
  slaType: SlaType;
  sourceType: string;
  sourceId: string;
  sourceTimestampKind: "CANONICAL" | "LEGACY_FALLBACK";
  startedAt: Date;
  targetAt: Date;
  handledAt: Date | null;
};

export async function upsertSlaSource(database: any, source: SlaSource, now = new Date()) {
  const [created] = await database.insert(slaTrackers).values({
    ...source,
    nextEscalationAt: source.targetAt,
    escalationCount: 0,
    createdAt: now,
    updatedAt: now
  }).onConflictDoNothing().returning();
  if (created) return created;
  const [existing] = await database.select().from(slaTrackers).where(and(
    eq(slaTrackers.slaType, source.slaType),
    eq(slaTrackers.sourceType, source.sourceType),
    eq(slaTrackers.sourceId, source.sourceId)
  )).limit(1);
  if (!existing) throw new Error("SLA_TRACKER_UPSERT_FAILED");
  const [updated] = await database.update(slaTrackers).set({
    handledAt: source.handledAt ?? existing.handledAt,
    updatedAt: now
  }).where(eq(slaTrackers.id, existing.id)).returning();
  return updated ?? existing;
}

export async function listDueSlaTrackers(now: Date, limit = 100) {
  return db.select().from(slaTrackers).where(and(
    isNull(slaTrackers.handledAt),
    lte(slaTrackers.nextEscalationAt, now)
  )).orderBy(slaTrackers.nextEscalationAt, slaTrackers.id).limit(limit);
}
