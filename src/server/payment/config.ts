import { z } from "zod";

const receivingAccountSchema = z.object({
  bankName: z.string().trim().min(2).max(80),
  accountNumber: z.string().regex(/^\d{6,24}$/),
  accountHolderName: z.string().trim().min(2).max(120)
});

export type ReceivingAccount = z.infer<typeof receivingAccountSchema>;

export function getReceivingAccount(): ReceivingAccount {
  const parsed = receivingAccountSchema.safeParse({
    bankName: process.env.BAYARAMAN_RECEIVING_BANK_NAME,
    accountNumber: process.env.BAYARAMAN_RECEIVING_ACCOUNT_NUMBER,
    accountHolderName: process.env.BAYARAMAN_RECEIVING_ACCOUNT_HOLDER
  });

  if (!parsed.success) {
    if (process.env.NODE_ENV === "test") {
      return {
        bankName: "Test Bank",
        accountNumber: "1234567890",
        accountHolderName: "BayarAman Test"
      };
    }
    throw new Error("BAYARAMAN receiving account configuration is invalid");
  }

  return parsed.data;
}
