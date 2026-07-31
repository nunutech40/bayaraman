import { randomUUID } from "node:crypto";
import { and, eq, isNull, lte } from "drizzle-orm";
import { db } from "@/server/db";
import { confirmationLinks, transactions } from "@/server/db/schema";
import { notificationPayloadHash } from "@/server/notifications/factory";
import { createNotificationIntent } from "@/server/notifications/repository";
import { recordTransactionEvent } from "@/server/transaction/audit";

type SweepContext = { correlationId?: string; jobRunId?: string };

export async function runConfirmationReminderSweep(
  now = new Date(),
  context?: SweepContext
) {
  const rows = await db.select({
    id: confirmationLinks.id,
    transactionId: confirmationLinks.transactionId,
    buyerAccountId: confirmationLinks.buyerAccountId,
    reminderDueAt: confirmationLinks.reminderDueAt
  }).from(confirmationLinks)
    .innerJoin(transactions, eq(transactions.id, confirmationLinks.transactionId))
    .where(and(
      eq(transactions.state, "WAITING_BUYER_CONFIRMATION"),
      lte(confirmationLinks.reminderDueAt, now),
      isNull(confirmationLinks.reminderQueuedAt),
      isNull(confirmationLinks.reminderRecordedAt)
    )).limit(100);

  let marked = 0;
  for (const row of rows) {
    const changed = await db.transaction(async (tx) => {
      const [updated] = await tx.update(confirmationLinks).set({
        reminderQueuedAt: now
      }).where(and(
        eq(confirmationLinks.id, row.id),
        isNull(confirmationLinks.reminderQueuedAt),
        isNull(confirmationLinks.reminderRecordedAt)
      )).returning({ id: confirmationLinks.id });
      if (!updated) return false;

      const correlationId = context?.correlationId ?? randomUUID();
      const payloadSnapshotHash = notificationPayloadHash({
        confirmationLinkId: row.id,
        reminderDueAt: row.reminderDueAt.toISOString()
      });
      for (const channel of ["IN_APP", "WHATSAPP"] as const) {
        await createNotificationIntent(tx, {
          transactionId: row.transactionId,
          notificationType: "BUYER_CONFIRMATION_REMINDER",
          sourceType: "CONFIRMATION_LINK",
          sourceId: row.id,
          recipientScope: `ACCOUNT:${row.buyerAccountId}`,
          recipientAccountId: row.buyerAccountId,
          channel,
          occurrenceKey: "ONCE",
          payloadSnapshotHash,
          correlationId,
          nextAttemptAt: now
        }, now);
      }
      await recordTransactionEvent(tx, {
        transactionId: row.transactionId,
        systemActorName: "confirmation-reminder",
        eventType: "BUYER_CONFIRMATION_REMINDER_QUEUED",
        correlationId,
        payload: {
          reminderDueAt: row.reminderDueAt.toISOString(),
          jobRunId: context?.jobRunId ?? null
        }
      });
      return true;
    });
    if (changed) marked += 1;
  }
  return {
    command: "CONFIRMATION_REMINDER_SWEEP",
    marked,
    evaluatedAt: now.toISOString()
  };
}

export async function runConfirmationOverdueSweep(
  now = new Date(),
  context?: SweepContext
) {
  const rows = await db.select({
    linkId: confirmationLinks.id,
    buyerAccountId: confirmationLinks.buyerAccountId,
    transactionId: confirmationLinks.transactionId,
    stateVersion: transactions.stateVersion
  }).from(confirmationLinks)
    .innerJoin(transactions, eq(transactions.id, confirmationLinks.transactionId))
    .where(and(
      eq(transactions.state, "WAITING_BUYER_CONFIRMATION"),
      lte(confirmationLinks.expiresAt, now),
      isNull(confirmationLinks.overdueAt)
    )).limit(100);

  let transitioned = 0;
  for (const row of rows) {
    const changed = await db.transaction(async (tx) => {
      const [updated] = await tx.update(transactions).set({
        state: "BUYER_CONFIRMATION_OVERDUE",
        stateVersion: row.stateVersion + 1,
        updatedAt: now
      }).where(and(
        eq(transactions.id, row.transactionId),
        eq(transactions.state, "WAITING_BUYER_CONFIRMATION"),
        eq(transactions.stateVersion, row.stateVersion)
      )).returning({ id: transactions.id });
      if (!updated) return false;

      await tx.update(confirmationLinks).set({ overdueAt: now }).where(and(
        eq(confirmationLinks.id, row.linkId),
        isNull(confirmationLinks.overdueAt)
      ));
      const correlationId = context?.correlationId ?? randomUUID();
      await createNotificationIntent(tx, {
        transactionId: row.transactionId,
        notificationType: "BUYER_CONFIRMATION_OVERDUE",
        sourceType: "CONFIRMATION_LINK",
        sourceId: row.linkId,
        recipientScope: `ACCOUNT:${row.buyerAccountId}`,
        recipientAccountId: row.buyerAccountId,
        channel: "IN_APP",
        occurrenceKey: "ONCE",
        payloadSnapshotHash: notificationPayloadHash({
          confirmationLinkId: row.linkId,
          overdueAt: now.toISOString()
        }),
        correlationId
      }, now);
      await recordTransactionEvent(tx, {
        transactionId: row.transactionId,
        systemActorName: "confirmation-overdue",
        eventType: "BUYER_CONFIRMATION_OVERDUE",
        beforeState: "WAITING_BUYER_CONFIRMATION",
        afterState: "BUYER_CONFIRMATION_OVERDUE",
        stateVersion: row.stateVersion + 1,
        correlationId,
        payload: {
          expiredAt: now.toISOString(),
          jobRunId: context?.jobRunId ?? null
        }
      });
      return true;
    });
    if (changed) transitioned += 1;
  }
  return {
    command: "CONFIRMATION_OVERDUE_SWEEP",
    transitioned,
    evaluatedAt: now.toISOString()
  };
}
