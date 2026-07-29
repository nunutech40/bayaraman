export type PaymentProviderStatus =
  | "settlement"
  | "capture"
  | "pending"
  | "deny"
  | "cancel"
  | "failure"
  | "expire"
  | "unknown";

export type PaymentStatusResult = {
  provider: "MIDTRANS";
  providerOrderId: string;
  providerEventId: string | null;
  transactionStatus: PaymentProviderStatus;
  fraudStatus: string | null;
  amount: number | null;
  currency: string | null;
  eventOccurredAt: Date | null;
  outcome: "AUTHORITATIVE" | "NON_AUTHORITATIVE" | "UNKNOWN";
};

export type PaymentStatusAdapter = {
  getStatus(providerOrderId: string): Promise<PaymentStatusResult>;
};

export function isAuthoritativePayment(
  status: Pick<PaymentStatusResult, "transactionStatus" | "fraudStatus">
): boolean {
  return status.transactionStatus === "settlement" && status.fraudStatus === "accept";
}
