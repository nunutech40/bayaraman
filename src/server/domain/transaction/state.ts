export const TRANSACTION_STATES = [
  "WAITING_COUNTERPARTY",
  "WAITING_COUNTERPARTY_DATA",
  "WAITING_BUYER_PAYMENT",
  "PAYMENT_UNDER_REVIEW",
  "PAYMENT_CONFIRMED",
  "PAYMENT_EXCEPTION_REVIEW",
  "PAYMENT_EXPIRED",
  "READY_FOR_FULFILLMENT",
  "WAITING_COMPLETION_REPORTS",
  "WAITING_OTHER_COMPLETION_REPORT",
  "READY_FOR_BUYER_CONFIRMATION",
  "WAITING_BUYER_CONFIRMATION",
  "BUYER_CONFIRMATION_OVERDUE",
  "READY_FOR_PAYOUT",
  "PAYOUT_ON_HOLD",
  "PAYOUT_PROCESSING",
  "PAID_OUT",
  "CANCELLATION_REQUESTED",
  "CANCELLATION_PENDING_RECONCILIATION",
  "FUNDED_CANCELLATION_REVIEW",
  "REFUND_READY",
  "REFUND_PROCESSING",
  "REFUNDED",
  "SPLIT_PROCESSING",
  "SPLIT_SETTLED",
  "MANUAL_REVIEW_REQUIRED",
  "RISK_HOLD",
  "CANCELLED"
] as const;

export type TransactionState = (typeof TRANSACTION_STATES)[number];

export const FINANCIAL_OPERATION_RESULTS = [
  "PROCESSING",
  "SUCCESS",
  "FAILED",
  "UNKNOWN"
] as const;

export type FinancialOperationResult =
  (typeof FINANCIAL_OPERATION_RESULTS)[number];

export const PRODUCT_ROLES = ["BUYER", "SELLER", "ADMIN"] as const;
export type ProductRole = (typeof PRODUCT_ROLES)[number];

export function isTransactionState(value: string): value is TransactionState {
  return (TRANSACTION_STATES as readonly string[]).includes(value);
}

export function isFinancialOperationResult(
  value: string
): value is FinancialOperationResult {
  return (FINANCIAL_OPERATION_RESULTS as readonly string[]).includes(value);
}

export function assertKnownTransactionState(
  value: string
): asserts value is TransactionState {
  if (!isTransactionState(value)) {
    throw new Error("Unknown transaction state: " + value);
  }
}

export function assertExpectedStateVersion(
  current: number,
  expected: number
): void {
  if (current !== expected) {
    throw new StateVersionConflictError(current, expected);
  }
}

export class StateVersionConflictError extends Error {
  readonly current: number;
  readonly expected: number;

  constructor(current: number, expected: number) {
    super(
      "State version conflict: expected " +
        expected +
        ", current " +
        current
    );
    this.name = "StateVersionConflictError";
    this.current = current;
    this.expected = expected;
  }
}

export function assertKnownTransition(
  from: string,
  to: string
): asserts from is TransactionState {
  assertKnownTransactionState(from);
  assertKnownTransactionState(to);
}
