import { describe, expect, it } from "vitest";
import { cancellationRequestSchema } from "@/server/cancellation/contracts";
import { classifyCancellationProviderEvent } from "@/server/cancellation/provider-resolution";
import { addOperatingMinutesWib } from "@/server/domain/time/operating-hours";

const invoice = {
  provider: "MIDTRANS",
  providerOrderId: "ORDER-1",
  amount: 115_000,
  currency: "IDR"
};

const event = {
  provider: "MIDTRANS",
  providerOrderId: "ORDER-1",
  amount: 115_000,
  currency: "IDR",
  providerStatus: "settlement",
  fraudStatus: "accept",
  signatureValid: true,
  validationOutcome: "ACCEPTED"
};

describe("BAYAR-010 cancellation contracts", () => {
  it("requires a note for OTHER_MANUAL_REVIEW", () => {
    expect(() => cancellationRequestSchema.parse({
      cause: "OTHER_MANUAL_REVIEW",
      expectedStateVersion: 0
    })).toThrow();
  });

  it("classifies provider status using mismatch-before-status precedence", () => {
    expect(classifyCancellationProviderEvent(event, invoice)).toBe("AUTHORITATIVE");
    expect(classifyCancellationProviderEvent({
      ...event,
      amount: 1,
      providerStatus: "expire",
      validationOutcome: "AMOUNT_MISMATCH"
    }, invoice)).toBe("MISMATCH");
    expect(classifyCancellationProviderEvent({
      ...event,
      providerStatus: "capture",
      fraudStatus: null,
      validationOutcome: "NON_AUTHORITATIVE"
    }, invoice)).toBe("WAITING");
    expect(classifyCancellationProviderEvent({
      ...event,
      providerStatus: "expire",
      fraudStatus: null,
      validationOutcome: "NON_AUTHORITATIVE"
    }, invoice)).toBe("DEFINITIVE_NON_PAID");
    expect(classifyCancellationProviderEvent({
      ...event,
      signatureValid: false,
      validationOutcome: "INVALID_SIGNATURE"
    }, invoice)).toBe("UNKNOWN");
  });

  it("counts reconciliation SLA only inside 09.00-21.00 WIB", () => {
    const atTwenty = new Date("2026-07-30T13:00:00.000Z");
    expect(addOperatingMinutesWib(atTwenty, 120).toISOString())
      .toBe("2026-07-31T03:00:00.000Z");
  });
});
