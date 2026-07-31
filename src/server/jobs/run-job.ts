import "dotenv/config";
import { jobInvocationSchema, jobNameSchema, type JobName } from "./contracts";
import { jobHandler } from "./registry";
import { runJob } from "./orchestrator";

export async function runCliJob(
  unsafeJobName: string,
  scheduledFor = new Date(),
  idempotencyKey = `${unsafeJobName}:${scheduledFor.toISOString()}`
) {
  const jobName = jobNameSchema.parse(unsafeJobName);
  const invocation = jobInvocationSchema.parse({
    scheduledFor: scheduledFor.toISOString(),
    parameters: {}
  });
  return runJob({
    jobName,
    invocation,
    idempotencyKey,
    execute: jobHandler(jobName)
  });
}

async function main() {
  const jobName = process.argv[2];
  if (!jobName) {
    throw new Error("Usage: tsx src/server/jobs/run-job.ts <job-name> [scheduled-for] [idempotency-key]");
  }
  const scheduledFor = process.argv[3] ? new Date(process.argv[3]) : new Date();
  if (Number.isNaN(scheduledFor.getTime())) throw new Error("SCHEDULED_FOR_INVALID");
  const result = await runCliJob(jobName, scheduledFor, process.argv[4]);
  console.log(JSON.stringify(result.projection));
  if (result.projection.status === "FAILED") process.exitCode = 1;
}

if (process.argv[1]?.endsWith("run-job.ts")) {
  await main();
}
