import { z } from "zod";

const evidenceReference = z.string().trim().min(3).max(500);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const stateVersion = z.number().int().nonnegative();

export const riskIntakeSchema = z.object({
  category: z.enum(["PROHIBITED_OR_POLICY", "SUSPECTED_FRAUD", "OTHER_MANUAL_REVIEW"]),
  reason: z.string().trim().min(10).max(1000),
  note: z.string().trim().min(5).max(500).optional(),
  evidenceReference,
  evidenceHash: sha256,
  expectedStateVersion: stateVersion
}).superRefine((value, context) => {
  if (value.category === "OTHER_MANUAL_REVIEW" && !value.note) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Catatan wajib untuk review manual" });
  }
});

export const riskCorrectionSchema = z.object({
  correctedEventId: z.string().uuid(),
  summary: z.string().trim().min(10).max(1000),
  evidenceReference,
  evidenceHash: sha256,
  correctionReason: z.string().trim().min(5).max(500),
  expectedStateVersion: stateVersion
});

export const riskReviewSchema = z.object({
  outcome: z.enum(["KEEP_HOLD", "CLEAR_TO_MANUAL_REVIEW", "BUYER_REFUND"]),
  evidenceEventId: z.string().uuid(),
  decisionNote: z.string().trim().min(5).max(1000),
  expectedStateVersion: stateVersion
});

export const riskDecisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  expectedStateVersion: stateVersion
});

export type RiskIntakeInput = z.infer<typeof riskIntakeSchema>;
export type RiskCorrectionInput = z.infer<typeof riskCorrectionSchema>;
export type RiskReviewInput = z.infer<typeof riskReviewSchema>;
export type RiskDecisionInput = z.infer<typeof riskDecisionSchema>;
