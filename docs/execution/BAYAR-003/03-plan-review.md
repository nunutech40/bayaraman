# Plan Review

## Review Metadata

~~~text
Ticket: BAYAR-003 — Transaction Creation, Role-Owned Data, and Invitation Join
Plan reviewed: docs/execution/BAYAR-003/02-plan.md v0.1 Draft
Reviewer: Codex
Decision: Approved
Status: Approved
Reviewed on: 2026-07-29
~~~

## Traceability Review

| Requirement/UX/UI/AC | Planned step | Verification | Covered? |
| --- | --- | --- | --- |
| AC-1: verified Buyer/Seller creation and one invitation | 2-4 | Creation, validation, idempotency, token, and authorization tests | Yes |
| AC-2: verified opposite-role join and role completion | 5-6 | Join, ownership, state-version, freeze, and readiness tests | Yes |
| AC-3: distinct account, ownership, masking, and audit rejection | 5, 7, 8 | Concurrent join, DTO, authorization, and sanitized audit tests | Yes |
| AC-4: frozen readiness without payment creation | 6 and Payment Handoff Contract | Freeze guard and no-payment-boundary integration tests | Yes |
| UR-INIT-001..005 | 2-5 | Create, preview, join, reissue, expiry/revoke/use, and rejection tests | Yes |
| UR-BUYER-001..003 and UR-SELLER-001..003 | 2, 3, 5, 6 | Role-specific validation, ownership, and snapshot tests | Yes |
| UR-PARTICIPANT-001..003 and UR-SYSTEM-001 | 5-8 | Participant binding, masking, idempotency, state, and audit tests | Yes |
| UX-FLOW-002..006 and UX-FLOW-009..012 | 3-9 | API and UI implementation mapping | Yes |
| UI-SCR-002..009 and QA-TRANS-001..006, QA-SEC-001, QA-UI-001 | 9-10 | Unit, integration, security, and manual UI checks | Yes |

## Safety And Correctness Review

| Check | Result | Evidence/comment |
| --- | --- | --- |
| Matches approved user journey | Pass | Both initiator paths, invitation handoff, distinct counterparty, and role-owned data are covered |
| Matches approved UX Flow and UI/UX states | Pass | Pre-payment screens, waiting/frozen states, and recovery states are scoped |
| Respects state transition guards | Pass | Only `WAITING_COUNTERPARTY` and `WAITING_COUNTERPARTY_DATA` are planned; payment handoff remains downstream |
| Preserves actor authorization | Pass | Creation/join/reissue require authenticated verified accounts; creator, opposite-role, Admin, ownership, and state checks are explicit |
| Handles sensitive/financial data safely | Pass | Raw/masked destinations, hashed tokens, sanitized audit, and no-payment boundary are explicit |
| Keeps manual/system boundaries explicit | Pass | Invitation sharing is manual; Midtrans/payment/financial operations are excluded |
| Covers failure, retry, and duplicate action | Pass | Idempotency, state-version conflict, migration collision, freeze rejection, and concurrent mutation recovery are explicit |
| Includes proportional tests | Pass | Unit, PostgreSQL, API, security, concurrency, migration, and manual UI checks match the ticket risk |
| Covers relevant responsive and accessibility behavior | Pass | Mobile-width surface and UI state checks remain manual and in scope |
| Avoids unrelated changes | Pass | No payment, provider, payout, refund, cancellation, risk, WhatsApp group, or later-ticket scope is planned |

## Findings

| Severity | Finding | Resolution |
| --- | --- | --- |
| Blocker | Invitation reissue previously lacked an explicit verified-WhatsApp requirement. | Closed: Step 4, API contract, authorization impact, and tests require a valid session, verified WhatsApp, non-Admin creator ownership, `WAITING_COUNTERPARTY`, state version, and idempotency. |
| High | Active invitation migration previously lacked duplicate preflight and recovery behavior. | Closed: `0005_bayar003_invitation_boundary.sql` includes PostgreSQL `DO` preflight, consistent `invitations_one_active_target_idx`, journal/test coverage, and recovery instructions. |
| High | Freeze enforcement previously lacked an exact mutation guard. | Closed: role-data writes require `frozen_at IS NULL`, transaction ID, `WAITING_COUNTERPARTY_DATA`, and expected state version; attempted writes after freeze are tested. |
| Medium | Index/schema/journal naming and revoked/used compatibility needed to be explicit. | Closed: the same index name is required across schema, migration, journal, and inspection tests; revoked/used rows are excluded by the partial predicate. |
| Medium | Rejection audit ownership and duplicate prevention needed a concrete boundary. | Closed: the transaction/domain mutation service owns one sanitized rejection event and one correlation ID per rejected command, with route/service assertions. |

## Scope Leak Review

The research identified the legacy `saveRoleData` path that calls
`issuePaymentInstructions` and transitions to `WAITING_BUYER_PAYMENT`. The
plan explicitly removes that BAYAR-003 scope leak while retaining legacy
`payment_instructions` as compatibility-only. Midtrans invoice/payment,
webhook, payment review, payout, refund, WhatsApp group, cancellation, risk,
and complaint behavior remain outside this ticket.

## Decision

~~~text
Decision: Approved

Required changes before execution: None.

Residual risks accepted:
1. The migration preflight will fail in an environment containing duplicate
   active invitations; operators must resolve those rows before rerunning the
   unchanged migration.
2. Distinct-account enforcement spans participant rows and therefore remains
   a transaction-locked service invariant with concurrency tests, rather than
   a single-row database check.
3. Responsive/accessibility validation remains a manual checklist for this
   ticket and does not add browser automation.
4. The legacy payment table remains compatibility-only until the owning
   payment ticket replaces the old boundary.
~~~

## Review Completion

- [x] Reviewed against `docs/execution/templates/plan-review-template.md`.
- [x] Reviewed against the BAYAR-003 ticket, research, current plan, PRD v0.2, and TRD v1.2.
- [x] Verified reissue authentication, WhatsApp verification, creator ownership, and state guard.
- [x] Verified migration preflight, index naming, journal entry, collision test, and recovery path.
- [x] Verified exact `frozen_at` write guard and BAYAR-004 ownership of payable-time `locked_at`.
- [x] Verified sanitized rejection audit boundary, one correlation ID, and sensitive-data exclusions.
- [x] Verified no payment/provider behavior, new role, new transaction state, or later-ticket scope.
- [x] Verified traceability and executable validation coverage.
- [x] `git diff --check` passed.

Plan Review status: Approved. BAYAR-003 may proceed to implementation.
