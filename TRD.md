# BayarAman Technical Design Document

## 1. Document Control

```text
Feature/system: BayarAman MVP physical-goods trusted transaction
Version: TRD v1.2
Status: Approved
Author/reviewer: Engineering Team / Product Owner BayarAman
Approved by: Product Owner BayarAman
Approved on: 2026-07-26
Source PRD: PRD.md v0.2 (Approved)
Source Product Brief: docs/product/00-product-brief.md v0.10 (Approved)
Source Journey: docs/product/01-user-journey.md v0.6 (Approved)
Source UX Flow: docs/product/02-ux-flow.md v0.3 (Approved)
Source Requirements: docs/product/03-user-requirements.md v0.4 (Approved)
Source UI/UX: docs/product/04-ui-ux-spec.md v0.2 (Approved)
Source QA: docs/product/05-qa-scenarios.md v0.2 (Approved)
Last updated: 2026-07-26
```

This document defines implementation boundaries. It does not create product
policy, approve production money movement, or make legacy tickets
authoritative.

## 2. Technical Outcome

Build a typed Next.js web application for one Buyer and one Seller account per
transaction, with Admin-operated external handoffs. Midtrans is the primary
payment provider. BayarAman accepts payment as authoritative only after a
validated Midtrans `settlement` with `fraud_status=accept`. Seller payout is a
separate financial operation.

Product roles are only `BUYER`, `SELLER`, and `ADMIN`. Ops, Finance,
Supervisor, and Reviewer are internal Admin task assignments, never product
roles or participant permissions.

## 3. Architecture

| Boundary | Decision | Constraint |
| --- | --- | --- |
| Web runtime | Next.js App Router, TypeScript strict | Server authorization is mandatory |
| UI | Tailwind CSS, shared components, constrained mobile-width surface | Desktop does not become a wide dashboard |
| Persistence | PostgreSQL-compatible database | Transactions, unique constraints, immutable evidence |
| ORM | Drizzle ORM and migrations | Explicit SQL transaction boundaries |
| Validation | Zod at route/command boundaries | Invalid input rejected before domain mutation |
| Session | Signed JWT/JWS with `jose`, HS256, in HTTP-only `bayaraman_session` cookie | SameSite=Lax; Secure only in production; 7-day expiry; claims are accountId, sessionId, productRole, issuedAt, expiresAt |
| Jobs | Secured scheduler invocation of idempotent jobs | No assumption of a persistent worker |
| Provider | Server-side Midtrans adapter | Production credentials never reach client |
| Audit | Append-only audit writer | Financial evidence and corrections cannot be overwritten |

All state-changing commands flow through a domain service. Routes authenticate,
validate, authorize, and call the service. They do not mutate tables directly.

Authentication uses `AUTH_SESSION_SECRET` with at least 32 random bytes. The
application fails outside test when the secret is missing or too short. Passwords
use Argon2id and normalized lowercase email is the login identifier. Secret
rotation invalidates existing sessions. WhatsApp verification uses a six-digit,
five-minute, hashed, single-use OTP; maximum five attempts and a 60-second
request cooldown apply. Invalid or expired OTPs never set `whatsappVerifiedAt`.

## 4. Module And Repository Boundary

```text
src/app/                         Next.js routes and mobile-width pages
src/components/                  UI components mapped to UI-SCR IDs
src/server/auth/                 session and server authorization
src/server/domain/transaction/   aggregate and approved state guards
src/server/domain/invitation/    invitation and participant join
src/server/domain/payment/       Midtrans invoice/status/reconciliation
src/server/domain/operations/    WhatsApp, cancellation, complaint, risk
src/server/domain/finance/       refund, payout, split operations
src/server/providers/midtrans/   Invoice, webhook, status, refund adapter
src/server/jobs/                 expiry, reminder, SLA escalation
src/server/db/                   Drizzle schema and migrations
src/server/audit/                append-only audit writer
src/server/validation/           Zod command schemas
tests/                            unit, integration, route, and contract tests
```

## 5. State And Result Model

Transaction state and provider/financial result are separate. Use only
transaction states already approved by the product artifacts:

`WAITING_COUNTERPARTY`, `WAITING_COUNTERPARTY_DATA`,
`WAITING_BUYER_PAYMENT`, `PAYMENT_UNDER_REVIEW`, `PAYMENT_CONFIRMED`,
`PAYMENT_EXCEPTION_REVIEW`, `PAYMENT_EXPIRED`, `READY_FOR_FULFILLMENT`,
`WAITING_COMPLETION_REPORTS`, `WAITING_OTHER_COMPLETION_REPORT`,
`READY_FOR_BUYER_CONFIRMATION`, `WAITING_BUYER_CONFIRMATION`,
`BUYER_CONFIRMATION_OVERDUE`, `READY_FOR_PAYOUT`, `PAYOUT_ON_HOLD`,
`PAYOUT_PROCESSING`, `PAID_OUT`, `CANCELLATION_REQUESTED`,
`CANCELLATION_PENDING_RECONCILIATION`, `FUNDED_CANCELLATION_REVIEW`,
`REFUND_READY`, `REFUND_PROCESSING`, `REFUNDED`, `SPLIT_PROCESSING`,
`SPLIT_SETTLED`, `MANUAL_REVIEW_REQUIRED`, `RISK_HOLD`, and `CANCELLED`.

Financial operation result is only `PROCESSING`, `SUCCESS`, `FAILED`, or
`UNKNOWN`:

- `FAILED` may retry after the operation is safely closed.
- `UNKNOWN` must be reconciled before retry.
- Only `SUCCESS` with immutable provider/bank reference may produce `PAID_OUT`,
  `REFUNDED`, or `SPLIT_SETTLED`.
- Midtrans settlement never automatically produces `PAID_OUT`.

Midtrans provider statuses are data, not new BayarAman transaction states:

- `settlement` plus `fraud_status=accept`: authoritative payment.
- `capture`: provider success but not settlement for payout eligibility.
- `pending`, `deny`, `cancel`, `failure`, `expire`: non-paid outcomes.
- Unknown, invalid, or ambiguous events: reconciliation/manual-review path.

Every mutation checks `state_version`, expected state, actor permission, and
cutoff. A successful mutation increments `state_version` atomically.

## 6. Core State Transitions

| Current state | Trigger | Guard | Result |
| --- | --- | --- | --- |
| `WAITING_COUNTERPARTY` | Opposite participant joins | Valid invitation, distinct account, opposite role | `WAITING_COUNTERPARTY_DATA` |
| `WAITING_COUNTERPARTY_DATA` | Both role datasets complete | Terms validated and frozen | `WAITING_BUYER_PAYMENT` after invoice is available |
| `WAITING_BUYER_PAYMENT` | Midtrans invoice deadline passes | No authoritative settlement | `PAYMENT_EXPIRED` |
| `WAITING_BUYER_PAYMENT` | Valid Midtrans settlement event | Signature/order/amount/fraud valid; current state is not expired, cancelled, or financially terminal | `PAYMENT_CONFIRMED` |
| `WAITING_BUYER_PAYMENT` | Provider ambiguity or exception | No authority inferred | Remains waiting or `MANUAL_REVIEW_REQUIRED` |
| `PAYMENT_CONFIRMED` | Admin records payment announcement/group checkpoint | Correct participants and evidence | `READY_FOR_FULFILLMENT` |
| fulfillment states | Seller/Buyer completion checkpoints | Separate Admin-recorded checkpoints | `READY_FOR_BUYER_CONFIRMATION` |
| `WAITING_BUYER_CONFIRMATION` | Valid WhatsApp OTP | Frozen Buyer number, valid unexpired OTP | `READY_FOR_PAYOUT` |
| `READY_FOR_PAYOUT` | Complaint/risk evidence | No automatic adjudication | `PAYOUT_ON_HOLD` or `RISK_HOLD` |
| `READY_FOR_PAYOUT` | Start payout | Eligible, authorized, no hold | `PAYOUT_PROCESSING` |
| `PAYOUT_PROCESSING` | Financial `SUCCESS` | Immutable reference | `PAID_OUT` |
| eligible cancellation state | Cancellation request | State/cutoff/actor valid | Direct `CANCELLED`, or reconciliation state |
| `CANCELLATION_PENDING_RECONCILIATION` | Provider result | Midtrans status authoritative/definitive | `CANCELLED`, funded review, or manual review |
| `FUNDED_CANCELLATION_REVIEW` | Verified not-shipped evidence | Separate WA/Admin checkpoints | `REFUND_READY` or hold |
| `FUNDED_CANCELLATION_REVIEW` | 1x24h response timeout | No automatic money movement | `MANUAL_REVIEW_REQUIRED` |
| `REFUND_READY` | Authorized refund starts | Destination and calculation frozen | `REFUND_PROCESSING` |
| `REFUND_PROCESSING` | Financial `SUCCESS` | Immutable reference | `REFUNDED` |
| any eligible state | Prohibited/fraud signal | Evidence and Admin task assignment | `RISK_HOLD` |

Late Midtrans success after expiry or cancellation enters reconciliation/refund
exception and never revives invitation, payment, fulfillment, confirmation, or
payout actions. Cancellation withdrawal/rejection may restore only a prior
state that remains valid after a fresh version and cutoff check.

No Midtrans event may mutate a transaction already in `PAYMENT_EXPIRED`,
`CANCELLED`, `REFUND_PROCESSING`, `REFUNDED`, `PAYOUT_PROCESSING`, `PAID_OUT`,
or another terminal financial boundary. It is stored as late/exception evidence
and routed to refund/reconciliation without transaction revival.

## 7. Midtrans Integration

### 7.1 Invoice creation

After both participant datasets are complete, the server freezes transaction
terms and creates one active Midtrans invoice using the Invoice API with
`payment_type: payment_link`.

Persist, server-side:

- BayarAman transaction ID and deterministic Midtrans order ID.
- Midtrans invoice/payment-link ID and hosted URL.
- Frozen amount, currency, issued timestamp, absolute BayarAman deadline,
  provider `due_date` when supported, and idempotency reference.
- Provider status and reconciliation metadata.

Invoice creation is idempotent. A duplicate request returns the existing
active invoice result. Amount, order ID, issued time, and BayarAman deadline
are immutable. Retry never resets the 1x24-hour deadline.

Midtrans secret key, signature secret, raw credentials, and provider auth
headers are server-only and must not enter client responses, logs, or audit.

### 7.2 Hosted checkout and status refresh

Buyer opens the hosted Midtrans payment page from `UI-SCR-010`. BayarAman
offers `Cek status pembayaran` only as a status refresh/request. It cannot
mark payment paid and there is no `Sudah Bayar` payment-confirmation action.

### 7.3 Webhook and Get Status API

The webhook handler must:

1. Authenticate the request and validate Midtrans signature.
2. Validate order ID, transaction ID, amount, currency, and fraud status.
3. Store a provider event identity before applying it.
4. Apply events idempotently under transaction state/version guard.
5. Reject or retain invalid, duplicate, delayed, and out-of-order events
   without overwriting an already authoritative result.
6. Use Get Status API reconciliation for missing, ambiguous, or UNKNOWN state.
7. Emit an audit event and reconciliation task for every accepted exception.

Webhook delivery is not authority by itself. Only validated
`settlement + fraud_status=accept` may move a transaction to
`PAYMENT_CONFIRMED`. Provider outage, timeout, signature failure, amount
mismatch, and UNKNOWN never infer paid.

Each provider event stores `providerEventId`, `payloadHash`, `eventTime`,
`receivedAt`, order ID, amount, transaction status, fraud status, signature
validation result, and reconciliation status. Duplicate identity is
`providerEventId` or payload hash. Event precedence is:

1. A validated `settlement + fraud_status=accept` is authoritative and
   immutable for payment authority.
2. `pending`, `capture`, `deny`, `cancel`, `failure`, and `expire` can never
   downgrade or overwrite an authoritative settlement.
3. A delayed event is older when its provider event time is older than the
   stored authoritative event; an out-of-order event is stored but cannot
   mutate the canonical result.
4. Equal-time or conflicting events are not resolved by arrival order. They
   open Get Status API reconciliation and remain `UNKNOWN`/manual review until
   an authoritative result is available.

The event insert and canonical payment mutation use one database transaction,
unique provider-event constraint, state-version guard, and a conditional
canonical update. A terminal/authoritative payment record cannot transition
back to a non-authoritative provider result.

## 8. Expiry, SLA, And Jobs

- BayarAman deadline starts when the invoice/payment link is available.
- Deadline is an absolute timestamp in `Asia/Jakarta`/WIB.
- Midtrans `due_date` follows it when supported; BayarAman remains authoritative.
- Expiry job only closes eligible `WAITING_BUYER_PAYMENT` transactions.
- Job uses atomic conditional update on transaction ID, state, version, and
  deadline. Audit is inserted only after a successful transition.
- Admin operating hours are 09.00-21.00 WIB.
- Payment/provider reconciliation target is two operating hours.
- Payout target is 1x24 hours after eligibility.
- Refund/split target is 2x24 hours after approval.
- Escalation reminder runs every 1x24 hours until the case is handled.
- Timeout creates reminder or `MANUAL_REVIEW_REQUIRED`, never financial success.

Jobs are safe to rerun and use a correlation key without adding a product
role or transaction state. Scheduler deployment is environment-specific.

## 9. Financial Operations

### 9.1 Refund

Use Midtrans Refund API when the payment method supports it. Otherwise an
assigned Admin may execute the approved manual fallback. Store an operation ID,
calculation, frozen Buyer destination, route, result, reference, and audit.

Refund, split, controlled exception, and authorized risk outcomes require two
Admin approval. The action is disabled before both approvals are recorded.

### 9.2 Payout

Seller payout is independent of Midtrans settlement. A payout requires Buyer
confirmation or an approved exception, no hold, Seller destination ownership,
assigned Admin authorization, and ordinary payout re-authentication. Controlled
exceptions may also require two Admin approval.

### 9.3 Split

Split legs use frozen calculations and unique operation IDs. Buyer and Seller
legs are separately evidenced; Buyer leg is attempted before Seller leg. Any
`UNKNOWN` leg blocks retry until reconciliation. Only successful references
may produce `SPLIT_SETTLED`.

## 10. Data Model And Constraints

| Entity | Required design |
| --- | --- |
| `accounts` | Reusable account; server-side Admin flag; verified WhatsApp prerequisite |
| `transactions` | State, state version, creator, timestamps, immutable deadline reference |
| `transaction_participants` | Exactly one Buyer and Seller; unique transaction/account; accounts must differ |
| `transaction_terms` | Item, shipping, fee, total; frozen before invoice |
| `invitations` | Token hash, target role, expiry, used/revoked fields; raw token never stored/logged |
| `payment_invoices` | One active invoice per transaction; Midtrans IDs, link, amount, deadline, provider status |
| `payment_provider_events` | Provider event ID/hash, order ID, amount, status, fraud, signature result; immutable raw evidence Admin-only |
| `payment_reconciliations` | Decision, Get Status reference, operator, deadline, result, evidence |
| `whatsapp_groups/checkpoints` | Group/message/evidence reference, actor, timestamp, separate role checkpoints |
| `confirmation_links/otps` | Hashed tokens/codes, frozen number reference, expiry, attempt count, single-use |
| `cancellation_requests/reconciliations` | Cause, note, requester, state/version, active uniqueness, provider result |
| `complaint_holds/risk_holds` | Evidence, generic participant status, Admin-only raw data, outcome decision |
| `financial_operations` | Unique operation ID, type, amount, destination snapshot, result, reference, approvals |
| `idempotency_keys` | Unique actor/command/key and request hash; duplicate returns original result |
| `audit_events` | Append-only actor, action, prior/result state, version, correlation, evidence reference |

Required database constraints include distinct Buyer/Seller accounts, one
participant per product role, one active invoice, one active cancellation
request, one active financial operation per purpose, immutable success evidence,
unique idempotency key, and state-version concurrency checks.

Raw financial/provider/WhatsApp evidence is separated from masked participant
projections. No Admin replacement of participant-owned payout/refund
destinations is supported.

## 11. API And Interface Boundary

| Boundary | Contract |
| --- | --- |
| `POST /api/transactions` | Create seller/buyer initiated transaction; idempotent |
| `POST /api/invitations/:token/join` | Validate session, verified WhatsApp, opposite role, distinct account, expiry, and version |
| `POST /api/transactions/:id/payment-link` | Server-side idempotent Midtrans invoice creation |
| `GET /api/transactions/:id/payment-status` | Buyer/Admin status refresh; never payment confirmation |
| `POST /api/webhooks/midtrans` | Signature/order/amount/fraud validation and event idempotency |
| `POST /api/admin/payments/:id/reconcile` | Get Status/manual reconciliation boundary |
| `POST /api/admin/financial-operations/:id/refund` | Midtrans Refund API or approved manual fallback |
| `POST /api/admin/financial-operations/:id/payout` | Separate Seller payout operation |
| `POST /api/admin/financial-operations/:id/approve` | Two-Admin approval/re-auth boundary |
| `POST /api/jobs/payment-expiry` | Secured idempotent expiry invocation |

All mutations require authentication, authorization, `Idempotency-Key`, and
`expectedStateVersion` where applicable. Responses expose canonical status,
next actor, deadline, and financial result only within permission boundary.

## 12. Authorization And Privacy

- Product role is only Buyer, Seller, or Admin.
- Client-supplied role is never trusted; server resolves account and
  transaction role from persisted data.
- Buyer and Seller may read/write only their owned fields.
- Admin task assignment controls sensitive operations but does not create a
  fourth product role.
- Raw Midtrans, bank, WhatsApp, OTP, and risk evidence is Admin-restricted.
- Buyer/Seller receive masked counterparty data and generic risk status.
- Secrets, OTP plaintext, raw account values, and provider credentials are
  excluded from logs, cookies, client responses, and audit payloads.
- Two-Admin approval and payout re-authentication are server-side checks and
  append-only audit events.

## 13. Failure And Recovery Matrix

| Failure | Expected behavior | Recovery |
| --- | --- | --- |
| Invoice API timeout | Keep existing invoice/deadline boundary; do not create duplicate | Retry idempotently or reconcile provider |
| Webhook signature failure | Reject; no payment transition | Admin/provider reconciliation |
| Order/amount mismatch | Non-authoritative exception; no fulfillment | Admin Get Status/reconciliation |
| Duplicate/out-of-order webhook | Return existing result; do not overwrite authority | No state reset; audit event |
| Provider outage/UNKNOWN | Keep waiting or manual review | Get Status API before retry/decision |
| Invoice deadline reached | Expire once; no deadline reset | Late-fund refund-only exception |
| WhatsApp delivery failure | No trusted state change | Retry within policy; Admin escalation |
| Invalid/expired OTP | Reject and count attempt | Cooldown/resend or manual review |
| Refund/payout FAILED | Record result and permit safe retry | Retry after operation closure |
| Refund/payout UNKNOWN | Block retry and terminal state | Reconcile external operation |
| Missing second approval/re-auth | Action remains disabled | Assigned Admin completes authorization |
| State-version conflict | Reject mutation and audit conflict | Reload canonical state and retry if valid |
| Notification failure | State unchanged | Retry at most three times; after the third failure create Admin escalation/reminder |

## 14. Testing And Observability

Required tests:

- Schema constraints, participant ownership, frozen terms, invoice uniqueness,
  and immutable financial evidence.
- Midtrans signature/order/amount/fraud validation and payment authority.
- Invoice idempotency, duplicate/delayed/out-of-order webhook, Get Status API,
  provider outage, and late-fund no-revival behavior.
- Expiry boundary, due date, operating hours, SLA, escalation, and fixed clock.
- Refund/payout/split result recovery, two-Admin approval, and payout re-auth.
- State-version conflict, duplicate mutation, unauthorized access, and audit append-only behavior.
- OTP destination, expiry, attempt, cooldown, and single-use behavior.
- UI-SCR states, mobile-width desktop surface, accessibility, and masking.
- Notification delivery is attempted at most three times; the third failure
  creates an escalation without changing trusted transaction state.

Observability may record event IDs, correlation IDs, state/result, duration,
retry count, and error category. It must not record secrets, OTP plaintext,
raw bank values, raw provider credentials, or raw WhatsApp evidence.

### 14.1 Concrete Traceability Matrix

| Technical boundary | Requirement IDs | UX Flow IDs | UI-SCR/state IDs | QA Scenario IDs | PRD/PB IDs |
| --- | --- | --- | --- | --- | --- |
| Account/session and WhatsApp OTP | `UR-ACCOUNT-001`, `UR-ACCOUNT-002`, `UR-SYSTEM-002` | `UX-FLOW-001`, `UX-FLOW-024` | `UI-SCR-001`, `UI-SCR-014` | `QA-ACCOUNT-001`, `QA-CONF-002`, `QA-CONF-003` | `PB-BR-010` |
| Transaction/invitation and role ownership | `UR-INIT-001`, `UR-BUYER-001`, `UR-SELLER-001`, `UR-PARTICIPANT-001` | `UX-FLOW-002`, `UX-FLOW-005`, `UX-FLOW-012` | `UI-SCR-002`, `UI-SCR-006`, `UI-SCR-009` | `QA-TRANS-001`, `QA-TRANS-003`, `QA-SEC-001` | `PB-BR-001`, `PB-BR-003` |
| Midtrans invoice/payment link | `UR-PAYMENT-001`, `UR-PAYMENT-002`, `UR-BR-031` | `UX-FLOW-012`, `UX-FLOW-013` | `UI-SCR-009`, `UI-SCR-010` | `QA-MP-001`, `QA-MP-003` | `PB-MP-001`, `PB-MP-OD-001` |
| Webhook authority and precedence | `UR-PAYMENT-004`, `UR-PAYMENT-005`, `UR-ADMIN-020` | `UX-FLOW-015`, `UX-FLOW-016`, `UX-FLOW-047` | `UI-SCR-011` | `QA-MP-004`, `QA-MP-005`, `QA-MP-006` | `PB-MP-002`, `PB-MP-003`, `PB-MP-OD-002`, `PB-MP-OD-003` |
| Get Status/reconciliation/outage | `UR-PAYMENT-006`, `UR-ADMIN-023`, `UR-BR-034` | `UX-FLOW-047`, `UX-FLOW-050` | `UI-SCR-011`, `UI-SCR-022` | `QA-MP-007`, `QA-PAY-007`, `QA-EXP-003` | `PB-MP-005`, `PB-MP-OD-004` |
| Expiry/due date/late fund | `UR-SYSTEM-005`, `UR-SYSTEM-006`, `UR-BR-010`, `UR-BR-035` | `UX-FLOW-045`, `UX-FLOW-048`, `UX-FLOW-049` | `UI-SCR-010`, `UI-SCR-020` | `QA-MP-008`, `QA-EXP-001`, `QA-EXP-004` | `PB-MP-006`, `PB-MP-OD-005` |
| WhatsApp group/checkpoints | `UR-ADMIN-003`, `UR-PARTY-001`, `UR-SELLER-004` | `UX-FLOW-017`, `UX-FLOW-020` | `UI-SCR-012`, `UI-SCR-013` | `QA-WA-001`, `QA-WA-003`, `QA-WA-004` | `PB-BR-008`, `PB-BR-009` |
| Confirmation and payout eligibility | `UR-BUYER-006`, `UR-BUYER-007`, `UR-ADMIN-006` | `UX-FLOW-024`, `UX-FLOW-025`, `UX-FLOW-026` | `UI-SCR-014`, `UI-SCR-016` | `QA-CONF-002`, `QA-CONF-005`, `QA-FIN-001` | `PB-BR-010` |
| Refund/payout/split operations | `UR-FINANCIAL-001`, `UR-FINANCIAL-002`, `UR-FINANCIAL-003`, `UR-BR-040`, `UR-BR-041` | `UX-FLOW-025`, `UX-FLOW-040`, `UX-FLOW-042` | `UI-SCR-016`, `UI-SCR-018`, `UI-SCR-019` | `QA-FIN-002`, `QA-FIN-004`, `QA-FIN-005`, `QA-FIN-008` | `PB-MP-007`, `PB-MP-008` |
| Cancellation/complaint/risk | `UR-CANCEL-004`, `UR-CANCEL-007`, `UR-CANCEL-022`, `UR-CAN-OD-007` | `UX-FLOW-054`, `UX-FLOW-057`, `UX-FLOW-072` | `UI-SCR-017`, `UI-SCR-023`, `UI-SCR-024` | `QA-CANCEL-003`, `QA-CANCEL-006`, `QA-COMPLAINT-001`, `QA-RISK-001`, `QA-SEC-004` | `PB-CAN-OD-001`, `PB-CAN-OD-005` |
| SLA/notification/escalation | `UR-BR-043`, `UR-BR-044`, `UR-CAN-OD-008` | `UX-FLOW-018`, `UX-FLOW-066` | `UI-SCR-012`, `UI-SCR-022` | `QA-SLA-001`, `QA-SLA-002`, `QA-NOTIFY-001` | `PB-CAN-OD-006` |
| Launch gate | `UR-BR-046` | Non-UI release gate | Non-UI | `QA-LAUNCH-001` | `PB-MP-009`, `PB-MP-OD-005` |

## 15. Local Environment And Deployment

- PostgreSQL runs through Docker Compose/OrbStack only for local development.
- Midtrans sandbox/fake adapter is used for local and automated tests.
- `.env.example` contains placeholder variables only; production secrets are
  managed outside the repository.
- Production remains PostgreSQL-compatible and does not depend on OrbStack.
- Webhook deployment requires HTTPS, provider configuration, signature secret,
  replay protection, monitoring, and launch approval.
- Scheduler invocation must be authenticated and safe to rerun.

## 16. Launch Gate And Open Technical Decisions

Production real-money launch remains blocked until merchant settlement,
custody/forwarding, legal/compliance, consumer disclosures, complaint/data
controls, production credentials, webhook deployment, and real-money pilot
evidence are approved under `UR-BR-046`, `PB-MP-009`, `PB-MP-OD-005`, and
`QA-LAUNCH-001`.

| Decision | Owner | Stage | Status |
| --- | --- | --- | --- |
| Midtrans production account, settlement, custody, and webhook arrangement | Product/Legal/Midtrans partner | Launch gate | Open blocker |
| Provider refund capability per payment method | Engineering/Product | Provider integration | Open; fallback defined |
| Retention duration and legal hold for raw evidence | Legal/Compliance | Production launch | Open blocker |
| Exact scheduler/queue provider and alerting | Engineering | Implementation plan | Deferred |
| Final schema indexes and migration ordering | Engineering | Implementation plan | Deferred |

## 17. Migration And Ticket Boundary

TRD v1.1 and existing `docs/engineering/tickets/` may contain the former
manual-bank payment flow, Buyer `Sudah Bayar` claim, Seller OTP, seven
WhatsApp checkpoints, or legacy states. Those artifacts are not authoritative
until reviewed against PRD v0.2 and this TRD v1.2.

This document does not create Engineering Tickets, implementation plans,
migrations, provider credentials, or source code. Ticket review must preserve
stable product IDs and remove behavior that conflicts with Midtrans authority.

## 18. Approval Checklist

- [x] PRD v0.2 and all approved product artifacts are linked.
- [x] Midtrans invoice, payment authority, webhook, reconciliation, expiry, and late-fund boundaries are defined.
- [x] Refund, payout, split, two-Admin approval, and re-authentication boundaries are defined.
- [x] Product roles remain Buyer, Seller, and Admin only.
- [x] No new transaction state or financial result was introduced.
- [x] Data, API, authorization, concurrency, audit, failure, testing, and deployment boundaries are defined.
- [x] Launch gate and migration from legacy manual-bank behavior are explicit.
- [x] Product Owner review and approval completed.

TRD v1.2 is `Approved`. Engineering Tickets and execution plans may now use
it as the technical source, subject to ticket-level scope and plan review.
