# Execution And Validation

## Execution Record

~~~text
Ticket: BAYAR-001 — Application Foundation and Domain Persistence Boundary
Plan: docs/execution/BAYAR-001/02-plan.md
Started: 2026-07-27
Completed: 2026-07-27
Status: Complete
~~~

## Implemented Changes

| Planned step | Result | Files changed | Deviation/reason |
| --- | --- | --- | --- |
| Midtrans persistence boundary | Done | `src/server/db/schema.ts`, `drizzle/0003_midtrans_foundation.sql` | Schema only. No invoice creation, hosted checkout, webhook, or reconciliation behavior added. |
| Active-invoice constraint | Done | schema and `0003` migration | `is_active` defaults to `false`; PostgreSQL allows one active invoice per transaction. Lifecycle ownership remains BAYAR-004/005. |
| Legacy boundary | Done | `src/server/db/schema.ts` | Legacy manual-payment tables are explicitly annotated compatibility-only and remain untouched. |
| Transaction-role constraints | Done | schema and `0003` migration | Creator and participant database values are restricted to Buyer/Seller; Admin remains account authorization only. |
| Idempotency scope | Done | schema, idempotency, validation, and transaction mutation helpers | Non-null `ACCOUNT:<uuid>` and `SYSTEM:<job-name>` scopes replace nullable uniqueness semantics. |
| Audit/evidence enforcement | Done | transaction audit helper and `0003` migration | Accepted writers can share caller correlation IDs; rejected mutations have a sanitized separate writer. PostgreSQL triggers enforce append-only audit and immutable successful financial rows. |
| Test foundation | Done | unit and PostgreSQL integration tests, `.env.example` | Integration test uses `TEST_DATABASE_URL` and rolls test data back. |

## Acceptance Evidence

| Acceptance criterion or UX/UI state | Evidence | Result |
| --- | --- | --- |
| Midtrans persistence records exist without provider behavior | `payment_invoices`, `payment_provider_events`, and `payment_reconciliations` created by `0003` | Pass |
| One active invoice per transaction | Partial unique index plus PostgreSQL integration test | Pass |
| Buyer/Seller-only transaction membership | PostgreSQL checks reject `ADMIN` creator values | Pass |
| Duplicate idempotency is deterministic | Non-null `actor_scope` unique index and integration test | Pass |
| Audit and successful financial evidence are immutable | PostgreSQL trigger integration test | Pass |
| Existing mobile-width app shell remains buildable | Production build completed; no UI redesign added | Pass |

## Automated Checks

| Command/check | Result | Relevant output/notes |
| --- | --- | --- |
| `npm run db:migrate` | Pass | Applied additive migration `0003_midtrans_foundation` to local OrbStack PostgreSQL. |
| `TEST_DATABASE_URL=... npm test` | Pass | 5 test files, 18 tests passed, including PostgreSQL integration coverage. |
| `npm run typecheck` | Pass | Run sequentially after production build. |
| `npm run lint` | Pass | No ESLint warnings or errors. |
| `npm run build` | Pass | Next.js production build completed. |
| `npm run db:status` | Pass | OrbStack PostgreSQL healthy on `localhost:54329`. |
| `git diff --check` | Pass | No whitespace errors. |

## Manual Checks

| Scenario | Steps/evidence | Result |
| --- | --- | --- |
| Local database health | Compose status reports PostgreSQL healthy. | Pass |
| Migration safety | Existing local database accepted forward-only `0003`; legacy tables were retained. | Pass |
| Mobile-width shell | Build preserved the existing shell. Browser viewport inspection was not repeated because this ticket makes no UI change. | Deferred |

## Final Safety Review

- No transaction state, financial result, or product role was added.
- No invoice activation, hosted checkout, webhook, payment confirmation, payout,
  refund, WhatsApp, cancellation, or provider API behavior was implemented.
- `SYSTEM:<job-name>` is an idempotency namespace, not an account or product role.
- Raw provider/account data is not added to audit payloads; rejection auditing is
  restricted to a sanitized reason and correlation ID.
- PostgreSQL trigger enforcement was tested against the local database.
- OrbStack remains a local PostgreSQL runtime only.
- Existing unrelated worktree changes were preserved.

## Handoff

~~~text
Summary:
- BAYAR-001 now has the approved Midtrans persistence boundary, safe additive
  migration, transaction-role constraints, deterministic idempotency scopes,
  append-only audit enforcement, immutable successful financial operations,
  and PostgreSQL integration coverage.

Verification:
- Migration, integration test, unit tests, typecheck, lint, build, database
  healthcheck, and diff whitespace check passed.

Changed files:
- src/server/db/schema.ts
- src/server/domain/idempotency/index.ts
- src/server/validation/mutation.ts
- src/server/transaction/mutation.ts
- src/server/transaction/audit.ts
- drizzle/0003_midtrans_foundation.sql
- drizzle/meta/_journal.json
- tests/unit/foundation.test.ts
- tests/integration/foundation.test.ts
- .env.example
- docs/execution/BAYAR-001/04-validation.md

Remaining risks/follow-up:
- The migration has been applied locally; production rollout still needs its own
  deployment and backup procedure.
- Existing manual-payment feature modules remain compatibility-only until their
  dedicated Midtrans ticket replaces them.
- Browser-level mobile viewport verification remains a manual check because no
  visual code changed in BAYAR-001.
~~~
