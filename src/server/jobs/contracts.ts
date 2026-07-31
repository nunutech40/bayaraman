import { z } from "zod";

export const jobNameSchema = z.enum([
  "payment-expiry",
  "confirmation-reminder",
  "confirmation-overdue",
  "payment-reconciliation-sla",
  "cancellation-reconciliation-timeout",
  "cancellation-response-timeout",
  "financial-sla-escalation",
  "notification-delivery"
]);

export type JobName = z.infer<typeof jobNameSchema>;

export const jobInvocationSchema = z.object({
  scheduledFor: z.string().datetime({ offset: true }),
  parameters: z.object({}).strict().default({})
}).strict();

export type JobInvocation = z.infer<typeof jobInvocationSchema>;

export type JobExecutionContext = {
  now: Date;
  correlationId: string;
  jobRunId: string;
};

export type JobResult = Record<string, string | number | boolean | null>;
