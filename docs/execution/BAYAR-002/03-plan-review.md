# Plan Review

## Review Metadata

~~~text
Ticket: BAYAR-002 — Account Access and WhatsApp Verification
Plan reviewed: docs/execution/BAYAR-002/02-plan.md
Reviewer: Codex
Decision: Approved
Status: Approved
~~~

## Traceability Review

| Requirement/UX/UI/AC | Planned step | Verification | Covered? |
| --- | --- | --- | --- |
| Account access, normalized email, password boundary | 1-4 | unit, migration, and route/service tests | Yes |
| Verified WhatsApp prerequisite | 2, 5-6 | PostgreSQL challenge and verification tests | Yes: advisory lock, active predicate, delivery result, resend, and concurrent verification are concrete |
| One reusable account, transaction-scoped role | 4, 8 | claim and role-start tests | Yes |
| Admin/server authorization and audit | 4, 7, 9 | denial and account-record tests | Yes: server-side helper audits one sanitized denial; middleware remains coarse routing only |
| UI-SCR-001/002 and UX-FLOW-001/002/005/009 | 7-8 | UI/manual checks | Yes |
| QA-ACCOUNT-001..003, QA-SEC-001..002 | 2-9 | unit, integration, and manual checks | Yes |

## Safety And Correctness Review

| Check | Result | Evidence/comment |
| --- | --- | --- |
| Matches approved user journey | Pass | Account/WhatsApp prerequisite is isolated from transaction behavior. |
| Matches approved UX Flow and UI/UX states | Pass | Existing account and role-start screens remain the only UI scope. |
| Respects state transition guards | Pass | No transaction state is added or changed. |
| Preserves actor authorization | Pass | The plan keeps middleware as coarse routing and makes server-side account/Admin checks authoritative and audited. |
| Handles sensitive/financial data safely | Pass | Plan removes plaintext OTP response and retains server-only credentials. |
| Keeps manual/system boundaries explicit | Pass | Delivery is provider-neutral and never authorizes verification. |
| Covers failure, retry, and duplicate action | Pass | Advisory lock, partial unique predicate, adapter `UNKNOWN`, cooldown, and concurrent tests cover issuance and verification. |
| Includes proportional tests | Pass | Unit, PostgreSQL integration, direct route/service, and manual UI checks are proportional. |
| Covers relevant responsive and accessibility behavior | Pass | Existing mobile-width shell and form states are explicitly retained. |
| Avoids unrelated changes | Pass | No transaction, payment, Midtrans, provider API, or confirmation OTP work is planned. |

## Findings

| Severity | Finding | Required change |
| --- | --- | --- |
| Resolved blocker | OTP issuance could race before the partial unique index. | Step 5 now requires a transaction-scoped PostgreSQL advisory lock, exact active predicate, commit-before-delivery, post-delivery result update, `UNKNOWN` on adapter throw, and deterministic concurrent-request behavior. |
| Resolved blocker | Middleware could not be the authorization audit authority. | Steps 4 and 7 explicitly keep middleware as coarse routing and move sanitized one-event denial auditing into server-side authorization. |
| Resolved high | Migration details and predicates were underspecified. | Step 2 names the `DO` preflight, expression index, raw-index compatibility, nullable fields, named check, exact partial-index predicate, and fixtures. |
| Resolved medium | Invalid-session recovery was ambiguous. | Step 4 specifies API `401`, server-page redirect, normal cookie replacement/clearing, and no session store. |
| Resolved medium | Audit payload allowlists were incomplete. | Step 7 lists event-specific fields and excludes challenge IDs and all secrets. |

## Scope Leak Review

No scope leak found. The plan correctly keeps real WhatsApp delivery, session
revocation storage, confirmation-link OTP, transaction authorization, and
payment behavior out of BAYAR-002.

## Decision

~~~text
Decision: Approved

Required changes before execution: None.

Residual risks accepted after revision:
- WhatsApp remains provider-neutral; delivery result is not proof of ownership.
- Persistent logout revocation and WhatsApp E.164 canonicalization remain
  deferred, as recorded in the plan.
~~~

## Review Completion

- [x] Reviewed against the plan-review template.
- [x] All prior blockers are resolved in `02-plan.md`.
- [x] Scope remains limited to BAYAR-002.
- [x] No source code, migration, ticket, or upstream product document was changed.
- [x] Plan is approved for implementation.
