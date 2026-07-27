import { z } from "zod";

export const accountInputSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8),
  displayName: z.string().trim().min(1).max(120),
  whatsappNumber: z.string().trim().min(8).max(32)
});

export const loginInputSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1)
});

export const otpRequestSchema = z.object({
  whatsappNumber: z.string().trim().min(8).max(32)
});

export const otpVerifySchema = z.object({
  code: z.string().regex(/^\d{6}$/)
});

export type AccountInput = z.infer<typeof accountInputSchema>;
