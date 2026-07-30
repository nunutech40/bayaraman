import { createHash } from "node:crypto";
import type { FinancialOperationResult } from "@/server/domain/transaction/state";

export type RefundCapability = "SUPPORTED" | "UNSUPPORTED" | "UNKNOWN";

export interface RefundProviderAdapter {
  getRefundCapability(input: {
    providerOrderId: string;
    authoritativeProviderEventId: string;
    amount: number;
    currency: "IDR";
  }): Promise<{
    capability: RefundCapability;
    evidenceReference: string | null;
    checkedAt: Date;
  }>;
}

export interface FinancialTransferAdapter {
  execute(input: {
    operationId: string;
    externalIdempotencyKey: string;
    type: "PAYOUT" | "REFUND" | "SPLIT_BUYER" | "SPLIT_SELLER";
    route: string;
    amount: number;
  }): Promise<{
    result: FinancialOperationResult;
    externalReference: string | null;
    evidenceHash: string | null;
  }>;
}

export function createFakeRefundProviderAdapter(
  capability: RefundCapability = "UNSUPPORTED"
): RefundProviderAdapter {
  return {
    async getRefundCapability(input) {
      return {
        capability,
        evidenceReference: capability === "UNKNOWN"
          ? null
          : `fake-capability:${input.providerOrderId}:${capability}`,
        checkedAt: new Date()
      };
    }
  };
}

export function createFakeFinancialTransferAdapter(
  result: FinancialOperationResult = "SUCCESS"
): FinancialTransferAdapter {
  return {
    async execute(input) {
      const reference = result === "SUCCESS" ? `fake:${input.externalIdempotencyKey}` : null;
      return {
        result,
        externalReference: reference,
        evidenceHash: reference
          ? createHash("sha256").update(`${reference}:${input.amount}`).digest("hex")
          : null
      };
    }
  };
}
