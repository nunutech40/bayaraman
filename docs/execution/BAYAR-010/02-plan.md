# Implementation Plan: BAYAR-010

## Task

```text
Ticket ID/title:
BAYAR-010 - Cancellation Lifecycle and Midtrans Reconciliation Handoff

Outcome:
Implement direct, provider-reconciled, funded, complaint/risk-delegated, and
late-fund cancellation paths. Publish an immutable Buyer-refund handoff for
BAYAR-008 without executing money movement or reviving a closed transaction.

Source research:
docs/execution/BAYAR-010/01-research.md

Source requirements:
UR-CANCEL-001..025
UR-CAN-OD-001..008
UR-BR-032, UR-BR-035, UR-BR-047..062

Source QA scenarios:
QA-CANCEL-001..014
QA-EXP-004
QA-SEC-003, QA-SEC-004, QA-SEC-005
QA-UI-001, QA-UI-002

Source UX Flow and UI IDs/states:
UX-FLOW-043..050
UX-FLOW-051..075
UI-SCR-017, UI-SCR-018, UI-SCR-020..024

Technical boundary:
PRD.md v0.2 Approved
TRD.md v1.2 Approved

Version: 0.1
Status: Draft
```

The ticket metadata lists only part of the approved cancellation UX range.
This plan uses `UX-FLOW-051..075` because those are the concrete approved
cancellation flows referenced by the ticket's `UR-CANCEL-*` requirements.
This is a traceability correction, not a product-scope expansion.

## Scope

### In Scope

- Buyer/Seller cancellation request, status, withdrawal, and safe rejection.
- Direct cancellation before counterparty join and after join before invoice.
- Invoice retirement and `CANCELLATION_PENDING_RECONCILIATION`.
- Reuse of the canonical active Midtrans provider review.
- Server-side Midtrans cancellation classification and Get Status recovery.
- Definitive non-paid, authoritative settlement, waiting, mismatch, UNKNOWN,
  and two-operating-hour timeout branches.
- Funded cancellation before the canonical Seller shipment checkpoint.
- Manual WhatsApp request, Seller statement, Buyer/Seller response, immutable
  evidence correction, and 24-hour response deadline.
- Cause-based refund calculation and two distinct Admin approvals.
- Complaint delegation for shipped/conflicting evidence.
- Risk delegation for prohibited/policy/fraud cases.
- A source-owned, immutable, single-use refund handoff for funded cancellation
  and matching late funds.
- Internal Admin assignments for reconciliation, evidence, and approval.
- Participant-safe projections and assignment-gated Admin projections.
- Deterministic reconciliation/response timeout services and local commands.
- UI-SCR-021, UI-SCR-022, and UI-SCR-023 plus handoff-only states in
  UI-SCR-017/018/020/024.
- Additive PostgreSQL migration, constraints, append-only audit, concurrency,
  authorization, privacy, route, service, UI, and fixed-clock tests.

### Out Of Scope

- Refund, payout, split, provider-refund, manual-bank, or other money movement.
- Creating a `financial_operations` row; BAYAR-008 owns execution.
- Complaint adjudication, agreement decisions, or complaint financial handoff.
- Risk review, risk outcome, risk approval, or risk financial handoff.
- Automatic WhatsApp parsing, WhatsApp API integration, raw chat/media storage,
  or participant-authored trusted checkpoints.
- Payment invoice creation, normal payment authority, or changing Midtrans's
  `settlement + fraud_status=accept` rule.
- New transaction states, financial results, or product roles.
- Reopening expired/cancelled transactions after late provider success.
- Cancellation after a financial operation begins or a terminal state exists.
- Destination replacement or Admin editing of participant-owned financial data.
- Production scheduling, escalation orchestration, or notification retries;
  BAYAR-012 owns orchestration.
- Financial operation approval/re-authentication; BAYAR-008 owns those controls.
- Assignment-management UI.
- Modifying Product Brief, User Journey, UX Flow, User Requirements, UI/UX,
  QA Scenarios, PRD, TRD, or the engineering ticket.

## Approved Implementation Decisions

### Product And Internal Vocabularies

Product roles remain:

```text
BUYER
SELLER
ADMIN
```

Cancellation cause:

```text
BUYER_CHANGE_OF_MIND
SELLER_UNABLE_TO_FULFILL
MUTUAL_NEUTRAL
BAYARAMAN_ERROR
PROHIBITED_OR_POLICY
SUSPECTED_FRAUD
OTHER_MANUAL_REVIEW
```

`OTHER_MANUAL_REVIEW` requires a note. The submitted cause is immutable.
Corrections append an event and never replace the original cause.

Compatibility request status:

```text
ACTIVE
CLOSED
```

`status` indicates whether an operational cancellation case still requires
work and remains the compatibility key for the partial unique index and
BAYAR-011 source-owner lookup. `lifecycle` records the detailed outcome.

Internal request lifecycle:

```text
ACTIVE
WITHDRAWN
REJECTED
RESOLVED
REFERRED_TO_COMPLAINT
REFERRED_TO_RISK
```

Internal decision:

```text
DIRECT_CANCELLED
DEFINITIVE_NON_PAID
FUNDED_REVIEW
REFUND_APPROVED
LATE_FUND_REFUND
COMPLAINT_HANDOFF
RISK_HANDOFF
MANUAL_REVIEW
```

Internal delegation type and status:

```text
delegation_type: NONE | COMPLAINT | RISK
delegation_status: NOT_REQUIRED | REQUIRED | REFERRED
```

`delegation_type/status` is an internal cancellation projection, not a
transaction state or product role. A participant can create a request whose
immutable cause makes `RISK/REQUIRED` necessary, but cannot create a risk case,
complaint case, or hold. Evidence can make `COMPLAINT/REQUIRED` necessary, but
the evidence recorder cannot inherit complaint authority.

Internal event type:

```text
REQUESTED
EVIDENCE_CORRECTED
WITHDRAWN
REJECTED
INVITATION_REVOKED
INVOICE_RETIRED
RECONCILIATION_LINKED
PROVIDER_RESULT_RECORDED
WA_REQUEST_RECORDED
PARTICIPANT_RESPONSE_RECORDED
SELLER_SHIPMENT_RECORDED
RESPONSE_TIMEOUT_RECORDED
RECONCILIATION_TIMEOUT_RECORDED
MANUAL_REVIEW_RECOVERY_RECORDED
REFUND_CALCULATION_PROPOSED
REFUND_CALCULATION_APPROVED
REFUND_CALCULATION_REJECTED
COMPLAINT_HANDOFF_REQUIRED
COMPLAINT_HANDOFF_RECORDED
RISK_HANDOFF_REQUIRED
RISK_HANDOFF_RECORDED
FINANCIAL_HANDOFF_CREATED
HANDOFF_CLAIMED
```

These are internal lifecycle/event values. They are not transaction states,
financial results, or additional product roles.

### Cancellation Entry Matrix

Every mutation requires authentication, authorization, `Idempotency-Key`,
request hash, current participant association/assignment, transaction row lock,
and `expectedStateVersion`.

| Current state | Eligible actor | Additional predicate | Atomic result |
| --- | --- | --- | --- |
| `WAITING_COUNTERPARTY` | Initiator only | Counterparty has not joined; no invoice | Revoke invitation and transition to `CANCELLED`; non-risk request closes/resolves, risk cause remains `ACTIVE` with `RISK/REQUIRED` |
| `WAITING_COUNTERPARTY_DATA` | Buyer or Seller participant | Both participants exist; no invoice | Transition to `CANCELLED`; non-risk request closes/resolves, risk cause remains `ACTIVE` with `RISK/REQUIRED` |
| `WAITING_BUYER_PAYMENT` | Buyer or Seller participant | Active invoice exists; no authority pointer; no processing/terminal state | Insert request, retire invoice, link/create reconciliation, transition to `CANCELLATION_PENDING_RECONCILIATION` |
| `PAYMENT_UNDER_REVIEW` or `PAYMENT_EXCEPTION_REVIEW` | Buyer or Seller participant | Canonical active payment reconciliation exists | Insert request and link existing review; keep transaction state unchanged |
| `PAYMENT_CONFIRMED` | Buyer or Seller participant | No shipment checkpoint, hold, or financial operation | Insert request and transition to `FUNDED_CANCELLATION_REVIEW` |
| `READY_FOR_FULFILLMENT` | Buyer or Seller participant | `SELLER_SHIPMENT` checkpoint absent; no hold/operation | Insert request and transition to `FUNDED_CANCELLATION_REVIEW` |
| `CANCELLATION_PENDING_RECONCILIATION`, `FUNDED_CANCELLATION_REVIEW` | Original requester | Same request/hash returns canonical active result | No duplicate request or transition |
| `PAYMENT_EXPIRED` or `CANCELLED` | System/assigned Admin, provider evidence only | Matching late authoritative event | Keep closed semantics; transition only to `REFUND_READY` and create late-fund handoff |
| `RISK_HOLD` | Participant read only; assigned Risk Admin acts elsewhere | Active risk case owns review | Cancellation mutation disabled; generic held status only |
| `PAYOUT_ON_HOLD` | Participant read only; assigned Complaint Admin acts elsewhere | Complaint owns review | Cancellation refund actions disabled |
| `WAITING_COMPLETION_REPORTS`, `WAITING_OTHER_COMPLETION_REPORT`, `READY_FOR_BUYER_CONFIRMATION`, `WAITING_BUYER_CONFIRMATION`, `BUYER_CONFIRMATION_OVERDUE`, `READY_FOR_PAYOUT` | No direct cancellation | Canonical shipment/fulfillment has started | Reject cancellation; complaint may be opened separately |
| `PAYOUT_PROCESSING`, `REFUND_PROCESSING`, `SPLIT_PROCESSING`, `PAID_OUT`, `REFUNDED`, `SPLIT_SETTLED` | None | Financial processing/terminal cutoff | Reject without state mutation or reversal |

Additional rules:

- Request persistence and transaction outcome commit atomically.
- The request row remains distinct from the decision/terminal transaction.
- `CANCELLATION_REQUESTED` is not used as an extra externally observable
  transition when the same atomic command can produce the approved branch.
- A cancellation during an existing provider review never opens a competing
  reconciliation or changes the original invoice deadline.
- An exact duplicate returns the active/final result. A changed request hash or
  stale version is rejected and audited.
- A canonical `SELLER_SHIPMENT` checkpoint is a hard cancellation cutoff.
- A cancellation-specific Seller statement does not overwrite or replace the
  canonical fulfillment checkpoint.
- `PROHIBITED_OR_POLICY` and `SUSPECTED_FRAUD` set
  `delegation_type=RISK` and `delegation_status=REQUIRED`. The participant
  request never invokes BAYAR-011 or changes the transaction to `RISK_HOLD`.
- A direct non-risk cancellation atomically sets transaction `CANCELLED`,
  request `status=CLOSED`, lifecycle `RESOLVED`, decision
  `DIRECT_CANCELLED`, and `resolved_at`.
- A direct risk cancellation atomically sets transaction `CANCELLED` and
  decision `DIRECT_CANCELLED`, but keeps request `status=ACTIVE`, lifecycle
  `ACTIVE`, `RISK/REQUIRED`, and `resolved_at=NULL`. It remains the BAYAR-011
  source owner until assigned Risk Admin records the record-only case.
- After that risk handoff, request becomes `status=CLOSED`, lifecycle
  `REFERRED_TO_RISK`, `RISK/REFERRED`, stores `risk_case_id`, and sets
  `resolved_at`.
- A funded/pre-processing risk request remains `ACTIVE` in
  `FUNDED_CANCELLATION_REVIEW` until assigned Risk Admin performs the active
  handoff.
- A direct terminal cancellation decision cannot be withdrawn even while its
  risk delegation keeps the operational request `ACTIVE`.

### Midtrans Cancellation Classification

Implement one server-side classifier over a canonical
`PaymentStatusResult` plus the invoice snapshot:

```ts
type CancellationProviderClassification =
  | "AUTHORITATIVE"
  | "DEFINITIVE_NON_PAID"
  | "WAITING"
  | "MISMATCH"
  | "UNKNOWN";
```

Classification uses this total ordered precedence. Evaluation stops at the
first matching outcome:

| Order | Validation | Result |
| --- | --- | --- |
| 1 | Timeout, malformed response, missing provider/order/invoice/transaction identity, unverifiable event, or invalid-signature webhook without authoritative recovery | `UNKNOWN` |
| 2 | Provider, order ID, invoice ID, or transaction binding contradicts the frozen invoice | `MISMATCH` |
| 3 | Provider supplies amount/currency and either contradicts the frozen invoice; accepted/terminal result omits a provider-required amount/currency | `MISMATCH` |
| 4 | `settlement` and `fraud_status=accept`, with all identity/amount/currency checks passed | `AUTHORITATIVE` |
| 5 | `deny`, `cancel`, `failure`, or `expire`, with all identity/amount/currency checks passed; fraud status is recorded but cannot upgrade the result | `DEFINITIVE_NON_PAID` |
| 6 | `pending` or `capture`, with all identity checks passed and no contradictory amount/currency | `WAITING` |
| 7 | Any other status or unverifiable fraud value needed for settlement authority | `UNKNOWN` |

Rules:

- `capture` remains provider-success but not authoritative settlement.
- Invalid-signature webhook data cannot decide cancellation. Get Status API is
  required for recovery.
- Client input never supplies provider status, classification, amount,
  currency, event ID, or authority.
- The existing immutable provider event and reconciliation event are referenced
  instead of copying a raw provider payload.
- A prior authoritative provider event cannot be downgraded by later events.
- A definitive non-paid decision does not prevent a later matching settlement
  from creating a late-fund handoff; it still never revives the transaction.
- No result can be both `MISMATCH` and `DEFINITIVE_NON_PAID`; identity and
  amount/currency validation precede provider-status classification.
- Table-driven unit tests cover missing versus contradictory identity,
  terminal non-paid with mismatched amount/currency, settlement with non-accept
  fraud status, capture, unknown status, and malformed provider output.

### Shared Cancellation Provider Resolver

Create one dependency-neutral contract in
`src/server/cancellation/provider-resolution.ts`:

```ts
type CancellationResolutionSource =
  | "WEBHOOK"
  | "GET_STATUS"
  | "ADMIN_RECOVERY";

type ResolveCancellationProviderStatusInput = {
  transactionId: string;
  invoiceId: string;
  cancellationRequestId: string | null;
  paymentReconciliationId: string;
  providerEventId: string;
  expectedStateVersion: number;
  source: CancellationResolutionSource;
  correlationId: string;
  idempotencyKey: string;
};

resolveCancellationProviderStatus(
  tx: DatabaseTransaction,
  input: ResolveCancellationProviderStatusInput
): Promise<CancellationResolutionResult>;
```

Contract:

- Payment modules own provider transport, signature verification, canonical
  event insertion, and Get Status calls. They call this resolver only after an
  immutable provider event exists.
- A null `cancellationRequestId` is accepted only for a canonical late event on
  `PAYMENT_EXPIRED`; the invoice, reconciliation, provider event, transaction,
  and Buyer binding remain mandatory. Active cancellation branches require a
  non-null active request.
- The resolver imports payment repository types but not payment routes,
  provider adapters, or the orchestration module. Static orchestration imports
  both payment persistence and this resolver; there is no runtime/global
  callback registration.
- The caller owns the database transaction. The resolver locks, in order,
  transaction, invoice, cancellation request, payment reconciliation,
  cancellation reconciliation, provider event, and existing financial handoff.
- It validates every ID belongs to the same transaction and invoice, then
  applies the total ordered classifier.
- An append-only `cancellation_provider_resolutions` row unique by
  `provider_event_id`, plus the command idempotency record, ensures one provider
  event produces at most one cancellation/late-fund outcome. Exact replay
  returns the canonical result; changed request hash conflicts.
- Older, duplicate, or out-of-order events can append sanitized evidence but
  cannot downgrade an authoritative/final decision.
- `AUTHORITATIVE` moves an active cancellation to
  `FUNDED_CANCELLATION_REVIEW`. `DEFINITIVE_NON_PAID` resolves it as
  `CANCELLED`. `WAITING`, `MISMATCH`, and `UNKNOWN` preserve the current
  reconciliation/manual-review state.
- For `PAYMENT_EXPIRED` or `CANCELLED`, only a canonical authoritative event
  can atomically create one late-fund handoff and transition to `REFUND_READY`.
  The transaction is never restored to payment, fulfillment, or payout.
- Webhook and Get Status callers use the same resolver. An assigned Admin uses
  `ADMIN_RECOVERY` after timeout; client input never supplies provider facts.

For requests created while the transaction remains `PAYMENT_UNDER_REVIEW` or
`PAYMENT_EXCEPTION_REVIEW`, persist lifecycle `ACTIVE`, the canonical
`payment_reconciliation_id`, and `RECONCILIATION_LINKED`. The payment
reconciliation completion path invokes:

```ts
applyCompletedPaymentReconciliationToCancellation(
  tx: DatabaseTransaction,
  input: {
    cancellationRequestId: string;
    paymentReconciliationId: string;
    providerEventId: string;
    expectedStateVersion: number;
    correlationId: string;
    idempotencyKey: string;
  }
): Promise<CancellationResolutionResult>;
```

This function delegates to the shared resolver under the same row locks. It is
single-application and converts the linked request to funded review,
cancelled, or manual review according to the canonical provider result. It
does not open a second reconciliation or change the invoice deadline.

### Static Provider Event Orchestration

Create:

```text
src/server/payment/process-provider-event.ts
```

The module exports a statically imported application service that:

- accepts a caller-owned database transaction and canonical provider input;
- inserts or locks the immutable payment provider event;
- applies normal payment-authority logic where eligible;
- detects an active linked cancellation or closed-state late-fund eligibility;
- calls `resolveCancellationProviderStatus(...)` in the same transaction;
- returns one canonical payment/cancellation result.

Exact dependency direction:

```text
provider adapter -> provider transport/result only
payment repositories -> payment persistence only
process-provider-event -> payment repositories + cancellation resolver
cancellation resolver -> repositories/types only
routes/jobs -> process-provider-event
```

Callers:

- Midtrans webhook route calls `process-provider-event`.
- Get Status reconciliation calls `process-provider-event`.
- Admin cancellation recovery obtains Get Status output, then calls
  `process-provider-event` with source `ADMIN_RECOVERY`.

No global registry, runtime callback, lazy registration, or module-level
mutable hook is allowed. Integration tests spy at the orchestration boundary
and prove all three callers use the same resolver, create no duplicate provider
resolution, share one database transaction, and introduce no import cycle.

### Reconciliation Ownership And Deadline

- BAYAR-010 creates `cancellation_reconciliations` as a cancellation-owned
  projection that references the canonical `payment_reconciliations` row.
- If a canonical payment reconciliation is already active, cancellation links
  it and does not create another payment reconciliation.
- Otherwise BAYAR-010 calls a shared payment reconciliation helper inside the
  same database transaction and creates one canonical provider review.
- The cancellation reconciliation deadline is two operating hours from request
  acceptance, counted daily only inside 09:00-21:00 Asia/Jakarta.
- Examples:
  - 10:00 WIB -> 12:00 WIB same day.
  - 20:30 WIB -> 10:30 WIB next day.
  - 22:00 WIB -> 11:00 WIB next day.
- Persist absolute UTC timestamps and render them in WIB.
- Missing/WAITING/MISMATCH/UNKNOWN result at the deadline transitions only the
  matching active case to `MANUAL_REVIEW_REQUIRED`; it never implies no funds.
- The underlying provider reconciliation remains available for later evidence.
- Retry, refresh, webhook, Get Status, withdrawal attempt, or job rerun never
  resets the original deadline.

### Timeout And Manual Recovery Matrix

Every transition to `MANUAL_REVIEW_REQUIRED` records an immutable internal
reason on the active cancellation request:

```text
CANCELLATION_RECONCILIATION_TIMEOUT
FUNDED_RESPONSE_TIMEOUT
UNSAFE_WITHDRAWAL_OR_REJECTION
```

| Manual-review reason | Assigned actor/action | Guarded result |
| --- | --- | --- |
| `CANCELLATION_RECONCILIATION_TIMEOUT` | `CANCELLATION_RECONCILIATION` Admin runs Get Status and the shared resolver with source `ADMIN_RECOVERY` | `AUTHORITATIVE -> FUNDED_CANCELLATION_REVIEW`; `DEFINITIVE_NON_PAID -> CANCELLED`; `WAITING/MISMATCH/UNKNOWN` remains `MANUAL_REVIEW_REQUIRED` |
| `FUNDED_RESPONSE_TIMEOUT` | `CANCELLATION_EVIDENCE` Admin appends/validates late evidence, then invokes explicit funded-response recovery | Complete current evidence plus Seller `NOT_SHIPPED`, no canonical shipment, hold, or financial operation -> `FUNDED_CANCELLATION_REVIEW`; otherwise remains manual review or becomes complaint/risk handoff required |
| `UNSAFE_WITHDRAWAL_OR_REJECTION` | `CANCELLATION_RECONCILIATION` Admin revalidates provider, invoice, cutoff, holds, and operations | Only an approved resolver/restoration branch may leave manual review; unsafe result remains manual review |

Recovery rules:

- The active request, manual-review reason, source state/version, immutable
  deadline, current evidence heads, and assignment are revalidated under lock.
- Recovery appends `MANUAL_REVIEW_RECOVERY_RECORDED`; it never edits the
  timeout event, restarts a timer, or changes the original deadline.
- Funded-response recovery is exposed separately from evidence insertion.
  Evidence can commit successfully while recovery fails; retry reuses the same
  evidence heads and idempotency result.
- Recovery never proposes/approves a calculation, creates a financial
  operation, executes money movement, or infers financial success.

### Withdrawal And Rejection Matrix

Only the original requester may withdraw. An assigned Admin with
`CANCELLATION_RECONCILIATION` may reject an ineligible request. Both are
forbidden after:

- an authoritative or definitive provider decision;
- a funded-response decision;
- an approved refund calculation or financial handoff;
- complaint/risk delegation;
- a financial operation;
- processing or terminal status.

Before restoring a prior state, the service locks the transaction, request,
invoice, provider reconciliation, holds, and relevant checkpoint head, then
revalidates current state/version, original deadline, provider evidence,
shipment cutoff, and financial-operation absence.

| Prior state | Safe restoration predicate | Result |
| --- | --- | --- |
| `WAITING_BUYER_PAYMENT` | Original deadline is future; invoice/provider identity remains valid; no authoritative/mismatch/UNKNOWN evidence; latest canonical status is `pending`; no active hold | Reactivate the same invoice without changing amount/deadline; return to `WAITING_BUYER_PAYMENT` |
| `PAYMENT_UNDER_REVIEW` / `PAYMENT_EXCEPTION_REVIEW` | Existing canonical payment review remains active and no cancellation decision exists | Restore the same review state; do not close/recreate provider review |
| `PAYMENT_CONFIRMED` / `READY_FOR_FULFILLMENT` | No shipment checkpoint, complaint/risk hold, or financial operation exists | Restore the exact prior state |
| Any expired, shipped, mismatched, unknown, held, processing, or terminal condition | Prior state is no longer safe | Transition to `MANUAL_REVIEW_REQUIRED`; do not reactivate invoice |

Direct terminal cancellations are already decided and cannot be withdrawn.
Withdrawal/rejection appends an event; it never deletes the request/evidence.

### Funded Cancellation Evidence

Cancellation evidence is owned by BAYAR-010 and uses stable keys:

```text
WA_REQUEST
SELLER_SHIPMENT
BUYER_RESPONSE
SELLER_RESPONSE
```

Rules:

- Admin must hold active `CANCELLATION_EVIDENCE`.
- The canonical transaction WhatsApp group and frozen participant snapshots are
  loaded server-side.
- Admin records group reference, message/evidence reference, immutable summary
  hash, source author role/account where applicable, event time, recorder, and
  delivery result.
- Delivery result is `PENDING`, `SENT`, `FAILED`, or `UNKNOWN`.
- Only the first valid `WA_REQUEST` with `SENT` starts the 24 elapsed-hour
  response deadline.
- Retry, correction, `FAILED`, or `UNKNOWN` never starts or resets the timer.
- Only Seller can be the source author for `SELLER_SHIPMENT`.
- Buyer/Seller response evidence is separately attributable. Admin records it;
  the system never parses WhatsApp automatically.
- Corrections append a new evidence event, require correction reason, keep the
  original immutable, move only the current evidence head, and never replay a
  state transition or reset a deadline.
- Participants see their response/status summary only. Raw references,
  evidence hashes, Admin identity, other participant private data, and full
  financial destination remain assignment-gated.
- At 24 elapsed hours without required valid evidence, a fixed-clock sweep
  changes `FUNDED_CANCELLATION_REVIEW -> MANUAL_REVIEW_REQUIRED`.
- The sweep records reason `FUNDED_RESPONSE_TIMEOUT`.
- Late evidence is appended for manual recovery and cannot silently reopen the
  original funded-review deadline. Evidence that indicates shipped/conflict
  changes only `delegation_type/status` to `COMPLAINT/REQUIRED`; it does not
  invoke complaint intake.
- An assigned `CANCELLATION_EVIDENCE` Admin must call the separate
  funded-response recovery command after evidence is complete. That command
  uses the timeout recovery matrix and never performs calculation or refund.

### Cause-Based Calculation And Approval

The service derives integer IDR amounts from frozen `transaction_terms`:

| Cause | Buyer refund amount | Service-fee treatment |
| --- | --- | --- |
| `BUYER_CHANGE_OF_MIND` | `itemPrice + shippingCost` | Existing service fee retained |
| `MUTUAL_NEUTRAL` | `itemPrice + shippingCost` | Existing service fee retained |
| `SELLER_UNABLE_TO_FULFILL` | `totalAmount` | Service fee refunded |
| `BAYARAMAN_ERROR` | `totalAmount` | Service fee refunded |
| `PROHIBITED_OR_POLICY` | No cancellation calculation | Delegate to risk |
| `SUSPECTED_FRAUD` | No cancellation calculation | Delegate to risk |
| `OTHER_MANUAL_REVIEW` | No automatic calculation | Remain/manual review until a supported cause-specific outcome exists |

Calculation prerequisites:

- transaction is `FUNDED_CANCELLATION_REVIEW`;
- current trusted `WA_REQUEST` is `SENT`;
- required response and Seller `NOT_SHIPPED` evidence are current;
- canonical `SELLER_SHIPMENT` fulfillment checkpoint is absent;
- no complaint/risk hold or financial operation exists;
- frozen Buyer refund destination exists and is locked;
- source state/version and evidence heads match.

Internal assignments:

```text
CANCELLATION_RECONCILIATION
CANCELLATION_EVIDENCE
CANCELLATION_APPROVAL
```

- One Admin with `CANCELLATION_APPROVAL` proposes the calculation.
- Two distinct Admin accounts with `CANCELLATION_APPROVAL` must approve.
- The proposer may be one approver but cannot satisfy both approvals.
- Any rejection finalizes that calculation as immutable `REJECTED`, keeps the
  transaction in `FUNDED_CANCELLATION_REVIEW`, and creates no handoff.
- A new calculation version is allowed only when the server-derived amount,
  cause-specific fee treatment, or current evidence-head snapshot hash differs
  from the rejected version. An exact duplicate rejection/proposal returns the
  canonical final result; arbitrary retries cannot create a new version.
- Second approval atomically marks the calculation `APPROVED`, transitions
  `FUNDED_CANCELLATION_REVIEW -> REFUND_READY`, resolves the case, and creates
  one immutable financial handoff.
- BAYAR-008 separately enforces its financial-operation approvals. Approval of
  the cancellation calculation never executes or guarantees a refund.

### Late-Fund And Funded-Cancellation Handoff

Publish this exact repository contract from
`src/server/cancellation/handoff.ts`:

```ts
type CancellationRefundHandoffSnapshot = {
  handoffId: string;
  transactionId: string;
  cancellationRequestId: string | null;
  paymentReconciliationId: string | null;
  providerEventId: string;
  sourceType: "FUNDED_CANCELLATION" | "LATE_FUND";
  buyerAmount: number;
  currency: "IDR";
  buyerAccountId: string;
  calculationId: string | null;
  sourceHash: string;
  evidenceReference: string;
  evidenceHash: string;
  providerOrderId: string;
  sourceState: "REFUND_READY";
  sourceStateVersion: number;
  sourceFinalizedAt: Date;
  consumedByOperationId: string | null;
  consumedAt: Date | null;
};

readCancellationRefundHandoffForUpdate(
  tx: DatabaseTransaction,
  handoffId: string,
  transactionId: string
): Promise<CancellationRefundHandoffSnapshot>;

claimCancellationRefundHandoff(
  tx: DatabaseTransaction,
  input: {
    handoffId: string;
    transactionId: string;
    expectedSourceStateVersion: number;
    parentOperationId: string;
    actorAccountId: string;
    correlationId: string;
  }
): Promise<CancellationRefundHandoffSnapshot>;
```

BAYAR-008 must consume `sourceHash` and `sourceFinalizedAt` from this contract;
it must not expect source-specific `calculationHash` or `approvedAt` fields.

Contract:

- `read...ForUpdate` locks the handoff.
- A funded-cancellation handoff requires an `APPROVED` immutable calculation
  and the canonical authoritative provider event referenced by its invoice.
  `cancellationRequestId` and `calculationId` are required;
  `sourceHash=calculationHash`; `sourceFinalizedAt` is the second approval time.
- A late-fund handoff requires a matching authoritative provider event linked
  to the canonical invoice/reconciliation after expiry/cancellation.
  `calculationId` is null; `cancellationRequestId` may be null only for
  `PAYMENT_EXPIRED`; the invoice authority pointer remains unchanged/null.
- A late-fund provider event must be immutable `settlement + accept`, have
  accepted validation, and match provider order, invoice, transaction, actual
  amount, and currency. Its canonical payment reconciliation decision is
  `LATE_FUND_HANDOFF`.
- Late-fund `sourceHash` is the server-side SHA-256 of provider event ID,
  invoice ID, provider order ID, actual amount, currency, and reconciliation
  ID. `sourceFinalizedAt` is the canonical provider-resolution timestamp.
- `buyerAmount` is the approved calculation for funded cancellation and the
  actual verified incoming amount for late funds.
- The handoff binds the transaction Buyer through
  `(transaction_id, buyer_account_id)` to the frozen Buyer refund destination.
- Route selection remains BAYAR-008's server-side responsibility:
  Midtrans refund when supported, otherwise frozen Buyer destination fallback.
- Current transaction must remain `REFUND_READY` at the matching source version.
- The parent operation must belong to the transaction and have type `REFUND`.
- Same-operation replay returns the same claim without duplicate audit.
- A different operation conflicts.
- Claim and operation preparation occur in BAYAR-008's caller-owned database
  transaction.
- Snapshot fields are immutable; only one complete null-to-non-null consumption
  update is allowed.
- BAYAR-010 never creates or executes the financial operation.
- Named service checks and PostgreSQL constraint triggers enforce:
  - provider event -> invoice -> transaction identity;
  - request/calculation/reconciliation nullability by source type;
  - funded source has an approved calculation for the same request and invoice
    authority pointer equals its provider event;
  - late-fund source has canonical `LATE_FUND_HANDOFF` reconciliation,
    accepted `settlement + accept`, and does not set/change the invoice
    authority pointer;
  - Buyer participant, frozen refund destination, amount, currency, source
    state, and source version belong to the same transaction.
- Direct SQL with a cross-invoice event, cross-transaction reconciliation,
  wrong Buyer, non-authoritative event, mismatched amount/currency, or invalid
  source-field combination is rejected.

### Late-Fund Caller Ownership

- Webhook and Get Status remain owners of provider transport and immutable
  provider-event creation.
- After canonical validation, their caller-owned transaction invokes
  `resolveCancellationProviderStatus(...)`.
- An authoritative event for an expired/cancelled transaction creates the
  cancellation-owned handoff immediately and atomically. No additional Admin
  interpretation is required for a fully canonical event. This branch never
  writes `payment_invoices.authoritative_provider_event_id`.
- Invalid signature, mismatch, malformed, or `UNKNOWN` events only create/reuse
  provider reconciliation evidence. Assigned
  `CANCELLATION_RECONCILIATION` Admin must run Get Status recovery before any
  handoff can exist.
- The resolver uses the existing exported payment reconciliation helper; the
  private duplicate webhook helper is removed or delegated to that shared
  helper. Static provider orchestration described below composes payment
  persistence and cancellation resolution without runtime registration.
- Unique provider-event/reconciliation source keys plus transaction and
  handoff row locks make duplicate webhook, concurrent Get Status, and
  out-of-order delivery converge on one result.

### Complaint And Risk Delegation

Complaint delegation is explicitly two-step:

- `CANCELLATION_EVIDENCE` Admin appends shipped/conflicting evidence and sets
  `delegation_type=COMPLAINT`, `delegation_status=REQUIRED` only when the
  immutable request cause is not a risk cause and no delegation is already
  referred. This command commits the immutable evidence but does not create a
  complaint case.
- Only an Admin with active `COMPLAINT_INTAKE` may call the separate complaint
  handoff route. Add a complaint-owned internal function
  `recordComplaintFromCancellation(tx, input)` in the complaint module.
- It requires an active funded cancellation, current shipped/conflict evidence,
  active `COMPLAINT_INTAKE` assignment, matching transaction version, and no
  risk hold, financial operation, processing, or terminal state.
- It creates the complaint case/evidence and transitions
  `FUNDED_CANCELLATION_REVIEW -> PAYOUT_ON_HOLD` in the caller-owned transaction.
- It returns the complaint case ID. BAYAR-010 stores only that linkage and marks
  its request `REFERRED_TO_COMPLAINT` with
  `delegation_status=REFERRED`.
- If handoff fails, the caller-owned transaction rolls back complaint linkage
  and state mutation, while the previously committed cancellation evidence
  remains current and retryable.
- Existing complaint agreement/adjudication/handoff remains unchanged.

Risk delegation is also explicitly two-step:

- Buyer/Seller submission with `PROHIBITED_OR_POLICY` or `SUSPECTED_FRAUD`
  records only the immutable cancellation request and
  `delegation_type=RISK`, `delegation_status=REQUIRED`.
- Only an Admin with active `RISK_INTAKE` may call the risk handoff route and
  invoke risk-owned `recordRiskFromCancellation(tx, input)`.
- For paid/pre-processing cancellation, it creates the existing active risk
  case and transitions `FUNDED_CANCELLATION_REVIEW -> RISK_HOLD`.
- For pre-authority/direct-cancel context, it records risk evidence without
  inventing payment/refund authority; an otherwise eligible unfunded
  cancellation may still close as `CANCELLED`.
- For a direct risk cancellation whose transaction is already `CANCELLED`,
  `recordRiskFromCancellation` explicitly uses
  `sourceOwnerType=CANCELLATION_CASE` and the validated ACTIVE request ID.
  This source-specific helper does not fall through BAYAR-011's generic
  terminal-transaction owner branch.
- BAYAR-010 marks the request `REFERRED_TO_RISK` and stores only the risk case
  linkage with `status=CLOSED`, `delegation_status=REFERRED`, and
  `resolved_at`. This closes the compatibility-active source only after
  BAYAR-011 has created the case in the same transaction.
- The BAYAR-011 compatibility extension accepts cancellation-owned funded
  intake as active only through this assigned-Admin helper. Other cancellation
  states remain record-only as currently implemented.
- Existing risk review, outcome, approval, and risk refund handoff remain
  unchanged.
- `PROHIBITED_OR_POLICY` and `SUSPECTED_FRAUD` never enter the normal
  cancellation refund-calculation route.
- Risk cause has permanent precedence. `RISK/REQUIRED` or `RISK/REFERRED`
  cannot be replaced by complaint delegation. Later shipped/conflicting
  evidence remains append-only and is attached to the risk intake evidence.
- For non-risk causes, current shipped/conflicting evidence selects
  `COMPLAINT/REQUIRED`.
- Once any delegation is `REFERRED`, delegation type/status is immutable.
- Competing complaint/risk mutations lock the request, transaction, delegation
  projection, and current owner case. Exact replay returns the same linkage;
  the invalid/losing command is rejected and audited.

### Delegation Authorization Matrix

| Command | Required assignment | May write | May not do |
| --- | --- | --- | --- |
| Record cancellation evidence | `CANCELLATION_EVIDENCE` | Append evidence/head and mark complaint required | Create complaint/risk case or hold |
| Recover funded response | `CANCELLATION_EVIDENCE` | Revalidate late evidence and return to funded review | Calculate, approve, or execute refund |
| Complaint handoff | `COMPLAINT_INTAKE` | Create complaint linkage and `PAYOUT_ON_HOLD` atomically | Adjudicate or create financial outcome |
| Risk handoff | `RISK_INTAKE` | Create active/record-only risk linkage and permitted `RISK_HOLD` | Decide risk outcome or execute refund |
| Provider/manual recovery | `CANCELLATION_RECONCILIATION` | Run Get Status resolver and apply its guarded result | Supply provider facts manually |

Wrong, missing, or revoked assignment, stale version, duplicate changed hash,
competing delegation, and partial failure produce one sanitized rejection audit.
No route requires one Admin to possess two assignment scopes.

### Admin And Participant Authorization

- Participant mutation requires an authenticated, WhatsApp-verified Buyer or
  Seller associated with the transaction.
- Pre-join direct cancellation additionally requires creator ownership.
- A participant can author only their own request/withdrawal; Admin cannot
  impersonate a participant.
- Admin routes require `accounts.isAdmin=true` and an active matching internal
  assignment.
- Read access:
  - participant: generic case status, own response summary, deadline, next actor;
  - assigned Admin: sanitized evidence references, classifications, calculation,
    linkage, current heads, and history;
  - unassigned Admin: denied and audited.
- Product roles stay Buyer, Seller, and Admin. Assignment labels never appear
  as account or participant roles.
- Raw provider payload/signature, server key, raw WhatsApp content/media, OTP,
  password, full bank value, and unrestricted participant identity never enter
  DTOs, logs, audit payloads, or idempotency results.

## Persistence And Migration Contract

Create:

```text
drizzle/0012_bayar010_cancellation_lifecycle.sql
```

Update `src/server/db/schema.ts` and `drizzle/meta/_journal.json`.

### Migration Preflight And Order

The legacy cancellation tables have never had a trustworthy event/source-state
history. Preflight must stop before DDL when:

- any row exists in legacy `cancellation_requests` or
  `cancellation_reconciliations`;
- `bank_result` is non-null;
- duplicate active payment reconciliations or active cancellation requests
  exist;
- cancellation/request/reconciliation/account/transaction references are
  orphaned;
- any existing cause/status is outside the approved vocabulary;
- a financial operation conflicts with a candidate active cancellation;
- any existing invoice/provider reference is inconsistent.

For current local/test data, both cancellation tables must be empty. There is
no remediation marker in migration `0012`. If preflight finds any legacy row,
implementation stops before DDL and requires a separate reviewed/audited
remediation migration. That migration must classify each historical row from
external evidence and must not infer source state from the transaction's
current state. After remediation, `0012` is rerun from its initial preflight.

Migration order:

```text
BEGIN
preflight
drop/replace legacy weak FKs and constraints
add nullable request projection columns
create event/evidence/head/provider-resolution/reconciliation/calculation/
approval/handoff tables
add restrictive FKs and indexes
add vocabulary/cross-field checks
add append-only and immutable triggers
finalize request defaults/nullability
COMMIT
```

The preflight and DDL run in one PostgreSQL transaction. A preflight failure
leaves no schema changes. Recovery is: preserve the failed output, roll back,
prepare/approve a separate remediation migration, apply it, verify both legacy
tables are empty, then rerun `0012`. `bank_result` is never backfilled into
provider authority and is dropped or retained compatibility-only only after
the hard-stop check passes.

Required migration tests:

- clean migration;
- preflight failure before DDL;
- invalid cause/lifecycle/evidence/classification direct insert;
- duplicate active case/reconciliation/calculation/handoff;
- restrictive delete;
- immutable event/evidence/final calculation/handoff snapshot;
- partial/double handoff claim;
- rollback, recovery instruction, and migration rerun.

### `cancellation_requests`

Preserve the existing ID, transaction, requester, cause, note, status, local
state version, and creation timestamp. Add:

```text
requester_role
source_state
source_state_version
prior_state
lifecycle
decision
current_event_id
payment_reconciliation_id
complaint_case_id
risk_case_id
delegation_type
delegation_status
manual_review_reason
reconciliation_deadline_at
response_requested_at
response_deadline_at
resolved_at
updated_at
```

Constraints:

- status only `ACTIVE|CLOSED`;
- full cause, requester-role, lifecycle, decision, delegation, and
  manual-review-reason checks;
- `REQUIRED|REFERRED` delegation requires `COMPLAINT|RISK`;
- complaint/risk linkage must match the delegation type and `REFERRED` status;
- `RISK/REQUIRED` requires `status=ACTIVE`, lifecycle `ACTIVE`, null
  `risk_case_id`, and null `resolved_at`;
- `RISK/REFERRED` requires `status=CLOSED`, lifecycle
  `REFERRED_TO_RISK`, non-null `risk_case_id`, and non-null `resolved_at`;
- `COMPLAINT/REFERRED` requires `status=CLOSED`, lifecycle
  `REFERRED_TO_COMPLAINT`, non-null `complaint_case_id`, and non-null
  `resolved_at`;
- direct non-risk `DIRECT_CANCELLED` requires `status=CLOSED`, lifecycle
  `RESOLVED`, and non-null `resolved_at`;
- direct risk `DIRECT_CANCELLED` may remain `ACTIVE` only while
  `RISK/REQUIRED`;
- risk cause can only use delegation type `RISK`; risk required/referred cannot
  be replaced by complaint; non-risk shipped/conflict may select complaint;
- referred delegation type/status and linked case are immutable;
- `OTHER_MANUAL_REVIEW` requires note;
- non-negative source/local versions;
- one active request per transaction;
- current event, provider reconciliation, complaint, and risk references use
  `ON DELETE RESTRICT`;
- transaction/requester references change to `ON DELETE RESTRICT`;
- projection trigger permits only status/lifecycle/decision/current pointers/
  deadlines/delegation transition/local version/resolution updates allowed by
  the matrix;
  it rejects cause/source/requester mutation, delegation replacement, and
  delete.

### `cancellation_events`

Append-only fields:

```text
id
cancellation_request_id
event_type
corrected_event_id
actor_account_id
source_author_role
summary_snapshot
evidence_reference
evidence_hash
correction_reason
correlation_id
idempotency_key
created_at
```

- Unique `(cancellation_request_id, idempotency_key)`.
- Correction target must belong to the same request and remain current.
- Correction requires reason and does not mutate source cause/deadlines/state.
- All FKs are restrictive.
- Named insert-only trigger rejects update/delete.

### `cancellation_evidence` And `cancellation_evidence_heads`

Evidence fields:

```text
id
cancellation_request_id
evidence_key
group_id
source_author_account_id
source_author_role
shipment_status
response_value
message_reference
evidence_reference
evidence_hash
summary_snapshot
delivery_result
event_occurred_at
recorded_by_account_id
corrected_evidence_id
correction_reason
correlation_id
idempotency_key
created_at
```

Heads store one current evidence row per `(request_id, evidence_key)`.

Checks:

- evidence key and delivery vocabulary;
- Seller shipment key requires Seller source role and
  `SHIPPED|NOT_SHIPPED|UNKNOWN`;
- response keys require matching Buyer/Seller source role;
- WA request is Admin-recorded against the canonical group;
- correction target/reason pair;
- append-only evidence trigger;
- unique idempotency and head pointer;
- head update and event insert commit atomically.

### `cancellation_reconciliations`

Replace `bank_result` as compatibility-only and never read/write it from new
modules. Add:

```text
transaction_id
invoice_id
payment_reconciliation_id
classification
provider_event_id
provider_status_reference
source_state
source_state_version
deadline_at
status
evidence_reference
evidence_hash
reconciled_by_account_id
completed_at
created_at
updated_at
```

Internal classification:

```text
WAITING
AUTHORITATIVE
DEFINITIVE_NON_PAID
MISMATCH
UNKNOWN
```

Internal status:

```text
OPEN
COMPLETED
TIMED_OUT
```

- One reconciliation projection per cancellation request.
- One active cancellation reconciliation per transaction.
- Unique `(cancellation_request_id, provider_event_id)` resolution evidence
  prevents one provider event from producing two cancellation outcomes.
- Provider/invoice/event/payment-reconciliation references are restrictive.
- Final classification/source snapshot/evidence is immutable.
- Only `OPEN -> COMPLETED|TIMED_OUT` is allowed.
- A `TIMED_OUT` row remains immutable forever. Later Admin recovery never
  changes its status, classification, evidence, or completion timestamp.
- Recovery appends a `cancellation_provider_resolutions` row, then atomically
  updates the cancellation request decision/lifecycle/manual-review reason and
  guarded transaction state.
- Admin projection combines the original timed-out reconciliation with the
  latest append-only provider resolution; history is not rewritten.

### `cancellation_provider_resolutions`

Append-only fields:

```text
id
cancellation_request_id nullable
transaction_id
invoice_id
payment_reconciliation_id
provider_event_id
source
classification
source_state
source_state_version
resulting_state
correlation_id
idempotency_key
created_at
```

- `cancellation_request_id` may be null only for a late authoritative event on
  a transaction that reached `PAYMENT_EXPIRED` without a cancellation request.
- Unique `provider_event_id` guarantees one cancellation/late-fund outcome per
  immutable provider event.
- All invoice/reconciliation/event/transaction identities must agree.
- Source is `WEBHOOK|GET_STATUS|ADMIN_RECOVERY`.
- Named trigger `cancellation_provider_resolutions_insert_only_guard` rejects
  update/delete.
- Named trigger `cancellation_provider_resolution_identity_guard` rejects
  cross-invoice, cross-transaction, non-canonical event, invalid null request,
  and source-state/version combinations.

### `cancellation_refund_calculations` And Approvals

Calculation fields:

```text
id
cancellation_request_id
version
status
cause
item_amount
shipping_amount
service_fee_amount
buyer_refund_amount
currency
fee_treatment
buyer_account_id
evidence_head_snapshot_hash
calculation_hash
proposed_by_account_id
created_at
decided_at
```

Approval fields:

```text
id
calculation_id
admin_account_id
decision
correlation_id
idempotency_key
created_at
```

- Status is `PENDING|APPROVED|REJECTED`.
- Unique `(request_id, version)` and one pending calculation per request.
- Unique Admin and idempotency key per calculation.
- Two distinct approvals are service/database enforced.
- Final calculation and approvals are immutable.
- Server derives amount and hash; client values are never authoritative.

### `cancellation_financial_handoffs`

Persist every field in `CancellationRefundHandoffSnapshot`.

Constraints:

- source type `FUNDED_CANCELLATION|LATE_FUND`;
- positive amount and `currency='IDR'`;
- Buyer participant/destination composite binding;
- funded source requires request, approved calculation, and authoritative
  provider event; its payment reconciliation reference may be null;
- late-fund source requires canonical payment reconciliation and authoritative
  provider event;
- unique funded handoff per request/calculation;
- unique late-fund handoff per provider event/reconciliation;
- consumed operation FK uses `ON DELETE RESTRICT`;
- source snapshot trigger rejects delete and all update except one atomic claim;
- consumption fields must be both null or both non-null.
- Named trigger `cancellation_funded_handoff_source_guard` applies only to
  `FUNDED_CANCELLATION` and requires request, approved calculation, matching
  invoice authority pointer, source hash, and second-approval timestamp.
- Named trigger `cancellation_late_fund_handoff_source_guard` applies only to
  `LATE_FUND` and requires canonical `LATE_FUND_HANDOFF` reconciliation,
  accepted `settlement + accept`, matching identity/amount/currency,
  deterministic source hash, and unchanged/null invoice authority pointer.
- Named trigger `cancellation_handoff_buyer_binding_guard` rejects wrong
  Buyer/destination, amount, or currency.
- Named trigger `cancellation_handoff_immutable_claim_guard` rejects delete,
  snapshot mutation, partial consumption, and a second operation claim.

### Internal Admin Assignments

Extend `admin_task_assignments_scope_check` with:

```text
CANCELLATION_RECONCILIATION
CANCELLATION_EVIDENCE
CANCELLATION_APPROVAL
```

Existing complaint/risk/release scopes remain unchanged. No account, product
role, or participant-role schema is added.

## Concrete API Contract

Every mutation uses JSON, `Idempotency-Key`, request hash, and
`expectedStateVersion`. Route handlers translate domain errors to sanitized,
stable HTTP responses and append one rejection audit after rollback.

| Route | Actor | Request | Success | Failure/recovery |
| --- | --- | --- | --- | --- |
| `GET /api/transactions/[id]/cancellation` | Buyer/Seller participant | Session | Generic current case, own response summary, deadline, eligible actions, state/version | Unauthorized/missing returns sanitized response; no raw evidence |
| `POST /api/transactions/[id]/cancellation` | Buyer/Seller participant | `cause`, optional note, expected version | Direct final result, pending reconciliation, funded review, or request marked `RISK/REQUIRED` | Never creates risk/complaint case; cutoff, stale, wrong actor, active conflict, hold, processing, terminal rejected/audited |
| `POST /api/transactions/[id]/cancellation/withdraw` | Original requester | reason, expected version | Restores only revalidated prior state or enters manual review | Final decision/handoff/unsafe prior state cannot restore |
| `GET /api/admin/transactions/[id]/cancellation` | Assigned Admin | Session | Sanitized case, history, current evidence heads, provider classification, deadlines, calculation/handoff summary | Missing assignment denied; participant secrets masked |
| `POST /api/admin/transactions/[id]/cancellation/reconcile` | `CANCELLATION_RECONCILIATION` Admin | request ID, expected version | Calls Get Status, persists event, invokes shared resolver with `GET_STATUS` or `ADMIN_RECOVERY` | WAITING/MISMATCH/UNKNOWN remains open/manual; provider failure retry uses same deadline |
| `POST /api/admin/transactions/[id]/cancellation/evidence` | `CANCELLATION_EVIDENCE` Admin | evidence key, source role/account, references/hash, delivery, shipment/response, correction target/reason, expected version | Appends evidence and updates head; may start timer or mark `COMPLAINT/REQUIRED` | Never creates complaint/risk case; wrong group/author/current head/stale state rejected |
| `POST /api/admin/transactions/[id]/cancellation/response-recovery` | `CANCELLATION_EVIDENCE` Admin | request ID, current evidence-head IDs, expected version | Applies only `FUNDED_RESPONSE_TIMEOUT` recovery matrix and appends recovery event | Incomplete/changed evidence, shipped cutoff, hold, operation, wrong reason, or stale version remains manual/rejected |
| `POST /api/admin/transactions/[id]/cancellation/complaint-handoff` | `COMPLAINT_INTAKE` Admin | request ID, current evidence-head IDs, expected version | Atomically creates complaint linkage and `PAYOUT_ON_HOLD` | Wrong delegation/evidence/assignment, risk conflict, stale state, operation, duplicate changed hash rejected |
| `POST /api/admin/transactions/[id]/cancellation/risk-handoff` | `RISK_INTAKE` Admin | request ID, expected version, sanitized evidence reference/hash | Atomically creates active or record-only risk linkage; funded eligible state becomes `RISK_HOLD` | Wrong cause/delegation/assignment, complaint conflict, stale/cutoff/operation rejected |
| `POST /api/admin/transactions/[id]/cancellation/calculations` | `CANCELLATION_APPROVAL` Admin | request ID, current evidence head IDs, expected version | Persists server-derived pending calculation | Missing evidence, shipped/conflict/risk/hold, unsupported cause, changed heads rejected |
| `POST /api/admin/transactions/[id]/cancellation/calculations/[calculationId]/decide` | `CANCELLATION_APPROVAL` Admin | `APPROVED|REJECTED`, expected version | First approval remains pending; second distinct approval creates `REFUND_READY` handoff | Duplicate/self-second/stale/final calculation rejected |
| `POST /api/admin/transactions/[id]/cancellation/reject` | `CANCELLATION_RECONCILIATION` Admin | request ID, reason, expected version | Safe prior state or manual review | Same restoration guard as withdrawal |

Exact handoff/recovery responses expose only:

```ts
type CancellationCommandResult = {
  transactionId: string;
  cancellationRequestId: string;
  transactionState: ApprovedTransactionState;
  stateVersion: number;
  requestStatus: "ACTIVE" | "CLOSED";
  lifecycle: CancellationLifecycle;
  delegationType: "NONE" | "COMPLAINT" | "RISK";
  delegationStatus: "NOT_REQUIRED" | "REQUIRED" | "REFERRED";
  linkedCaseId?: string;
  manualReviewReason?: CancellationManualReviewReason;
  idempotentReplay: boolean;
};
```

Request evidence/reference/hash values are schema-validated and sanitized;
provider facts, calculated amounts, participant snapshots, destination data,
case ownership, and state outcomes are always loaded/derived server-side.
Risk review actions continue through existing assigned Risk routes after
handoff. Complaint agreements continue through existing assigned Complaint
routes after handoff. Financial execution continues through BAYAR-008 routes.

## Deterministic Job Boundary

Create pure/service boundaries:

```ts
addOperatingMinutesWib(start: Date, minutes: number): Date;
runCancellationReconciliationTimeout(now: Date): Promise<number>;
runCancellationResponseTimeout(now: Date): Promise<number>;
```

Local commands:

```text
npm run job:cancellation-reconciliation-timeout
npm run job:cancellation-response-timeout
```

Rules:

- jobs use `SYSTEM:<job-name>` idempotency/correlation scope;
- select candidates, then conditionally mutate by transaction ID, request ID,
  lifecycle, state, state version, and immutable deadline;
- audit only after a successful conditional transition;
- rerun creates no duplicate transition/event;
- timeout never creates provider authority, calculation, financial handoff,
  refund, payout, or notification success;
- BAYAR-012 later schedules commands and escalation reminders.

## Planned Changes

| Step | Change | File/module | Requirement/UX/UI/AC covered | Verification |
| --- | --- | --- | --- | --- |
| 1 | Add migration `0012` and Drizzle schema for cancellation case/event/evidence/reconciliation/calculation/approval/handoff plus new Admin scopes, restrictive FKs, checks, indexes, and immutable triggers. | `src/server/db/schema.ts`, `drizzle/0012_bayar010_cancellation_lifecycle.sql`, `drizzle/meta/_journal.json` | UR-CANCEL-001..025, UR-CAN-OD-001/004/007, UR-BR-047..062, Ticket AC 1-5 | Clean/preflight/rerun/rollback migration tests; direct constraint, delete, mutation, unique-active, and claim tests |
| 2 | Add Zod contracts, cause/state vocabularies, sanitized DTOs, and actor/assignment checks. | `src/server/cancellation/contracts.ts`, `authorization.ts`, `projection.ts`, `http.ts` | UR-CANCEL-001..005/011/014..016/024/025, UI-SCR-021..023, QA-CANCEL-001..004/012..014, QA-SEC-003 | Unit/route tests for role, assignment, validation, masking, unauthorized, stale, and cutoff |
| 3 | Implement direct request, exact ACTIVE/CLOSED lifecycle, immutable delegation requirement/precedence, invitation revocation, invoice retirement, existing-review attachment, cutoff, withdrawal, rejection, and safe restoration. | `src/server/cancellation/service.ts`, `mutation.ts`, `src/server/transaction/audit.ts` | UR-CANCEL-001..004/011/014/024/025, UR-BR-047..050/052/062, UX-FLOW-051..054/061/064/074/075, Ticket AC 1/2/5 | Direct non-risk closed, direct risk operationally active, BAYAR-011 owner lookup, risk-over-complaint precedence, duplicate/concurrent request, stale version, invoice/invite mutation, restoration, and rejection audit |
| 4 | Add total-ordered classifier, shared cancellation resolver, static provider-event orchestration, canonical reconciliation reuse/application, immutable timeout history, and Admin recovery. | `src/server/payment/process-provider-event.ts`, `src/server/cancellation/provider-resolution.ts`, `reconciliation.ts`, `src/server/payment/reconciliation.ts`, `src/server/payment/provider-webhook.ts` | UR-CANCEL-004..008/011..013, UR-CAN-OD-003/008, UR-BR-050..052/059, UX-FLOW-054..058/061..063, QA-CANCEL-003..006, QA-EXP-004 | Table precedence; webhook/Get Status/Admin recovery use one static orchestrator; signature/mismatch/UNKNOWN; timed-out row unchanged; active-review completion function; delayed/out-of-order; no import cycle/revival |
| 5 | Implement cancellation-owned WhatsApp evidence, current heads, correction, timer start, Seller shipment/response, complaint-required projection, response timeout, and explicit late-evidence recovery. | `src/server/cancellation/evidence.ts`, `response-recovery.ts`, `src/server/operations/whatsapp.ts`, `src/server/jobs/cancellation-response-timeout.ts`, runner | UR-CANCEL-015..018, UR-CAN-OD-002..004/008, UR-BR-053..056, UX-FLOW-065..068, UI-SCR-023, QA-CANCEL-007..009 | Correct-group/role, SENT timer, FAILED/UNKNOWN, correction, concurrent head, fixed-clock timeout, late evidence, separate recovery, unchanged deadline, and privacy tests |
| 6 | Implement cause-based server calculation, two-Admin approval, and funded-cancellation handoff creation. | `src/server/cancellation/calculation.ts`, `approval.ts`, `handoff.ts` | UR-CANCEL-019..021, UR-CAN-OD-005/007, UR-BR-057/058, UX-FLOW-069..071, UI-SCR-018/020/023, QA-CANCEL-010/011 | Amount/fee fixtures, destination lock, changed evidence, distinct approvals, rejection, concurrent final decision, immutable/claim tests |
| 7 | Implement branch-specific funded/late-fund predicates and source-neutral immutable handoff without revival or late authority pointer. | `src/server/cancellation/provider-resolution.ts`, `late-fund.ts`, `handoff.ts`, `src/server/payment/process-provider-event.ts` | UR-CANCEL-008..010, UR-BR-035/058/059, UX-FLOW-049/050/058..060, UI-SCR-018/020/022, QA-EXP-004, QA-CANCEL-011 | Funded pointer equality; late pointer unchanged; sourceHash/sourceFinalizedAt; cross-record SQL rejection; duplicate/concurrent/out-of-order callers; exact amount; rollback; no revival; one handoff |
| 8 | Add separate complaint/risk Admin handoffs, immutable risk precedence, source-owned helpers, and request closure only after successful linkage. | `src/server/cancellation/delegation.ts`, `src/server/complaint/service.ts`, `src/server/risk/service.ts` | UR-CANCEL-018/022/023, UR-CAN-OD-006, UR-BR-056/060/061, UX-FLOW-068/072/073, UI-SCR-017/024, QA-CANCEL-009, QA-RISK-001/002 | Wrong/revoked assignment, risk cause plus shipped evidence remains risk, non-risk shipped becomes complaint, ACTIVE owner lookup, atomic close/link, competing handoff, rollback, replay, generic participant status |
| 9 | Add exact participant/Admin request, evidence, recovery, complaint-handoff, and risk-handoff routes with safe error/idempotency handling. | `src/app/api/transactions/[id]/cancellation/**`, `src/app/api/admin/transactions/[id]/cancellation/**` | All Ticket ACs, UR-CANCEL-001..025, QA-CANCEL-001..014, QA-SEC-003/004 | Route integration tests for session, verified WhatsApp, ownership, individual assignment, duplicate, stale/conflicting delegation, timeout recovery, rollback, and masking |
| 10 | Build constrained mobile-width participant entry/status and Admin reconciliation/funded-review UI. | `src/components/transactions/status.tsx`, `src/app/admin/cancellations/page.tsx`, `src/components/admin/cancellation-operations.tsx`, styles only if needed | UI-SCR-017/018/020..024, UX-FLOW-051..075, QA-UI-001/002 | Build plus manual/browser checks for loading, disabled, pending, timeout, unauthorized, UNKNOWN, manual review, recovery, accessibility, and masking |
| 11 | Add deterministic timeout commands and scheduler handoff DTO without production scheduling. | `src/server/domain/time/operating-hours.ts`, `src/server/jobs/cancellation-reconciliation-timeout.ts`, `cancellation-response-timeout.ts`, runners, `package.json` | UR-CANCEL-004/017, UR-CAN-OD-003/008, UR-BR-043/050/055, QA-CANCEL-003/008 | Unit examples, fixed-clock integration, rerun/idempotency, correlation, no financial outcome, boundary DTO tests |
| 12 | Add focused unit, PostgreSQL integration, provider-fake, route, concurrency, privacy, and regression coverage plus execution validation. | `tests/unit/cancellation.test.ts`, `tests/unit/operating-hours.test.ts`, `tests/integration/cancellation*.test.ts`, `docs/execution/BAYAR-010/04-validation.md` | All Ticket ACs and QA IDs | Full test, typecheck, lint, build, Drizzle check, clean migration, migration rerun, PostgreSQL healthcheck, `git diff --check` |

## State And Data Impact

```text
State transitions added/changed:
- WAITING_COUNTERPARTY -> CANCELLED
- WAITING_COUNTERPARTY_DATA -> CANCELLED
- WAITING_BUYER_PAYMENT -> CANCELLATION_PENDING_RECONCILIATION
- PAYMENT_UNDER_REVIEW / PAYMENT_EXCEPTION_REVIEW:
  cancellation request linked without replacing provider review
- CANCELLATION_PENDING_RECONCILIATION -> CANCELLED
- CANCELLATION_PENDING_RECONCILIATION -> FUNDED_CANCELLATION_REVIEW
- CANCELLATION_PENDING_RECONCILIATION -> MANUAL_REVIEW_REQUIRED
- MANUAL_REVIEW_REQUIRED with CANCELLATION_RECONCILIATION_TIMEOUT ->
  FUNDED_CANCELLATION_REVIEW only after authoritative Admin recovery
- MANUAL_REVIEW_REQUIRED with CANCELLATION_RECONCILIATION_TIMEOUT ->
  CANCELLED only after definitive-non-paid Admin recovery
- PAYMENT_CONFIRMED / READY_FOR_FULFILLMENT ->
  FUNDED_CANCELLATION_REVIEW when no shipment/cutoff exists
- FUNDED_CANCELLATION_REVIEW -> REFUND_READY
- FUNDED_CANCELLATION_REVIEW -> PAYOUT_ON_HOLD through complaint delegation
- FUNDED_CANCELLATION_REVIEW -> RISK_HOLD through risk delegation
- FUNDED_CANCELLATION_REVIEW -> MANUAL_REVIEW_REQUIRED on response timeout
- MANUAL_REVIEW_REQUIRED with FUNDED_RESPONSE_TIMEOUT ->
  FUNDED_CANCELLATION_REVIEW only after explicit current-evidence recovery
- PAYMENT_EXPIRED / CANCELLED late authoritative settlement -> REFUND_READY
  without restoring any payment/fulfillment/payout state
- withdrawal/rejection -> exact prior state only when still valid;
  otherwise MANUAL_REVIEW_REQUIRED

Schema/migration impact:
- Additive migration 0012 upgrades legacy cancellation tables.
- Adds immutable cancellation events, evidence/heads, calculation/approval,
  and financial handoff.
- Defines compatibility request status `ACTIVE|CLOSED`; a terminal transaction
  may retain an ACTIVE request only for pending risk delegation.
- Adds internal delegation type/status and manual-review reason projections;
  these are not transaction states or product roles.
- Adds restrictive provider/complaint/risk/participant/destination references.
- Adds three internal Admin assignment scopes.
- Adds append-only/final-state/handoff-claim triggers and partial unique indexes.

Authorization impact:
- Buyer/Seller participant and initiator rules for request/withdraw.
- Admin assignment gates reconciliation, evidence, and calculation approval.
- `CANCELLATION_EVIDENCE` can record evidence/recovery but cannot create a
  complaint/risk case.
- `COMPLAINT_INTAKE` and `RISK_INTAKE` separately gate their handoff routes;
  complaint/risk source modules keep their own decision authority.
- No product role or participant-role change.

Audit/notification impact:
- Success events commit atomically with domain mutation.
- Rejected mutations write one sanitized audit after rollback.
- Provider/evidence/correction/calculation/handoff references are append-only.
- Timed-out reconciliation remains immutable; recovery appears as a later
  append-only provider resolution.
- Notification attempts are not implemented; BAYAR-012 consumes deadlines and
  next-responsible-actor data.

Manual operation impact:
- Admin records external WhatsApp request/responses and Seller statement.
- Admin invokes/reviews Midtrans Get Status reconciliation.
- Admin performs explicit reconciliation/late-evidence recovery after timeout;
  no recovery resets a deadline or creates money movement.
- Assigned Complaint/Risk Admin separately consumes a required handoff.
- Two Admins approve a cancellation refund calculation.
- No Admin records payment authority from a manual bank check.
- No Admin executes refund/payout in BAYAR-010.

Provider integration impact:
- Webhook, Get Status, and Admin recovery statically call
  `src/server/payment/process-provider-event.ts`.
- Funded cancellation requires the normal invoice authority pointer.
- Late-fund resolution never sets or changes the normal invoice authority
  pointer and can only produce `REFUND_READY`.
```

## Test Plan

| Layer | Case | Expected evidence |
| --- | --- | --- |
| Schema/migration | Hard-stop on any legacy cancellation row/`bank_result`, cause/status/classification/delegation checks, restrictive FK, one active case/reconciliation/calculation/handoff, immutable event/evidence/final calculation/handoff, cross-record identity triggers | Migration applies once, leaves no DDL on preflight failure, documents separate remediation/recovery, reruns safely, and rejects invalid/cross-transaction direct SQL |
| Unit | Cause taxonomy and amount calculation | Exact item/shipping/service-fee treatment in integer IDR |
| Unit | Total-ordered Midtrans classifier | Missing identity UNKNOWN; contradictory identity/amount/currency MISMATCH before status; settlement+accept authoritative; terminal non-paid definitive only after validation; pending/capture waiting |
| Unit | Operating-hours helper | 10:00->12:00, 20:30->next 10:30, 22:00->next 11:00 WIB |
| Integration | Direct pre-join cancellation | Initiator succeeds once; invitation revoked; no invoice/refund/financial operation |
| Integration | Direct post-join pre-invoice race | One participant wins; second gets canonical final/conflict; one audit chain |
| Integration | Direct risk lifecycle | Transaction becomes CANCELLED while request remains ACTIVE/RISK_REQUIRED; BAYAR-011 finds source owner; successful intake atomically closes/refers request |
| Integration | Delegation precedence | Risk cause plus shipped evidence remains risk; non-risk shipped evidence selects complaint; referred delegation cannot change; concurrent commands have one winner |
| Integration | Post-invoice cancellation | Invoice retired atomically; one active provider/cancellation reconciliation; deadline immutable |
| Integration | Existing payment review | Request links active review; completion application runs exactly once through shared resolver; preserves deadline; no duplicate reconciliation |
| Integration | Static provider orchestration | Webhook, Get Status, and Admin recovery use `process-provider-event`; one transaction/result; no runtime registry, duplicate resolution, or import cycle |
| Integration | Provider result matrix and resolver callers | All callers converge; definitive non-paid cancels; authoritative enters funded review; waiting/unknown/mismatch does not infer outcome |
| Integration | Reconciliation timeout/recovery | Timeout row remains unchanged; recovery appends provider resolution and atomically updates request/transaction; mismatch/UNKNOWN stays manual; deadline never resets |
| Integration | Funded handoff source | Approved calculation, invoice authority-pointer equality, sourceHash, and second-approval sourceFinalizedAt are enforced |
| Integration | Late provider result | Accepted settlement+accept and LATE_FUND_HANDOFF reconciliation create one REFUND_READY handoff; pointer stays unchanged/null; deterministic sourceHash/time; no revival; cross-record/duplicate/concurrent/out-of-order callers reject or replay |
| Integration | Withdrawal/rejection | Valid prior state restores once; unsafe prior state becomes manual review; direct final result stays final |
| Integration | Funded entry/cutoff | Paid pre-shipment enters funded review; canonical shipment or processing/terminal state rejects |
| Integration | WhatsApp evidence | Correct group/snapshot/author, SENT timer, FAILED/UNKNOWN no transition, separate response heads, correction append-only |
| Integration | Response timeout/recovery | Exactly at/after 24 hours records reason once; late evidence does not reset deadline; separate guarded recovery returns to funded review only with complete current evidence |
| Integration | Refund calculation | Four supported cause fixtures produce exact amount; unsupported/risk causes cannot calculate |
| Integration | Two-Admin approval | One remains pending; second distinct approval creates one handoff; self/duplicate/race rejected |
| Integration | Handoff claim | Correct refund operation claims once; same-operation replay stable; other operation/version/type conflicts |
| Integration | Complaint two-step delegation | Evidence commits and marks required without complaint authority; assigned `COMPLAINT_INTAKE` handoff creates complaint/PAYOUT_ON_HOLD atomically; failure preserves evidence; no adjudication/operation |
| Integration | Risk two-step delegation | Participant cause only marks required; assigned `RISK_INTAKE` creates paid active hold or unfunded record-only case; no cancellation refund/risk decision |
| Authorization/privacy | Participant, creator, individual Admin assignments, revoked/wrong assignment, raw evidence/provider/bank access | No participant/Admin authority inheritance; only permitted actor acts/reads; competing delegation and denial audited; projection remains generic/masked |
| Route | Every mutation, duplicate, stale version, malformed input, provider outage | Stable HTTP result; canonical retry/recovery; no sensitive error detail |
| UI/manual/browser | UI-SCR-021..023 and linked states | Mobile-width desktop layout, labels, focus, loading/error/timeout/UNKNOWN/manual review/recovery, no financial action |
| Regression | BAYAR-004/005/006/007/009/011 | Payment authority, normal WhatsApp, OTP, complaint, and risk tests remain unchanged/passing |
| Static/build | TypeScript, lint, Next build, Drizzle | All commands pass with no new role/state/result |

## Risks And Safeguards

| Risk | Safeguard | Recovery/rollback |
| --- | --- | --- |
| Cancellation and webhook race | Transaction/request/invoice/reconciliation row locks plus expected version and canonical provider event | Losing mutation reloads canonical result; no blind retry |
| Hosted payment remains active | Retire invoice in same transaction as pending cancellation | Reconciliation decides outcome; never create replacement invoice |
| Late settlement revives transaction | Closed-state late-fund branch only permits `REFUND_READY` | Ambiguous event remains reconciliation/manual review |
| Late event becomes normal authority | Branch-specific late-fund trigger forbids authority-pointer mutation | Roll back event outcome; retain reconciliation evidence for recovery |
| Pending/capture treated as no funds | Exact classifier keeps them `WAITING` | Get Status retry within original deadline; timeout manual review |
| Mismatch treated as authority | Total-ordered identity/amount/currency validation before provider status | Keep `MISMATCH`/manual review; no terminal provider branch |
| Evidence overwrite or timer reset | Append-only events/heads and immutable first SENT timestamp | Correction appends; original deadline remains |
| Silence authorizes refund | Timeout reason plus separate evidence and recovery commands | Assigned Admin can recover only under complete current evidence; no calculation/money movement |
| Unsafe prior-state restoration | Fresh provider/deadline/shipment/hold/financial guard | Fall back to manual review, never reactivate blindly |
| Complaint/risk ownership duplicated | Required projection plus separate assignment-gated source-owned helpers | Evidence survives failed handoff; linkage/state mutation rolls back; exact retry is stable |
| Risk request closes before intake | ACTIVE/CLOSED lifecycle constraint and same-transaction risk linkage/closure | Keep ACTIVE owner retryable until assigned Risk Admin succeeds |
| Runtime hook missing in serverless process | Static `process-provider-event` composition used by every caller | Build/integration test fails if any caller bypasses orchestration |
| Duplicate refund execution downstream | Immutable single-consumption handoff | BAYAR-008 same-operation replay; other operation rejected |
| Legacy schema silently misclassified | Hard preflight on every legacy row and `bank_result`; no marker | Stop before DDL and prepare a separate reviewed/audited remediation migration |
| Timezone error | Explicit Asia/Jakarta helper and UTC persistence | Fixed-clock regression fixtures |
| Sensitive data leak | Server-derived projections and sanitized logs/audit/idempotency | Deny request and add privacy regression test |
| Scope leaks into BAYAR-008/012 | Handoff/job service boundaries only | Remove financial/scheduler code before validation |

## Traceability Matrix

| Requirement/flow | Planned steps | Verification |
| --- | --- | --- |
| `UR-CANCEL-001..003`, `UX-FLOW-051..053`, Ticket AC-1 | 1-3, 9-10 | Direct request, role, invitation, duplicate/concurrency, participant UI |
| `UR-CANCEL-004..007`, `UX-FLOW-054..057`, Ticket AC-2/3 | 1, 3-4, 9-11 | Invoice retirement, total-ordered classifier, shared resolver, operating deadline, explicit Admin recovery |
| `UR-CANCEL-008..010`, `UX-FLOW-049/050/058..060` | 1, 4, 7, 9-10 | Static orchestration, branch-specific authority guard, source-neutral hash/time, no pointer mutation/revival, one handoff |
| `UR-CANCEL-011..013`, `UX-FLOW-061..063` | 3-4, 9 | Existing payment review linkage and single-application completion function |
| `UR-CANCEL-014..017`, `UX-FLOW-064..067` | 3, 5, 9-11 | Funded hold, WA evidence, 24-hour timeout reason, late-evidence recovery without deadline reset |
| `UR-CANCEL-018`, `UX-FLOW-068` | 5, 8-10 | Evidence marks complaint required; separately assigned complaint intake performs atomic handoff |
| `UR-CANCEL-019..021`, `UX-FLOW-069..071` | 1, 6, 9-10 | Deterministic calculation, two Admins, refund-ready handoff |
| `UR-CANCEL-022..023`, `UX-FLOW-072..073` | 3, 8-10 | Direct risk request stays ACTIVE as source owner; risk precedence; assigned intake atomically links/closes active or record-only handoff |
| `UR-CANCEL-024..025`, `UX-FLOW-074..075`, Ticket AC-5 | 3, 9-10 | Cutoff, no reversal, safe withdrawal/rejection |
| `UR-CAN-OD-001..008`, `UR-BR-047..062` | 1-12 | Vocabulary, permissions, timers, evidence, destination, risk, concurrency, SLA |
| `QA-CANCEL-001..014`, `QA-EXP-004`, `QA-SEC-003/004/005` | 12 | Executable PostgreSQL/provider/route/privacy suite |
| UI-SCR-017/018/020..024 | 8-10 | Handoff-only complaint/risk/refund states and mobile-width UI |

## Dependencies And Execution Order

```text
Already implemented and consumed:
BAYAR-005 -> Midtrans authority/reconciliation
BAYAR-006 -> canonical WhatsApp group and fulfillment shipment checkpoint
BAYAR-009 -> complaint ownership and financial handoff
BAYAR-011 -> risk ownership and financial handoff

BAYAR-010 implementation order:
1. Migration/schema/vocabularies.
2. Contracts, authorization, event/projection repository.
3. Request/cutoff/withdraw/reject.
4. Provider classifier and reconciliation.
5. Evidence and deadline services.
6. Calculation/approval/handoff.
7. Late-fund handoff.
8. Complaint/risk delegation.
9. Routes and UI.
10. Jobs, tests, migration verification, validation.

Downstream:
BAYAR-008 consumes cancellation/late-fund handoff and moves money.
BAYAR-012 schedules timeout/escalation jobs.
```

## Plan Completion Check

- [x] Every ticket acceptance criterion maps to a change and verification.
- [x] Approved cancellation UX/UI/QA IDs map to exact services, routes, states,
  evidence, and tests.
- [x] Migration number, preflight, order, rollback, rerun, and immutable
  enforcement are concrete.
- [x] Migration hard-stops on every legacy cancellation row without relying on
  an undefined remediation marker.
- [x] Midtrans classifier has total identity/amount/currency/status precedence,
  and all callers use one resolver.
- [x] Existing payment review has an exact completion function; webhook,
  Get Status, and Admin recovery use one static orchestration module.
- [x] Direct risk cancellation remains an ACTIVE BAYAR-011 source owner until
  atomic handoff/closure; risk-over-complaint precedence is deterministic.
- [x] Funded and late-fund handoffs have branch-specific authority-pointer
  guards and source-neutral `sourceHash/sourceFinalizedAt`.
- [x] Actor/status/cutoff and withdrawal/rejection matrices are executable.
- [x] WhatsApp evidence, correction, delivery, timer, and privacy rules are
  explicit without changing BAYAR-006 checkpoint vocabulary.
- [x] Reconciliation and funded-response timeout reasons and recovery matrices
  are executable without resetting deadlines.
- [x] Timed-out reconciliation rows remain immutable; recovery is append-only.
- [x] Cause calculation, rejection versioning, and two-Admin approval are
  deterministic.
- [x] Complaint and risk use separate two-step, assignment-gated handoffs and
  preserve source ownership.
- [x] Cancellation/late-fund handoff contract has named cross-record
  enforcement and is exact and single-use.
- [x] BAYAR-008 financial execution and BAYAR-012 scheduling remain out of scope.
- [x] Product roles, transaction states, and financial results are unchanged.
- [x] Failure, timeout, retry, concurrency, idempotency, audit, privacy,
  responsive, and accessibility verification are covered.
- [x] No unresolved product decision blocks Plan Review.

```text
Plan status: Draft
Next gate: Plan Review using docs/execution/templates/plan-review-template.md
Implementation must not start until Plan Review is Approved.
```
