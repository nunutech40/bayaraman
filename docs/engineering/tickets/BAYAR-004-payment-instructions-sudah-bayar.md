# Engineering Ticket

## Ticket

~~~text
ID: BAYAR-004
Title: Midtrans Invoice, Hosted Checkout, and Payment Expiry
Type: Feature
Priority: P0
Owner: Engineering
Status: Draft
Depends on: BAYAR-003
Blocks: BAYAR-005
Source requirement IDs: UR-BUYER-004, UR-BUYER-005, UR-BUYER-009, UR-SYSTEM-004, UR-SYSTEM-005, UR-SYSTEM-006, UR-SYSTEM-007, UR-PARTICIPANT-001, UR-BR-008, UR-BR-009, UR-BR-010, UR-BR-030, UR-BR-031, UR-BR-033, UR-BR-034, UR-BR-035
Source UX Flow IDs: UX-FLOW-013, UX-FLOW-014, UX-FLOW-044, UX-FLOW-045, UX-FLOW-046, UX-FLOW-048
Source UI IDs/states: UI-SCR-009, UI-SCR-010, UI-SCR-021
Source QA scenario IDs: QA-MP-001, QA-MP-002, QA-MP-003, QA-MP-004, QA-PAY-001, QA-PAY-002, QA-PAY-003, QA-EXP-001, QA-EXP-002, QA-UI-002
Source technical design section: TRD Sections 5, 6, 7, 8, 10, 11, 13, 14
Source product decisions: PB-MP-001, PB-MP-002, PB-MP-003, PB-MP-004, PB-MP-005
~~~

## Outcome

When both role datasets are complete, BayarAman creates one idempotent
Midtrans Invoice API payment link using frozen terms. Buyer uses the hosted
page; BayarAman displays status and an absolute 1x24-hour deadline without a
manual-bank payment flow or `Sudah Bayar` confirmation.

## In Scope

- Provider-neutral Midtrans adapter using `payment_type: payment_link`.
- One active invoice, immutable amount/link/issuedAt/expiresAt, optional
  provider `due_date`, and secret isolation.
- Hosted checkout link and `Cek status pembayaran` refresh boundary.
- Deterministic expiry for `WAITING_BUYER_PAYMENT`, fixed-clock tests, and
  late-payment non-revival boundary.

## Out Of Scope

Webhook validation/reconciliation (BAYAR-005), Admin payment decision,
refund, payout, WhatsApp, cancellation, and money movement.

## Acceptance Criteria

- A complete transaction creates exactly one payment link with amount from
  frozen terms and deadline exactly 1x24 hours from invoice availability.
- Retry/duplicate invoice creation returns the same invoice reference and
  never resets amount or deadline; provider secrets stay server-side.
- Buyer can open hosted checkout and request status refresh; no client action
  marks payment paid and no `Sudah Bayar` control exists.
- Expiry atomically transitions only eligible transactions at the absolute
  deadline; a timely authoritative-provider path is not expired, reruns are
  idempotent, and late payment cannot revive the transaction.
- UI-SCR-009/010/021 expose loading, disabled, error, expired, unauthorized,
  and deferred cancellation-boundary states without adding a transaction state.

## Verification

Run QA-MP-001..004, QA-PAY-001..003, QA-EXP-001..002, and QA-UI-002 plus tests
for frozen amount/deadline, active-invoice uniqueness, provider outage, and
expiry concurrency.

## Definition Of Done

No webhook or payment confirmation is included; the ticket remains Draft until review.
