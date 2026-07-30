import { z } from "zod";

export const CANCELLATION_CAUSES = [
  "BUYER_CHANGE_OF_MIND",
  "SELLER_UNABLE_TO_FULFILL",
  "MUTUAL_NEUTRAL",
  "BAYARAMAN_ERROR",
  "PROHIBITED_OR_POLICY",
  "SUSPECTED_FRAUD",
  "OTHER_MANUAL_REVIEW"
] as const;

export const cancellationCauseSchema = z.enum(CANCELLATION_CAUSES);
const stateVersion = z.number().int().nonnegative();
const evidenceReference = z.string().trim().min(3).max(500);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);

export const cancellationRequestSchema = z.object({
  cause: cancellationCauseSchema,
  note: z.string().trim().min(5).max(500).optional(),
  expectedStateVersion: stateVersion
}).superRefine((value, context) => {
  if (value.cause === "OTHER_MANUAL_REVIEW" && !value.note) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["note"],
      message: "Catatan wajib untuk review manual"
    });
  }
});

export const cancellationDecisionSchema = z.object({
  cancellationRequestId: z.string().uuid(),
  reason: z.string().trim().min(5).max(500),
  expectedStateVersion: stateVersion
});

export const cancellationEvidenceSchema = z.object({
  cancellationRequestId: z.string().uuid(),
  evidenceKey: z.enum(["WA_REQUEST", "SELLER_SHIPMENT", "BUYER_RESPONSE", "SELLER_RESPONSE"]),
  sourceAuthorRole: z.enum(["BUYER", "SELLER", "ADMIN"]),
  sourceAccountId: z.string().uuid().optional(),
  evidenceReference,
  messageReference: z.string().trim().min(1).max(500).optional(),
  snapshotHash: sha256,
  deliveryResult: z.enum(["PENDING", "SENT", "FAILED", "UNKNOWN"]),
  responseValue: z.string().trim().min(1).max(120).optional(),
  correctedEvidenceId: z.string().uuid().optional(),
  correctionReason: z.string().trim().min(5).max(500).optional(),
  expectedStateVersion: stateVersion
}).superRefine((value, context) => {
  if (Boolean(value.correctedEvidenceId) !== Boolean(value.correctionReason)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["correctionReason"],
      message: "Target dan alasan koreksi wajib diisi bersama"
    });
  }
});

export const cancellationCalculationSchema = z.object({
  cancellationRequestId: z.string().uuid(),
  evidenceSnapshotHash: sha256,
  expectedStateVersion: stateVersion
});

export const cancellationCalculationDecisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  expectedStateVersion: stateVersion
});

export const cancellationHandoffSchema = z.object({
  cancellationRequestId: z.string().uuid(),
  evidenceReference,
  evidenceHash: sha256,
  expectedStateVersion: stateVersion
});

export const cancellationResponseRecoverySchema = z.object({
  cancellationRequestId: z.string().uuid(),
  currentEvidenceHeadIds: z.array(z.string().uuid()).min(1).max(4),
  expectedStateVersion: stateVersion
});

export type CancellationRequestInput = z.infer<typeof cancellationRequestSchema>;
export type CancellationDecisionInput = z.infer<typeof cancellationDecisionSchema>;
export type CancellationEvidenceInput = z.infer<typeof cancellationEvidenceSchema>;
export type CancellationCalculationInput = z.infer<typeof cancellationCalculationSchema>;
export type CancellationCalculationDecisionInput = z.infer<typeof cancellationCalculationDecisionSchema>;
export type CancellationHandoffInput = z.infer<typeof cancellationHandoffSchema>;
export type CancellationResponseRecoveryInput = z.infer<typeof cancellationResponseRecoverySchema>;
