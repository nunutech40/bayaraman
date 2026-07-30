import { z } from "zod";

export const confirmationLinkCreateSchema = z.object({
  expectedStateVersion: z.number().int().nonnegative()
});

export const confirmationOtpRequestSchema = z.object({});

export const confirmationOtpVerifySchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/),
  expectedStateVersion: z.number().int().nonnegative()
});

export const confirmationReminderSchema = z.object({
  evidenceReference: z.string().trim().min(3).max(200),
  recordedAt: z.coerce.date().optional(),
  expectedStateVersion: z.number().int().nonnegative()
});

export const confirmationExceptionSchema = z.object({
  approvalAction: z.enum(["REQUEST", "APPROVE"]),
  exceptionId: z.string().uuid().optional(),
  buyerCompletionCheckpointId: z.string().uuid().optional(),
  reason: z.string().trim().min(3).max(500).optional(),
  evidenceReference: z.string().trim().min(3).max(200).optional(),
  expectedStateVersion: z.number().int().nonnegative()
}).superRefine((value, context) => {
  if (value.approvalAction === "REQUEST" && (!value.buyerCompletionCheckpointId || !value.reason || !value.evidenceReference)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["evidenceReference"], message: "Exception evidence is required" });
  }
  if (value.approvalAction === "APPROVE" && !value.exceptionId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["exceptionId"], message: "Exception ID is required" });
  }
});

export type ConfirmationOtpVerifyInput = z.infer<typeof confirmationOtpVerifySchema>;
export type ConfirmationExceptionInput = z.infer<typeof confirmationExceptionSchema>;
