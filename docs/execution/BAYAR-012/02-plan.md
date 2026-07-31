# Implementation Plan

## Task

```text
Ticket ID/title: BAYAR-012 - Background Jobs, Notifications, Audit, and SLA Infrastructure
Outcome: Add secured, deployment-neutral scheduler invocation, rerunnable job
claims, capped notification delivery, WIB SLA/escalation tracking, and
append-only operational evidence without inferring transaction or financial
success from timeouts or delivery results.
Source research: docs/execution/BAYAR-012/01-research.md
Source requirements and QA scenarios: UR-SYSTEM-004..011, UR-BR-009,
UR-BR-010, UR-BR-014, UR-BR-025, UR-BR-036, UR-BR-043, UR-BR-044;
QA-EXP-001..004, QA-SLA-001..002, QA-NOTIFY-001, QA-SEC-004..005,
QA-UI-006
Source UX Flow and UI IDs/states: UX-FLOW-045, UX-FLOW-046,
UX-FLOW-048..053, UX-FLOW-071..075; UI-SCR-009, UI-SCR-012,
UI-SCR-015, UI-SCR-022
Version: 0.1
Status: Draft
```

## Approved Implementation Decisions

### Scheduler Boundary

- Keep production scheduler choice external to the application. BAYAR-012
  provides a deterministic HTTP/CLI invocation contract and does not add a
  persistent worker dependency.
- Add `POST /api/jobs/[jobName]` with a fixed allowlist:
  - `payment-expiry`
  - `confirmation-reminder`
  - `confirmation-overdue`
  - `payment-reconciliation-sla`
  - `cancellation-reconciliation-timeout`
  - `cancellation-response-timeout`
  - `financial-sla-escalation`
  - `notification-delivery`
- The `payment-expiry` slug preserves the TRD route
  `POST /api/jobs/payment-expiry`.
- Machine invocation uses:
  - `X-BayarAman-Job-Timestamp`
  - `X-BayarAman-Job-Idempotency-Key`
  - `X-BayarAman-Job-Signature`
- Signature input is:
  `HTTP method + path + timestamp + idempotency key + SHA-256 body hash`,
  signed with HMAC-SHA256 and compared with `timingSafeEqual`.
- Accept a timestamp skew of at most 300 seconds. Reject missing, malformed,
  stale, or invalid signatures before any job claim is created.
- Add `JOB_SCHEDULER_SECRET` to `.env.example`; it must contain at least 32
  random bytes. The actual value is never committed, logged, audited, or
  returned.
- CLI runners call the same orchestrator directly with a generated
  `SYSTEM:<job-name>` invocation and do not make a local HTTP request.
- A machine invocation is not an account and does not create a product role.

### Job Claim And Retry Contract

- `job_runs` is the current projection for one logical invocation.
- Logical identity is unique `(job_name, idempotency_key)`.
- A matching key and request hash returns the existing run/result.
- A matching key with a different hash is rejected as
  `JOB_IDEMPOTENCY_CONFLICT` and audited without executing domain work.
- Initial claim uses `INSERT ... ON CONFLICT`; recovery takes a row lock and
  may reclaim only stale `RUNNING` work whose lease expired.
- `SUCCESS` and `FAILED` are terminal for one `(job_name, idempotency_key)`.
  A duplicate terminal invocation returns its persisted projection and never
  executes domain work again.
- A deliberate retry after terminal `FAILED` uses a new scheduler idempotency
  key and receives a new logical correlation ID. Domain state/version/deadline
  guards remain the duplicate-work protection across logical runs.
- Lease duration is five minutes. Reclaim uses expected run version and
  increments `attempt_count`; concurrent callers cannot both own the lease.
- `job_run_attempts` is append-only final evidence for each attempt. The
  mutable `RUNNING` lease exists only on `job_runs`; completion inserts one
  immutable `SUCCESS`, `FAILED`, or `UNKNOWN` attempt row. A process crash is
  recorded as `UNKNOWN` before the stale `RUNNING` lease is reclaimed; it is
  not treated as success.
- Job run result vocabulary is internal operational metadata:
  `RUNNING`, `SUCCESS`, `FAILED`. `UNKNOWN` is attempt evidence only, not a
  `job_runs` status, transaction state, or financial result.
- One correlation ID belongs to the logical run and is passed to all domain
  mutations, notification intents, and audit events created by that run.
- Existing domain sweeps continue to update each due aggregate in its own
  database transaction. A job-run transaction must not remain open while the
  whole batch executes.
- Each sweep processes at most 100 due rows per invocation in stable
  `(deadline, id)` order. A following invocation continues from canonical due
  rows; correctness does not depend on in-memory cursors.

### Invocation Cadence

| Job | Recommended external cadence |
| --- | --- |
| Payment expiry | Every minute |
| Confirmation reminder/overdue | Every five minutes |
| Payment reconciliation SLA | Every five minutes |
| Cancellation reconciliation/response timeout | Every five minutes |
| Financial SLA escalation | Every fifteen minutes |
| Notification delivery | Every minute |

- These are deployment recommendations, not an in-process scheduler.
- Correctness uses persisted absolute deadlines; a delayed invocation processes
  overdue work without resetting the original deadline.

### SLA Source Timestamps

| SLA type | Canonical start | Target | Completion |
| --- | --- | --- | --- |
| Midtrans/payment reconciliation | `payment_reconciliations.created_at` | `addOperatingMinutesWib(start, 120)` | `payment_reconciliations.completed_at IS NOT NULL` |
| Confirmation reminder | `confirmation_links.reminder_due_at` | Existing absolute due time | `reminder_recorded_at IS NOT NULL` after `SENT` evidence or manual Admin record |
| Confirmation overdue | `confirmation_links.expires_at` | Existing 2x24-hour deadline | `overdue_at IS NOT NULL` or confirmation completed |
| Cancellation reconciliation | Existing `cancellation_reconciliations.deadline_at` | Existing two-operating-hour deadline | `status IN ('RESOLVED','TIMED_OUT')` |
| Funded cancellation response | Existing `cancellation_requests.response_deadline_at` | Existing 1x24-hour deadline | Response head exists, request closes, or manual review is recorded |
| Normal Seller payout | First append-only audit event that transitions the transaction to `READY_FOR_PAYOUT` | Start + 1x24 hours | Root payout operation has `SUCCESS` with evidence/reference |
| Refund/split | Timestamp of the second distinct `APPROVED` row for the root operation | Start + 2x24 hours | Every required root/child operation has `SUCCESS` with evidence/reference |

- Payout/refund/split targets are calendar-hour targets; only the payment
  reconciliation target pauses outside 09:00-21:00 WIB.
- Existing payment reconciliation resolution paths must close open
  reconciliation rows atomically when their existing provider classification
  is authoritative or definitive non-paid: set reconciliation
  `result='SUCCESS'`, preserve its existing decision/decision code, store the
  canonical provider evidence reference, and set `completed_at` to the
  resolution timestamp. Here `SUCCESS` means reconciliation completed, not
  payment or financial success. `UNKNOWN`, `pending`, and other unresolved
  results remain `result='UNKNOWN'` with `completed_at` null. Add a database
  check limiting this reconciliation field to `SUCCESS|UNKNOWN`. BAYAR-012
  does not add provider parsing or payment authority rules.
- Payout tracker `source_id` is the financial root operation ID. Its canonical
  start is the earliest append-only audit row for the transaction whose
  `after_state` is `READY_FOR_PAYOUT`.
- Refund and split tracker `source_id` is the financial root operation ID.
  Their canonical start is the second chronological `APPROVED` row from two
  distinct Admin accounts for that root, ordered by `(created_at, id)`. A
  tracker is not created before this row exists.
- Payout/refund completes when any operation attempt under the root and
  required operation type has `SUCCESS`, non-empty external reference, and
  evidence hash. Split completes only when both `SPLIT_BUYER` and
  `SPLIT_SELLER` under the same root meet that condition. A missing Seller leg,
  `FAILED`, `UNKNOWN`, or `PROCESSING` leaves the tracker open.
- Existing finance operations receive a documented legacy fallback to
  `prepared_at` only when no valid eligibility/second-approval evidence exists.
  The tracker records `LEGACY_FALLBACK` so Admin can distinguish it.
- All API projections include ISO timestamps and formatted WIB labels.
- Passing a target never changes a financial result. It only creates or
  advances an escalation and makes the delay visible.
- Escalation starts when the target is passed and repeats every 1x24 hours
  until the canonical completion condition is true.

### Notification Contract

- Add a shared provider-neutral notification outbox. It does not integrate a
  real WhatsApp API.
- Notification channel vocabulary is `IN_APP` or `WHATSAPP`.
- Delivery result vocabulary is only
  `PENDING`, `SENT`, `FAILED`, `UNKNOWN`.
- A notification intent is unique by
  `(notification_type, source_type, source_id, recipient_scope, channel,
  occurrence_key)`.
- One-time domain events use `occurrence_key='ONCE'`. Recurring SLA notices use
  `occurrence_key='ESCALATION:<sequence>'`.
- The escalation sweep locks the tracker, derives the next sequence, inserts
  all recipient intents for that occurrence, increments `escalation_count`,
  and advances `next_escalation_at` by 1x24 hours in one transaction.
  Duplicate/concurrent execution returns the existing occurrence.
- `IN_APP` is inserted directly as `SENT` with one immutable `SENT` attempt in
  the intent-creation transaction; it does not use the delivery worker.
- Each `WHATSAPP` intent has at most three delivery attempts. `FAILED` and
  `UNKNOWN` consume an attempt. After attempt three, `final_failure_at` is
  recorded and the failure remains visible to Admin.
- Delivery failure, final failure, provider outage, or notification timeout
  never changes transaction state, transaction state version, financial
  result, or manual checkpoint truth.
- `IN_APP` intent creation makes the message visible from canonical database
  state; it does not require an external provider call.
- `WHATSAPP` uses a `NotificationDeliveryAdapter`. BAYAR-012 ships only a fake
  adapter for tests and a disabled adapter that returns `UNKNOWN` outside
  configured provider integration.
- The adapter receives an idempotency key derived from notification ID and
  attempt number. Raw message bodies, phone numbers, provider secrets, OTP,
  bank values, and WhatsApp evidence do not enter audit or job logs.
- `notification_attempts` is insert-only. Corrections append a new
  `CORRECTION` evidence row pointing to the prior attempt; previous evidence is
  never updated or deleted.

### Notification Delivery Algorithm

1. Claim transaction:
   - Select one due `WHATSAPP` intent using `FOR UPDATE SKIP LOCKED`.
   - Reject `SENT`, final failure, or `attempt_count >= 3`.
   - Increment `attempt_count`, copy it to `active_attempt_number`, generate a
     random lease owner, store only its hash, set a five-minute
     `lease_expires_at`, and increment `notification_version`.
2. Provider call:
   - Commit the claim transaction.
   - Call the adapter outside the database transaction with idempotency key
     `<notification-id>:<attempt-number>`.
3. Conditional finalization:
   - Lock the intent and accept the result only when notification ID, version,
     active attempt number, lease-owner hash, and unexpired lease all match.
   - Insert one immutable `DELIVERY_RESULT` row and update the projection.
   - A late result from an expired/replaced lease is rejected and receives a
     sanitized audit event; it cannot overwrite the newer attempt.
4. Stale recovery:
   - Lock the expired intent, append `UNKNOWN` for the abandoned attempt if no
     delivery row exists, clear its lease, and either allocate the next attempt
     or set final failure when the third attempt was consumed.
   - Attempt four is rejected at both service and database boundaries.

Correction rows have no attempt number. They require
`corrected_attempt_id` and `correction_reason`, do not consume an attempt, and
do not automatically alter intent status, attempt count, or final-failure
truth.

### Confirmation Reminder Truth

- Add `confirmation_links.reminder_queued_at`.
- The due sweep atomically creates the one-time notification intent and sets
  `reminder_queued_at`; it must not write `reminder_recorded_at` or
  `SYSTEM_REMINDER_DUE`.
- `reminder_recorded_at`, recorder, and evidence are written only when the
  `WHATSAPP` notification finalizes as `SENT` or an Admin records manual
  evidence through the existing reminder boundary.
- Three failed/unknown attempts leave the reminder unconfirmed, expose final
  failure to Admin, and do not block the independent 2x24-hour overdue sweep.

### Notification Matrix

| Event | Recipient/surface | Channel |
| --- | --- | --- |
| Payment expired | Buyer and Seller on UI-SCR-009 | `IN_APP` |
| Buyer confirmation reminder | Buyer on UI-SCR-009/confirmation state | `IN_APP`; provider-neutral `WHATSAPP` to the frozen Buyer snapshot |
| Buyer confirmation overdue | Buyer on UI-SCR-009 and assigned Admin on UI-SCR-015 | `IN_APP` |
| Payment reconciliation SLA breach | Admin with `SLA_NOTIFICATION_REVIEW` assignment on UI-SCR-022 | `IN_APP` |
| Cancellation reconciliation/response timeout | Request participants on UI-SCR-009 and assigned Admin on UI-SCR-022/UI-SCR-012 | `IN_APP` |
| Payout SLA breach | Seller on UI-SCR-009 and assigned Admin on the existing financial operations surface | `IN_APP` |
| Refund SLA breach | Buyer on UI-SCR-009 and assigned Admin on the existing financial operations surface | `IN_APP` |
| Split SLA breach | Buyer, Seller, and assigned Admin on existing transaction/financial surfaces | `IN_APP` |

- This matrix adds delivery infrastructure and existing-screen visibility only;
  it does not add a new product message policy or feature screen.

### Admin Authorization And Audit

- Add internal task assignment scope `SLA_NOTIFICATION_REVIEW`.
- Admin SLA/notification queries require both `accounts.is_admin=true` and an
  active `SLA_NOTIFICATION_REVIEW` assignment.
- Existing domain actions retain their existing domain assignments. The new
  scope cannot execute payment reconciliation, cancellation, payout, refund,
  or other financial actions.
- Add non-null `actor_scope` to `audit_events`. User/Admin events keep
  `ACCOUNT:<accountId>`; job events use `SYSTEM:<job-name>`.
- `recordTransactionEvent` derives actor scope server-side. Account events
  require `actor_scope='ACCOUNT:<actor_account_id>'`; system events require
  `actor_account_id IS NULL`. Callers cannot supply an arbitrary scope.
- Audit rows remain insert-only. Notification attempts and job attempts also
  receive insert-only database triggers.
- Successful domain mutation and its transaction audit remain atomic. Job-run
  completion is operational evidence and does not replace domain audit.
- Rejected scheduler authentication is written only to the structured runtime
  security logger in `src/server/jobs/observability.ts` with event category,
  route, reason code, and timestamp. It is not transactional audit because no
  trusted job identity exists. Headers, signature, secret, body, IP-derived
  identity, and other request data are excluded.
- Do not auto-assign `SLA_NOTIFICATION_REVIEW`. Tests/local seed helpers create
  an explicit assignment through the existing Admin assignment fixture.
  Production handoff documents a one-time database/operations provisioning
  step performed by an already-authorized Admin operator and validates the
  resulting read boundary.

## Scope

### In Scope

- Additive database migration `0014_bayar012_jobs_notifications_sla.sql`.
- Secured machine scheduler invocation and shared CLI orchestration.
- Durable job claim, lease, retry, result, correlation, and append-only
  attempt evidence.
- Existing invoice expiry, confirmation recovery, cancellation timeout, and
  response timeout wired through the shared job context.
- Payment reconciliation, payout, refund/split SLA tracker creation and daily
  escalation sweeps.
- Provider-neutral notification intent, capped attempt, final failure, and
  append-only correction boundaries.
- Existing participant/Admin projection updates for deadline, escalation, and
  final notification failure.
- Fixed-clock, WIB, duplicate/concurrent invocation, outage, retry, audit, and
  privacy tests.

### Out Of Scope

- Real WhatsApp, email, SMS, push, Midtrans, payout, or refund provider
  integration.
- Parsing external provider messages or deciding payment authority.
- Executing payout, refund, split, cancellation outcome, complaint outcome, or
  risk outcome.
- New product role, transaction state, financial result, feature screen, or
  desktop dashboard.
- Persistent in-process worker, queue vendor, cron vendor, deployment
  platform selection, external alerting vendor, or holiday calendar.
- Changes to Product Brief, User Journey, UX Flow, User Requirements, UI/UX
  Specification, QA Scenarios, PRD, TRD, or engineering tickets.

## Planned Changes

| Step | Change | File/module | Requirement/UX/UI/AC covered | Verification |
| --- | --- | --- | --- | --- |
| 1 | Add Zod contracts and fixed job/notification/SLA vocabularies; reject unknown job names and unsafe payloads | `src/server/jobs/contracts.ts`, `src/server/notifications/contracts.ts`, `src/server/sla/contracts.ts` | UR-BR-025, UR-BR-043, UR-BR-044; AC secured deterministic boundary | Unit tests reject unsupported names, channels, result values, timestamps, and recipient scopes |
| 2 | Add scheduler secret loading and HMAC verification with 300-second replay window and constant-time comparison | `src/server/jobs/auth.ts`, `.env.example` | TRD Sections 10, 12, 15; QA-SEC-004 | Unit/route tests cover valid, missing, malformed, stale, forged signature, changed body/path, and secret redaction |
| 3 | Add job-run projection, append-only attempts, SLA trackers, occurrence-aware notification intents/attempts, reminder queue marker, derived audit actor scope, and Admin task scope | `src/server/db/schema.ts`, `drizzle/0014_bayar012_jobs_notifications_sla.sql`, `drizzle/meta/_journal.json` | UR-BR-025, UR-BR-043, UR-BR-044; QA-SEC-004..005, QA-NOTIFY-001 | Clean migration, shape/partial-unique constraints, triggers, direct-SQL rejection, repeat occurrence, and rollback tests |
| 4 | Implement atomic job claim/reclaim/complete orchestration with terminal key semantics | `src/server/jobs/repository.ts`, `src/server/jobs/orchestrator.ts`, `src/server/jobs/registry.ts` | Ticket AC 1 and 4; QA-SEC-004, QA-UI-006 | SUCCESS/FAILED duplicate returns prior result; retry uses new key; concurrent claim has one owner; only stale RUNNING appends UNKNOWN then reclaims |
| 5 | Refactor existing jobs to accept `{ now, correlationId, jobRunId }`, preserve per-aggregate transactions, fix confirmation sweep identity, and separate queued reminder from delivered evidence | `src/server/jobs/payment-expiry.ts`, `src/server/confirmation/recovery.ts`, `src/server/confirmation/service.ts`, `src/server/jobs/cancellation-reconciliation-timeout.ts`, `src/server/jobs/cancellation-response-timeout.ts` | UR-SYSTEM-005..007, UR-BR-009, UR-BR-010, UR-BR-014; UX-FLOW-045..050; QA-EXP-001..004 | Fixed-clock and concurrent tests prove one transition/audit, immutable deadline, no revival, no same-hour conflict, and no false reminder delivery |
| 6 | Expand WIB helpers for formatting, open-window checks, and deterministic two-operating-hour targets without weekends/holiday exclusions | `src/server/domain/time/operating-hours.ts`, `src/server/domain/time/wib.ts` | UR-BR-043; QA-SLA-001 | Unit tests at 08:59, 09:00, 20:59, 21:00 WIB and cross-day two-hour calculations |
| 7 | Create/update SLA trackers from executable reconciliation, confirmation, cancellation, and financial root queries; close existing payment reconciliation rows on current authoritative/definitive resolution paths | `src/server/sla/repository.ts`, `src/server/sla/sources.ts`, `src/server/sla/service.ts`, `src/server/payment/reconciliation.ts`, `src/server/payment/provider-webhook.ts` | UR-BR-014, UR-BR-043; UX-FLOW-046, UX-FLOW-050, UX-FLOW-071..075; QA-SLA-001..002 | Tests verify exact source timestamps, open/complete queries, split root/legs, retry attempts, fallback marker, and no inferred financial success |
| 8 | Implement daily SLA escalation sweep with atomic sequence allocation, occurrence-aware recipient intents, and next deadline | `src/server/jobs/sla-escalation.ts` | UR-BR-043, UR-BR-044; QA-SLA-002 | First occurrence, duplicate, concurrent run, second-day occurrence, and handled-source stop all pass |
| 9 | Implement provider-neutral notification outbox with direct IN_APP delivery, three-phase WHATSAPP lease/finalization, append-only attempts/corrections, and max-three enforcement | `src/server/notifications/repository.ts`, `src/server/notifications/service.ts`, `src/server/notifications/adapters.ts`, `src/server/jobs/notification-delivery.ts` | UR-BR-036, UR-BR-044; UX-FLOW-045, UX-FLOW-050; QA-NOTIFY-001, QA-SEC-005 | IN_APP commits SENT; late lease result rejects; FAILED/UNKNOWN consume at most three; correction shape is isolated; final failure is state-neutral |
| 10 | Emit occurrence-aware notification intents from successful domain transitions/SLA escalation and record actual confirmation reminder delivery separately from queueing | Existing job modules plus `src/server/notifications/factory.ts` | UI-SCR-009, UI-SCR-012, UI-SCR-015, UI-SCR-022; QA-NOTIFY-001 | Domain transaction commits intent; reminder queued is not recorded; SENT/manual evidence records it; delivery failure leaves canonical state unchanged |
| 11 | Add signed job route and consolidate CLI runners around the same registry/orchestrator | `src/app/api/jobs/[jobName]/route.ts`, `src/server/jobs/run-job.ts`, `src/server/jobs/run-*.ts`, `package.json` | TRD Section 10; ticket secured invocation AC | Route/CLI parity tests; unauthorized request creates no run; npm commands execute with fixed test clock |
| 12 | Add Admin-only SLA/notification query projections and extend existing pages without a new feature screen | `src/server/sla/projection.ts`, `src/app/api/admin/tasks/sla/route.ts`, `src/app/admin/payment-review/page.tsx`, `src/app/admin/confirmation/page.tsx`, `src/app/admin/cancellations/page.tsx`, `src/app/admin/financial-operations/page.tsx`, `src/app/transactions/[id]/page.tsx` | UI-SCR-009, UI-SCR-012, UI-SCR-015, UI-SCR-022; QA-UI-006 | Assignment/unauthorized tests, masking tests, and manual mobile-width loading/empty/error/final-failure checks |
| 13 | Add derived audit actor scope, structured sanitized runtime security logging, and explicit local/production assignment provisioning handoff | `src/server/transaction/audit.ts`, `src/server/jobs/observability.ts`, job runners/routes, test fixtures, `docs/execution/BAYAR-012/04-validation.md` handoff section | UR-BR-025, UR-BR-044; QA-SEC-005 | Actor/scope mismatch direct-SQL tests, assignment access test, and captured logs prove no secret, signature, phone, OTP, bank, provider payload, or raw evidence |
| 14 | Add complete unit/integration/route regression suite and validation commands | `tests/unit/jobs.test.ts`, `tests/unit/operating-hours.test.ts`, `tests/integration/jobs-notifications-sla.test.ts`, focused existing tests | All ticket QA and acceptance criteria | PostgreSQL integration suite, typecheck, lint, build, migration/status, healthcheck, and `git diff --check` |

## Schema And Migration Plan

### `job_runs`

| Column | Contract |
| --- | --- |
| `id` | UUID primary key |
| `job_name` | Fixed allowlist matching scheduler slugs |
| `idempotency_key` | Caller-provided logical invocation key |
| `request_hash` | Hash of canonical job input |
| `correlation_id` | UUID, immutable for the logical run |
| `status` | Current logical result: `RUNNING|SUCCESS|FAILED` |
| `run_version` | Optimistic lease/version guard |
| `attempt_count` | Positive count of claimed attempts |
| `scheduled_for` | Absolute timestamp supplied by scheduler |
| `lease_expires_at` | Five-minute lease while running |
| `result` | Sanitized JSON result/counts only |
| `error_category` | Sanitized bounded category, never raw error |
| `started_at`, `completed_at`, `created_at`, `updated_at` | Operational timestamps |

Constraints/indexes:

- Unique `(job_name, idempotency_key)`.
- Unique `correlation_id`.
- Check status lifecycle, terminal timestamps/results, lease fields, and
  `attempt_count > 0`.
- Due/recovery index on `(status, lease_expires_at)`.
- `SUCCESS`/`FAILED` rows cannot return to `RUNNING`; only stale `RUNNING`
  can advance `run_version` and allocate another attempt.

### `job_run_attempts`

- Fields: `id`, `job_run_id`, `attempt_number`, `result`,
  `started_at`, `completed_at`, `lease_owner_hash`, `error_category`,
  `correlation_id`, `created_at`.
- Unique `(job_run_id, attempt_number)`.
- Result is final-only: `SUCCESS|FAILED|UNKNOWN`.
- One row is inserted when the attempt finishes or when a stale lease is
  recovered as `UNKNOWN`; rows are never inserted as `RUNNING`.
- Trigger rejects `UPDATE` and `DELETE`.
- Lease owner is stored only as a hash and is never returned to clients.

### `sla_trackers`

- Fields: `id`, `transaction_id`, `sla_type`, `source_type`, `source_id`,
  `source_timestamp_kind`, `started_at`, `target_at`, `handled_at`,
  `next_escalation_at`, `escalation_count`, `last_escalated_at`,
  `created_at`, `updated_at`.
- SLA type allowlist:
  `PAYMENT_RECONCILIATION`, `CONFIRMATION_REMINDER`,
  `CONFIRMATION_OVERDUE`, `CANCELLATION_RECONCILIATION`,
  `CANCELLATION_RESPONSE`, `PAYOUT`, `REFUND`, `SPLIT`.
- Source timestamp kind allowlist:
  `CANONICAL`, `LEGACY_FALLBACK`.
- Unique `(sla_type, source_type, source_id)`.
- Check target is not before start; handled trackers cannot produce another
  escalation.
- Due index on `(handled_at, next_escalation_at)`.

### `notifications`

- Fields: `id`, `transaction_id`, `notification_type`, `source_type`,
  `source_id`, `recipient_scope`, `recipient_account_id`, `channel`,
  `occurrence_key`,
  `payload_snapshot_hash`, `status`, `attempt_count`, `next_attempt_at`,
  `last_attempt_at`, `active_attempt_number`, `lease_owner_hash`,
  `lease_expires_at`, `notification_version`, `sent_at`, `final_failure_at`,
  `correlation_id`, `created_at`, `updated_at`.
- Unique notification identity:
  `(notification_type, source_type, source_id, recipient_scope, channel,
  occurrence_key)`.
- `occurrence_key` is `ONCE` or `ESCALATION:<positive integer>`.
- `attempt_count` is between zero and three.
- Status is `PENDING|SENT|FAILED|UNKNOWN`.
- `SENT` requires `sent_at`; final failure requires attempt count three and
  cannot be `SENT`.
- `IN_APP` requires `SENT`, attempt count one, no active lease, and one
  immutable `SENT` delivery row.
- `WHATSAPP` delivery claim uses `notification_version`, active attempt,
  lease-owner hash, and a five-minute lease.
  Reclaiming an expired lease appends an `UNKNOWN` result for the interrupted
  attempt before claiming the next attempt.
- Participant targets require `recipient_account_id`; Admin queue targets use
  `recipient_scope='ADMIN:SLA_NOTIFICATION_REVIEW'`.

### `notification_attempts`

- Fields: `id`, `notification_id`, nullable `attempt_number`, `event_type`,
  `result`, `provider_reference`, `error_category`,
  `corrected_attempt_id`, `correction_reason`, `correlation_id`,
  `attempted_at`, `created_at`.
- Event type is `DELIVERY_RESULT|CORRECTION`.
- Partial unique delivery attempt `(notification_id, attempt_number)` where
  `event_type='DELIVERY_RESULT'`.
- `DELIVERY_RESULT` requires a positive attempt number and forbids correction
  fields. `CORRECTION` requires a target and non-empty reason, requires
  `attempt_number IS NULL`, and does not increase the notification attempt
  count or alter its projection automatically.
- Trigger rejects `UPDATE` and `DELETE`.

### Existing Table Changes

- `audit_events.actor_scope` non-null with check:
  `ACCOUNT:<uuid>` or `SYSTEM:<job-name>`.
- Existing rows backfill `ACCOUNT:<actor_account_id>` where actor exists;
  legacy rows without an actor backfill
  `SYSTEM:legacy-<audit-event-id>`.
- Add consistency checks: an account scope must match
  `actor_account_id`; a system scope requires `actor_account_id IS NULL`.
- Add nullable `confirmation_links.reminder_queued_at`; do not backfill it from
  legacy `reminder_recorded_at`.
- Add `payment_reconciliations_result_check` for
  `result IN ('SUCCESS','UNKNOWN')` after preflight confirms existing values.
- Expand `admin_task_assignments_scope_check` with
  `SLA_NOTIFICATION_REVIEW`; do not create assignments automatically.
- Do not alter transaction-state or financial-result enums.

### Migration Ordering And Safety

1. Run preflight checks for duplicate idempotency/correlation candidates,
   malformed current assignment scopes, invalid reconciliation result values,
   and invalid audit actor references.
2. Create new tables with nullable foreign references where required.
3. Add indexes and check constraints.
4. Add nullable `audit_events.actor_scope`, backfill every row to account or
   legacy-system scope, set it non-null, then add format and actor/account
   consistency checks.
5. Add `confirmation_links.reminder_queued_at` without deriving it from the
   existing recorded/delivery field.
6. Replace the Admin task-scope check constraint with the additive value.
7. Install insert-only triggers for job and notification attempt tables.
8. Seed no job, assignment, notification, or SLA business row. Add only an
   explicit test/local assignment fixture outside the production migration.
9. Commit all DDL in one PostgreSQL transaction and update Drizzle journal.

Migration verification includes clean database, populated current database,
preflight failure fixture, rollback, rerun, trigger rejection, and downgrade
instructions. Rollback before production use drops only BAYAR-012 tables,
indexes, triggers, the nullable audit column, and restores the prior assignment
check. Persisted production job/notification evidence must be exported before
any destructive rollback.

## Concrete API Contract

### `POST /api/jobs/[jobName]`

Request:

```json
{
  "scheduledFor": "2026-07-30T10:00:00.000Z",
  "parameters": {}
}
```

Rules:

- Only the fixed job allowlist is accepted.
- Signature headers are mandatory.
- `scheduledFor` is the injected job clock and is included in the request hash.
- `parameters` is empty for current jobs; unknown keys are rejected.
- Success returns the persisted logical job projection:
  `jobRunId`, `jobName`, `status`, `correlationId`, `attemptCount`,
  `scheduledFor`, and sanitized result counts.
- Duplicate key/hash returns HTTP 200 with the same projection.
- Active non-stale run returns HTTP 202.
- Different hash returns HTTP 409.
- Invalid/stale signature returns HTTP 401 without creating a job row.
- Domain failure returns sanitized HTTP 500/503 and a terminal persisted
  `FAILED` run. Repeating its key returns that original failed projection.
- A deliberate retry uses a new idempotency key. Only a stale `RUNNING` run
  may continue under its existing key and correlation ID.

### `GET /api/admin/tasks/sla`

Query parameters:

- Optional `domain`:
  `PAYMENT|CONFIRMATION|CANCELLATION|FINANCIAL`.
- Optional `status`: `OPEN|OVERDUE|FINAL_NOTIFICATION_FAILURE`.
- Cursor pagination only; no raw evidence payload.

Response contains:

- Tracker/notification IDs.
- Transaction ID.
- Domain/type.
- Target and next escalation in ISO and WIB.
- Escalation/attempt counts.
- Current canonical transaction/financial status.
- Final failure indicator.
- Allowed recovery route reference, not an executable cross-domain action.

Authorization:

- Authenticated Admin.
- Active `SLA_NOTIFICATION_REVIEW` assignment.
- No Buyer/Seller access.

### Existing Participant/Admin Projections

- Add only masked status summary, deadline, escalation state, and
  notification final-failure state appropriate to the viewer.
- Never expose scheduler headers, job result JSON, phone snapshots, raw
  provider references, raw evidence, OTP, or bank destination values.

## State And Data Impact

```text
State transitions added/changed:
- No new transaction state or financial result.
- Existing payment expiry, confirmation overdue, cancellation reconciliation
  timeout, and cancellation response timeout transitions remain unchanged.
- SLA/notification jobs never produce PAID_OUT, REFUNDED, SPLIT_SETTLED,
  PAYMENT_CONFIRMED, or another success state/result.

Schema/migration impact:
- Add job_runs, job_run_attempts, sla_trackers, notifications, and
  notification_attempts.
- Add non-null audit_events.actor_scope after complete migration backfill.
- Add internal SLA_NOTIFICATION_REVIEW task assignment scope.
- Migration: drizzle/0014_bayar012_jobs_notifications_sla.sql.

Authorization impact:
- Scheduler uses HMAC machine authentication and SYSTEM actor scope.
- Admin SLA/notification query requires SLA_NOTIFICATION_REVIEW assignment.
- Existing domain mutation permissions are unchanged.

Audit/notification impact:
- Domain transitions retain atomic append-only audit.
- Job and notification attempts gain immutable operational evidence.
- Recurring escalations receive a new occurrence key each 1x24 hours.
- WHATSAPP notifications stop after three attempts; final failure is
  Admin-visible. IN_APP delivery commits as SENT immediately.
- Reminder queued/due is distinct from reminder delivered/recorded.
- Failure never changes canonical transaction or financial truth.

Manual operation impact:
- Admin receives an existing-screen task/status projection and follows the
  existing domain recovery route.
- No new adjudication, financial execution, or provider workflow is introduced.
```

## Test Plan

| Layer | Case | Expected evidence |
| --- | --- | --- |
| Static/lint/type | Contracts, allowlists, route inputs, projection types | `npm run typecheck`, `npm run lint`, and `npm run build` pass |
| Unit | HMAC valid/invalid/stale/changed input | Only exact valid signed request is accepted; secret never appears in output |
| Unit | WIB boundaries and two operating hours | Timer pauses before 09:00 and after 21:00 WIB and resumes next calendar day |
| Unit | Financial SLA source selection | Payout uses READY_FOR_PAYOUT audit; refund/split uses second approval; fallback is labeled |
| Integration | Migration clean/current/preflight/rollback/rerun | `0014` applies once with all constraints/triggers and no data loss |
| Integration | Duplicate/concurrent job claim | One lease owner and one logical result; same key/hash returns original |
| Integration | Terminal failed job retry | Same key returns original FAILED; a new key creates a new correlation and safe logical run |
| Integration | Stale job lease | Prior attempt becomes UNKNOWN; only stale RUNNING reclaims with the same logical correlation |
| Integration | Payment expiry boundary | One transition/audit at deadline; before deadline unchanged; no revival |
| Integration | Confirmation reminder/overdue | Queue marker and intent are idempotent; due is not recorded as delivered; SENT/manual evidence records it; final failure does not block overdue |
| Integration | Cancellation timeouts | Approved manual-review transition occurs once with preserved evidence |
| Integration | Reconciliation operating SLA | Two operating hours pause outside 09:00-21:00 WIB; breach creates escalation only |
| Integration | Payment reconciliation SLA | Target uses createdAt plus two operating hours; only completedAt closes; UNKNOWN/pending stays open |
| Integration | Financial SLA | Payout uses READY_FOR_PAYOUT audit; refund/split use second approval; root retry and both split legs determine completion |
| Integration | Escalation cadence | ONCE/ESCALATION sequence is unique; duplicate/concurrent first occurrence is stable; +24h creates the next occurrence; handled source stops |
| Integration | IN_APP notification | Intent and immutable SENT attempt commit atomically without delivery worker |
| Integration | WHATSAPP success | Matching lease/version/attempt SENT closes intent and appends immutable evidence |
| Integration | Notification repeated failure | Exactly three attempts; final failure visible; fourth attempt rejected |
| Integration | Notification UNKNOWN/crash | Stale lease appends UNKNOWN, consumes attempt, and remains bounded |
| Integration | Notification late result | Result from replaced/expired lease is rejected and cannot overwrite current projection |
| Integration | Notification correction | Nullable attempt shape and partial unique index hold; correction does not consume attempt or alter final truth |
| Integration | State/result isolation | Notification/job failure leaves transaction state/version and financial result unchanged |
| Route/auth | Scheduler invocation | Invalid signature creates no job; duplicate valid invocation returns same result |
| Route/auth | Admin query | Assigned Admin succeeds; unassigned Admin and participants receive forbidden |
| Authorization fixture | SLA assignment provisioning | Test/local fixture grants one explicit Admin; production handoff documents controlled assignment without auto-assign |
| Audit | Actor scope consistency | Account scope is derived and matches actor; system scope has no actor account; direct mismatch rejected |
| Privacy | Logs/audit/API | No secret, signature, phone, OTP, bank, provider payload, or raw WhatsApp evidence |
| UI/manual | Existing mobile-width surfaces | Loading, empty, overdue, final failure, retry guidance, and refresh remain readable without a new screen |
| Regression | Required QA scenarios | QA-EXP-001..004, QA-SLA-001..002, QA-NOTIFY-001, QA-SEC-004..005, QA-UI-006 pass |

## Acceptance Criteria Mapping

| Ticket acceptance criterion | Planned implementation | Verification |
| --- | --- | --- |
| Due jobs use atomic state/version/deadline guards; reruns do not duplicate transition/audit | Existing domain jobs through shared orchestrator and correlation context; Steps 4-5 | Fixed-clock, duplicate, concurrent, stale-lease, transition-count, and audit-count integration tests |
| Operating timers pause outside 09:00-21:00 WIB; timeout never infers financial success | WIB helpers and SLA source/target service; Steps 6-8 | QA-SLA-001..002 and direct financial state/result assertions |
| Notification is attempted at most three times; final failure is Admin-visible and state-neutral | Shared notification outbox/attempt ledger and Admin projection; Steps 9-12 | QA-NOTIFY-001, fourth-attempt rejection, UI authorization, and state-isolation tests |
| Same correlation/idempotency returns original result; corrections preserve prior evidence | Terminal job key identity, stale-running recovery, append-only job/notification attempts, and derived audit actor scope; Steps 3-4, 9, 13 | QA-SEC-004..005, terminal duplicate/new-key retry, direct update/delete rejection, and correction-shape tests |

## Risks And Safeguards

| Risk | Safeguard | Recovery/rollback |
| --- | --- | --- |
| Two schedulers run the same work | Unique logical run, terminal key semantics, row lock, lease, run version, per-domain conditional mutation | Return terminal run; reclaim only stale RUNNING; failed retry uses a new key |
| Process crashes after external delivery | Adapter idempotency key and version/attempt/lease-owner conditional finalization | Stale lease appends UNKNOWN; late response is rejected; retry only within remaining three-attempt budget |
| Recurring escalation collides with prior intent | Occurrence key includes immutable escalation sequence and tracker update is atomic with all intents | Return existing occurrence on duplicate; next day allocates next sequence |
| Reminder due is mistaken for delivered | Separate reminderQueuedAt from reminderRecordedAt and require SENT/manual evidence | Show final failure to Admin while overdue continues independently |
| Notification failure mutates business state | Outbox delivery runs after canonical intent creation and has no state mutation API | Reload canonical state; Admin sees final failure |
| Wrong financial SLA start/completion creates false breach | Exact reconciliation completedAt, root operation, second approval, retry, and split-leg queries plus fallback marker | Keep tracker open on ambiguity; append audit and correct projection without altering financial result |
| Scheduler secret leaks | Server-only env, HMAC input redaction, sanitized logs/audit, constant-time compare | Rotate secret; old signatures immediately fail |
| New Admin scope becomes a product role | Persist only as internal task assignment; require `isAdmin` | Revoke assignment without changing account/product role |
| Large batch holds locks too long | Claim job once, mutate each aggregate in short transaction, use bounded batch/cursor | Rerun from canonical due rows after lease expiry |
| Existing confirmation idempotency conflict | Canonical bucket key and request hash use the same normalized scheduled timestamp | Existing conflicting test fixture is removed through additive logic, not data deletion |
| Audit/attempt evidence is overwritten | PostgreSQL insert-only triggers and correction rows | Append a correction; never update/delete prior evidence |
| Legacy QA wording restores manual claim | Interpret QA-EXP-002 as provider-status review under Midtrans authority | Reject any implementation of `Sudah Bayar` or manual payment confirmation |
| Migration changes assignment check incorrectly | Preflight current scopes and recreate constraint with old values plus one additive scope | Transactional rollback restores prior constraint |

## Plan Completion Check

- [x] Every acceptance criterion maps to a change and verification.
- [x] Every relevant approved UX transition and UI state maps to a change and verification.
- [x] Dependencies and migration ordering are explicit.
- [x] Scheduler authentication, replay, claim, lease, retry, and correlation are concrete.
- [x] SUCCESS/FAILED job keys are terminal; only stale RUNNING is reclaimed.
- [x] SLA start timestamps and operating/calendar-hour rules are concrete.
- [x] Payment reconciliation and financial root/leg completion queries are executable.
- [x] Recurring escalation identity supports a new occurrence every 1x24 hours.
- [x] Notification recipients, channels, attempt cap, final failure, and correction behavior are concrete.
- [x] Notification claim, external call, conditional finalization, and stale recovery are concrete.
- [x] Reminder queued/due is separate from recorded/delivered evidence.
- [x] Admin authorization is an internal task assignment, not a product role.
- [x] Admin assignment provisioning is explicit and does not auto-assign.
- [x] Audit actor scope is derived and database-consistent.
- [x] Existing job idempotency conflict has a bounded correction plan.
- [x] Failure, timeout, retry, recovery, audit, privacy, and concurrency are covered.
- [x] No transaction state or financial result is added.
- [x] No real WhatsApp/provider integration or money movement is included.
- [x] Unrelated refactors and BAYAR-001..011 feature behavior are excluded.
- [x] No unresolved decision makes implementation ambiguous.
