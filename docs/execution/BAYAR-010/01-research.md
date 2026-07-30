# Codebase Research: BAYAR-010

## Research Metadata

```text
Version: 0.1
Status: Draft
Researched on: 2026-07-30
Ticket: BAYAR-010 - Cancellation Lifecycle and Midtrans Reconciliation Handoff
Research boundary: Cancellation request, provider reconciliation, funded review,
  complaint/risk handoff, and cancellation/late-fund refund handoff only
```

## Task

```text
Ticket ID/title:
BAYAR-010 - Cancellation Lifecycle and Midtrans Reconciliation Handoff

Requested outcome:
Allow an eligible Buyer or Seller to request cancellation; resolve direct,
provider-reconciled, funded, late-fund, complaint, and risk branches without
reviving a closed transaction or executing money movement.

Source requirements:
UR-CANCEL-001..025, UR-CAN-OD-001..008,
UR-BR-032, UR-BR-035, UR-BR-047..050

Source UX Flow/UI/QA IDs:
UX-FLOW-043..048, UX-FLOW-061..067
UI-SCR-018, UI-SCR-020..023
QA-CANCEL-001..014, QA-SEC-003
```

## Relevant Context Read

| File/doc | Why it is relevant | Key constraint found |
| --- | --- | --- |
| `docs/engineering/tickets/BAYAR-010-cancellation-lifecycle.md` | Bounded engineering scope | BAYAR-010 owns cancellation decisions and handoffs but never executes a refund, payout, risk outcome, or complaint adjudication. |
| `PRD.md` v0.2 Approved | Product and operational boundary | Midtrans is payment authority; Admin operates 09:00-21:00 WIB; timeout never implies financial success. |
| `TRD.md` v1.2 Approved | State, data, security, and provider boundary | Late success after expiry/cancellation is refund-only and must never revive payment, fulfillment, or payout. |
| `docs/product/03-user-requirements.md` v0.4 Approved | Exact actor, reason, deadline, evidence, and recovery rules | Cause is immutable; reconciliation is two operating hours; funded response is 24 elapsed hours after a successful WA request checkpoint. |
| `docs/product/02-ux-flow.md` v0.3 Approved | Channel and state handoffs | Cancellation uses BayarAman, Midtrans reconciliation, manual WhatsApp evidence, complaint/risk review, then a financial handoff. |
| `docs/product/04-ui-ux-spec.md` v0.2 Approved | Required screens and states | UI-SCR-021 is participant cancellation entry, UI-SCR-022 is Admin reconciliation, and UI-SCR-023 is funded review. |
| `docs/product/05-qa-scenarios.md` v0.2 Approved | Executable acceptance behavior | Covers direct cancellation, provider outcomes, funded evidence, timeout, cutoff, withdrawal, late funds, and concurrency. |
| `docs/execution/BAYAR-005/04-validation.md` | Implemented Midtrans boundary | Webhook/Get Status validation, provider evidence, authority pointer, reconciliation, and Admin review already pass. |
| `docs/execution/BAYAR-009/04-validation.md` | Implemented complaint boundary | Complaint intake and immutable financial handoff exist; adjudication remains external. |
| `docs/execution/BAYAR-011/04-validation.md` | Implemented risk boundary | Risk record-only ownership can reference an active cancellation request; risk decisions remain owned by BAYAR-011. |

## Current Behavior

### Cancellation persistence

- `cancellation_requests` and `cancellation_reconciliations` exist from the
  foundation schema, but no cancellation domain service, API route, job, UI, or
  focused tests use them.
- `cancellation_requests` currently stores only requester, cause, note, status,
  local state version, and creation time. It enforces one row with
  `status = ACTIVE` per transaction.
- The cause column has no full taxonomy check. Only
  `OTHER_MANUAL_REVIEW -> note required` is database-enforced.
- `cancellation_reconciliations.bank_result` is legacy manual-bank terminology.
  It has no Midtrans invoice/provider-event relation, authority classification,
  source-state snapshot, operating deadline metadata, or immutable event log.
- Both cancellation tables currently cascade on parent deletion. That is weaker
  than the restrictive/immutable authority patterns introduced by BAYAR-009 and
  BAYAR-011.

### Midtrans payment and reconciliation

- `payment_invoices` is the canonical invoice boundary. It contains provider
  order identity, amount/currency, absolute deadline, active/retired fields, and
  the immutable authoritative provider-event pointer.
- `payment_provider_events` is append-only and records sanitized provider
  identity, amount, currency, status, fraud status, and validation outcome.
- `payment_reconciliations` supports `PROVIDER_STATUS_REVIEW`,
  `LATE_FUND_HANDOFF`, and `CONTROLLED_EXCEPTION_HANDOFF`, with one active
  reconciliation per transaction.
- Webhook and Get Status paths correctly refuse to establish normal payment
  authority after the invoice is inactive, expired, or the transaction is no
  longer `WAITING_BUYER_PAYMENT`.
- Late or ambiguous events currently open or reuse a reconciliation and append
  reconciliation evidence. They do not yet create an immutable, single-use
  late-fund refund handoff for BAYAR-008.
- Existing `ensureReconciliation()` returns any active reconciliation for the
  invoice. BAYAR-010 must deliberately attach a cancellation to an existing
  payment review or create the cancellation reconciliation without opening a
  competing authority path.

### Transaction state and cutoff evidence

- All required transaction states already exist. BAYAR-010 does not need a new
  product state or financial result.
- `invitations.revokedAt` and `payment_invoices.isActive/retiredAt` provide the
  direct database fields needed to close invitation and hosted-payment entry
  points.
- BAYAR-006 supplies immutable WhatsApp group/checkpoint history for normal
  fulfillment. Its checkpoint vocabulary is deliberately limited to
  `PAYMENT_ANNOUNCED`, `SELLER_SHIPMENT`, `SELLER_COMPLETION`, and
  `BUYER_COMPLETION`.
- A funded-cancellation response request, seller shipped/not-shipped statement,
  and participant responses do not fit the BAYAR-006 checkpoint vocabulary.
  They need cancellation-owned evidence records rather than silently extending
  normal fulfillment checkpoints.
- Shipment cutoff can use the canonical `SELLER_SHIPMENT` checkpoint head. A
  cancellation-specific seller statement remains separate evidence and cannot
  overwrite that fulfillment event.

### Complaint and risk handoff

- BAYAR-009 exposes complaint intake, append-only evidence, two-Admin agreement,
  and a single-consumption financial handoff. Its current intake service does
  not accept `FUNDED_CANCELLATION_REVIEW` directly.
- BAYAR-010 therefore needs a concrete service integration that atomically
  creates the complaint case while transitioning the transaction to
  `PAYOUT_ON_HOLD`, or a narrowly scoped BAYAR-009 compatibility extension.
  It must not duplicate complaint adjudication.
- BAYAR-011 already recognizes active cancellation states and uses the current
  active `cancellation_requests` row as its record-only source owner.
- Prohibited/policy/fraud causes can therefore hand off to the existing risk
  service after BAYAR-010 publishes a durable active cancellation case. Risk
  review and risk refund authority remain BAYAR-011 responsibilities.

### Authorization, idempotency, and audit

- Product authorization uses authenticated accounts, transaction participant
  association, `accounts.isAdmin`, and active `admin_task_assignments`.
- Existing Admin assignment scopes cover complaint and risk only. There is no
  cancellation intake/reconciliation/evidence assignment scope yet.
- Existing mutation services use:
  - `Idempotency-Key` plus request hash;
  - transaction row `FOR UPDATE`;
  - `expectedStateVersion`;
  - conditional state update;
  - business mutation and audit in one transaction;
  - sanitized rejection audit after rollback.
- `audit_events` is append-only. Complaint and risk additionally use
  domain-specific immutable event tables and current pointers. Cancellation
  should reuse that event/projection pattern.

### Jobs and deadlines

- Deterministic job boundaries exist for payment expiry and Buyer-confirmation
  recovery.
- There is no shared operating-hours helper for the 09:00-21:00 WIB,
  two-operating-hour cancellation reconciliation deadline.
- There is no cancellation reconciliation sweep or funded-response timeout
  sweep.
- BAYAR-010 should implement deterministic sweep services and fixed-clock tests.
  Production scheduling, retries, and escalation orchestration remain
  BAYAR-012.

### UI and routes

- No participant or Admin cancellation route exists.
- The existing transaction status component has no cancellation action or
  cancellation-safe participant projection.
- The Admin payment-reconciliation page can be reused as a visual and request
  pattern but does not expose cancellation case ownership, two-hour deadline,
  provider decision application, or funded-review evidence.
- Existing Admin complaint/risk pages demonstrate the constrained mobile-width
  shell, assignment-gated mutations, labelled forms, and loading/error/recovery
  states required by UI-SCR-022 and UI-SCR-023.

## Code Map

| Responsibility | Existing file/module | Symbol/route | Notes |
| --- | --- | --- | --- |
| Transaction states | `src/server/domain/transaction/state.ts` | `TRANSACTION_STATES` | Required cancellation states already exist. |
| Legacy cancellation schema | `src/server/db/schema.ts` | `cancellationRequests`, `cancellationReconciliations` | Requires additive redesign/backfill rather than parallel legacy behavior. |
| Invitation closure | `src/server/db/schema.ts` | `invitations.revokedAt` | Direct cancellation can revoke an unused invite atomically. |
| Invoice deactivation | `src/server/db/schema.ts` | `paymentInvoices.isActive`, `retiredAt` | Must happen atomically before pending reconciliation is exposed. |
| Provider evidence | `src/server/db/schema.ts` | `paymentProviderEvents`, `paymentReconciliationEvents` | Existing append-only Midtrans evidence must be referenced, not copied as raw payload. |
| Get Status reconciliation | `src/server/payment/reconciliation.ts` | `reconcileMidtransStatus()`, `ensureReconciliation()` | Needs cancellation-aware outcome application and no competing reconciliation. |
| Webhook late-event boundary | `src/server/payment/provider-webhook.ts` | provider event ingestion | Already prevents revival and opens `LATE_FUND_HANDOFF`; no consumable handoff yet. |
| Payment expiry | `src/server/jobs/payment-expiry.ts` | `expirePaymentInvoices()` | Pattern for fixed-clock, conditional, idempotent state sweep. |
| WhatsApp group/checkpoints | `src/server/operations/whatsapp.ts` | group and checkpoint services | Canonical group/snapshot source; normal checkpoint vocabulary must remain unchanged. |
| Complaint integration | `src/server/complaint/service.ts` | `recordComplaint()` | Requires a cancellation-safe service entry/compatibility path, not duplicated adjudication. |
| Complaint financial handoff | `src/server/complaint/handoff.ts` | `readComplaintHandoffForUpdate()`, `claimComplaintHandoff()` | Pattern for immutable source snapshot and atomic downstream claim. |
| Risk integration | `src/server/risk/service.ts` | `recordRisk()`, cancellation source owner | Already understands cancellation ownership once a valid active request exists. |
| Risk financial handoff | `src/server/risk/handoff.ts` | `readRiskRefundHandoffForUpdate()`, `claimRiskRefundHandoff()` | Pattern for the cancellation/late-fund handoff expected by BAYAR-008. |
| Idempotency | `src/server/transaction/mutation.ts` | `findIdempotentResult()`, `saveIdempotentResult()` | Reuse actor-scoped command/key/request-hash semantics. |
| Audit | `src/server/transaction/audit.ts` | `recordTransactionEvent()`, `recordRejectedMutationEvent()` | Reuse atomic success and sanitized rejection paths. |
| Admin reconciliation API | `src/app/api/admin/transactions/[id]/payment-reconciliation/route.ts` | GET/POST | Existing Admin/session/idempotency parsing pattern. |
| Participant transaction UI | `src/components/transactions/status.tsx` | transaction status surface | Likely entry for cancellation summary/action. |
| Admin reconciliation UI | `src/components/admin/payment-reconciliation.tsx` | payment review surface | Reusable UI interaction pattern, not cancellation authority. |
| PostgreSQL migration sequence | `drizzle/meta/_journal.json` | latest migration `0011` | BAYAR-010's next additive migration should be `0012`. |

## Existing Patterns To Reuse

- **Validation:** Zod request contracts with bounded strings, UUIDs, SHA-256
  evidence hashes, enums, and non-negative expected state version.
- **Data access:** caller-owned PostgreSQL transactions, row locks, conditional
  updates, restrictive FKs, partial unique indexes, named checks, and immutable
  triggers.
- **Authorization:** participant membership for Buyer/Seller actions;
  `requireAdminAccount()` plus active task assignment for Admin-only evidence
  and reconciliation actions.
- **Idempotency:** actor-scoped command plus key plus request hash; duplicates
  return the original result and conflicting hashes are rejected.
- **Audit:** domain event append and transaction audit commit with the business
  mutation; rejected mutations use one sanitized event after rollback.
- **Evidence correction:** immutable event rows with a current pointer, as used
  by complaint, risk, and WhatsApp checkpoint heads.
- **Financial handoff:** immutable approved snapshot with
  `consumedByOperationId/consumedAt`, `readForUpdate()`, and `claim()` inside the
  consumer's database transaction.
- **Provider authority:** use the immutable authoritative provider-event pointer
  or validated reconciliation event. Never infer payment from UI input,
  webhook absence, or a manual bank check.
- **UI:** constrained mobile-width web shell, labelled fields, disabled invalid
  actions, `role=status` feedback, masked participant projection, and explicit
  loading/error/timeout/manual-review recovery.
- **Tests:** PostgreSQL integration tests with isolated fixtures, fake Midtrans
  status adapters, fixed clocks, direct constraint tests, concurrency races,
  route authorization, privacy projections, build/typecheck/lint, and clean
  migration/rerun checks.

## Change Surface

| Area | Likely change? | Reason/risk |
| --- | --- | --- |
| UI | Yes | Add participant cancellation entry/status and Admin reconciliation/funded-review surfaces without money controls. |
| API | Yes | Participant request/withdraw plus assigned-Admin reconciliation, evidence, decision, and read routes are absent. |
| State | Yes | Implement approved transitions and cutoff matrix using existing states only. |
| Database | Yes | Existing cancellation tables cannot support immutable evidence, provider references, deadlines, decisions, or consumable handoffs. |
| Auth | Yes | Add internal Admin assignment scopes; product roles remain Buyer, Seller, and Admin. |
| Jobs/integrations | Yes | Add deterministic two-operating-hour and 24-hour sweep boundaries; reuse Midtrans status adapter and canonical WA group. |
| Tests/docs | Yes | Add cancellation unit/integration/route/UI tests and validation evidence; no upstream product-doc change is required. |

## Required Data And Contract Gaps

### Cancellation case/event model

The current two-table model is insufficient. The Implementation Plan should
define an additive migration that:

- upgrades `cancellation_requests` into a durable case/request authority with
  source state/version, prior state, initiator role, lifecycle, current event,
  current reconciliation, deadlines, and final decision references;
- enforces the full confirmed reason taxonomy;
- adds append-only `cancellation_events` for requests, corrections, withdrawal,
  rejection, WA request/response, shipment statement, provider result, timeout,
  complaint/risk handoff, refund readiness, and handoff claim;
- stores current pointers separately from immutable history;
- changes authority references from cascade to restrictive deletion where
  needed;
- preserves one active cancellation case per transaction.

### Midtrans reconciliation classification

The existing validation outcome vocabulary does not itself distinguish all
business branches. The plan must define one server-side classifier:

- authoritative: `settlement + fraud_status=accept` with matching canonical
  invoice/order/amount/currency;
- definitive non-paid: approved Midtrans terminal non-paid statuses;
- waiting/non-authoritative: pending/capture and other non-terminal outcomes;
- unknown/mismatch: remains reconciliation/manual review.

The classifier must consume canonical provider data and never accept a
client-supplied result.

### Cancellation and late-fund handoff

BAYAR-008 requires a source-owned, single-use handoff. BAYAR-010 therefore
needs a concrete `cancellation_financial_handoffs` contract for:

- approved funded-cancellation Buyer refund;
- matching late-fund Buyer refund after a closed/expired transaction.

The snapshot needs transaction/case/reconciliation IDs, source type, amount,
currency, frozen Buyer destination binding, calculation hash, evidence
reference/hash, source state/version, approval time, and consumption fields.
It should publish `read...ForUpdate()` and `claim...()` following the complaint
and risk patterns. BAYAR-010 creates no `financial_operations` row.

### Complaint and risk delegation

- Shipment/conflicting evidence must call a complaint-owned service boundary
  while the same database mutation places the transaction in
  `PAYOUT_ON_HOLD`.
- Prohibited/policy/fraud input must call the existing risk intake boundary or
  publish the exact active cancellation owner required by BAYAR-011.
- BAYAR-010 may create linkage records, but it must not reproduce complaint
  agreements, risk reviews, or their financial handoffs.

### Deadline calculation

The plan must provide deterministic helpers for:

- two operating hours counted only during 09:00-21:00 Asia/Jakarta;
- 24 elapsed hours from the successful cancellation WA-request checkpoint;
- immutable absolute timestamps rendered in WIB;
- timeout sweeps that move only matching state/version rows;
- no automatic refund, payout, or provider result on timeout.

## Unknowns And Assumptions

| Item | Can be inferred safely? | Evidence or decision needed |
| --- | --- | --- |
| New migration number | Yes | Journal ends at `0011`; use `0012_bayar010_cancellation_lifecycle.sql`. |
| Product roles/states/results | Yes | Use only approved Buyer/Seller/Admin, existing transaction states, and existing financial results. |
| Cancellation reason taxonomy | Yes | Confirmed in `UR-CAN-OD-001`; no product decision remains. |
| Fee treatment | Yes | Seller inability/BayarAman error includes service fee; buyer change/mutual neutral retains it. |
| Admin task scopes | Yes, as implementation detail | Plan exact internal scopes such as cancellation reconciliation and cancellation evidence; they do not create product roles. |
| Funded-cancellation evidence persistence | Yes | Use cancellation-owned append-only events; do not extend normal fulfillment checkpoint vocabulary. |
| Midtrans authority source | Yes | Canonical invoice/provider event and existing Get Status adapter are authoritative. |
| Definitive non-paid status mapping | Partially | Plan must enumerate exact Midtrans terminal mappings from the approved provider vocabulary and preserve UNKNOWN for anything unrecognized. |
| Existing active payment review | Yes | Attach request to the canonical active reconciliation; do not open competing reviews or change `PAYMENT_UNDER_REVIEW` until that review resolves. |
| Complaint integration shape | Partially | Plan must choose a caller-owned transaction service boundary or a narrow compatibility extension in the complaint module. It cannot duplicate adjudication. |
| Risk integration shape | Yes | Existing risk service supports cancellation source ownership; use it without implementing a risk decision. |
| Financial execution | Yes | Entirely deferred to BAYAR-008. BAYAR-010 publishes handoff eligibility only. |
| Scheduler deployment | Yes | Sweep services/commands and tests belong here; production orchestration and escalation belong to BAYAR-012. |
| Real WhatsApp API | Yes | Out of scope. Admin records external group/message/evidence references manually. |

## Risks And Safeguards For Planning

| Risk | Required safeguard |
| --- | --- |
| Late settlement revives a cancelled transaction | Preserve closed state until an atomic transition to `REFUND_READY`; expose only the Buyer-refund handoff. |
| Cancellation bypasses payment review | Reuse/attach to the active provider reconciliation and apply only canonical provider outcomes. |
| Duplicate cancellation or concurrent fulfillment wins incorrectly | Lock transaction and active case, require expected state version, and use partial unique/idempotency constraints. |
| Hosted payment remains usable after cancellation request | Retire/deactivate invoice in the same transaction that enters pending reconciliation. |
| WhatsApp silence becomes implied consent | Start the 24-hour timer only after a successful Admin checkpoint; timeout goes to `MANUAL_REVIEW_REQUIRED`. |
| Cancellation evidence overwrites history | Append immutable events and move only a current pointer. |
| Shipment evidence is confused with normal shipment checkpoint | Read canonical fulfillment checkpoint as cutoff; store cancellation statements separately. |
| Complaint/risk logic is duplicated | Call source-owned service boundaries and store linkage only. |
| BAYAR-008 executes the same refund twice | Publish one immutable handoff with atomic single-consumption contract. |
| Legacy `bank_result` becomes payment authority | Replace it with provider classification/reference; manual bank data is never a payment-authority source. |
| Timer depends on server locale | Calculate with explicit Asia/Jakarta operating hours and persist UTC timestamps. |
| Scope leaks into scheduling or money movement | Implement deterministic job boundaries and handoffs only; BAYAR-012 schedules and BAYAR-008 moves money. |

## Likely File Surface

```text
src/server/db/schema.ts
drizzle/0012_bayar010_cancellation_lifecycle.sql
drizzle/meta/_journal.json

src/server/cancellation/contracts.ts
src/server/cancellation/service.ts
src/server/cancellation/reconciliation.ts
src/server/cancellation/evidence.ts
src/server/cancellation/handoff.ts
src/server/cancellation/projection.ts
src/server/cancellation/http.ts
src/server/domain/time/operating-hours.ts
src/server/jobs/cancellation-reconciliation.ts
src/server/jobs/cancellation-response-timeout.ts

src/server/payment/reconciliation.ts
src/server/payment/provider-webhook.ts
src/server/complaint/service.ts
src/server/risk/service.ts

src/app/api/transactions/[id]/cancellation/route.ts
src/app/api/transactions/[id]/cancellation/withdraw/route.ts
src/app/api/admin/transactions/[id]/cancellation/route.ts
src/app/api/admin/transactions/[id]/cancellation/reconcile/route.ts
src/app/api/admin/transactions/[id]/cancellation/evidence/route.ts
src/app/api/admin/transactions/[id]/cancellation/decision/route.ts

src/app/admin/cancellations/page.tsx
src/components/admin/cancellation-operations.tsx
src/components/transactions/status.tsx

tests/unit/cancellation.test.ts
tests/unit/operating-hours.test.ts
tests/integration/cancellation.test.ts
tests/integration/cancellation-handoff.test.ts
tests/integration/cancellation-authorization.test.ts
```

Exact route grouping and whether provider-webhook changes can remain behind an
existing reconciliation service should be finalized in the Implementation
Plan after checking import/cycle impact.

## Research Conclusion

```text
Recommended implementation boundary:
- Upgrade the legacy cancellation schema through additive migration 0012.
- Implement one cancellation case/event service with participant request,
  Admin reconciliation/evidence/decision, deterministic timeout services,
  complaint/risk delegation, and immutable cancellation/late-fund handoffs.
- Reuse Midtrans authority, idempotency, audit, assignment, and mobile-shell
  patterns already validated by BAYAR-005, BAYAR-009, and BAYAR-011.
- Publish handoffs for BAYAR-008; do not execute any financial operation.
- Leave production scheduling/escalation to BAYAR-012.

Main risks:
- Provider review and cancellation races.
- Late-fund revival.
- Missing atomic handoff consumption.
- Legacy cancellation schema and manual-bank terminology.
- Evidence overwrite or implied consent from WhatsApp silence.
- Scope leakage into complaint/risk adjudication, financial execution, or jobs.

Files likely affected:
- Database schema/migration and cancellation domain modules.
- Narrow payment reconciliation, complaint, and risk integration boundaries.
- Participant/Admin cancellation routes and mobile-width UI.
- Deterministic job services and focused PostgreSQL tests.

Ready to plan: Yes.

Plan decisions that must be made explicitly:
- Exact schema/event/handoff fields and migration preflight/backfill.
- Exact Midtrans definitive-non-paid classifier.
- Exact Admin assignment scopes.
- Exact complaint service integration transaction boundary.
- Exact route contracts, cutoff matrix, withdrawal/rejection restoration matrix,
  and deterministic deadline algorithms.
```
