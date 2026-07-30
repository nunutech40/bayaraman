# Implementation Plan: BAYAR-011

## Task

```text
Ticket ID/title: BAYAR-011 - Admin Risk Hold and Outcome-Neutral Review
Outcome: Allow assigned Admins to record and review an outcome-neutral risk
hold, preserve restricted evidence, and authorize only a Buyer-refund handoff
for later execution by BAYAR-008.
Source research: docs/execution/BAYAR-011/01-research.md
Source review: docs/execution/BAYAR-011/03-plan-review.md
Source requirements:
- UR-CANCEL-022, UR-CANCEL-023
- UR-BR-039, UR-BR-040, UR-BR-045, UR-BR-046, UR-BR-060, UR-BR-061
- UR-CAN-OD-005, UR-CAN-OD-006
Source QA scenarios:
- QA-RISK-001, QA-RISK-002, QA-SEC-003, QA-LAUNCH-001
Source UX Flow and UI IDs:
- UX-FLOW-072, UX-FLOW-073
- UI-SCR-024
Downstream financial context only:
- UR-ADMIN-016..019, UX-FLOW-063..070, UI-SCR-020
Technical boundary: PRD.md v0.2 Approved; TRD.md v1.2 Approved
Version: 0.1
Status: Draft
```

## Scope

### In Scope

- Assigned-Admin intake for prohibited-item, suspected-fraud, policy, or
  manual-review risk.
- One active risk case per eligible transaction.
- Outcome-neutral transition to the existing `RISK_HOLD` state only after
  authoritative payment and before financial processing.
- Record-only risk evidence before authoritative payment, while another
  workflow owns the hold, and after financial processing/terminal status.
- Append-only evidence, correction, review, approval, handoff, and
  post-processing history.
- Internal `RISK_INTAKE`, `RISK_APPROVAL`, and `RELEASE_GATE_REVIEW`
  Admin assignments.
- Participant-safe generic risk status and assignment-gated Admin evidence.
- `KEEP_HOLD`, `CLEAR_TO_MANUAL_REVIEW`, and `BUYER_REFUND` outcomes only.
- Two distinct Admin approvals for `BUYER_REFUND`.
- An immutable, single-consumption Buyer-refund handoff for BAYAR-008.
- A non-transaction release-gate record using
  `OPEN`, `BLOCKED`, and `APPROVED`.
- UI-SCR-024, migration, route, service, privacy, concurrency,
  accessibility, and PostgreSQL integration tests.
- Updating active-risk consumers so inactive and record-only cases do not
  create a permanent false block.

### Out Of Scope

- Seller release, Seller payout, split settlement, or risk-specific
  service-fee decisions.
- Automatic fraud detection, scoring, provider integration, or content
  classification.
- Any financial operation, refund execution, provider retry, money movement,
  or terminal financial result.
- Calling or consuming the risk handoff from BAYAR-011.
- Midtrans payment authority, invoice, webhook, or reconciliation changes.
- Complaint or cancellation adjudication, evidence mutation, or ownership
  replacement.
- Automatic source-state restoration after a risk review.
- Launching a real-money pilot or making its external legal/business decision.
- WhatsApp API, raw message/media storage, OTP, notification scheduling, or
  escalation jobs.
- New product roles, transaction states, or financial results.
- Participant access to risk category, reason, evidence, reviewer, approval,
  amount, destination, or internal decision.
- Assignment-management UI.

## Approved Implementation Decisions

### Canonical Traceability

The engineering ticket now uses `UR-CANCEL-022/023`, `UR-BR-060/061`, and
`UX-FLOW-072/073` as its primary risk contract. `UR-ADMIN-016..019`,
`UX-FLOW-063..070`, and UI-SCR-020 remain downstream context only and cannot
expand BAYAR-011 into refund execution or other money movement.

### Risk Intake Matrix

Every mutation locks the transaction and applicable case, validates
`expectedStateVersion`, assignment, idempotency key, and request hash.

| Category | Source states | Intake behavior | Transaction result | Financial handoff allowed |
| --- | --- | --- | --- | --- |
| Active paid/pre-processing | `PAYMENT_CONFIRMED`, `READY_FOR_FULFILLMENT`, `WAITING_COMPLETION_REPORTS`, `WAITING_OTHER_COMPLETION_REPORT`, `READY_FOR_BUYER_CONFIRMATION`, `WAITING_BUYER_CONFIRMATION`, `BUYER_CONFIRMATION_OVERDUE`, `READY_FOR_PAYOUT`, `MANUAL_REVIEW_REQUIRED` | Create one active outcome-neutral case | `RISK_HOLD` with state-version increment | `BUYER_REFUND` only after approval |
| Pre-authority | `WAITING_COUNTERPARTY`, `WAITING_COUNTERPARTY_DATA`, `WAITING_BUYER_PAYMENT`, `PAYMENT_UNDER_REVIEW`, `PAYMENT_EXCEPTION_REVIEW` | Create `RECORD_ONLY` evidence | No state change | No |
| Existing workflow owner | `PAYOUT_ON_HOLD`, `CANCELLATION_REQUESTED`, `CANCELLATION_PENDING_RECONCILIATION`, `FUNDED_CANCELLATION_REVIEW`, `REFUND_READY` | Create `RECORD_ONLY` evidence linked to the authoritative owner | No state change; owner workflow remains authoritative | No |
| Processing/terminal | `PAYOUT_PROCESSING`, `PAID_OUT`, `REFUND_PROCESSING`, `REFUNDED`, `SPLIT_PROCESSING`, `SPLIT_SETTLED`, `PAYMENT_EXPIRED`, `CANCELLED` | Create `POST_PROCESSING_RECORDED` evidence | No state change or reversal | No |
| Existing active risk | `RISK_HOLD` | Same request replays; explicit evidence route appends new evidence | No state change | Existing case rules |

Additional rules:

- Pre-authority risk evidence does not establish payment authority, cancel an
  invoice, or create refund eligibility.
- A record-only case never becomes active and never creates a handoff.
- Complaint, cancellation, refund, or financial records are never closed,
  replaced, or altered by BAYAR-011.
- Risk cases do not have automatic participant-facing expiry.
- Silence or missing evidence never creates a financial outcome.
- No path restores the original source state automatically.

### Competing Owner Contract

Record-only risk cases use:

```text
source owner type:
  COMPLAINT_CASE
  CANCELLATION_CASE
  REFUND_CASE
  FINANCIAL_OPERATION
  TERMINAL_TRANSACTION
```

- `sourceOwnerType` is required for record-only and post-processing cases.
- `sourceOwnerId` is required when an authoritative owner row exists.
- Service validation resolves the owner from current state and current
  authoritative record before insert.
- Polymorphic owner integrity is service-enforced and covered by integration
  tests; the database stores and indexes `(source_owner_type, source_owner_id)`.
- `TERMINAL_TRANSACTION` uses the transaction ID as `sourceOwnerId`.
- Unknown, missing, stale, or conflicting owner records reject intake and
  create one sanitized audit event.
- Record-only cases expose no review, approval, or handoff routes.
- Participant messaging continues to use the authoritative workflow summary;
  it does not replace complaint/cancellation/refund wording with a fraud label.

### Internal Risk Vocabulary

These are internal domain values, not product roles, transaction states, or
financial results.

```text
case mode:
  ACTIVE_HOLD
  RECORD_ONLY

case lifecycle:
  OPEN
  REVIEW_PENDING_APPROVAL
  REVIEWED_HOLD
  REVIEW_APPROVED
  CLEARED_TO_MANUAL_REVIEW
  RECORD_ONLY
  POST_PROCESSING_RECORDED

event type:
  RISK_RECORDED
  EVIDENCE_CORRECTED
  REVIEW_PROPOSED
  REVIEW_APPROVED
  REVIEW_REJECTED
  HANDOFF_CLAIMED
  POST_PROCESSING_RECORDED

risk category:
  PROHIBITED_OR_POLICY
  SUSPECTED_FRAUD
  OTHER_MANUAL_REVIEW

review outcome:
  KEEP_HOLD
  CLEAR_TO_MANUAL_REVIEW
  BUYER_REFUND

review status:
  PENDING
  APPROVED
  REJECTED

approval decision:
  APPROVED
  REJECTED
```

`OTHER_MANUAL_REVIEW` requires a non-empty note. No category implies guilt,
confirmed fraud, refund, fee, or other financial decision.

### Review State Machine

- A proposal is appended as `PENDING` and must reference the current evidence
  event.
- Only one `PENDING` review may exist per risk case.
- A new review version is allowed only after the preceding review is
  `APPROVED` or `REJECTED` and new/current evidence is referenced.
- `KEEP_HOLD`:
  - One distinct Admin with active `RISK_APPROVAL` may approve.
  - Review becomes `APPROVED`.
  - Case lifecycle becomes `REVIEWED_HOLD`, remains active, and transaction
    remains `RISK_HOLD`.
  - No handoff or financial operation is created.
- `CLEAR_TO_MANUAL_REVIEW`:
  - One distinct Admin with active `RISK_APPROVAL` may approve.
  - Review becomes `APPROVED`.
  - Case lifecycle becomes `CLEARED_TO_MANUAL_REVIEW`, case becomes inactive,
    and transaction changes `RISK_HOLD -> MANUAL_REVIEW_REQUIRED`.
  - State version increments exactly once.
  - No source-state restoration, handoff, or financial operation occurs.
- `BUYER_REFUND`:
  - Only an active case created from the paid/pre-processing state category is
    eligible.
  - Frozen terms and a locked Buyer refund destination are required.
  - Buyer amount equals the frozen Buyer payment total in IDR.
  - The first approval leaves the review `PENDING`.
  - A second approval from another Admin with active `RISK_APPROVAL` changes
    the review to `APPROVED`, case lifecycle to `REVIEW_APPROVED`, case to
    inactive, and transaction `RISK_HOLD -> REFUND_READY`.
  - State version increments and one immutable handoff is created atomically.
- Any authorized rejection changes only a `PENDING` review to `REJECTED`,
  keeps the active case and transaction in `RISK_HOLD`, and creates no
  handoff.
- `APPROVED` and `REJECTED` reviews are immutable.
- Row locks and conditional `status='PENDING'` predicates ensure only one side
  of an approval/rejection race commits.
- Duplicate requests return the saved idempotent result. Reuse with a changed
  request hash is rejected and audited.

### Admin Assignment And Authorization

- Product roles remain Buyer, Seller, and Admin.
- Every restricted route requires `accounts.isAdmin=true` and an active
  internal assignment:
  - `RISK_INTAKE`: create a case and append/correct evidence.
  - `RISK_APPROVAL`: read restricted evidence, propose a review, and approve or
    reject a review.
  - `RELEASE_GATE_REVIEW`: record release-gate evidence and evaluations.
- Assignments are independent rows. An Admin may hold more than one scope.
- A review proposer may approve when they separately hold `RISK_APPROVAL`, but
  cannot satisfy both approvals for `BUYER_REFUND`.
- Revoked, missing, wrong, unknown, or non-Admin assignment is denied.
- Participant reads use transaction ownership and never an Admin assignment.
- Assignment provisioning remains manual/internal. Deterministic test/local
  fixtures seed all three scopes; no assignment-management UI is added.
- Every authorization denial is recorded once through a sanitized audit after
  the rejected domain transaction rolls back.

## Persistence And Migration Contract

Create:

```text
drizzle/0011_bayar011_risk_hold_review.sql
```

and update `src/server/db/schema.ts` plus Drizzle metadata/journal during
implementation.

### `risk_holds`

Expand the existing table with:

```text
category
note
mode
lifecycle
active
source_state
source_state_version
source_owner_type
source_owner_id
current_event_id
current_review_id
updated_at
resolved_at
```

Existing columns `reason`, `evidence_reference`, creator, and timestamps remain
the intake snapshot. Existing nullable `outcome` remains compatibility-only:

- Add a schema comment identifying it as legacy.
- New risk modules never read or write it.
- Preflight rejects any non-null value because authority cannot be inferred.

Constraints and indexes:

- Category, mode, lifecycle, and source-owner vocabularies are checked.
- `OTHER_MANUAL_REVIEW` requires `note`.
- Source version is non-negative.
- Active case requires `mode=ACTIVE_HOLD` and a non-record-only lifecycle.
- Partial unique `risk_holds_one_active_case_unique` on transaction ID where
  active is true.
- Index `(source_owner_type, source_owner_id)`.
- Authority/evidence FKs use `ON DELETE RESTRICT`.
- Replace legacy
  `risk_holds_transaction_id_transactions_id_fk` from `ON DELETE CASCADE`
  to `ON DELETE RESTRICT`.

Named projection trigger:

```text
risk_holds_projection_update_guard
```

It permits service-controlled changes only to:

```text
lifecycle
active
current_event_id
current_review_id
updated_at
resolved_at
```

It rejects changing the source snapshot, creator, category, reason, note,
original evidence, mode, source owner, or source version, and rejects delete.

### `risk_events`

Append-only fields:

```text
id
risk_case_id
event_type
corrected_event_id
actor_account_id
summary_snapshot
evidence_reference
evidence_hash
correction_reason
correlation_id
idempotency_key
created_at
```

- Unique `(risk_case_id, idempotency_key)`.
- Correction requires the target to remain the case's current event.
- Named trigger `risk_events_append_only_guard` rejects update/delete.
- Raw message/media, OTP, provider secrets/signatures, bank values, full
  participant identity, and raw evidence content are not stored.

### `risk_reviews` and `risk_review_approvals`

Reviews store version, status, outcome, Buyer amount, currency, calculation
hash, Buyer destination binding, current evidence, decision note, proposer,
and timestamps.

- Unique `(risk_case_id, version)`.
- Partial unique one pending review per case.
- `KEEP_HOLD` and `CLEAR_TO_MANUAL_REVIEW` require zero Buyer amount and no
  destination.
- `BUYER_REFUND` requires positive frozen total, IDR, and locked destination.
- Named trigger `risk_reviews_final_immutable_guard` allows only
  `PENDING -> APPROVED|REJECTED` plus `decided_at`; final rows reject all
  update/delete.

Approvals store review, Admin, decision, correlation, idempotency key, and
timestamp.

- Unique `(review_id, admin_account_id)`.
- Unique `(review_id, idempotency_key)`.
- Named trigger `risk_review_approvals_append_only_guard` rejects
  update/delete.

### Exact Risk Refund Handoff

```ts
type RiskRefundHandoffSnapshot = {
  handoffId: string;
  riskCaseId: string;
  reviewId: string;
  transactionId: string;
  outcome: "BUYER_REFUND";
  buyerAmount: number;
  currency: "IDR";
  buyerDestinationBindingId: string;
  calculationHash: string;
  evidenceReference: string;
  evidenceHash: string;
  sourceState: "REFUND_READY";
  sourceStateVersion: number;
  approvedAt: string;
  consumedByOperationId: string | null;
  consumedAt: string | null;
};
```

Repository contract in `src/server/risk/handoff.ts`:

```ts
readForUpdate(
  tx: DatabaseTransaction,
  handoffId: string,
  transactionId: string
): Promise<RiskRefundHandoffSnapshot>;

claim(
  tx: DatabaseTransaction,
  input: {
    handoffId: string;
    transactionId: string;
    expectedSourceStateVersion: number;
    parentOperationId: string;
    actorAccountId: string;
    correlationId: string;
  }
): Promise<RiskRefundHandoffSnapshot>;
```

Contract:

- `readForUpdate` uses `SELECT ... FOR UPDATE`.
- `claim` requires the review to remain `APPROVED`.
- Current transaction must be `REFUND_READY` with matching source version.
- Parent `financial_operations` row must belong to the same transaction and
  have type `REFUND`.
- Same `parentOperationId` replay returns the same claimed handoff without
  duplicate event/audit.
- A different operation ID conflicts.
- Unique handoff per review and per risk case.
- `consumed_by_operation_id` references `financial_operations.id` with
  `ON DELETE RESTRICT`.
- Named trigger `risk_financial_handoffs_claim_once_guard`:
  - Rejects delete.
  - Keeps every snapshot field immutable.
  - Allows only a complete null-to-non-null change of both consumption fields.
  - Rejects partial claim, clearing/replacing a consumer, and second claim.
- BAYAR-008 must create the operation, call `claim`, append one
  `HANDOFF_CLAIMED` risk event, and append one transaction audit in the same
  caller-owned database transaction. Rollback restores every effect.
- BAYAR-011 exposes and tests the contract but does not call `claim` or create
  a financial operation.

### Release Gate Aggregate

Use:

```text
release_gates
release_gate_items
release_gate_item_events
release_gate_reviews
```

`release_gates`:

```text
id
gate_key
status
state_version
current_review_id
updated_at
```

`release_gate_items` is current projection only:

```text
id
gate_id
item_key
status
current_event_id
updated_at
```

`release_gate_item_events` is append-only:

```text
id
item_id
status
evidence_reference
external_approver_reference
corrected_event_id
correction_reason
actor_account_id
correlation_id
idempotency_key
created_at
```

`release_gate_reviews` is append-only and stores resulting status,
external decision reference, actor, correlation, gate version, and time.

Rules:

- Only gate key `REAL_MONEY_PILOT`.
- Required fixed item keys:
  `MIDTRANS_SETTLEMENT`, `CUSTODY_FORWARDING`,
  `CONSUMER_DISCLOSURE`, `COMPLAINT_HANDLING`, `DATA_CONTROLS`,
  `PRODUCTION_CREDENTIALS_WEBHOOK`, `REAL_MONEY_PILOT_EVIDENCE`,
  and `LEGAL_COMPLIANCE`.
- Gate and item statuses use only `OPEN`, `BLOCKED`, `APPROVED`.
- Only active `RELEASE_GATE_REVIEW` Admin may mutate.
- Evidence corrections append a new event and atomically move only the current
  pointer. Old evidence cannot be updated/deleted.
- `OPEN -> BLOCKED` when evaluation finds any required item not approved.
- `OPEN|BLOCKED -> APPROVED` only when all fixed items are approved and an
  immutable `externalDecisionReference` is supplied.
- The service records an externally made decision and cannot originate
  legal/compliance approval.
- Gate mutation uses state version, idempotency, correlation, and append-only
  audit.
- Gate tables have no transaction FK and never mutate transaction state.
- Named append-only triggers protect item events and gate reviews.

### Migration Order And Legacy Safety

Migration `0011` runs in one DDL transaction:

1. Preflight all legacy `risk_holds`.
2. Reject duplicates, orphan transaction/Admin references, blank reason,
   non-null legacy outcome, invalid evidence, or unclassifiable rows.
3. Add nullable projection/source columns.
4. Drop the named legacy transaction FK and recreate it with
   `ON DELETE RESTRICT`.
5. Create child event/review/approval/handoff/release tables.
6. Classify and backfill legacy rows without transaction mutation.
7. Insert one immutable risk event per accepted row.
8. Add current-event/current-review FKs after child rows exist.
9. Add indexes, checks, append-only triggers, projection trigger, and handoff
   claim trigger.
10. Finalize defaults/not-null constraints.
11. Add compatibility comments and seed fixed release gate/items.

Legacy classification:

| Current condition | Backfill |
| --- | --- |
| Transaction is `RISK_HOLD`, one valid row | Active `OPEN` case with source snapshot |
| Non-processing/non-terminal state | Inactive `RECORD_ONLY` case |
| Processing/terminal state | Inactive `POST_PROCESSING_RECORDED` case |

The migration never creates a review, approval, handoff, refund eligibility,
or transaction-state mutation.

Tests cover clean, populated, preflight failure, DDL rollback, rerun,
direct update/delete rejection, FK delete restriction, projection mutation
allowlist, and handoff claim enforcement.

## API Contract

Risk routes:

```text
GET  /api/admin/transactions/[id]/risk
POST /api/admin/transactions/[id]/risk
POST /api/admin/transactions/[id]/risk/[riskCaseId]/events
POST /api/admin/transactions/[id]/risk/[riskCaseId]/reviews
POST /api/admin/transactions/[id]/risk/[riskCaseId]/reviews/[reviewId]/decide
GET  /api/transactions/[id]/risk
```

Release-gate routes:

```text
GET  /api/admin/release-gates/real-money-pilot
POST /api/admin/release-gates/real-money-pilot/items/[itemKey]/events
POST /api/admin/release-gates/real-money-pilot/evaluate
```

All Admin mutations require session Admin, exact active assignment,
`Idempotency-Key`, request hash, correlation ID, and expected state/gate
version.

Risk intake accepts category, reason, optional note, evidence reference/hash,
and expected transaction version. Evidence correction accepts the current
event ID, replacement sanitized snapshot/reference/hash, correction reason,
and expected version. Review proposal accepts only the three MVP outcomes,
current evidence event, decision note, and expected version. Decision accepts
`APPROVED` or `REJECTED`.

Release evidence accepts fixed item key, status, evidence reference, external
approver reference, optional correction target/reason, and expected gate
version. Evaluation accepts expected gate version and requires an external
decision reference only for `APPROVED`.

Failure mapping includes unauthenticated, unassigned, forbidden participant,
not found, stale state/gate version, idempotency conflict, duplicate approval,
invalid current evidence, invalid outcome, active competing owner, record-only
review attempt, missing frozen data, immutable final review, and database
conflict.

## Atomic Mutation, Audit, And Projection

- Accepted business mutation, current projection update, event/review,
  approval/handoff, state/version update, idempotency result, and transaction
  audit commit atomically.
- Rejected domain mutation rolls back, then writes exactly one sanitized audit
  with the same correlation ID through `recordRejectedMutationEvent`.
- Audit allows IDs, category, lifecycle, outcome, state/version, and evidence
  reference. It excludes raw reason/evidence, evidence hash, participant data,
  destination value, internal notes, and provider secrets.
- Concurrent intake produces one active case.
- Concurrent correction succeeds only for the current event.
- Review decision locks case, review, and transaction.
- Gate evidence correction locks item/current event; evaluation locks gate and
  all fixed item projections.

Participant projection contains only:

```text
transactionId
status: HOLD_ACTIVE | REVIEW_IN_PROGRESS | AUTHORIZED_ROUTE_RECORDED |
        RECORD_ONLY
summary: "Transaksi sedang ditinjau Admin."
nextResponsibleActor: ADMIN
recordedAt
updatedAt
```

It excludes category, reason, evidence, fraud/policy wording, Admin identity,
assignment, outcome, amount, approval count, destination, and handoff.
Record-only cases under another workflow do not replace that workflow's
participant summary.

Assigned Admin projection exposes only the fields allowed by
`RISK_INTAKE`, `RISK_APPROVAL`, or `RELEASE_GATE_REVIEW`.

## UI-SCR-024 And Accessibility

Create `/admin/risk` in the existing constrained mobile-width web shell.

The screen provides:

- Transaction lookup.
- Risk intake and record-only/active mode.
- Append-only evidence history and correction.
- State version, lifecycle, source owner, and restricted evidence.
- Empty-by-default review outcome selection.
- `KEEP_HOLD`, `CLEAR_TO_MANUAL_REVIEW`, and `BUYER_REFUND` only.
- Frozen Buyer amount/destination eligibility summary for refund.
- Approval/rejection history.
- Read-only handoff availability with no execute button.
- Separate release-gate section for assigned gate reviewers.
- Participant-safe projection preview.

States include loading, empty, error, unauthorized, unassigned, stale,
duplicate, record-only, active hold, pending approval, rejected, reviewed
hold, cleared to manual review, approved refund handoff, immutable conflict,
and recovery.

Accessibility verification includes:

- Keyboard-only operation and logical tab order.
- Programmatic label/description association.
- Focus moves to the first validation error.
- `aria-live` mutation and recovery feedback.
- Hold/approval state is understandable without color.
- Contrast checks.
- No clipping, overlap, or horizontal overflow on mobile and constrained
  desktop widths.

No payout, refund execution, split, Seller release, provider, WhatsApp,
assignment-management, or deployment action is shown.

## Planned Changes

| Step | Change | File/module | Requirement/UX/UI/AC covered | Verification |
| --- | --- | --- | --- | --- |
| 1 | Expand risk schema, assignments, release gate, constraints, and triggers | `src/server/db/schema.ts` | UR-CANCEL-022/023, UR-BR-039/040/046/060/061 | Direct PostgreSQL constraint tests |
| 2 | Add migration preflight, backfill, FK replacement, fixed gate seed, and immutable triggers | `drizzle/0011_bayar011_risk_hold_review.sql`, Drizzle metadata/journal | QA-RISK-001/002, QA-SEC-003, QA-LAUNCH-001 | Clean/populated/failure/rollback/rerun tests |
| 3 | Add risk validation contracts and safe projections | `src/server/risk/contracts.ts` | UX-FLOW-072/073, UI-SCR-024, UR-BR-045 | Zod and forbidden-field tests |
| 4 | Implement intake, owner validation, evidence, review, and approval service | `src/server/risk/service.ts` | UR-CANCEL-022/023, UR-BR-039/040/060/061 | State matrix, authorization, race, audit tests |
| 5 | Implement exact Buyer-refund handoff repository | `src/server/risk/handoff.ts` | Controlled financial handoff to BAYAR-008 | Read/claim/replay/conflict/rollback tests |
| 6 | Implement release-gate evidence and evaluation service | `src/server/release-gate/contracts.ts`, `src/server/release-gate/service.ts` | UR-BR-046, QA-LAUNCH-001 | Assignment, evidence correction, gate-state tests |
| 7 | Add risk and release-gate Admin routes | `src/app/api/admin/transactions/[id]/risk/**`, `src/app/api/admin/release-gates/real-money-pilot/**` | Ticket AC 1-4 | Route validation, denial, idempotency tests |
| 8 | Add participant-safe risk route/projection | `src/app/api/transactions/[id]/risk/route.ts`, risk read service | QA-RISK-001/002, QA-SEC-003 | Participant ownership and masking tests |
| 9 | Update risk guard to use active lifecycle | `src/server/confirmation/service.ts`, shared risk guard | Active hold blocking | Active blocks; inactive/record-only does not falsely block |
| 10 | Add Admin risk/release operational UI | `src/app/admin/risk/page.tsx`, `src/components/admin/risk-operations.tsx` | UI-SCR-024 | State, permission, accessibility, responsive checks |
| 11 | Add deterministic assignment fixtures | PostgreSQL test/local fixture module | Authorization AC | Three assignment scopes work without management UI |
| 12 | Add integration, route, UI, and regression coverage | `tests/risk.integration.test.ts` and relevant tests | All QA/AC IDs | Full validation suite |
| 13 | Record implementation evidence after coding | `docs/execution/BAYAR-011/04-validation.md` | Definition of Done | Commands, evidence, residual risks |

## State And Data Impact

```text
State transitions:
- Eligible paid/pre-processing state -> RISK_HOLD.
- KEEP_HOLD: RISK_HOLD -> RISK_HOLD without version increment.
- CLEAR_TO_MANUAL_REVIEW:
  RISK_HOLD -> MANUAL_REVIEW_REQUIRED with one version increment.
- Approved BUYER_REFUND:
  RISK_HOLD -> REFUND_READY with one version increment.
- All pre-authority, competing-owner, processing, and terminal records:
  no transaction mutation.
- No new transaction state or financial result.

Schema/migration:
- Expand risk_holds while retaining legacy outcome compatibility-only.
- Add risk_events, risk_reviews, risk_review_approvals,
  risk_financial_handoffs, release_gates, release_gate_items,
  release_gate_item_events, and release_gate_reviews.
- Extend Admin assignment check with three internal scopes.
- Replace risk transaction FK cascade with restrict.
- Add preflight, backfill, indexes, checks, and named immutable triggers.

Authorization:
- Product roles remain Buyer/Seller/Admin.
- Restricted actions require exact internal assignment.
- Buyer refund requires two distinct RISK_APPROVAL Admins.
- Participants receive generic status only.

Audit:
- Append intake, correction, proposal, decision, finalization, handoff claim,
  record-only evidence, gate evidence/correction, and gate review.
- Every denial receives one sanitized audit.

Manual boundary:
- Risk investigation and launch decision remain external/manual.
- BayarAman records evidence and authorized results.
- BAYAR-008 alone executes the Buyer refund.
```

## Test Plan

| Layer | Case | Expected evidence |
| --- | --- | --- |
| Static | Strict TypeScript, lint, and production build | `typecheck`, `lint`, and `build` pass |
| Migration | Clean and populated migration | Schema and deterministic backfill succeed |
| Migration | Duplicate, orphan, blank, legacy outcome, rollback, rerun | Unsafe data aborts before DDL; rerun is safe |
| Database | Legacy FK, append-only tables, projection allowlist | Cascade removed; forbidden update/delete rejected |
| Intake | Every state matrix category | Only active, record-only, or post-processing behavior specified above |
| Intake | Concurrent and duplicate active case | One active case; duplicate returns same result |
| Owner | Missing/wrong complaint/cancellation/refund/operation owner | Record-only intake rejected and audited |
| Evidence | Correction, duplicate, concurrent correction | Original remains; one current event; replay safe |
| Authorization | Buyer, Seller, unrelated/revoked Admin | Restricted action/read denied and audited once |
| Privacy | Participant/Admin projections, audit, log, idempotency | No raw evidence, reason, amount, destination, or reviewer leakage |
| Review | `KEEP_HOLD` one approval | Review final, lifecycle reviewed, state unchanged, no handoff |
| Review | `CLEAR_TO_MANUAL_REVIEW` | Case inactive; state/version updated; no handoff |
| Review | Buyer refund first/second approval | First pending; second distinct approval creates one REFUND_READY handoff |
| Review | Same Admin twice, reject race, stale version, invalid destination | No unauthorized finalization; hold preserved |
| Handoff | Read, same-operation replay, competing operation | Lock works; replay same; competing claim rejected |
| Handoff | Wrong operation type/transaction/version | Claim rejected without consumption |
| Handoff | Caller rollback | Operation, claim, event, and audit all roll back |
| Guard | Active, cleared, and record-only cases | Only active case blocks confirmation |
| Release gate | Missing fixed item | Evaluation appends BLOCKED; no transaction mutation |
| Release gate | Evidence correction | New event/current pointer; original immutable |
| Release gate | Complete items without external decision | APPROVED rejected |
| Release gate | Complete items and external decision | APPROVED recorded by assigned Admin; no transaction mutation |
| Route | Missing session/key, malformed body, stale version | Stable status mapping and sanitized denial |
| UI | All functional states | No duplicate action; correct disabled/recovery behavior |
| Accessibility | Keyboard, labels, focus, live region, contrast, non-color | UI-SCR-024 meets approved accessibility guidance |
| Responsive | Mobile and wide desktop constrained shell | No clipping, overlap, or horizontal overflow |
| Regression | Payment, WhatsApp, confirmation, complaint suites | Existing BAYAR-005/006/007/009 behavior remains green |
| Repository | Diff integrity | `git diff --check` passes |

## Risks And Safeguards

| Risk | Safeguard | Recovery/rollback |
| --- | --- | --- |
| Risk outcome grows into payout/split policy | MVP outcome allowlist contains only hold, manual review, and Buyer refund | Reject unknown outcome; require upstream product change for expansion |
| False-positive hold restores stale workflow | Clear only to `MANUAL_REVIEW_REQUIRED`, never source state | Admin reviews through an explicitly approved later workflow |
| Competing case creates two handoffs | Competing owner is record-only and cannot expose review/handoff | Continue authoritative owner workflow |
| Legacy evidence disappears | Restrict FKs and append-only triggers | Preflight abort; repair data before rerun |
| One Admin supplies two refund approvals | Unique review/Admin row and distinct-count under lock | Reject and audit duplicate |
| Handoff is consumed twice | Exact claim contract and named one-time trigger | Same operation replay; other operation conflict |
| Release evidence is overwritten | Append-only item events with current projection pointer | Correct by appending another event |
| Any Admin records launch approval | Require active `RELEASE_GATE_REVIEW` and immutable external decision reference | Keep gate BLOCKED; append corrected external decision evidence |
| Sensitive fraud/evidence details leak | Allowlisted participant DTO and sanitized audit/log/idempotency | Disable restricted response and retain generic participant status |
| Migration number collides before coding | Recheck journal before implementation | Rename plan migration before generating DDL if a committed collision exists |
| BAYAR-008 contract drifts | Typed source-owned handoff and producer/consumer tests | Revise BAYAR-008 plan to consume this exact contract |

## Plan Completion Check

- [x] Engineering ticket traceability uses canonical risk IDs.
- [x] Active risk hold begins only after authoritative payment and before
  financial processing.
- [x] Pre-payment and competing-owner risk evidence is record-only.
- [x] Only `BUYER_REFUND` is a financial risk outcome in MVP.
- [x] Seller release, split, payout, and risk fee policy are excluded.
- [x] Incorrect active hold clears only to `MANUAL_REVIEW_REQUIRED`.
- [x] `KEEP_HOLD` and two-Admin refund review finalization are concrete.
- [x] Risk handoff has an executable atomic producer/consumer contract.
- [x] BAYAR-011 creates no financial operation and moves no money.
- [x] Release-gate authority and append-only evidence are explicit.
- [x] Legacy outcome/FK/backfill/trigger behavior is concrete.
- [x] Participant masking, denial audit, idempotency, concurrency, and
  immutable evidence are testable.
- [x] Accessibility and mobile-width verification are explicit.
- [x] Deterministic fixtures cover all internal assignment scopes.
- [x] No product role, transaction state, financial result, provider
  authority, or automatic risk decision is added.
- [x] Scope remains only BAYAR-011.

Plan remains `Draft` pending repeat Plan Review.
