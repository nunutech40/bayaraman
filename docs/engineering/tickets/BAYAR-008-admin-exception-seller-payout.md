# Engineering Ticket

## Ticket

~~~text
ID: BAYAR-008
Title: Admin Payout, Refund, and Split Financial Operations
Type: Feature
Priority: P0
Owner: Engineering
Status: Draft
Depends on: BAYAR-007, BAYAR-009, BAYAR-011
Blocks: BAYAR-012
Source requirement IDs: UR-ADMIN-006, UR-ADMIN-007, UR-ADMIN-008, UR-ADMIN-009, UR-ADMIN-010, UR-ADMIN-011, UR-BR-019, UR-BR-020, UR-BR-021, UR-BR-022, UR-BR-025, UR-BR-038, UR-BR-040, UR-BR-041, UR-BR-042, UR-BR-043, UR-BR-045
Source UX Flow IDs: UX-FLOW-025, UX-FLOW-026, UX-FLOW-027, UX-FLOW-028, UX-FLOW-029, UX-FLOW-030, UX-FLOW-031
Source UI IDs/states: UI-SCR-015, UI-SCR-016, UI-SCR-018, UI-SCR-019, UI-SCR-020
Source QA scenario IDs: QA-FIN-001, QA-FIN-002, QA-FIN-003, QA-FIN-004, QA-FIN-005, QA-FIN-006, QA-FIN-007, QA-FIN-008, QA-SEC-003, QA-SLA-002
Source technical design section: TRD Sections 5, 8, 9, 10, 11, 12, 13, 14
~~~

## Outcome

Admin executes separate Seller payout, Buyer refund, or approved split against
frozen destinations. Midtrans settlement is not payout. Every operation uses
`PROCESSING`, `SUCCESS`, `FAILED`, or `UNKNOWN` and immutable evidence.

## In Scope

- Payout eligibility after Buyer confirmation with Admin re-authentication.
- Midtrans Refund API when supported, otherwise manual Admin fallback.
- Cause-based, late-fund, complaint, cancellation, and risk-outcome refunds.
- Split validation and buyer leg before seller leg.
- Two-Admin approval for refunds, splits, controlled exceptions, risk outcomes,
  and transfers above the approved threshold; append-only approval audit.
- FAILED retry, UNKNOWN reconciliation before retry, idempotency, and
  terminal success transitions.

## Out Of Scope

Destination replacement, automatic payout from settlement, unsupported force
release, provider implementation outside the refund adapter, and complaint
adjudication.

## Acceptance Criteria

- Payout is disabled unless eligible, unheld, re-authenticated, and authorized;
  one operation targets the frozen Seller destination.
- Refund selects Midtrans Refund API or approved manual fallback, records its
  route, and never exposes raw credentials or account values.
- Two-Admin approvals are required where specified; rejection, missing
  approval, and stale state leave the financial action disabled.
- FAILED may retry; UNKNOWN must reconcile first; only SUCCESS plus immutable
  financial reference yields `PAID_OUT`, `REFUNDED`, or `SPLIT_SETTLED`.
- Duplicate/concurrent operation requests return the original result and never
  create a second financial operation.

## Verification

Run QA-FIN-001..008, QA-SEC-003, and QA-SLA-002, including approval,
re-authentication, provider/manual refund route, split ordering, retry/unknown,
evidence immutability, and hold tests.

## Definition Of Done

All operations remain Admin-owned and the ticket remains Draft until review.
