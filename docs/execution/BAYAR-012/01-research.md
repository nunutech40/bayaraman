# Codebase Research

## Task

```text
Ticket ID/title: BAYAR-012 - Background Jobs, Notifications, Audit, and SLA Infrastructure
Requested outcome: Provide secured, rerunnable jobs, capped notification delivery,
WIB SLA tracking, escalation, and append-only audit without inferring transaction
or financial success from timeout or delivery failure.
Source requirements: UR-SYSTEM-004..011, UR-BR-009, UR-BR-010, UR-BR-014,
UR-BR-025, UR-BR-036, UR-BR-043, UR-BR-044
Source UX Flow/UI/QA IDs: UX-FLOW-045, UX-FLOW-046, UX-FLOW-048..053,
UX-FLOW-071..075; UI-SCR-009, UI-SCR-012, UI-SCR-015, UI-SCR-022;
QA-EXP-001..004, QA-SLA-001..002, QA-NOTIFY-001, QA-SEC-004..005,
QA-UI-006
Status: Draft
```

## Relevant Context Read

| File/doc | Why it is relevant | Key constraint found |
| --- | --- | --- |
| `docs/engineering/tickets/BAYAR-012-background-jobs-notifications-audit.md` | Defines the bounded ticket | Jobs must be rerunnable, notifications stop after three attempts, operating-hour timers use 09:00-21:00 WIB, and failure cannot imply financial success |
| `PRD.md` v0.2 Approved | Defines product and operational policy | Payment reconciliation target is two operating hours; payout is due in 1x24 hours; refund/split is due in 2x24 hours; escalation repeats every 1x24 hours |
| `TRD.md` v1.2 Approved, Sections 5, 8, 10, 13, 14, 15 | Defines technical boundaries | Scheduler invocation must be secured and idempotent; deployment is environment-specific and must not assume a persistent worker |
| `docs/product/03-user-requirements.md` v0.4 Approved | Confirms requirement wording | In-app status remains authoritative; notification failure is visible to Admin and never changes transaction state |
| `docs/product/02-ux-flow.md` v0.3 Approved | Confirms recovery and terminal paths | Expiry and late funds cannot revive a transaction; financial terminal states require successful evidence |
| `docs/product/04-ui-ux-spec.md` v0.2 Approved | Defines existing UI surfaces | SLA and recovery information belongs on existing participant/Admin screens; the ticket does not require a new feature screen |
| `docs/product/05-qa-scenarios.md` v0.2 Approved | Defines verification scenarios | Fixed clocks, WIB boundaries, duplicate execution, immutable audit, three delivery attempts, and Admin-visible final failure are required |
| `docs/execution/BAYAR-004/04-validation.md` | Validated payment-expiry dependency | Deterministic invoice expiry exists; production scheduler and monitoring were deferred |
| `docs/execution/BAYAR-005/04-validation.md` | Validated reconciliation dependency | Provider reconciliation is implemented; one unrelated OTP timing assertion remains a recorded residual note |
| `docs/execution/BAYAR-007/04-validation.md` | Validated confirmation dependency | Reminder and overdue sweep boundaries exist; production scheduling was deferred |
| `docs/execution/BAYAR-008/04-validation.md` | Validated financial dependency | Read-only financial SLA projection exists; scheduled reminders and escalation are explicitly owned by BAYAR-012 |
| `docs/execution/BAYAR-010/04-validation.md` | Validated cancellation dependency | Deterministic reconciliation and response timeout commands exist; production scheduling and escalation were deferred |

## Current Behavior

- Local job entry points are separate npm commands:
  `job:payment-expiry`, `job:confirmation-recovery`,
  `job:cancellation-reconciliation-timeout`, and
  `job:cancellation-response-timeout`.
- There is no `src/app/api/jobs/*` route even though TRD defines a secured
  `POST /api/jobs/payment-expiry` boundary. The existing runners are CLI-only
  and do not authenticate a scheduler invocation.
- Payment expiry reads due active invoices and performs an atomic conditional
  transaction update using transaction state and state version. Audit is
  appended only after the update succeeds, so a rerun does not repeat the
  transition.
- Confirmation reminder and overdue sweeps use fixed-clock-friendly functions.
  The reminder records a due marker and audit event; overdue conditionally
  changes `WAITING_BUYER_CONFIRMATION` to
  `BUYER_CONFIRMATION_OVERDUE`.
- Confirmation sweep idempotency currently uses an hourly key but hashes the
  full timestamp. Two invocations in the same hour with different timestamps
  therefore share a key with different request hashes and can produce an
  idempotency conflict instead of returning the original result.
- Cancellation reconciliation timeout conditionally sets the reconciliation
  to `TIMED_OUT`, moves the transaction to `MANUAL_REVIEW_REQUIRED`, updates
  the request, and appends cancellation/audit events in one database
  transaction.
- Funded-cancellation response timeout conditionally moves the transaction to
  `MANUAL_REVIEW_REQUIRED` and appends timeout evidence. The command is
  rerunnable through state guards but does not have a persisted top-level job
  run/correlation record.
- `addOperatingMinutesWib` already implements daily 09:00-21:00 WIB elapsed
  time and is covered by a unit test. It is currently used by cancellation
  behavior, not exposed as a common SLA projection or scheduler policy.
- Financial SLA is currently calculated on read from `preparedAt`: 24 hours
  for payout and 48 hours for refund/split. It does not persist reminder
  cadence, last escalation, attempt count, or handled state.
- Confirmation OTP has domain-specific `sendCount`, cooldown, lock, and
  `PENDING|SENT|FAILED|UNKNOWN` metadata. Other operational notifications do
  not share a persistent outbox or attempt ledger.
- There is no generic notification table, no maximum-three-attempt enforcement
  across notification types, and no Admin query for final delivery failures.
- Audit events are stored in `audit_events` and protected by an insert-only
  PostgreSQL trigger. Domain services append audit inside their mutation
  transactions. Rejection audit has a sanitized separate writer.
- Current Admin pages expose payment review, confirmation, cancellation,
  WhatsApp, complaints, risk, and financial operations. No new page is needed,
  but the existing projections do not expose a unified overdue/escalation and
  notification-failure task list.
- Product roles remain Buyer, Seller, and Admin. Existing system work uses
  `SYSTEM:<job-name>` actor scopes in idempotency storage rather than a system
  account or a new product role.

## Code Map

| Responsibility | Existing file/module | Symbol/route | Notes |
| --- | --- | --- | --- |
| Payment expiry | `src/server/jobs/payment-expiry.ts` | `expirePaymentInvoices(now)` | Atomic state/version/deadline guard; no shared job-run ledger |
| Payment expiry CLI | `src/server/jobs/run-payment-expiry.ts` | npm `job:payment-expiry` | Local invocation only |
| Confirmation recovery | `src/server/confirmation/recovery.ts` | `runConfirmationReminderSweep`, `runConfirmationOverdueSweep` | Fixed clock and system idempotency exist; hourly key/hash mismatch needs correction |
| Confirmation CLI | `src/server/jobs/run-confirmation-recovery.ts` | npm `job:confirmation-recovery` | Selects reminder or overdue command |
| Cancellation reconciliation timeout | `src/server/jobs/cancellation-reconciliation-timeout.ts` | `runCancellationReconciliationTimeout(now)` | Produces approved manual-review state, never a financial result |
| Cancellation response timeout | `src/server/jobs/cancellation-response-timeout.ts` | `runCancellationResponseTimeout(now)` | Handles funded cancellation 1x24-hour response timeout |
| Cancellation CLIs | `src/server/jobs/run-cancellation-*.ts` | npm job scripts | Deterministic commands without deployment scheduler |
| WIB operating time | `src/server/domain/time/operating-hours.ts` | `addOperatingMinutesWib` | Daily 09:00-21:00 WIB; no holiday/weekend exclusion is approved |
| Financial SLA projection | `src/server/finance/service.ts` | `readFinancialSla` | Read-only absolute target; no scheduled escalation persistence |
| Financial SLA API | `src/app/api/admin/financial-operations/[id]/sla/route.ts` | `GET` | Uses existing Admin financial assignment boundary |
| OTP delivery metadata | `src/server/confirmation/service.ts`, `src/server/db/schema.ts` | `confirmationOtps` | Three sends per 30 minutes is OTP-specific, not a shared notification policy |
| WhatsApp delivery boundary | `src/server/auth/whatsapp-delivery.ts`, `src/server/operations/whatsapp.ts` | provider-neutral/manual result handling | No real WhatsApp API; delivery failure must not mutate trusted state |
| Idempotency | `src/server/transaction/mutation.ts` | `findIdempotentResult`, `saveIdempotentResult` | Supports `SYSTEM:<job-name>` actor scope |
| Audit writer | `src/server/transaction/audit.ts` | `recordTransactionEvent`, `recordRejectedMutationEvent` | Append-only events and sanitized rejection path |
| Audit persistence | `src/server/db/schema.ts`, `drizzle/0003_midtrans_foundation.sql` | `auditEvents`, `audit_events_insert_only` | No update/delete correction; append a new event |
| Admin task authorization | `src/server/db/schema.ts`, domain authorization modules | `adminTaskAssignments` | Existing scopes are domain-specific; no notification/SLA task scope exists |
| Release safety | `src/server/release-gate/service.ts` | real-money pilot gate | Useful for production safety, but scheduler invocation is not currently coupled to it |
| Test patterns | `tests/integration/cancellation.test.ts`, `tests/integration/confirmation.test.ts`, `tests/integration/finance.test.ts` | Vitest/PostgreSQL integration tests | Existing fixed-date and direct database assertions can be reused |

## Existing Patterns To Reuse

- Validation pattern: explicit domain vocabulary, Zod at HTTP boundaries, and
  database checks/partial indexes for bounded values and active records.
- Data access pattern: select due candidates, then execute each mutation in a
  database transaction with state/version/deadline conditions.
- Idempotency pattern: persist command result under
  `(actor_scope, command, key)` and reject a reused key with a different
  request hash.
- Authorization pattern: user-facing Admin reads require `isAdmin` plus the
  relevant `adminTaskAssignments` scope. Scheduler work should use a secured
  machine invocation and `SYSTEM:<job-name>`, not an Admin session or new role.
- Audit pattern: successful mutation and audit commit together; rejected work
  writes only a sanitized append-only rejection event.
- Time pattern: inject `now` into job functions and compute WIB deadlines with
  `addOperatingMinutesWib`.
- UI pattern: extend existing Admin operation/reconciliation screens with
  status, deadline, final-delivery-failure, and recovery projections. Keep the
  existing constrained mobile-width web shell.
- Test pattern: Vitest unit tests for pure time calculations and PostgreSQL
  integration tests for state/version races, reruns, audit rows, and immutable
  evidence.

## Change Surface

| Area | Likely change? | Reason/risk |
| --- | --- | --- |
| UI | Yes, limited | Existing Admin surfaces need overdue/escalation and final notification-failure visibility; no new feature screen |
| API | Yes | TRD requires secured scheduler invocation and Admin task/query boundaries |
| State | No new transaction state | Jobs may only apply already-approved transitions or create reminders/manual review |
| Database | Yes | A durable job-run/correlation boundary, notification attempt ledger, and SLA/escalation projection are not present |
| Auth | Yes, bounded | Machine invocation needs a server-only credential; Admin queries need an existing or explicitly added internal task scope |
| Jobs/integrations | Yes | Existing deterministic jobs need common orchestration, retry/correlation, capped notifications, and deployment-neutral invocation |
| Tests/docs | Yes | Add fixed-clock, WIB boundary, duplicate/concurrent job, three-attempt, failure visibility, and audit immutability coverage |

## Unknowns And Assumptions

| Item | Can be inferred safely? | Evidence or decision needed |
| --- | --- | --- |
| Production scheduler provider | No | TRD explicitly defers the provider. The plan must choose a deployment-neutral secured route/CLI contract; local can continue using npm commands |
| Scheduler authentication mechanism | No | The plan must select a server-only secret/signature and replay policy without creating a user/product role |
| Shared job-run schema | Yes | Ticket acceptance requires durable correlation/idempotency evidence; exact columns, lease/claim behavior, and retention belong in the plan |
| Notification persistence model | Yes | A shared append-only notification and attempt ledger is needed because domain-specific OTP fields cannot cover all SLA notifications |
| Notification channel implementation | Yes | Keep provider-neutral/manual delivery; WhatsApp API and provider parsing are explicitly out of scope |
| Notification recipients and copy | Partly | Existing UI/UX identifies Buyer, Seller, and Admin surfaces, but each event-to-recipient/template mapping must be enumerated in the plan without adding product policy |
| Admin assignment scope | No | Decide whether existing domain assignments can authorize each queue item or whether an additive internal `SLA_NOTIFICATION_REVIEW` task scope is required |
| Financial SLA start point | No | Current code uses `preparedAt`, while approved wording says payout after eligibility and refund/split after approval; the plan must map exact persisted timestamps per operation type |
| Payment reconciliation SLA source | No | The plan must identify the canonical open/reconciled timestamps from `payment_reconciliations` and avoid deriving authority from notification state |
| QA-EXP-002 legacy “timely claim” wording | No | The approved Midtrans flow has no `Sudah Bayar` claim. Plan/tests should interpret this as timely provider-status review and must not restore manual payment claim behavior |
| Weekend/holiday calendar | Yes | Requirements say daily 09:00-21:00 WIB and do not define exclusions; use every calendar day unless upstream policy changes |
| Audit retention and alert transport | No | Ticket requires append-only evidence and Admin visibility, but retention duration and external alerting provider remain deployment decisions |

## Research Conclusion

```text
Recommended implementation boundary:
Add one deployment-neutral scheduler orchestration layer over the existing
deterministic jobs; persist job runs/claims, notification records/attempts,
and SLA escalation state; expose secured machine invocation plus existing-screen
Admin queries. Reuse SYSTEM actor scopes, state-version conditional mutations,
WIB time helpers, append-only audit, and provider-neutral delivery. Do not add
a product role, transaction state, financial execution, WhatsApp API, or new
feature screen.

Main risks:
- Duplicate/concurrent scheduler invocations without a durable claim.
- Existing confirmation hourly idempotency key conflicting with its timestamp hash.
- Incorrect SLA start timestamps, especially refund/split approval timing.
- Notification retry accidentally changing trusted state or implying delivery.
- A generic scheduler bypassing domain authorization, release gates, or audit.
- Restoring legacy manual payment-claim behavior from stale QA wording.

Files likely affected:
- src/server/jobs/*
- src/server/domain/time/operating-hours.ts
- src/server/db/schema.ts and one additive Drizzle migration
- src/server/transaction/mutation.ts and src/server/transaction/audit.ts
- src/server/finance/service.ts and payment/cancellation/confirmation projections
- src/app/api/jobs/*
- existing Admin API/page surfaces for operations and reconciliation
- package.json
- focused unit/integration tests

Ready to plan: Yes. The implementation plan must lock the scheduler
authentication/claim contract, exact SLA source timestamps, notification
recipient/template matrix, and Admin assignment boundary before coding.
```
