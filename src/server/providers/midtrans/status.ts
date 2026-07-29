import { getMidtransConfig } from "./config";
import type { PaymentProviderStatus, PaymentStatusAdapter, PaymentStatusResult } from "../payment-status";

type MidtransStatusResponse = {
  order_id?: string;
  transaction_status?: string;
  fraud_status?: string;
  gross_amount?: string;
  currency?: string;
  transaction_id?: string;
  settlement_time?: string;
  transaction_time?: string;
};

function normalizeStatus(value: string | undefined): PaymentProviderStatus {
  switch (value?.toLowerCase()) {
    case "settlement": return "settlement";
    case "capture": return "capture";
    case "pending": return "pending";
    case "deny": return "deny";
    case "cancel": return "cancel";
    case "failure": return "failure";
    case "expire": return "expire";
    default: return "unknown";
  }
}

export class MidtransPaymentStatusAdapter implements PaymentStatusAdapter {
  async getStatus(providerOrderId: string): Promise<PaymentStatusResult> {
    const config = getMidtransConfig();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await fetch(`${config.apiBaseUrl}/v2/${encodeURIComponent(providerOrderId)}/status`, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.serverKey}:`).toString("base64")}`,
          Accept: "application/json"
        },
        signal: controller.signal
      });
      const body = await response.json().catch(() => null) as MidtransStatusResponse | null;
      if (!response.ok || !body?.order_id) {
        return unknownStatus(providerOrderId);
      }
      const transactionStatus = normalizeStatus(body.transaction_status);
      const amount = body.gross_amount ? Number(body.gross_amount) : null;
      return {
        provider: "MIDTRANS",
        providerOrderId: body.order_id,
        providerEventId: body.transaction_id ?? null,
        transactionStatus,
        fraudStatus: body.fraud_status ?? null,
        amount: Number.isFinite(amount) ? amount : null,
        currency: body.currency ?? "IDR",
        eventOccurredAt: body.settlement_time || body.transaction_time
          ? new Date(body.settlement_time ?? body.transaction_time!)
          : null,
        outcome: transactionStatus === "unknown"
          ? "UNKNOWN"
          : transactionStatus === "settlement" && body.fraud_status === "accept"
            ? "AUTHORITATIVE"
            : "NON_AUTHORITATIVE"
      };
    } catch {
      return unknownStatus(providerOrderId);
    } finally {
      clearTimeout(timeout);
    }
  }
}

function unknownStatus(providerOrderId: string): PaymentStatusResult {
  return {
    provider: "MIDTRANS",
    providerOrderId,
    providerEventId: null,
    transactionStatus: "unknown",
    fraudStatus: null,
    amount: null,
    currency: null,
    eventOccurredAt: null,
    outcome: "UNKNOWN"
  };
}
