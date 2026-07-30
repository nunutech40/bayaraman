import { describe, expect, it } from "vitest";
import {
  financialApprovalSchema,
  financialPrepareSchema,
  financialReconcileSchema
} from "@/server/finance/contracts";
import { assertSourceOutcome } from "@/server/finance/handoff-adapter";
import {
  createFakeFinancialTransferAdapter,
  createFakeRefundProviderAdapter
} from "@/server/providers/finance";

describe("BAYAR-008 finance contracts", () => {
  it("requires a handoff for refund and split", () => {
    expect(() => financialPrepareSchema.parse({
      transactionId: crypto.randomUUID(),
      operation: "REFUND",
      expectedStateVersion: 0
    })).toThrow();
    expect(financialPrepareSchema.parse({
      transactionId: crypto.randomUUID(),
      operation: "PAYOUT",
      expectedStateVersion: 0
    }).operation).toBe("PAYOUT");
  });

  it("requires immutable evidence for reconciled success", () => {
    expect(() => financialReconcileSchema.parse({
      result: "SUCCESS",
      expectedOperationVersion: 1
    })).toThrow();
    expect(financialReconcileSchema.parse({
      result: "SUCCESS",
      externalReference: "provider-reference",
      evidenceHash: "a".repeat(64),
      expectedOperationVersion: 1
    }).result).toBe("SUCCESS");
  });

  it("keeps approval vocabulary and source outcomes bounded", () => {
    expect(financialApprovalSchema.parse({
      decision: "APPROVED",
      expectedOperationVersion: 0
    }).decision).toBe("APPROVED");
    expect(() => assertSourceOutcome("RISK", "SELLER_RELEASE")).toThrow(
      "HANDOFF_OUTCOME_NOT_ALLOWED"
    );
    expect(() => assertSourceOutcome("LATE_FUND", "SPLIT")).toThrow(
      "HANDOFF_OUTCOME_NOT_ALLOWED"
    );
    expect(() => assertSourceOutcome("COMPLAINT", "SPLIT")).not.toThrow();
  });

  it("uses provider-neutral fake adapters", async () => {
    const capability = await createFakeRefundProviderAdapter("SUPPORTED")
      .getRefundCapability({
        providerOrderId: "order-1",
        authoritativeProviderEventId: crypto.randomUUID(),
        amount: 10000,
        currency: "IDR"
      });
    expect(capability.capability).toBe("SUPPORTED");
    const transfer = await createFakeFinancialTransferAdapter("SUCCESS").execute({
      operationId: crypto.randomUUID(),
      externalIdempotencyKey: "BAYAR-008:test:1",
      type: "PAYOUT",
      route: "MANUAL_PAYOUT",
      amount: 10000
    });
    expect(transfer).toMatchObject({
      result: "SUCCESS",
      externalReference: "fake:BAYAR-008:test:1"
    });
    expect(transfer.evidenceHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
