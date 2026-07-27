# Engineering Ticket

## Ticket

~~~text
ID: BAYAR-010
Title: Cancellation Lifecycle and Midtrans Reconciliation Handoff
Type: Feature
Priority: P0
Owner: Engineering
Status: Draft
Depends on: BAYAR-005, BAYAR-009
Blocks: BAYAR-012
Source requirement IDs: UR-CANCEL-001, UR-CANCEL-002, UR-CANCEL-003, UR-CANCEL-004, UR-CANCEL-005, UR-CANCEL-006, UR-CANCEL-007, UR-CANCEL-008, UR-CANCEL-009, UR-CANCEL-010, UR-CANCEL-011, UR-CANCEL-012, UR-CANCEL-013, UR-CANCEL-014, UR-CANCEL-015, UR-CANCEL-016, UR-CANCEL-017, UR-CANCEL-018, UR-CANCEL-019, UR-CANCEL-020, UR-CANCEL-021, UR-CANCEL-022, UR-CANCEL-023, UR-CANCEL-024, UR-CANCEL-025, UR-CAN-OD-001, UR-CAN-OD-002, UR-CAN-OD-003, UR-CAN-OD-004, UR-CAN-OD-005, UR-CAN-OD-006, UR-CAN-OD-007, UR-CAN-OD-008, UR-BR-032, UR-BR-035, UR-BR-047, UR-BR-048, UR-BR-049, UR-BR-050
Source UX Flow IDs: UX-FLOW-043, UX-FLOW-044, UX-FLOW-045, UX-FLOW-046, UX-FLOW-047, UX-FLOW-048, UX-FLOW-061, UX-FLOW-062, UX-FLOW-063, UX-FLOW-064, UX-FLOW-065, UX-FLOW-066, UX-FLOW-067
Source UI IDs/states: UI-SCR-018, UI-SCR-020, UI-SCR-021, UI-SCR-022, UI-SCR-023
Source QA scenario IDs: QA-CANCEL-001, QA-CANCEL-002, QA-CANCEL-003, QA-CANCEL-004, QA-CANCEL-005, QA-CANCEL-006, QA-CANCEL-007, QA-CANCEL-008, QA-CANCEL-009, QA-CANCEL-010, QA-CANCEL-011, QA-CANCEL-012, QA-CANCEL-013, QA-CANCEL-014, QA-SEC-003
Source technical design section: TRD Sections 5, 6, 7, 8, 9, 10, 11, 12, 13, 14
~~~

## Outcome

Eligible Buyer or Seller can request cancellation. Admin uses Midtrans webhook,
Get Status API, and provider reconciliation to decide payment exposure; funded
cases hand off to approved refund/hold paths without reviving the transaction.

## In Scope

- Direct cancellation before join and after join before invoice.
- `CANCELLATION_PENDING_RECONCILIATION` after invoice, including pending,
  capture, unknown, late, duplicate, and ambiguous provider events.
- `FUNDED_CANCELLATION_REVIEW` before shipment, Seller not-shipped statement,
  Admin WhatsApp checkpoint, 1x24-hour response timeout, and manual review.
- Shipment/conflicting evidence to complaint hold; prohibited/fraud cases to
  BAYAR-011; refund handoff to BAYAR-008.
- Reason taxonomy, immutable cause, withdrawal/rejection, state-version,
  idempotency, cutoff, and late-fund refund without revival.

## Out Of Scope

Automatic refund/payout, cancellation after shipment or financial processing,
provider refund execution, risk decision, and complaint adjudication.

## Acceptance Criteria

- Eligible pre-invoice request produces `CANCELLED` exactly once; duplicate or
  concurrent requests return the same result and revoke the invitation.
- Post-invoice request makes the invoice route inactive and starts Midtrans
  reconciliation for at most two operating hours; no missing/ambiguous result
  is inferred as paid or unpaid.
- Definitive non-paid closes as `CANCELLED`; authoritative settlement enters
  `FUNDED_CANCELLATION_REVIEW`; late payment is refunded/reconciled without
  revival.
- Funded response timeout produces `MANUAL_REVIEW_REQUIRED`, never automatic
  money movement; shipment/conflict produces `PAYOUT_ON_HOLD` handoff.
- Withdrawal/rejection revalidates prior state; cutoff, stale version,
  financial processing, and terminal states reject mutation and audit it.

## Verification

Run QA-CANCEL-001..014 and QA-SEC-003, including provider reconciliation,
timeouts, evidence, cutoff, idempotency, concurrent actions, and handoffs.
## Definition Of Done

No manual bank-check is used as payment authority and the ticket stays Draft until review.
