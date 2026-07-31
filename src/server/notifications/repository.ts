import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  confirmationLinks,
  notificationAttempts,
  notifications
} from "@/server/db/schema";
import { recordTransactionEvent } from "@/server/transaction/audit";
import {
  notificationIntentSchema,
  type NotificationDeliveryResult,
  type NotificationIntentInput
} from "./contracts";

const LEASE_MS = 5 * 60 * 1000;
const RETRY_DELAY_MS = 60 * 1000;

function leaseHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createNotificationIntent(
  database: any,
  unsafeInput: NotificationIntentInput,
  now = new Date()
) {
  const input = notificationIntentSchema.parse(unsafeInput);
  if (input.recipientScope.startsWith("ACCOUNT:") &&
      input.recipientScope !== `ACCOUNT:${input.recipientAccountId}`) {
    throw new Error("NOTIFICATION_RECIPIENT_SCOPE_INVALID");
  }
  const isInApp = input.channel === "IN_APP";
  const [inserted] = await database.insert(notifications).values({
    transactionId: input.transactionId,
    notificationType: input.notificationType,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    recipientScope: input.recipientScope,
    recipientAccountId: input.recipientAccountId,
    channel: input.channel,
    occurrenceKey: input.occurrenceKey,
    payloadSnapshotHash: input.payloadSnapshotHash,
    status: isInApp ? "SENT" : "PENDING",
    attemptCount: isInApp ? 1 : 0,
    nextAttemptAt: isInApp ? null : (input.nextAttemptAt ?? now),
    lastAttemptAt: isInApp ? now : null,
    sentAt: isInApp ? now : null,
    correlationId: input.correlationId,
    createdAt: now,
    updatedAt: now
  }).onConflictDoNothing().returning();
  const notification = inserted ?? (await database.select().from(notifications).where(and(
    eq(notifications.notificationType, input.notificationType),
    eq(notifications.sourceType, input.sourceType),
    eq(notifications.sourceId, input.sourceId),
    eq(notifications.recipientScope, input.recipientScope),
    eq(notifications.channel, input.channel),
    eq(notifications.occurrenceKey, input.occurrenceKey)
  )).limit(1))[0];
  if (!notification) throw new Error("NOTIFICATION_INTENT_CREATE_FAILED");
  if (inserted && isInApp) {
    await database.insert(notificationAttempts).values({
      notificationId: notification.id,
      attemptNumber: 1,
      eventType: "DELIVERY_RESULT",
      result: "SENT",
      providerReference: `IN_APP:${notification.id}`,
      correlationId: input.correlationId,
      attemptedAt: now
    });
  }
  return notification;
}

export async function claimNextWhatsappNotification(now = new Date()) {
  return db.transaction(async (tx) => {
    const result = await tx.execute(sql`
      SELECT id FROM notifications
      WHERE channel = 'WHATSAPP'
        AND status <> 'SENT'
        AND final_failure_at IS NULL
        AND attempt_count < 3
        AND (
          (lease_expires_at IS NULL AND (next_attempt_at IS NULL OR next_attempt_at <= ${now}))
          OR lease_expires_at <= ${now}
        )
      ORDER BY COALESCE(next_attempt_at, created_at), id
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `);
    const id = (result.rows[0] as { id?: string } | undefined)?.id;
    if (!id) return null;
    const [current] = await tx.select().from(notifications).where(eq(notifications.id, id)).limit(1);
    if (!current) return null;

    let attemptCount = current.attemptCount;
    if (current.activeAttemptNumber !== null &&
        current.leaseExpiresAt &&
        current.leaseExpiresAt.getTime() <= now.getTime()) {
      await tx.insert(notificationAttempts).values({
        notificationId: current.id,
        attemptNumber: current.activeAttemptNumber,
        eventType: "DELIVERY_RESULT",
        result: "UNKNOWN",
        errorCategory: "STALE_LEASE",
        correlationId: current.correlationId,
        attemptedAt: now
      }).onConflictDoNothing();
      if (attemptCount >= 3) {
        await tx.update(notifications).set({
          status: "UNKNOWN",
          activeAttemptNumber: null,
          leaseOwnerHash: null,
          leaseExpiresAt: null,
          finalFailureAt: now,
          updatedAt: now,
          notificationVersion: current.notificationVersion + 1
        }).where(eq(notifications.id, current.id));
        return null;
      }
    }

    const nextAttempt = attemptCount + 1;
    if (nextAttempt > 3) return null;
    const leaseToken = randomBytes(32).toString("hex");
    const ownerHash = leaseHash(leaseToken);
    const leaseExpiresAt = new Date(now.getTime() + LEASE_MS);
    const [claimed] = await tx.update(notifications).set({
      attemptCount: nextAttempt,
      activeAttemptNumber: nextAttempt,
      leaseOwnerHash: ownerHash,
      leaseExpiresAt,
      lastAttemptAt: now,
      nextAttemptAt: null,
      notificationVersion: current.notificationVersion + 1,
      updatedAt: now
    }).where(and(
      eq(notifications.id, current.id),
      eq(notifications.notificationVersion, current.notificationVersion)
    )).returning();
    if (!claimed) return null;
    return {
      notification: claimed,
      leaseToken,
      version: claimed.notificationVersion,
      attemptNumber: nextAttempt
    };
  });
}

export async function finalizeWhatsappNotification(input: {
  notificationId: string;
  version: number;
  attemptNumber: number;
  leaseToken: string;
  result: Exclude<NotificationDeliveryResult, "PENDING">;
  providerReference?: string;
  errorCategory?: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM notifications WHERE id = ${input.notificationId} FOR UPDATE`);
    const [current] = await tx.select().from(notifications)
      .where(eq(notifications.id, input.notificationId)).limit(1);
    if (!current) throw new Error("NOTIFICATION_NOT_FOUND");
    const matches = current.notificationVersion === input.version &&
      current.activeAttemptNumber === input.attemptNumber &&
      current.leaseOwnerHash === leaseHash(input.leaseToken) &&
      current.leaseExpiresAt !== null &&
      current.leaseExpiresAt.getTime() > now.getTime();
    if (!matches) {
      await recordTransactionEvent(tx, {
        transactionId: current.transactionId,
        systemActorName: "notification-delivery",
        eventType: "NOTIFICATION_LATE_RESULT_REJECTED",
        correlationId: current.correlationId,
        payload: {
          notificationId: current.id,
          attemptNumber: input.attemptNumber,
          reason: "LEASE_OR_VERSION_MISMATCH"
        }
      });
      return { kind: "LATE_RESULT_REJECTED" as const };
    }

    const [attempt] = await tx.insert(notificationAttempts).values({
      notificationId: current.id,
      attemptNumber: input.attemptNumber,
      eventType: "DELIVERY_RESULT",
      result: input.result,
      providerReference: input.providerReference,
      errorCategory: input.errorCategory,
      correlationId: current.correlationId,
      attemptedAt: now
    }).returning({ id: notificationAttempts.id });
    if (!attempt) throw new Error("NOTIFICATION_ATTEMPT_CREATE_FAILED");
    const sent = input.result === "SENT";
    const finalFailure = !sent && current.attemptCount >= 3;
    const [updated] = await tx.update(notifications).set({
      status: input.result,
      activeAttemptNumber: null,
      leaseOwnerHash: null,
      leaseExpiresAt: null,
      nextAttemptAt: sent || finalFailure ? null : new Date(now.getTime() + RETRY_DELAY_MS),
      sentAt: sent ? now : null,
      finalFailureAt: finalFailure ? now : null,
      notificationVersion: current.notificationVersion + 1,
      updatedAt: now
    }).where(and(
      eq(notifications.id, current.id),
      eq(notifications.notificationVersion, input.version)
    )).returning();
    if (!updated) throw new Error("NOTIFICATION_FINALIZE_CONFLICT");

    if (sent &&
        current.notificationType === "BUYER_CONFIRMATION_REMINDER" &&
        current.sourceType === "CONFIRMATION_LINK") {
      await tx.update(confirmationLinks).set({
        reminderRecordedAt: now,
        reminderEvidenceReference: input.providerReference ?? attempt.id
      }).where(and(
        eq(confirmationLinks.id, current.sourceId),
        isNull(confirmationLinks.reminderRecordedAt)
      ));
    }
    return { kind: "FINALIZED" as const, notification: updated };
  });
}

export async function appendNotificationCorrection(input: {
  notificationId: string;
  correctedAttemptId: string;
  reason: string;
  correlationId?: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (!input.reason.trim()) throw new Error("NOTIFICATION_CORRECTION_REASON_REQUIRED");
  const [target] = await db.select({ id: notificationAttempts.id })
    .from(notificationAttempts)
    .where(and(
      eq(notificationAttempts.id, input.correctedAttemptId),
      eq(notificationAttempts.notificationId, input.notificationId),
      eq(notificationAttempts.eventType, "DELIVERY_RESULT")
    ))
    .limit(1);
  if (!target) throw new Error("NOTIFICATION_CORRECTION_TARGET_INVALID");
  const [correction] = await db.insert(notificationAttempts).values({
    notificationId: input.notificationId,
    attemptNumber: null,
    eventType: "CORRECTION",
    result: null,
    correctedAttemptId: input.correctedAttemptId,
    correctionReason: input.reason.trim(),
    correlationId: input.correlationId ?? randomUUID(),
    attemptedAt: now
  }).returning();
  if (!correction) throw new Error("NOTIFICATION_CORRECTION_FAILED");
  return correction;
}

export async function readFinalNotificationFailures(transactionIds?: string[]) {
  return db.select({
    id: notifications.id,
    transactionId: notifications.transactionId,
    notificationType: notifications.notificationType,
    channel: notifications.channel,
    attemptCount: notifications.attemptCount,
    finalFailureAt: notifications.finalFailureAt
  }).from(notifications).where(and(
    sql`${notifications.finalFailureAt} IS NOT NULL`,
    transactionIds?.length ? inArray(notifications.transactionId, transactionIds) : undefined
  ));
}
