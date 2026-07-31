import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  slaTrackers,
  transactionParticipants
} from "@/server/db/schema";
import { notificationPayloadHash } from "@/server/notifications/factory";
import { createNotificationIntent } from "@/server/notifications/repository";

const DAY_MS = 24 * 60 * 60 * 1000;

function participantRolesForSla(slaType: string): Array<"BUYER" | "SELLER"> {
  if (slaType === "PAYOUT") return ["SELLER"];
  if (["REFUND", "CONFIRMATION_REMINDER", "CONFIRMATION_OVERDUE"].includes(slaType)) {
    return ["BUYER"];
  }
  if (["SPLIT", "CANCELLATION_RECONCILIATION", "CANCELLATION_RESPONSE"].includes(slaType)) {
    return ["BUYER", "SELLER"];
  }
  return [];
}

export async function escalateSlaTracker(
  trackerId: string,
  now: Date,
  correlationId: string
): Promise<boolean> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM sla_trackers WHERE id = ${trackerId} FOR UPDATE`);
    const [tracker] = await tx.select().from(slaTrackers).where(and(
      eq(slaTrackers.id, trackerId),
      isNull(slaTrackers.handledAt)
    )).limit(1);
    if (!tracker || tracker.nextEscalationAt.getTime() > now.getTime()) return false;
    const sequence = tracker.escalationCount + 1;
    const occurrenceKey = `ESCALATION:${sequence}`;
    const payloadSnapshotHash = notificationPayloadHash({
      trackerId: tracker.id,
      slaType: tracker.slaType,
      targetAt: tracker.targetAt.toISOString(),
      sequence
    });
    const roles = participantRolesForSla(tracker.slaType);
    if (roles.length) {
      const participants = await tx.select().from(transactionParticipants).where(and(
        eq(transactionParticipants.transactionId, tracker.transactionId),
        inArray(transactionParticipants.role, roles)
      ));
      for (const participant of participants) {
        await createNotificationIntent(tx, {
          transactionId: tracker.transactionId,
          notificationType: `${tracker.slaType}_SLA_ESCALATION`,
          sourceType: "SLA_TRACKER",
          sourceId: tracker.id,
          recipientScope: `ACCOUNT:${participant.accountId}`,
          recipientAccountId: participant.accountId,
          channel: "IN_APP",
          occurrenceKey,
          payloadSnapshotHash,
          correlationId
        }, now);
      }
    }
    await createNotificationIntent(tx, {
      transactionId: tracker.transactionId,
      notificationType: `${tracker.slaType}_SLA_ESCALATION`,
      sourceType: "SLA_TRACKER",
      sourceId: tracker.id,
      recipientScope: "ADMIN:SLA_NOTIFICATION_REVIEW",
      recipientAccountId: null,
      channel: "IN_APP",
      occurrenceKey,
      payloadSnapshotHash,
      correlationId
    }, now);
    const [updated] = await tx.update(slaTrackers).set({
      escalationCount: sequence,
      lastEscalatedAt: now,
      nextEscalationAt: new Date(now.getTime() + DAY_MS),
      updatedAt: now
    }).where(and(
      eq(slaTrackers.id, tracker.id),
      eq(slaTrackers.escalationCount, tracker.escalationCount),
      isNull(slaTrackers.handledAt)
    )).returning({ id: slaTrackers.id });
    return Boolean(updated);
  });
}
