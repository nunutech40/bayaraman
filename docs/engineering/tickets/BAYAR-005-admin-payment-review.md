# Engineering Ticket

## Ticket

~~~text
ID: BAYAR-005
Title: Midtrans Payment Webhook and Provider Reconciliation
Type: Feature
Priority: P0
Owner: Engineering
Status: Draft
Depends on: BAYAR-004
Blocks: BAYAR-006, BAYAR-010, BAYAR-012
Source requirement IDs: UR-ADMIN-001, UR-ADMIN-002, UR-ADMIN-003, UR-ADMIN-004, UR-ADMIN-005, UR-ADMIN-020, UR-ADMIN-021, UR-ADMIN-022, UR-ADMIN-023, UR-BR-008, UR-BR-011, UR-BR-031, UR-BR-033, UR-BR-034, UR-BR-035, UR-BR-044
Source UX Flow IDs: UX-FLOW-015, UX-FLOW-016, UX-FLOW-047, UX-FLOW-048, UX-FLOW-049, UX-FLOW-050
Source UI IDs/states: UI-SCR-011, UI-SCR-022
Source QA scenario IDs: QA-MP-004, QA-MP-005, QA-MP-006, QA-MP-007, QA-MP-008, QA-PAY-003, QA-PAY-004, QA-PAY-005, QA-PAY-006, QA-PAY-007, QA-PAY-008, QA-PAY-009, QA-PAY-010, QA-EXP-003, QA-EXP-004, QA-SEC-003
Source technical design section: TRD Sections 5, 6, 7, 8, 10, 11, 13, 14
Source product decisions: PB-MP-001, PB-MP-002, PB-MP-003, PB-MP-004, PB-MP-005, PB-MP-006, PB-MP-007, PB-MP-008, PB-MP-009
~~~

## Outcome

Process Midtrans webhooks and Get Status API results as the authoritative
payment boundary. Only validated `settlement + fraud_status=accept` may move
the transaction to `PAYMENT_CONFIRMED`.

## In Scope

- Signature, order ID, amount, fraud-status, event-time, provider-event ID,
  payload-hash, duplicate, delayed, out-of-order, and equal-time handling.
- Provider status reconciliation and Admin exception assignment.
- Non-authoritative `pending`, `capture`, `deny`, `cancel`, `failure`,
  `expire`, and `UNKNOWN` outcomes.
- Partial, excess, duplicate, mismatch, late-fund, outage, and no-revival
  paths; all mutations are idempotent, version-guarded, and audited.

## Out Of Scope

Normal manual bank-check, invoice creation, refund, payout, WhatsApp group,
or provider API behavior outside payment status reconciliation.

## Acceptance Criteria

- Invalid signature/order/amount/fraud payload is rejected without changing
  payment authority; the rejection and correlation are audited.
- Duplicate/delayed/out-of-order events are stored immutably and cannot
  overwrite an already authoritative result; Get Status resolves UNKNOWN.
- Only exact settlement plus accepted fraud status creates
  `PAYMENT_CONFIRMED`; capture is not payout eligibility and all other provider
  results remain non-paid or reconciliation-required.
- Partial, excess, duplicate, late, and ambiguous provider results do not
  create group/fulfillment readiness or revive an expired transaction.
- Admin reconciliation is server-authorized, uses two-Admin authorization for
  controlled financial outcomes, and exposes masked participant data only.

## Verification

Run QA-MP-004..008, QA-PAY-003..010, QA-EXP-003..004, and QA-SEC-003, including
signature/order/amount tests, event ordering, outage, Get Status, mismatch,
and state-version races.

## Definition Of Done

Refund and payout implementation are excluded; the ticket remains Draft until review.
