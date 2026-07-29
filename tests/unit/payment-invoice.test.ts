import { describe, expect, it } from "vitest";
import { createFakePaymentInvoiceAdapter } from "@/server/providers/midtrans/fake";
import { formatProviderDueDate, getMidtransConfig } from "@/server/providers/midtrans/config";

describe("BAYAR-004 Midtrans invoice boundary", () => {
  it("builds a safe fake hosted payment result without provider secrets", async () => {
    const expiresAt = new Date("2026-07-29T17:00:00.000Z");
    const result = await createFakePaymentInvoiceAdapter().createPaymentLink({
      orderId: "bayaraman-test-order",
      amount: 125000,
      currency: "IDR",
      expiresAt
    });

    expect(result.provider).toBe("MIDTRANS");
    expect(result.providerOrderId).toBe("bayaraman-test-order");
    expect(result.hostedPaymentUrl).toContain("example.test/pay");
    expect(result.dueDateAt).toEqual(expiresAt);
    expect(JSON.stringify(result)).not.toContain("server-key");
  });

  it("uses a server-only test configuration and preserves the absolute deadline", () => {
    const config = getMidtransConfig();
    expect(config.serverKey).toBeTruthy();
    expect(config.timeoutMs).toBeGreaterThanOrEqual(500);
    expect(formatProviderDueDate(new Date("2026-07-29T17:00:00.000Z"))).toContain("2026-07-30");
  });
});
