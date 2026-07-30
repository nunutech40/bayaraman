# Codebase Research: BAYAR-009

## Task

```text
Ticket ID/title: BAYAR-009 - Complaint Hold and External Settlement Recording
Requested outcome: Admin records an externally reported complaint, places an
eligible transaction on hold, and records only an approved written-agreement
handoff without adjudicating or executing money movement.
Source requirements: UR-PARTICIPANT-004, UR-PARTY-004, UR-ADMIN-012,
UR-ADMIN-013, UR-ADMIN-014, UR-BR-017, UR-BR-018, UR-BR-019, UR-BR-023,
UR-BR-025, UR-BR-040
Source UX Flow/UI/QA IDs: UX-FLOW-035..042; UI-SCR-017..019;
QA-COMPLAINT-001..004, QA-FIN-005, QA-SEC-003
Technical boundary: PRD.md v0.2, TRD.md v1.2 Sections 5, 6, 9..14
Status: Draft
```

## Relevant Context Read

| File/doc | Why it is relevant | Key constraint found |
| --- | --- | --- |
| `docs/engineering/tickets/BAYAR-009-complaint-hold-settlement.md` | Ticket boundary | BAYAR-009 records complaint/settlement authority and produces a handoff only; BAYAR-008 executes payout/refund/split. |
| `docs/execution/BAYAR-006/04-validation.md` | Required predecessor | Manual WhatsApp checkpoint evidence is append-only and exposes a current-head projection; no automatic WA parsing exists. |
| `docs/execution/BAYAR-007/04-validation.md` | Confirmation/hold interaction | Buyer confirmation and controlled exception guard against complaint/risk holds; payout remains separate. |
| `docs/product/03-user-requirements.md` v0.4 | Requirement contract | Complaint negotiation stays outside BayarAman; unresolved cases remain held; written agreement has only seller release, buyer refund, or split outcomes. |
| `docs/product/02-ux-flow.md` v0.3 | Sequence and handoff | Admin recording creates `PAYOUT_ON_HOLD`; no agreement becomes `MANUAL_REVIEW_REQUIRED`; financial execution belongs downstream. |
| `docs/product/04-ui-ux-spec.md` v0.2 | Screen/privacy boundary | UI-SCR-017 records complaint/evidence and exposes only a masked participant summary; UI-SCR-018/019 are downstream refund/split surfaces. |
| `docs/product/05-qa-scenarios.md` v0.2 | Executable acceptance | Duplicate complaint creates one hold; unresolved hold disables release; one agreement outcome only; post-processing complaint cannot silently reverse money. |
| `PRD.md` v0.2 | Product boundary | Complaint adjudication is out of scope; Admin records external agreement and financial success remains a separate operation. |
| `TRD.md` v1.2 | State/security/data contract | Use approved states, state version, idempotency, append-only audit, two-Admin approval, and Admin-only raw evidence. |
| `src/server/db/schema.ts` | Existing persistence | `complaint_holds` is currently a minimal mutable-looking row with summary, evidence reference, optional outcome, creator, and timestamp. |
| `src/server/operations/whatsapp.ts` | Evidence pattern | Append-only checkpoint event plus current-head projection, Admin mutation authorization, idempotency, state-version guard, and sanitized participant summary are reusable patterns. |
| `src/server/confirmation/service.ts` | Existing hold consumer | Any complaint row currently blocks Buyer confirmation/exception, regardless of whether the complaint is active or resolved. |
| `src/server/transaction/mutation.ts` and `audit.ts` | Mutation safety | Actor-scoped idempotency, request hash, conditional state mutation, and append-only audit are established repository boundaries. |

## Current Behavior

- There is no complaint intake service, contract, API route, Admin page, or
  participant complaint-summary endpoint.
- `complaint_holds` currently stores:
  `id`, `transaction_id`, `summary`, `evidence_reference`, nullable `outcome`,
  `created_by_account_id`, and `created_at`.
- The table has no lifecycle/status, state version, source-state snapshot,
  agreement amounts, destination binding, two-Admin approvals, immutable
  correction chain, current-head projection, resolution time, or downstream
  consumption reference.
- `complaint_holds.transaction_id` uses `ON DELETE CASCADE`; that does not yet
  provide the retention/claim guarantees needed by a financial handoff.
- `confirmation/service.ts` treats the existence of any complaint row as an
  active hold. Once outcomes are introduced, this query must distinguish the
  current unresolved hold from a resolved/handoff complaint without weakening
  the pre-payout guard.
- No code currently moves an eligible transaction to `PAYOUT_ON_HOLD` when an
  Admin records a complaint.
- No code currently records `MANUAL_REVIEW_REQUIRED` for an unresolved
  complaint, or creates a seller-release, buyer-refund, or split handoff.
- No code currently records a complaint reported after
  `PAYOUT_PROCESSING`/financial processing without reversing the financial
  state.
- Existing WhatsApp operations already prove the preferred manual evidence
  pattern: Admin records a sanitized reference; the application does not parse
  WhatsApp messages into trusted state.
- Existing transaction mutations already support expected state version,
  actor-scoped idempotency, append-only audit, and sanitized rejection events.
- Product roles remain Buyer, Seller, and Admin. `accounts.is_admin` is the
  product authorization source; `admin_task_assignment` is an internal
  assignment field, not another product role.
- The approved transaction state enum contains `PAYOUT_ON_HOLD`,
  `MANUAL_REVIEW_REQUIRED`, `READY_FOR_PAYOUT`, `REFUND_READY`,
  `SPLIT_PROCESSING`, and terminal financial states. It does not contain
  `SETTLEMENT_READY`.

## Code Map

| Responsibility | Existing file/module | Symbol/route | Notes |
| --- | --- | --- | --- |
| Complaint persistence | `src/server/db/schema.ts` | `complaintHolds` | Minimal table; insufficient for lifecycle, approvals, immutable corrections, or consumable handoff. |
| Risk persistence | `src/server/db/schema.ts` | `riskHolds` | Separate BAYAR-011 concern; must not be merged into complaint adjudication. |
| Cancellation persistence | `src/server/db/schema.ts` | `cancellationRequests`, `cancellationReconciliations` | BAYAR-010 owns cancellation lifecycle/handoff, not BAYAR-009. |
| Transaction states | `src/server/domain/transaction/state.ts`, `schema.ts` | `TRANSACTION_STATES`, `transactionState` | Approved states already exist; no `SETTLEMENT_READY` enum exists. |
| Admin authorization | `src/server/auth/authorization.ts` | `requireAdminAccount()` | Resolves session and checks server-side Admin status. Assignment semantics still need a concrete plan. |
| Idempotency | `src/server/transaction/mutation.ts` | `findIdempotentResult`, `saveIdempotentResult` | Reuse actor scope, command, key, and request-hash conflict behavior. |
| Audit | `src/server/transaction/audit.ts` | `recordTransactionEvent()` | Successful mutation/audit can share a DB transaction; rejected actions use sanitized evidence. |
| Evidence event/head | `src/server/operations/whatsapp.ts`, `schema.ts` | checkpoint events and heads | Reusable append-only correction/current projection model. |
| Confirmation guard | `src/server/confirmation/service.ts` | `ensureNoHold()` | Must eventually read active complaint projection rather than any historical row. |
| Participant transaction UI | `src/components/transactions/status.tsx` | `TransactionStatus` | Existing mobile-width state/status shell; no complaint summary exists. |
| Admin operational UI | `src/app/admin/whatsapp`, `src/app/admin/confirmation` | Admin forms/pages | Reusable loading, disabled, stale-state, error, success, and constrained-width patterns. |
| Tests | `tests/integration/whatsapp-operations.test.ts`, `confirmation.test.ts` | PostgreSQL integration fixtures | Reuse fixed states, multiple Admin accounts, idempotency, state conflict, evidence masking, and append-only assertions. |

## Existing Patterns To Reuse

- **Validation:** Zod contracts at the service/API boundary; clients may submit
  evidence references and agreement proposals, but cannot submit authoritative
  transaction state, role, outcome eligibility, or financial terminal result.
- **Data access:** One PostgreSQL transaction should lock the transaction and
  current complaint projection, validate state/version, append evidence, move
  the head, update transaction state conditionally, write audit, and save the
  idempotent result.
- **Authorization:** `requireAdminAccount()` plus a concrete internal
  assignment rule. Buyer and Seller are read-only summary viewers and cannot
  create, approve, correct, or resolve a hold.
- **Evidence:** Reuse the BAYAR-006 append-only event/head design. Corrections
  append a new immutable event and update only the current pointer; raw WA
  content/media is not stored.
- **State:** Use only approved transaction states. Treat written-agreement
  readiness as complaint-domain data or a handoff lifecycle, not a new
  `SETTLEMENT_READY` transaction state.
- **Idempotency/concurrency:** Reuse `Idempotency-Key`, request hash,
  `expectedStateVersion`, row locks, conditional updates, and duplicate-result
  replay.
- **Audit:** Store actor, time, source/result state, correlation ID, sanitized
  reason, and evidence reference. Never overwrite an earlier evidence or
  approval event.
- **UI:** Reuse the mobile-width Admin form patterns and participant status
  shell with loading, empty, disabled, unauthorized, stale, manual-review, and
  recovery states.
- **Testing:** Vitest plus PostgreSQL integration tests gated by
  `TEST_DATABASE_URL`; use multiple Admins and concurrent mutations to verify
  one hold, one outcome, and one downstream claim.

## Change Surface

| Area | Likely change? | Reason/risk |
| --- | --- | --- |
| UI | Yes | Add UI-SCR-017 Admin complaint intake/agreement surface and participant-safe hold summary; UI-SCR-018/019 remain handoff links/states, not money execution. |
| API | Yes | Add Admin complaint create/read/correct/unresolved/agreement endpoints and participant summary endpoint. Exact route structure belongs in the plan. |
| State | Yes, approved values only | Pre-processing intake can produce `PAYOUT_ON_HOLD`; unresolved agreement can produce `MANUAL_REVIEW_REQUIRED`; seller release/refund/split need explicit approved-state mappings. |
| Database | Yes | Current table needs additive lifecycle, immutable evidence/correction, approvals, outcome amounts, source state/version, current projection, and consumable handoff support. |
| Auth | Yes | Define Admin assignment permissions for intake, evidence correction, first/second approval, and handoff publication. No new role. |
| Jobs/integrations | Boundary only | WhatsApp remains manual/external. Notification/escalation belongs to BAYAR-012; financial execution belongs to BAYAR-008. |
| Tests/docs | Yes | Add migration, service, route, concurrency, privacy, post-processing, correction, approval, and handoff-consumption coverage plus validation evidence. |

## Gaps Against Ticket

| Ticket/QA contract | Current evidence | Gap / planning implication |
| --- | --- | --- |
| One complaint hold before payout processing | Minimal table only | Need exact eligible source states, active uniqueness, transaction lock, state-version guard, and idempotent duplicate behavior. |
| Complaint after financial processing | No behavior | Need a record-only late complaint path that never reverses `PAYOUT_PROCESSING`, `PAID_OUT`, refund/split processing, or terminal states. |
| Unresolved complaint disables financial action | Existence check only in confirmation | Need an authoritative active-head/hold projection consumed by confirmation and future finance eligibility. |
| Immutable evidence and correction | No correction model | Need append-only events and a current head; update/delete of historical evidence must be rejected. |
| Written agreement only | Nullable free-text `outcome` | Need constrained outcome vocabulary, agreement evidence, amounts/calculation, destination binding, and exactly one selected route. |
| Two-Admin approval | No complaint approval persistence | BAYAR-009 must persist distinct Admin approvals for the upstream agreement/handoff; BAYAR-008 cannot invent this authority later. |
| Handoff to BAYAR-008 | No handoff/claim contract | Need a source-owned immutable handoff with read and atomic claim semantics, source state/version, approval evidence, amount, destination binding, and downstream parent-operation reference. |
| Participant masking | No API/projection | Need summary DTO that excludes raw WA evidence, Admin notes, bank values, and approval internals. |
| No adjudication | No service exists | Contracts/content must say “written mutual agreement recorded,” never “Admin decided winner.” |
| Financial execution remains downstream | Financial table exists but unused here | BAYAR-009 must not create payout/refund/split operations or record transfer results. |

## Important Cross-Ticket Findings

1. **`SETTLEMENT_READY` is not an approved technical state.**
   UX-FLOW-038 uses this result label, but the repository/TRD state machine
   does not contain it and the ticket forbids new states. The implementation
   plan must map agreement readiness to complaint-domain/handoff status and
   use only approved transaction states.

2. **Cancellation handoff is not owned by BAYAR-009.**
   BAYAR-010 explicitly owns cancellation lifecycle and refund/complaint/risk
   handoffs. BAYAR-008 must consume cancellation authority from BAYAR-010, not
   make BAYAR-009 a generic cancellation producer.

3. **BAYAR-009 must define the producer side of the financial handoff.**
   The revised BAYAR-008 plan expects approved, current, unconsumed source
   records but its current reader contract cannot claim them. BAYAR-009 is the
   correct place to define complaint handoff persistence, conditional claim,
   retention, and producer/consumer concurrency behavior.

4. **Migration numbering changes with dependency order.**
   Migration `0009` belongs to BAYAR-007. Since BAYAR-009 must execute before
   BAYAR-011 and BAYAR-008, the next additive migration should be planned from
   the current journal rather than reserving BAYAR-008's draft `0010`.

## Unknowns And Assumptions

| Item | Can be inferred safely? | Evidence or decision needed |
| --- | --- | --- |
| Exact complaint-eligible source states before payout processing | No | Plan must enumerate states and distinguish pre-processing hold from post-processing record-only complaint. |
| Complaint lifecycle persistence shape | No | Choose append-only event/head plus agreement/handoff tables, or an equivalent enforceable model. |
| Mapping after written seller release, buyer refund, or split | Partially | Approved targets suggest `READY_FOR_PAYOUT`, `REFUND_READY`, and held split handoff; plan must resolve the UX `SETTLEMENT_READY` label without adding a state. |
| No-agreement transition from `PAYOUT_ON_HOLD` | Yes, with guard | Approved requirement says `MANUAL_REVIEW_REQUIRED`; plan must preserve the active hold and prevent this label from enabling finance. |
| Admin assignment policy | No | Define allowed assignment values, null behavior, and whether different Admins may intake, approve, correct, and publish handoff. |
| Two-Admin approval threshold | Yes | Complaint settlement is a controlled financial outcome and requires two distinct Admins under UR-BR-040. |
| Agreement amount model | No | Full seller release/refund can be server-derived; split requires exact Buyer/Seller amounts and a calculation hash owned upstream or by BAYAR-008. |
| Handoff consumption API | No | Define source-specific `readForUpdate`/`claim` contract, expected state version, one parent operation, rollback, and retention semantics. |
| Raw evidence retention duration | No | Keep configurable/legal-hold compatible; production duration remains a compliance decision, not a coding assumption. |
| Notifications/escalation | Partially | Record notification intent/status only if required; BAYAR-012 owns retries/scheduling. |

## Research Conclusion

```text
Recommended implementation boundary:
- Add a complaint-domain service and additive schema for one current hold,
  append-only evidence/corrections, written-agreement outcome, two distinct
  Admin approvals, participant-safe projection, and a source-owned financial
  handoff that BAYAR-008 can atomically claim.
- Use approved transaction states only. Record complaint before financial
  processing as PAYOUT_ON_HOLD; keep post-processing complaints record-only;
  map no agreement to MANUAL_REVIEW_REQUIRED without releasing funds.
- Keep WhatsApp negotiation external/manual. BAYAR-009 records references and
  the parties' written agreement; it never adjudicates or transfers money.
- Keep cancellation authority in BAYAR-010, risk authority in BAYAR-011, and
  financial execution in BAYAR-008.

Main risks:
- Treating any historical complaint row as active could permanently block a
  resolved transaction.
- A mutable evidence/outcome row could overwrite the agreement or allow a
  second conflicting financial route.
- A read-only handoff without atomic claim semantics could fund the same
  agreement twice.
- Adding SETTLEMENT_READY as a transaction state would violate the approved
  state machine.
- Post-processing complaint handling could accidentally reverse or mask an
  already-started financial operation.

Files likely affected:
- src/server/db/schema.ts
- a new additive migration after drizzle/0009
- new src/server/complaint contracts/service/projection/handoff modules
- new Admin and participant complaint API routes
- UI-SCR-017 Admin complaint screen and participant hold summary
- PostgreSQL integration/unit tests and BAYAR-009 validation report

Ready to plan: Yes, provided the plan makes eligible source states, internal
complaint lifecycle, two-Admin approval, and atomic handoff claim concrete.
```
