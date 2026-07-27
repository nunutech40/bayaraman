# BAYAR-004 Codebase Research

## Task

```text
Ticket ID/title: BAYAR-004 — Payment Instructions, Sudah Bayar Claim,
and Original Expiry
Requested outcome: Enable a completed transaction to receive immutable
payment instructions, allow the Buyer to submit one idempotent Sudah Bayar
claim, and expire unpaid transactions at the original 1x24-hour deadline.
Source requirements: UR-BUYER-004, UR-BUYER-005, UR-BUYER-009,
UR-SYSTEM-004 through UR-SYSTEM-007, UR-PARTICIPANT-001,
UR-BR-008, UR-BR-009, UR-BR-010, UR-BR-030, UR-BR-031, UR-BR-034
Source UX Flow/UI/QA IDs: UX-FLOW-013, UX-FLOW-014, UX-FLOW-044,
UX-FLOW-045, UX-FLOW-046, UX-FLOW-048; UI-SCR-009, UI-SCR-010,
UI-SCR-021; QA-PAY-001 through QA-PAY-003, QA-PAY-009,
QA-EXP-001, QA-EXP-002, QA-UI-002
```

## Relevant Context Read

| File/doc | Why it is relevant | Key constraint found |
| --- | --- | --- |
| `AGENTS.md` | Repository workflow and context boundary | Work on one ticket; use approved ticket/design inputs; do not infer product behavior from prototype |
| `docs/engineering/tickets/BAYAR-004-payment-instructions-sudah-bayar.md` | Ticket scope and acceptance criteria | Payment instructions and claim only; bank review, confirmation, refund, and payout are out of scope |
| `TRD.md` sections 6, 7, 8, 9, 12, 13, 16 | Approved state, data, API, UI, job, concurrency, and test contracts | Both role datasets transition to `WAITING_BUYER_PAYMENT`; claim transitions to `PAYMENT_UNDER_REVIEW`; original deadline is immutable; expiry does not bypass a timely claim |
| `docs/product/03-user-requirements.md` | Requirement behavior | Exact amount and BayarAman destination are shown to Buyer; claim is not confirmation; late/not-found behavior remains manual/exception handling |
| `docs/product/04-ui-ux-spec.md` | Payment screen states | `UI-SCR-010` owns Buyer instructions and claim; loading, error, disabled, expired, and manual-review states are required |
| `docs/product/05-qa-scenarios.md` | Executable coverage | Payment claim, unchanged deadline, partial top-up, exception inputs, and expiry scenarios must remain distinguishable |
| `src/server/db/schema.ts` | Existing persistence | `payment_instructions` and `payment_claims` already exist; there is no claim uniqueness or deadline job implementation yet |
| `src/server/domain/transaction/state.ts` | State vocabulary | Approved transaction states and financial result vocabulary already exist; no new state may be added |
| `src/server/transaction/service.ts` | BAYAR-003 transition/data pattern | Transaction mutation uses Drizzle transactions, idempotency, audit events, and optimistic state versioning |
| `src/server/transaction/read.ts` | Participant read/masking pattern | Participant-only reads and masked bank/contact projections already exist; payment read must extend this boundary without exposing unrelated raw data |
| `src/app/transactions/[id]/page.tsx`, `src/components/transactions/status.tsx` | Current UI surface | Current status page explicitly says payment instructions are not yet implemented; it has a basic mobile-width shell and no payment action |

## Current Behavior

- Entry point: an authenticated, verified Buyer or Seller opens
  `/transactions/[id]`. BAYAR-003 exposes transaction status and role-owned
  data only.
- When both parties and role-owned data are complete, the API returns
  `readyForPaymentInstructions: true`, but the transaction remains
  `WAITING_COUNTERPARTY_DATA`.
- No code currently creates a `payment_instructions` row, freezes item/terms
  snapshots, starts an expiry deadline, or transitions to
  `WAITING_BUYER_PAYMENT`.
- No API route currently reads payment instructions or accepts
  `Sudah Bayar`.
- No expiry job, lazy expiry read, scheduler abstraction, or WIB clock helper
  exists under `src/server/jobs/` or another equivalent module.
- The existing transaction service demonstrates the required transaction,
  state-version, idempotency, and append-only audit patterns, but it does not
  contain payment behavior.
- The current transaction UI is functional but intentionally basic. It uses
  the constrained mobile-width `.app-shell`; the approved visual prototype
  has not yet been fully ported.

## Code Map

| Responsibility | Existing file/module | Symbol/route | Notes |
| --- | --- | --- | --- |
| Transaction states and optimistic version | `src/server/domain/transaction/state.ts` | `TRANSACTION_STATES`, `assertExpectedStateVersion` | Reuse `WAITING_BUYER_PAYMENT`, `PAYMENT_UNDER_REVIEW`, and `PAYMENT_EXPIRED` only |
| Payment instruction persistence | `src/server/db/schema.ts` | `paymentInstructions` | One row per transaction; currently stores masked destination, amount, issued time, and deadline |
| Payment claim persistence | `src/server/db/schema.ts` | `paymentClaims` | Has claim ID, transaction, submitter, timestamp, active flag, metadata; no service uses it yet |
| Existing payment review persistence | `src/server/db/schema.ts` | `paymentReviews` | Exists for BAYAR-005; do not implement bank review here |
| Transaction mutation | `src/server/transaction/service.ts` | `createTransaction`, `joinInvitation`, `saveRoleData` | Provides Drizzle transaction and state-version mutation examples |
| Transaction reads | `src/server/transaction/read.ts` | `readTransaction` | Participant authorization and masked projections; payment projection belongs here or a focused read module |
| Idempotency | `src/server/transaction/mutation.ts` | `findIdempotentResult`, `saveIdempotentResult` | Reuse for instruction issuance and payment claim commands |
| Audit | `src/server/transaction/audit.ts` | `recordTransactionEvent` | Reuse for `PAYMENT_INSTRUCTIONS_ISSUED`, `PAYMENT_CLAIM_SUBMITTED`, and `PAYMENT_EXPIRED` |
| Transaction API | `src/app/api/transactions/[id]/route.ts` | `GET` | Existing authorized transaction read route |
| Role-data API | `src/app/api/transactions/[id]/role-data/route.ts` | `GET`, `PATCH` | Existing participant mutation/error mapping pattern |
| Transaction page | `src/app/transactions/[id]/page.tsx` | Server page | Existing transaction detail entry point |
| Transaction status UI | `src/components/transactions/status.tsx` | `TransactionStatus` | Current UI must gain payment instruction/claim states without adding admin review |
| Database migration | `drizzle/0000_open_kinsey_walden.sql`, `drizzle/0001_uneven_bedlam.sql` | Generated migrations | Payment tables are already present in the local schema; plan must verify whether any constraint migration is required |

## Existing Patterns To Reuse

- **Validation:** Zod schemas in `src/server/transaction/contracts.ts`, with
  route-level `safeParse` and generic user-safe error responses.
- **Data access:** Drizzle query/transaction APIs through `src/server/db`.
  State and data mutations must be atomic.
- **Authorization:** `requireAuthenticatedAccount` plus participant ownership;
  only the Buyer participant may submit a payment claim.
- **State changes:** Read current transaction, validate expected state version,
  update state and version in one database transaction, and audit the result.
- **Idempotency:** Require `Idempotency-Key`, hash the request body, return the
  original result for a duplicate key, and reject a changed request hash.
- **UI:** Existing `.app-shell`, `.surface`, and transaction status component;
  preserve the approved mobile-width web surface while adding payment states.
- **Loading/error/recovery:** Client components use local busy/message state;
  server errors preserve the current trusted transaction state and allow retry
  with the same idempotency key.
- **Testing:** Vitest unit tests in `tests/unit`; database/integration tests
  should use the local PostgreSQL container and fixed clocks for deadlines.

## Change Surface

| Area | Likely change? | Reason/risk |
| --- | --- | --- |
| UI | Yes | Add `UI-SCR-010` payment instructions, claim action, countdown/deadline, disabled/loading/error/expired/review states; preserve mobile-width shell |
| API | Yes | Add authorized payment-instruction read and Buyer-only `Sudah Bayar` mutation route; exact route names must be finalized in the plan against TRD |
| State | Yes | Add only approved transitions: `WAITING_COUNTERPARTY_DATA` -> `WAITING_BUYER_PAYMENT`, `WAITING_BUYER_PAYMENT` -> `PAYMENT_UNDER_REVIEW`, and unpaid expiry -> `PAYMENT_EXPIRED` |
| Database | Maybe | Existing tables cover the core rows; likely add constraints/indexes or immutable snapshot fields only if the plan finds a concrete gap |
| Auth | No | Reuse verified session and participant authorization from BAYAR-002/BAYAR-003 |
| Jobs/integrations | Yes | Add deterministic expiry command/job boundary; no bank reconciliation, WhatsApp provider, or money movement integration |
| Tests/docs | Yes | Add unit/integration tests, fixed-WIB deadline tests, and `docs/execution/BAYAR-004/04-validation.md` after implementation |

## Unknowns And Assumptions

| Item | Can be inferred safely? | Evidence or decision needed |
| --- | --- | --- |
| How payment instructions are issued | Yes, at implementation level | Approved TRD transition says the system issues them once both role datasets are complete; the plan must make this one atomic command/transition |
| Exact BayarAman receiving account source | No | Product requires an exact destination, while the current `payment_instructions` table stores only a masked destination. Plan must define a server-side/configured source and its safe projection; do not invent a new product rule |
| Public API route names | Partly | TRD defines the interface boundary but not every exact path for payment read/claim. Plan must choose concrete paths consistent with existing `/api/transactions/[id]` routing |
| Whether issuance is lazy or explicit | Yes, with technical choice | Product behavior requires instructions when payable; plan should choose an idempotent service invoked from role-data completion and/or a safe lazy repair path, without issuing twice |
| Expiry execution mechanism | No implementation exists | Plan must choose a local-testable job function plus production scheduler contract; lazy read may be a recovery guard but must not replace the due-time sweep requirement |
| Claim metadata | Yes, narrowly | Claim may store submitted timestamp and optional non-authoritative note/metadata; no bank evidence or payment confirmation belongs here |
| Partial, excess, duplicate, or late funds | Yes | Preserve them as future Admin exception inputs; BAYAR-004 must never mark `PAYMENT_CONFIRMED` or implement bank review |
| Deadline timezone | Yes | Store an absolute timestamp and calculate from issuance using the approved 1x24-hour rule; render WIB and test with fixed clocks |
| Payment instruction account visibility | No | Buyer needs the exact receiving destination; Seller/Admin view must follow the approved sensitive-data boundary. Plan must specify raw/masked projection explicitly |

## Research Conclusion

```text
Recommended implementation boundary:
Add a focused payment instruction/claim service, authorized read and claim
routes, an atomic payable transition from completed role data, immutable
payment snapshot/deadline handling, and a deterministic expiry job boundary.
Extend the existing transaction status UI only for the approved payment
states. Keep bank review, payment confirmation, exception adjudication,
refund, payout, WhatsApp, and notification delivery outside BAYAR-004.

Main risks:
The current payment instruction schema does not retain an exact receiving
account value, and no scheduler/clock abstraction exists. Incorrect ordering
could issue instructions twice, reset the deadline, expire an active claim,
or expose raw financial data. State-version and idempotency handling must cover
instruction issuance, claim submission, and expiry.

Files likely affected:
`src/server/db/schema.ts` only if a concrete schema gap is confirmed,
`src/server/transaction/`, `src/app/api/transactions/`,
`src/app/transactions/[id]/page.tsx`, `src/components/transactions/status.tsx`,
`src/app/globals.css`, tests, and a new focused job/clock module.

Ready to plan: Yes, with the exact receiving-account projection and expiry
execution mechanism recorded as implementation-plan decisions. No product
decision is currently required to begin planning.
```
