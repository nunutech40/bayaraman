# Codebase Research

## Task

~~~text
Ticket ID/title: BAYAR-003 — Transaction Creation, Role-Owned Data, and Invitation Join
Requested outcome: Let a verified account initiate as Buyer or Seller,
invite the opposite role, bind a different verified account, and persist only
the data owned by each participant before handing off to BAYAR-004.
Source requirements: UR-INIT-001..005, UR-BUYER-001..003,
UR-SELLER-001..003, UR-PARTICIPANT-001..003, UR-SYSTEM-001,
UR-BR-001, UR-BR-005..007, UR-BR-027..030, UR-BR-032, UR-BR-037
Source UX Flow/UI/QA IDs: UX-FLOW-002..006, UX-FLOW-009..012;
UI-SCR-002..009; QA-TRANS-001..006, QA-SEC-001, QA-UI-001
~~

Status: Draft

## Relevant Context Read

| File/doc | Why it is relevant | Key constraint found |
| --- | --- | --- |
| `AGENTS.md` | Repository and execution safety rules | Research only; preserve unrelated changes and use the approved ticket boundary |
| `docs/engineering/tickets/BAYAR-003-transaction-creation-invitation.md` | Scope and acceptance criteria | Seller/buyer creation, invitation lifecycle, distinct verified accounts, role-owned data, and no payment/provider behavior |
| `docs/execution/BAYAR-002/04-validation.md` | Previous ticket handoff | Session, verified WhatsApp prerequisite, server account lookup, and mobile auth surface are available |
| `src/server/db/schema.ts` | Current persistence contract | Transaction, participant, item, terms, shipping, payout, refund, invitation, idempotency, and audit tables already exist |
| `src/server/transaction/service.ts` | Current transaction mutation behavior | Creation, join, role-data save, state version, and idempotency exist; completed role data currently calls legacy manual payment issuance |
| `src/server/transaction/invitation.ts` | Invitation preview/reissue behavior | Token hashes are persisted; preview is public; reissue revokes old links; active-link concurrency needs review |
| `src/server/transaction/mutation.ts` | Idempotency persistence | `(actor_scope, command, key)` lookup and request-hash conflict handling are reusable |
| `src/server/transaction/token.ts` | Invitation secret boundary | Raw token is generated once and only its SHA-256 hash is persisted |
| `src/server/transaction/audit.ts` | Transaction audit pattern | Transaction mutations can append audit events inside the same database transaction |
| `src/server/auth/authorization.ts` | Actor authorization | Session resolves the account; verified WhatsApp is required for participation; Admin must not create/join product transactions |
| `src/server/transaction/contracts.ts` | Input contract | Seller and Buyer role data are discriminated Zod schemas; current creation form includes item and role-owned destination data |
| `src/app/api/transactions/route.ts`, `src/app/api/invitations/[token]/*`, `src/app/api/transactions/[id]/*` | HTTP boundary | Concrete create, preview, join, reissue, read, and role-data routes already exist but need contract/security hardening |
| `src/components/transactions/*`, transaction pages, `src/app/globals.css` | UI surface | Existing constrained mobile-width shell and forms cover creation, invitation, status, and role-data states |
| `tests/unit/*`, `tests/integration/*` | Test conventions | Vitest and optional PostgreSQL integration exist; transaction route/concurrency coverage is still thin |
| `TRD.md` sections 5, 6, 10, 11, 12, 13, 14 | Approved technical boundary | Distinct opposite participants, snapshots, state version, idempotency, hashed invitation token, masking, and audit are required |

## Current Behavior

- `POST /api/transactions` authenticates the session, validates the initiator
  payload, requires an idempotency key, and calls `createTransaction`.
- `createTransaction` currently inserts the transaction, initiator participant,
  item/terms, initiator-owned shipping or payout/refund data, one invitation,
  and creation/invitation audit events in one database transaction. It starts in
  `WAITING_COUNTERPARTY` and returns the raw invitation token once.
- Invitation preview hashes the route token and returns item/terms/participant
  summary without requiring a session. It does not return the raw token or
  sensitive destination values.
- Invitation join currently resolves the invitation ID from the raw route token,
  requires an authenticated verified account, rejects Admin, rejects the
  initiator joining their own invitation, inserts the opposite participant, and
  changes state from `WAITING_COUNTERPARTY` to `WAITING_COUNTERPARTY_DATA`.
- Reissue currently allows only the creator before counterparty join, revokes
  unused links, creates a new hashed link, and returns the raw token. It does
  not currently lock the transaction row or increment `state_version`.
- Role-data PATCH verifies participant ownership and current state, writes the
  Buyer shipping/refund or Seller payout snapshot, and uses idempotency plus an
  expected state version.
- When both role datasets are present, `saveRoleData` currently calls
  `issuePaymentInstructions` from `src/server/payment/payment.ts`. That creates
  legacy manual-bank `payment_instructions`, freezes data, starts a deadline, and
  transitions to `WAITING_BUYER_PAYMENT`. This is a BAYAR-003 scope leak under
  the approved Midtrans boundary: BAYAR-003 must not create payment instructions,
  invoices, payment deadlines, or payment claims; BAYAR-004 owns the payment
  handoff.
- Transaction reads are participant-scoped and mask the other participant's
  WhatsApp number and destination account. The current read path does not expose
  raw destination values to the other participant.
- The creation UI already separates Seller and Buyer entry fields and states
  that payment is unavailable before the counterparty joins. The status UI and
  invitation UI use the existing mobile-width web shell, but loading/error/
  unauthorized/retry states are minimal.

## Code Map

| Responsibility | Existing file/module | Symbol/route | Notes |
| --- | --- | --- | --- |
| Creation contract | `src/server/transaction/contracts.ts` | `createTransactionSchema` | Discriminated Seller/Buyer input plus physical item fields |
| Creation mutation | `src/server/transaction/service.ts` | `createTransaction` | Atomic aggregate creation and invitation issuance |
| Invitation token | `src/server/transaction/token.ts` | `createInvitationToken`, `hashInvitationToken` | Hash-only persistence; raw token returned once |
| Invitation preview/reissue | `src/server/transaction/invitation.ts` | `previewInvitation`, `reissueInvitation` | Preview, revoke, replacement link, and public token lookup |
| Invitation join | `src/server/transaction/service.ts` | `joinInvitation` | Opposite-role binding and state transition |
| Role data mutation | `src/server/transaction/service.ts` | `saveRoleData` | Owner checks, destination/shipping snapshots, current payment leak |
| Transaction read | `src/server/transaction/read.ts` | `readTransaction` | Participant authorization and masked projections |
| HTTP create/read | `src/app/api/transactions/route.ts`, `[id]/route.ts` | `POST`, `GET` | Session and idempotency boundaries |
| HTTP role data | `src/app/api/transactions/[id]/role-data/route.ts` | `GET`, `PATCH` | Read and owner mutation boundary |
| HTTP invitation | `src/app/api/invitations/[token]/route.ts`, `join/route.ts` | `GET`, `POST` | Raw token route boundary; join resolves hash before mutation |
| HTTP reissue | `src/app/api/transactions/[id]/invitations/reissue/route.ts` | `POST` | Initiator-only reissue route |
| Persistence | `src/server/db/schema.ts` | `transactions`, participants, role-owned tables, invitations | Existing additive schema from foundation/transaction work |
| Idempotency | `src/server/transaction/mutation.ts` | `findIdempotentResult`, `saveIdempotentResult` | Uses account actor scope and request hash |
| Audit | `src/server/transaction/audit.ts` | `recordTransactionEvent`, `recordRejectedMutationEvent` | Append-only audit table; raw tokens must stay out |
| Payment boundary to remove | `src/server/payment/payment.ts` | `issuePaymentInstructions` | Legacy manual-bank path; must not be called by BAYAR-003 |
| Creation UI | `src/components/transactions/create-transaction.tsx` | `CreateTransaction` | Mobile-width role-specific form and invitation result |
| Invitation UI | `src/components/transactions/invitation.tsx` | `InvitationView` | Preview/join, login redirect, expired/error state |

## Existing Patterns To Reuse

- Parse route input with Zod before any mutation and derive actor identity
  from `requireAuthenticatedAccount`, never from request fields.
- Reuse `canParticipate` and server-side `isAdmin` checks; product roles remain
  transaction-scoped Buyer/Seller values, not permanent account roles.
- Use Drizzle transactions for aggregate creation, invitation use, participant
  binding, snapshots, state-version changes, idempotency result, and audit.
- Hash invitation tokens with `hashInvitationToken`; never persist, log, audit,
  or include the raw token in a generic response after the one-time creation or
  reissue response.
- Use the existing `(actor_scope, command, key)` idempotency record and reject
  a reused key with a different request hash.
- Protect concurrent join/reissue/role-data mutations with row locks or a
  conditional update on transaction ID plus exact state/version predicates.
- Keep raw destination values server-side; return masked values outside the
  owning participant/Admin boundary.
- Append successful mutation audit in the same database transaction and use a
  sanitized rejection audit path after a rejected mutation when required.
- Preserve `.app-shell` constrained mobile-width behavior and add executable
  loading, error, expired, unauthorized, duplicate, and recovery states.
- Use unit tests for schemas/token/projection rules and PostgreSQL integration
  tests for constraints, concurrency, idempotency, state versions, audit, and
  authorization.

## Change Surface

| Area | Likely change? | Reason/risk |
| --- | --- | --- |
| UI | Yes | Harden existing role forms, invitation preview/join, status, and role-data states for UI-SCR-002..009 |
| API | Yes | Preserve concrete create/preview/join/reissue/read/role-data contracts and close auth, token, idempotency, and error gaps |
| State | Yes | Keep only `WAITING_COUNTERPARTY` and `WAITING_COUNTERPARTY_DATA`; remove the BAYAR-003 path to `WAITING_BUYER_PAYMENT` |
| Database | Maybe | Existing role-owned tables are present; likely need active-invitation/concurrency constraints or compatibility-safe indexes after plan review |
| Auth | Yes | Reuse BAYAR-002 verified-account guard and add participant/ownership denial audit where missing |
| Jobs/integrations | No | No Midtrans invoice/webhook, payment, WhatsApp group, payout, or background job belongs here |
| Tests/docs | Yes | Add route/domain/database concurrency, masking, idempotency, state, audit, and mobile-state coverage; update validation later |

## Unknowns And Assumptions

| Item | Can be inferred safely? | Evidence or decision needed |
| --- | --- | --- |
| What exact “ready for BAYAR-004” state means after both datasets complete | Yes for boundary | Keep transaction in `WAITING_COUNTERPARTY_DATA`; freeze approved role-owned snapshots/terms without creating payment instructions or changing to a payment state |
| Whether role data is initially collected by the initiator or counterparty | Yes | Current schema/service and UI support initiator-owned data plus counterparty completion; preserve owner-only writes |
| Invitation expiry and reissue semantics | Yes | Existing implementation uses three days and revokes unused links; preserve unless ticket/approved requirement says otherwise |
| One active invitation per transaction/target role under concurrency | Partly | Existing token uniqueness is insufficient; plan must choose database partial uniqueness and/or transaction locking without changing product behavior |
| Distinct-account enforcement at database level | Partly | Existing service rejects self-join and participant role uniqueness exists; plan must add a concurrency-safe service/constraint strategy |
| Service-fee calculation | No | Reuse existing calculation boundary; do not invent cancellation or financial policy in this ticket |
| Whether the legacy `payment_instructions` table is removed | Yes | Do not remove it here; retain compatibility and ensure BAYAR-003 never reads/writes it |
| Midtrans invoice fields and deadline ownership | Yes | Defer entirely to BAYAR-004; no invoice, provider call, payment status, or deadline mutation in this ticket |

## Research Conclusion

~~~text
Recommended implementation boundary: Harden the existing transaction and
invitation implementation for BAYAR-003. Keep verified-account creation,
hashed invitation preview/join/reissue, distinct opposite-role participants,
role-owned physical/shipping/destination snapshots, masked reads, idempotency,
state-version guards, append-only audit, and UI-SCR-002..009. Remove the
call from role-data completion into legacy `issuePaymentInstructions`; after
both datasets are complete, freeze only the BAYAR-003-owned data and leave the
transaction in the approved pre-payment boundary for BAYAR-004.

Main risks: the current completed-role path creates legacy manual-bank payment
instructions; invitation reissue/join concurrency is not fully serialized;
the database does not alone enforce distinct accounts across participant rows;
raw-token/request and rejection-audit boundaries need explicit tests; and UI
states are thinner than the approved specification. No Midtrans invoice,
payment deadline, webhook, payment claim, WhatsApp group, payout, refund, or
cancellation behavior should be added here.

Files likely affected: `src/server/transaction/service.ts`,
`src/server/transaction/invitation.ts`, transaction route handlers,
`src/server/transaction/read.ts`, transaction schema/migration only if the
approved plan requires a constraint, transaction audit/idempotency helpers,
transaction components/pages, and focused unit/PostgreSQL integration tests.
Do not modify `src/server/payment/payment.ts` behavior for BAYAR-004 except to
remove its call from BAYAR-003. Do not change product documents or the ticket.

Ready to plan: Yes. The plan must explicitly preserve the two pre-payment
states, freeze role-owned data without payment issuance, and define the
concurrency/authorization/test strategy before coding.
~~~
