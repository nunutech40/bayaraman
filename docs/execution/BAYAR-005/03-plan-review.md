# Plan Review

## Review Metadata

~~~text
Ticket: BAYAR-005 — Midtrans Payment Webhook and Provider Reconciliation
Plan reviewed: docs/execution/BAYAR-005/02-plan.md v0.1
Reviewer: BayarAman Engineering Review
Review date: 2026-07-29
Decision: Approved
Status: Approved
~~~

## Traceability Review

| Requirement/UX/UI/AC | Planned step | Verification | Covered? |
| --- | --- | --- | --- |
| Webhook validation and settlement authority | 1, 3, 4 | Signature, mismatch, settlement, fraud, and state-version tests | Yes |
| Duplicate, delayed, out-of-order, and conflict handling | 2, 3, 4 | Immutable provider event and join-row precedence tests | Yes |
| Get Status, UNKNOWN, outage, and late-fund | 5, 6 | Provider lookup and Admin recovery tests | Yes |
| Admin authorization and masking | 6, 7 | Admin route, projection, and UI tests | Yes |
| Expiry and no revival | 4, 5 | Deadline and terminal-state tests | Yes |
| Migration and legacy compatibility | 2 | Preflight, decision compatibility, constraint, trigger, and rerun tests | Yes |
| Conflict evidence | 2, 3 | `payment_reconciliation_events` idempotency/concurrency tests | Yes |
| Product, UX, QA, PB, PRD, and TRD traceability | Matrix and Steps 1-8 | Individual ID mappings and acceptance verification | Yes |

## Safety And Correctness Review

| Check | Result | Evidence/comment |
| --- | --- | --- |
| Matches approved user journey | Pass | Midtrans is authoritative only at settlement + accepted fraud; late payment cannot revive a closed transaction. |
| Matches approved UX Flow and UI/UX states | Pass | Provider review, UNKNOWN, expiry, and late-fund states are mapped to concrete Admin screens. |
| Respects state transition guards | Pass | Authority requires exact state, active/unexpired invoice, matching data, and state version. |
| Preserves actor authorization | Pass | Webhook is sessionless; reconciliation is server-side Admin-only; internal assignments are not product roles. |
| Handles sensitive/financial data safely | Pass | Raw payload, credentials, signatures, and participant sensitive data are excluded. |
| Keeps manual/system boundaries explicit | Pass | BAYAR-005 records reconciliation/handoff only and does not execute money movement. |
| Covers failure, retry, and duplicate action | Pass | Response matrix, provider/event idempotency, join-row idempotency, retries, and recovery are concrete. |
| Includes proportional tests | Pass | Migration, unit, integration, concurrency, security, and UI/manual validation are included. |
| Covers relevant responsive and accessibility behavior | Pass | Concrete Admin files include mobile-width and accessibility checks. |
| Avoids unrelated changes | Pass | Invoice creation, expiry ownership, refund, payout, WhatsApp, OTP, cancellation, complaint, and risk remain excluded. |

## Findings

| Severity | Finding | Required change |
| --- | --- | --- |
| Low | `incoming_payload_hash` is non-null for every relation type. Implementation should use the original normalized event payload hash for `PRIMARY_EVENT`, and the incoming conflicting hash for `CONFLICT_EVENT`. | Preserve this mapping in implementation tests; no plan blocker. |
| Low | `decision_code` is nullable for legacy rows and required for new reconciliation rows at the service boundary. | Keep the service-level required check and add a direct new-row test; no plan blocker. |

## Decision

~~~text
Decision: Approved

Required changes before execution: None.

Residual risks accepted:
- The implementation must preserve the distinction between the legacy
  `decision` column and new `decision_code`.
- Provider event rows and reconciliation-event join rows must remain
  insert-only in both application code and PostgreSQL triggers.
- Real Midtrans credential/webhook deployment remains outside this ticket and
  launch-gated by the approved product/technical documents.

Plan Review status: Approved. BAYAR-005 may proceed to implementation/coding.
~~~

No source code, migration, ticket, product document, or implementation plan
was changed by this review.
