import { createHash } from "node:crypto";
import type { JobInvocation, JobName, JobResult } from "./contracts";
import { claimJobRun, completeJobRun, type JobRunProjection } from "./repository";

export function hashJobRequest(input: JobInvocation): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export async function runJob(input: {
  jobName: JobName;
  invocation: JobInvocation;
  idempotencyKey: string;
  execute: (context: {
    now: Date;
    correlationId: string;
    jobRunId: string;
  }) => Promise<JobResult>;
}): Promise<{ replayed: boolean; active: boolean; projection: JobRunProjection }> {
  const scheduledFor = new Date(input.invocation.scheduledFor);
  const claim = await claimJobRun({
    jobName: input.jobName,
    idempotencyKey: input.idempotencyKey,
    requestHash: hashJobRequest(input.invocation),
    scheduledFor
  });
  if (claim.kind !== "claimed") {
    return {
      replayed: claim.kind === "terminal",
      active: claim.kind === "active",
      projection: claim.projection
    };
  }
  try {
    const result = await input.execute({
      now: scheduledFor,
      correlationId: claim.projection.correlationId,
      jobRunId: claim.projection.jobRunId
    });
    return {
      replayed: false,
      active: false,
      projection: await completeJobRun({
        jobRunId: claim.projection.jobRunId,
        leaseToken: claim.leaseToken,
        runVersion: claim.runVersion,
        result: "SUCCESS",
        payload: result
      })
    };
  } catch (error) {
    const projection = await completeJobRun({
      jobRunId: claim.projection.jobRunId,
      leaseToken: claim.leaseToken,
      runVersion: claim.runVersion,
      result: "FAILED",
      error
    });
    return { replayed: false, active: false, projection };
  }
}
