import { z } from "zod";

export const releaseGateItemKeySchema = z.enum([
  "MIDTRANS_SETTLEMENT",
  "CUSTODY_FORWARDING",
  "CONSUMER_DISCLOSURE",
  "COMPLAINT_HANDLING",
  "DATA_CONTROLS",
  "PRODUCTION_CREDENTIALS_WEBHOOK",
  "REAL_MONEY_PILOT_EVIDENCE",
  "LEGAL_COMPLIANCE"
]);

export const releaseGateEvidenceSchema = z.object({
  status: z.enum(["OPEN", "BLOCKED", "APPROVED"]),
  evidenceReference: z.string().trim().min(3).max(500),
  externalApproverReference: z.string().trim().min(3).max(500).optional(),
  correctedEventId: z.string().uuid().optional(),
  correctionReason: z.string().trim().min(5).max(500).optional(),
  expectedGateVersion: z.number().int().nonnegative()
}).superRefine((value, context) => {
  if (Boolean(value.correctedEventId) !== Boolean(value.correctionReason)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Target dan alasan koreksi harus lengkap" });
  }
});

export const releaseGateEvaluationSchema = z.object({
  expectedGateVersion: z.number().int().nonnegative(),
  externalDecisionReference: z.string().trim().min(3).max(500).optional()
});

export type ReleaseGateItemKey = z.infer<typeof releaseGateItemKeySchema>;
export type ReleaseGateEvidenceInput = z.infer<typeof releaseGateEvidenceSchema>;
export type ReleaseGateEvaluationInput = z.infer<typeof releaseGateEvaluationSchema>;
