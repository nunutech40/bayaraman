import type {
  PaymentInvoiceAdapter,
  PaymentInvoiceCreateInput,
  PaymentInvoiceResult
} from "../payment-invoice";

export function createFakePaymentInvoiceAdapter(
  result?: Partial<PaymentInvoiceResult>
): PaymentInvoiceAdapter {
  return {
    async createPaymentLink(input: PaymentInvoiceCreateInput): Promise<PaymentInvoiceResult> {
      return {
        provider: "MIDTRANS",
        providerInvoiceId: result?.providerInvoiceId ?? `fake-invoice-${input.orderId}`,
        providerOrderId: result?.providerOrderId ?? input.orderId,
        hostedPaymentUrl: result?.hostedPaymentUrl ?? `https://example.test/pay/${input.orderId}`,
        providerStatus: result?.providerStatus ?? "PENDING",
        dueDateAt: result?.dueDateAt ?? input.expiresAt
      };
    }
  };
}
