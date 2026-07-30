import { z } from "zod";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const evidenceReferenceSchema = z.string().trim().min(3).max(500);

export const complaintIntakeSchema = z.object({
  summary: z.string().trim().min(10).max(1000),
  evidenceReference: evidenceReferenceSchema,
  evidenceHash: sha256Schema,
  sourceAuthorRole: z.enum(["BUYER", "SELLER"]),
  expectedStateVersion: z.number().int().nonnegative()
});

export const complaintCorrectionSchema = z.object({
  correctedEventId: z.string().uuid(),
  summary: z.string().trim().min(10).max(1000),
  evidenceReference: evidenceReferenceSchema,
  evidenceHash: sha256Schema,
  correctionReason: z.string().trim().min(5).max(500),
  sourceAuthorRole: z.enum(["BUYER", "SELLER"]),
  expectedStateVersion: z.number().int().nonnegative()
});

export const complaintNoAgreementSchema = z.object({
  summary: z.string().trim().min(10).max(1000),
  evidenceReference: evidenceReferenceSchema,
  evidenceHash: sha256Schema,
  expectedStateVersion: z.number().int().nonnegative()
});

export const complaintAgreementSchema = z.object({
  outcome: z.enum(["SELLER_RELEASE", "BUYER_REFUND", "SPLIT"]),
  evidenceEventId: z.string().uuid(),
  evidenceReference: evidenceReferenceSchema,
  evidenceHash: sha256Schema,
  buyerAmount: z.number().int().positive().optional(),
  sellerAmount: z.number().int().positive().optional(),
  expectedStateVersion: z.number().int().nonnegative()
}).superRefine((value, context) => {
  if (value.outcome === "SPLIT" && (!value.buyerAmount || !value.sellerAmount)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Split membutuhkan porsi Buyer dan Seller" });
  }
});

export const complaintApprovalSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  expectedStateVersion: z.number().int().nonnegative()
});

export type ComplaintIntakeInput = z.infer<typeof complaintIntakeSchema>;
export type ComplaintCorrectionInput = z.infer<typeof complaintCorrectionSchema>;
export type ComplaintNoAgreementInput = z.infer<typeof complaintNoAgreementSchema>;
export type ComplaintAgreementInput = z.infer<typeof complaintAgreementSchema>;
export type ComplaintApprovalInput = z.infer<typeof complaintApprovalSchema>;

