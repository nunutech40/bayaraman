import { z } from "zod";

export const participantSnapshotConfirmationSchema = z.object({
  lastFour: z.string().regex(/^\d{4}$/)
});

export const whatsappGroupInputSchema = z.object({
  groupReference: z.string().trim().min(3).max(200),
  buyerSnapshotConfirmation: participantSnapshotConfirmationSchema,
  sellerSnapshotConfirmation: participantSnapshotConfirmationSchema,
  evidenceReference: z.string().trim().min(3).max(200),
  recordedAt: z.coerce.date().optional(),
  expectedStateVersion: z.number().int().nonnegative()
});

export const whatsappCheckpointInputSchema = z.object({
  checkpointType: z.enum(["PAYMENT_ANNOUNCED", "SELLER_SHIPMENT", "SELLER_COMPLETION", "BUYER_COMPLETION"]),
  sourceAuthorRole: z.enum(["BUYER", "SELLER", "ADMIN"]),
  evidenceReference: z.string().trim().min(3).max(200),
  messageReference: z.string().trim().min(3).max(200),
  snapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
  deliveryResult: z.enum(["PENDING", "SENT", "FAILED", "UNKNOWN"]),
  recordedAt: z.coerce.date().optional(),
  correctedCheckpointId: z.string().uuid().optional(),
  correctionReason: z.string().trim().min(3).max(500).optional(),
  expectedStateVersion: z.number().int().nonnegative()
}).superRefine((value, context) => {
  if (value.correctedCheckpointId && !value.correctionReason) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["correctionReason"], message: "Correction reason is required" });
  }
});

export type WhatsAppGroupInput = z.infer<typeof whatsappGroupInputSchema>;
export type WhatsAppCheckpointInput = z.infer<typeof whatsappCheckpointInputSchema>;
