import { z } from "zod";

export const notificationChannelSchema = z.enum(["IN_APP", "WHATSAPP"]);
export const notificationDeliveryResultSchema = z.enum([
  "PENDING",
  "SENT",
  "FAILED",
  "UNKNOWN"
]);
export const notificationOccurrenceSchema = z.string().refine(
  (value) => value === "ONCE" || /^ESCALATION:[1-9][0-9]*$/.test(value),
  "Notification occurrence must be ONCE or ESCALATION:<sequence>"
);

export type NotificationChannel = z.infer<typeof notificationChannelSchema>;
export type NotificationDeliveryResult = z.infer<typeof notificationDeliveryResultSchema>;

export const notificationIntentSchema = z.object({
  transactionId: z.string().uuid(),
  notificationType: z.string().trim().min(1).max(100),
  sourceType: z.string().trim().min(1).max(100),
  sourceId: z.string().trim().min(1).max(200),
  recipientScope: z.string().trim().min(1).max(200),
  recipientAccountId: z.string().uuid().nullable(),
  channel: notificationChannelSchema,
  occurrenceKey: notificationOccurrenceSchema,
  payloadSnapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
  correlationId: z.string().uuid(),
  nextAttemptAt: z.date().optional()
});

export type NotificationIntentInput = z.infer<typeof notificationIntentSchema>;
