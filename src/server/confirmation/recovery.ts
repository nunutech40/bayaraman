import { and, eq, isNull, lte, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { confirmationLinks, transactions } from "@/server/db/schema";
import { recordTransactionEvent } from "@/server/transaction/audit";
import { findIdempotentResult, saveIdempotentResult } from "@/server/transaction/mutation";

export async function runConfirmationReminderSweep(now = new Date()) {
  return db.transaction(async (tx) => {
    const command = "CONFIRMATION_REMINDER_SWEEP";
    const key = `sweep:${now.toISOString().slice(0, 13)}`;
    const requestHash = now.toISOString();
    const prior = await findIdempotentResult(tx, "SYSTEM:confirmation-reminder", command, key, requestHash);
    if (prior) return prior;
    const rows = await tx.select({ id: confirmationLinks.id, transactionId: confirmationLinks.transactionId })
      .from(confirmationLinks)
      .innerJoin(transactions, eq(transactions.id, confirmationLinks.transactionId))
      .where(and(
        eq(transactions.state, "WAITING_BUYER_CONFIRMATION"),
        lte(confirmationLinks.reminderDueAt, now),
        isNull(confirmationLinks.reminderRecordedAt)
      ));
    let marked = 0;
    for (const row of rows) {
      const updated = await tx.update(confirmationLinks).set({ reminderRecordedAt: now, reminderEvidenceReference: "SYSTEM_REMINDER_DUE" }).where(and(eq(confirmationLinks.id, row.id), isNull(confirmationLinks.reminderRecordedAt))).returning({ id: confirmationLinks.id });
      if (updated.length) {
        marked += 1;
        await recordTransactionEvent(tx, { transactionId: row.transactionId, eventType: "BUYER_CONFIRMATION_REMINDER_DUE", stateVersion: undefined, correlationId: randomUUID(), payload: { reminderDueAt: now.toISOString() } });
      }
    }
    const result = { command, marked, evaluatedAt: now.toISOString() };
    await saveIdempotentResult(tx, "SYSTEM:confirmation-reminder", command, key, requestHash, result);
    return result;
  });
}

export async function runConfirmationOverdueSweep(now = new Date()) {
  return db.transaction(async (tx) => {
    const command = "CONFIRMATION_OVERDUE_SWEEP";
    const key = `sweep:${now.toISOString().slice(0, 13)}`;
    const requestHash = now.toISOString();
    const prior = await findIdempotentResult(tx, "SYSTEM:confirmation-overdue", command, key, requestHash);
    if (prior) return prior;
    const rows = await tx.select({ linkId: confirmationLinks.id, transactionId: confirmationLinks.transactionId, stateVersion: transactions.stateVersion })
      .from(confirmationLinks)
      .innerJoin(transactions, eq(transactions.id, confirmationLinks.transactionId))
      .where(and(eq(transactions.state, "WAITING_BUYER_CONFIRMATION"), lte(confirmationLinks.expiresAt, now), isNull(confirmationLinks.overdueAt)));
    let transitioned = 0;
    for (const row of rows) {
      const updated = await tx.update(transactions).set({ state: "BUYER_CONFIRMATION_OVERDUE", stateVersion: row.stateVersion + 1, updatedAt: now }).where(and(eq(transactions.id, row.transactionId), eq(transactions.state, "WAITING_BUYER_CONFIRMATION"), eq(transactions.stateVersion, row.stateVersion))).returning({ id: transactions.id });
      if (updated.length) {
        await tx.update(confirmationLinks).set({ overdueAt: now }).where(and(eq(confirmationLinks.id, row.linkId), isNull(confirmationLinks.overdueAt)));
        transitioned += 1;
        await recordTransactionEvent(tx, { transactionId: row.transactionId, eventType: "BUYER_CONFIRMATION_OVERDUE", beforeState: "WAITING_BUYER_CONFIRMATION", afterState: "BUYER_CONFIRMATION_OVERDUE", stateVersion: row.stateVersion + 1, correlationId: randomUUID(), payload: { expiredAt: now.toISOString() } });
      }
    }
    const result = { command, transitioned, evaluatedAt: now.toISOString() };
    await saveIdempotentResult(tx, "SYSTEM:confirmation-overdue", command, key, requestHash, result);
    return result;
  });
}
