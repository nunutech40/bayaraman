# Plan Review

## Review Metadata

```text
Ticket: BAYAR-012 - Background Jobs, Notifications, Audit, and SLA Infrastructure
Plan reviewed: docs/execution/BAYAR-012/02-plan.md v0.1 Draft
Reviewer: Codex
Reviewed on: 2026-07-31
Status: Approved
Decision: Approved
```

## Traceability Review

| Requirement/UX/UI/AC | Planned step | Verification | Covered? |
| --- | --- | --- | --- |
| Invoice expiry, immutable deadline, and no revival: `UR-SYSTEM-005..007`, `UR-BR-009..010`, `UX-FLOW-045..050`, `QA-EXP-001..004` | Steps 4-6 | Fixed-clock, duplicate, concurrency, deadline, audit-count, and no-revival tests | Yes |
| Confirmation reminder and overdue: `UR-BR-014`, `UI-SCR-009`, `UI-SCR-015` | Steps 3, 5, 7, 10, 12 | Queue marker, delivery evidence, final failure, and independent overdue tests | Yes |
| WIB operating SLA and daily escalation: `UR-BR-043`, `QA-SLA-001..002` | Steps 6-8 | WIB boundaries, two-operating-hour target, occurrence sequence, and handled-source tests | Yes |
| Maximum three notification attempts and Admin visibility: `UR-BR-044`, `QA-NOTIFY-001` | Steps 3, 9-12 | Claim/finalize lease, stale result, three-attempt cap, final failure, and authorization tests | Yes |
| Job correlation, idempotency, and duplicate invocation: ticket AC 1 and 4, `QA-SEC-004` | Steps 2-5 | Terminal duplicate, new-key retry, stale-running reclaim, and concurrent claim tests | Yes |
| Append-only audit and corrections: `UR-BR-025`, `QA-SEC-005` | Steps 3, 9, 13 | Insert-only trigger, correction shape, actor-scope, and direct mutation rejection tests | Yes |
| Participant/Admin status and recovery: `UI-SCR-009`, `UI-SCR-012`, `UI-SCR-015`, `UI-SCR-022`, `QA-UI-006` | Steps 10-12 | Authorization, masking, loading, empty, overdue, final-failure, and recovery checks | Yes |
| Financial SLA without inferred success: `UR-SYSTEM-009`, `UR-BR-043`, `UX-FLOW-071..075` | Steps 7-8 | Reconciliation completion, root operation, second approval, retry, and split-leg tests | Yes |

## Safety And Correctness Review

| Check | Result | Evidence/comment |
| --- | --- | --- |
| Matches approved user journey | Pass | Midtrans authority, expiry/no-revival, manual recovery, and separate financial execution remain unchanged |
| Matches approved UX Flow and UI/UX states | Pass | Existing participant/Admin surfaces are reused without adding a feature screen |
| Respects state transition guards | Pass | Jobs retain existing conditional state/version/deadline guards and cannot infer success |
| Preserves actor authorization | Pass | Scheduler is a machine boundary; Admin reads require `SLA_NOTIFICATION_REVIEW` |
| Handles sensitive/financial data safely | Pass | Secrets, signatures, raw payloads, phone numbers, OTP, bank data, and raw evidence are excluded from logs/audit/API |
| Keeps manual/system boundaries explicit | Pass | Jobs and notifications cannot execute money movement or replace manual/provider truth |
| Covers failure, retry, and duplicate action | Pass | Terminal job keys, stale-running reclaim, notification leases, late-result rejection, and recurring occurrences are concrete |
| Includes proportional tests | Pass | Unit, PostgreSQL integration, route, privacy, authorization, fixed-clock, and UI checks cover the ticket risk |
| Covers relevant responsive and accessibility behavior | Pass | Existing mobile-width surfaces include readable loading, empty, overdue, failure, and recovery states |
| Avoids unrelated changes | Pass | Provider integration, payment authority, money movement, new screens, roles, and transaction states remain out of scope |

## Previous Findings Closure

| Previous finding | Resolution in revised plan | Result |
| --- | --- | --- |
| Recurring escalation collided with prior notification identity | Added immutable `occurrence_key`, `ONCE`, and `ESCALATION:<sequence>` with atomic tracker/recipient creation | Closed |
| Reminder due was conflated with delivered/recorded | Added `reminder_queued_at`; `reminder_recorded_at` now requires `SENT` evidence or manual Admin evidence | Closed |
| Terminal failed job retry contradicted idempotency | `SUCCESS` and `FAILED` are terminal per key; deliberate retry requires a new key and correlation; only stale `RUNNING` is reclaimed | Closed |
| Notification claim/finalization was not concurrency-safe | Added three-phase claim, external call, conditional finalization, stale lease recovery, and late-result rejection | Closed |
| Correction rows could consume delivery attempts | Corrections have no attempt number and use separate checked/partial-unique persistence shape | Closed |
| Financial SLA completion was descriptive | Added executable reconciliation, root operation, second approval, and two-leg split completion conditions | Closed |
| Audit actor scope could be forged | Actor scope is derived server-side and constrained against `actor_account_id` | Closed |
| Admin assignment had no provisioning path | Added explicit test/local fixture and controlled production provisioning without auto-assignment | Closed |
| Scheduler-auth rejection logging was undefined | Added sanitized structured runtime security logger outside transactional audit | Closed |

## Findings

| Severity | Finding | Required change |
| --- | --- | --- |
| Low | The production scheduler/queue vendor and external alerting platform remain deployment-specific. This is explicitly deferred by TRD and does not make the application contract ambiguous. | None before implementation; select and document the provider during deployment work. |
| Low | Real WhatsApp delivery remains outside BAYAR-012, so non-test environments use the disabled adapter and can end in bounded `UNKNOWN`/final failure. | None before implementation; retain the fake/disabled adapter boundary until provider integration receives its own approved scope. |
| Low | Operating-hour calculations intentionally do not exclude weekends or public holidays because no holiday calendar is approved. | None; preserve the approved 09:00-21:00 WIB calendar-day behavior. |

## Decision

```text
Decision: Approved

Required changes before execution:
- None.

Residual risks accepted:
- Production scheduler, queue, and external alerting providers remain
  deployment-specific.
- Real WhatsApp delivery remains out of scope; the disabled adapter produces
  bounded UNKNOWN/final-failure evidence.
- Every calendar day is treated as an operating day because no holiday or
  weekend exclusion is approved.
- External delivery remains at-least-once; provider idempotency, immutable
  attempts, leases, and late-result rejection are the safeguards.
```
