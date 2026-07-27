# Codebase Research

## Task

~~~text
Ticket ID/title: BAYAR-003 — Transaction Creation, Role-Owned Data, and Counterparty Join
Requested outcome: Let a verified account start a seller-created or
buyer-created physical-goods transaction, invite the opposite role, bind a
different verified account, and complete only the fields owned by that role.
Source requirements: UR-INIT-001..005, UR-BUYER-001..003,
UR-SELLER-001..003, UR-PARTICIPANT-001..003, UR-SYSTEM-001,
UR-BR-001, UR-BR-005..007
Source UX Flow/UI/QA IDs: UX-FLOW-002..006, UX-FLOW-009..012;
UI-SCR-002..009; QA-TRANS-001..006, QA-SEC-001, QA-UI-001
~~~

## Relevant Context Read

| File/doc | Why it is relevant | Key constraint found |
| --- | --- | --- |
| `AGENTS.md` | Execution safety and minimal-context rules | Read only the selected ticket, affected code/tests, and referenced approved IDs |
| `docs/engineering/tickets/BAYAR-003-transaction-creation-invitation.md` | Ticket boundary and acceptance criteria | Creation from either role, single-use invitation, distinct accounts, role-owned data, no payment/bank review/WhatsApp group |
| `docs/execution/BAYAR-002/04-validation.md` | Previous ticket handoff | Auth, verified-WhatsApp prerequisite, session, and protected route are implemented; WhatsApp provider remains manual |
| `src/server/db/schema.ts` | Existing persistence contract | Transactions, participants, terms, invitations, payment instructions, and audit tables already exist |
| `src/server/domain/transaction/state.ts` | State and role vocabulary | Only approved transaction states and product roles Buyer/Seller/Admin may be used |
| `src/server/domain/mutation/index.ts` | Mutation safety pattern | Expected state version is available for optimistic concurrency checks |
| `src/server/domain/idempotency/index.ts` | Duplicate mutation contract | Request hash conflict and idempotency hit types exist, but no database service is wired yet |
| `src/server/validation/mutation.ts` | Input boundary | Zod-based mutation parsing and request hashing are available |
| `src/server/auth/authorization.ts` | Auth boundary | Server resolves account from session and verified WhatsApp is required for participation |
| `src/server/audit/index.ts`, `src/server/auth/audit.ts` | Audit boundary | Generic audit event builder exists; auth currently writes directly to `audit_events` |
| `src/app/dashboard/page.tsx` and auth components | Existing UI shell and account entry | Mobile-width surface exists; role buttons are present but not wired to transaction forms |
| `tests/unit/foundation.test.ts`, `tests/unit/auth.test.ts` | Test conventions | Vitest unit tests cover pure foundation/auth boundaries; no transaction route/integration tests exist |
| `TRD.md` sections 6, 7, 8, 9, 10, 13 | Approved technical contract | Exactly two distinct opposite-role participants, server-owned state transition, invitation token hash, idempotency, snapshots, and masked reads |
| `docs/product/04-ui-ux-spec.md` UI-SCR-002..009 | Screen and field contract | Seller and buyer forms have different owned fields; payment is hidden until prerequisites are complete |
| `docs/product/05-qa-scenarios.md` QA-TRANS-001..006, QA-SEC-001, QA-UI-001 | Verification contract | Both creation modes, join, ownership, duplicate actions, security, and mobile UI must be tested |

## Current Behavior

- The root page only links to account access. The dashboard shows Seller and
  Buyer role choices, but neither button creates a transaction.
- BAYAR-002 provides registration/login, a signed session cookie, verified
  WhatsApp gating, and server-side account lookup. No transaction endpoint,
  invitation endpoint, or transaction screen exists.
- The database already contains the main transaction aggregate:
  `transactions`, `transaction_participants`, `transaction_terms`, and
  `invitations`.
- `transactions` stores creator account, creator role, state, and
  `state_version`. The schema allows the `ADMIN` enum value, so the service
  must explicitly reject Admin as a transaction creator/participant.
- `transaction_participants` has a composite transaction/account primary key,
  a unique transaction/role index, role snapshot, name snapshot, WhatsApp
  snapshot, and join timestamp. These constraints support one participant per
  role but do not alone guarantee that both roles exist or that the roles are
  opposite; the service transaction must enforce those rules.
- `transaction_terms` currently stores only item description, item price,
  shipping cost, service fee, total amount, and frozen timestamp. The approved
  UI/TRD also require richer physical-goods fields and separate Buyer refund
  and Seller payout destination snapshots; those fields/tables are not yet
  present.
- `invitations` stores a token hash, target role, expiry, revoked/used times,
  and transaction ID. The token hash is unique, but there is no partial unique
  index for one active invitation per transaction/target role. Service logic
  must revoke or reject prior active invitations and mark a successful join
  atomically.
- `payment_instructions` already has destination, amount, issued time, and
  deadline, but no transaction service currently creates it. BAYAR-003 says
  payment instructions are out of scope while its acceptance criteria says the
  final role data makes payment available and starts the original deadline.
  This boundary needs to be made explicit in the plan before coding.
- No transaction audit writer, participant read authorization, invitation
  token hashing service, or transaction idempotency repository is implemented.

## Code Map

| Responsibility | Existing file/module | Symbol/route | Notes |
| --- | --- | --- | --- |
| Transaction persistence | `src/server/db/schema.ts` | `transactions` | State, creator role, state version, timestamps |
| Participant persistence | `src/server/db/schema.ts` | `transactionParticipants` | Role/account uniqueness and contact snapshots |
| Shared terms persistence | `src/server/db/schema.ts` | `transactionTerms` | Amount fields exist; richer item fields are missing |
| Invitation persistence | `src/server/db/schema.ts` | `invitations` | Token hash and lifecycle timestamps exist |
| Payment readiness persistence | `src/server/db/schema.ts` | `paymentInstructions` | Existing table, but creation boundary belongs to payment work unless clarified |
| Account lookup/auth | `src/server/auth/authorization.ts`, `account-service.ts` | `requireAuthenticatedAccount`, `canParticipate` | Reuse session/account lookup and verified WhatsApp guard |
| Product roles/states | `src/server/domain/transaction/state.ts` | `PRODUCT_ROLES`, `TRANSACTION_STATES` | Do not add roles/states; reject Admin for participant creation |
| State-version guard | `src/server/domain/mutation/index.ts` | `assertMutationVersion` | Extend with transaction mutation implementation |
| Idempotency primitives | `src/server/domain/idempotency/index.ts` | `assertSameRequestHash` | Persistence lookup/insert is still needed |
| Validation | `src/server/validation/mutation.ts` | `parseMutationInput`, `hashRequest` | Add transaction-specific Zod schemas in a dedicated module |
| Audit persistence | `src/server/auth/audit.ts` | `recordAuthEvent` | Add transaction event writer with actor/correlation and no sensitive raw token |
| App shell | `src/app/globals.css`, `src/app/dashboard/page.tsx` | `.app-shell`, role start | Preserve constrained mobile-width desktop surface |
| Test runner | `vitest.config.ts`, `tests/unit/*` | Vitest | Add domain/unit and request/integration coverage |

## Existing Patterns To Reuse

- Validate route and command input with Zod before database mutation.
- Resolve the account from the signed session and database; never trust a
  client-supplied account ID or role for authorization.
- Require `whatsappVerifiedAt` before creating or joining a transaction.
- Use Drizzle's shared `db` instance and database transactions for creation,
  join, participant snapshot, invitation use, and state-version updates.
- Hash invitation tokens before persistence; return the raw token only once in
  the creation response and never log or audit it.
- Use `expectedStateVersion` and a conditional state update for stale/concurrent
  mutations. Duplicate requests should return the same active/final result.
- Write append-only audit events for creation, invitation issue/reissue,
  join, role-data completion, denied self-join, denied ownership mutation,
  and state transition.
- Keep participant reads masked and ownership-aware. A participant can see
  permitted transaction summary and the other participant's allowed summary,
  but cannot read or mutate the other role's payout/refund destination.
- Preserve the existing constrained mobile-width shell and provide loading,
  field-error, duplicate, expired-invitation, unauthorized, and recovery
  states for UI-SCR-002..009.
- Use Vitest for pure validation/token/state tests and request/database tests
  against the local PostgreSQL container where transaction boundaries matter.

## Change Surface

| Area | Likely change? | Reason/risk |
| --- | --- | --- |
| UI | Yes | Wire role start and add creation, invitation waiting/join, and role-data screens for UI-SCR-002..009 |
| API | Yes | Create, invitation issue/reissue, join, role-data PATCH, and authorized transaction read endpoints |
| State | Yes | Implement only approved pre-payment transitions through `WAITING_COUNTERPARTY`, `WAITING_COUNTERPARTY_DATA`, and the agreed payment-readiness boundary |
| Database | Yes | Existing tables need richer role-owned terms/destination persistence or a documented reuse decision; indexes/constraints may need migration |
| Auth | Yes | Reuse BAYAR-002 session and verified-WhatsApp guard; add participant ownership checks, not a new auth system |
| Jobs/integrations | No | Invitation expiry is checked lazily or by request; no payment, WhatsApp, or background integration in this ticket |
| Tests/docs | Yes | Add transaction domain, route, authorization, concurrency/idempotency, and mobile UI tests; update validation report after implementation |

## Unknowns And Assumptions

| Item | Can be inferred safely? | Evidence or decision needed |
| --- | --- | --- |
| How to persist full physical-goods fields, Buyer refund destination, and Seller payout destination | No | TRD data model and UI-SCR-003/004/007/008 require fields not represented by the current schema; plan must choose additive tables/columns without weakening masking or snapshot rules |
| Whether BAYAR-003 creates `payment_instructions` and starts the 1x24h deadline | No | Ticket out-of-scope says payment instructions belong later, while acceptance criterion says final role data makes payment available; reconcile with BAYAR-004 boundary before implementation |
| Exact seller/buyer field ownership and editable/frozen cutoff | Yes, with source mapping | Use UI-SCR-003/004/007/008 and TRD role-owned snapshots; no cross-role writes and freeze before payment instruction issuance |
| Invitation expiry duration and reissue behavior | Yes | Approved requirements specify 3x24h invitation expiry and reissue invalidates the prior link; preserve token hash-only storage |
| One active invitation per target role | Partly | Existing schema has token uniqueness but not active-target uniqueness; service transaction and likely partial index/migration must prevent duplicate active links |
| Exact service-fee calculation | No for this ticket | Shared terms must validate an approved total, but cancellation/service-fee policy is downstream; do not invent a fee formula here |
| Admin transaction read scope | Yes | Admin can read operationally permitted transaction data; raw sensitive data remains restricted by the approved authorization boundary |
| Payment deadline timer start | No | Must begin only when payment instructions are actually available and never before; ownership between BAYAR-003 and BAYAR-004 must be resolved in plan review |
| Buyer/Seller role claim in session | Yes | BAYAR-002 uses no permanent Buyer/Seller account role; transaction role comes from the participant binding and server-side transaction record |

## Research Conclusion

~~~text
Recommended implementation boundary: Add a server-authoritative transaction
service on top of BAYAR-002. Implement seller-created and buyer-created
transaction commands, hashed single-use invitation lifecycle, distinct-account
join, role-owned data validation/snapshots, authorized transaction reads,
approved pre-payment state/version transitions, idempotency, audit, and the
UI-SCR-002..009 mobile-width surfaces.

Main risks: Current schema does not contain all approved role-owned physical
goods and payout/refund destination fields; invitation active-link uniqueness
is not fully constrained; payment-readiness/payment-instruction ownership is
ambiguous between BAYAR-003 and BAYAR-004; and no transaction mutation/audit
repository exists yet. Do not implement payment, bank review, WhatsApp group,
or payout behavior in this ticket.

Files likely affected: `src/server/db/schema.ts` plus a focused migration if
needed, `src/server/domain/transaction/*`, `src/server/transaction/*`,
`src/server/validation/*`, `src/server/audit/*`, `src/app/api/transactions/*`,
transaction UI/components, tests, and possibly the dashboard role-start
surface. No product document or later ticket should change.

Ready to plan: Yes, provided the implementation plan explicitly resolves the
payment-instruction boundary and records the schema choice for role-owned
snapshots before coding.
~~~
