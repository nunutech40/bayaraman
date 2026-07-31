import { listDueSlaTrackers } from "@/server/sla/repository";
import { synchronizeSlaSources } from "@/server/sla/sources";
import { escalateSlaTracker } from "@/server/sla/service";
import type { JobExecutionContext, JobResult } from "./contracts";

export async function runSlaEscalation(
  context: JobExecutionContext
): Promise<JobResult> {
  const synchronized = await synchronizeSlaSources(context.now);
  const due = await listDueSlaTrackers(context.now);
  let escalated = 0;
  for (const tracker of due) {
    if (await escalateSlaTracker(tracker.id, context.now, context.correlationId)) {
      escalated += 1;
    }
  }
  return {
    synchronized: synchronized.createdOrUpdated,
    evaluated: due.length,
    escalated
  };
}
