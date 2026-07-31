# Execution And Validation

## Execution Record

```text
Ticket: BAYAR-012 - Background Jobs, Notifications, Audit, and SLA Infrastructure
Plan: docs/execution/BAYAR-012/02-plan.md v0.1
Started: 2026-07-31
Completed: 2026-07-31
Status: Passed
```

## Implemented Changes

| Planned step | Result | Files changed | Deviation/reason |
| --- | --- | --- | --- |
| Durable job execution and scheduler authentication | Done | `src/server/jobs/*`, `src/app/api/jobs/[jobName]/route.ts`, `package.json`, `.env.example` | Added a lease-owner hash to make stale-run reclaim and completion ownership enforceable. |
| Notification intent, delivery, retry, and correction boundary | Done | `src/server/notifications/*` | Corrections are additionally checked against the same notification before append. |
| Confirmation reminder and overdue jobs | Done | `src/server/confirmation/recovery.ts` | Reminder queueing also excludes links already recorded manually. |
| Existing due-job integration | Done | `src/server/jobs/payment-expiry.ts`, `src/server/jobs/run-*.ts`, `src/server/jobs/registry.ts` | Existing command entry points now use the common durable runner. |
| WIB operating-time and SLA tracking | Done | `src/server/domain/time/wib.ts`, `src/server/sla/*` | Calendar days remain operating days because weekend/holiday exclusions are not approved. |
| Payment and financial SLA completion sources | Done | `src/server/payment/provider-webhook.ts`, `src/server/payment/reconciliation.ts`, `src/server/payment/reconciliation-repository.ts`, `src/server/finance/service.ts` | No payment authority or money-movement behavior was added. |
| Admin and participant visibility | Done | `src/app/api/admin/tasks/sla/route.ts`, `src/components/admin/*`, `src/components/transactions/status.tsx`, `src/server/transaction/read.ts` | Reused existing screens and the mobile-width shell; no new product role or feature screen. |
| Append-only audit actor scope | Done | `src/server/transaction/audit.ts`, `src/server/auth/audit.ts` | Actor scope is derived server-side. |
| Additive database migration | Done | `src/server/db/schema.ts`, `drizzle/0014_bayar012_jobs_notifications_sla.sql`, `drizzle/meta/_journal.json` | Audit trigger is disabled only inside the migration transaction for the actor-scope backfill, then re-enabled. |
| Unit and PostgreSQL integration coverage | Done | `tests/unit/jobs.test.ts`, `tests/integration/jobs-notifications-sla.test.ts`, `tests/integration/foundation.test.ts` | Final suite contains 84 passing tests across 23 files. |

## Acceptance Evidence

| Acceptance criterion or UX/UI state | Evidence | Result |
| --- | --- | --- |
| Due jobs are guarded, atomic, rerunnable, and correlated | Durable `job_runs` claim/finalize flow, stale `RUNNING` reclaim, terminal replay, request-hash conflict tests | Pass |
| Expiry and timeout do not infer financial success | Existing guarded expiry/timeout jobs run through the registry; financial completion requires `SUCCESS` plus evidence/reference | Pass |
| Operating-hour and recurring SLA behavior | Fixed-clock WIB unit tests; persisted tracker occurrence keys `ESCALATION:1`, `ESCALATION:2`; duplicate occurrence test | Pass |
| Notification delivery has at most three attempts | Lease/version/attempt enforcement, stale lease `UNKNOWN`, late-result rejection, and three-attempt integration test | Pass |
| Reminder due is separate from delivery truth | Queue marker test, manual-record exclusion test, and `reminderRecordedAt` update only after WhatsApp `SENT` | Pass |
| Append-only audit and correction evidence | Database triggers, direct mutation rejection, same-notification correction validation, immutable correction test | Pass |
| Admin-only SLA task visibility | `SLA_NOTIFICATION_REVIEW` assignment check, unauthorized Buyer rejection, masked task projection | Pass |
| Participant status remains sanitized | Transaction projection exposes operational summaries and deadlines without raw evidence or secrets | Pass |
| Existing product boundaries remain unchanged | No product role, transaction state, provider parsing, WhatsApp API, or money movement was introduced | Pass |

## Automated Checks

| Command/check | Result | Relevant output/notes |
| --- | --- | --- |
| `TEST_DATABASE_URL=... DATABASE_URL=... npm test` | Pass | 23 test files and 84 tests passed. |
| `npm run typecheck` | Pass | `tsc --noEmit` completed without errors. |
| `npm run lint` | Pass | No ESLint warnings or errors. |
| `npm run build` | Pass | Next.js production build completed; 27 static/dynamic route entries generated. |
| `DATABASE_URL=... npm run db:migrate` | Pass | Migration rerun completed successfully with no pending failure. |
| `npx drizzle-kit check` | Pass | Drizzle reported `Everything's fine`. |
| `npm run db:status` | Pass | OrbStack PostgreSQL is healthy on local port `54329`. |
| `git diff --check` | Pass | No whitespace errors. |

The first parallel typecheck attempt raced with `next build` over generated
`.next/types` files. The sequential typecheck and final production build both
passed. One new reminder test initially reused a transaction that already had a
confirmation link; the fixture was corrected to use a separate transaction and
the full suite then passed.

## Manual Checks

| Scenario | Steps/evidence | Result |
| --- | --- | --- |
| Admin SLA surfaces compile in existing screens | Production build includes payment review, confirmation, cancellation, and financial-operation Admin pages with the shared SLA summary component | Pass |
| Mobile-width participant status remains available | Existing transaction status component compiles with operational deadline and notification summaries | Pass |
| Sensitive-data safety scan | Searched job, notification, SLA, and scheduler routes for raw payload, password, OTP, signature, and secret handling; only scheduler verification reads the secret/signature | Pass |
| Interactive browser visual regression | No authenticated browser session was created during this ticket validation | Not run |

## Final Safety Review

- State transitions continue to use the approved model.
- Existing UI surfaces and the mobile-width shell are reused.
- Actor authorization is enforced for scheduler calls and Admin SLA tasks.
- Financial success is never inferred from timeout or notification delivery.
- Audit events and job/notification attempts preserve append-only evidence.
- Scheduler secrets, signatures, OTP, bank data, and raw provider payloads are
  not exposed in audit, notification payloads, or participant projections.
- Migration and retry behavior are idempotent and validated against local
  PostgreSQL.
- No unrelated product documents, tickets, roles, states, or provider
  integrations were changed.

## Handoff

```text
Summary:
- BAYAR-012 implements durable jobs, bounded notifications, append-only
  corrections, WIB SLA tracking, recurring escalation, and sanitized Admin and
  participant projections.
- Validation status is Passed; BAYAR-012 is ready to close.

Verification:
- 84/84 automated tests passed.
- Typecheck, lint, production build, migration, Drizzle check, PostgreSQL
  healthcheck, and git diff check passed.

Changed files:
- Database: schema, migration 0014, and migration journal.
- Runtime: jobs, notifications, SLA, audit, confirmation recovery, payment
  reconciliation completion, and transaction projections.
- UI/API: scheduler route, Admin SLA task route, shared Admin SLA summary, and
  participant operational status.
- Tests: BAYAR-012 unit/integration coverage and foundation audit fixture.
- Documentation: BAYAR-012 research, plan, approved plan review, and validation.

Remaining risks/follow-up:
- Production scheduler/queue and external alerting providers remain
  deployment-specific.
- Real WhatsApp delivery remains disabled/provider-neutral and may produce
  bounded UNKNOWN/final-failure evidence.
- Operating-hour calculations intentionally do not exclude weekends or public
  holidays.
- Authenticated browser visual regression remains a deployment/manual QA item.
```
