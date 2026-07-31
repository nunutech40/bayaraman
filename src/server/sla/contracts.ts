import { z } from "zod";

export const slaTypeSchema = z.enum([
  "PAYMENT_RECONCILIATION",
  "CONFIRMATION_REMINDER",
  "CONFIRMATION_OVERDUE",
  "CANCELLATION_RECONCILIATION",
  "CANCELLATION_RESPONSE",
  "PAYOUT",
  "REFUND",
  "SPLIT"
]);

export const slaDomainSchema = z.enum([
  "PAYMENT",
  "CONFIRMATION",
  "CANCELLATION",
  "FINANCIAL"
]);

export const slaStatusSchema = z.enum([
  "OPEN",
  "OVERDUE",
  "FINAL_NOTIFICATION_FAILURE"
]);

export const slaQuerySchema = z.object({
  domain: slaDomainSchema.optional(),
  status: slaStatusSchema.optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30)
});

export type SlaType = z.infer<typeof slaTypeSchema>;
