import type { JobExecutionContext, JobResult } from "./contracts";
import { deliverNextNotification } from "@/server/notifications/service";

export async function runNotificationDelivery(
  context: JobExecutionContext
): Promise<JobResult> {
  let processed = 0;
  let sent = 0;
  let failed = 0;
  for (let index = 0; index < 100; index += 1) {
    const result = await deliverNextNotification(undefined, context.now);
    if (result.kind === "EMPTY") break;
    processed += 1;
    if (result.kind === "FINALIZED" && result.notification.status === "SENT") sent += 1;
    else failed += 1;
  }
  return { processed, sent, failed };
}
