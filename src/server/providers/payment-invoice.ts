export type PaymentInvoiceErrorCode =
  | "TIMEOUT"
  | "UNAVAILABLE"
  | "INVALID_RESPONSE"
  | "PROVIDER_REJECTED";

export type PaymentInvoiceCreateInput = {
  orderId: string;
  amount: number;
  currency: "IDR";
  expiresAt: Date;
};

export type PaymentInvoiceResult = {
  provider: "MIDTRANS";
  providerInvoiceId: string;
  providerOrderId: string;
  hostedPaymentUrl: string;
  providerStatus: string;
  dueDateAt: Date | null;
};

export class PaymentInvoiceProviderError extends Error {
  readonly code: PaymentInvoiceErrorCode;

  constructor(code: PaymentInvoiceErrorCode, message = code) {
    super(message);
    this.name = "PaymentInvoiceProviderError";
    this.code = code;
  }
}

export interface PaymentInvoiceAdapter {
  createPaymentLink(input: PaymentInvoiceCreateInput): Promise<PaymentInvoiceResult>;
}
