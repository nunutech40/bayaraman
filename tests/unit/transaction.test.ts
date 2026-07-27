import { describe, expect, it } from "vitest";
import { calculateTransactionAmounts, maskAccountNumber } from "@/server/transaction/calculation";
import { createInvitationToken, hashInvitationToken } from "@/server/transaction/token";
import { createTransactionSchema } from "@/server/transaction/contracts";

describe("BAYAR-003 transaction boundaries", () => {
  it("calculates the approved service fee and buyer total", () => {
    expect(calculateTransactionAmounts(100_000, 15_000)).toEqual({ serviceFee: 10_000, totalAmount: 125_000 });
    expect(calculateTransactionAmounts(5_000_000, 0)).toEqual({ serviceFee: 50_000, totalAmount: 5_050_000 });
  });

  it("masks account values and hashes invitation tokens", () => {
    const token = createInvitationToken();
    expect(token.rawToken).not.toBe(token.tokenHash);
    expect(hashInvitationToken(token.rawToken)).toBe(token.tokenHash);
    expect(maskAccountNumber("1234567890")).toBe("••••7890");
  });

  it("accepts seller and buyer creation shapes but rejects invalid price", () => {
    const shared = { itemName: "Laptop", description: "Used laptop", category: "Electronics", condition: "Used", quantity: 1, itemPrice: 1_000_000, shippingCost: 20_000 };
    expect(createTransactionSchema.safeParse({ ...shared, role: "SELLER", payout: { bankName: "BCA", accountHolderName: "Seller", accountNumber: "1234567890" } }).success).toBe(true);
    expect(createTransactionSchema.safeParse({ ...shared, role: "BUYER", shipping: { recipientName: "Buyer", addressLine: "Jalan A", district: "Kebayoran", city: "Jakarta", province: "DKI Jakarta", postalCode: "12345" }, refund: { bankName: "BCA", accountHolderName: "Buyer", accountNumber: "1234567890" } }).success).toBe(true);
    expect(createTransactionSchema.safeParse({ ...shared, itemPrice: 99_999, role: "SELLER", payout: { bankName: "BCA", accountHolderName: "Seller", accountNumber: "1234567890" } }).success).toBe(false);
  });
});
