import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { runConfirmationReminderSweep } from "@/server/confirmation/recovery";
import { claimJobRun, completeJobRun } from "@/server/jobs/repository";
import {
  appendNotificationCorrection,
  claimNextWhatsappNotification,
  createNotificationIntent,
  finalizeWhatsappNotification
} from "@/server/notifications/repository";
import { notificationPayloadHash } from "@/server/notifications/factory";
import { db } from "@/server/db";
import { escalateSlaTracker } from "@/server/sla/service";
import { readSlaTasks } from "@/server/sla/projection";

const connectionString = process.env.TEST_DATABASE_URL;
const integration = connectionString ? describe : describe.skip;

integration("BAYAR-012 jobs, notifications, audit, and SLA", () => {
  let client: Client;
  const adminId = randomUUID();
  const buyerId = randomUUID();
  const sellerId = randomUUID();
  const transactionId = randomUUID();

  beforeAll(async () => {
    client = new Client({ connectionString });
    await client.connect();
    await client.query(
      `INSERT INTO accounts
       (id, email, display_name, whatsapp_number, whatsapp_verified_at, is_admin)
       VALUES
       ($1, $2, 'SLA Admin', $3, now(), true),
       ($4, $5, 'SLA Buyer', $6, now(), false),
       ($7, $8, 'SLA Seller', $9, now(), false)`,
      [
        adminId, `sla-admin-${adminId}@example.test`, `+62871${adminId.slice(0, 8)}`,
        buyerId, `sla-buyer-${buyerId}@example.test`, `+62872${buyerId.slice(0, 8)}`,
        sellerId, `sla-seller-${sellerId}@example.test`, `+62873${sellerId.slice(0, 8)}`
      ]
    );
    await client.query(
      `INSERT INTO admin_task_assignments
       (account_id, task_scope, assigned_by_account_id)
       VALUES ($1, 'SLA_NOTIFICATION_REVIEW', $1)`,
      [adminId]
    );
    await client.query(
      `INSERT INTO transactions
       (id, creator_account_id, creator_role, state, state_version)
       VALUES ($1, $2, 'SELLER', 'WAITING_BUYER_CONFIRMATION', 0)`,
      [transactionId, sellerId]
    );
    await client.query(
      `INSERT INTO transaction_participants
       (transaction_id, account_id, role, name_snapshot, whatsapp_snapshot, joined_at)
       VALUES
       ($1, $2, 'BUYER', 'SLA Buyer', '+628720001', now()),
       ($1, $3, 'SELLER', 'SLA Seller', '+628730001', now())`,
      [transactionId, buyerId, sellerId]
    );
  });

  afterAll(async () => {
    await client.end();
  });

  it("keeps job idempotency terminal and rejects conflicting request hashes", async () => {
    const idempotencyKey = `job-${randomUUID()}`;
    const now = new Date("2026-07-31T10:00:00.000Z");
    const first = await claimJobRun({
      jobName: "payment-reconciliation-sla",
      idempotencyKey,
      requestHash: "hash-one",
      scheduledFor: now,
      now
    });
    expect(first.kind).toBe("claimed");
    if (first.kind !== "claimed") return;
    const active = await claimJobRun({
      jobName: "payment-reconciliation-sla",
      idempotencyKey,
      requestHash: "hash-one",
      scheduledFor: now,
      now
    });
    expect(active.kind).toBe("active");
    const completed = await completeJobRun({
      jobRunId: first.projection.jobRunId,
      leaseToken: first.leaseToken,
      runVersion: first.runVersion,
      result: "SUCCESS",
      payload: { evaluated: 0 },
      now
    });
    expect(completed.status).toBe("SUCCESS");
    const replay = await claimJobRun({
      jobName: "payment-reconciliation-sla",
      idempotencyKey,
      requestHash: "hash-one",
      scheduledFor: now,
      now
    });
    expect(replay.kind).toBe("terminal");
    await expect(claimJobRun({
      jobName: "payment-reconciliation-sla",
      idempotencyKey,
      requestHash: "different",
      scheduledFor: now,
      now
    })).rejects.toThrow("JOB_IDEMPOTENCY_CONFLICT");
  });

  it("reclaims only stale RUNNING work and preserves UNKNOWN attempt evidence", async () => {
    const idempotencyKey = `stale-${randomUUID()}`;
    const startedAt = new Date("2026-07-31T00:00:00.000Z");
    const first = await claimJobRun({
      jobName: "notification-delivery",
      idempotencyKey,
      requestHash: "stale-hash",
      scheduledFor: startedAt,
      now: startedAt
    });
    expect(first.kind).toBe("claimed");
    const reclaimed = await claimJobRun({
      jobName: "notification-delivery",
      idempotencyKey,
      requestHash: "stale-hash",
      scheduledFor: startedAt,
      now: new Date(startedAt.getTime() + 5 * 60 * 1000 + 1)
    });
    expect(reclaimed.kind).toBe("claimed");
    if (reclaimed.kind !== "claimed") return;
    expect(reclaimed.projection.attemptCount).toBe(2);
    const evidence = await client.query(
      `SELECT result FROM job_run_attempts
       WHERE job_run_id = $1 AND attempt_number = 1`,
      [reclaimed.projection.jobRunId]
    );
    expect(evidence.rows[0].result).toBe("UNKNOWN");
    await completeJobRun({
      jobRunId: reclaimed.projection.jobRunId,
      leaseToken: reclaimed.leaseToken,
      runVersion: reclaimed.runVersion,
      result: "SUCCESS",
      payload: { processed: 0 },
      now: new Date(startedAt.getTime() + 5 * 60 * 1000 + 2)
    });
  });

  it("records IN_APP delivery atomically and rejects immutable attempt mutation", async () => {
    const notification = await db.transaction((tx) => createNotificationIntent(tx, {
      transactionId,
      notificationType: "PAYMENT_EXPIRED",
      sourceType: "TEST",
      sourceId: randomUUID(),
      recipientScope: `ACCOUNT:${buyerId}`,
      recipientAccountId: buyerId,
      channel: "IN_APP",
      occurrenceKey: "ONCE",
      payloadSnapshotHash: notificationPayloadHash({ transactionId }),
      correlationId: randomUUID()
    }));
    expect(notification.status).toBe("SENT");
    const attempt = await client.query(
      "SELECT id, result FROM notification_attempts WHERE notification_id = $1",
      [notification.id]
    );
    expect(attempt.rows).toHaveLength(1);
    expect(attempt.rows[0].result).toBe("SENT");
    await expect(client.query(
      "UPDATE notification_attempts SET result = 'FAILED' WHERE id = $1",
      [attempt.rows[0].id]
    )).rejects.toThrow(/append-only/);
  });

  it("binds correction evidence to an attempt from the same notification", async () => {
    const createInApp = (sourceId: string) => db.transaction((tx) =>
      createNotificationIntent(tx, {
        transactionId,
        notificationType: "CORRECTION_TARGET_TEST",
        sourceType: "TEST",
        sourceId,
        recipientScope: `ACCOUNT:${buyerId}`,
        recipientAccountId: buyerId,
        channel: "IN_APP",
        occurrenceKey: "ONCE",
        payloadSnapshotHash: notificationPayloadHash({ sourceId }),
        correlationId: randomUUID()
      }));
    const first = await createInApp(randomUUID());
    const second = await createInApp(randomUUID());
    const target = await client.query(
      "SELECT id FROM notification_attempts WHERE notification_id = $1",
      [first.id]
    );
    await expect(appendNotificationCorrection({
      notificationId: second.id,
      correctedAttemptId: target.rows[0].id,
      reason: "Wrong notification target"
    })).rejects.toThrow("NOTIFICATION_CORRECTION_TARGET_INVALID");
    const correction = await appendNotificationCorrection({
      notificationId: first.id,
      correctedAttemptId: target.rows[0].id,
      reason: "Corrected delivery annotation"
    });
    expect(correction.eventType).toBe("CORRECTION");
    expect(correction.attemptNumber).toBeNull();
  });

  it("finalizes WhatsApp only for the active version and lease", async () => {
    const now = new Date("2000-01-01T00:00:00.000Z");
    const notification = await db.transaction((tx) => createNotificationIntent(tx, {
      transactionId,
      notificationType: "BUYER_CONFIRMATION_REMINDER_TEST",
      sourceType: "TEST",
      sourceId: randomUUID(),
      recipientScope: `ACCOUNT:${buyerId}`,
      recipientAccountId: buyerId,
      channel: "WHATSAPP",
      occurrenceKey: "ONCE",
      payloadSnapshotHash: notificationPayloadHash({ transactionId, channel: "WHATSAPP" }),
      correlationId: randomUUID(),
      nextAttemptAt: now
    }, now));
    const claim = await claimNextWhatsappNotification(now);
    expect(claim?.notification.id).toBe(notification.id);
    if (!claim) return;
    const rejected = await finalizeWhatsappNotification({
      notificationId: claim.notification.id,
      version: claim.version,
      attemptNumber: claim.attemptNumber,
      leaseToken: "wrong-lease",
      result: "SENT",
      now: new Date(now.getTime() + 1)
    });
    expect(rejected.kind).toBe("LATE_RESULT_REJECTED");
    const finalized = await finalizeWhatsappNotification({
      notificationId: claim.notification.id,
      version: claim.version,
      attemptNumber: claim.attemptNumber,
      leaseToken: claim.leaseToken,
      result: "SENT",
      providerReference: "fake-provider-reference",
      now: new Date(now.getTime() + 2)
    });
    expect(finalized.kind).toBe("FINALIZED");
    if (finalized.kind === "FINALIZED") expect(finalized.notification.status).toBe("SENT");
  });

  it("caps WhatsApp delivery at three immutable attempts", async () => {
    const start = new Date("2001-01-01T00:00:00.000Z");
    const notification = await db.transaction((tx) => createNotificationIntent(tx, {
      transactionId,
      notificationType: "DELIVERY_CAP_TEST",
      sourceType: "TEST",
      sourceId: randomUUID(),
      recipientScope: `ACCOUNT:${buyerId}`,
      recipientAccountId: buyerId,
      channel: "WHATSAPP",
      occurrenceKey: "ONCE",
      payloadSnapshotHash: notificationPayloadHash({ transactionId, cap: 3 }),
      correlationId: randomUUID(),
      nextAttemptAt: start
    }, start));
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const now = new Date(start.getTime() + (attempt - 1) * 61_000);
      const claim = await claimNextWhatsappNotification(now);
      expect(claim?.notification.id).toBe(notification.id);
      if (!claim) return;
      const result = await finalizeWhatsappNotification({
        notificationId: claim.notification.id,
        version: claim.version,
        attemptNumber: claim.attemptNumber,
        leaseToken: claim.leaseToken,
        result: "FAILED",
        errorCategory: "TEST_FAILURE",
        now: new Date(now.getTime() + 1)
      });
      expect(result.kind).toBe("FINALIZED");
    }
    const stored = await client.query(
      `SELECT attempt_count, final_failure_at
       FROM notifications WHERE id = $1`,
      [notification.id]
    );
    expect(stored.rows[0].attempt_count).toBe(3);
    expect(stored.rows[0].final_failure_at).not.toBeNull();
    const attempts = await client.query(
      `SELECT attempt_number FROM notification_attempts
       WHERE notification_id = $1 AND event_type = 'DELIVERY_RESULT'
       ORDER BY attempt_number`,
      [notification.id]
    );
    expect(attempts.rows.map((row) => row.attempt_number)).toEqual([1, 2, 3]);
  });

  it("queues reminder separately from delivery truth", async () => {
    const linkId = randomUUID();
    const due = new Date("2026-07-31T09:00:00.000Z");
    await client.query(
      `INSERT INTO confirmation_links
       (id, transaction_id, buyer_account_id, token_hash, buyer_whatsapp_snapshot,
        expires_at, reminder_due_at, idempotency_key)
       VALUES ($1, $2, $3, $4, '+628720001', $5, $6, $7)`,
      [
        linkId, transactionId, buyerId, `hash-${linkId}`,
        new Date("2026-08-01T10:00:00.000Z"), due, `link-${linkId}`
      ]
    );
    const result = await runConfirmationReminderSweep(
      new Date("2026-07-31T10:00:00.000Z"),
      { correlationId: randomUUID(), jobRunId: randomUUID() }
    );
    expect(result.marked).toBeGreaterThanOrEqual(1);
    const stored = await client.query(
      `SELECT reminder_queued_at, reminder_recorded_at
       FROM confirmation_links WHERE id = $1`,
      [linkId]
    );
    expect(stored.rows[0].reminder_queued_at).not.toBeNull();
    expect(stored.rows[0].reminder_recorded_at).toBeNull();
  });

  it("does not queue a reminder already recorded manually", async () => {
    const linkId = randomUUID();
    const manualTransactionId = randomUUID();
    const recordedAt = new Date("2026-07-31T08:00:00.000Z");
    await client.query(
      `INSERT INTO transactions
       (id, creator_account_id, creator_role, state, state_version)
       VALUES ($1, $2, 'SELLER', 'WAITING_BUYER_CONFIRMATION', 0)`,
      [manualTransactionId, sellerId]
    );
    await client.query(
      `INSERT INTO transaction_participants
       (transaction_id, account_id, role, name_snapshot, whatsapp_snapshot, joined_at)
       VALUES
       ($1, $2, 'BUYER', 'SLA Buyer', '+628720001', now()),
       ($1, $3, 'SELLER', 'SLA Seller', '+628730001', now())`,
      [manualTransactionId, buyerId, sellerId]
    );
    await client.query(
      `INSERT INTO confirmation_links
       (id, transaction_id, buyer_account_id, token_hash, buyer_whatsapp_snapshot,
        expires_at, reminder_due_at, reminder_recorded_at,
        reminder_evidence_reference, idempotency_key)
       VALUES ($1, $2, $3, $4, '+628720001', $5, $6, $7, $8, $9)`,
      [
        linkId, manualTransactionId, buyerId, `hash-${linkId}`,
        new Date("2026-08-01T10:00:00.000Z"),
        new Date("2026-07-31T07:00:00.000Z"),
        recordedAt, `manual:${linkId}`, `link-${linkId}`
      ]
    );
    await runConfirmationReminderSweep(new Date("2026-07-31T10:00:00.000Z"));
    const stored = await client.query(
      "SELECT reminder_queued_at FROM confirmation_links WHERE id = $1",
      [linkId]
    );
    expect(stored.rows[0].reminder_queued_at).toBeNull();
  });

  it("allocates recurring escalation occurrences atomically and enforces Admin assignment", async () => {
    const trackerId = randomUUID();
    const target = new Date("2026-07-30T10:00:00.000Z");
    await client.query(
      `INSERT INTO sla_trackers
       (id, transaction_id, sla_type, source_type, source_id, started_at,
        target_at, next_escalation_at)
       VALUES ($1, $2, 'REFUND', 'TEST', $3, $4, $4, $4)`,
      [trackerId, transactionId, randomUUID(), target]
    );
    const first = await escalateSlaTracker(
      trackerId,
      new Date("2026-07-31T10:00:00.000Z"),
      randomUUID()
    );
    const duplicate = await escalateSlaTracker(
      trackerId,
      new Date("2026-07-31T10:00:00.000Z"),
      randomUUID()
    );
    const second = await escalateSlaTracker(
      trackerId,
      new Date("2026-08-01T10:00:00.001Z"),
      randomUUID()
    );
    expect(first).toBe(true);
    expect(duplicate).toBe(false);
    expect(second).toBe(true);
    const occurrences = await client.query(
      `SELECT DISTINCT occurrence_key FROM notifications
       WHERE source_type = 'SLA_TRACKER' AND source_id = $1
       ORDER BY occurrence_key`,
      [trackerId]
    );
    expect(occurrences.rows.map((row) => row.occurrence_key))
      .toEqual(["ESCALATION:1", "ESCALATION:2"]);
    const projection = await readSlaTasks(
      { id: adminId, isAdmin: true },
      { domain: "FINANCIAL", status: "OVERDUE", limit: 30 },
      new Date("2026-08-01T10:00:00.001Z")
    );
    expect(projection.items.some((item) => item.trackerId === trackerId)).toBe(true);
    await expect(readSlaTasks(
      { id: buyerId, isAdmin: false },
      { domain: "FINANCIAL" }
    )).rejects.toThrow("FORBIDDEN");
  });
});
