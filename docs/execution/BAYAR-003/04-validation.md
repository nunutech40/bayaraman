# BAYAR-003 Validation

## Metadata

```text
Ticket: BAYAR-003 — Transaction Creation and Counterparty Invitation
Implementation scope: Transaction creation, invitation preview/join/reissue,
role-owned transaction data, masked transaction read, and readiness boundary
Validated on: 2026-07-23
```

## Files Changed

- `src/server/db/schema.ts` for transaction item, buyer shipping, seller payout,
  and buyer refund destination tables and constraints.
- `drizzle/0001_uneven_bedlam.sql` for the local PostgreSQL migration.
- `src/server/transaction/` for contracts, calculation, token hashing,
  idempotency, audit, creation/join/data services, invitation, and reads.
- `src/app/api/transactions/` and `src/app/api/invitations/` for the approved
  transaction and invitation API routes.
- `src/app/transactions/`, `src/app/invite/`, and transaction components for
  the constrained mobile-width web UI.
- `src/app/dashboard/page.tsx` and `src/app/globals.css` for transaction entry
  links and role-data/status styling.
- `tests/unit/transaction.test.ts` for transaction calculation, token, masking,
  and input contract tests.

No product document, PRD, TRD, engineering ticket, or later ticket was changed.

## Commands And Results

| Command/check | Result |
| --- | --- |
| `npm test` | Pass: 3 test files, 13 tests |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass: no warnings or errors |
| `npm run build` | Pass: Next.js production build |
| `npm run db:generate` | Pass: no schema changes after migration generation |
| `npm run db:migrate` | Pass: migrations applied successfully |
| `docker compose exec -T postgres pg_isready -U bayaraman -d bayaraman` | Pass: accepting connections |
| `git diff --check` | Pass |

## Manual Smoke Test

Using two temporary, locally verified test accounts and the local PostgreSQL
container:

1. Seller created a transaction and received `WAITING_COUNTERPARTY` with a
   single-use invitation token.
2. Buyer previewed the invitation without receiving raw token or financial
   destination data in the response.
3. Buyer joined successfully; the transaction moved to
   `WAITING_COUNTERPARTY_DATA`.
4. Buyer submitted role-owned shipping and refund data; the state remained
   `WAITING_COUNTERPARTY_DATA` and readiness became true.
5. Repeating the seller create request with the same idempotency key returned
   the same transaction result.
6. Authorized transaction read returned masked participant/contact and bank
   data according to the participant boundary.
7. A request to the future payment-instructions endpoint returned `404`; this
   confirms BAYAR-003 does not create payment instructions or start expiry.

Temporary smoke-test accounts and transaction data were removed after the
test. No real WhatsApp delivery was used.

## Acceptance Criteria

- Verified non-Admin Buyer or Seller can create a transaction.
- Seller-created and Buyer-created inputs use the appropriate role-owned data.
- A transaction starts only at `WAITING_COUNTERPARTY`.
- Invitation preview is safe, token-hashed, expiring, and does not log or store
  the raw token.
- Only the opposite verified participant can join; self-join and duplicate role
  binding are rejected.
- Join changes the state only to `WAITING_COUNTERPARTY_DATA`.
- Buyer shipping, buyer refund, and seller payout data have persistence,
  ownership, masking, unique, and lock-boundary contracts.
- Role data is immutable once locked by the later payment-instructions stage.
- Role data mutation uses expected state version and increments the transaction
  version, allowing concurrent changes to fail with `STATE_VERSION_CONFLICT`.
- Duplicate create, join, role-data, and invitation operations are protected by
  idempotency boundaries.
- Audit events are append-only and include transaction state context without
  raw invitation tokens or unnecessary sensitive values.
- Read APIs expose only participant-authorized and masked projections.
- Readiness is derived for BAYAR-004 and does not create payment instructions,
  payment claims, review records, timers, WhatsApp groups, payout, refund,
  cancellation, complaint, or risk-hold behavior.
- Product roles remain only Buyer, Seller, and Admin.

## Scope Confirmation

- BAYAR-004 and later tickets were not implemented.
- No payment instruction or 1x24-hour expiry timer was created.
- No real WhatsApp provider integration was added.
- OrbStack is used only as the local PostgreSQL runtime; production remains
  PostgreSQL-compatible and does not depend on OrbStack.

## Residual Risks

- WhatsApp verification is exercised through the existing local controlled
  verification boundary; this ticket does not integrate a real WhatsApp
  provider.
- Raw bank account values are restricted to server-side financial/admin
  boundaries, but database-at-rest encryption and production secret management
  remain deployment concerns.
- The smoke test validated the API and built UI routes locally; a full browser
  automation suite remains a later QA/engineering concern.
- `npm install` reports existing dependency audit findings (7 moderate,
  6 high, 1 critical); forced upgrades were not introduced in this ticket.

## Status

```text
Implementation: Complete
Validation: Passed with residual risks documented
```
