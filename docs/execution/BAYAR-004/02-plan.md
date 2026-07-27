# BAYAR-004 Implementation Plan

## Metadata

```text
Ticket: BAYAR-004 — Payment Instructions, Sudah Bayar Claim, and Original Expiry
Version: 0.1
Status: Draft
Depends on: BAYAR-003 implementation and validation
Plan scope: Payment instructions, Buyer payment claim, and original expiry only
```

## Task

```text
Ticket ID/title: BAYAR-004 — Payment Instructions, Sudah Bayar Claim,
and Original Expiry
Outcome: A complete Buyer/Seller transaction becomes payable once, exposes
immutable payment instructions to the Buyer, accepts one timely idempotent
Sudah Bayar claim, and expires unpaid instructions at the original 1x24-hour
deadline without payment confirmation.
Source research: docs/execution/BAYAR-004/01-research.md
Source requirements and QA scenarios: UR-BUYER-004, UR-BUYER-005,
UR-BUYER-009, UR-SYSTEM-004 through UR-SYSTEM-007, UR-PARTICIPANT-001,
UR-BR-008, UR-BR-009, UR-BR-010, UR-BR-030, UR-BR-031, UR-BR-034;
QA-PAY-001 through QA-PAY-003, QA-PAY-009, QA-EXP-001, QA-EXP-002,
QA-UI-002
Source UX Flow and UI IDs/states: UX-FLOW-013, UX-FLOW-014,
UX-FLOW-044, UX-FLOW-045, UX-FLOW-046, UX-FLOW-048;
UI-SCR-009, UI-SCR-010, UI-SCR-021
```

## Scope

### In Scope

- Atomic issuance of payment instructions when both participant datasets are
  complete.
- Immutable exact amount and receiving-account snapshot.
- Original 1x24-hour deadline calculated from instruction issuance and rendered
  in WIB.
- Buyer-only payment-instruction read and `Sudah Bayar` claim.
- One active claim, idempotency, state-version protection, and audit events.
- Deterministic expiry service/job boundary with fixed-clock tests.
- Buyer/Seller transaction status UI for payable, claim, review, loading,
  disabled, expired, error, and retry states.

### Out Of Scope

- Admin bank review, payment confirmation, payment evidence, or
  `PAYMENT_EXCEPTION_REVIEW` handling.
- Partial/excess/duplicate/late-fund adjudication; these remain inputs for
  BAYAR-005 and later operational flows.
- WhatsApp group creation, notifications, fulfillment, confirmation OTP,
  complaint, cancellation, refund, payout, or money movement.
- Visual redesign or full prototype port.
- New product roles, transaction states, or financial operation results.

## Approved Implementation Decisions

1. **Receiving account configuration:** Add server-side configuration for
   `BAYARAMAN_RECEIVING_BANK_NAME`, `BAYARAMAN_RECEIVING_ACCOUNT_NUMBER`, and
   `BAYARAMAN_RECEIVING_ACCOUNT_HOLDER`. The application fails closed outside
   test when the values are missing or invalid. Tests use a non-production
   fixture. The exact account number is copied into the instruction snapshot at
   issuance so later configuration changes cannot alter an existing payable
   transaction. Add placeholder names only to `.env.example`; real local
   values remain in the ignored `.env` and are never committed.
2. **Sensitive projection:** Add a restricted exact account snapshot field to
   `payment_instructions`. Only the Buyer participant receives the exact value;
   Seller and non-authorized views receive the masked value. The raw value is
   excluded from audit payloads, structured logs, idempotency results, and
   generic transaction projections.
3. **Instruction issuance:** Invoke one idempotent `issuePaymentInstructions`
   service from the final role-data completion transaction. It locks the item,
   terms, shipping, and destination snapshots, inserts one instruction row,
   sets the original deadline, and transitions the transaction to
   `WAITING_BUYER_PAYMENT`. A retry returns the existing instruction/result and
   never resets the deadline.
4. **API routes:** Use `GET /api/transactions/[id]/payment-instructions` for
   the authorized instruction projection and
   `POST /api/transactions/[id]/payment-claim` for `Sudah Bayar`. The claim
   accepts an optional non-authoritative note only; no bank evidence or amount
   assertion is accepted by this ticket.
5. **Expiry execution:** Add a deterministic
   `expireDuePaymentInstructions(now)` service and a thin local runner command
   (`npm run job:payment-expiry`). Production invokes the same function through
   the scheduler contract documented in the plan; no web request is required
   for correctness. A lazy read guard may report stale state but cannot replace
   the due-time sweep.

## Planned Changes

| Step | Change | File/module | Requirement/UX/UI/AC covered | Verification |
| --- | --- | --- | --- | --- |
| 1 | Add validated receiving-account configuration and masked projection helper | `src/server/payment/config.ts`, `src/server/payment/projection.ts`, `.env.example`, tests | UR-BUYER-004, UR-BR-034; UI-SCR-010; exact Buyer destination and masked participant boundary | Missing/invalid config fails closed; Buyer gets exact snapshot; Seller/log/audit never get raw value |
| 2 | Extend payment instruction persistence with exact immutable snapshot and enforce one row per transaction | `src/server/db/schema.ts`, generated migration under `drizzle/` | UR-BR-008, UR-BR-030, UR-BR-031; TRD data model; instruction immutability | Migration applies; primary key and snapshot fields are present; generated schema has no unintended changes |
| 3 | Implement payable transition and instruction issuance in the final role-data mutation | `src/server/transaction/payment.ts`, `src/server/transaction/service.ts`, `src/server/transaction/audit.ts` | UX-FLOW-013, UX-FLOW-044; `WAITING_COUNTERPARTY_DATA` -> `WAITING_BUYER_PAYMENT`; `PAYMENT_INSTRUCTIONS_ISSUED` | Atomic completion creates exactly one instruction, freezes snapshots, increments state version, and keeps original deadline on retry |
| 4 | Add authorized payment-instruction read projection | `src/app/api/transactions/[id]/payment-instructions/route.ts`, shared transaction read/projection module | UR-BUYER-004, UR-PARTICIPANT-001; UX-FLOW-013; UI-SCR-009, UI-SCR-010 | Buyer sees exact amount, destination, fee, total, and WIB deadline; Seller sees only allowed masked data; unauthorized requests fail |
| 5 | Implement one active Buyer claim with idempotent state transition and mandatory database enforcement | `src/server/transaction/payment.ts`, `src/server/db/schema.ts`, `src/app/api/transactions/[id]/payment-claim/route.ts`, generated migration | UR-BUYER-005, UR-BUYER-009; UX-FLOW-014, UX-FLOW-046; UI-SCR-010; `PAYMENT_CLAIM_SUBMITTED` | PostgreSQL partial unique index enforces `UNIQUE(transaction_id) WHERE active = true`; timely Buyer claim inserts immutable timestamp and transitions to `PAYMENT_UNDER_REVIEW`; duplicate returns same result; concurrent insert test passes; no confirmation is produced |
| 6 | Implement deterministic expiry and local runner boundary | `src/server/jobs/payment-expiry.ts`, `src/server/jobs/run-payment-expiry.ts`, `package.json` | UR-SYSTEM-004 through UR-SYSTEM-007; UX-FLOW-045, UX-FLOW-048; QA-EXP-001, QA-EXP-002 | Due unpaid transaction is conditionally updated only when transaction ID, current state, state version, and deadline match; audit is written only after the update succeeds; timely claim is not expired; rerun creates no duplicate transition/audit; deadline is unchanged |
| 7 | Extend transaction status UI for payment instructions and claim states; preserve cancellation as deferred only | `src/components/transactions/status.tsx`, `src/app/transactions/[id]/page.tsx`, `src/app/globals.css` | UI-SCR-009, UI-SCR-010; UI-SCR-021 deferred boundary only; QA-UI-002 | Mobile-width page renders payable, loading, disabled, error/retry, review, expired, and unauthorized states with keyboard/focus/label checks; any cancellation entry remains disabled/deferred and creates no cancellation request, route, state, or policy |
| 8 | Add unit, database integration, route, and fixed-clock tests | `tests/unit/payment.test.ts`, `tests/integration/payment.test.ts` or repository-equivalent test setup | QA-PAY-001 to QA-PAY-003, QA-PAY-009, QA-EXP-001, QA-EXP-002, QA-UI-002; all ticket acceptance criteria | Test evidence covers authorization, concurrent active-claim inserts, idempotency, deadline boundaries, masking, accessibility/responsive states, and explicit partial/excess/duplicate/late external-fund non-confirmation |

### Dependency Order

1. Configuration/projection and schema migration.
2. Payment issuance service integrated with final BAYAR-003 role-data mutation.
3. Read and claim routes.
4. Expiry service and local runner.
5. UI states and route tests.
6. Full validation against local PostgreSQL.

The migration must be applied before integration tests. The implementation
must preserve compatibility with existing BAYAR-003 transactions that are not
yet payable; only transactions with both complete role datasets may enter the
new transition.

## State And Data Impact

```text
State transitions added/changed:
- WAITING_COUNTERPARTY_DATA -> WAITING_BUYER_PAYMENT when both role datasets
  are complete and one payment instruction snapshot is created.
- WAITING_BUYER_PAYMENT -> PAYMENT_UNDER_REVIEW on one timely Buyer claim.
- WAITING_BUYER_PAYMENT -> PAYMENT_EXPIRED when the original deadline has
  passed without a timely claim.
- No transition to PAYMENT_CONFIRMED is implemented.

Schema/migration impact:
- Add exact receiving-account snapshot storage to payment_instructions, with
  restricted server-side projection and existing transaction primary key.
- Add a mandatory PostgreSQL partial unique index on
  `payment_claims(transaction_id) WHERE active = true`. Service, state-version,
  and idempotency guards remain authoritative for user-safe results, while the
  database constraint protects concurrent inserts.
- Preserve existing payment_claims and payment_instructions rows.

Authorization impact:
- Buyer participant may read exact payment instructions and submit a claim.
- Seller participant may read only the permitted masked destination/status.
- Admin access remains server-side and does not gain bank-review behavior here.
- Unauthenticated, unrelated, or wrong-role requests are rejected.

Audit/notification impact:
- Append PAYMENT_INSTRUCTIONS_ISSUED, PAYMENT_CLAIM_SUBMITTED, and
  PAYMENT_EXPIRED with transaction ID, actor, state, version, and safe metadata.
- Never include raw receiving account, OTP, bank evidence, or claim secret in
  audit/log/idempotency payloads.
- No external notification integration is created in this ticket.

Manual operation impact:
- Buyer still transfers funds manually to the displayed BayarAman account.
- Sudah Bayar only informs Admin that a claim needs review; it is not evidence
  and does not authorize WhatsApp, fulfillment, or payout.
```

## API And Job Contract

```text
GET /api/transactions/[id]/payment-instructions
- Authenticated participant only.
- Buyer receives exact destination; Seller receives masked destination.
- Response includes amount breakdown, deadlineAt, rendered WIB deadline,
  current state, state version, and claim/review status.
- No raw account value in unauthorized or generic projections.

POST /api/transactions/[id]/payment-claim
- Authenticated Buyer participant only.
- Requires Idempotency-Key and expectedStateVersion.
- Accepts optional non-authoritative note; ignores no client-supplied amount or
  confirmation fields.
- Requires current state WAITING_BUYER_PAYMENT and now < deadlineAt.
- Returns PAYMENT_UNDER_REVIEW and the immutable claim timestamp.

expireDuePaymentInstructions(now)
- Selects only WAITING_BUYER_PAYMENT rows with deadlineAt <= now.
- Uses an internal job correlation key derived from the run timestamp and
  transaction ID for logs/audit context only; it is not a product role, account,
  or new transaction state.
- For each candidate, atomically updates the row only when transaction ID,
  current state `WAITING_BUYER_PAYMENT`, current state version, and
  `deadlineAt <= now` all match. The returned updated row is the sole authority
  for whether the transition won.
- Writes `PAYMENT_EXPIRED` audit only after that conditional update succeeds.
- Does not touch PAYMENT_UNDER_REVIEW, does not reset deadlines, and does not
  infer bank status. Rerunning the same or another job run finds no eligible
  row after the first successful update and creates no duplicate audit event.
- Local runner: npm run job:payment-expiry.
- Production scheduler: invokes the same bounded function on a recurring
  schedule with a service-level database credential; scheduling infrastructure
  is outside this ticket.
```

## Test Plan

| Layer | Case | Expected evidence |
| --- | --- | --- |
| Static/type/lint | Typecheck, lint, build, diff check | No type, lint, build, or whitespace errors |
| Unit | Service fee/total and exact integer snapshot reuse | Instruction amount equals frozen terms; no recalculation on retry |
| Unit | Receiving-account config and masking | Missing config fails closed; Buyer exact value; Seller masked value |
| Unit | Deadline calculation and WIB formatting with fixed clock | Exactly 24 hours from issuance; displayed timezone is WIB; no reset |
| Unit | Claim eligibility and state guards | Only Buyer, timely `WAITING_BUYER_PAYMENT`, expected version accepted |
| Unit | Expiry boundary | Before deadline remains waiting; at/after deadline expires; review state remains untouched |
| Integration | Final role-data completion | One atomic instruction, frozen snapshots, state transition, and audit event |
| Integration | Duplicate instruction issuance | Same result/instruction/deadline; no duplicate row or version drift |
| Integration | Duplicate and concurrent claim | PostgreSQL partial unique index prevents a second active row; one state transition; duplicate returns original result; conflict audited |
| Integration | Claim versus expiry race | Exactly one valid winner based on atomic state/deadline guard; no partial mutation |
| Integration | External fund observations | Simulated partial, excess, duplicate, and late funds do not create evidence, confirmation, deadline reset, fulfillment authorization, or a new state; Admin adjudication remains BAYAR-005 |
| Route | Participant and role authorization | Buyer exact read/claim; Seller masked read; unrelated/unauthenticated requests rejected |
| Route | Failed request/retry | Validation, stale version, expired, and network retry preserve state and support same idempotency key |
| Job | Rerun expiry runner | Already expired and under-review rows are unchanged; no duplicate audit transition |
| UI/manual | UI-SCR-009/010 states | Loading, disabled, error, retry, payable, payment-under-review, expired, unauthorized, keyboard focus, labels, and responsive states render in mobile-width surface; cancellation remains deferred/disabled only |
| Scope guard | Confirmation and review absence | No `PAYMENT_CONFIRMED`, bank review, refund, payout, group, or new state is produced |

## Risks And Safeguards

| Risk | Safeguard | Recovery/rollback |
| --- | --- | --- |
| Receiving-account configuration missing or changed | Validate at startup/issuance; snapshot exact values per transaction; never read mutable config for an existing instruction | Fix config and retry idempotent issuance only if no instruction exists; existing snapshot remains authoritative |
| Instructions issued twice | Transaction primary key, state guard, idempotency, and state-version update in one transaction | Retry same command; return existing instruction/result |
| Claim races with expiry | Both commands use atomic state/version/deadline predicates | Reload current state; retry only when still eligible; never create a second claim |
| Claim incorrectly treated as payment confirmation | Separate claim table/event and explicit `PAYMENT_UNDER_REVIEW` state | BAYAR-005 performs bank review; no automatic fulfillment/payout path exists here |
| Raw account leaks through logs or generic reads | Dedicated projection, safe audit payload, no raw value in idempotency result or validation report; `.env.example` contains placeholders only and real local values remain in ignored `.env` | Rotate local fixture/config if accidentally exposed; inspect and remove only non-authoritative local logs |
| Scheduler unavailable | Deterministic service, rerunnable job key, and operational monitoring contract | Re-run the job; optional lazy read may surface stale state but cannot create a second transition |
| Existing BAYAR-003 transactions have incomplete data | Require both participant snapshots and preserve current state | Continue collecting role data; do not create payment instructions prematurely |

## Plan Completion Check

- [x] Every BAYAR-004 acceptance criterion maps to a planned change and verification.
- [x] Every relevant UX transition and UI state maps to a planned change and verification.
- [x] Dependencies and migration order are explicit.
- [x] Receiving-account source, API routes, and expiry mechanism are concrete.
- [x] One active claim is enforced by a mandatory PostgreSQL partial unique index and concurrent test.
- [x] Expiry uses atomic transaction predicates and writes audit only after a successful update; no system actor is introduced.
- [x] Partial, excess, duplicate, and late funds have explicit non-authoritative tests and remain BAYAR-005 review inputs.
- [x] UI-SCR-021 is limited to a deferred/disabled boundary with no cancellation implementation.
- [x] Local receiving-account placeholders, missing-config validation, and raw-value safety checks are defined.
- [x] Failure, retry, idempotency, concurrency, and recovery behavior are covered.
- [x] Bank review, confirmation, refund, payout, and later tickets are excluded.
- [x] No new product role, transaction state, or financial result is introduced.
- [x] No unresolved product decision blocks implementation planning.

## Traceability Summary

```text
Requirements: UR-BUYER-004, UR-BUYER-005, UR-BUYER-009,
UR-SYSTEM-004..UR-SYSTEM-007, UR-PARTICIPANT-001,
UR-BR-008, UR-BR-009, UR-BR-010, UR-BR-030, UR-BR-031, UR-BR-034

UX: UX-FLOW-013, UX-FLOW-014, UX-FLOW-044, UX-FLOW-045,
UX-FLOW-046, UX-FLOW-048

UI: UI-SCR-009, UI-SCR-010, UI-SCR-021

QA: QA-PAY-001, QA-PAY-002, QA-PAY-003, QA-PAY-009,
QA-EXP-001, QA-EXP-002, QA-UI-002

TRD: Sections 6, 7, 8, 9, 12, 13, and 16
```

## Status

```text
Implementation plan: Draft
Ready for Plan Review: Yes
```
