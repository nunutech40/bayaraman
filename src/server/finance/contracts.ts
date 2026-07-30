import { z } from "zod";

const stateVersion = z.number().int().nonnegative();

export const financialPrepareSchema = z.object({
  transactionId: z.string().uuid(),
  operation: z.enum(["PAYOUT", "REFUND", "SPLIT"]),
  sourceType: z.enum(["COMPLAINT", "RISK", "FUNDED_CANCELLATION", "LATE_FUND"]).optional(),
  handoffId: z.string().uuid().optional(),
  buyerAmount: z.number().int().positive().optional(),
  sellerAmount: z.number().int().positive().optional(),
  expectedStateVersion: stateVersion
}).superRefine((value, context) => {
  if (value.operation !== "PAYOUT" && (!value.sourceType || !value.handoffId)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Financial handoff is required" });
  }
  if (value.operation === "SPLIT" && (!value.buyerAmount || !value.sellerAmount)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Split amounts are required" });
  }
});

export const financialApprovalSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().trim().max(500).optional(),
  expectedOperationVersion: stateVersion
});

export const financialReauthSchema = z.object({
  password: z.string().min(8).max(200),
  expectedOperationVersion: stateVersion
});

export const financialExecuteSchema = z.object({
  expectedOperationVersion: stateVersion
});

export const financialRetrySchema = z.object({
  expectedOperationVersion: stateVersion
});

export const financialReconcileSchema = z.object({
  result: z.enum(["SUCCESS", "FAILED", "UNKNOWN"]),
  externalReference: z.string().trim().min(3).max(500).optional(),
  evidenceHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  expectedOperationVersion: stateVersion
}).superRefine((value, context) => {
  if (value.result === "SUCCESS" && (!value.externalReference || !value.evidenceHash)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "SUCCESS requires immutable evidence" });
  }
});

export type FinancialPrepareInput = z.infer<typeof financialPrepareSchema>;
export type FinancialApprovalInput = z.infer<typeof financialApprovalSchema>;
export type FinancialReauthInput = z.infer<typeof financialReauthSchema>;
export type FinancialExecuteInput = z.infer<typeof financialExecuteSchema>;
export type FinancialRetryInput = z.infer<typeof financialRetrySchema>;
export type FinancialReconcileInput = z.infer<typeof financialReconcileSchema>;
