import type { PaymentStatusAdapter, PaymentStatusResult } from "../payment-status";

export function createFakePaymentStatusAdapter(result: PaymentStatusResult): PaymentStatusAdapter {
  return { getStatus: async () => result };
}
