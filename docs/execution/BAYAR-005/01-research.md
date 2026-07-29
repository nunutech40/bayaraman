# Codebase Research

## Task

~~~text
Ticket ID/title: BAYAR-005 — Midtrans Payment Webhook and Provider Reconciliation
Requested outcome: Process Midtrans webhook and Get Status API results as the
authoritative payment boundary. Only validated settlement with
fraud_status=accept may move a transaction to PAYMENT_CONFIRMED.
Source ticket: docs/engineering/tickets/BAYAR-005-admin-payment-review.md
~~

Status: Draft
Research date: 2026-07-29

## Relevant Context Read

| File/doc | Why it is relevant | Key constraint found |
| --- | --- | --- |
| `AGENTS.md` | Repository and execution safety rules | Research one ticket at a time; preserve unrelated changes; do not code before approved plan |
| `docs/engineering/tickets/BAYAR-005-admin-payment-review.md` | Ticket scope and acceptance criteria | Webhook/Get Status authority, event ordering, validation, reconciliation, and no refund/payout implementation |
| `PRD.md` v0.2 | Approved product boundary | Midtrans is primary provider; authority is only settlement plus accepted fraud status; late funds never revive a transaction |
| `TRD.md` v1.2, Sections 5-8, 10-11, 13-14 | State, provider, concurrency, audit, authorization, and test contract | Use approved states/results only; event insert and canonical mutation are atomic and version-guarded |
| `docs/product/03-user-requirements.md` v0.4 | Requirement and Admin boundary | UR-ADMIN-001/002/020/021/023 and UR-PAYMENT-004..007 define validation, authority, ordering, reconciliation, and no-revival behavior |
| `docs/product/02-ux-flow.md` v0.3 | Flow and Admin screen traceability | UX-FLOW-015/016/047/048/049/050 and UI-SCR-011/UI-SCR-022 define webhook exception, reconciliation, settlement, expiry, and late-fund paths |
| `docs/product/05-qa-scenarios.md` v0.2 | Executable verification contract | QA-MP-004..008, QA-PAY-003..010, QA-EXP-003/004, and QA-SEC-003 cover event validation, ordering, outage, expiry, and security |
| `docs/execution/BAYAR-004/04-validation.md` | Previous ticket handoff | Invoice link, hosted URL, frozen amount/deadline, active invoice, and expiry boundary already exist; webhook authority is deliberately deferred |
| `docs/engineering/templates/codebase-research-template.md` | Required research structure | Research must identify current behavior, code map, reusable patterns, gaps, risks, and implementation boundary |

Note: The requested ticket filename `BAYAR-005-payment-review-reconciliation.md`
does not exist in this checkout. The repository ticket with ID BAYAR-005 is
`docs/engineering/tickets/BAYAR-005-admin-payment-review.md` and was used as the
authoritative ticket input.

## Current Behavior

- BAYAR-004 creates one active `payment_invoices` row from frozen transaction
  terms, stores the hosted payment URL and provider status, and changes
  `WAITING_COUNTERPARTY_DATA` to `WAITING_BUYER_PAYMENT`.
- `payment_invoices` now contains `idempotency_reference`, a unique
  idempotency-reference index, the one-active-invoice partial index, and
  PostgreSQL triggers protecting issued invoice identity, amount, deadline, and
  idempotency fields.
- `payment_provider_events` already stores provider, provider event ID,
  payload hash, event time, received time, order ID, amount, provider status,
  fraud status, and signature-valid flag. Its unique provider/event index is a
  suitable duplicate-event boundary, but no application writer currently uses
  it.
- `payment_reconciliations` already stores transaction/invoice references,
  provider status reference, deadline, result, evidence reference, Admin
  reconciler, and completion time. No webhook or Get Status service currently
  creates or completes reconciliation records.
- `paymentInvoices` and `paymentProviderEvents` are declared in
  `src/server/db/schema.ts`; there is no canonical payment-authority field
  separate from the transaction state. The approved state machine therefore
  needs a guarded transition to `PAYMENT_CONFIRMED` plus immutable provider
  event/audit evidence, rather than a new transaction state.
- `src/server/providers/midtrans/invoice.ts` only creates hosted payment links.
  There is no provider-neutral webhook/status adapter, signature validator,
  Get Status API client, timeout mapping, or fake status adapter.
- `src/server/payment/invoice.ts` reads a participant-safe invoice projection
  and creates the invoice, but deliberately does not interpret provider status
  as authoritative.
- `src/server/jobs/payment-expiry.ts` expires only active invoices in
  `WAITING_BUYER_PAYMENT`. It uses an atomic state/version/deadline predicate;
  BAYAR-005 must race safely with this job and must never revive expired or
  cancelled transactions.
- Legacy `src/server/payment/payment.ts` and the quarantined manual routes are
  compatibility-only. They are not valid sources for provider reconciliation
  and must not be reactivated.
- No Admin payment-review API or UI surface is implemented. The existing
  product role boundary exposes only Buyer, Seller, and Admin; internal Ops,
  Finance, Supervisor, or Reviewer assignments are not represented as product
  roles.

## Code Map

| Responsibility | Existing file/module | Symbol/table/route | Notes |
| --- | --- | --- | --- |
| Invoice persistence | `src/server/db/schema.ts` | `paymentInvoices` / `payment_invoices` | Existing Midtrans invoice identity, status, amount, deadline, and active flag |
| Provider event persistence | `src/server/db/schema.ts` | `paymentProviderEvents` / `payment_provider_events` | Existing event fields and unique `(provider, provider_event_id)` index; no writer yet |
| Reconciliation persistence | `src/server/db/schema.ts` | `paymentReconciliations` / `payment_reconciliations` | Existing Admin/status/evidence fields; no service or API yet |
| Invoice provider boundary | `src/server/providers/payment-invoice.ts` | `PaymentInvoiceAdapter` | Generic create-link contract; needs a sibling status/webhook contract, not a rewrite of invoice creation |
| Midtrans provider boundary | `src/server/providers/midtrans/invoice.ts` | `MidtransPaymentInvoiceAdapter` | Hosted link only; reuse config/error categories and add status/signature modules in the plan |
| Server-only Midtrans config | `src/server/providers/midtrans/config.ts` | `getMidtransConfig` | Contains server key, base URL, environment, timeout; webhook signature secret/config needs explicit addition |
| Invoice service | `src/server/payment/invoice.ts` | `ensurePaymentLink`, `readPaymentStatus` | Provides frozen amount/deadline and state-version patterns; no authority logic |
| Transaction state | `src/server/domain/transaction/state.ts` | `TRANSACTION_STATES` | Includes approved `PAYMENT_CONFIRMED` and `MANUAL_REVIEW_REQUIRED`; no new state allowed |
| State mutation | `src/server/transaction/service.ts`, `src/server/payment/invoice.ts` | Drizzle transactions and conditional updates | Reuse database transaction, exact state, and `stateVersion` guards |
| Idempotency | `src/server/transaction/mutation.ts`, `src/server/domain/idempotency/index.ts` | `findIdempotentResult`, `saveIdempotentResult`, actor scopes | Existing `(actor_scope, command, key)` and request hash boundary; system scope can be used without a system account |
| Audit | `src/server/transaction/audit.ts`, `src/server/audit/index.ts` | `recordTransactionEvent`, audit event builder | Append-only DB trigger already exists; payload must be sanitized and must not contain raw webhook payload/secrets |
| Transaction read/API | `src/app/api/transactions/[id]/route.ts` | Authenticated participant read | Admin provider-review projection/API is missing |
| Payment routes | `src/app/api/transactions/[id]/payment-link/route.ts`, `payment-status/route.ts` | BAYAR-004 routes | Participant link/status only; no webhook endpoint exists |
| Expiry job | `src/server/jobs/payment-expiry.ts` | `expirePaymentInvoices` | Must not be downgraded by a stale non-authoritative event or late webhook |
| UI surface | `src/components/transactions/status.tsx` | `TransactionStatus` | Participant hosted-link/status UI exists; Admin `UI-SCR-011` and `UI-SCR-022` are missing |
| Test conventions | `tests/unit/payment-invoice.test.ts`, `tests/integration/foundation.test.ts` | Vitest/unit and optional PostgreSQL integration | Existing tests cover invoice persistence constraints and safe adapter output; webhook/reconciliation tests are absent |
| Local database | `compose.yaml`, `src/server/db/index.ts` | PostgreSQL 16 / OrbStack | Local runtime only; production remains PostgreSQL-compatible |

## Existing Patterns To Reuse

- Use Drizzle transactions for provider event insert, duplicate detection,
  reconciliation record, canonical transaction update, idempotency result, and
  audit event so a partially accepted webhook cannot exist.
- Use `payment_provider_events_provider_event_unique` as the first duplicate
  identity check. Store the event even when validation fails, while recording
  sanitized validation outcome and never treating the event as authority.
- Resolve the invoice by validated provider/order ID and compare transaction
  amount/currency before any state mutation. Client-supplied account IDs are
  not trusted for provider events.
- Use exact transaction ID, state, and `stateVersion` in the conditional
  canonical update. A valid settlement may move only an eligible transaction
  to `PAYMENT_CONFIRMED`; an expired/cancelled/financially terminal transaction
  receives late/exception evidence only.
- Preserve authoritative settlement precedence. Pending/capture/non-paid
  events may be stored but cannot downgrade an already authoritative result.
  Older, equal-time, or conflicting events need explicit precedence/recovery
  behavior and must not be resolved by arrival order alone.
- Use `SYSTEM:<job-name>` only for bounded system reconciliation/idempotency
  work. It must not become a product role or account.
- Reuse sanitized append-only audit patterns. Provider secrets, signature
  material, authorization headers, raw payloads, and sensitive participant data
  must not enter client responses, logs, or audit payloads.
- Use the existing mobile-width participant shell only for safe status changes.
  Admin exception UI should follow the approved screen IDs and remain separate
  from participant payment actions.

## Change Surface

| Area | Likely change? | Reason/risk |
| --- | --- | --- |
| Database | Maybe | Add event validation/reconciliation fields or canonical evidence only if existing schema cannot represent immutable precedence and task state; prefer additive migration |
| Provider adapter | Yes | Add Midtrans webhook signature verification, notification mapping, Get Status API, timeout/error categories, and fake adapters |
| API | Yes | Add a public webhook endpoint with no user session requirement and an authenticated Admin reconciliation/status endpoint |
| Payment service | Yes | Add atomic event ingestion, validation, precedence, authoritative settlement, non-paid/UNKNOWN handling, and late-fund no-revival service |
| Admin authorization | Yes | Require server-side Admin authorization; internal task assignment remains data/assignment, not a product role |
| Audit | Yes | Record signature failure, mismatch, duplicate, delayed/out-of-order, reconciliation, and authoritative settlement with correlation IDs |
| UI | Yes, scoped | Add/reuse Admin `UI-SCR-011`/`UI-SCR-022` provider exception/reconciliation states; do not add Buyer/Seller payment authority controls |
| Jobs/integration | Maybe | Add bounded Get Status/reconciliation retry boundary only if ticket and approved plan require it; do not alter expiry semantics |
| Tests/docs | Yes | Add signature, order/amount/fraud, duplicate/order, status lookup, concurrency, no-revival, Admin permission, and audit tests |

## API And Event Boundary Observations

Current code has no webhook route. The implementation plan will need to define
the concrete endpoint, likely a provider callback route such as
`POST /api/webhooks/midtrans`, with these boundaries:

- No BayarAman user session is required for provider delivery; authenticity is
  established by Midtrans signature validation and request contract checks.
- Invalid signature, malformed payload, unknown order, amount mismatch, and
  unsupported status are stored/audited as non-authoritative outcomes and do
  not mutate payment authority.
- The route must return a provider-safe response without leaking internal
  reconciliation details and must be retry-safe for duplicate delivery.
- Admin reconciliation must be a separate authenticated Admin route/service,
  with masked participant projection and no Buyer/Seller financial authority.
- Get Status API calls need a provider-neutral adapter method, bounded timeout,
  retry policy, and explicit `UNKNOWN` result. A status lookup cannot reset the
  invoice deadline or revive a closed transaction.

## Unknowns And Assumptions

| Item | Can be inferred safely? | Evidence or decision needed |
| --- | --- | --- |
| Exact webhook route path and accepted HTTP response contract | No | Implementation Plan must choose a concrete route and provider-safe response behavior |
| Signature formula and secret source | Partly | TRD requires validation; plan must define Midtrans SHA-512/signature input and server-only key/config without exposing it |
| Exact Midtrans Get Status endpoint/response mapping | Partly | Plan must define adapter contract and fake responses for authoritative, non-paid, and UNKNOWN results |
| Event precedence storage | Partly | Existing event table stores event time/status but not an explicit canonical-event reference or reconciliation status; plan must decide whether additive fields are required or existing audit/reconciliation records suffice |
| Equal-time conflicting events | Yes as product rule | Must remain UNKNOWN/reconciliation; never use arrival order as authority |
| `capture` transition behavior | Yes as product rule | Store provider status, keep payment non-authoritative for payout, and do not downgrade an existing settlement |
| Late success after expiry/cancellation | Yes | Store provider event and route to later refund/reconciliation; never change the closed transaction back to an active payment/fulfillment state |
| Admin reconciliation ownership | Yes | Product role is Admin; internal Ops/Finance/Supervisor/Reviewer assignment may be represented as task data only |
| Webhook production deployment and credentials | No | Remains launch-gated by `UR-BR-046`, `PB-MP-009`, `PB-MP-OD-005`, and `QA-LAUNCH-001` |

## Requirement And Verification Traceability

| Boundary | Requirement IDs | UX/UI IDs | QA IDs | Product/TRD |
| --- | --- | --- | --- | --- |
| Signature/order/amount/fraud validation | `UR-ADMIN-001`, `UR-PAYMENT-004` | `UX-FLOW-015`, `UI-SCR-011` | `QA-MP-004`, `QA-MP-005`, `QA-PAY-004`, `QA-SEC-003` | `PB-MP-002`, `PB-MP-003`, TRD 7.3/10 |
| Authoritative settlement | `UR-ADMIN-002`, `UR-ADMIN-021` | `UX-FLOW-016`, `UI-SCR-011` | `QA-MP-005`, `QA-PAY-004` | `PB-MP-003`, TRD 5/6/7 |
| Duplicate/delayed/out-of-order | `UR-ADMIN-020`, `UR-PAYMENT-005` | `UX-FLOW-047`, `UX-DEC-026` | `QA-MP-006`, `QA-PAY-005` | `PB-MP-004`, `PB-MP-OD-003`, TRD 7.3/10 |
| Get Status/UNKNOWN/outage | `UR-ADMIN-023`, `UR-PAYMENT-006` | `UX-FLOW-047`, `UX-FLOW-050`, `UI-SCR-022` | `QA-MP-007`, `QA-PAY-007`, `QA-EXP-003` | `PB-MP-005`, `PB-MP-OD-004`, TRD 7.3/8 |
| Expiry and late-fund no revival | `UR-SYSTEM-005`, `UR-SYSTEM-006`, `UR-BR-034`, `UR-BR-035`, `UR-PAYMENT-007` | `UX-FLOW-048`, `UX-FLOW-049`, `UX-FLOW-050` | `QA-MP-008`, `QA-EXP-003`, `QA-EXP-004`, `QA-PAY-009`, `QA-PAY-010` | `PB-MP-006`, `PB-MP-OD-005`, TRD 6/8 |
| Admin authorization and masked data | `UR-ADMIN-020`, `UR-BR-044`, `UR-BR-045` | `UI-SCR-011`, `UI-SCR-022` | `QA-SEC-003`, `QA-UI-005` | TRD 10/11/14 |

## Scope Boundary

In scope for BAYAR-005 research/planning:

- Midtrans notification webhook validation and provider event persistence.
- Get Status API reconciliation and Admin exception assignment.
- Authoritative settlement transition to `PAYMENT_CONFIRMED`.
- Non-authoritative, duplicate, delayed, out-of-order, mismatch, outage,
  UNKNOWN, partial, excess, duplicate-payment, and late-fund behavior.
- State-version, idempotency, append-only audit, and no-revival safeguards.

Explicitly out of scope:

- Invoice creation or hosted-link creation, which belongs to BAYAR-004.
- Refund, payout, split settlement, and money movement.
- WhatsApp groups, fulfillment, Buyer OTP, cancellation, complaint, and risk
  operations.
- Production credential provisioning, real webhook deployment, merchant
  settlement/custody, and legal/compliance launch approval.

## Research Conclusion

~~~text
Recommended implementation boundary: add a server-only Midtrans webhook and
Get Status API adapter, a public webhook ingestion route, and an Admin-only
reconciliation service/UI. Store every provider event using the existing
unique provider/event boundary and sanitized payload fields. Validate
signature, order ID, transaction ID, amount, currency, fraud status, and event
identity before any canonical mutation. Apply a validated
settlement + fraud_status=accept exactly once through a transaction/state-version
guard to PAYMENT_CONFIRMED. Store pending, capture, deny, cancel, failure,
expire, invalid, delayed, duplicate, out-of-order, and UNKNOWN outcomes without
allowing them to downgrade authority or revive expired/cancelled transactions.

Main gaps: no webhook route, signature verifier, Get Status adapter, event
precedence/canonical-result service, Admin reconciliation API/UI, or focused
tests exist. Existing payment_provider_events and
payment_reconciliations tables are useful but may need additive fields for
canonical event/reconciliation status depending on the approved plan. No
source behavior should be implemented until the plan resolves those schema
and provider-contract details.

Ready to plan: Yes, after choosing the concrete webhook route/response,
signature/config boundary, Get Status adapter contract, event precedence
representation, and Admin reconciliation authorization contract.
~~~
