import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { jobRunAttempts, jobRuns } from "@/server/db/schema";
import type { JobName, JobResult } from "./contracts";

const JOB_LEASE_MS = 5 * 60 * 1000;

function hashLease(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sanitizeErrorCategory(error: unknown): string {
  if (!(error instanceof Error)) return "JOB_EXECUTION_FAILED";
  const normalized = error.message.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  return normalized.slice(0, 100) || "JOB_EXECUTION_FAILED";
}

export type JobRunProjection = {
  jobRunId: string;
  jobName: string;
  status: "RUNNING" | "SUCCESS" | "FAILED";
  correlationId: string;
  attemptCount: number;
  scheduledFor: string;
  result: unknown;
  errorCategory: string | null;
};

export type ClaimedJob =
  | { kind: "claimed"; projection: JobRunProjection; leaseToken: string; runVersion: number }
  | { kind: "active" | "terminal"; projection: JobRunProjection };

function project(row: typeof jobRuns.$inferSelect): JobRunProjection {
  return {
    jobRunId: row.id,
    jobName: row.jobName,
    status: row.status as JobRunProjection["status"],
    correlationId: row.correlationId,
    attemptCount: row.attemptCount,
    scheduledFor: row.scheduledFor.toISOString(),
    result: row.result ?? null,
    errorCategory: row.errorCategory ?? null
  };
}

export async function claimJobRun(input: {
  jobName: JobName;
  idempotencyKey: string;
  requestHash: string;
  scheduledFor: Date;
  now?: Date;
}): Promise<ClaimedJob> {
  const now = input.now ?? new Date();
  const leaseToken = randomBytes(32).toString("hex");
  const leaseOwnerHash = hashLease(leaseToken);
  const leaseExpiresAt = new Date(now.getTime() + JOB_LEASE_MS);
  const id = randomUUID();
  const correlationId = randomUUID();

  return db.transaction(async (tx) => {
    await tx.insert(jobRuns).values({
      id,
      jobName: input.jobName,
      idempotencyKey: input.idempotencyKey,
      requestHash: input.requestHash,
      correlationId,
      status: "RUNNING",
      runVersion: 0,
      attemptCount: 1,
      scheduledFor: input.scheduledFor,
      leaseOwnerHash,
      leaseExpiresAt,
      startedAt: now,
      createdAt: now,
      updatedAt: now
    }).onConflictDoNothing();

    await tx.execute(sql`
      SELECT id FROM job_runs
      WHERE job_name = ${input.jobName}
        AND idempotency_key = ${input.idempotencyKey}
      FOR UPDATE
    `);
    const [row] = await tx.select().from(jobRuns).where(and(
      eq(jobRuns.jobName, input.jobName),
      eq(jobRuns.idempotencyKey, input.idempotencyKey)
    )).limit(1);
    if (!row) throw new Error("JOB_CLAIM_FAILED");
    if (row.requestHash !== input.requestHash) throw new Error("JOB_IDEMPOTENCY_CONFLICT");
    if (row.status === "SUCCESS" || row.status === "FAILED") {
      return { kind: "terminal" as const, projection: project(row) };
    }
    if (row.id !== id && row.leaseExpiresAt && row.leaseExpiresAt.getTime() > now.getTime()) {
      return { kind: "active" as const, projection: project(row) };
    }
    if (row.id !== id) {
      await tx.insert(jobRunAttempts).values({
        jobRunId: row.id,
        attemptNumber: row.attemptCount,
        result: "UNKNOWN",
        startedAt: row.startedAt,
        completedAt: now,
        leaseOwnerHash: row.leaseOwnerHash ?? "unknown",
        errorCategory: "STALE_LEASE",
        correlationId: row.correlationId
      }).onConflictDoNothing();
      const [reclaimed] = await tx.update(jobRuns).set({
        runVersion: row.runVersion + 1,
        attemptCount: row.attemptCount + 1,
        leaseOwnerHash,
        leaseExpiresAt,
        startedAt: now,
        updatedAt: now,
        errorCategory: null
      }).where(and(
        eq(jobRuns.id, row.id),
        eq(jobRuns.status, "RUNNING"),
        eq(jobRuns.runVersion, row.runVersion),
        lt(jobRuns.leaseExpiresAt, now)
      )).returning();
      if (!reclaimed) throw new Error("JOB_CLAIM_RACE");
      return {
        kind: "claimed" as const,
        projection: project(reclaimed),
        leaseToken,
        runVersion: reclaimed.runVersion
      };
    }
    return {
      kind: "claimed" as const,
      projection: project(row),
      leaseToken,
      runVersion: row.runVersion
    };
  });
}

export async function completeJobRun(input: {
  jobRunId: string;
  leaseToken: string;
  runVersion: number;
  result: "SUCCESS" | "FAILED";
  payload?: JobResult;
  error?: unknown;
  now?: Date;
}): Promise<JobRunProjection> {
  const now = input.now ?? new Date();
  const leaseOwnerHash = hashLease(input.leaseToken);
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(jobRuns).where(eq(jobRuns.id, input.jobRunId)).limit(1);
    if (!row) throw new Error("JOB_RUN_NOT_FOUND");
    if (row.status !== "RUNNING" ||
        row.runVersion !== input.runVersion ||
        row.leaseOwnerHash !== leaseOwnerHash) {
      throw new Error("JOB_LEASE_LOST");
    }
    const errorCategory = input.result === "FAILED"
      ? sanitizeErrorCategory(input.error)
      : null;
    await tx.insert(jobRunAttempts).values({
      jobRunId: row.id,
      attemptNumber: row.attemptCount,
      result: input.result,
      startedAt: row.startedAt,
      completedAt: now,
      leaseOwnerHash,
      errorCategory,
      correlationId: row.correlationId
    });
    const [updated] = await tx.update(jobRuns).set({
      status: input.result,
      result: input.payload ?? null,
      errorCategory,
      completedAt: now,
      leaseOwnerHash: null,
      leaseExpiresAt: null,
      updatedAt: now
    }).where(and(
      eq(jobRuns.id, row.id),
      eq(jobRuns.status, "RUNNING"),
      eq(jobRuns.runVersion, input.runVersion),
      eq(jobRuns.leaseOwnerHash, leaseOwnerHash)
    )).returning();
    if (!updated) throw new Error("JOB_LEASE_LOST");
    return project(updated);
  });
}
