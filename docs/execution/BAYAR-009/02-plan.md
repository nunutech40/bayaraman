# Implementation Plan: BAYAR-009

## Task

```text
Ticket ID/title: BAYAR-009 - Complaint Hold and External Settlement Recording
Outcome: Record an externally reported complaint, hold an eligible transaction,
record an immutable written-agreement outcome with two distinct Admin approvals,
and publish a single-consumption handoff without adjudicating or moving money.
Source research: docs/execution/BAYAR-009/01-research.md
Source requirements and QA scenarios:
- UR-PARTICIPANT-004, UR-PARTY-004, UR-ADMIN-012, UR-ADMIN-013,
  UR-ADMIN-014, UR-BR-017, UR-BR-018, UR-BR-019, UR-BR-023,
  UR-BR-025, UR-BR-040
- QA-COMPLAINT-001, QA-COMPLAINT-002, QA-COMPLAINT-003,
  QA-COMPLAINT-004, QA-FIN-005, QA-SEC-003
Source UX Flow and UI IDs/states:
- UX-FLOW-035 through UX-FLOW-042
- UI-SCR-017, UI-SCR-018, UI-SCR-019
Technical boundary: PRD.md v0.2 Approved; TRD.md v1.2 Approved
Version: 0.1
Status: Draft
```

## Scope

### In Scope

- Admin-only complaint intake based on a manual WhatsApp report.
- One current pre-processing complaint hold per transaction.
- Record-only complaints after payout/refund/split processing has started.
- Append-only complaint evidence, correction, agreement, approval, and handoff
  history with a current-head projection.
- Participant-safe complaint summary without raw evidence or internal notes.
- Written mutual agreement with exactly one outcome:
  `SELLER_RELEASE`, `BUYER_REFUND`, or `SPLIT`.
- Two distinct Admin approvals for an agreement that authorizes a financial
  route.
- Frozen amount and destination validation before publishing a handoff.
- A source-owned complaint handoff that BAYAR-008 can lock and claim atomically
  once.
- Approved transaction transitions to `PAYOUT_ON_HOLD`,
  `MANUAL_REVIEW_REQUIRED`, `READY_FOR_PAYOUT`, or `REFUND_READY`.
- UI-SCR-017 and read-only eligibility/handoff states for UI-SCR-018/019.
- Migration, service, route, authorization, privacy, concurrency, and
  PostgreSQL integration-test coverage for this ticket.

### Out Of Scope

- Deciding which party is right or interpreting WhatsApp evidence
  automatically.
- WhatsApp API integration, message scraping, or raw message/media storage.
- Payout, refund, split transfer, retry, reconciliation, or financial terminal
  result.
- Creating rows in `financial_operations`.
- Cancellation lifecycle or cancellation handoff; BAYAR-010 owns it.
- Risk review, risk decision, or risk handoff; BAYAR-011 owns it.
- Buyer confirmation OTP or confirmation-exception changes beyond enforcing
  the active complaint guard.
- Notification scheduling and escalation retries; BAYAR-012 owns them.
- New product roles, transaction states, or financial results.
- Reversal of an operation that is processing or already terminal.
- Full implementation of UI-SCR-018/019 money-movement controls.

## Approved Implementation Decisions

### Complaint State Matrix

The complaint mutation always locks the transaction row and validates
`expectedStateVersion`.

| Category | Source state | Intake behavior | Transaction result |
| --- | --- | --- | --- |
| Pre-processing | `PAYMENT_CONFIRMED` | Create active complaint and hold | `PAYOUT_ON_HOLD` |
| Pre-processing | `READY_FOR_FULFILLMENT` | Create active complaint and hold | `PAYOUT_ON_HOLD` |
| Pre-processing | `WAITING_COMPLETION_REPORTS` | Create active complaint and hold | `PAYOUT_ON_HOLD` |
| Pre-processing | `WAITING_OTHER_COMPLETION_REPORT` | Create active complaint and hold | `PAYOUT_ON_HOLD` |
| Pre-processing | `READY_FOR_BUYER_CONFIRMATION` | Create active complaint and hold | `PAYOUT_ON_HOLD` |
| Pre-processing | `WAITING_BUYER_CONFIRMATION` | Create active complaint and hold | `PAYOUT_ON_HOLD` |
| Pre-processing | `BUYER_CONFIRMATION_OVERDUE` | Create active complaint and hold | `PAYOUT_ON_HOLD` |
| Pre-processing | `READY_FOR_PAYOUT` | Create active complaint and hold | `PAYOUT_ON_HOLD` |
| Pre-processing | `MANUAL_REVIEW_REQUIRED` | Create active complaint and hold | `PAYOUT_ON_HOLD` |
| Existing hold | `PAYOUT_ON_HOLD` | Return the current active complaint for a duplicate request; a distinct conflicting complaint is appended to the same case for manual review | No state change |
| Post-processing | `PAYOUT_PROCESSING`, `PAID_OUT`, `REFUND_PROCESSING`, `REFUNDED`, `SPLIT_PROCESSING`, `SPLIT_SETTLED` | Append a `POST_PROCESSING_RECORDED` case/event only | No state change or reversal |
| Ineligible | Every other approved state | Reject with sanitized audit | No state change |

An unresolved active complaint moves `PAYOUT_ON_HOLD` to
`MANUAL_REVIEW_REQUIRED`. The complaint remains active, and financial actions
stay disabled. A later written agreement may still be proposed and approved
against the same case.

### Internal Complaint Vocabulary

These values are complaint-domain metadata, not product roles, transaction
states, or financial results.

```text
case lifecycle:
  OPEN
  NO_AGREEMENT
  AGREEMENT_PENDING_APPROVAL
  AGREEMENT_APPROVED
  POST_PROCESSING_RECORDED

event type:
  COMPLAINT_RECORDED
  EVIDENCE_CORRECTED
  NO_AGREEMENT_RECORDED
  AGREEMENT_PROPOSED
  AGREEMENT_APPROVED
  HANDOFF_CLAIMED
  POST_PROCESSING_RECORDED

agreement outcome:
  SELLER_RELEASE
  BUYER_REFUND
  SPLIT

agreement status:
  PENDING
  APPROVED
  REJECTED

approval decision:
  APPROVED
  REJECTED
```

### Agreement And Amount Rules

- The client submits an agreement proposal, never an authoritative outcome.
- The proposal must reference written mutual agreement by both transaction
  participants and the current complaint evidence event.
- `SELLER_RELEASE` uses the frozen Seller payout destination and the frozen
  item price plus shipping cost. Buyer amount is zero.
- `BUYER_REFUND` uses the frozen Buyer refund destination binding and the
  frozen Buyer payment total. Seller amount is zero. BAYAR-008 may use
  Midtrans Refund API when supported, otherwise the frozen destination is the
  manual fallback; BAYAR-009 does not choose or execute the provider route.
- `SPLIT` accepts proposed Buyer and Seller portions, revalidates both as
  positive IDR minor-unit integers, and requires their sum to equal frozen item
  price plus shipping cost. Service fee remains outside the split pool.
- A server-generated `calculationHash` covers transaction ID, frozen term IDs
  and amounts, currency, outcome, Buyer amount, Seller amount, and destination
  binding IDs.
- Once an agreement receives its first approval, amount, outcome, evidence,
  calculation, and destination bindings are immutable. A rejected or incorrect
  proposal requires a new appended agreement version, not an update.
- A new agreement version starts as `PENDING`. Approval and rejection accept
  only `PENDING`; the first distinct approval leaves it `PENDING`, the second
  changes it to `APPROVED`, and any valid rejection changes it to `REJECTED`.
- `APPROVED` and `REJECTED` are immutable final agreement statuses. Approval
  and rejection lock the agreement/current-case projection and use a
  conditional status predicate, so only one side of a concurrent
  approval-versus-rejection race can win.

### Two-Admin Approval And Assignment

- Product roles remain Buyer, Seller, and Admin.
- `accounts.isAdmin = true` is required for every complaint mutation.
- Add reusable `admin_task_assignments` rows with `id`, `accountId`,
  `taskScope`, `assignedByAccountId`, `assignedAt`, and nullable `revokedAt`.
- BAYAR-009 recognizes only:
  - `COMPLAINT_INTAKE`: intake, evidence append/correction, no-agreement record,
    and agreement proposal.
  - `COMPLAINT_APPROVAL`: agreement approval/rejection and raw evidence review.
- A partial unique index on `(account_id, task_scope) WHERE revoked_at IS NULL`
  named `admin_task_assignments_active_scope_unique` permits one active row per
  Admin/scope. Check `admin_task_assignments_scope_check` permits only the two
  BAYAR-009 scopes. An account can hold both scopes in separate rows.
- Assignment authorization always verifies `accounts.isAdmin = true`;
  non-Admin, missing, revoked, null, unknown, or unrelated assignments are
  denied. Assignment provisioning remains an internal/manual boundary with no
  management UI in this ticket.
- `accounts.adminTaskAssignment` remains compatibility-only and is not an
  authority source for the new complaint module.
- Two distinct accounts with `COMPLAINT_APPROVAL` must approve the same
  immutable agreement version. A proposer may approve only when that account
  also has a separate active `COMPLAINT_APPROVAL` row, but cannot satisfy both
  approvals.
- A rejection is append-only, leaves the transaction held, prevents handoff
  publication for that agreement version, and requires a new proposal.
- Participant-facing reads require transaction participation but never an
  Admin assignment.

### Outcome And Handoff Matrix

The second valid approval locks the complaint case, current agreement, and
transaction; validates expected state/version; appends the second approval;
derives the target state; conditionally updates the transaction and increments
its state version; creates the handoff using that resulting state/version;
appends the agreement event and audit; and saves the idempotent result in one
PostgreSQL transaction.

| Outcome | Required current state | Destination requirement | Transaction result and handoff `sourceState` | Handoff snapshot |
| --- | --- | --- | --- | --- |
| `SELLER_RELEASE` | `PAYOUT_ON_HOLD` or `MANUAL_REVIEW_REQUIRED` | Frozen/locked Seller payout destination | `READY_FOR_PAYOUT` | Resulting incremented state version, Seller amount, and Seller destination binding |
| `BUYER_REFUND` | `PAYOUT_ON_HOLD` or `MANUAL_REVIEW_REQUIRED` | Frozen/locked Buyer refund destination | `REFUND_READY` | Resulting incremented state version, Buyer amount, and Buyer destination binding |
| `SPLIT` | `PAYOUT_ON_HOLD` or `MANUAL_REVIEW_REQUIRED` | Both frozen/locked destinations | `PAYOUT_ON_HOLD` | Resulting incremented state version, Buyer/Seller portions, both bindings, and calculation hash |

`SETTLEMENT_READY` is not introduced. It remains a UX label for an approved
agreement/handoff. No path creates `PAID_OUT`, `REFUND_PROCESSING`,
`REFUNDED`, `SPLIT_PROCESSING`, or `SPLIT_SETTLED`.

Only the current agreement version may finalize. Finalization locks the case
and requires unique indexes
`complaint_financial_handoffs_agreement_unique` on `agreement_id` and
`complaint_financial_handoffs_case_unique` on `complaint_case_id`, so rejected
versions may be replaced but one case can never publish two final routes.

### Atomic Handoff Contract For BAYAR-008

`complaint_financial_handoffs` is owned by BAYAR-009. One approved agreement
version produces one immutable handoff.

```ts
type ComplaintHandoffSnapshot = {
  handoffId: string;
  complaintCaseId: string;
  agreementId: string;
  transactionId: string;
  outcome: "SELLER_RELEASE" | "BUYER_REFUND" | "SPLIT";
  buyerAmount: number;
  sellerAmount: number;
  currency: "IDR";
  calculationHash: string;
  buyerDestinationBindingId: string | null;
  sellerDestinationBindingId: string | null;
  evidenceReference: string;
  evidenceHash: string;
  sourceState: string;
  sourceStateVersion: number;
  approvedAt: string;
  consumedByOperationId: string | null;
  consumedAt: string | null;
};

readForUpdate(
  tx: DatabaseTransaction,
  handoffId: string,
  transactionId: string
): Promise<ComplaintHandoffSnapshot>;

claim(
  tx: DatabaseTransaction,
  input: {
    handoffId: string;
    transactionId: string;
    expectedSourceStateVersion: number;
    parentOperationId: string;
  }
): Promise<ComplaintHandoffSnapshot>;
```

- `readForUpdate` uses `SELECT ... FOR UPDATE`.
- `sourceState` and `sourceStateVersion` are the post-approval transaction
  state and resulting incremented version. `readForUpdate` and `claim` compare
  transaction ID, current transaction state/version, handoff source
  state/version, agreement `APPROVED` status, and consumption state.
- `claim` conditionally updates only when both consumption fields are null,
  the source snapshot remains current, and destination/calculation bindings
  remain unchanged.
- Trigger `complaint_financial_handoffs_claim_once_guard` permits exactly one
  update: `consumed_by_operation_id` and `consumed_at` must change together
  from null to non-null, the referenced operation must belong to the same
  transaction, and every other handoff field must remain identical. It rejects
  partial claim, snapshot mutation, consumer replacement/clearing, second
  claim, and every delete.
- BAYAR-008 must create the parent operation, lock and claim the handoff,
  append one sanitized `HANDOFF_CLAIMED` complaint event, and append one audit
  event in the same caller-owned database transaction. Rollback restores all
  four effects.
- Replaying the same `parentOperationId` returns the same claimed handoff.
  It does not duplicate the complaint event or audit. Another operation ID
  receives a conflict.
- `consumed_by_operation_id` references `financial_operations.id` with
  `ON DELETE RESTRICT`; it is nullable until BAYAR-008 claims the handoff.
- Complaint case, event, agreement, approval, handoff, and consumed-operation
  authority references use `ON DELETE RESTRICT`. Handoff snapshot fields are
  immutable from insert; after the permitted one-time claim, the entire row is
  immutable.
- BAYAR-009 exposes this repository contract but does not call it during
  complaint approval and does not create the parent operation.

### Safe Legacy Complaint Classification

Migration `0010` runs preflight before DDL and classifies every existing
`complaint_holds` row from its current transaction state:

| Existing transaction state | Backfilled lifecycle | Active | Backfilled event | Transaction mutation |
| --- | --- | --- | --- | --- |
| `PAYMENT_CONFIRMED`, `READY_FOR_FULFILLMENT`, `WAITING_COMPLETION_REPORTS`, `WAITING_OTHER_COMPLETION_REPORT`, `READY_FOR_BUYER_CONFIRMATION`, `WAITING_BUYER_CONFIRMATION`, `BUYER_CONFIRMATION_OVERDUE`, `READY_FOR_PAYOUT` | `OPEN` | Yes | `COMPLAINT_RECORDED` | None |
| `PAYOUT_ON_HOLD` with one row and null legacy outcome | `OPEN` | Yes | `COMPLAINT_RECORDED` | None |
| `MANUAL_REVIEW_REQUIRED` with one row and null legacy outcome | `NO_AGREEMENT` | Yes | `NO_AGREEMENT_RECORDED` | None |
| `PAYOUT_PROCESSING`, `PAID_OUT`, `REFUND_PROCESSING`, `REFUNDED`, `SPLIT_PROCESSING`, `SPLIT_SETTLED` | `POST_PROCESSING_RECORDED` | No | `POST_PROCESSING_RECORDED` | None |

Preflight aborts before DDL for duplicate active cases, orphan transaction or
account references, non-null/unmappable legacy outcomes, unsupported states,
invalid evidence/reference, inconsistent state version, or any row that cannot
be classified deterministically. Every accepted row creates exactly one case,
one immutable event, one current-event pointer, and a source state/version
snapshot. No backfill changes transaction state.

### Participant-Safe Projection

Participant-facing complaint status is restricted to:
`HOLD_ACTIVE`, `MANUAL_REVIEW`, `AGREEMENT_RECORDED`, and
`POST_PROCESSING_RECORDED`.

The DTO contains only `transactionId`, public complaint status, generic
summary, next responsible actor, `recordedAt`, and `updatedAt`. It excludes
outcome amounts, evidence references/hashes, Admin identity/assignment,
approval count, internal notes, destination IDs, agreement calculations, and
handoff consumption. Assigned Admin projections may read the raw operational
fields allowed by their active task scope.

## Planned Changes

| Step | Change | File/module | Requirement/UX/UI/AC covered | Verification |
| --- | --- | --- | --- | --- |
| 1 | Add transactional migration `drizzle/0010_bayar009_complaint_handoff.sql`. Run the explicit legacy-classification preflight before DDL; extend `complaint_holds` as the current case projection; add `complaint_events`, versioned/status-constrained `complaint_agreements`, append-only `complaint_agreement_approvals`, `complaint_financial_handoffs`, and normalized `admin_task_assignments`; create one immutable event/head per accepted legacy row. Replace complaint authority cascades with `ON DELETE RESTRICT`. | `src/server/db/schema.ts`, `drizzle/0010_bayar009_complaint_handoff.sql`, `drizzle/meta/_journal.json` | Ticket AC 1-4; UR-BR-017..019, UR-BR-025, UR-BR-040; QA-COMPLAINT-001..004, QA-SEC-003; TRD Sections 9-10 | Clean migration, every backfill class, unsupported/duplicate/orphan/outcome preflight failure before DDL, rollback/recovery, rerun, restrictive-delete, schema, and journal tests. |
| 2 | Add named checks/indexes for case lifecycle, event type, agreement status/outcome, approval decision, assignment scope, one active case, current agreement version, one active assignment per Admin/scope, one approval per Admin/version, unique handoff by both agreement and case, and one consumer operation. Add append-only event/approval/final-agreement triggers and `complaint_financial_handoffs_claim_once_guard`, which permits only the atomic null-to-non-null consumption transition while all snapshot fields remain unchanged. | Migration and `src/server/db/schema.ts` | UR-ADMIN-014, UR-BR-019, UR-BR-025, UR-BR-040; QA-COMPLAINT-001..003, QA-SEC-003 | Invalid vocabulary, duplicate case/version/assignment/approval/handoff, delete before/after claim, partial claim, changed-snapshot claim, reassign/clear/second claim, same-parent replay, and concurrent claim tests. |
| 3 | Define Zod mutation contracts, normalized task-scope authorization, sanitized errors, and separate Admin/participant projections. Client input cannot supply state, authoritative participant identity, frozen amount/destination, approval completion, or consumption. Participant status uses only the four approved public complaint values and six safe DTO fields. | `src/server/complaint/contracts.ts`, `src/server/complaint/projection.ts`, `src/server/auth/authorization.ts` | UR-PARTICIPANT-004, UR-PARTY-004, UR-ADMIN-012..014; UI-SCR-017; QA-SEC-003 | Tests for intake-only, approval-only, both scopes, revoked/missing/unknown assignment, non-Admin assignment row, malformed input, participant ownership, masking, and forbidden fields. |
| 4 | Implement complaint intake with exact state matrix, `Idempotency-Key`, request hash, transaction/case row locks, `expectedStateVersion`, append-only event, current-head update, conditional transaction transition, and atomic audit. Duplicate input replays the original result; a conflicting request is rejected and audited. | `src/server/complaint/service.ts`, `src/server/complaint/mutation.ts`, `src/server/transaction/audit.ts` | Ticket AC-1; UR-ADMIN-012, UR-BR-017, UR-BR-023, UR-BR-025; UX-FLOW-035; QA-COMPLAINT-001 | Integration tests for each eligible state, ineligible state, duplicate/conflict, concurrent intake, stale state version, state/audit atomicity, and no automatic WA parsing. |
| 5 | Implement append-only evidence correction and current-head projection. A correction must target the current event, reference the prior event, include a reason and new sanitized snapshot hash, append a new event, and atomically move only the head. It never repeats a transaction transition. | `src/server/complaint/evidence.ts`, `src/server/complaint/service.ts` | UR-ADMIN-012, UR-ADMIN-014, UR-BR-023, UR-BR-025; UI-SCR-017; QA-COMPLAINT-001, QA-SEC-003 | Original evidence remains, current head changes once, stale correction rejects, duplicate replay, concurrent correction, immutable trigger, and raw-data leakage tests. |
| 6 | Implement no-agreement recording. Require an active pre-processing case and current evidence, append `NO_AGREEMENT_RECORDED`, set lifecycle `NO_AGREEMENT`, and conditionally move `PAYOUT_ON_HOLD` to `MANUAL_REVIEW_REQUIRED`. Preserve active hold semantics and create no agreement, handoff, or financial operation. | `src/server/complaint/service.ts`, `src/server/complaint/read.ts` | Ticket AC-2; UR-PARTY-004, UR-ADMIN-013, UR-BR-018; UX-FLOW-036..037; UI-SCR-017; QA-COMPLAINT-002, QA-COMPLAINT-004 | No-agreement integration test, duplicate/retry, stale state, payout/confirmation-exception disabled, no financial row, and participant summary test. |
| 7 | Implement versioned written-agreement proposal. Resolve participant snapshots server-side, validate mutual written evidence, derive frozen amounts/destinations, enforce the three calculations, append proposal event, set agreement status `PENDING`, and atomically make it the case's current version. Rejected versions may be replaced; approved versions are final. | `src/server/complaint/agreement.ts`, `src/server/complaint/calculation.ts` | Ticket AC-3; UR-ADMIN-014, UR-BR-019; UX-FLOW-038; UI-SCR-017..019; QA-COMPLAINT-003, QA-FIN-005 | Each outcome, missing agreement, invalid evidence/destination/amount, split total, altered terms, rejected-then-new version, concurrent proposal versions, and immutable final version tests. |
| 8 | Implement two-Admin approval/rejection with locked case/agreement/transaction rows and conditional `PENDING` status. First distinct approval remains pending; second atomically updates the transaction, increments version, marks agreement approved, publishes the only case handoff with resulting state/version, appends events/audit, and saves idempotency. Rejection atomically marks the version rejected; approval-versus-rejection and competing-version races have one winner. | `src/server/complaint/approval.ts`, `src/server/complaint/handoff.ts` | Ticket AC-3; UR-ADMIN-014, UR-BR-019, UR-BR-025, UR-BR-040; UX-FLOW-038..042; QA-COMPLAINT-003, QA-FIN-005, QA-SEC-003 | First/second approval, same Admin, task scopes, rejection, duplicate, approval/rejection race, two-version race, post-approval state/version, outcome/case uniqueness, stale mutation, and no financial operation tests. |
| 9 | Implement source-owned `ComplaintFinancialHandoffRepository`. `readForUpdate` and `claim` validate the current post-approval state/version and approved agreement. Claim permits the one guarded consumption update, requires same-transaction parent operation, and atomically appends one `HANDOFF_CLAIMED` event/audit in the caller transaction. Same-parent replay is stable; different parent conflicts. | `src/server/complaint/handoff.ts`, `src/server/complaint/types.ts` | Ticket AC-3; UR-BR-019, UR-BR-020, UR-BR-025, UR-BR-040; QA-COMPLAINT-003, QA-FIN-005 | Fixture parent operation, current/stale source, unrelated mutation, wrong state/version/transaction, atomic rollback, restrictive delete, direct trigger tests, event/audit uniqueness, replay, different-parent conflict, and concurrent claim. |
| 10 | Change hold consumers to query the current active complaint projection rather than any historical row. Active cases block confirmation exception and future financial eligibility; approved/resolved historical cases do not masquerade as a new hold. | `src/server/confirmation/service.ts`, `src/server/complaint/read.ts` | Ticket AC-2; UR-ADMIN-012, UR-PARTY-004, UR-BR-017; UX-FLOW-035..037; QA-COMPLAINT-002 | Confirmation link/exception guard tests for open, no-agreement, approved handoff, post-processing record, and historical corrected events. |
| 11 | Add exact API routes: Admin list/detail, complaint intake, event/correction, no-agreement, agreement proposal, and agreement approval; plus a participant summary route. Require server session, assignment, transaction ownership where applicable, `Idempotency-Key`, and `expectedStateVersion`. Raw tokens, WhatsApp content, bank values, and internal approval notes never enter logs or participant DTOs. | `src/app/api/admin/transactions/[id]/complaints/route.ts`, `src/app/api/admin/transactions/[id]/complaints/[complaintId]/route.ts`, `events/route.ts`, `no-agreement/route.ts`, `agreements/route.ts`, `agreements/[agreementId]/approve/route.ts`, `src/app/api/transactions/[id]/complaint/route.ts` | All ticket AC; UI-SCR-017; QA-COMPLAINT-001..004, QA-SEC-003 | Route tests for authentication, assignment, participant ownership, duplicate, stale version, invalid state, masking, sanitized errors, and recovery. |
| 12 | Build the mobile-width Admin complaint screen for intake, evidence history/correction, no-agreement, agreement proposal, two-Admin approval status, and handoff eligibility. Participant transaction status shows only hold/manual-review/approved-route summary. UI-SCR-018/019 expose disabled or eligible handoff messaging only; no transfer action is built. | `src/app/admin/complaints/page.tsx`, `src/components/admin/complaint-operations.tsx`, `src/components/transactions/status.tsx`, related styles | UI-SCR-017..019; UX-FLOW-035..042; QA-COMPLAINT-001..004, QA-SEC-003 | Manual/browser checks for loading, empty, disabled, unauthorized, stale, conflict, success, manual review, approval pending, approved handoff, participant masking, keyboard/focus, and desktop mobile-width layout. |
| 13 | Add unit, PostgreSQL integration, route, concurrency, privacy, and regression suites. Document execution evidence in BAYAR-009 validation after implementation. | `tests/unit/complaint.test.ts`, `tests/integration/complaint.test.ts`, `tests/integration/complaint-authorization.test.ts`, `tests/integration/complaint-handoff.test.ts`, `docs/execution/BAYAR-009/04-validation.md` | All acceptance criteria and QA-COMPLAINT-001..004, QA-FIN-005, QA-SEC-003 | `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, clean/rerun migration, `npm run db:status`, PostgreSQL healthcheck, and `git diff --check`. |

## State And Data Impact

```text
State transitions added/changed:
- Eligible pre-processing state -> PAYOUT_ON_HOLD when Admin records complaint.
- PAYOUT_ON_HOLD -> MANUAL_REVIEW_REQUIRED when no agreement is recorded.
- PAYOUT_ON_HOLD or MANUAL_REVIEW_REQUIRED -> READY_FOR_PAYOUT after two
  Admin approvals of SELLER_RELEASE.
- PAYOUT_ON_HOLD or MANUAL_REVIEW_REQUIRED -> REFUND_READY after two Admin
  approvals of BUYER_REFUND.
- PAYOUT_ON_HOLD or MANUAL_REVIEW_REQUIRED -> PAYOUT_ON_HOLD after two Admin
  approvals of SPLIT; the approved handoff, not a new state, expresses
  split readiness.
- Post-processing complaints append evidence without changing state.
- No state in BAYAR-009 becomes PAID_OUT, REFUND_PROCESSING, REFUNDED,
  SPLIT_PROCESSING, or SPLIT_SETTLED.

Schema/migration impact:
- Additive migration 0010 after the current BAYAR-007 migration 0009.
- Run deterministic preflight/backfill classification; accepted legacy rows
  receive one case/event/head, post-processing rows stay inactive, and
  ambiguous/unsupported rows abort before DDL.
- Extend complaint_holds as current case projection without deleting or
  rewriting original summary/evidence.
- Add complaint_events, complaint_agreements,
  complaint_agreement_approvals, complaint_financial_handoffs, and
  admin_task_assignments.
- Add partial unique index for one active pre-processing complaint per
  transaction and one active Admin task scope; vocabulary checks;
  current-head/current-agreement/approval indexes; unique agreement and case
  handoff constraints; append-only/final-state triggers; one-time claim guard;
  and `ON DELETE RESTRICT` authority foreign keys.
- Migration preflight checks duplicate active complaints, non-null/unmappable
  legacy outcomes, unsupported states, invalid evidence, inconsistent versions,
  orphan references, and transaction/account IDs before DDL.
- If preflight fails, migration aborts before DDL and reports the conflicting
  IDs for manual repair. Migration is transactional and rerunnable after repair.

Authorization impact:
- Product roles remain Buyer, Seller, Admin.
- `isAdmin` plus an active normalized `COMPLAINT_INTAKE` or
  `COMPLAINT_APPROVAL` assignment is required according to the operation.
- One Admin may hold both scopes in separate rows; two agreement approvals must
  still use distinct Admin accounts with active approval scope.
- The legacy account assignment text is compatibility-only.
- Buyer/Seller may only read the transaction-scoped masked summary.
- Two approvals must be from distinct assigned Admin accounts.
- No Admin can replace participant-authored frozen financial destinations.

Audit/notification impact:
- Append sanitized events for intake, correction, no agreement, proposal,
  approval/rejection, handoff publication, post-processing record, denied
  authorization, stale state, claim success, and claim conflict.
- Audit stores IDs, actor, source/result state, state version, correlation ID,
  evidence reference/hash, and outcome; never raw WhatsApp content/media,
  raw bank values, secrets, OTP, or provider payload.
- Parent financial operation insertion, handoff claim, `HANDOFF_CLAIMED`
  complaint event, and claim audit commit or roll back together in the
  BAYAR-008 caller transaction.
- Notification intent may be emitted after committed state changes, but
  notification delivery failure never rolls back trusted state.
- Scheduling, retry, and escalation delivery remain BAYAR-012.

Manual operation impact:
- Buyer and Seller negotiate and produce written agreement outside BayarAman.
- Assigned Admin records references and outcome; BayarAman does not adjudicate.
- BAYAR-009 publishes authority only. BAYAR-008 separately performs any
  payout, refund, or split after its own authorization and re-auth controls.
```

## Test Plan

| Layer | Case | Expected evidence |
| --- | --- | --- |
| Static/lint/type | Zod contracts, assignment vocabulary, DTO privacy, repository interface, and route types | Typecheck/lint pass; no new role/state/result; raw evidence and destination types absent from participant DTO |
| Migration | Clean database from 0009; every eligible/hold/post-processing legacy class; ambiguous outcome/state, orphan, invalid evidence/version, and duplicate preflight; rerun and rollback | Migration applies once, accepted rows receive correct case/event/head/source snapshot, preflight fails before DDL, historical evidence remains, journal/status clean |
| Database constraints | Active-case/assignment uniqueness, vocabulary checks, approval and case/agreement handoff uniqueness, approval/rejection finality, append-only triggers, one-time claim guard, restrictive FKs | Direct SQL invalid writes fail; only the complete null-to-non-null claim is allowed; final authority cannot update/delete |
| Service/integration | Every pre-processing state and post-processing state in the matrix | Pre-processing becomes one hold; post-processing remains unchanged and record-only |
| Service/integration | No agreement | `MANUAL_REVIEW_REQUIRED`, active hold retained, no handoff/financial operation |
| Service/integration | Seller release, Buyer refund, and split proposals | Frozen calculations and destination bindings match; exactly one outcome/version accepted |
| Authorization | Intake-only, approval-only, both scopes, revoked/missing/unknown assignment, non-Admin assignment row, same Admin twice, participant mutation/read | Mutations denied and audited as appropriate; two distinct approvers required; summary read is masked |
| Idempotency/concurrency | Duplicate/conflicting intake, correction, proposal, approval/rejection race, competing agreement versions, second approval, and handoff claim | Same request replays; request-hash conflict rejects; only one case/final agreement/handoff/claim wins |
| State safety | Correct post-approval snapshot, stale handoff after unrelated mutation, wrong source state/version, complaint during financial processing | Conditional update rejects stale writes; published snapshot matches resulting state/version; processing state never reverses |
| Evidence/privacy | Correction chain, raw evidence, internal notes, bank values | Old evidence retained; current head correct; sensitive fields absent from logs/audit/participant response |
| Handoff contract | Complete/partial/tampered claim, read/claim/rollback/replay, event/audit uniqueness, and delete restriction | One same-transaction parent claims once; same-parent replay is stable; operation/claim/event/audit rollback together; source remains retained |
| Regression | Confirmation active-hold guard and approved historical complaint | Unresolved case blocks exception; resolved historical events do not create a false new hold |
| UI/manual | UI-SCR-017 and handoff summary states | Loading/error/stale/approval/manual-review states work, accessible mobile-width layout, no money action |
| Full validation | Repository scripts and PostgreSQL OrbStack | Tests, typecheck, lint, build, migration/status, DB health, and diff check pass |

## Risks And Safeguards

| Risk | Safeguard | Recovery/rollback |
| --- | --- | --- |
| Historical complaint row permanently blocks a resolved transaction | Deterministic preflight/backfill matrix plus current active-case projection | Abort ambiguous migration; repair reported row and rerun; rebuild projection from immutable event |
| Two conflicting financial outcomes become actionable | Locked current version, conditional `PENDING` decision, two distinct Admins, unique handoff by agreement and case | Reject losing approval/rejection/version race; leave transaction held and append audit |
| Handoff is consumed twice or tampered during claim | Resulting state/version snapshot, row lock, one-time claim trigger, same-transaction operation check, same-parent replay | Roll back operation/claim/event/audit together; reconcile by handoff/operation IDs |
| Evidence correction overwrites history | Append-only events plus current head and database trigger | Restore head to a valid event through a new correction event |
| Complaint reverses in-flight money movement | Explicit post-processing record-only matrix | Keep financial state unchanged and route follow-up outside this ticket |
| Admin assignment is bypassed | Server-side `isAdmin` plus active normalized scope on every mutation/raw read; legacy text ignored | Deny, append sanitized audit, and provision/revoke assignment row |
| Client controls amount/destination/outcome authority | Re-derive terms, participants, locked destinations, calculation hash, and allowed outcome server-side | Reject proposal and preserve active hold |
| Migration collides with legacy data | Preflight before DDL and transactional migration | Repair reported rows, rerun migration; no partial DDL remains |
| BAYAR-008 draft expects a read-only or generic handoff | Publish explicit complaint source adapter with atomic claim contract | BAYAR-008 plan must consume this contract and renumber its migration after BAYAR-009/BAYAR-011 |
| Participant projection leaks settlement/evidence detail | Closed public status vocabulary and allowlisted DTO fields | Reject serialization regression in contract tests; participant receives generic status only |
| Scope leaks into cancellation, risk, or transfer execution | Source-specific complaint modules and tests asserting no financial operation creation | Revert unrelated implementation before validation; keep downstream dependency explicit |

## Traceability Matrix

| Source | Plan coverage | Verification |
| --- | --- | --- |
| `UR-ADMIN-012`, `UR-BR-017`, `UX-FLOW-035` | Steps 4, 10-12 | QA-COMPLAINT-001 |
| `UR-PARTY-004`, `UX-FLOW-036` | Steps 6, 10, 12 | QA-COMPLAINT-002 |
| `UR-ADMIN-013`, `UR-BR-018`, `UX-FLOW-037` | Step 6 | QA-COMPLAINT-004 |
| `UR-ADMIN-014`, `UR-BR-019`, `UX-FLOW-038` | Steps 7-9 | QA-COMPLAINT-003 |
| `UX-FLOW-039` seller release | Steps 7-9 | `READY_FOR_PAYOUT`, handoff only, no `PAID_OUT` |
| `UX-FLOW-040..041` Buyer refund | Steps 7-9, 12 | `REFUND_READY`, handoff only, no refund operation |
| `UX-FLOW-042` split | Steps 7-9, 12 | Approved split handoff while held; QA-FIN-005 |
| `UR-BR-023`, `UR-BR-025` | Steps 4-6, 10-11 | Manual evidence/audit and privacy assertions |
| `UR-BR-040`, `QA-SEC-003` | Steps 1-3, 8-9, 11 | Normalized active assignment, two-distinct-Admin, race, and atomic-claim tests |
| `UR-PARTICIPANT-004` | Steps 3, 10-12 | Four-value public status and allowlisted masked participant DTO |
| Ticket AC-1 | Steps 1-5, 10-12 | Pre/post-processing integration matrix |
| Ticket AC-2 | Steps 6, 10, 12 | No-agreement/no-operation and disabled-action tests |
| Ticket AC-3 | Steps 7-9 | Frozen destination, approval, handoff, and no-operation tests |
| Ticket AC-4 | Steps 3, 5, 11-12 | Admin raw evidence versus participant summary tests |

## Plan Completion Check

- [x] Every acceptance criterion maps to a change and verification.
- [x] Every relevant approved UX transition and UI state maps to a change and
  verification.
- [x] Exact pre-processing, post-processing, unresolved, and approved-outcome
  state behavior is enumerated.
- [x] `SETTLEMENT_READY` is not introduced as a transaction state.
- [x] Complaint evidence and corrections are append-only.
- [x] Two distinct Admin approvals use normalized, revocable, reusable internal
  assignment rows; legacy account text is compatibility-only.
- [x] Agreement calculations and frozen destination bindings are concrete.
- [x] Agreement approval/rejection status, current version, and competing-race
  predicates are concrete.
- [x] The handoff stores resulting transaction state/version and has executable
  `readForUpdate`, one-time guarded `claim`, atomic event/audit, and replay
  semantics for BAYAR-008.
- [x] One complaint case can publish only one final handoff.
- [x] Legacy complaint preflight/backfill classification is deterministic and
  aborts ambiguous rows before DDL.
- [x] Authority foreign keys are restrictive and participant projection is
  explicitly allowlisted.
- [x] Migration dependency and numbering are ordered after migration 0009.
- [x] Cancellation, risk, financial execution, and notifications remain in
  their owning tickets.
- [x] Failure, timeout, retry, idempotency, concurrency, privacy, and rollback
  behavior are covered.
- [x] No unresolved implementation decision makes BAYAR-009 ambiguous.
- [ ] Plan Review is completed and Approved before implementation.

Implementation Plan BAYAR-009 v0.1 remains `Draft`.
