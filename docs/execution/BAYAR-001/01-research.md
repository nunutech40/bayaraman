# Codebase Research

## Task

~~~text
Ticket ID/title: BAYAR-001 — Application Foundation and Domain Persistence Boundary
Requested outcome: Establish and align the runnable Next.js, PostgreSQL/Drizzle,
validation, state-version, idempotency, audit, and test foundation with PRD v0.2
and TRD v1.2.
Source requirements: UR-ACCOUNT-001, UR-ACCOUNT-002, UR-PARTICIPANT-001,
UR-PARTICIPANT-002, UR-PARTICIPANT-003, UR-SYSTEM-008, UR-SYSTEM-009,
UR-SYSTEM-010, UR-SYSTEM-011, UR-BR-001, UR-BR-025, UR-BR-040, UR-BR-041,
UR-BR-042, UR-BR-045
Source UX Flow/UI/QA IDs: UX-FLOW-001, UX-FLOW-002, UX-FLOW-071..075;
UI-SCR-001, UI-SCR-009; QA-SEC-004, QA-SEC-005, QA-UI-006
~~~

Research status: Draft

## Relevant Context Read

| File/doc | Why it is relevant | Key constraint found |
| --- | --- | --- |
| `AGENTS.md` | Repository safety and context contract | Work on one ticket; preserve unrelated dirty-worktree changes; use actual app scripts once the app exists |
| `WORKFLOW.md` | Engineering execution stages | Research precedes plan, plan review, implementation, and validation; do not advance stages in one step |
| `docs/engineering/tickets/BAYAR-001-project-setup-database.md` | Current ticket boundary | Foundation only; no later feature behavior, live provider traffic, or product role/state additions |
| `PRD.md` v0.2 | Approved product boundary | Midtrans is primary payment provider; Product roles are Buyer, Seller, Admin; no manual-bank primary payment |
| `TRD.md` v1.2 Sections 3-5, 10, 12-15 | Approved technical contract | PostgreSQL/Drizzle/Zod, approved state/result vocabulary, domain entities, authorization/privacy, atomic audit, local OrbStack boundary, and tests |
| `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts` | Existing runtime foundation | Next.js 14, strict TypeScript, Tailwind, Vitest, Drizzle and PostgreSQL dependencies already exist |
| `compose.yaml`, `.env.example`, `drizzle.config.ts` | Local database setup | PostgreSQL 16 via Compose on port 54329 with persistent volume and healthcheck; production must remain PostgreSQL-compatible |
| `src/server/db/schema.ts` and `drizzle/*.sql` | Existing persistence | Broad schema and three migrations exist, but payment tables still model legacy manual instructions/claims and do not match TRD Midtrans entities |
| `src/server/domain/transaction/state.ts` | State/result vocabulary | Approved transaction states and financial results are already centralized; foundation must not add values |
| `src/server/domain/mutation/*`, `src/server/validation/mutation.ts` | Shared mutation seams | Zod mutation parsing, expected state-version assertion, request hashing, and idempotency helpers exist but persistence/audit enforcement is incomplete |
| `src/server/transaction/audit.ts` | Audit pattern | Audit rows are inserted through a helper, but correlation IDs are generated inside the helper and append-only enforcement is not represented at database level |
| `src/server/transaction/service.ts`, `src/server/payment/payment.ts`, `src/server/jobs/payment-expiry.ts` | Current behavior and coupling | Existing transaction flow creates legacy `payment_instructions`, accepts `payment_claims`, and expiry reads that model; this is later-feature behavior and conflicts with the approved Midtrans ticket chain |
| `tests/unit/foundation.test.ts`, `tests/unit/transaction.test.ts`, `tests/unit/payment.test.ts` | Existing test conventions | Vitest unit tests cover pure guards and masking; no database integration harness or schema constraint/concurrency tests are present |

## Current Behavior

- The repository is no longer greenfield. A Next.js App Router application,
  strict TypeScript config, Tailwind styles, database client, Drizzle schema,
  migrations, domain helpers, routes, and Vitest tests are present.
- `src/server/db/schema.ts` already defines the approved product-role enum,
  approved transaction-state enum, financial-result enum, accounts,
  transactions, participants, role-owned data, invitations, WhatsApp records,
  cancellation/hold records, financial operations, idempotency keys, and audit
  events.
- The existing schema also defines `payment_instructions`, `payment_claims`,
  and `payment_reviews`. These represent the superseded manual-bank flow. TRD
  v1.2 instead requires `payment_invoices`, provider events, and payment
  reconciliation records for Midtrans. BAYAR-001 must establish the correct
  persistence boundary; it must not implement invoice creation or webhook
  behavior owned by BAYAR-004/005.
- `src/server/transaction/service.ts` calls `issuePaymentInstructions` when
  role data becomes complete. `src/server/payment/payment.ts` reads a manual
  receiving account, creates payment instructions, accepts a Buyer payment
  claim, and exposes the raw receiving account only to the Buyer. This is
  existing behavior evidence, not approved behavior for the revised tickets.
- `src/server/jobs/payment-expiry.ts` currently selects
  `WAITING_BUYER_PAYMENT` rows joined to `payment_instructions`, then performs
  a state/version-guarded update and writes `PAYMENT_EXPIRED` audit evidence.
  It is useful as a concurrency pattern, but its data boundary is legacy and
  should not be expanded by BAYAR-001.
- `src/server/domain/transaction/state.ts` already rejects unknown transaction
  states at the pure-function boundary and exposes the four approved financial
  results. It does not yet define a complete transition matrix.
- `src/server/domain/mutation/index.ts` and
  `src/server/transaction/mutation.ts` provide validation, state-version, and
  idempotency helpers. The database path has a unique actor/command/key index,
  but no integration test proves duplicate/concurrent behavior.
- `src/server/transaction/audit.ts` writes append-style rows but does not
  itself enforce immutable rows, accept a caller correlation ID, or guarantee
  that audit and domain mutation use one transaction in every caller.

## Code Map

| Responsibility | Existing file/module | Symbol/route | Notes |
| --- | --- | --- | --- |
| App runtime | `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css` | App Router shell | Existing UI; foundation changes must preserve mobile-width surface and avoid feature redesign |
| Database schema | `src/server/db/schema.ts` | Drizzle table/enum exports | Broad schema exists; Midtrans persistence and stronger constraints need alignment |
| Database client | `src/server/db/index.ts` | `db`, `pool` | Reads `DATABASE_URL`; fails outside test when absent |
| Migrations | `drizzle/0000_*.sql` through `0002_*.sql` | SQL migration chain | Existing chain contains legacy `payment_instructions`; migration ordering must be planned explicitly |
| Local database | `compose.yaml`, `.env.example` | `postgres` service | OrbStack/Docker is local-only; port `54329`; healthcheck exists |
| State vocabulary | `src/server/domain/transaction/state.ts` | `TRANSACTION_STATES`, `FINANCIAL_OPERATION_RESULTS` | Reuse; no new state/result values |
| Mutation validation | `src/server/validation/mutation.ts` | `mutationInputSchema`, `hashRequest` | Reuse Zod boundary; strengthen persistence integration in plan |
| State guard | `src/server/domain/mutation/index.ts`, `src/server/domain/transaction/state.ts` | `assertMutationVersion`, `assertExpectedStateVersion` | Pure guard exists; atomic database update remains caller responsibility |
| Idempotency | `src/server/domain/idempotency/index.ts`, `src/server/transaction/mutation.ts` | `findIdempotentResult`, `saveIdempotentResult` | Reuse API; add transaction-safe conflict/duplicate tests and system-key policy in plan |
| Audit | `src/server/audit/index.ts`, `src/server/transaction/audit.ts` | `buildAuditEvent`, `recordTransactionEvent` | Append-only intent exists; database immutability and correlation propagation need a foundation decision |
| Existing feature coupling | `src/server/transaction/service.ts`, `src/server/payment/payment.ts` | transaction role-data and payment instruction functions | Legacy payment behavior must remain out of BAYAR-001 implementation scope |
| Tests | `tests/unit/foundation.test.ts`, `tests/unit/transaction.test.ts`, `tests/unit/payment.test.ts` | Vitest suites | Add focused foundation/database tests; do not broaden into Midtrans feature tests |

## Existing Patterns To Reuse

- Use the existing Next.js/TypeScript/Tailwind configuration and app shell
  instead of scaffolding a second application.
- Keep Drizzle schema declarations in `src/server/db/schema.ts`, migrations in
  `drizzle/`, and database access through `src/server/db/index.ts`.
- Reuse Zod parsing and pure state-version/idempotency helpers, then place
  database writes, conditional updates, and audit insertion in one transaction.
- Preserve the existing provider-neutral configuration approach. Midtrans
  adapter behavior belongs to BAYAR-004/005, not this ticket.
- Follow Vitest conventions in `tests/unit/`; add a PostgreSQL integration seam
  that can use the Compose service without requiring production infrastructure.
- Keep raw provider, bank, WhatsApp, OTP, and financial evidence separate from
  participant projections and never expose it through generic responses.

## Change Surface

| Area | Likely change? | Reason/risk |
| --- | --- | --- |
| UI | Yes, foundation only | Preserve/verify the existing mobile-width shell; no feature screens |
| API | Yes, shared boundary only | Shared validation, authorization, idempotency, and audit seams; no new feature endpoint |
| State | Yes | Central guard and approved vocabulary; no new state or transition policy beyond the foundation contract |
| Database | Yes | Align schema/migrations with TRD entities, Midtrans provider records, constraints, indexes, and immutable evidence |
| Auth | Limited | Use existing server-side ownership boundary only; account registration/session behavior remains BAYAR-002 |
| Jobs/integrations | No | No live Midtrans, WhatsApp, scheduler, payout, refund, or webhook implementation |
| Tests/docs | Yes | Add schema, concurrency, audit, idempotency, authorization, migration, and shell tests; update only this research now |

## Unknowns And Assumptions

| Item | Can be inferred safely? | Evidence or decision needed |
| --- | --- | --- |
| Whether to rename legacy payment tables or add new Midtrans tables | No | Implementation plan must choose a migration-safe path consistent with TRD and BAYAR-004/005; do not silently preserve manual-bank behavior |
| Exact Midtrans invoice/event/reconciliation columns | Partly | TRD Section 10 is the boundary; implementation plan must map IDs, amount, deadline, provider status, event identity/hash, event time, received time, and reconciliation result |
| Whether existing feature code is in BAYAR-001 scope | Yes | Keep it untouched unless required to compile after schema changes; feature behavior belongs to later tickets |
| Database append-only enforcement for audit/evidence | No | Plan must specify PostgreSQL permissions/trigger strategy or a bounded repository-level enforcement test |
| Idempotency for system/job actors | No | Plan must define a stable actor/key representation without introducing a product role |
| Existing migration compatibility | No | Plan must inspect/apply migrations against local PostgreSQL and define safe migration ordering; do not reset unrelated user data |
| Full transaction transition matrix | Yes | Defer feature transitions to their tickets; BAYAR-001 only centralizes approved vocabulary and version guard |
| Production provider credentials and settlement | Yes | Explicitly deferred to launch gate; local uses placeholders/fakes only |

## Research Conclusion

~~~text
Recommended implementation boundary: Align the existing foundation rather than
scaffold a second app. Keep the existing Next.js/Tailwind/Drizzle/Vitest stack,
then make the persistence and shared mutation boundaries match TRD v1.2. The
database work must replace or isolate legacy manual payment persistence in favor
of Midtrans invoice/provider-event/reconciliation entities, while leaving
invoice creation, webhook processing, payment review, and all other feature
behavior to BAYAR-004/005 and later tickets.

Main risks: migration compatibility with the existing 0000-0002 chain; schema
changes accidentally coupling BAYAR-001 to Midtrans behavior; weak database
enforcement for append-only evidence, idempotency, and distinct participants;
and existing transaction/payment routes continuing to compile against legacy
tables after the foundation schema is aligned.

Files likely affected during implementation: src/server/db/schema.ts,
drizzle/* migration files, src/server/domain/* shared guards,
src/server/transaction/mutation.ts and audit boundary, database/test helpers,
tests/unit/foundation.test.ts plus focused integration tests, and only the
existing shell/config files needed to preserve the current build. Do not modify
product docs, TRD, tickets, or unrelated feature behavior.

Ready to plan: Yes, with the legacy-payment migration strategy and audit/
idempotency enforcement choices explicitly resolved in the Implementation Plan.
~~~

