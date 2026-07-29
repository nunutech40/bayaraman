import { getMidtransConfig, formatProviderDueDate } from "./config";
import {
  PaymentInvoiceProviderError,
  type PaymentInvoiceAdapter,
  type PaymentInvoiceCreateInput,
  type PaymentInvoiceResult
} from "../payment-invoice";

type MidtransResponse = {
  id?: string | number;
  token?: string;
  payment_url?: string;
  redirect_url?: string;
  order_id?: string;
  status_code?: string | number;
  transaction_status?: string;
};

export class MidtransPaymentInvoiceAdapter implements PaymentInvoiceAdapter {
  async createPaymentLink(input: PaymentInvoiceCreateInput): Promise<PaymentInvoiceResult> {
    const config = getMidtransConfig();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const response = await fetch(`${config.apiBaseUrl}/v1/payment-links`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.serverKey}:`).toString("base64")}`,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          payment_type: "payment_link",
          transaction_details: {
            order_id: input.orderId,
            gross_amount: input.amount
          },
          currency: input.currency,
          due_date: formatProviderDueDate(input.expiresAt)
        }),
        signal: controller.signal
      });

      const body = await response.json().catch(() => null) as MidtransResponse | null;
      if (!response.ok) {
        throw new PaymentInvoiceProviderError(
          response.status >= 500 ? "UNAVAILABLE" : "PROVIDER_REJECTED"
        );
      }

      const providerInvoiceId = body?.id !== undefined ? String(body.id) : body?.token;
      const hostedPaymentUrl = body?.payment_url ?? body?.redirect_url;
      if (!providerInvoiceId || !hostedPaymentUrl) {
        throw new PaymentInvoiceProviderError("INVALID_RESPONSE");
      }

      return {
        provider: "MIDTRANS",
        providerInvoiceId,
        providerOrderId: body?.order_id ?? input.orderId,
        hostedPaymentUrl,
        providerStatus: body?.transaction_status ?? "PENDING",
        dueDateAt: input.expiresAt
      };
    } catch (error) {
      if (error instanceof PaymentInvoiceProviderError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new PaymentInvoiceProviderError("TIMEOUT");
      }
      throw new PaymentInvoiceProviderError("UNAVAILABLE");
    } finally {
      clearTimeout(timeout);
    }
  }
}
