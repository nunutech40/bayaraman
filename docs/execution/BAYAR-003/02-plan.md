# Implementation Plan

## Task

~~~text
Ticket ID/title: BAYAR-003 — Transaction Creation, Role-Owned Data, and Counterparty Join
Outcome: Let a verified account create a seller-created or buyer-created
physical-goods transaction, invite the opposite role, bind a distinct
verified account, and complete only its own role-owned data.
Source research: docs/execution/BAYAR-003/01-research.md
Source requirements and QA scenarios: UR-INIT-001..005,
UR-BUYER-001..003, UR-SELLER-001..003, UR-PARTICIPANT-001..003,
UR-SYSTEM-001, UR-BR-001, UR-BR-005..007;
QA-TRANS-001..006, QA-SEC-001, QA-UI-001
Source UX Flow and UI IDs/states: UX-FLOW-002..006, UX-FLOW-009..012;
UI-SCR-002..009
~~

## Scope

### In Scope

- Seller-created and buyer-created physical-goods transaction creation.
- Buyer/Seller participant binding with exactly two distinct accounts.
- Role-owned Buyer and Seller data collection and immutable transaction
  snapshots.
- Hashed, single-use, expiring invitation creation, join, revoke, and
  reissue.
- Transaction reads with participant ownership and sensitive-data masking.
- Approved pre-payment states: `WAITING_COUNTERPARTY` and
  `WAITING_COUNTERPARTY_DATA`.
- Derived readiness for BAYAR-004 without creating payment instructions or
  starting the payment deadline.
- Idempotency, state-version checks, append-only audit, and recovery paths.
- UI-SCR-002 through UI-SCR-009 in the existing constrained mobile-width
  desktop surface.

### Out Of Scope

- Creating or changing `payment_instructions`.
- `WAITING_BUYER_PAYMENT`, payment claim, `Sudah Bayar`, payment review,
  bank review, WhatsApp group, payout, refund, complaint, cancellation, or
  risk hold behavior.
- Payment deadline creation or expiry processing. BAYAR-004 owns the
  instruction and timer handoff.
- WhatsApp provider integration or automatic invitation delivery.
- Permanent Buyer/Seller account roles, Admin as a participant, or anonymous
  participation.
- Wallet, balance ledger, marketplace, or unrelated refactoring.

## Planned Changes

| Step | Change | File/module | Requirement/UX/UI/AC covered | Verification |
| --- | --- | --- | --- | --- |
| 1 | Add transaction-specific schema for item, shipping, and role-owned financial snapshots | `src/server/db/schema.ts`, `drizzle/*` | UR-SELLER-001..003, UR-BUYER-002..003, UR-PARTICIPANT-003; TRD data model; AC-1/2 | Migration inspection, foreign keys, unique transaction/participant constraints, owner/masked projection tests |
| 2 | Add transaction command schemas and approved calculation helpers | `src/server/transaction/schema.ts`, `src/server/transaction/calculation.ts` | UR-SYSTEM-001, UR-BR-005..007, UI-SCR-003/004/007/008; AC-1/2 | Zod field validation, physical-goods scope, Rp100,000-Rp5,000,000 item price, 2% fee min Rp10,000/max Rp50,000, total calculation |
| 3 | Implement server-authoritative transaction creation | `src/server/transaction/service.ts`, `src/server/domain/transaction/*` | UR-INIT-001/003, UR-SELLER-001, UR-BUYER-003, UR-BR-001; UX-FLOW-002/007; UI-SCR-002..004; AC-1 | Verified-account guard, Buyer/Seller creator validation, initial `WAITING_COUNTERPARTY`, atomic participant/terms/item/snapshot creation |
| 4 | Implement invitation token lifecycle | `src/server/transaction/invitation.ts` | UR-INIT-002/004/005; UX-FLOW-004/009; UI-SCR-005; AC-1/2 | Random token hash, raw token returned once, 3x24h expiry, revoke/reissue, no raw token logs, duplicate idempotency |
| 5 | Implement opposite-role invitation join | `src/server/transaction/join.ts` | UR-BUYER-001/002, UR-SELLER-002/003, UR-PARTICIPANT-001/002; UX-FLOW-005/006/010; UI-SCR-006..008; AC-2/3 | Distinct verified account, opposite role, same-account rejection, single-use atomic consume, `WAITING_COUNTERPARTY` -> `WAITING_COUNTERPARTY_DATA` |
| 6 | Implement role-data completion and snapshot locking boundary | `src/server/transaction/role-data.ts` | UR-BUYER-002/003, UR-SELLER-002/003, UR-PARTICIPANT-003; UX-FLOW-006/011/012; UI-SCR-007..009; AC-2/4 | Buyer address, Buyer/Seller ownership, verified WhatsApp snapshot, destination persistence, no cross-role mutation, derived payment-readiness without state/timer change |
| 7 | Implement authorized transaction reads and raw/masked projections | `src/server/transaction/read.ts`, `src/server/transaction/projections.ts`, `src/server/auth/authorization.ts` | UR-PARTICIPANT-001..003, UR-BR-001; UI-SCR-005/009; QA-SEC-001 | Participant/admin access checks, own raw destination only, other participant masked summary, Buyer address visibility, unauthorized/not-found behavior |
| 8 | Add idempotency, state-version, and audit persistence for transaction mutations | `src/server/transaction/mutation.ts`, `src/server/idempotency/*`, `src/server/audit/*` | UR-SYSTEM-001; QA-SEC-001, QA-TRANS-005/006; AC-3/4 | Duplicate same request returns same result, hash conflict rejects, stale version rejects, concurrent join/data write is audited |
| 9 | Add transaction and invitation API routes | `src/app/api/transactions/route.ts`, `src/app/api/transactions/[id]/route.ts`, `src/app/api/transactions/[id]/join/route.ts`, `src/app/api/transactions/[id]/role-data/route.ts`, `src/app/api/invitations/[token]/route.ts`, `src/app/api/invitations/[token]/join/route.ts`, `src/app/api/transactions/[id]/invitations/reissue/route.ts` | All ticket API actions; UX/UI IDs; AC-1..4 | Request-level authorization, token-param preview/join/reissue, validation, status/state-version response, safe errors, no payment endpoints |
| 10 | Wire role-start, creation, invitation, join, and role-data UI | `src/app/dashboard/page.tsx`, `src/app/transactions/*`, `src/components/transactions/*`, `src/app/globals.css` | UX-FLOW-002..006, UX-FLOW-009..012; UI-SCR-002..009; QA-UI-001 | Mobile-width render and loading, validation, duplicate, expired, wrong-account, unauthorized, waiting, success, and recovery states |
| 11 | Add transaction unit/integration/security tests | `tests/unit/transaction/*`, `tests/integration/transaction/*` | QA-TRANS-001..006, QA-SEC-001, QA-UI-001 | Both creation modes, invitation lifecycle, ownership, masking, idempotency, state conflict, concurrency, audit, and handoff boundary |
| 12 | Validate BAYAR-003 and document handoff | `docs/execution/BAYAR-003/04-validation.md` | Ticket Definition of Done and BAYAR-004 dependency | Typecheck, lint, build, tests, migration check, local PostgreSQL health, `git diff --check`, payment boundary assertion |

### Schema Plan

The existing `transactions`, `transaction_participants`, `transaction_terms`,
and `invitations` tables remain the aggregate foundation. Add only the
following ticket-owned persistence:

- `transaction_items`: one row per transaction with `transaction_id` as the
  primary key; item name, description, category, condition, quantity, and
  optional photo reference. It references `transactions` and is immutable at
  the BAYAR-004 payment-instruction lock boundary.
- `buyer_shipping_addresses`: one row per Buyer participant and transaction;
  `transaction_id`, `participant_account_id`, `recipient_name`,
  `phone_snapshot`, `address_line`, `district`, `city`, `province`,
  `postal_code`, `created_at`, and `locked_at`. It has foreign keys to the
  transaction and participant, a unique `(transaction_id,
  participant_account_id)` constraint, and is writable only by the bound
  Buyer before the BAYAR-004 lock boundary.
- `seller_payout_destinations`: one row per Seller participant and transaction;
  `transaction_id`, `participant_account_id`, `bank_name`,
  `account_holder_name`, `raw_account_value`, `masked_account_value`,
  `created_at`, and `locked_at`. It has foreign keys to the transaction and
  participant, a unique `(transaction_id, participant_account_id)` constraint,
  and is created only by the Seller; Buyer and Admin cannot replace it.
- `buyer_refund_destinations`: one row per Buyer participant and transaction;
  `transaction_id`, `participant_account_id`, `bank_name`,
  `account_holder_name`, `raw_account_value`, `masked_account_value`,
  `created_at`, and `locked_at`. It has foreign keys to the transaction and
  participant, a unique `(transaction_id, participant_account_id)` constraint,
  and is created only by the Buyer; Seller and Admin cannot replace it.
- Raw destination fields are server-only repository fields. Participant DTOs
  return masked values for the other participant and the permitted raw value
  only to the owning participant when policy allows; the Seller receives only
  the permitted shipping summary needed for fulfillment; Admin DTOs return raw
  values only to an authorized Admin task. No raw destination or shipping
  address field is included in audit payloads.
- `locked_at` remains null in BAYAR-003. BAYAR-004 sets it atomically when it
  creates payment instructions; all later writes are rejected. Add indexes for
  transaction/participant ownership and enforce one Buyer and one Seller per
  transaction using the existing role unique index plus service-side opposite-
  role checks. If a partial active-invite index is added, it must cover only
  non-revoked/non-used invitations.

No `payment_instructions` migration or write is part of this ticket.

### Payment Handoff Contract

- When the second role's required data is complete, BAYAR-003 keeps the
  transaction state at `WAITING_COUNTERPARTY_DATA` and returns a derived
  `readyForPaymentInstructions: true` value in the authorized response.
- This derived field is not a transaction state and does not start a timer.
- BAYAR-004 consumes this readiness, creates immutable `payment_instructions`,
  and performs the approved transition to `WAITING_BUYER_PAYMENT`.
- BAYAR-003 tests must assert that no payment instruction row and no deadline
  exists after role-data completion.

### Invitation API Contract

- `POST /api/transactions` accepts only an authenticated verified account and
  returns the transaction plus a raw invitation token exactly once. The token
  is accepted only as a route parameter by later invitation endpoints.
- `GET /api/invitations/[token]` hashes the route token for lookup, validates
  expiry/revocation/use, and returns only the permitted pre-join summary. It
  does not bind an account, expose payout/refund data, or return the token.
- `POST /api/invitations/[token]/join` hashes the route token, validates the
  authenticated verified account, opposite role, distinct-account rule,
  `usedAt`/`revokedAt`/expiry, idempotency key, and expected state version. A
  successful join consumes the invitation atomically.
- `POST /api/transactions/[id]/invitations/reissue` is initiator-only while
  the counterparty has not joined. It revokes the previous active invitation,
  creates a new hash/token, and returns the new raw token once. It uses
  idempotency and state-version checks.
- Expired, revoked, used, wrong-account, unauthorized, duplicate, and stale
  requests return safe errors and recovery instructions without revealing raw
  tokens or sensitive participant data. All route mutations are audited.

### Calculation Contract

- Item price is an integer rupiah amount from Rp100,000 through Rp5,000,000.
- Shipping cost is a non-negative integer rupiah amount.
- Buyer service fee is 2% of item price, with a Rp10,000 minimum and Rp50,000
  maximum.
- Buyer total is item price plus shipping cost plus service fee.
- Calculations are server-derived and persisted consistently in
  `transaction_terms`; clients cannot submit a trusted total or service fee.

## State And Data Impact

~~~text
State transitions added/changed:
- Creation: no prior transaction -> WAITING_COUNTERPARTY.
- Opposite-role join: WAITING_COUNTERPARTY -> WAITING_COUNTERPARTY_DATA.
- Role-data completion does not advance the transaction state in BAYAR-003;
  it exposes derived readiness for BAYAR-004. No new transaction state is
  introduced and WAITING_BUYER_PAYMENT is not claimed by this ticket.

Schema/migration impact:
- Add transaction_items, buyer_shipping_addresses,
  seller_payout_destinations, and buyer_refund_destinations with
  transaction/participant foreign keys, unique ownership keys, masked/raw
  projections, and immutable-lock support.
- Preserve existing transaction, participant, terms, invitation, idempotency,
  and audit tables. Do not modify payment instructions.

Authorization impact:
- Require authenticated, verified WhatsApp account for every command.
- Resolve actor from the session/database, never from client role/account data.
- Only Buyer/Seller can be transaction participants; Admin is operational only.
- Enforce creator role, opposite join role, distinct accounts, one role each,
  participant ownership, and sensitive-data masking server-side.

Audit/notification impact:
- Append events for transaction creation, invitation issue/reissue/revoke,
  join, same-account denial, wrong-role denial, role-data completion,
  ownership denial, state-version conflict, and idempotency conflict.
- Do not put raw invitation tokens, bank account values, or other sensitive
  values in audit payloads. External invitation sharing remains manual.

Manual operation impact:
- The initiator manually shares the invitation outside BayarAman.
- No payment, WhatsApp group, bank, or financial operation is performed.
~~~

## Test Plan

| Layer | Case | Expected evidence |
| --- | --- | --- |
| Static/lint/type | Typecheck, lint, build | New transaction modules/routes compile without payment scope |
| Unit | Physical-goods validation and calculation | Invalid category/condition/price/quantity rejected; fee and total are server-derived |
| Unit | Invitation token generation/hash/expiry | Raw token is not persisted/logged; expired/revoked/used tokens fail |
| Unit | State and role guards | Admin creator, same-account join, same-role join, duplicate role, and invalid state fail |
| Unit | Idempotency and state-version | Same key/hash returns same result; hash mismatch and stale version reject |
| Integration | Seller-created transaction | Verified Seller creates `WAITING_COUNTERPARTY` with seller-owned data and buyer invitation |
| Integration | Buyer-created transaction | Verified Buyer creates `WAITING_COUNTERPARTY` without seller payout data |
| Integration | Opposite-role join and completion | Distinct verified account joins, owns only its fields including shipping address, and reaches derived readiness |
| Integration | Concurrent join/role-data mutation | One authoritative result; conflicting mutation rejected and audited |
| Integration | Authorized transaction read/projection | Participant receives permitted/masked view, Buyer address follows ownership policy, and unrelated account is denied |
| Integration | Invitation preview/join/reissue routes | Token-param preview is safe; join consumes once; reissue revokes prior token; duplicate/expired/wrong-account paths recover safely |
| Integration | Destination constraints and lock boundary | One destination per participant, raw/masked projections are enforced, and writes fail after BAYAR-004 lock |
| Integration | Payment handoff boundary | No payment instruction, payment claim, timer, or payment review is created |
| UI/manual | UI-SCR-002..009 on desktop mobile-width surface | Loading, validation, duplicate, expired, wrong-account, unauthorized, waiting, success, and recovery states are usable |
| Database | Migration and constraints against OrbStack PostgreSQL | Tables/indexes/FKs apply cleanly and rollback/recovery is documented |

## Risks And Safeguards

| Risk | Safeguard | Recovery/rollback |
| --- | --- | --- |
| Role-owned fields leak across participants | Server derives ownership; read DTO masks other participant; raw destination never enters client payload | Reject and audit unauthorized request; preserve stored snapshot |
| Same account joins both roles | Compare authenticated account ID to creator/participant inside transaction and enforce distinct-account checks | Return deterministic rejection; invitation remains unused when join fails |
| Invitation is replayed or raced | Hash token, conditional used/revoked/expiry check, row transaction, and idempotency key | Return existing join result or reject conflict; never bind a second account |
| Duplicate active invitations confuse the counterparty | Reissue revokes prior link and active-link query/index is enforced | Show the latest invitation; old token remains invalid |
| Client submits incorrect total/fee | Server calculates approved fee and total from integer inputs | Reject request without partial transaction |
| Role data completes while BAYAR-004 reads readiness | Use state version and transaction lock; return canonical version/readiness; BAYAR-004 revalidates before issuing instructions | Retry with current state/version; never start timer in BAYAR-003 |
| Payment behavior accidentally enters this ticket | No payment instruction writes/routes/deadline code; explicit boundary test | Remove out-of-scope mutation and keep handoff contract |
| Raw bank data is exposed through audit/API | Restricted server read path, masked DTOs, payload redaction, and ownership checks | Revoke response path and audit denial; do not rewrite snapshot evidence |
| Invitation expiry/reissue creates orphan state | Revoke old link append-only through invitation lifecycle fields and audit event | Reissue latest valid link; no destructive deletion |

## Plan Completion Check

- [x] Every BAYAR-003 acceptance criterion maps to a planned change and verification.
- [x] Seller-created and buyer-created paths are separately covered.
- [x] Invitation, distinct-account, opposite-role, and single-use rules are explicit.
- [x] Buyer/Seller ownership and sensitive-data masking are explicit.
- [x] Buyer shipping-address persistence, ownership, masking, and lock boundary are explicit.
- [x] Invitation preview, join, and reissue routes are concrete.
- [x] Destination keys, raw/masked projections, and immutable lock behavior are explicit.
- [x] Payment instructions and the 1x24h timer are explicitly handed off to BAYAR-004.
- [x] No new transaction state, product role, payment, or financial operation is planned.
- [x] Idempotency, state-version, concurrency, audit, failure, and recovery behavior are covered.
- [x] UI-SCR-002 through UI-SCR-009 have planned implementation and verification.
- [x] Schema/migration order and local PostgreSQL validation are planned.
- [x] All findings from the previous Plan Review are addressed.
- [ ] Plan Review approval is still required before implementation.

## Status

~~~text
Version: 0.1
Status: Draft
Ready for Plan Review: Yes
~~~
