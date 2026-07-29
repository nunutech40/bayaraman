# Implementation Plan

## Task

~~~text
Ticket ID/title: BAYAR-003 — Transaction Creation, Role-Owned Data, and Invitation Join
Outcome: Let a verified account create a seller-created or buyer-created
physical-goods transaction, invite the opposite role, bind a distinct
verified account, and complete only its own role-owned data.
Source research: docs/execution/BAYAR-003/01-research.md
Source requirements and QA scenarios: UR-INIT-001..005,
UR-BUYER-001..003, UR-SELLER-001..003, UR-PARTICIPANT-001..003,
UR-SYSTEM-001, UR-BR-001, UR-BR-005..007, UR-BR-027..030,
UR-BR-032, UR-BR-037; QA-TRANS-001..006, QA-SEC-001, QA-UI-001
Source UX Flow and UI IDs/states: UX-FLOW-002..006, UX-FLOW-009..012;
UI-SCR-002..009
~~~

Status: Draft

## Scope

### In Scope

- Seller-created and buyer-created physical-goods transaction creation.
- Buyer/Seller participant binding with exactly two distinct verified accounts.
- Role-owned Buyer and Seller data, snapshots, masking, and freeze boundary.
- Hashed, single-use, expiring invitation preview, join, revoke, and reissue.
- Authorized transaction reads and safe raw/masked destination projections.
- Only `WAITING_COUNTERPARTY` and `WAITING_COUNTERPARTY_DATA`.
- Idempotency, state-version checks, append-only audit, and recovery paths.
- UI-SCR-002 through UI-SCR-009 in the existing constrained mobile-width shell.

### Out Of Scope

- Creating or changing `payment_instructions`.
- Midtrans invoice/payment link, payment deadline, webhook, payment review,
  `Sudah Bayar`, bank review, or any payment claim.
- WhatsApp group/checkpoint, payout, refund, complaint, cancellation, risk hold,
  wallet, balance ledger, or financial operation.
- Permanent Buyer/Seller account roles, Admin as participant, anonymous access,
  or unrelated refactoring.

## Planned Changes

| Step | Change | File/module | Requirement/UX/UI/AC covered | Verification |
| --- | --- | --- | --- | --- |
| 1 | Keep the existing transaction/item/terms/role-owned tables as the aggregate foundation. Add an additive migration with a duplicate preflight, then enforce one non-revoked/non-used invitation per transaction and target role. Update schema declaration and migration journal; do not touch legacy payment tables. | `src/server/db/schema.ts`, `drizzle/0005_bayar003_invitation_boundary.sql`, `drizzle/meta/_journal.json` | UR-PARTICIPANT-001..003, UR-INIT-004/005; TRD 5/6/10; AC-3 | Clean migration, preflight collision, index inspection, revoked/used compatibility, and duplicate concurrent invitation fixtures |
| 2 | Harden the existing Zod contracts and calculation boundary. Preserve physical-goods validation and server-derived terms; reject Admin as an initiator/participant and never accept client-supplied total/service fee. | `src/server/transaction/contracts.ts`, `src/server/transaction/calculation.ts` | UR-INIT-001/003, UR-SYSTEM-001, UR-BR-005..007; UI-SCR-003/004; AC-1/3 | Valid/invalid Seller and Buyer payloads, prohibited/invalid goods, price/quantity/shipping/fee calculation tests |
| 3 | Keep creation atomic and server-authoritative. Require a verified session account, accept either Buyer or Seller initiator, persist the initiator participant and only its owned data, create one invitation, and return the raw token once. | `src/server/transaction/service.ts`, `src/app/api/transactions/route.ts` | UR-INIT-001/003, UR-SELLER-001, UR-BUYER-003, UR-BR-001; UX-FLOW-002/003/007/008; UI-SCR-002..004; AC-1 | Atomic creation rollback, role authorization, idempotent duplicate create, no raw token audit/log, initial `WAITING_COUNTERPARTY` |
| 4 | Harden invitation preview/reissue. Preview remains public and safe; reissue requires a valid session, verified WhatsApp, non-Admin creator, `WAITING_COUNTERPARTY`, expected state version, and idempotency. Hash route tokens for lookup, revoke old links before replacement, serialize creator/state checks, and return the replacement raw token only in the command response. | `src/server/transaction/invitation.ts`, `src/app/api/invitations/[token]/route.ts`, `src/app/api/transactions/[id]/invitations/reissue/route.ts` | UR-INIT-002/004/005; UX-FLOW-004/009; UI-SCR-005; AC-1/2 | Expired/revoked/used preview, unverified/non-creator/Admin reissue denial, stale state, idempotency/hash conflict, concurrent reissue, and safe response/audit tests |
| 5 | Harden invitation join with a transaction/row lock, exact lifecycle predicates, opposite-role validation, distinct-account rejection, one role per transaction, expected state version, and atomic invitation consumption plus participant insert. | `src/server/transaction/service.ts`, `src/app/api/invitations/[token]/join/route.ts` | UR-BUYER-001/002, UR-SELLER-002/003, UR-PARTICIPANT-001/002; UX-FLOW-005/006/010; UI-SCR-006..008; AC-2/3 | Same-account, wrong-role, expired/revoked/used, duplicate/concurrent join, stale version, Admin/unverified denial, and exactly-one-Buyer/one-Seller tests |
| 6 | Update role-data completion to enforce owner-only writes and immutable snapshots. In one transaction, lock/read the transaction, terms, and participant rows; reject any write when `transaction_terms.frozen_at IS NOT NULL`; use transaction ID, `WAITING_COUNTERPARTY_DATA`, and expected state version as guards. When the second role dataset is complete, set `frozen_at`, keep state at `WAITING_COUNTERPARTY_DATA`, return derived `readyForPaymentInstructions: true`, and never call `issuePaymentInstructions`. Keep all destination/shipping `locked_at` fields null for BAYAR-004. | `src/server/transaction/service.ts`, `src/server/transaction/read.ts`, `src/app/api/transactions/[id]/role-data/route.ts` | UR-BUYER-002/003, UR-SELLER-002/003, UR-PARTICIPANT-003, UR-BR-027..030; UX-FLOW-006/011/012; UI-SCR-007..009; AC-3/4 | Owner-only write, attempted-write-after-freeze, state/version conflict, idempotent duplicate save, derived readiness, and no invoice/instructions/deadline/payment-state row tests |
| 7 | Harden participant read projections. Keep transaction access participant-scoped; expose own permitted data, masked other-participant contact/destination data, and only the shipping summary allowed to the Seller. Never return raw bank values or unrelated participant data. | `src/server/transaction/read.ts`, `src/app/api/transactions/[id]/route.ts`, `src/app/api/transactions/[id]/role-data/route.ts` | UR-PARTICIPANT-001..003, UR-BR-032/037; UI-SCR-005/009; QA-SEC-001 | Owner/masked DTO tests, unrelated-account denial, Admin boundary, raw-value absence from JSON/log/audit |
| 8 | Reuse and harden idempotency, state-version, and transaction audit behavior. The service/domain mutation boundary creates one correlation ID and writes one sanitized rejection audit event for self-join, wrong role, stale version, expired/revoked/used invitation, unauthorized ownership, Admin/unverified action, and duplicate/conflicting mutation. Successful business mutation and audit remain atomic; rejected business mutation rolls back and rejection audit is written separately. | `src/server/transaction/mutation.ts`, `src/server/transaction/audit.ts`, `src/server/auth/authorization.ts`, affected route handlers | UR-SYSTEM-001, UR-BR-001/037; QA-TRANS-005/006, QA-SEC-001; AC-3/4 | Same key/hash replay, hash conflict, stale version, one-event-per-rejection assertions, audit rollback/rejection, route/service correlation checks, and sensitive-payload redaction tests |
| 9 | Preserve and complete the existing UI routes/components for role start, creation, invitation waiting/join, role completion, and transaction status. Add loading, validation, duplicate, expired, wrong-account, unauthorized, waiting, frozen, and recovery states without exposing payment UI. | `src/app/dashboard/page.tsx`, `src/app/transactions/new/page.tsx`, `src/app/transactions/[id]/page.tsx`, `src/app/invite/[token]/page.tsx`, `src/components/transactions/*`, `src/app/globals.css` | UX-FLOW-002..006, UX-FLOW-009..012; UI-SCR-002..009; QA-UI-001 | Manual mobile-width desktop check, keyboard/error states, state refresh, invitation recovery, and no payment action before BAYAR-004 |
| 10 | Add focused domain, route, and PostgreSQL integration tests, then record validation and handoff evidence. | `tests/unit/transaction.test.ts`, `tests/integration/transaction.test.ts`, `docs/execution/BAYAR-003/04-validation.md` | QA-TRANS-001..006, QA-SEC-001, QA-UI-001; ticket Definition of Done | Tests, typecheck, lint, build, migration check, PostgreSQL health, payment-boundary assertion, and `git diff --check` |

### Schema And Migration Plan

The current schema already contains `transaction_items`, `transaction_terms`,
`buyer_shipping_addresses`, `seller_payout_destinations`,
`buyer_refund_destinations`, `transaction_participants`, and `invitations`.
Do not recreate these tables or add payment schema here.

Add only this additive active-invitation index, after a preflight in the same
migration confirms that no duplicate active pair already exists:

```sql
DO $$
BEGIN
  IF EXISTS (
    SELECT transaction_id, target_role
    FROM invitations
    WHERE revoked_at IS NULL AND used_at IS NULL
    GROUP BY transaction_id, target_role
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot create active invitation index: duplicate active invitations exist';
  END IF;
END $$;
```

Then create the consistently named index:

```sql
CREATE UNIQUE INDEX invitations_one_active_target_idx
ON invitations (transaction_id, target_role)
WHERE revoked_at IS NULL AND used_at IS NULL;
```

The migration journal entry and Drizzle schema declaration must use the same
index name. Existing revoked/used invitations remain compatible because they do
not participate in the partial predicate. If the preflight fails, no index is
created; the recovery instruction is to identify and explicitly revoke or
resolve duplicates, then rerun the unchanged migration.

The existing transaction/participant foreign keys, one-role index, raw/masked
destination columns, and lock timestamps remain the persistence contract.
Distinct account enforcement is a transaction-locked service invariant because
it spans participant rows; it must be tested under concurrent joins. No legacy
`payment_instructions` column/table is removed or modified.

`transaction_terms.frozen_at` is the BAYAR-003 freeze marker once both role
datasets are complete. BAYAR-003 does not set payable-time destination
`locked_at`; BAYAR-004 owns that lock while creating the Midtrans invoice
boundary.

### Payment Handoff Contract

- Role completion leaves the transaction in `WAITING_COUNTERPARTY_DATA`.
- The authorized response may expose derived
  `readyForPaymentInstructions: true`; this is not a transaction state.
- BAYAR-003 creates no payment instruction, invoice, payment deadline, claim,
  payment status, or payment audit event.
- BAYAR-004 revalidates participants, frozen terms, state version, and role
  data before creating the Midtrans invoice/payment link and starting the
  absolute deadline.
- The legacy `payment_instructions` table remains compatibility-only and is not
  read or written by this ticket.

### Invitation API Contract

- `POST /api/transactions` accepts a verified session account and returns one
  raw invitation token only in the creation result.
- `GET /api/invitations/[token]` hashes the route token, validates lifecycle,
  and returns only permitted pre-join item/terms/participant summary.
- `POST /api/invitations/[token]/join` validates verified session, opposite
  role, distinct account, expiry/revocation/use, idempotency, and state version,
  then consumes the invitation atomically.
- `POST /api/transactions/[id]/invitations/reissue` requires a valid session,
  verified WhatsApp, non-Admin creator ownership, `WAITING_COUNTERPARTY`,
  expected state version, and idempotency. It revokes old active links, creates
  one replacement, and returns its raw token once.
- Raw token is never stored, logged, audited, or included in generic errors;
  only its hash and safe lifecycle references persist.

## State And Data Impact

~~~text
State transitions added/changed:
- Creation starts at WAITING_COUNTERPARTY.
- Successful opposite-role join changes WAITING_COUNTERPARTY to
  WAITING_COUNTERPARTY_DATA.
- Completing role data does not change transaction state. It freezes approved
  terms/readiness and returns a derived handoff flag only.
- WAITING_BUYER_PAYMENT and every payment/provider state remain owned by
  BAYAR-004 and are not introduced here.

Schema/migration impact:
- Reuse existing transaction and role-owned tables.
- Add the active invitation uniqueness index through `0005_bayar003_invitation_boundary.sql`
  after the duplicate preflight; keep its name consistent in schema, SQL, journal,
  and inspection tests.
- Preserve raw/masked destination boundaries and leave payable-time lockedAt
  null until BAYAR-004.
- Do not touch payment_instructions or Midtrans tables/routes.

Authorization impact:
- Require authenticated, WhatsApp-verified accounts for every command, including
  invitation reissue; invitation preview remains a public read of safe data.
- Resolve actor from the server session; never trust client account IDs.
- Only Buyer/Seller can create or join product transactions; Admin is not a
  participant and product roles remain transaction-scoped.
- Enforce initiator ownership, opposite role, distinct account, one role each,
  participant ownership, and raw/masked data boundaries server-side.

Audit/notification impact:
- Append successful creation, invitation issue/reissue/revoke, join, role-data
  completion, and state/version mutation events in the same transaction.
- The transaction/domain mutation service owns one sanitized rejection audit
  event per rejected command and passes one correlation ID through route and
  service handling. Cover self-join, wrong role, unauthorized ownership,
  stale version, expired/revoked/used invitation, Admin/unverified action, and
  duplicate/conflicting mutation.
- Never put raw invitation tokens, raw bank values, full shipping data, or
  payment/provider data in audit.
- Invitation sharing remains a manual external handoff; no WhatsApp provider
  integration is added.

Manual operation impact:
- Initiator manually shares the invitation link.
- No Admin payment review, Midtrans operation, WhatsApp group, payout, refund,
  complaint, cancellation, or risk operation is performed.
~~~

## Test Plan

| Layer | Case | Expected evidence |
| --- | --- | --- |
| Static/lint/type | Typecheck, lint, build, migration check | Transaction changes compile without payment scope |
| Unit | Zod contracts and calculations | Invalid role/fields/goods rejected; total and fee are server-derived |
| Unit | Invitation token/lifecycle helpers | Hash-only persistence, expiry, revoke/use behavior, and safe errors |
| Unit | State, ownership, masking, and idempotency | Admin/self-join/cross-role writes reject; same request replays; hash conflict/stale version reject |
| PostgreSQL integration | Creation aggregate and constraints | Atomic rows, foreign keys, one Buyer/one Seller, active invitation uniqueness, clean/collision migration behavior, and rollback |
| PostgreSQL integration | Concurrent join/reissue/role-data | One authoritative mutation; conflict returns safe result and audit; no duplicate participant or active link |
| PostgreSQL integration | Freeze/payment boundary | Both datasets set `frozen_at`; attempted later role-data write is rejected while destination/shipping `locked_at` stays null; no `payment_instructions`, invoice, deadline, claim, or payment state is created |
| PostgreSQL integration | Projection/security | Participant ownership, masked destination, Seller shipping summary, unrelated-account denial, and audit redaction |
| API integration | Create, preview, join, reissue, read, role-data routes | Auth, verified WhatsApp including reissue, idempotency, expected version, token lifecycle, one rejection audit/correlation, safe errors, and recovery paths |
| UI/manual | UI-SCR-002..009 | Mobile-width desktop surface, loading, validation, waiting, expired, unauthorized, frozen, and recovery states |

## Risks And Safeguards

| Risk | Safeguard | Recovery/rollback |
| --- | --- | --- |
| Role-owned values leak across participants | Server-derived ownership, masked DTOs, and raw-value exclusion from client/audit | Reject and audit unauthorized read/write; preserve snapshots |
| Same account joins both roles | Lock transaction, compare authenticated account with creator/participants, and enforce one role per transaction | Deterministic rejection; invitation remains unused on failed join |
| Invitation replay or race | Hash token, row/transaction lock, lifecycle predicates, partial active-target index, and idempotency | Return prior result or reject conflict; never bind a second participant |
| Concurrent reissue creates two active links | Lock creator transaction, run the active-pair preflight during migration, and enforce `invitations_one_active_target_idx` | Keep one committed link; safely retry with current state/version |
| Incorrect client total/fee | Calculate and persist terms server-side | Reject before partial mutation |
| Role data changes after freeze or while BAYAR-004 reads readiness | Guard role-data writes with transaction ID, `WAITING_COUNTERPARTY_DATA`, `frozen_at IS NULL`, and state version; require BAYAR-004 revalidation | Reject after freeze; retry pre-freeze conflicts with current version; never start timer in BAYAR-003 |
| Legacy manual payment path is reintroduced | Remove the `issuePaymentInstructions` call from role completion and add a no-payment integration assertion | Roll back only the ticket mutation; leave legacy compatibility tables untouched |
| Raw bank/shipping data enters audit/API | Explicit projections, sanitized audit allowlist, and owner checks | Reject response/mutation and record sanitized denial |
| UI implies payment is ready too early | Show only waiting/frozen/readiness handoff; no invoice or payment action | Refresh status and direct user to missing owner action |

## Plan Completion Check

- [x] Every ticket acceptance criterion maps to a planned change and verification.
- [x] Seller-created and buyer-created paths are separately covered.
- [x] Invitation preview, join, reissue, expiry, revoke/use, and raw-token boundary are concrete.
- [x] Reissue requires valid session, verified WhatsApp, creator ownership, and `WAITING_COUNTERPARTY`.
- [x] Migration has a duplicate active-invitation preflight, consistent index name, journal entry, collision test, and recovery instruction.
- [x] Buyer/Seller ownership, distinct accounts, masking, and immutable snapshots are explicit.
- [x] `frozen_at` is an exact role-data write guard; payable-time `locked_at` remains BAYAR-004-owned.
- [x] Existing code paths are named accurately; no nonexistent module is assumed.
- [x] Payment instructions, Midtrans invoice, deadline, and payment state are explicitly handed off to BAYAR-004.
- [x] No new transaction state, product role, payment, or financial operation is planned.
- [x] Idempotency, state version, concurrency, audit, failure, and recovery are covered.
- [x] One sanitized rejection audit event and correlation ID are assigned to the transaction/domain mutation boundary.
- [x] UI-SCR-002 through UI-SCR-009 have implementation and verification boundaries.
- [x] Migration order and local PostgreSQL validation are planned.
- [ ] Plan Review approval is required before implementation.

## Status

~~~text
Version: 0.1
Status: Draft
Ready for Plan Review: Yes
~~~
