import { runConfirmationOverdueSweep, runConfirmationReminderSweep } from "@/server/confirmation/recovery";
import { synchronizeSlaSources } from "@/server/sla/sources";
import { runCancellationReconciliationTimeout } from "./cancellation-reconciliation-timeout";
import { runCancellationResponseTimeout } from "./cancellation-response-timeout";
import type { JobExecutionContext, JobName, JobResult } from "./contracts";
import { runNotificationDelivery } from "./notification-delivery";
import { expirePaymentInvoices } from "./payment-expiry";
import { runSlaEscalation } from "./sla-escalation";

type JobHandler = (context: JobExecutionContext) => Promise<JobResult>;

const registry: Record<JobName, JobHandler> = {
  "payment-expiry": async (context) => ({
    expired: await expirePaymentInvoices(context.now, context)
  }),
  "confirmation-reminder": async (context) => {
    const result = await runConfirmationReminderSweep(context.now, context);
    return { marked: result.marked };
  },
  "confirmation-overdue": async (context) => {
    const result = await runConfirmationOverdueSweep(context.now, context);
    return { transitioned: result.transitioned };
  },
  "payment-reconciliation-sla": async (context) => {
    const result = await synchronizeSlaSources(context.now);
    return {
      evaluated: result.evaluated,
      synchronized: result.createdOrUpdated
    };
  },
  "cancellation-reconciliation-timeout": async (context) => ({
    transitioned: await runCancellationReconciliationTimeout(context.now)
  }),
  "cancellation-response-timeout": async (context) => ({
    transitioned: await runCancellationResponseTimeout(context.now)
  }),
  "financial-sla-escalation": runSlaEscalation,
  "notification-delivery": runNotificationDelivery
};

export function jobHandler(jobName: JobName): JobHandler {
  return registry[jobName];
}
