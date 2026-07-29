import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  deterministicProviderEventId,
  midtransSignatureInput,
  verifyMidtransSignature
} from "@/server/providers/midtrans/signature";
import { createFakePaymentStatusAdapter } from "@/server/providers/midtrans/status-fake";
import { isAuthoritativePayment } from "@/server/providers/payment-status";

describe("BAYAR-005 Midtrans provider boundary", () => {
  it("accepts only settlement with fraud_status accept", () => {
    expect(isAuthoritativePayment({ transactionStatus: "settlement", fraudStatus: "accept" })).toBe(true);
    expect(isAuthoritativePayment({ transactionStatus: "capture", fraudStatus: "accept" })).toBe(false);
    expect(isAuthoritativePayment({ transactionStatus: "settlement", fraudStatus: "challenge" })).toBe(false);
  });

  it("verifies the Midtrans SHA-512 signature without exposing the server key", () => {
    const input = { orderId: "order-1", statusCode: "200", grossAmount: "125000" };
    const serverKey = "test-server-key";
    const signature = createHash("sha512")
      .update(`${midtransSignatureInput(input)}${serverKey}`)
      .digest("hex");

    expect(verifyMidtransSignature({ ...input, signatureKey: signature })).toBe(true);
    expect(verifyMidtransSignature({ ...input, signatureKey: "invalid" })).toBe(false);
    expect(JSON.stringify({ input, signature })).not.toContain(serverKey);
  });

  it("derives a stable event identity when the provider omits an event id", () => {
    const input = {
      orderId: "order-1",
      transactionStatus: "pending",
      statusCode: "201",
      grossAmount: "125000",
      currency: "IDR",
      fraudStatus: "",
      eventTime: null,
      settlementTime: null
    };
    expect(deterministicProviderEventId(input)).toBe(deterministicProviderEventId(input));
    expect(deterministicProviderEventId(input)).toMatch(/^MIDTRANS-HASH:/);
  });

  it("maps the fake adapter's unknown and authoritative responses safely", async () => {
    const adapter = createFakePaymentStatusAdapter({
      provider: "MIDTRANS",
      providerOrderId: "order-1",
      providerEventId: "event-1",
      transactionStatus: "settlement",
      fraudStatus: "accept",
      amount: 125000,
      currency: "IDR",
      eventOccurredAt: null,
      outcome: "AUTHORITATIVE"
    });
    const result = await adapter.getStatus("order-1");
    expect(result.outcome).toBe("AUTHORITATIVE");
    const unknown = createFakePaymentStatusAdapter({
      provider: "MIDTRANS",
      providerOrderId: "order-2",
      providerEventId: null,
      transactionStatus: "unknown",
      fraudStatus: null,
      amount: null,
      currency: null,
      eventOccurredAt: null,
      outcome: "UNKNOWN"
    });
    expect((await unknown.getStatus("order-2")).outcome).toBe("UNKNOWN");
  });
});
