import { NextResponse } from "next/server";
import {
  JOB_IDEMPOTENCY_HEADER,
  JOB_SIGNATURE_HEADER,
  JOB_TIMESTAMP_HEADER,
  verifyJobInvocation
} from "@/server/jobs/auth";
import { jobInvocationSchema, jobNameSchema } from "@/server/jobs/contracts";
import { logSchedulerSecurityRejection } from "@/server/jobs/observability";
import { runJob } from "@/server/jobs/orchestrator";
import { jobHandler } from "@/server/jobs/registry";

function reason(error: unknown): string {
  return error instanceof Error ? error.message : "JOB_REQUEST_REJECTED";
}

function statusFor(error: unknown): number {
  const code = reason(error);
  if (code.startsWith("JOB_AUTH") ||
      code.startsWith("JOB_SIGNATURE") ||
      code.startsWith("JOB_TIMESTAMP")) return 401;
  if (code.includes("IDEMPOTENCY_CONFLICT")) return 409;
  return 400;
}

export async function POST(
  request: Request,
  context: { params: { jobName: string } }
) {
  const path = new URL(request.url).pathname;
  const body = await request.text();
  try {
    const jobName = jobNameSchema.parse(context.params.jobName);
    const auth = verifyJobInvocation({
      method: request.method,
      path,
      timestamp: request.headers.get(JOB_TIMESTAMP_HEADER),
      idempotencyKey: request.headers.get(JOB_IDEMPOTENCY_HEADER),
      signature: request.headers.get(JOB_SIGNATURE_HEADER),
      body
    });
    const invocation = jobInvocationSchema.parse(JSON.parse(body));
    const result = await runJob({
      jobName,
      invocation,
      idempotencyKey: auth.idempotencyKey,
      execute: jobHandler(jobName)
    });
    const status = result.active
      ? 202
      : result.projection.status === "FAILED"
        ? 503
        : 200;
    return NextResponse.json(result.projection, { status });
  } catch (error) {
    const status = statusFor(error);
    if (status === 401) {
      logSchedulerSecurityRejection({ route: path, reasonCode: reason(error) });
    }
    return NextResponse.json(
      { message: status === 401 ? "Scheduler authentication failed." : "Job request rejected." },
      { status }
    );
  }
}
