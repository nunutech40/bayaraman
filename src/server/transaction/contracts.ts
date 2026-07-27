import { z } from "zod";

const destinationSchema = z.object({
  bankName: z.string().trim().min(2).max(80),
  accountHolderName: z.string().trim().min(2).max(120),
  accountNumber: z.string().regex(/^\d{6,24}$/)
});

const shippingSchema = z.object({
  recipientName: z.string().trim().min(2).max(120),
  addressLine: z.string().trim().min(5).max(240),
  district: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(80),
  province: z.string().trim().min(2).max(80),
  postalCode: z.string().regex(/^\d{5}$/)
});

const sharedItemSchema = z.object({
  itemName: z.string().trim().min(2).max(160),
  description: z.string().trim().min(2).max(2000),
  category: z.string().trim().min(2).max(80),
  condition: z.string().trim().min(2).max(40),
  quantity: z.number().int().positive().max(10000),
  photoReference: z.string().trim().max(500).optional(),
  itemPrice: z.number().int().min(100_000).max(5_000_000),
  shippingCost: z.number().int().nonnegative()
});

const sellerRoleDataSchema = z.object({
  role: z.literal("SELLER"),
  payout: destinationSchema
});

const buyerRoleDataSchema = z.object({
  role: z.literal("BUYER"),
  shipping: shippingSchema,
  refund: destinationSchema
});

export const createTransactionSchema = sharedItemSchema.and(
  z.discriminatedUnion("role", [sellerRoleDataSchema, buyerRoleDataSchema])
);

export const roleDataSchema = z.discriminatedUnion("role", [
  sellerRoleDataSchema,
  buyerRoleDataSchema
]);

export const expectedStateVersionSchema = z.object({
  expectedStateVersion: z.number().int().nonnegative().optional()
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type RoleDataInput = z.infer<typeof roleDataSchema>;
