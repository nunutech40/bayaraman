export function calculateTransactionAmounts(itemPrice: number, shippingCost: number) {
  const serviceFee = Math.min(50_000, Math.max(10_000, Math.round(itemPrice * 0.02)));
  return {
    serviceFee,
    totalAmount: itemPrice + shippingCost + serviceFee
  };
}

export function maskAccountNumber(accountNumber: string): string {
  return `••••${accountNumber.slice(-4)}`;
}
