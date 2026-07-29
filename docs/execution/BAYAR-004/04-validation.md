# BAYAR-004 Validation

## Execution Record

~~~text
Ticket: BAYAR-004 — Midtrans Invoice, Hosted Checkout, and Payment Expiry
Plan: docs/execution/BAYAR-004/02-plan.md v0.1
Plan review: docs/execution/BAYAR-004/03-plan-review.md Approved
Started: 2026-07-29
Completed: 2026-07-29
Implementation: Complete
Validation: Passed
~~~

## Implemented Changes

| Planned step | Result | Files changed | Deviation/reason |
| --- | --- | --- | --- |
| Provider-neutral invoice adapter and Midtrans mapper | Done | `src/server/providers/payment-invoice.ts`, `src/server/providers/midtrans/config.ts`, `invoice.ts`, `fake.ts` | Uses a fake adapter in tests; production credentials remain server-only and launch-gated |
| Idempotent invoice service and safe projection | Done | `src/server/payment/invoice.ts` | One active invoice, frozen amount, absolute deadline, request hash, and safe participant projection implemented |
| Invoice schema and migration | Done | `src/server/db/schema.ts`, `drizzle/0006_bayar004_invoice_integrity.sql`, `drizzle/meta/_journal.json` | Additive migration adds idempotency reference, unique index, immutable-field triggers, and legacy backfill |
| Participant payment-link/status routes | Done | `src/app/api/transactions/[id]/payment-link/route.ts`, `payment-status/route.ts` | Buyer/Seller participant access only; no payment authority or webhook behavior |
| Invoice expiry boundary | Done | `src/server/jobs/payment-expiry.ts`, `run-payment-expiry.ts` | Uses active invoice deadline and atomic state/version guard; local runner remains bounded |
| Legacy manual route quarantine | Done | `payment-instructions/route.ts`, `payment-claim/route.ts` | Both routes return `410 Gone`; legacy tables remain compatibility-only |
| Participant UI states | Done | `src/components/transactions/status.tsx`, `src/app/globals.css` | Hosted payment link, provider status, deadline, refresh, loading, error, and recovery states added |
| Tests and fixtures | Done | `tests/unit/payment-invoice.test.ts`, `tests/integration/foundation.test.ts` | Added provider boundary and immutable invoice assertions; existing fixture updated for required field |
| Execution evidence | Done | This file | Validation evidence recorded after implementation |

## Acceptance Evidence

| Acceptance criterion or UX/UI state | Evidence | Result |
| --- | --- | --- |
| Midtrans payment link uses `payment_type: payment_link` | Provider adapter request mapping and unit boundary | Pass |
| Amount comes from frozen transaction terms | `ensurePaymentLink` requires `frozenAt` and persists `terms.totalAmount` | Pass |
| One active invoice and duplicate request safety | `payment_invoices_one_active_idx`, idempotency reference unique index, request-hash handling, and concurrent integration coverage | Pass |
| Invoice identity, amount, and deadline immutability | Migration trigger `payment_invoices_immutable_fields` and integration update/delete assertions | Pass |
| Hosted URL and provider status are safe projections | Adapter returns allowlisted fields; secrets/raw provider payloads are not returned | Pass |
| Deadline is absolute and remains 1x24 hours | Service calculates once from `issuedAt`; refresh/retry never recalculates | Pass |
| Buyer/Seller participant authorization | Route/service resolves session account and participant ownership; Admin/unrelated access is denied | Pass |
| `Cek status pembayaran` is read-only | `GET /payment-status` reads the safe invoice projection and never changes paid state | Pass |
| No `Sudah Bayar` or manual-bank payment path | Participant UI has hosted link/status refresh; legacy routes return `410 Gone` | Pass |
| Expiry is deterministic and rerun-safe | Invoice-based job uses deadline, exact state/version, active invoice predicate, and post-update audit | Pass |
| Late provider success does not revive transaction | BAYAR-004 has no authority/revival path and hands reconciliation to BAYAR-005 | Pass |
| UI-SCR-009/UI-SCR-010 states | Loading, disabled, hosted link, pending/provider status, error/retry, deadline, and unauthorized paths are implemented in the existing mobile-width shell | Pass |
| UI-SCR-021 boundary | Cancellation remains deferred/disabled; no cancellation API or transition is implemented | Pass |
| Scope safety | No webhook authority, refund, payout, WhatsApp, cancellation, complaint, risk operation, new role, or new state added | Pass |

## Automated Checks

| Command/check | Result | Relevant output/notes |
| --- | --- | --- |
| `npm test` | Pass | 8 test files, 25 tests passed; unit and PostgreSQL integration tests enabled with `TEST_DATABASE_URL` |
| `npm run typecheck` | Pass | TypeScript strict check passed |
| `npm run lint` | Pass | No ESLint warnings or errors |
| `npm run build` | Pass | Next.js production build includes `/payment-link` and `/payment-status` routes |
| `npm run db:generate` | Pass | Schema generation completed; no generated migration was retained beyond the planned `0006` migration |
| `npm run db:migrate` | Pass | `0006_bayar004_invoice_integrity.sql` applied successfully to local PostgreSQL |
| PostgreSQL index check | Pass | `payment_invoices_idempotency_reference_unique` and `payment_invoices_one_active_idx` exist |
| PostgreSQL trigger check | Pass | `payment_invoices_immutable_fields` and `payment_invoices_no_delete` exist |
| `docker compose ps` | Pass | `bayarman-postgres-1` healthy on local OrbStack |
| `git diff --check` | Pass | No whitespace errors |

## Manual Checks

| Scenario | Steps/evidence | Result |
| --- | --- | --- |
| Home page smoke test | Started `npm run dev -- -p 3005`, requested `http://localhost:3005/` | `200` |
| Legacy manual instruction route | Requested `GET /api/transactions/test/payment-instructions` | `410 Gone` with safe migration message |
| Legacy payment claim route | Requested `POST /api/transactions/test/payment-claim` | `410 Gone` with safe migration message |
| Mobile-width surface | Reviewed the new payment panel in the existing `.app-shell` constrained layout; no desktop-wide dashboard was introduced | Pass |
| Provider credential isolation | Adapter reads `MIDTRANS_SERVER_KEY` server-side; unit result contains only safe projection fields | Pass |

## Final Safety Review

- [x] State transitions match the approved model: `WAITING_COUNTERPARTY_DATA` to `WAITING_BUYER_PAYMENT`, and invoice deadline expiry to `PAYMENT_EXPIRED` only.
- [x] No `PAYMENT_CONFIRMED` or authoritative payment transition is implemented.
- [x] Hosted Midtrans link replaces manual bank instructions as the primary payment path.
- [x] Buyer/Seller participant authorization is enforced server-side; Admin is not granted payment confirmation authority.
- [x] Provider secrets and raw provider payloads are not exposed to client, audit, or idempotency results.
- [x] Idempotency, request-hash conflict, active-invoice uniqueness, state-version, and expiry race boundaries are covered.
- [x] Issued invoice identity/amount/deadline fields are protected by PostgreSQL triggers.
- [x] UI includes loading, disabled, error, pending/status, deadline, unauthorized, and recovery states in the mobile-width web shell.
- [x] Unrelated user changes and prior BAYAR-003 work were preserved.
- [x] Changed-file scope is limited to BAYAR-004 implementation, its required migration/schema fixture update, and this validation report.

## Handoff

~~~text
Summary:
- BAYAR-004 now creates an idempotent Midtrans payment link from frozen
  transaction terms, exposes hosted checkout/status refresh, and expires the
  unpaid transaction against the original absolute deadline.
- Legacy manual payment routes are quarantined with 410 Gone.
- Webhook authority, Get Status reconciliation, refund, payout, and money
  movement remain outside this ticket for BAYAR-005/later tickets.

Verification:
- 25 automated tests passed, including PostgreSQL integration tests.
- Typecheck, lint, build, migration, index/trigger checks, HTTP smoke tests,
  PostgreSQL health, and git diff check passed.

Changed files:
- `src/server/providers/`
- `src/server/payment/invoice.ts`
- `src/server/db/schema.ts`
- `drizzle/0006_bayar004_invoice_integrity.sql`
- `drizzle/meta/_journal.json`
- `src/server/jobs/payment-expiry.ts`
- `src/server/jobs/run-payment-expiry.ts`
- `src/app/api/transactions/[id]/payment-link/route.ts`
- `src/app/api/transactions/[id]/payment-status/route.ts`
- legacy payment route quarantine files
- `src/components/transactions/status.tsx`
- `src/app/globals.css`
- `tests/unit/payment-invoice.test.ts`
- `tests/integration/foundation.test.ts`

Remaining risks/follow-up:
- Configure and validate real Midtrans credentials and deployment only behind
  the approved production launch gate.
- BAYAR-005 must implement webhook signature validation, authoritative status
  reconciliation, duplicate/out-of-order handling, and payment confirmation.
- Production scheduler/monitoring remains deployment work.
~~~

## Status

```text
Implementation: Complete
Validation: Passed with residual risks documented
Scope: BAYAR-004 only
```
