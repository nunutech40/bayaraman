# Execution And Validation: BAYAR-008

## Execution Record

```text
Ticket: BAYAR-008 - Admin Payout, Refund, and Split Financial Operations
Plan: docs/execution/BAYAR-008/02-plan.md v0.1
Plan review: docs/execution/BAYAR-008/03-plan-review.md Approved
Started: 2026-07-30
Completed: 2026-07-30
Status: Passed / Complete
```

## Implemented Changes

| Planned step | Result | Files changed | Deviation/reason |
| --- | --- | --- | --- |
| Add migration 0013 and finance persistence | Done | `src/server/db/schema.ts`, `drizzle/0013_bayar008_financial_operations.sql`, journal | Legacy final rows without `completed_at` are backfilled before lifecycle constraints are installed |
| Add normalized contracts and handoff adapters | Done | `src/server/finance/contracts.ts`, `handoff-adapter.ts`, `src/server/cancellation/handoff.ts` | Existing complaint/risk owner functions remain authoritative |
| Add operation authorization | Done | `src/server/finance/authorization.ts` | Only active `admin_task_assignments` rows authorize; legacy account text is ignored |
| Add prepare, approval, re-auth, execution, retry, reconciliation, split, and SLA services | Done | `src/server/finance/service.ts`, `http.ts` | External execution remains provider-neutral and fake in local/test |
| Add refund capability and transfer adapters | Done | `src/server/providers/finance.ts` | No production Midtrans refund or real-money call is enabled |
| Add Admin APIs | Done | `src/app/api/admin/financial-operations/**` | No participant mutation API is exposed |
| Add Admin financial UI | Done | `src/app/admin/financial-operations/page.tsx`, `src/components/admin/financial-operations.tsx` | Uses the existing constrained mobile-width web shell |
| Add test coverage | Done | `tests/unit/finance.test.ts`, `tests/integration/finance.test.ts`, foundation/risk regression updates | Release-gate regression fixture was made deterministic for a persistent local test database |

## Acceptance Evidence

| Acceptance criterion or UX/UI state | Evidence | Result |
| --- | --- | --- |
| Eligible Seller payout is separate from Midtrans settlement | Integration test starts only from `READY_FOR_PAYOUT`, requires confirmation evidence and frozen Seller destination, and ends at `PAID_OUT` only after transfer `SUCCESS` | Pass |
| Payout requires authorized Admin and re-authentication | Current JWT session ID is hashed into a five-minute server grant; atomic consume is tested | Pass |
| Refund uses Midtrans capability or manual fallback | Risk refund integration test records an authoritative provider event, freezes `MIDTRANS_REFUND`, and claims the handoff atomically | Pass |
| Two distinct Admin approvals protect controlled financial operations | Refund integration test requires two separately assigned Admin accounts before execution | Pass |
| Prepared is not processing | Database lifecycle constraint and integration projection use `result IS NULL` until execution starts | Pass |
| FAILED and UNKNOWN recovery differ | FAILED creates a linked prepared retry; UNKNOWN rejects retry until reconciliation | Pass |
| Only immutable SUCCESS evidence creates terminal state | PostgreSQL checks require reference/evidence hash; success immutability trigger remains active | Pass |
| Duplicate/concurrent active movement is blocked | Partial unique index covers prepared, `PROCESSING`, and `UNKNOWN`; source claims and idempotency keys are unique | Pass |
| Split ordering and exact pool are enforced | Split calculation constraint requires Buyer plus Seller amount to equal item plus shipping; Seller leg is created only after Buyer `SUCCESS` | Pass |
| Sensitive values remain server-side | API/UI projections expose only masked destination; password, session ID, raw account value, and provider credentials are excluded | Pass |
| UI-SCR-015/016/018/019/020 states | Admin page exposes prepared, approval, re-auth, execution, FAILED retry, UNKNOWN recovery, loading, disabled, error, and success states | Pass |
| SLA handoff remains owned by BAYAR-012 | Read-only SLA route exposes absolute timestamps and result without scheduling a job | Pass |

## Automated Checks

| Command/check | Result | Relevant output/notes |
| --- | --- | --- |
| `npm run db:migrate` | Pass | Migration 0013 applied after safe legacy backfill |
| PostgreSQL migration/constraint inspection | Pass | 14 migrations; lifecycle/evidence/risk-FK constraints and active/external indexes present |
| PostgreSQL `pg_isready` | Pass | OrbStack PostgreSQL accepting connections |
| `npm run typecheck` | Pass | TypeScript strict mode clean |
| `npm run lint` | Pass | No ESLint warnings or errors |
| `npm run build` | Pass | Next.js production build and `/admin/financial-operations` route compiled |
| Full `npm test` with local `TEST_DATABASE_URL` | Pass | 21 test files and 70 tests passed |
| Targeted finance tests | Pass | 5 integration plus 4 unit tests passed |
| `git diff --check` | Pass | No whitespace errors |
| Local route check | Pass | `GET /admin/financial-operations` returned HTTP 200 |

## Manual Checks

| Scenario | Steps/evidence | Result |
| --- | --- | --- |
| Local Admin page runtime | Started Next.js on port 3000 and requested `/admin/financial-operations` | Pass |
| Mobile-width shell | Page uses existing `.app-shell` constrained to 28rem with labelled controls and stable button states | Pass |
| Masking boundary | Operation projection and UI show only bank name, masked account, and holder snapshot | Pass |
| Migration recovery | First migration run rejected an incompatible legacy final row and rolled back; explicit final-row backfill was added and rerun succeeded | Pass |

## Final Safety Review

- [x] State transitions match the approved model.
- [x] Relevant UX Flow and UI states match the approved UI/UX specification.
- [x] Labels, disabled states, status messages, and mobile-width behavior are present.
- [x] Buyer, Seller, and Admin remain the only product roles.
- [x] Financial authorization uses canonical internal Admin assignments.
- [x] Important financial mutations are append-only audited.
- [x] Raw destination values, credentials, session IDs, and provider secrets are not exposed.
- [x] Migration, idempotency, active-operation, retry, and reconciliation behavior are guarded.
- [x] Upstream handoff owners remain unchanged.
- [x] No BAYAR-012 scheduler or unrelated feature was implemented.

## Handoff

```text
Summary:
- BAYAR-008 implements prepared financial operations, atomic handoff claims,
  two-Admin approval, session-bound payout re-authentication, payout/refund/
  split execution, FAILED retry, UNKNOWN reconciliation, masked Admin APIs/UI,
  and the read-only SLA boundary.

Verification:
- Migration 0013 applied on healthy OrbStack PostgreSQL.
- Typecheck, lint, production build, 70 tests, route check, and diff check pass.

Changed files:
- Finance schema/migration and journal.
- Finance, cancellation handoff, provider adapter, API, and Admin UI modules.
- BAYAR-008 unit/integration tests and compatible foundation/risk fixtures.
- This validation report.

Remaining risks/follow-up:
- Real Midtrans refund capability and real-money movement remain disabled until
  production credentials, merchant configuration, legal/compliance, and launch
  gates are approved.
- Global persisted session revocation remains outside the current JWT boundary.
- BAYAR-012 still owns scheduled SLA reminders and escalation jobs.
```
