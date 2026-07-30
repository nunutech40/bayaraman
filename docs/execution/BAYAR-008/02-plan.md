# Implementation Plan: BAYAR-008

## Task

```text
Ticket ID/title: BAYAR-008 - Admin Payout, Refund, and Split Financial Operations
Outcome: Admin can execute an eligible Seller payout, Buyer refund, or approved
split against frozen destinations with explicit authorization, atomic source
claiming, server-side re-authentication, idempotent recovery, and immutable
financial evidence.
Source research: docs/execution/BAYAR-008/01-research.md
Source plan review: docs/execution/BAYAR-008/03-plan-review.md
Source requirements and QA: UR-ADMIN-006..011, UR-ADMIN-016..019,
UR-FINANCIAL-001..003, UR-BR-038..043, UR-BR-045;
QA-FIN-001..008, QA-SEC-003, QA-SLA-002
Source UX/UI: UX-FLOW-025..031, UX-FLOW-040..043,
UX-FLOW-058..060, UX-FLOW-069..071;
UI-SCR-015, UI-SCR-016, UI-SCR-018, UI-SCR-019, UI-SCR-020
Source technical design: PRD.md v0.2 Approved; TRD.md v1.2 Approved
```

Version: 0.1
Status: Draft
Depends on: BAYAR-007, BAYAR-009, BAYAR-010, BAYAR-011
Blocks: BAYAR-012

## Scope

### In Scope

- Normal Seller payout from `READY_FOR_PAYOUT` after Buyer confirmation or an
  approved controlled exception, with hold checks, a frozen Seller destination,
  internal Admin assignment, and server-side payout re-authentication.
- Buyer refund through Midtrans when server-side capability is supported, or
  through the approved manual Admin fallback when unsupported.
- Complaint, risk, funded-cancellation, and late-fund handoff consumption.
- Approved split settlement with exact amount validation and Buyer leg before
  Seller leg.
- Two distinct Admin approvals where required by the approved product rules.
- Results limited to `PROCESSING`, `SUCCESS`, `FAILED`, and `UNKNOWN`, including
  safe retry, reconciliation-before-retry, state-version guards, idempotency,
  audit, and immutable success evidence.
- Admin financial-operation API and mobile-width UI states for preparation,
  approval, re-authentication, execution, retry, and reconciliation.

### Out Of Scope

- Midtrans invoice creation, payment authority, webhook processing, payment
  expiry, or normal payment reconciliation.
- Buyer confirmation, OTP, or controlled-exception decisioning owned by
  BAYAR-007.
- Complaint agreement owned by BAYAR-009, cancellation/refund eligibility
  owned by BAYAR-010, or risk review owned by BAYAR-011.
- WhatsApp checkpoints, cancellation policy, complaint/risk adjudication,
  destination replacement, or automatic payout.
- Notification scheduling and escalation jobs owned by BAYAR-012.
- Midtrans production calls or real-money execution in tests.
- New product roles, transaction states, or financial results.

## Approved Implementation Decisions

1. **Dependency closure:** BAYAR-007, BAYAR-009, BAYAR-010, and BAYAR-011
   are implemented and validated. BAYAR-008 consumes their current code and
   persistence contracts and does not recreate their authority rules.

2. **Normal payout source:** Normal payout does not create or consume a
   financial handoff. The source is the locked transaction in
   `READY_FOR_PAYOUT`, valid confirmation or approved controlled-exception
   evidence, no active hold, and the locked Seller-owned payout destination.
   Midtrans settlement alone never qualifies or starts payout.

3. **Internal Admin assignments:** `accounts.isAdmin` remains the only product
   Admin role. Add internal assignment scopes `FINANCIAL_PREPARE`,
   `FINANCIAL_APPROVE`, `FINANCIAL_EXECUTE`, and `FINANCIAL_RECONCILE`.
   These are permissions under Admin, not product roles. Financial
   authorization reads only active, non-revoked rows from
   `admin_task_assignments`; legacy `accounts.adminTaskAssignment` is
   compatibility/audit metadata and cannot grant financial access.

4. **Two-Admin approval:** Refund, split, controlled-exception, risk outcome,
   and transfers above Rp1,000,000 require two distinct Admin approvals. An
   executor may be one approver only when that account also has
   `FINANCIAL_EXECUTE`. Approval is append-only and bound to operation and
   expected state version.

5. **Atomic handoff adapter:** Complaint, risk, funded-cancellation, and
   late-fund routes use a source adapter with caller-owned transaction
   `readForUpdate()` and `claim()` operations. Complaint uses
   `readComplaintHandoffForUpdate`/`claimComplaintHandoff`; risk uses
   `readRiskRefundHandoffForUpdate`/`claimRiskRefundHandoff`; BAYAR-008 adds
   cancellation read/claim functions over `cancellation_financial_handoffs`.

6. **Normalized source contract:** Complaint and risk adapters map
   `calculationHash` to `sourceHash` and `approvedAt` to
   `sourceFinalizedAt`. Funded-cancellation and late-fund adapters use native
   `sourceHash` and `sourceFinalizedAt`. Legacy source-specific names remain
   private to their adapters and never enter the normalized contract.

7. **Prepared operation persistence:** A root operation awaiting approval,
   re-authentication, or execution is persisted with `result IS NULL`,
   `prepared_at IS NOT NULL`, and null `started_at`/`completed_at`. This is a
   derived internal lifecycle, not a financial result or transaction state.
   Execution atomically changes null result to `PROCESSING` and fills
   `started_at`. Recording `SUCCESS`, `FAILED`, or `UNKNOWN` fills
   `completed_at`. Active-operation uniqueness covers null, `PROCESSING`, and
   `UNKNOWN`.

8. **Server-side re-auth grant:** Ordinary payout uses a five-minute
   `financial_operation_reauth_grants` record bound to operation, Admin, and
   SHA-256 current-session ID hash. The re-auth endpoint returns only
   `{ reauthenticated: true, expiresAt }` with `Cache-Control: no-store`.
   Payout receives no proof token and atomically consumes the matching grant
   while changing the prepared operation to `PROCESSING`. The MVP guarantee is
   limited to a currently valid JWT, matching session hash, expiry, explicit
   operation invalidation, and atomic consume. Clearing the session cookie
   makes the grant inaccessible. Global session-revocation and password-change
   revocation remain future auth integrations.

9. **Refund capability authority:** The service validates the invoice's
   `authoritativeProviderEventId`, same invoice/provider, `settlement`,
   `fraud_status=accept`, `validation_outcome=ACCEPTED`, order ID, amount, and
   currency and hashes that snapshot before asking a provider-neutral adapter
   for `SUPPORTED`, `UNSUPPORTED`, or `UNKNOWN` outside any database
   transaction. A final transaction re-locks and revalidates the exact
   invoice/event/source snapshot before persisting the assessment, creating a
   prepared operation, and claiming the source. Supported selects Midtrans;
   unsupported selects the frozen Buyer manual fallback; unknown persists only
   an assessment, does not create an operation, and does not claim the source.

10. **Immutable route and attempt:** A selected refund route, amount,
    destination, source snapshot, and external key remain unchanged on retry.
    Every attempt uses `BAYAR-008:<operationId>:<attempt>`. A retry creates a
    new attempt row whose `retry_of_operation_id` points to the prior attempt
    and whose `root_operation_id` remains the first prepared operation.
    Approvals, source claim, and capability selection attach to the root and
    are not repeated. `FAILED` may retry; `UNKNOWN` must reconcile first.

11. **Terminal rule:** Only `SUCCESS` with immutable external reference and
    evidence hash produces `PAID_OUT`, `REFUNDED`, or, after both ordered legs
    succeed, `SPLIT_SETTLED`.

12. **Split rule:** The split pool is `item_price + shipping_cost` in IDR
    minor units. Buyer and Seller portions must equal that pool exactly.
    Service fee is outside the pool. Buyer leg executes first; Seller leg is
    disabled until Buyer `SUCCESS`.

13. **Migration identity:** Use
    `drizzle/0013_bayar008_financial_operations.sql`; migrations through
    BAYAR-010 already occupy `0012`.

14. **External-operation protocol:** Preparation never performs external
    money movement. Capability lookup is also outside database transactions.
    Final preparation revalidates all hashes and versions atomically. Execution
    changes the prepared null result to `PROCESSING`, fills `started_at`, and
    persists its external key before calling the fake/provider/manual adapter.
    Result recording is a separate conditional transaction. Crash-window
    recovery looks up the immutable external key/reference before retry.

15. **SLA handoff:** Expose only `operationId`, `eligibleAt`, `approvalAt`,
    `targetAt`, `result`, and `handledAt` to BAYAR-012. Store absolute
    timestamps and render WIB; BAYAR-008 creates no scheduler.

## Dependency And Source Ownership

| Source | Implemented owner | BAYAR-008 consumption |
| --- | --- | --- |
| Normal payout | BAYAR-007 transaction readiness | Lock transaction, verify confirmation/approved exception and holds; no handoff row |
| Complaint release/refund/split | BAYAR-009 complaint agreement | Existing complaint read-for-update and claim functions |
| Risk Buyer refund | BAYAR-011 risk review | Existing risk read-for-update and claim functions |
| Funded cancellation refund | BAYAR-010 cancellation approval | New cancellation adapter over existing immutable handoff |
| Late-fund refund | BAYAR-010 provider resolution | Same cancellation adapter with `sourceType=LATE_FUND` |

The source owner decides eligibility and publishes immutable evidence.
BAYAR-008 may reject a stale or invalid source but may not amend its outcome.

### Source/Outcome Matrix

| Source | Allowed outcome | Operation/state/destination guard |
| --- | --- | --- |
| Normal payout | No handoff outcome | `READY_FOR_PAYOUT`; valid confirmation or approved exception; no active hold; locked Seller destination |
| Complaint | `SELLER_RELEASE` | Payout from `READY_FOR_PAYOUT`; locked Seller destination |
| Complaint | `BUYER_REFUND` | Refund from `REFUND_READY`; locked Buyer destination |
| Complaint | `SPLIT` | Split root from `PAYOUT_ON_HOLD`; locked Buyer and Seller destinations |
| Risk | `BUYER_REFUND` only | Refund from `REFUND_READY`; all other outcomes rejected |
| Funded cancellation | `BUYER_REFUND` only | Refund from `REFUND_READY`; `calculationId`, `sourceHash`, and `sourceFinalizedAt` required |
| Late fund | `BUYER_REFUND` only | Refund from `REFUND_READY`; null `calculationId`, required `paymentReconciliationId`, `sourceHash`, and `sourceFinalizedAt`; no transaction revival |

Source/outcome, operation type, source state, destination binding,
amount/currency, source hash, and finalization timestamp are validated before
operation creation. Impossible combinations are rejected and audited.

## Handoff Adapter Contract

```ts
type FinancialHandoffSource =
  | "COMPLAINT"
  | "RISK"
  | "FUNDED_CANCELLATION"
  | "LATE_FUND";

type NormalizedFinancialHandoff = {
  handoffId: string;
  transactionId: string;
  sourceType: FinancialHandoffSource;
  outcome: "SELLER_RELEASE" | "BUYER_REFUND" | "SPLIT";
  buyerAmount: number;
  sellerAmount: number;
  currency: "IDR";
  sourceHash: string;
  sourceFinalizedAt: Date;
  sourceState: string;
  sourceStateVersion: number;
  evidenceReference: string;
  evidenceHash: string;
  buyerDestinationBindingId: string | null;
  sellerDestinationBindingId: string | null;
  consumedByOperationId: string | null;
  consumedAt: Date | null;
};

interface FinancialHandoffAdapter {
  readForUpdate(
    tx: DatabaseTransaction,
    handoffId: string,
    transactionId: string
  ): Promise<NormalizedFinancialHandoff>;

  claim(
    tx: DatabaseTransaction,
    input: {
      handoffId: string;
      transactionId: string;
      parentOperationId: string;
      expectedSourceStateVersion: number;
      actorAccountId: string;
      correlationId: string;
    }
  ): Promise<NormalizedFinancialHandoff>;
}
```

Cross-source referential integrity is adapter/service-enforced. Source-owned
`consumedByOperationId` and `consumedAt` prove consumption. Complaint and
cancellation retain their restrictive operation FKs. Migration `0013` adds a
restrictive risk-handoff operation FK if it is absent. No generic polymorphic
FK or shared `financial_handoffs` table is introduced.

## Atomic Claim Transaction

For complaint, risk, funded cancellation, and late fund:

1. Start a database transaction and lock the BayarAman transaction.
2. Lock the selected source row through `readForUpdate`.
3. Validate transaction/source state and version, outcome, amount, currency,
   destination binding, source hash, evidence, and finalization timestamp.
4. Insert the parent `financial_operations` row and frozen source snapshot.
5. Call source `claim()` with the parent operation ID.
6. Write sanitized append-only operation and source-claim audit.
7. Commit once.

If any step fails, parent operation, claim, and accepted audit roll back
together. There is no orphan operation or consumed source. A same-parent retry
returns the existing operation. A competing parent, stale version,
cross-transaction source, or hash mismatch is rejected and audited through the
separate sanitized rejection-audit boundary.

Refund preparation performs its provider capability lookup before this atomic
transaction. The final transaction then repeats all source, invoice, event,
hash, and version checks before inserting the prepared root and claiming the
handoff. No provider call runs while a database transaction or row lock is
held.

## Re-authentication Contract

`financial_operation_reauth_grants` fields:

- `id`
- `financialOperationId`
- `adminAccountId`
- `sessionIdHash`
- `grantedAt`
- `expiresAt`
- `consumedAt`
- `invalidatedAt`
- `stateVersion`
- `idempotencyKey`
- `createdAt`

`POST /api/admin/financial-operations/[id]/reauth` verifies the submitted
password using the existing Argon2id service and the authenticated session.
The server stores only the session ID hash and returns the grant status and
expiry with `Cache-Control: no-store`.

`POST /api/admin/financial-operations/[id]/payout` accepts no challenge or
proof. It locates a grant matching operation, Admin, and current session hash,
then consumes it atomically with the operation transition. The predicate
requires `consumedAt IS NULL`, `invalidatedAt IS NULL`, `expiresAt > now()`,
matching grant/operation versions, a valid current JWT, and a still-prepared
eligible operation. The same transaction sets `result=PROCESSING`,
`started_at`, the external idempotency key, and execution audit. Replay, wrong
session/Admin/operation, expiry, concurrent consume, stale/rejected operation,
or explicit operation invalidation rejects the payout. A payout retry requires
a new grant. The current codebase has no persisted global session-revocation or
password-change boundary; those integrations are not claimed by BAYAR-008.

## Admin Authorization Matrix

| Action | Product authorization | Required internal scope | Additional guard |
| --- | --- | --- | --- |
| Read financial operation | `isAdmin=true` | Any active financial scope | Masked projection only |
| Prepare operation | `isAdmin=true` | `FINANCIAL_PREPARE` | Eligible current state/source |
| Approve refund/split/exception | `isAdmin=true` | `FINANCIAL_APPROVE` | Two distinct Admins |
| Execute payout/refund/split | `isAdmin=true` | `FINANCIAL_EXECUTE` | Approval and/or re-auth complete |
| Reconcile `UNKNOWN` | `isAdmin=true` | `FINANCIAL_RECONCILE` | Exact operation attempt/reference |

Revoked/missing assignments reject and audit. Assignment labels remain
internal Admin permissions rather than Buyer/Seller/Admin role additions.
Every financial check queries active `admin_task_assignments` rows with
`revokedAt IS NULL`. `accounts.adminTaskAssignment` is never consulted for
financial authorization.

## Refund Capability Contract

```ts
type RefundCapability = "SUPPORTED" | "UNSUPPORTED" | "UNKNOWN";

interface RefundProviderAdapter {
  getRefundCapability(input: {
    provider: "MIDTRANS";
    providerOrderId: string;
    authoritativeProviderEventId: string;
    amount: number;
    currency: "IDR";
  }): Promise<{
    capability: RefundCapability;
    evidenceReference: string | null;
    checkedAt: Date;
  }>;

  refund(input: RefundRequest): Promise<FinancialOperationResult>;
}
```

Capability orchestration has three explicit phases:

1. **Snapshot preparation:** Read transaction, handoff, invoice, and canonical
   provider event without a long-lived lock. Validate provider, invoice/event
   relationship, settlement/accept/accepted status, order ID, amount, and IDR.
   Hash transaction ID, handoff ID, source hash/version, invoice ID,
   authoritative event ID, order ID, amount, and currency into
   `capabilitySnapshotHash`.
2. **Provider lookup:** Call the fake/provider adapter outside every database
   transaction. Timeout, malformed response, and outage normalize to
   `UNKNOWN`.
3. **Final transaction:** Lock transaction, source handoff, invoice, and
   authoritative event; recompute the hash and reject any changed source or
   authority. Append the assessment. `UNKNOWN` commits only the assessment.
   `SUPPORTED` or `UNSUPPORTED` inserts a prepared root with `result IS NULL`,
   selects `MIDTRANS_REFUND` or `MANUAL_REFUND`, claims the source, stores the
   selected assessment ID, writes audit, and commits once.

`refund_capability_assessments` is standalone and append-only. It stores
transaction/source type/handoff/hash/version, invoice and authoritative event,
provider order, amount/currency, snapshot hash, capability, checked time,
evidence reference/hash, correlation, actor, idempotency key, and creation
time. The assessment does not require an operation FK; a prepared operation
points to its selected definitive assessment.

Same idempotency key and request hash return the same assessment/result; a hash
conflict is rejected. `UNKNOWN` may be reassessed with a new key. During
competing definitive lookups, the final source lock selects one operation;
an identical loser receives that operation and a conflicting loser is
rejected/audited. After operation creation the route is immutable. Tests use a
fake adapter only.

## Planned Changes

| Step | Change | File/module | Acceptance/traceability | Verification |
| --- | --- | --- | --- | --- |
| 1 | Add additive migration `0013`; make operation result nullable while prepared; add prepared/started/completed, retry/root/source snapshot, selected capability, task scopes, constraints, triggers, and risk handoff FK | `src/server/db/schema.ts`, `drizzle/0013_bayar008_financial_operations.sql`, journal | AC-4/5, UR-BR-039..042, TRD 9/10 | Clean, preflight failure, collision, rerun, rollback, prepared lifecycle and direct-SQL guard tests |
| 2 | Define normalized finance, source adapter, capability, result, and masked DTO contracts | `src/server/finance/contracts.ts`, `handoff-adapter.ts`, `projection.ts` | AC-2/5, UR-BR-045, QA-SEC-003 | Type/contract tests and raw-data leakage assertions |
| 3 | Add cancellation read-for-update/claim adapter and compose existing complaint/risk adapters | `src/server/cancellation/handoff.ts`, `src/server/finance/handoff-adapter.ts` | AC-2/5, UX-FLOW-029/030/058/069 | Per-source claim, idempotency, concurrency, stale/cross-transaction tests |
| 4 | Implement normal payout and exception eligibility without a synthetic handoff | `src/server/finance/eligibility.ts`, `read.ts` | AC-1, UR-ADMIN-006/008 | Confirmation/exception, hold, destination, settlement-only rejection tests |
| 5 | Implement prepared root creation and atomic source claim with null result, source/outcome matrix, immutable snapshot, and rollback | `src/server/finance/service.ts`, `mutation.ts`, `audit.ts` | AC-3/5, QA-FIN-006/007 | Prepared-not-processing, no external call, no orphan, same-parent replay, competing claim and adapter misuse tests |
| 6 | Implement current-JWT/session-bound server-side re-auth grant and atomic prepared-to-processing consume | `src/server/finance/reauth.ts`, auth helpers | AC-1/3, UR-BR-039/040, QA-FIN-008 | Valid, expired, replayed, missing/wrong session/Admin/operation, retry grant and concurrent consume tests |
| 7 | Implement append-only approval and canonical `admin_task_assignments` authorization; explicitly ignore the legacy account field | `src/server/finance/approval.ts`, `authorization.ts` | AC-3, UR-ADMIN-009..011 | Two distinct Admins, duplicate/self approval, missing/revoked/wrong scope, legacy-only denial tests |
| 8 | Implement three-phase authoritative capability snapshot, unlocked provider lookup, final locked revalidation/assessment/claim, and immutable provider/manual route | `src/server/finance/refund.ts`, `src/server/providers/refund.ts`, fake adapter | AC-2/4, UR-FINANCIAL-001/002 | Supported/unsupported/unknown, timeout, authority/source race, competing assessment, crash window and immutable route tests |
| 9 | Implement payout execution and result recording | `src/server/finance/payout.ts`, provider-neutral payout/fake adapter | AC-1/4/5, QA-FIN-001..003 | Success/failed/unknown, evidence immutability, no automatic payout tests |
| 10 | Implement split calculation and ordered legs | `src/server/finance/split.ts`, `calculation.ts` | AC-3/4/5, QA-FIN-005 | Exact pool, Buyer-first, blocked Seller, retry/reconcile tests |
| 11 | Add concrete Admin APIs and sanitized error mapping | `src/app/api/admin/financial-operations/**` | TRD 11/12, QA-SEC-003 | Route auth, assignment, idempotency, stale-state and no-secret tests |
| 12 | Add mobile-width Admin financial operation UI | `src/app/admin/financial-operations/page.tsx`, Admin component | UI-SCR-015/016/018/019/020 | Loading, disabled, approval, re-auth, error, UNKNOWN, recovery, a11y checks |
| 13 | Expose read-only SLA DTO for BAYAR-012 | `src/server/finance/sla.ts` | UR-BR-043, QA-SLA-002 | Absolute timestamp/WIB projection and sensitive-field exclusion tests |

## Schema And Migration Plan

Migration `drizzle/0013_bayar008_financial_operations.sql` is additive and
performs:

1. Preflight duplicate active operations, external keys, invalid legacy
   operation values, duplicate approvals, inconsistent evidence, handoff
   claims, and risk references before DDL.
2. Start one DDL transaction.
3. Make `financial_operations.result` nullable for prepared rows. Add
   `prepared_at`, `started_at`, `retry_of_operation_id`,
   `root_operation_id`, source snapshot columns, route,
   `external_idempotency_key`, and selected capability assessment FK.
4. Add `financial_operation_approvals`,
   `financial_operation_reauth_grants`,
   `financial_split_calculations`, and
   `refund_capability_assessments`.
5. Backfill existing rows with explicit legacy-safe values.
6. Add account/operation FKs, including restrictive risk handoff FK.
7. Extend `admin_task_assignments` scope check with the four financial scopes.
8. Add named checks enforcing prepared
   (`result IS NULL`, prepared only), processing
   (`PROCESSING`, started and not completed), and final attempt
   (`SUCCESS|FAILED|UNKNOWN`, started and completed) shapes. Require reference
   and evidence for `SUCCESS`.
9. Replace the active-operation partial unique index so null prepared,
   `PROCESSING`, and `UNKNOWN` attempts are active. Add source/external-key
   uniqueness, retry/root consistency, split dependency, grant predicates, and
   nullability rules.
10. Add append-only triggers for approvals, capability assessments, and
   successful financial evidence.
11. Finalize defaults/nullability and commit.

Clean migration, collision/preflight failure, rerun, transactional rollback,
and documented recovery are required. Legacy rows are not deleted.

## API Contract

| Route | Required scope | Request | Success | Failure/recovery |
| --- | --- | --- | --- | --- |
| `GET /api/admin/financial-operations/[id]` | Any financial scope | Session, operation ID | Masked operation/approval/re-auth/result projection | Unauthorized or missing assignment is sanitized |
| `POST /api/admin/financial-operations` | `FINANCIAL_PREPARE` | `transactionId`, type, optional source handoff/split proposal, `Idempotency-Key`, expected state version | Normal payout creates a null-result prepared root; refund performs snapshot, unlocked capability lookup, then final revalidation/claim; UNKNOWN returns assessment only | Stale/missing/consumed source, capability UNKNOWN, hold, mismatch, duplicate conflict rejected or returned as reviewable assessment |
| `POST /api/admin/financial-operations/[id]/approve` | `FINANCIAL_APPROVE` | Decision, sanitized note, idempotency key, expected version | Append-only distinct approval | Duplicate/self/revoked assignment/stale version rejected |
| `POST /api/admin/financial-operations/[id]/reauth` | `FINANCIAL_EXECUTE` | Password, idempotency key | For a prepared eligible operation, server stores a current-JWT/session-bound grant and returns status/expiry only | Wrong password, missing/invalid session, stale/non-prepared operation, rate limit, duplicate conflict |
| `POST /api/admin/financial-operations/[id]/payout` | `FINANCIAL_EXECUTE` | Idempotency key, expected version | Server consumes matching grant and atomically changes null result to PROCESSING with started time/external key | Missing/expired/replayed grant, non-prepared attempt; FAILED retry requires new attempt/grant; UNKNOWN reconcile |
| `POST /api/admin/financial-operations/[id]/refund` | `FINANCIAL_EXECUTE` | Idempotency key, expected version | Uses immutable server-selected Midtrans/manual route | UNKNOWN capability blocks; FAILED retry; UNKNOWN result reconcile |
| `POST /api/admin/financial-operations/[id]/split` | `FINANCIAL_EXECUTE` | Idempotency key, expected version | Starts eligible ordered leg | Invalid total, missing approval, Buyer non-success blocks |
| `POST /api/admin/financial-operations/[id]/reconcile` | `FINANCIAL_RECONCILE` | Exact attempt/reference, normalized result, evidence hash, idempotency key, expected version | Resolves exact UNKNOWN attempt | Ambiguous evidence remains UNKNOWN |
| `POST /api/admin/financial-operations/[id]/retry` | `FINANCIAL_EXECUTE` | Idempotency key, expected version | Creates next linked attempt only after FAILED | UNKNOWN/SUCCESS/active/terminal retry rejected |

No route accepts a client-selected financial result, raw destination,
authoritative source snapshot, refund route, or client-side re-auth credential.

## State And Data Impact

Transition matrix:

| Flow | Prepared persistence | Processing | SUCCESS | FAILED | UNKNOWN |
| --- | --- | --- | --- | --- | --- |
| Payout | `READY_FOR_PAYOUT`, eligibility and frozen Seller snapshot; `result=NULL`; approval/re-auth UI enabled | Consume grant; fill started/external key; transaction -> `PAYOUT_PROCESSING` | Evidence/reference -> `PAID_OUT` | New linked prepared retry with same root snapshot and new grant | Reconcile before retry; no terminal state |
| Refund | `REFUND_READY`, definitive assessment, atomically claimed handoff, two approvals; `result=NULL` | Fill started/external key; transaction -> `REFUND_PROCESSING` | Evidence/reference -> `REFUNDED` | New linked prepared retry with same route/source snapshot | Reconcile before retry; no terminal state |
| Split Buyer | `PAYOUT_ON_HOLD`, claimed split handoff, exact calculation, two approvals; `result=NULL` | Fill started/external key; transaction -> `SPLIT_PROCESSING` | Buyer evidence unlocks Seller leg | New linked Buyer attempt only | Reconcile; Seller blocked |
| Split Seller | Buyer `SUCCESS`, same root/hash/version; linked Seller row starts prepared | Fill started/external key; remain `SPLIT_PROCESSING` | Both references -> `SPLIT_SETTLED` | New linked Seller attempt only | Reconcile; no terminal split |

All mutations use expected transaction/operation/source versions,
actor-scoped idempotency keys, request hashes, and append-only audit.
Participants receive masked summaries only. Raw destinations, provider
evidence, credentials, and internal assessment data remain server/Admin-only.
API and UI projections distinguish prepared, approval pending, re-auth
required, `PROCESSING`, `SUCCESS`, `FAILED`, and `UNKNOWN`. Prepared is derived
from a null result and is never displayed as transfer processing.

## Test Plan

| Layer | Cases | Expected evidence |
| --- | --- | --- |
| Static | Finance modules, route DTOs, task scopes, UI | Typecheck, lint, and build pass with no new product role/state/result |
| Migration | Clean, preflight collision, rerun, rollback, prepared/processing/final shapes, active index, constraints, triggers | OrbStack PostgreSQL proves nullable prepared result, lifecycle checks, additive migration, and direct-SQL guards |
| Source adapter | Complaint, risk, funded cancellation, late fund and invalid source/outcome combinations | Success, same-parent replay, competing/concurrent claim, stale version, cross-transaction, rollback, retention, normalized hash/time, direct misuse rejection |
| Prepared lifecycle | Duplicate/concurrent preparation, approval/re-auth before start, no adapter call, lifecycle projection | One null-result root; prepared is not processing; atomic null-to-PROCESSING transition |
| Payout | Confirmation and controlled exception | `READY_FOR_PAYOUT`, no synthetic handoff, current-session grant consumed once, retry requires new grant, only success terminal |
| Re-auth | Valid JWT/session, absent cookie, wrong credential, expiry, replay, wrong session/Admin/operation, explicit operation invalidation, concurrency | No proof token or unsupported global-revocation promise; no password/session raw value in response/log/audit |
| Authorization | Four canonical scopes, legacy-only field, revocation, wrong scope, two Admins | Only active `admin_task_assignments` grants access; duplicate/self approval rejected |
| Refund capability | Supported, unsupported, unknown, timeout, authority/source change during lookup, consumed-source race, duplicate/concurrent assessment, crash before final transaction | No network call under lock; UNKNOWN creates no operation/claim; definitive route is server-side and immutable |
| Financial recovery | FAILED, UNKNOWN, crash window, duplicate result | FAILED retry only; UNKNOWN reconciliation; external key prevents duplicate movement |
| Split | Calculation, ordering, dependency | Buyer-first and both immutable success references required |
| UI/security | UI-SCR-015/016/018/019/020 | Mobile-width states, masking, accessibility, disabled/error/recovery behavior |
| Regression | BAYAR-007/009/010/011 boundaries | Source owner authority unchanged; no automatic payout or scope BAYAR-012 |

Required source-claim tests for every adapter:

- Successful claim.
- Duplicate same-parent claim.
- Competing-parent and concurrent claim.
- Stale source state version.
- Cross-transaction operation.
- Rollback after claim failure.
- Source retention after operation creation.
- Immutable snapshot using `sourceHash` and `sourceFinalizedAt`.

## Individual Traceability Matrix

| Source ID | Planned steps/tests |
| --- | --- |
| Ticket AC-1 | Steps 4, 6, 9; payout eligibility, grant, immutable success tests |
| Ticket AC-2 | Steps 3, 8, 11; source claim, refund capability/manual fallback tests |
| Ticket AC-3 | Steps 5, 7, 10; atomic claim, two-Admin approval, split tests |
| Ticket AC-4 | Steps 1, 8, 9, 10; result/retry/UNKNOWN/evidence tests |
| Ticket AC-5 | Steps 1, 3, 5, 8, 9, 10; idempotency/concurrency/external-key tests |
| UR-ADMIN-006 | Steps 4, 6, 9; eligible payout and frozen Seller destination |
| UR-ADMIN-007 | Step 9; payout result/reference and `PAID_OUT` |
| UR-ADMIN-008 | Steps 4, 7, 11; approved exception eligibility |
| UR-ADMIN-009 | Steps 7, 11, 12; two-Admin approval |
| UR-ADMIN-010 | Steps 4, 7, 11; hold/exception authorization |
| UR-ADMIN-011 | Steps 4, 5, 7; disabled stale/missing authority |
| UR-ADMIN-016 | Steps 7, 8, 11; provider/manual refund |
| UR-ADMIN-017 | Steps 8, 11, 12; refund result/recovery |
| UR-ADMIN-018 | Steps 7, 10, 11; split approval/calculation |
| UR-ADMIN-019 | Steps 10, 11, 12; ordered split legs |
| UR-FINANCIAL-001 | Step 8; Midtrans/manual capability route |
| UR-FINANCIAL-002 | Steps 8, 9, 10; approved result vocabulary |
| UR-FINANCIAL-003 | Steps 4, 9; payout separated from settlement |
| UR-BR-038 | Step 10; exact split pool/hash |
| UR-BR-039 | Steps 6, 7, 11; assignment/re-auth/approval |
| UR-BR-040 | Steps 6, 7; threshold and two-Admin guard |
| UR-BR-041 | Steps 1, 5, 8, 9, 10; operation/external IDs |
| UR-BR-042 | Steps 1, 8, 9, 10; FAILED/UNKNOWN and immutable evidence |
| UR-BR-043 | Steps 1, 13; SLA timestamps |
| UR-BR-045 | Steps 2, 11, 12; masking and Admin boundary |
| UX-FLOW-025 | Steps 4, 9; payout eligibility |
| UX-FLOW-026 | Steps 9, 11, 12; payout result/recovery |
| UX-FLOW-027 | Steps 4, 7; controlled exception |
| UX-FLOW-028 | Steps 6, 11, 12; re-auth states |
| UX-FLOW-029 | Steps 3, 5, 7; complaint handoff |
| UX-FLOW-030 | Steps 3, 5, 7; risk handoff |
| UX-FLOW-031 | Steps 4, 9, 12; payout blocked/recovery |
| UX-FLOW-040 | Steps 3, 7, 8; refund handoff/route |
| UX-FLOW-041 | Steps 8, 11, 12; refund result |
| UX-FLOW-042 | Steps 3, 7, 10; split Buyer leg |
| UX-FLOW-043 | Steps 10, 11, 12; split Seller leg |
| UX-FLOW-058 | Steps 3, 5, 8; late-fund handoff |
| UX-FLOW-059 | Steps 3, 7, 8; cancellation refund |
| UX-FLOW-060 | Steps 8, 11, 12; late-fund recovery |
| UX-FLOW-069 | Steps 3, 5, 8; funded-cancellation handoff |
| UX-FLOW-070 | Steps 7, 8, 11; approved refund execution |
| UX-FLOW-071 | Steps 4, 8, 12; cutoff/disabled state |
| UI-SCR-015 | Steps 4, 7, 12; eligibility/approval |
| UI-SCR-016 | Steps 6, 9, 12; payout/re-auth |
| UI-SCR-018 | Steps 8, 12; refund route/recovery |
| UI-SCR-019 | Steps 10, 12; split |
| UI-SCR-020 | Steps 8, 9, 10, 12; result/evidence |
| QA-FIN-001 | Steps 4, 6, 9; payout success |
| QA-FIN-002 | Step 9; payout FAILED retry |
| QA-FIN-003 | Step 9; payout UNKNOWN reconciliation |
| QA-FIN-004 | Step 8; refund capability/results |
| QA-FIN-005 | Step 10; split calculation/order |
| QA-FIN-006 | Step 7; two-Admin authorization |
| QA-FIN-007 | Steps 3, 5, 8, 9, 10; concurrency/idempotency |
| QA-FIN-008 | Steps 6, 7, 11; re-auth and approval security |
| QA-SEC-003 | Steps 2, 6, 7, 11, 12; masking/sanitized audit |
| QA-SLA-002 | Steps 1, 12, 13; targets/WIB/BAYAR-012 DTO |
| PRD Sections 9/15 | Steps 1..13; functional and release acceptance suite |
| TRD Sections 9/10 | Steps 1, 3, 5, 8, 9, 10; schema/state/data safety |
| TRD Sections 11/12 | Steps 2, 6, 7, 8, 11; adapter/API/authorization |
| TRD Sections 13/14 | Steps 5, 6, 8, 9, 10, 12; recovery/security |

## Risks And Safeguards

| Risk | Safeguard | Recovery |
| --- | --- | --- |
| Duplicate money movement | Active-operation/index guards, source claim, idempotency, external key | Replay original result; UNKNOWN reconciliation before retry |
| Prepared operation appears as in-flight transfer | Null result plus prepared/started/completed checks and explicit projection | Reject invalid row; keep external adapter untouched |
| Orphan operation or consumed source | Parent insert and source claim in caller-owned transaction | Full rollback; separate sanitized rejection audit |
| Wrong source authority | Source-owned adapter, state/version/hash/time validation | Reject and return to owning workflow |
| Provider call holds DB locks or returns stale capability | Three-phase snapshot, unlocked lookup, final locked hash/version revalidation | UNKNOWN/changed snapshot creates no operation or claim; reassess |
| Re-auth token leakage/replay | Current-JWT/session-bound server grant; no proof token; five-minute TTL | Expire/explicitly invalidate and require new password verification |
| Unauthorized Admin or legacy-field bypass | `isAdmin` plus active canonical `admin_task_assignments`; legacy field ignored | Disable action and audit denial |
| Wrong refund route | Authoritative event validation, final revalidation, append-only assessment | UNKNOWN blocks operation and permits reassessment |
| False terminal result | SUCCESS plus immutable reference/evidence trigger | Remain non-terminal and reconcile |
| Seller split leg runs first | Persisted Buyer-leg dependency | Keep Seller leg disabled |
| Sensitive data exposure | Raw server projection separated from masked DTO | Block release until projection test passes |
| Scope leak | Upstream owners remain authoritative; BAYAR-012 owns jobs | Stop at ticket boundary |

## Plan Completion Check

- [x] Dependencies BAYAR-007/009/010/011 are recorded as implemented.
- [x] Normal payout uses `READY_FOR_PAYOUT` without a synthetic handoff.
- [x] Complaint, risk, funded-cancellation, and late-fund sources have atomic
  caller-owned read/claim contracts.
- [x] Cross-source snapshots use `sourceHash` and `sourceFinalizedAt`.
- [x] Same-parent, competing-parent, concurrency, rollback, and retention
  behavior is specified.
- [x] Prepared operations use `result IS NULL`; external execution alone
  changes the result to `PROCESSING`.
- [x] Active-operation uniqueness includes prepared, `PROCESSING`, and
  `UNKNOWN`; retries are linked and do not reclaim a source.
- [x] Re-authentication is a server-side operation/Admin/session-bound grant
  using the current valid JWT boundary, with no proof token in the client.
- [x] Unsupported global session/password revocation is deferred rather than
  claimed by this ticket.
- [x] Financial authorization uses only active `admin_task_assignments`;
  the legacy account field cannot grant access.
- [x] Refund capability has an authoritative provider-event source and
  three-phase unlocked lookup/final revalidation plus explicit routing.
- [x] UNKNOWN capability creates an assessment only and never creates or
  claims an operation.
- [x] Source/outcome compatibility is deterministic and tested.
- [x] Migration is additive and correctly numbered `0013`.
- [x] Results remain `PROCESSING`, `SUCCESS`, `FAILED`, and `UNKNOWN`.
- [x] Only immutable SUCCESS evidence can create financial terminal states.
- [x] No source authority, product role, transaction state, or financial
  result is added.
- [x] No Midtrans production call or BAYAR-012 scheduler is planned.
- [x] Every ticket acceptance criterion and relevant UR/UX/UI/QA/TRD source is
  mapped to a concrete step and test.

Status: Draft. Implementation must not start until the revised plan receives
an Approved Plan Review.
