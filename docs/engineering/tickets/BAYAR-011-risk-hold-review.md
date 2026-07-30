# Engineering Ticket

## Ticket

~~~text
ID: BAYAR-011
Title: Admin Risk Hold and Outcome-Neutral Review
Type: Feature
Priority: P0
Owner: Engineering
Status: Draft
Depends on: BAYAR-005, BAYAR-009
Blocks: BAYAR-008
Source requirement IDs: UR-CANCEL-022, UR-CANCEL-023, UR-BR-039, UR-BR-040, UR-BR-045, UR-BR-046, UR-BR-060, UR-BR-061, UR-CAN-OD-005, UR-CAN-OD-006
Source UX Flow IDs: UX-FLOW-072, UX-FLOW-073
Source UI IDs/states: UI-SCR-024
Source QA scenario IDs: QA-RISK-001, QA-RISK-002, QA-SEC-003, QA-LAUNCH-001
Source technical design section: TRD Sections 5, 9, 10, 12, 13, 14, 16
Downstream financial context only: UR-ADMIN-016, UR-ADMIN-017, UR-ADMIN-018, UR-ADMIN-019, UX-FLOW-063 through UX-FLOW-070, UI-SCR-020
~~~

## Outcome

An authorized Admin can create and review a prohibited-item, suspected-fraud,
or policy `RISK_HOLD`. No refund, payout, fee, or other financial outcome is
inferred without an explicitly authorized existing route.

## In Scope

- Risk reason, evidence reference, assigned Admin task, participant summary,
  raw evidence restriction, append-only review/decision audit.
- Two-Admin approval for a controlled risk financial outcome and handoff to
  BAYAR-008; no direct money movement here.
- Launch gate representation with `OPEN`, `BLOCKED`, `APPROVED`.

## Out Of Scope

Automatic fraud detection, product roles beyond Buyer/Seller/Admin, automatic
refund/payout, participant access to raw evidence, and launch approval itself.

## Acceptance Criteria

- Admin with the assigned authority can create `RISK_HOLD`; fulfillment and
  financial actions become disabled and participants see only a summary.
- An unassigned Admin, Buyer, or Seller cannot create/read raw evidence or
  decide the case; every denial is audited.
- A risk outcome requires two Admin approvals where financial action follows;
  missing/rejected approval leaves action disabled and no result terminal.
- QA-LAUNCH-001 is recorded as a release gate, never a transaction state.

## Verification

Run QA-RISK-001..002, QA-SEC-003, and QA-LAUNCH-001, including masking,
assignment, two-Admin approval, audit, and gate-state tests. DoD confirms
## Definition Of Done

Internal labels remain task assignments and the ticket stays Draft until review.
