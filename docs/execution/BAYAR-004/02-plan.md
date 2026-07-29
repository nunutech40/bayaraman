# Implementation Plan

## Task

~~~text
Ticket ID/title: BAYAR-004 — Midtrans Invoice, Hosted Checkout, and Payment Expiry
Outcome: Create one idempotent Midtrans Invoice API payment link from frozen
transaction terms, expose the hosted checkout/status boundary to participants,
and expire unpaid transactions at the original absolute 1x24-hour deadline.
Source research: docs/execution/BAYAR-004/01-research.md
Source requirements and QA scenarios: UR-BUYER-004/005/009,
UR-SYSTEM-004..007, UR-PARTICIPANT-001, UR-BR-008..010, UR-BR-030/031/033..035;
QA-MP-001..004, QA-PAY-001..003, QA-EXP-001/002, QA-UI-002
Source UX Flow and UI IDs/states: UX-FLOW-013/014, UX-FLOW-044..046/048;
UI-SCR-009/010/021
~~

Version: 0.1
Status: Draft
Depends on: BAYAR-003 implementation and validation
Blocks: BAYAR-005

## Scope

### In Scope

- Provider-neutral Midtrans Invoice API adapter using `payment_type: payment_link`.
- One active invoice per transaction with frozen amount, hosted URL, invoice ID,
  provider status, issued timestamp, absolute deadline, optional provider due date,
  and idempotent result.
- Authorized hosted checkout/status projection and `Cek status pembayaran` refresh.
- Transition from complete frozen role data to `WAITING_BUYER_PAYMENT`.
- Deterministic invoice expiry job for the original 1x24-hour deadline.
- Late-payment non-revival boundary and handoff to later reconciliation/refund work.
- Loading, disabled, provider-error, pending, expired, unauthorized, and recovery UI.

### Out Of Scope

- Webhook signature validation, authoritative payment confirmation,
  duplicate/delayed/out-of-order webhook reconciliation, and Admin payment decisions;
  these belong to BAYAR-005.
- `PAYMENT_CONFIRMED` production behavior, bank evidence, payment claims,
  `Sudah Bayar`, refund, payout, split settlement, money movement, WhatsApp,
  cancellation, complaint, and risk operations.
- New product roles, transaction states, or financial operation results.
- Production credential deployment, merchant settlement, custody, legal/compliance,
  and real-money launch approval.

## Approved Implementation Decisions

1. **Invoice adapter:** Define a provider-neutral `PaymentInvoiceAdapter` under
   `src/server/providers/payment-invoice.ts`, with the Midtrans implementation
   under `src/server/providers/midtrans/` and a fake adapter for tests. The create request sends
   Midtrans implementation and a fake adapter for tests. The create request sends
   `payment_type: payment_link`, frozen total amount, transaction/order reference,
   and the BayarAman deadline as provider `due_date` when supported. Provider
   credentials are read server-side only. The adapter contract defines the
   server-only base URL, timeout, request validation, response mapping, and
   safe error categories (`TIMEOUT`, `UNAVAILABLE`, `INVALID_RESPONSE`,
   `PROVIDER_REJECTED`); no raw provider response is returned to the client.
   Configuration is server-only: `MIDTRANS_SERVER_KEY`,
   `MIDTRANS_API_BASE_URL`, `MIDTRANS_ENVIRONMENT`, and
   `MIDTRANS_REQUEST_TIMEOUT_MS`. Tests use a fake adapter and test secret.
2. **Invoice idempotency:** Use `PAYMENT_INVOICE_CREATE` with the existing
   `(actor_scope, command, key)` idempotency boundary and request hash. Add a
   non-null `payment_invoices.idempotency_reference` with format
   `PAYMENT_INVOICE_CREATE:<actorScope>:<key>`. A unique index maps one
   invoice creation command to one immutable reference. The stored result
   contains only safe invoice references/projection data. The database
   `payment_invoices_one_active_idx` remains the final one-active-invoice guard.
3. **Frozen terms/deadline:** Require `transaction_terms.frozen_at IS NOT NULL`,
   both participants, `WAITING_COUNTERPARTY_DATA`, and the expected state version
   before invoice creation. Set `issuedAt` and `deadlineAt = issuedAt + 24 hours`
   once; retries, refreshes, provider calls, and status checks never recalculate it.
4. **Provider response:** Persist provider invoice ID, hosted URL, provider status,
   amount, issued/deadline timestamps, optional due date, and safe provider order
   reference. Do not persist provider secrets or raw provider payloads in client,
   audit, or idempotency results.
5. **Payment authority boundary:** BAYAR-004 may display provider status and
   launch the hosted page, but never marks payment authoritative or creates
   `PAYMENT_CONFIRMED`. A later BAYAR-005 webhook/Get Status reconciliation may
   win the state-version race before expiry.
6. **Expiry:** Expiry reads `payment_invoices.deadline_at` and conditionally changes
   only `WAITING_BUYER_PAYMENT` to `PAYMENT_EXPIRED`. The update must match
   transaction ID, state, state version, active invoice, and deadline. Audit is
   written only after the update succeeds. Reruns are no-ops.
7. **Late funds:** A provider success received after expiry/cancellation does not
   revive the transaction. BAYAR-004 records no refund or financial operation;
   BAYAR-005/later Admin reconciliation owns the exception handoff.
8. **Legacy route quarantine:** The old
   `/api/transactions/[id]/payment-instructions` and
   `/api/transactions/[id]/payment-claim` routes return `410 Gone` with a safe
   migration message. They are not read or written by the new flow and are not
   used by participant UI. Legacy tables remain compatibility-only.

## Planned Changes

| Step | Change | File/module | Requirement/UX/UI/AC covered | Verification |
| --- | --- | --- | --- | --- |
| 1 | Add provider-neutral invoice adapter, Midtrans request/response mapper, server-only config, and fake adapter. | `src/server/providers/payment-invoice.ts`, `src/server/providers/midtrans/invoice.ts`, `src/server/providers/midtrans/config.ts`, `src/server/providers/midtrans/fake.ts` | PB-MP-001/002; UR-SYSTEM-004, UR-BUYER-004; QA-MP-001/002 | Request contains `payment_type: payment_link`; provider secret absent from client/log/audit; fake responses map safe fields only; timeout and provider errors map to defined categories |
| 2 | Add invoice creation service with frozen-term validation, one-active-invoice check, idempotency, request hash, and immutable deadline/result projection. | `src/server/payment/invoice.ts`, `src/server/payment/projection.ts`, `src/server/transaction/service.ts` or payment handoff module | UX-FLOW-013/044; UR-BR-008/009/030/031; AC-1/2 | Complete frozen transaction creates one invoice; incomplete/unfrozen/stale state rejects; duplicate returns same result and deadline |
| 3 | Add the invoice idempotency reference and concrete immutable-field database enforcement. | `src/server/db/schema.ts`, `drizzle/0006_bayar004_invoice_integrity.sql` | TRD Sections 6/7/10; UR-PAYMENT-001/002; active invoice and immutable amount/deadline contract | Migration preflight/backfill, unique idempotency-reference index, `payment_invoices_one_active_idx`, named trigger rejects immutable update/delete, provider status/lifecycle fields remain mutable, concurrent creation test |
| 4 | Add concrete participant-authorized invoice/link/status routes. Both Buyer and Seller may invoke the idempotent ensure command; the server performs the system-side mutation after readiness. | `src/app/api/transactions/[id]/payment-link/route.ts`, `src/app/api/transactions/[id]/payment-status/route.ts`, existing transaction read projection | TRD route contract; UR-BUYER-004/005, UR-PARTICIPANT-001; UX-FLOW-013/014; UI-SCR-009/010; AC-3 | Session-derived Buyer/Seller participant authorization, frozen/state/version/idempotency checks, unrelated/unauthenticated/Admin denial, refresh does not reset deadline, no paid transition, safe provider error |
| 5 | Replace the legacy payment-instruction expiry boundary with invoice expiry. | `src/server/jobs/payment-expiry.ts`, `src/server/jobs/run-payment-expiry.ts`, `package.json` | UR-SYSTEM-004..007; UX-FLOW-045/048; QA-EXP-001/002; AC-4 | Fixed-clock before/at/after deadline, atomic state/version update, active invoice predicate, no duplicate audit, no revival |
| 6 | Remove legacy manual payment controls from the participant UI and quarantine the legacy routes with `410 Gone`; do not implement BAYAR-005 behavior. | `src/components/transactions/status.tsx`, `src/app/api/transactions/[id]/payment-instructions/route.ts`, `src/app/api/transactions/[id]/payment-claim/route.ts` | UI-SCR-009/010/021; QA-UI-002; AC-3/5 | No manual bank instruction or `Sudah Bayar` in participant UI; legacy routes cannot create claims/instructions; UI-SCR-021 remains deferred/disabled |
| 7 | Add focused unit, adapter, route, PostgreSQL, fixed-clock, and UI-state tests. | `tests/unit/payment.test.ts`, `tests/integration/payment.test.ts`, repository-equivalent files | QA-MP-001..004, QA-PAY-001..003, QA-EXP-001/002, QA-UI-002; all AC | Frozen amount/deadline, duplicate/concurrent invoice, authorization, provider outage, refresh, expiry race, late-fund non-revival, masking, and UI states |
| 8 | Record execution evidence and scope validation. | `docs/execution/BAYAR-004/04-validation.md` | Ticket Definition of Done | Typecheck, lint, build, tests, migration, PostgreSQL health, diff check, and no BAYAR-005 behavior |

### Dependency Order

1. Confirm current invoice schema/config and adapter contract.
2. Implement `src/server/providers/payment-invoice.ts`, the Midtrans provider
   module, fake adapter, and safe projection.
3. Implement idempotent invoice service and mandatory immutable-field migration `0006`.
4. Add participant-authorized `/payment-link` and status routes with the
   server-side system mutation boundary.
5. Replace expiry job with `payment_invoices` deadline logic.
6. Update participant UI states and remove primary manual-payment controls.
7. Run PostgreSQL integration/fixed-clock/UI-state validation.

No real production Midtrans credential or webhook deployment is required for
this ticket. Local tests use the fake adapter and PostgreSQL in OrbStack.

## State And Data Impact

~~~text
State transitions added/changed:
- WAITING_COUNTERPARTY_DATA -> WAITING_BUYER_PAYMENT only after both role
  datasets are complete, terms are frozen, and one invoice is persisted.
- WAITING_BUYER_PAYMENT -> PAYMENT_EXPIRED only after the absolute invoice
  deadline and a successful atomic conditional update.
- No transition to PAYMENT_CONFIRMED is implemented here.
- A later provider-authoritative transition from BAYAR-005 wins through the
  same state/version guard and causes expiry to no-op.

Schema/migration impact:
- Reuse payment_invoices, payment_provider_events, and
  payment_reconciliations schema boundaries.
- Preserve the existing one-active-invoice partial unique index.
- Add `payment_invoices.idempotency_reference` as a non-null field for new and
  existing rows, using deterministic
  `PAYMENT_INVOICE_CREATE:LEGACY:<invoiceId>` backfill before setting NOT NULL,
  and a unique index on the field.
- Add `0006_bayar004_invoice_integrity.sql` with named function
  `bayaraman_payment_invoice_immutable_fields()` and trigger
  `payment_invoices_immutable_fields` that rejects UPDATE/DELETE changes to
  transaction/provider/order/invoice/link, amount/currency, issued/deadline/
  due-date, and idempotency-reference fields. The trigger rejects DELETE for
  issued rows. Provider status, `is_active`, and `retired_at` remain mutable
  for later lifecycle/reconciliation owners. Migration preflight reports null
  or duplicate references before backfill; recovery resolves reported rows
  and reruns the unchanged migration.
- No new transaction state, product role, or financial result.

Authorization impact:
- Authenticated Buyer or Seller participants may invoke the `/payment-link`
  ensure command and read the hosted link/status projection. The server
  performs the mutation; this is not a new product/system role.
- Server resolves account and transaction ownership; client account IDs are
  ignored.
- The command requires both participants, frozen terms, exact
  `WAITING_COUNTERPARTY_DATA`, expected state version, and `Idempotency-Key`.
- Admin does not receive payment-confirmation authority in BAYAR-004.

Audit/notification impact:
- Record safe invoice-issued and payment-expired events with transaction,
  version, invoice reference, amount/deadline, and correlation metadata.
- Never record provider secret, raw provider payload, raw credentials, or
  sensitive account data.
- No webhook notification, payment confirmation, refund, payout, or WhatsApp
  notification is created here.

Manual operation impact:
- Buyer opens the Midtrans hosted payment page.
- `Cek status pembayaran` only refreshes status; it is not a payment claim.
- Admin reconciliation, authoritative payment decision, and late-fund refund
  are handed off to BAYAR-005/later financial tickets.
~~~

## API And Job Contract

~~~text
POST /api/transactions/[id]/payment-link
- Authenticated Buyer/Seller participant request to ensure the invoice exists;
  the server executes the system-side domain mutation.
- Requires frozen terms, both role datasets, WAITING_COUNTERPARTY_DATA, and
  expected state version.
- Uses Idempotency-Key and returns the same safe invoice result on duplicate.
- Creates no payment authority; provider failure leaves transaction state intact.

GET /api/transactions/[id]/payment-instructions
POST /api/transactions/[id]/payment-claim
- Return `410 Gone` with a safe migration message.
- Do not read/write legacy manual-payment tables or create a claim/state change.

GET /api/transactions/[id]/payment-status
- Authenticated participant projection of invoice ID/reference, hosted URL,
  provider status, frozen amount, issuedAt, deadlineAt, deadlineWib, and the
  next allowed action.
- Refresh never changes amount/deadline and never marks payment paid.

expirePaymentInvoices(now)
- Selects active invoices whose transaction is WAITING_BUYER_PAYMENT and whose
  absolute deadlineAt is <= now.
- Conditionally updates transaction ID, exact state, state version, active
  invoice, and deadline predicate in one database mutation.
- Writes PAYMENT_EXPIRED only after the update returns a row.
- Uses SYSTEM:payment-expiry idempotency/correlation scope where a persisted
  command record is needed; no system account or product role is introduced.
- Local runner remains `npm run job:payment-expiry`; production scheduler is
  an external deployment concern.
~~~

## Test Plan

| Layer | Case | Expected evidence |
| --- | --- | --- |
| Static/type/lint | Typecheck, lint, build, diff check | No type, lint, build, or whitespace errors |
| Unit | Adapter request and response mapping | `payment_type: payment_link`, frozen amount, due date, safe result, provider error mapping |
| Unit | Invoice config/secret boundary | Missing secret fails closed outside test; secret never appears in response/log/audit |
| Unit | Invoice idempotency/deadline | Duplicate request returns same invoice reference, amount, URL, and deadline; no reset |
| Unit | Status projection | Pending/capture/deny/cancel/failure/expire remain non-authoritative; refresh is read-only |
| PostgreSQL integration | Active invoice uniqueness and immutability | Concurrent invoice creation produces one active invoice; idempotency reference is stored; trigger rejects immutable field update/delete while lifecycle/status fields remain mutable |
| PostgreSQL integration | Frozen readiness/state guard | Incomplete, unfrozen, stale, or wrong-state transaction cannot issue invoice |
| PostgreSQL integration | Invoice/expiry race | Exactly one state-version winner; provider-authoritative downstream winner prevents expiry |
| Job/fixed clock | Before, at, and after deadline | Only at/after deadline expires; rerun is idempotent; no duplicate audit |
| Route | Buyer/Seller authorization and refresh | Allowed participant projection; unrelated/unauthenticated denial; no paid transition |
| Route/recovery | Provider outage, timeout, malformed response, retry | State remains safe; same idempotency key can retry; deadline unchanged |
| Late-fund fixture | Success after expiry/cancellation | No revival, no fulfillment/payout; handoff reference only for BAYAR-005 |
| UI/manual | UI-SCR-009/010/021 | Loading, disabled, hosted-link, pending, error, expired, unauthorized, UNKNOWN/deferred states render in mobile-width surface |
| Scope guard | Legacy payment behavior | No `Sudah Bayar`, payment claim, manual bank instruction, `PAYMENT_CONFIRMED`, refund, payout, webhook, or new state; legacy routes return `410 Gone` |

## Risks And Safeguards

| Risk | Safeguard | Recovery/rollback |
| --- | --- | --- |
| Duplicate invoice or provider retry | Idempotency result, request hash, active-invoice partial index, transaction/state lock | Return original result; never reset deadline or create second active invoice |
| Midtrans provider outage/unknown response | Provider-neutral adapter and non-authoritative status projection | Retry same command; leave transaction waiting; BAYAR-005 reconciles ambiguity |
| Provider due date differs from BayarAman deadline | Persist absolute BayarAman deadline as authority; pass due date only when supported | Never recalculate on refresh/retry; late event follows exception handoff |
| Invoice fields drift after issuance | Service guards plus mandatory `0006` PostgreSQL immutability trigger | Reject mutation; use a new approved correction workflow, not overwrite |
| Expiry races provider authority | Atomic state/version/deadline update | The first valid state transition wins; later job/event is idempotent and cannot revive |
| Legacy manual route is used accidentally | Participant UI removes controls and both legacy routes return `410 Gone` | Preserve tables for compatibility; do not use receiving-bank config as primary payment |
| Secret leaks to client/logs | Server-only adapter/config and safe DTO allowlist | Rotate secret/config and invalidate exposed local fixtures; never include raw payload in audit |
| Incomplete BAYAR-003 data | Require frozen terms, both participants, and all role-owned snapshots | Keep `WAITING_COUNTERPARTY_DATA`; no invoice/deadline is created |

## Plan Completion Check

- [x] Every BAYAR-004 acceptance criterion maps to a planned change and verification.
- [x] Midtrans Invoice API and `payment_type: payment_link` are concrete.
- [x] Public creation route is the TRD contract: `POST /api/transactions/[id]/payment-link`.
- [x] Adapter boundary follows TRD under `src/server/providers/midtrans/` with a separate generic interface and fake adapter.
- [x] Hosted checkout, status refresh, frozen amount, and absolute 1x24 deadline are concrete.
- [x] One active invoice and duplicate/concurrent creation behavior are covered.
- [x] `payment_invoices.idempotency_reference` has a concrete persistence and migration contract.
- [x] Idempotency reference format and unique mapping to `PAYMENT_INVOICE_CREATE` are explicit.
- [x] Invoice immutable fields have mandatory PostgreSQL trigger enforcement and update/delete tests.
- [x] Migration preflight/backfill, trigger names, mutable lifecycle fields, and recovery instructions are explicit.
- [x] Legacy manual payment routes have explicit `410 Gone` quarantine behavior and regression tests.
- [x] Adapter timeout, response validation, error categories, and fake-provider behavior are concrete.
- [x] `/payment-link` actor permissions and server-side system mutation boundary are explicit.
- [x] Webhook authority, payment confirmation, Admin reconciliation, and money movement remain BAYAR-005/out of scope.
- [x] Expiry uses invoice deadline, state/version predicates, audit-after-update, and rerun-safe behavior.
- [x] Late payment cannot revive a closed transaction and is handed off without refund implementation here.
- [x] No manual bank instruction or `Sudah Bayar` primary flow remains in the planned UI.
- [x] UI-SCR-021 is only a deferred/disabled boundary.
- [x] Provider secrets and raw provider data are server-only and sanitized.
- [x] No product role, transaction state, or financial result is added.
- [x] Failure, retry, provider outage, authorization, concurrency, and recovery behavior are covered.
- [x] Local PostgreSQL/OrbStack is validation-only and production remains PostgreSQL-compatible.
- [ ] Plan Review approval is required before implementation.

## Traceability Summary

~~~text
Requirements: UR-BUYER-004, UR-BUYER-005, UR-BUYER-009,
UR-SYSTEM-004..UR-SYSTEM-007, UR-PARTICIPANT-001,
UR-BR-008..UR-BR-010, UR-BR-030, UR-BR-031, UR-BR-033..UR-BR-035

UX: UX-FLOW-013, UX-FLOW-014, UX-FLOW-044, UX-FLOW-045,
UX-FLOW-046, UX-FLOW-048

UI: UI-SCR-009, UI-SCR-010, UI-SCR-021

QA: QA-MP-001..QA-MP-004, QA-PAY-001..QA-PAY-003,
QA-EXP-001, QA-EXP-002, QA-UI-002

Product decisions: PB-MP-001..PB-MP-006,
PB-MP-OD-001..PB-MP-OD-005

TRD: Sections 5, 6, 7, 8, 10, 11, 13, and 14
~~~

## Status

~~~text
Version: 0.1
Status: Draft
Ready for Plan Review: Yes
~~~
