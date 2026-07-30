# Codebase Research: BAYAR-011

## Document Control

```text
Ticket: BAYAR-011
Title: Admin Risk Hold and Outcome-Neutral Review
Version: 0.1
Status: Draft
Prepared on: 2026-07-30
```

## Task

```text
Ticket ID/title: BAYAR-011 / Admin Risk Hold and Outcome-Neutral Review
Requested outcome: An assigned Admin can create and review an outcome-neutral
RISK_HOLD, preserve restricted evidence and approvals, expose only a generic
participant summary, and prepare an authorized handoff without moving money.
Source requirements: Ticket references UR-ADMIN-016..019, UR-BR-039,
UR-BR-040, UR-BR-045, UR-BR-046, UR-CAN-OD-005, and UR-CAN-OD-006.
The approved risk-specific requirements are UR-CANCEL-022, UR-CANCEL-023,
UR-BR-060, and UR-BR-061.
Source UX Flow/UI/QA IDs: UX-FLOW-072, UX-FLOW-073, UI-SCR-024,
UI-SCR-020 (terminal/downstream only), QA-RISK-001, QA-RISK-002,
QA-SEC-003, and QA-LAUNCH-001.
```

## Relevant Context Read

| File/doc | Why it is relevant | Key constraint found |
| --- | --- | --- |
| `AGENTS.md` | Repository workflow and source precedence | Research one ticket only; do not infer behavior from prototype or archive |
| `docs/engineering/tickets/BAYAR-011-risk-hold-review.md` | Ticket scope and acceptance criteria | Risk review is outcome-neutral; two Admin approvals precede a controlled financial handoff; BAYAR-011 performs no money movement |
| `PRD.md` v0.2 Approved | Product and operating boundary | Product roles remain Buyer, Seller, and Admin; internal assignments are not roles |
| `TRD.md` v1.2 Approved | State, authorization, audit, and launch boundary | `RISK_HOLD` is approved; it blocks fulfillment and money movement; release readiness is not a transaction state |
| `docs/product/03-user-requirements.md` v0.4 Approved | Canonical risk requirements | `UR-CANCEL-022/023` and `UR-BR-060/061` define the actual risk hold and review behavior |
| `docs/product/02-ux-flow.md` v0.3 Approved | Canonical risk sequence | `UX-FLOW-072` creates the hold and `UX-FLOW-073` records only an authorized outcome |
| `docs/product/04-ui-ux-spec.md` v0.2 Approved | Admin and participant projections | `UI-SCR-024` owns risk review; participants receive a generic hold status and never raw evidence |
| `docs/product/05-qa-scenarios.md` v0.2 Approved | Executable acceptance behavior | Risk hold blocks fulfillment, payout, and automatic refund; unauthorized access and launch gate behavior require tests |
| `src/server/db/schema.ts` | Current persistence contract | `risk_holds` is a minimal legacy table without lifecycle, immutable events, assignments, approval, or handoff |
| `drizzle/0000_open_kinsey_walden.sql` | Existing risk migration evidence | Initial `risk_holds` uses transaction cascade deletion and has no risk-specific constraints or indexes |
| `drizzle/0010_bayar009_complaint_handoff.sql` | Closest approved migration pattern | BAYAR-009 added assignment scopes, append-only case data, two approvals, and an immutable handoff |
| `src/server/complaint/service.ts` | Closest service pattern | Uses row locking, state version, idempotency, scoped Admin assignments, append-only events, and atomic state mutation |
| `src/server/complaint/handoff.ts` | Downstream financial handoff pattern | A handoff is claimed once, validates source state/version, and does not itself decide the outcome |
| `src/server/confirmation/service.ts` | Existing risk guard | Any `risk_holds` row blocks confirmation permanently because the table has no active/resolved lifecycle |
| `src/components/admin/complaint-operations.tsx` | Closest Admin UI pattern | Existing constrained mobile-width operations UI covers loading, authorization failure, mutations, and case history |

## Current Behavior

- There is no BAYAR-011 route, service, repository, Admin screen, participant
  projection, or risk-specific test.
- `risk_holds` stores only `transactionId`, `reason`, optional evidence
  reference/outcome, creator, and creation time.
- The table does not identify a category, source state/version, lifecycle,
  active case, current evidence, reviewer, approvals, decision, handoff, or
  resolution.
- Its transaction foreign key uses `ON DELETE CASCADE`; this is weaker than the
  `ON DELETE RESTRICT` evidence boundary introduced for complaint records.
- `src/server/confirmation/service.ts` treats the existence of any risk row as
  an active hold. A resolved risk case would still block confirmation.
- There is no database constraint limiting one active risk case per
  transaction and no immutable correction chain.
- `admin_task_assignments` exists, but its check constraint accepts only
  `COMPLAINT_INTAKE` and `COMPLAINT_APPROVAL`.
- BAYAR-009 already proves a reusable case workflow: assigned Admin intake,
  immutable events, optimistic concurrency, two distinct approvals, and a
  single-consumption financial handoff.
- Transaction state already includes `RISK_HOLD`. No new transaction state is
  required for this ticket.
- Moving a transaction to `RISK_HOLD` naturally prevents the existing
  fulfillment and confirmation services from accepting their expected source
  states. Explicit active-hold guards are still needed for clear authorization
  and future financial services.
- No release-gate persistence exists. `QA-LAUNCH-001` is currently represented
  only in approved documentation.

### Traceability Finding

The ticket's source list is partially stale:

- `UX-FLOW-063..070` describes funded cancellation and refund preparation, not
  the risk hold entry/review flow.
- The canonical risk flow is `UX-FLOW-072` and `UX-FLOW-073`.
- `UR-ADMIN-016..019` describes refund/split financial execution. It is
  downstream context only because BAYAR-011 must not move money.
- The canonical risk requirements are `UR-CANCEL-022`,
  `UR-CANCEL-023`, `UR-BR-060`, and `UR-BR-061`.
- `UI-SCR-024` is the risk review screen. `UI-SCR-020` is relevant only after
  an authorized downstream operation becomes terminal.

The implementation plan must use the canonical IDs above and flag the ticket
traceability for correction before plan approval.

## Code Map

| Responsibility | Existing file/module | Symbol/route | Notes |
| --- | --- | --- | --- |
| Transaction states | `src/server/domain/transaction/state.ts` | `TRANSACTION_STATES` | Already includes `RISK_HOLD` |
| Database schema | `src/server/db/schema.ts` | `riskHolds` | Legacy/minimal shape; additive redesign required |
| Admin assignment | `src/server/db/schema.ts` | `adminTaskAssignments` | Reusable, but risk scopes are not permitted yet |
| Complaint case model | `src/server/db/schema.ts` | `complaintHolds`, `complaintEvents` | Reusable structural pattern, not a table to overload |
| Two-Admin approval | `src/server/db/schema.ts` | `complaintAgreementApprovals` | Distinct-Admin uniqueness pattern is reusable |
| Financial handoff | `src/server/complaint/handoff.ts` | `claimComplaintHandoff` | Single-claim and source-version pattern is reusable |
| Complaint mutation | `src/server/complaint/service.ts` | `recordComplaint`, correction/agreement functions | Row lock, idempotency, state version, and atomic audit patterns |
| Idempotency | `src/server/transaction/mutation.ts` | `findIdempotentResult`, `saveIdempotentResult` | Reuse account-scoped commands and request-hash conflict detection |
| Rejection audit | `src/server/transaction/audit.ts` | `recordTransactionEvent`, `recordRejectedMutationEvent` | Rejected mutations need a sanitized audit outside the rolled-back domain transaction |
| Confirmation guard | `src/server/confirmation/service.ts` | `assertNoHold` | Must query only an active risk case after lifecycle exists |
| Admin authorization | Existing Admin API routes | `requireAdminAccount` pattern | Session-level Admin check must be followed by risk assignment check |
| Admin UI | `src/components/admin/complaint-operations.tsx` | `ComplaintOperations` | Closest mobile-width form/history/recovery pattern |
| Participant transaction view | `src/server/transaction/read.ts` and transaction UI | transaction projection | Requires generic risk summary without reason/evidence/internal decision |
| Integration tests | `tests/complaint.integration.test.ts` and database test helpers | PostgreSQL-backed cases | Closest pattern for assignment, concurrency, approval, masking, and handoff |
| Migration history | `drizzle/0010_bayar009_complaint_handoff.sql` | BAYAR-009 DDL | Next migration name must be selected without colliding with deferred BAYAR-008/010 work |

## Existing Patterns To Reuse

- **Validation:** Zod request contracts with explicit enums, UUIDs,
  `expectedStateVersion`, evidence hash/reference, and required
  `Idempotency-Key`.
- **Data access:** lock the transaction and active case with `FOR UPDATE`, then
  use conditional updates against state and state version.
- **Idempotency:** store command result by account scope, command, key, and
  request hash; same request returns the prior result and conflicting reuse is
  rejected.
- **Authorization:** require an authenticated Admin and a current internal task
  assignment. Assignment names must never become product roles.
- **Evidence:** append a new event for intake, review, correction, approval,
  handoff, or rejection. Keep previous evidence immutable and update only a
  current pointer/projection.
- **Approval:** enforce distinct Admin approvers with a unique database
  constraint; a rejection or missing second approval leaves the action
  disabled.
- **Handoff:** create an immutable, one-time source snapshot only after the
  decision is fully approved. BAYAR-008 may claim it later; BAYAR-011 does not
  create a financial operation.
- **Audit:** commit accepted business mutation and audit atomically. Write a
  separate sanitized denial audit after a rejected domain transaction rolls
  back.
- **Projection:** assigned Admin sees evidence references, review history, and
  decisions. Buyer/Seller and unassigned Admin receive only the permitted
  generic status.
- **UI:** reuse the constrained mobile-width shell and explicit loading, empty,
  disabled, unauthorized, error, success, and recovery states.
- **Tests:** use PostgreSQL integration tests for constraints, row locking,
  concurrent mutations, append-only enforcement, distinct approvals,
  idempotency, masking, and single handoff.

## Change Surface

| Area | Likely change? | Reason/risk |
| --- | --- | --- |
| UI | Yes | Add `UI-SCR-024` Admin review and generic participant risk status; avoid exposing fraud/evidence detail |
| API | Yes | Add Admin intake/read/evidence/review/approval/handoff routes and participant-safe read projection |
| State | Yes | Use existing `RISK_HOLD`; exact eligible source and authorized exit matrix must be fixed before implementation |
| Database | Yes | Add lifecycle, active-case constraint, immutable events, decision/approval, handoff, assignment scopes, and non-transaction release gate representation |
| Auth | Yes | Enforce Admin plus risk assignment; audit all unassigned/participant denials |
| Jobs/integrations | No | No automatic fraud provider, money movement, or external risk integration belongs to BAYAR-011 |
| Tests/docs | Yes | Add schema/service/route/UI tests for risk hold, privacy, approvals, concurrency, and release gate |

## Expected Persistence Boundary

The current schema cannot safely support the ticket. The plan should evaluate
an additive boundary equivalent to:

- `risk_holds`: one active case projection per transaction, source
  state/version, lifecycle, current event/decision, creator, timestamps.
- `risk_events`: append-only intake, evidence correction, review, approval,
  handoff, and post-processing records.
- `risk_decisions`: immutable/versioned outcome proposal with no default value.
- `risk_decision_approvals`: one decision per Admin, with two distinct approvals
  before a controlled financial handoff.
- `risk_financial_handoffs`: immutable source snapshot claimable once by
  BAYAR-008.
- Separate release-gate tables or a repository-level release-readiness
  aggregate using only `OPEN`, `BLOCKED`, and `APPROVED`; it must not reference
  `transactions.state`.

These are research findings, not final schema decisions. The implementation
plan must specify exact fields, constraints, trigger enforcement, migration
preflight, and ownership.

## Unknowns And Assumptions

| Item | Can be inferred safely? | Evidence or decision needed |
| --- | --- | --- |
| Product roles remain Buyer/Seller/Admin | Yes | Approved PRD/TRD and ticket explicitly prohibit new roles |
| Risk review uses internal Admin assignments | Yes | Reuse `admin_task_assignments`; exact risk scope names must be fixed in plan |
| Exact states eligible to enter `RISK_HOLD` | No | TRD says "any eligible state" but does not enumerate the executable state matrix |
| Exact authorized risk outcomes and target states | No | Approved UX permits continued hold, `REFUND_READY`, or another authorized manual path; concrete vocabulary and targets are required |
| Whether a risk case can coexist with an active complaint/cancellation | No | Define precedence, one-active-case behavior, and recovery without silently resolving either case |
| How a risk case returns to its source state when no financial action is authorized | No | A safe explicit transition and state-version rule are needed; do not infer restoration automatically |
| Two-Admin approval threshold | Yes | Controlled risk financial outcomes require two distinct Admin approvals |
| Handoff ownership | Yes | BAYAR-011 prepares immutable authorization; BAYAR-008 owns financial operation and money movement |
| Release gate is non-transactional | Yes | `UR-BR-046` and `QA-LAUNCH-001` define `OPEN/BLOCKED/APPROVED` as release readiness only |
| Release-gate final approver and evidence retention | No | Ticket excludes launch approval itself; plan must define what BAYAR-011 records versus what remains an external release decision |
| Migration number | No | Current committed sequence reaches `0010`, while BAYAR-008/010 are deferred; select a collision-safe next migration during planning |
| Existing `risk_holds` rows | No | Migration needs a preflight/backfill policy before adding lifecycle and constraints |

## Research Conclusion

```text
Recommended implementation boundary:
- Build a dedicated risk aggregate; do not overload complaint tables.
- Reuse BAYAR-009 patterns for Admin assignments, append-only events,
  two distinct approvals, state-version/idempotency guards, masking, and
  a one-time downstream handoff.
- Keep risk review outcome-neutral. BAYAR-011 may expose only an explicitly
  approved handoff; BAYAR-008 remains the sole financial executor.
- Represent launch readiness separately from transaction state.
- Replace the passive risk existence check with an active-case lifecycle guard.

Main risks:
- Ticket traceability currently points to cancellation/refund flow IDs rather
  than the canonical risk IDs.
- Eligible entry states and permitted exit/outcome matrix are not concrete.
- Complaint/cancellation/risk precedence is not defined.
- Legacy risk rows have no lifecycle and may block confirmation forever.
- Release-gate recording can accidentally become product transaction behavior.
- Evidence or internal risk details can leak through participant projections,
  logs, audit payloads, or idempotency results.

Files likely affected:
- src/server/db/schema.ts
- a new additive Drizzle migration and metadata/journal entry
- src/server/risk/* service, contracts, repository/handoff modules
- src/app/api/admin/transactions/[id]/risk-* routes
- participant-safe transaction/risk read route or projection
- src/components/admin/risk-operations.tsx
- src/app/admin/risk/page.tsx
- src/server/confirmation/service.ts
- PostgreSQL integration, route, authorization, and UI tests
- docs/execution/BAYAR-011/04-validation.md during implementation

Ready to plan: Yes, with blockers.
The plan may be drafted, but it must not be approved or implemented until the
canonical traceability, exact state matrix, outcome vocabulary, case
precedence, and release-gate ownership are resolved.
```
