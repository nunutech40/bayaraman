# Codebase Research: BAYAR-008

## Task

```text
Ticket ID/title: BAYAR-008 - Admin Payout, Refund, and Split Financial Operations
Requested outcome: Admin-owned payout, refund, and split operations against frozen destinations with authorization, recovery, and immutable evidence.
Source requirements: UR-ADMIN-006..011, UR-BR-019..022, UR-BR-025, UR-BR-038, UR-BR-040..043, UR-BR-045
Source UX Flow/UI/QA IDs: UX-FLOW-025..031; UI-SCR-015, UI-SCR-016, UI-SCR-018..020; QA-FIN-001..008, QA-SEC-003, QA-SLA-002
Technical boundary: PRD.md v0.2, TRD.md v1.2 Sections 5, 8..14
```

## Relevant Context Read

| File/doc | Why it is relevant | Key constraint found |
| --- | --- | --- |
| `docs/engineering/tickets/BAYAR-008-admin-exception-seller-payout.md` | Ticket contract | Payout, refund, split, two-Admin approval, payout re-authentication, and financial recovery are in scope; complaint adjudication and destination replacement are out of scope. |
| `docs/execution/BAYAR-007/04-validation.md` | Previous ticket handoff | Buyer confirmation and approved overdue exception end at `READY_FOR_PAYOUT`; payout execution is explicitly deferred to BAYAR-008. |
| `PRD.md` v0.2 | Product boundary | Settlement is not payout; only `SUCCESS` plus immutable evidence may produce `PAID_OUT` or `REFUNDED`; Admin is the only operational product role. |
| `TRD.md` v1.2 | Technical contract | Financial results are `PROCESSING`, `SUCCESS`, `FAILED`, `UNKNOWN`; two-Admin approval and payout re-authentication are server-side boundaries; provider refund uses Midtrans when supported and manual Admin fallback otherwise. |
| `docs/product/03-user-requirements.md` v0.4 | Requirement traceability | Buyer/Seller/Admin remain the only product roles; financial actions require ownership, approval, re-authentication, audit, and SLA handling. |
| `docs/product/02-ux-flow.md` v0.3 | Handoffs and states | Payout/refund/split are separate from payment authority, holds, complaint handoff, and cancellation. |
| `docs/product/04-ui-ux-spec.md` v0.2 | Screen boundary | Admin financial operation screens must show eligibility, holds, approvals, re-authentication, result, and recovery without exposing raw sensitive data. |
| `docs/product/05-qa-scenarios.md` v0.2 | Verification contract | QA covers payout eligibility, refund routes, split ordering, retries, UNKNOWN reconciliation, authorization, masking, and SLA. |
| `src/server/db/schema.ts` | Existing persistence | `financial_operations`, frozen destinations, holds, idempotency, audit, transaction state/version, and approved financial enums already exist. |
| `src/server/confirmation/service.ts` | BAYAR-007 integration | Buyer OTP and the approved overdue exception transition to `READY_FOR_PAYOUT`; no money movement is called. |

## Current Behavior

- `READY_FOR_PAYOUT`, `PAYOUT_ON_HOLD`, `PAYOUT_PROCESSING`, `PAID_OUT`, `REFUND_READY`, `REFUND_PROCESSING`, `REFUNDED`, `SPLIT_PROCESSING`, and `SPLIT_SETTLED` already exist in the transaction state enum. The financial result enum is limited to `PROCESSING`, `SUCCESS`, `FAILED`, and `UNKNOWN`.
- `seller_payout_destinations` and `buyer_refund_destinations` store participant-owned bank data with masked projections and `locked_at`. BAYAR-004 locks these destinations when legacy payment instructions are issued; the Midtrans migration means BAYAR-008 must treat the existing lock as a prerequisite and must not add destination replacement.
- `financial_operations` persists operation type (`PAYOUT`, `REFUND`, `SPLIT_BUYER`, `SPLIT_SELLER`), amount, destination snapshot, result, attempt, starter, and bank reference. A partial unique index allows one `PROCESSING` or `UNKNOWN` operation per transaction/type.
- `financial_operations_success_immutable` prevents update/delete of a successful operation. This is a useful baseline, but the current row does not provide a dedicated immutable financial evidence record or provider/manual route metadata.
- `payment_provider_events`, `payment_reconciliations`, and Midtrans webhook/Get Status services already establish payment authority. They stop at `PAYMENT_CONFIRMED`; there is no payout or refund call from settlement.
- `src/server/confirmation/service.ts` records valid Buyer confirmation and the approved overdue exception as `READY_FOR_PAYOUT`. It does not start a financial operation.
- `requireAdminAccount()` authenticates the session and checks `accounts.is_admin`. There is no operation-specific re-authentication helper, two-Admin approval persistence/service, approval conflict guard, or threshold authorization service.
- Existing Admin pages/routes cover payment review, WhatsApp, and confirmation recovery. No payout, refund, split, financial-operation detail, approval, or re-authentication route/page was found.
- Midtrans adapters exist for payment-link creation, webhook validation, and status lookup. No Midtrans Refund API adapter or provider-neutral refund interface exists.
- Complaint and risk hold tables exist, and BAYAR-009/BAYAR-011 are intended to own creation/review and handoff. BAYAR-008 must consume their hold/outcome boundaries, not adjudicate either case.

## Code Map

| Responsibility | Existing file/module | Symbol/route | Notes |
| --- | --- | --- | --- |
| Transaction states/results | `src/server/db/schema.ts`, `src/server/domain/transaction/state.ts` | `transactionState`, `operationResult`, `operationType` | Approved states/results already declared; no new enum is needed. |
| Financial persistence | `src/server/db/schema.ts` | `financialOperations` | Existing operation row and active-operation partial unique index; insufficient for approvals/evidence/provider route by itself. |
| Seller payout destination | `src/server/db/schema.ts`, `src/server/transaction/service.ts` | `sellerPayoutDestinations` | Participant-owned destination, masked/raw projection, locked by payment boundary. |
| Buyer refund destination | `src/server/db/schema.ts`, `src/server/transaction/service.ts` | `buyerRefundDestinations` | Participant-owned destination, masked/raw projection, locked by payment boundary. |
| Payment authority | `src/server/payment/provider-webhook.ts` | Midtrans webhook handler | Validates provider event and can transition only to `PAYMENT_CONFIRMED`; no financial execution. |
| Provider reconciliation | `src/server/payment/reconciliation.ts` | `reconcileMidtransStatus()` | Idempotent Admin reconciliation with state-version and audit behavior. |
| Midtrans status adapter | `src/server/providers/midtrans/status.ts` | `MidtransPaymentStatusAdapter` | Provider status/Get Status boundary; no refund operation. |
| Midtrans invoice adapter | `src/server/providers/midtrans/invoice.ts` | `MidtransPaymentInvoiceAdapter` | Payment-link creation only; not payout/refund. |
| Admin authorization | `src/server/auth/authorization.ts` | `requireAdminAccount()` | Checks authenticated session and `accounts.isAdmin`; no re-auth or approval chain. |
| Idempotency | `src/server/transaction/mutation.ts`, `src/server/domain/idempotency/index.ts` | `findIdempotentResult`, `saveIdempotentResult`, actor scopes | Reusable account/system scope and request-hash pattern. |
| Audit | `src/server/transaction/audit.ts`, `src/server/audit/index.ts` | `recordTransactionEvent`, auth audit | Append-only audit boundary exists; financial approval/re-auth event vocabulary is not yet implemented. |
| Holds | `src/server/db/schema.ts`, BAYAR-009/BAYAR-011 planned surfaces | `complaintHolds`, `riskHolds` | Persistence exists; operation-specific hold eligibility must be read server-side. |
| Existing Admin UI/API | `src/app/admin/payment-review`, `src/app/admin/confirmation`, related `/api/admin/...` routes | Payment and confirmation operations | No BAYAR-008 financial operation UI/API exists. |

## Existing Patterns To Reuse

- **Validation:** Zod contracts in `src/server/*/contracts.ts`, with route parsing and sanitized error responses.
- **Data access:** Drizzle transactions, conditional updates using transaction ID/state/state version, and row locks where an existing service uses them.
- **Authorization:** `requireAdminAccount()` for Admin access, plus explicit transaction/assignment checks. Product roles remain Buyer, Seller, and Admin; internal task labels must not become authorization roles.
- **Idempotency:** `Idempotency-Key`, request hash, `actorScope`, and stored result via the existing idempotency table. Financial commands need operation-specific command names and conflict handling.
- **Audit:** `recordTransactionEvent()` inside the successful business transaction; rejected actions use sanitized authorization/audit behavior already used by auth services.
- **Sensitive data:** Read masked destination projections for participants; keep raw destination/credential values server-side and out of generic DTOs/logs/audit payloads.
- **Tests:** PostgreSQL integration tests in `tests/integration`, unit contracts in `tests/unit`, and local database scripts using the OrbStack PostgreSQL container.
- **UI state:** Existing mobile-width shell and Admin screens provide the loading/error/unauthorized/recovery conventions; no wide desktop dashboard should be introduced.

## Change Surface

| Area | Likely change? | Reason/risk |
| --- | --- | --- |
| UI | Yes | Add Admin financial operation/approval/re-auth/status surfaces for UI-SCR-015, 016, 018, 019, 020; participant screens must remain summary-only. |
| API | Yes | Add Admin-owned payout, refund, split, approval, re-authentication, and reconciliation-safe retry boundaries. |
| State | Yes, using existing states only | Move eligible operations through existing payout/refund/split states; no enum additions. |
| Database | Yes, additive likely | Add concrete approval, re-authentication, route/result/evidence, split-leg, and immutable-reference persistence only after planning. Existing financial rows need stronger evidence/authorization linkage. |
| Auth | Yes | Add operation-specific Admin re-authentication and distinct two-Admin approval checks without adding product roles. |
| Jobs/integrations | Yes, boundary only | Add provider-neutral refund adapter and manual fallback contract; do not execute real money movement during research. SLA/escalation integration must remain compatible with BAYAR-012. |
| Tests/docs | Yes | Extend integration tests for authorization, ordering, result recovery, evidence immutability, masking, concurrency, and SLA. |

## Gap Analysis

| Ticket requirement | Current evidence | Gap / implication |
| --- | --- | --- |
| Seller payout after confirmation/approved exception | BAYAR-007 ends at `READY_FOR_PAYOUT`; `financial_operations` table exists | No payout service, route, destination eligibility check, or re-authentication. |
| One active operation per transaction/type | Partial unique index for `PROCESSING`/`UNKNOWN` | Reuse it, but define retry closure and idempotent command result semantics. Verify all split legs and concurrent inserts. |
| Midtrans Refund API/manual fallback | Midtrans invoice/status adapters only | Provider-neutral refund contract, fake adapter, route selection, manual evidence/reference, and raw credential boundary are missing. |
| Cause-based, late-fund, cancellation, complaint, risk refunds | Hold/cancellation/payment reconciliation persistence exists | BAYAR-008 must consume authoritative handoff/hold records from BAYAR-009/BAYAR-011 and avoid adjudication or inventing outcomes. |
| Split buyer leg before seller leg | Operation types exist, no split service | Need explicit persisted leg order/dependency and prevention of Seller leg on Buyer `FAILED`/`UNKNOWN`. |
| Two-Admin approval | BAYAR-007 has a narrow two-Admin confirmation exception implementation | No reusable financial approval model, distinct-admin enforcement, rejection/expiry handling, or scope for controlled actions. |
| Ordinary payout re-authentication | Session JWT/cookie and Admin check exist | No step-up/re-auth challenge, expiry, replay protection, or audit event for financial execution. |
| Immutable financial evidence/reference | Successful-operation trigger protects existing row | `bank_reference` is insufficient as a complete immutable evidence contract; provider/manual route, evidence hash/reference, and success-only terminal guard need explicit design. |
| FAILED retry / UNKNOWN reconciliation | Financial result enum exists | No operation service distinguishes safe retry from mandatory reconciliation or prevents retry of UNKNOWN. |
| Holds disable financial actions | `complaint_holds` and `risk_holds` exist | No BAYAR-008 eligibility query aggregates complaint, risk, cancellation, overdue, approval, re-auth, destination, and settlement gates. |
| Admin UI/API | Existing Admin payment/confirmation screens only | All BAYAR-008 financial screens/routes are missing. |
| SLA and operating-hours behavior | Product/TRD defines WIB targets; no finance service/job found | Need explicit deadlines, visible status, and handoff to notification/escalation ownership without implementing unrelated BAYAR-012 behavior. |

## Migration / Schema Impact

Likely additive migration areas for the implementation plan:

- Extend or complement `financial_operations` with immutable success evidence/reference, operation route (`MIDTRANS_REFUND`, `MANUAL_REFUND`, payout route, or split leg route), authorization state, and correlation/idempotency linkage. Do not overload `result` with a transaction state.
- Add a reusable financial approval record with operation ID, distinct Admin account IDs, approval/rejection timestamps, decision, expected state version, and append-only audit linkage. The schema must enforce that an Admin cannot provide both approvals.
- Add a payout re-authentication record/challenge or server-side operation token with expiry, single use, operation binding, and audit reference. Raw secrets must not be stored.
- Add explicit split-leg dependency/order fields or a dedicated split operation relation so `SPLIT_SELLER` cannot execute until the Buyer leg has `SUCCESS`.
- Add immutable evidence/reference enforcement for successful operations, including update/delete rejection tests. Existing successful-operation protection should be preserved and strengthened rather than bypassed.
- Add indexes/constraints for active operation uniqueness, approval lookup, operation idempotency, and split dependency. Preflight existing rows before constraints are added.
- Preserve existing destination tables and `locked_at`; no Admin replacement path. Use masked DTOs for participants and raw data only in a server-side authorized operation boundary.
- No production migration is performed during research, and no actual Midtrans refund or bank transfer is called.

## Authorization / Financial Boundaries

| Action | Required boundary | Current support |
| --- | --- | --- |
| Read participant summary | Buyer/Seller ownership; masked data only | Existing transaction/read projection pattern. |
| Ordinary Seller payout | Assigned Admin, eligible state/no holds, frozen Seller destination, Admin re-auth | Missing re-auth and payout service. |
| Refund | Assigned Admin, approved cause/hold handoff, frozen Buyer destination, two distinct Admins where required | Missing financial approval/refund service. |
| Split | Assigned Admin, amount validation, two Admins, Buyer leg before Seller leg | Missing split service and leg dependency. |
| Risk/controlled exception outcome | Admin task assignment plus two Admin approvals; no new product role | Risk hold persistence exists; financial handoff is BAYAR-008 boundary. |
| Raw account/provider evidence | Authorized Admin operation only | Existing masking pattern; no financial operation read boundary yet. |
| Retry | `FAILED` may retry with new attempt; `UNKNOWN` must reconcile first | Result enum exists; policy enforcement missing. |

`accounts.isAdmin` is the product authorization source. `admin_task_assignment`
may narrow an Admin's assigned work, but `Ops`, `Finance`, `Supervisor`, and
`Reviewer` must remain internal assignment labels, not new roles.

## Failure, Timeout, Recovery, and Concurrency Findings

- **Provider refund:** adapter timeout/outage must produce `UNKNOWN`, not success. `FAILED` may retry after operation closure; `UNKNOWN` requires Get Status/provider reconciliation before retry.
- **Manual refund/payout:** external reference must be recorded only after an Admin has an allowed execution result. A missing or ambiguous reference cannot produce a terminal state.
- **Split:** Buyer leg is the prerequisite. Seller leg must remain blocked for Buyer `FAILED`/`UNKNOWN`, and concurrent requests must resolve through the active-operation/idempotency constraints.
- **Authorization:** missing second approval, wrong Admin, expired re-authentication, stale state version, hold, unlocked/invalid destination, and non-eligible transaction must leave the action disabled/rejected and audited.
- **Concurrency:** operation creation, approval, re-auth consumption, state transition, and success evidence write need one atomic boundary with conditional state-version checks. Duplicate request with the same request hash returns the original result; a different hash conflicts.
- **Terminal safety:** only `SUCCESS` with immutable evidence/reference may transition to `PAID_OUT`, `REFUNDED`, or `SPLIT_SETTLED`. Settlement from Midtrans never calls payout automatically.
- **SLA:** deadlines are absolute and shown in WIB. Timeout creates reminder/manual review; it cannot synthesize a financial result. Escalation/reminder scheduling must remain compatible with BAYAR-012.

## Test Surface

Existing relevant tests:

- `tests/integration/foundation.test.ts` covers financial-operation success immutability, schema constraints, idempotency, and audit boundaries.
- `tests/integration/confirmation.test.ts` covers Buyer confirmation and the narrow two-Admin overdue exception handoff to `READY_FOR_PAYOUT`.
- Payment integration tests cover Midtrans webhook/status authority and should remain unchanged except for handoff assertions.

Tests required for BAYAR-008 planning:

- Payout eligibility after Buyer OTP and after approved exception; settlement alone must not qualify.
- Frozen/missing/invalid destination and all complaint, risk, cancellation, overdue, approval, and re-auth holds.
- Ordinary payout re-auth success, expiry, replay, wrong operation, wrong Admin, and audit.
- Two distinct Admin approvals, duplicate approval, self-approval, rejection, stale state, missing approval, and concurrent approval.
- Midtrans Refund API supported/unsupported route, manual fallback, raw credential masking, cause/late-fund/complaint/risk/cancellation outcomes.
- Split amount/total validation, Buyer leg ordering, Seller-leg blocking on `FAILED`/`UNKNOWN`, and leg concurrency.
- `PROCESSING`, `SUCCESS`, `FAILED`, `UNKNOWN` recovery; only successful immutable evidence creates terminal financial state.
- Duplicate/idempotency request, request-hash conflict, state-version race, active-operation uniqueness, and append-only audit/evidence enforcement.
- Admin/participant authorization and sensitive DTO masking.
- SLA/operating-hours deadline rendering and timeout-to-manual-review behavior. Real provider calls and real-money transfers remain excluded; use fake adapters and isolated OrbStack PostgreSQL.

## Dependencies and Scope Boundaries

- **BAYAR-007:** supplies `READY_FOR_PAYOUT` after Buyer OTP or approved overdue exception. BAYAR-008 owns the financial operation after this handoff.
- **BAYAR-009:** owns complaint intake, external agreement recording, and `PAYOUT_ON_HOLD`; BAYAR-008 consumes an approved handoff and does not adjudicate complaints.
- **BAYAR-011:** owns risk hold/review and outcome-neutral decisioning; BAYAR-008 consumes an authorized financial outcome and does not perform risk decisioning.
- **BAYAR-012:** owns background jobs, notifications, reminders, and audit/operational scheduling; BAYAR-008 exposes operation deadlines/results for that boundary and must not duplicate the job system.
- **Out of scope:** payment-link creation/webhook authority, WhatsApp checkpoints or OTP, complaint adjudication, risk decisioning, destination replacement, production Midtrans credentials, real bank transfers, and provider integration outside the refund adapter.

## Unknowns And Assumptions

| Item | Can be inferred safely? | Evidence or decision needed |
| --- | --- | --- |
| Exact payout rail and manual payout evidence format | No | TRD/PRD define the boundary but not the production transfer provider or evidence schema. Plan must choose a provider-neutral contract and fake/manual adapter. |
| Midtrans payment-method refund capability response and API contract | No | Provider integration decision and sandbox contract; fallback is approved but route-selection details are not in code. |
| Financial approval persistence shape | No | Must be finalized in Implementation Plan; cannot reuse confirmation-exception rows as a generic financial approval model without explicit scope. |
| Re-authentication mechanism | No | Must be operation-bound, expiring, single-use, and audited; current JWT session is not sufficient step-up proof. |
| Split amount allocation and threshold value | No | Product/TRD require validation and threshold authorization, but exact allocation/threshold source is not present in the examined code. |
| BAYAR-009/BAYAR-011 handoff DTO/status contract | Partly | Ticket ownership is clear; exact stable handoff fields and approval outcome need coordination before implementation. |
| SLA scheduler ownership | Partly | PRD assigns operating targets; BAYAR-012 owns jobs/notifications, so BAYAR-008 should persist deadlines and status only. |

## Research Conclusion

```text
Recommended implementation boundary:
Add an Admin-only financial operation service and UI/API for payout, refund,
and split. Reuse the existing operation result enum, idempotency, state-version,
destination locks, Midtrans status boundaries, and audit patterns. Add explicit
approval, re-authentication, provider-refund, split-leg, and immutable-evidence
contracts through a reviewed additive migration.

Main risks:
Financial authorization is not yet implemented; a generic Admin check would be
insufficient. Existing financial_operations lacks complete approval, route,
split dependency, and immutable evidence semantics. Provider refund capability,
manual transfer evidence, and split allocation remain unresolved. Scope can leak
into BAYAR-009/BAYAR-011 hold decisioning or BAYAR-012 scheduling if ownership is
not kept explicit.

Files likely affected:
src/server/db/schema.ts; a new additive Drizzle migration; a new finance domain
module and contracts; Admin financial operation routes/pages/components; tests;
and related audit/authorization adapters. Exact file list belongs to the
Implementation Plan.

Ready to plan: Yes, with the unknowns above recorded as plan decisions/blockers.
Research status: Draft.
```
