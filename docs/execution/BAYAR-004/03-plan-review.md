# BAYAR-004 Plan Review

## Review Metadata

```text
Ticket: BAYAR-004 — Payment Instructions, Sudah Bayar Claim, and Original Expiry
Plan reviewed: docs/execution/BAYAR-004/02-plan.md v0.1
Reviewer: Codex workflow review
Decision: Approved
Reviewed on: 2026-07-23
```

## Traceability Review

| Requirement/UX/UI/AC | Planned step | Verification | Covered? |
| --- | --- | --- | --- |
| UR-BUYER-004 / UX-FLOW-013 / UI-SCR-010: exact amount, destination, WIB deadline | Steps 1-4 | Config, immutable snapshot, projection, and route tests | Yes |
| UR-BUYER-005 / UX-FLOW-014 / UI-SCR-010: Buyer `Sudah Bayar` | Step 5 | Buyer-only timely claim and state transition | Yes |
| UR-BUYER-009 / UX-FLOW-046: claim pauses expiry without resetting deadline | Steps 5-6 | Fixed-clock claim/expiry race tests | Yes |
| UR-SYSTEM-004 / UX-FLOW-044: deadline starts at instruction issuance | Step 3 | Atomic issuance and deadline test | Yes |
| UR-SYSTEM-005 / UX-FLOW-045: unpaid transaction expires | Step 6 | Before/at/after deadline tests | Yes |
| UR-SYSTEM-006/007 / UX-FLOW-048: recovery remains Admin review boundary | Scope boundary | No bank review or confirmation in BAYAR-004 | Yes |
| Ticket AC: partial, excess, duplicate, and late external funds | Step 8 | Explicit non-authoritative fixtures; no confirmation/deadline reset/new state | Yes |
| One active claim and concurrent commands | Step 5/schema migration | Partial unique index plus concurrent integration test | Yes |
| UI-SCR-009/010 and deferred UI-SCR-021 boundary | Step 7 | Mobile, accessibility, responsive, and disabled/deferred cancellation checks | Yes |

## Safety And Correctness Review

| Check | Result | Evidence/comment |
| --- | --- | --- |
| Matches approved user journey | Pass | Completed role data leads to payment; Buyer claims; Admin review remains next ticket |
| Matches approved UX Flow and UI/UX states | Pass | Payment, claim, deadline, review, expired, loading, and error states are mapped |
| Respects state transition guards | Pass | Only approved transitions to `WAITING_BUYER_PAYMENT`, `PAYMENT_UNDER_REVIEW`, and `PAYMENT_EXPIRED` are planned |
| Preserves actor authorization | Pass | Buyer-only claim and participant-scoped exact/masked projections are explicit |
| Handles sensitive/financial data safely | Pass | Exact receiving account is snapshotted for Buyer only; raw value is excluded from logs, audit, idempotency results, and validation report |
| Keeps manual/system boundaries explicit | Pass | Manual bank transfer is acknowledged; bank review, confirmation, money movement, and later operations are excluded |
| Covers failure, retry, and duplicate action | Pass | Idempotency, state version, partial unique index, atomic expiry update, and rerun behavior are defined |
| Includes proportional tests | Pass | Unit, database, route, fixed-clock, concurrency, external-fund, and UI state tests are planned |
| Covers relevant responsive and accessibility behavior | Pass | UI-SCR-009/010 includes mobile-width, keyboard/focus, labels, and responsive checks; cancellation remains deferred |
| Avoids unrelated changes | Pass | BAYAR-005 review and all later payment/fulfillment/cancellation behavior remain out of scope |

## Findings

| Severity | Finding | Required change |
| --- | --- | --- |
| None | Previous findings are closed in the revised plan. | No further plan change required before execution. |

## Decision

```text
Decision: Approved.

Required changes before execution: None.

Residual risks accepted:
- Production scheduler wiring remains an infrastructure concern; the bounded
  expiry function and local runner are in scope.
- The receiving-account values must be supplied through deployment/local
  environment configuration and must not be committed.
- Bank evidence review and authoritative payment confirmation remain deferred
  to BAYAR-005.
```

## Status

```text
Plan: Draft
Plan review: Approved
Ready for implementation: Yes
```
