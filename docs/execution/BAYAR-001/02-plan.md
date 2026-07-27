# Implementation Plan

## Task

~~~text
Ticket ID/title: BAYAR-001 — Application Foundation and Domain Persistence Boundary
Outcome: Align the existing Next.js/PostgreSQL/Drizzle foundation with PRD v0.2
and TRD v1.2: Midtrans persistence records, safe forward migration, state
version, idempotency, audit immutability, local PostgreSQL tests, and the
existing mobile-width shell.
Source research: docs/execution/BAYAR-001/01-research.md
Source requirements and QA scenarios: UR-ACCOUNT-001, UR-ACCOUNT-002,
UR-PARTICIPANT-001, UR-PARTICIPANT-002, UR-PARTICIPANT-003, UR-SYSTEM-008,
UR-SYSTEM-009, UR-SYSTEM-010, UR-SYSTEM-011, UR-BR-001, UR-BR-025,
UR-BR-040, UR-BR-041, UR-BR-042, UR-BR-045; QA-SEC-004, QA-SEC-005, QA-UI-006
Source UX Flow and UI IDs/states: UX-FLOW-001, UX-FLOW-002, UX-FLOW-071,
UX-FLOW-072, UX-FLOW-073, UX-FLOW-074, UX-FLOW-075; UI-SCR-001, UI-SCR-009
~~~

Status: Draft

## Scope

### In Scope

- Preserve and verify the existing Next.js App Router, strict TypeScript,
  Tailwind, and constrained mobile-width shell.
- Add the provider-neutral Midtrans persistence boundary required by TRD v1.2:
  invoices, provider events, and reconciliations.
- Add one forward-only PostgreSQL migration with schema constraints, indexes,
  `actor_scope` idempotency, append-only audit protection, and successful
  financial-evidence immutability.
- Strengthen shared state-version, idempotency, correlation, authorization,
  and PostgreSQL integration-test infrastructure.
- Keep OrbStack/Docker Compose local-only and production PostgreSQL-compatible.

### Out Of Scope

- Invoice creation/activation/retirement, hosted checkout, webhook handling,
  Get Status, payment authority, refund, payout, WhatsApp, OTP, cancellation,
  risk, complaint, or scheduler behavior.
- Authentication/session behavior owned by BAYAR-002 and transaction/invitation
  behavior owned by BAYAR-003.
- Removing legacy routes or changing their visible behavior. Existing legacy
  payment tables stay only for compile/migration compatibility until BAYAR-004
  and BAYAR-005 own feature cutover.
- Real Midtrans traffic, production credentials, DATABASE.md, AUTH.md, product
  documents, tickets, or work outside BAYAR-001.

## Planned Changes

| Step | Change | File/module | Requirement/UX/UI/AC covered | Verification |
| --- | --- | --- | --- | --- |
| 1 | Preserve the existing app foundation. Add only scripts/test setup that are actually missing for database integration; do not scaffold a second app or redesign UI. | `package.json`, existing config only when required | AC clean build; UI-SCR-001, UI-SCR-009 | `npm run typecheck`, `npm run lint`, `npm run build`; manual mobile-width checklist |
| 2 | Keep Compose as local PostgreSQL runtime. Define `TEST_DATABASE_URL` fallback/validation for integration tests, retain named volume and healthcheck, and document the command sequence in test setup or scripts. | `compose.yaml`, `.env.example`, `drizzle.config.ts`, test helper/config | TRD 15; AC repeatable local runtime | `db:up`, `db:status`, migration against local PostgreSQL, healthcheck, restart test |
| 3 | Add TRD payment persistence. `payment_invoices` includes transaction ID, provider, provider invoice ID, deterministic order ID, hosted URL, frozen amount/currency, issued/deadline/due timestamps, provider status, `is_active boolean not null default false`, and retirement timestamp. `payment_provider_events` includes provider event ID, payload hash, event/received timestamps, order/amount/status/fraud/signature metadata. `payment_reconciliations` includes decision, Get Status reference, operator, deadline, result, and evidence reference. | `src/server/db/schema.ts` | TRD 7, 10, 12-14; PB-MP-001..006; AC TRD entities | Schema compile; integration fixture persists provider records without credentials |
| 4 | Add explicit invoice/index semantics. Create `UNIQUE(transaction_id) WHERE is_active = true`; new records default inactive. BAYAR-001 creates only schema/constraint/test. BAYAR-004 owns activating one invoice and BAYAR-004/005 own retirement/reconciliation behavior. | `src/server/db/schema.ts`, new migration | UR-BR-031, TRD 10; AC duplicate active invoice rejection | Concurrent PostgreSQL insert test: one active insert succeeds, competing insert fails, inactive history remains valid |
| 5 | Use one additive forward migration. Retain `payment_instructions`, `payment_claims`, and `payment_reviews` with an explicit `@deprecated legacy manual-payment compatibility` schema annotation. New foundation modules must reference only the three new Midtrans tables. Do not drop, rename, backfill, or route-cutover legacy tables. | New `drizzle/0003_*.sql`, `drizzle/meta/*`, `src/server/db/schema.ts` | PRD migration note; TRD 17; AC migration safety | Apply 0000-0003 to empty local DB; assert both legacy and new tables coexist; source scan ensures new foundation modules do not import legacy tables |
| 6 | Add concrete role/data constraints: `transaction_participants.role IN ('BUYER','SELLER')`, `transactions.creator_role IN ('BUYER','SELLER')`, existing unique transaction/account and unique transaction/role, non-negative version, one active cancellation, and one active financial operation per purpose. Preserve partial transactions; complete pair is enforced later by the readiness command. | `src/server/db/schema.ts`, new migration | UR-PARTICIPANT-001..003, UR-BR-001, UR-BR-041; UX-FLOW-002; AC constraints | Direct SQL/Drizzle insertion rejects ADMIN participant/creator, duplicate role, same account in both roles, active cancellation/operation conflict, and stale conditional update |
| 7 | Replace nullable idempotency identity with non-null `actor_scope`. Use `ACCOUNT:<uuid>` for authenticated Buyer/Seller/Admin commands and `SYSTEM:<job-name>` for job/system commands. Add unique `(actor_scope, command, key)`; retain account ID only as optional audit/ownership data. Update helper inputs and request lookup/save behavior. | `src/server/db/schema.ts`, `src/server/domain/idempotency/*`, `src/server/transaction/mutation.ts`, `src/server/validation/mutation.ts`, new migration | UR-SYSTEM-008..011; UX-FLOW-071..075; QA-SEC-004 | Unit/integration tests for account and system duplicate retry, same-key/different-hash conflict, and concurrent winner; no system account/role is created |
| 8 | Define two audit paths and concrete enforcement. Accepted mutation writes business record, immutable evidence, and audit event in one database transaction with caller correlation ID. Rejected validation/authorization/version/idempotency mutation aborts business transaction, then writes a sanitized rejection event in a separate durable audit transaction. Add PostgreSQL triggers: reject UPDATE/DELETE on `audit_events`; reject UPDATE/DELETE of successful `financial_operations` evidence/reference/result fields. | `src/server/audit/*`, `src/server/transaction/audit.ts`, `src/server/domain/mutation/*`, `src/server/transaction/mutation.ts`, new migration | UR-BR-025, UR-BR-042, UR-BR-045; QA-SEC-005; AC atomic/audited behavior | Integration tests for accepted atomic commit, aborted business mutation, durable sanitized rejection audit, audit update/delete rejection, and successful financial evidence update/delete rejection |
| 9 | Add isolated PostgreSQL integration harness. It uses `TEST_DATABASE_URL` when set, otherwise a test database on the local PostgreSQL server; it creates/cleans only test-owned schema/data and never drops the developer volume. Extend foundation unit tests. | `tests/helpers/*`, `tests/integration/foundation.*`, `tests/unit/foundation.test.ts`, `vitest.config.ts` only if needed | QA-SEC-004, QA-SEC-005 | Unit plus PostgreSQL integration suite proves migrations, constraints, concurrency, audit, masking, and authorization boundary |
| 10 | Run the full BAYAR-001 validation set and preserve the UI shell. Responsive verification is a documented manual desktop/mobile checklist, not new browser automation. | Existing `src/app/*`, `tests/*`; no UI change unless test hook is needed | UI-SCR-001, UI-SCR-009, QA-UI-006; AC build/shell | typecheck, lint, build, test, migration check, DB health, manual viewport checklist, `git diff --check` |

### Step Dependencies

1. Steps 1-2 verify runtime and database prerequisites.
2. Steps 3-6 define the new schema and forward migration before helpers/tests.
3. Steps 7-8 update shared safeguards after schema constraints exist.
4. Step 9 proves the safeguards with PostgreSQL; Step 10 validates only.
5. No step activates an invoice, invokes Midtrans, or changes a later-ticket
   feature path.

## State And Data Impact

~~~text
State transitions added/changed:
None. Reuse the approved transaction-state and financial-result vocabulary.
The foundation supplies conditional state-version infrastructure only.

Schema/migration impact:
One additive `0003` migration creates payment_invoices,
payment_provider_events, and payment_reconciliations. payment_invoices uses
`is_active = false` by default and a partial unique index on active invoices;
later tickets own activation/retirement. It adds actor_scope to idempotency
keys, Buyer/Seller-only checks for creator/participant roles, and PostgreSQL
append-only/financial-success triggers. Legacy manual-payment tables remain
annotated compatibility-only and are neither removed nor used by new modules.

Authorization impact:
Product roles remain Buyer, Seller, and Admin. ADMIN cannot be persisted as a
transaction creator/participant. `SYSTEM:<job-name>` is an idempotency scope,
not an account or role. Server ownership remains authoritative.

Audit/notification impact:
Accepted mutations atomically persist business/evidence/audit with a caller
correlation ID. Rejections create only a sanitized durable audit event after
business rollback. PostgreSQL triggers make audit rows insert-only and protect
financial result/reference/evidence once result is SUCCESS. No notification or
job behavior is introduced.

Manual operation impact:
None. This creates persistence boundaries only; it does not execute payment,
reconciliation, refund, payout, WhatsApp, or risk work.
~~~

## Test Plan

| Layer | Case | Expected evidence |
| --- | --- | --- |
| Static | Typecheck, lint, production build | Existing app compiles; no new state/role/UI feature |
| Local PostgreSQL | Compose startup, healthcheck, migration, restart | Local service is healthy and volume persists |
| Migration | Apply legacy 0000-0002 plus additive 0003 | Midtrans tables, actor_scope, checks, indexes, and triggers exist; legacy tables still exist |
| Invoice constraint | Concurrent active invoice insert plus inactive history insert | Exactly one active invoice per transaction; inactive records allowed |
| Role constraints | Direct insert creator/participant ADMIN, duplicate role, same account | PostgreSQL rejects invalid rows and accepts valid partial lifecycle rows |
| Idempotency | ACCOUNT and SYSTEM same-key retry, differing hash, concurrent calls | Canonical result returns once; conflict rejects; no system account/role |
| Accepted mutation | Business/evidence/audit success in one transaction | All three commit with shared caller correlation ID |
| Rejected mutation | Validation/authorization/version/idempotency failure | Business write rolls back; sanitized rejection audit persists separately |
| Immutability | UPDATE/DELETE audit row and successful financial evidence | PostgreSQL trigger rejects modifications/deletion |
| Sensitive data | Generic projection/audit payload fixture | Raw provider/bank/OTP/secret fields are absent; masked output remains allowed |
| UI/manual | Desktop and mobile viewport checklist | Existing UI-SCR-001/009 shell remains constrained/readable; no browser tool added |

## Risks And Safeguards

| Risk | Safeguard | Recovery/rollback |
| --- | --- | --- |
| New schema breaks code importing legacy tables | Additive migration retains annotated legacy declarations; no route changes | Roll back only 0003 in local/dev after review; never reset developer volume |
| Active invoice constraint is accidentally activated by this ticket | Default `is_active=false`; no activation code in scope | Remove only unintended test data; BAYAR-004 owns activation |
| System idempotency creates an unauthorized identity | `SYSTEM:<job-name>` is stored scope only, never an account/session/product role | Reject unrecognized scope format in helper validation |
| Rejection audit leaks sensitive data | Rejection audit payload is a fixed sanitized error category/correlation, never raw request or credentials | Triggered test prevents raw fields; patch payload allowlist before merge |
| Triggers block legitimate setup or cleanup | Scope triggers to audit rows and SUCCESS financial fields; test fixtures clean dependent data before protected rows | Revise trigger only through a new reviewed forward migration |
| Future code resumes legacy manual payment model | Schema annotations and source-scan test require new foundation modules to use Midtrans tables only | BAYAR-004/005 explicitly replace feature behavior before legacy removal |
| OrbStack leaks into production | Compose/test settings stay local; SQL remains PostgreSQL-compatible | Production selects separate PostgreSQL runtime without app fork |

## Plan Completion Check

- [x] Every BAYAR-001 acceptance criterion maps to a file/module, risk, and
  verification step.
- [x] `payment_invoices` has explicit active semantics, partial unique index,
  ownership boundary, migration, and concurrent test.
- [x] `actor_scope` has exact ACCOUNT/SYSTEM formats, non-role semantics,
  unique index, helper change, and tests.
- [x] Accepted and rejected audit paths are distinct; trigger enforcement and
  all required commit/rollback/immutability tests are specified.
- [x] Creator/participant Buyer-or-Seller checks prevent ADMIN transaction
  membership while preserving the three approved product roles.
- [x] Legacy manual-payment tables remain compatibility-only; no feature route
  or provider behavior is included.
- [x] OrbStack remains local-only; responsive check remains manual.
- [x] No transaction state or financial result is added.
- [ ] Plan Review approval is required before implementation.

