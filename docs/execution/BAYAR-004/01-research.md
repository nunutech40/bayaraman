# Codebase Research

## Task

~~~text
Ticket ID/title: BAYAR-004 — Midtrans Invoice, Hosted Checkout, and Payment Expiry
Requested outcome: Create one idempotent Midtrans payment link from frozen
transaction terms, expose hosted checkout/status refresh to Buyer, and expire
unpaid transactions at the original absolute 1x24-hour deadline.
Source requirements: UR-BUYER-004/005/009, UR-SYSTEM-004..007,
UR-PARTICIPANT-001, UR-BR-008..010, UR-BR-030/031/033..035
Source UX Flow/UI/QA IDs: UX-FLOW-013/014/044..046/048;
UI-SCR-009/010/021; QA-MP-001..004, QA-PAY-001..003,
QA-EXP-001/002, QA-UI-002
~~

Status: Draft

## Relevant Context Read

| File/doc | Why it is relevant | Key constraint found |
| --- | --- | --- |
| `AGENTS.md` | Repository and execution safety rules | Work on one ticket; preserve prior changes; use approved ticket plan before coding |
| `docs/engineering/tickets/BAYAR-004-payment-instructions-sudah-bayar.md` | Ticket scope and acceptance criteria | Midtrans `payment_type: payment_link`; no webhook/payment confirmation in this ticket; expiry belongs here |
| `docs/execution/BAYAR-003/04-validation.md` | Previous ticket handoff | BAYAR-003 leaves complete role data in `WAITING_COUNTERPARTY_DATA` and does not create payment instructions |
| `PRD.md` v0.2 | Approved product boundary | Hosted Midtrans payment, authority/reconciliation boundary, original deadline, and late-fund non-revival |
| `TRD.md` v1.2 | Technical state/schema contract | `payment_invoices`, provider-neutral payment boundary, state version, idempotency, immutable evidence, and approved states |
| `src/server/db/schema.ts` | Current persistence | Midtrans invoice/provider-event/reconciliation tables already exist; legacy manual payment tables remain compatibility-only |
| `src/server/transaction/service.ts` | BAYAR-003 handoff | Role-data completion now freezes `transaction_terms.frozen_at`, remains `WAITING_COUNTERPARTY_DATA`, and exposes derived readiness |
| `src/server/payment/payment.ts` | Existing payment implementation | Legacy manual-bank instruction/claim flow; must be replaced or isolated from the new Midtrans path |
| `src/server/payment/config.ts`, `projection.ts` | Legacy receiving account/UI projection | Manual receiving-bank config is not the new primary payment flow |
| `src/server/jobs/payment-expiry.ts`, `run-payment-expiry.ts` | Existing expiry boundary | Current job reads legacy `payment_instructions` and `payment_claims`; it must not be reused without a Midtrans invoice boundary |
| `src/app/api/transactions/[id]/payment-instructions/route.ts` | Existing payment route | Legacy manual payment response; must be replaced/deferred behind the new invoice/payment-link contract |
| `src/app/api/transactions/[id]/payment-claim/route.ts` | Existing `Sudah Bayar` route | Legacy claim changes state to `PAYMENT_UNDER_REVIEW`; prohibited as payment confirmation in the new flow |
| `src/components/transactions/status.tsx` | Current transaction UI | BAYAR-003 removed the legacy payment panel; Midtrans invoice/hosted-link/status UI is not implemented yet |
| `tests/unit/payment.test.ts`, `tests/integration/*` | Test conventions | Vitest unit tests and optional PostgreSQL integration tests; payment tests currently target legacy config/projection/expiry behavior |

## Current Behavior

- BAYAR-003 completes both participant datasets by setting
  `transaction_terms.frozen_at`, incrementing `state_version`, and retaining
  `WAITING_COUNTERPARTY_DATA`. It does not create payment instructions,
  invoices, payment deadlines, or claims.
- The database already has `payment_invoices` with provider/order/link/status,
  amount, `issued_at`, `deadline_at`, optional `due_date_at`, `is_active`, and
  `retired_at`; it also has `payment_provider_events` and
  `payment_reconciliations`. These tables are the intended Midtrans boundary.
- `payment_invoices` already has one active invoice per transaction enforced by
  a partial unique index. BAYAR-004 must use that constraint and must not
  create a second invoice on duplicate/retry.
- `src/server/payment/payment.ts` still implements the old manual-bank flow:
  it reads role-owned data, creates `payment_instructions`, locks data,
  advances to `WAITING_BUYER_PAYMENT`, and records
  `PAYMENT_INSTRUCTIONS_ISSUED`. This path is not called by BAYAR-003 anymore,
  but its routes/job remain and are not a valid Midtrans implementation.
- The existing payment claim flow inserts a legacy `payment_claims` row and
  changes `WAITING_BUYER_PAYMENT` to `PAYMENT_UNDER_REVIEW`. The new ticket
  requires a Buyer status refresh boundary and must not use this as payment
  confirmation.
- `payment-expiry.ts` scans `payment_instructions`, ignores active claims,
  and changes eligible transactions to `PAYMENT_EXPIRED`. It is not tied to
  `payment_invoices`, invoice `deadline_at`, provider authority, or a
  deterministic system/job idempotency boundary.
- Midtrans adapter, hosted payment-link creation, provider request mapping,
  provider secret isolation, and invoice status projection are not present.
- `src/components/transactions/status.tsx` currently shows the pre-payment
  readiness handoff and has no manual payment panel. The Midtrans link and
  status states still need to be added within the existing mobile-width shell.

## Code Map

| Responsibility | Existing file/module | Symbol/route | Notes |
| --- | --- | --- | --- |
| Invoice persistence | `src/server/db/schema.ts` | `paymentInvoices` | Existing Midtrans-ready fields and active-invoice partial index |
| Provider event persistence | `src/server/db/schema.ts` | `paymentProviderEvents` | Owned by BAYAR-005 webhook/reconciliation; BAYAR-004 should not implement webhook authority |
| Reconciliation persistence | `src/server/db/schema.ts` | `paymentReconciliations` | Reserved for provider-status/manual reconciliation boundary |
| Legacy payment creation | `src/server/payment/payment.ts` | `issuePaymentInstructions` | Manual-bank path; not a valid BAYAR-004 implementation target |
| Legacy payment read | `src/server/payment/payment.ts` | `readPaymentInstructions` | Exposes manual receiving account and legacy claim state |
| Legacy payment claim | `src/server/payment/payment.ts` | `submitPaymentClaim` | `Sudah Bayar` behavior; must not confirm Midtrans payment |
| Receiving-account config | `src/server/payment/config.ts` | `getReceivingAccount` | Legacy manual-bank config; not primary Midtrans payment flow |
| Legacy expiry | `src/server/jobs/payment-expiry.ts` | `expireDuePaymentInstructions` | Must be replaced or isolated to invoice deadline and no-claim logic |
| Expiry runner | `src/server/jobs/run-payment-expiry.ts` | CLI entry | Local scheduler boundary available for deterministic job execution |
| Transaction API | `src/app/api/transactions/[id]/route.ts` | `GET` | Participant-scoped status read; suitable base for invoice/status projection |
| Legacy payment API | `src/app/api/transactions/[id]/payment-instructions/route.ts` | `GET` | Must not remain the primary payment UI contract |
| Legacy claim API | `src/app/api/transactions/[id]/payment-claim/route.ts` | `POST` | Must not be exposed as `Sudah Bayar` in the new flow |
| Transaction UI | `src/components/transactions/status.tsx` | `TransactionStatus` | Existing constrained mobile-width shell and loading/error message pattern |
| Idempotency | `src/server/transaction/mutation.ts` | `findIdempotentResult`, `saveIdempotentResult` | Uses `(actor_scope, command, key)` and request hash |
| Audit | `src/server/transaction/audit.ts` | `recordTransactionEvent` | Append-only transaction audit pattern |
| Database runtime | `src/server/db/index.ts`, `compose.yaml` | PostgreSQL/OrbStack | Local validation runtime only; production remains PostgreSQL-compatible |

## Existing Patterns To Reuse

- Use Drizzle transactions for invoice creation, active-invoice lookup,
  transaction state/version update, idempotency result, and audit event.
- Resolve actor identity server-side through the existing session and
  participant authorization helpers; do not trust client account IDs.
- Use `findIdempotentResult`/`saveIdempotentResult` with an account or system
  actor scope and request hash; duplicate requests return the stored result.
- Keep provider credentials in server-only configuration. Return only the
  hosted payment URL, frozen amount, provider status, and absolute WIB
  deadline to authorized participants.
- Use conditional updates with transaction ID, exact state, state version, and
  invoice deadline for expiry. Write `PAYMENT_EXPIRED` audit only after the
  state update succeeds.
- Keep UI in the existing `.app-shell` constrained mobile-width surface and
  reuse its loading, disabled, error, and recovery message patterns.
- Use fixed-clock unit tests for deadline boundaries and PostgreSQL integration
  tests for active-invoice uniqueness, concurrent creation, state-version
  conflicts, and expiry reruns.

## Change Surface

| Area | Likely change? | Reason/risk |
| --- | --- | --- |
| UI | Yes | Add hosted Midtrans link, frozen amount/deadline/status refresh, and loading/error/expired/unauthorized states for UI-SCR-009/010/021 |
| API | Yes | Add provider-neutral invoice creation/read/status-refresh boundary; remove legacy manual payment as the primary contract |
| State | Yes | Transition complete frozen data to `WAITING_BUYER_PAYMENT`; expire only that state to `PAYMENT_EXPIRED`; no new state |
| Database | Maybe | Reuse existing `payment_invoices`/constraints; add only fields/indexes required by approved ticket if current schema is insufficient |
| Auth | Yes | Buyer/Seller participant authorization for payment-link read/status refresh; no Admin payment decision in BAYAR-004 |
| Jobs/integrations | Yes | Midtrans payment-link adapter boundary and deterministic invoice expiry job; no webhook authority or real money confirmation |
| Tests/docs | Yes | Add provider fake, idempotency, frozen amount/deadline, expiry, late-fund, access, and UI-state tests; update validation later |

## Unknowns And Assumptions

| Item | Can be inferred safely? | Evidence or decision needed |
| --- | --- | --- |
| Midtrans SDK versus direct HTTP client | No | Implementation plan must choose a provider-neutral adapter shape; production credential/deployment remains launch-gated |
| Exact invoice response fields | Partly | Persist only approved provider invoice ID, hosted URL, status, amount, issued/deadline, and idempotency reference |
| Provider `due_date` support | Yes for boundary | Send BayarAman absolute deadline when supported; never let provider retry reset the BayarAman deadline |
| Webhook confirmation | Yes | Defer authoritative webhook validation and reconciliation to BAYAR-005; BAYAR-004 must not mark paid |
| Status refresh behavior | Yes for boundary | Buyer refresh reads current invoice/provider status; it cannot create payment authority or change to paid |
| Expiry after provider success arrives late | Yes | Keep expired/cancelled transaction closed; route late funds to the later reconciliation/refund boundary without revival |
| Legacy payment routes | No | Plan must decide whether to remove, quarantine, or leave compatibility routes without allowing them as the primary UI contract |
| System/job actor identity | Yes | Use `SYSTEM:<job-name>` idempotency scope; do not create a product account or role |

## Research Conclusion

~~~text
Recommended implementation boundary: Build a server-only, provider-neutral
Midtrans Invoice API adapter for `payment_type: payment_link`; create exactly
one active invoice from frozen transaction terms; persist the hosted URL,
provider reference/status, amount, absolute 1x24-hour deadline, optional due
date, and idempotency result; expose an authorized Buyer/Seller status/link
projection; and replace the legacy instruction-based expiry with an atomic,
fixed-clock-safe invoice expiry job. Keep webhook signature/authority,
payment confirmation, Admin reconciliation, refund, payout, and money movement
out of BAYAR-004 for BAYAR-005 or their owning tickets.

Main risks: the old manual-bank payment service/routes/job still exist;
Midtrans adapter credentials and response mapping are undecided; invoice
creation must not race or reset frozen amount/deadline; provider outage and
late status must remain non-authoritative; and an expired transaction must
never be revived. The existing payment tables and `payment_invoices` schema
must remain compatible while the new path is introduced.

Files likely affected: `src/server/payment/` adapter/config/projection,
transaction payment-link service and routes, `src/server/jobs/payment-expiry.ts`,
`src/app/api/transactions/[id]/...`, `src/components/transactions/status.tsx`,
focused payment unit/integration tests, and possibly an additive schema
migration only if the approved plan identifies a missing invoice field.

Ready to plan: Yes, after choosing the adapter contract and explicitly
preserving the BAYAR-005 webhook/payment-authority boundary.
~~~
