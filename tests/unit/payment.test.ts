import { describe, expect, it } from "vitest";
import { getReceivingAccount } from "@/server/payment/config";
import { formatWib, maskReceivingAccount } from "@/server/payment/projection";

describe("BAYAR-004 payment boundaries", () => {
  it("uses a test receiving account fixture without exposing configuration policy", () => {
    const account = getReceivingAccount();
    expect(account.accountNumber).toMatch(/^\d{6,24}$/);
    expect(account.accountHolderName).toBeTruthy();
  });

  it("masks the receiving account to its last four digits", () => {
    expect(maskReceivingAccount("1234567890")).toBe("••••7890");
  });

  it("renders payment deadlines in WIB", () => {
    expect(formatWib(new Date("2026-07-23T11:16:23.542Z"))).toContain("WIB");
    expect(formatWib(new Date("2026-07-23T11:16:23.542Z"))).toContain("18.16");
  });
});
