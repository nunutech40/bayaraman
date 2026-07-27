# BAYAR-002 Validation

## Metadata

~~~text
Ticket: BAYAR-002 — Account Access and WhatsApp Verification
Implementation scope: Account access, signed session, WhatsApp verification,
server authorization/audit boundary, auth UI, and additive auth migration only
Validated on: 2026-07-27
~~~

## Files Changed

- `src/server/auth/config.ts`: startup secret validation using UTF-8 byte length.
- `src/server/auth/account-service.ts`: case-insensitive normalized email lookup.
- `src/server/auth/audit.ts`: event-specific sanitized audit allowlists.
- `src/server/auth/authorization.ts`: server-side denial audit boundary.
- `src/server/auth/whatsapp-verification.ts`: advisory-locked OTP issuance,
  delivery result persistence, and row-locked single-use verification.
- Auth routes and WhatsApp verification UI: removed plaintext development OTP,
  added sanitized delivery-state messaging, and recorded approved audit payloads.
- `src/server/db/schema.ts`: active challenge fields, delivery check, and
  partial unique active-challenge index.
- `drizzle/0004_bayar002_auth_boundaries.sql` and migration journal: additive
  normalized-email and WhatsApp challenge constraints.
- `tests/unit/auth.test.ts`: audit redaction coverage.
- `tests/integration/auth.test.ts`: PostgreSQL email/index, concurrent OTP,
  and adapter-UNKNOWN coverage.
- This validation report.

No Product Brief, User Journey, UX Flow, User Requirements, UI/UX Specification,
QA Scenarios, PRD, TRD, ticket, prototype, or unrelated transaction feature was
changed. No product role or transaction state was added.

## Commands And Results

| Command/check | Result |
| --- | --- |
| `npm test` | Pass: 6 test files, 21 tests; default run skips DB integration when `TEST_DATABASE_URL` is absent |
| `TEST_DATABASE_URL=... npm test` | Pass: 6 test files, 21 tests, including BAYAR-001 and BAYAR-002 PostgreSQL integration |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass: no ESLint warnings or errors |
| `npm run build` | Pass: Next.js production build |
| `npm run db:migrate` | Pass: additive `0004_bayar002_auth_boundaries` applied to local PostgreSQL |
| `npx drizzle-kit check` | Pass: migration/schema journal is consistent |
| `docker compose ps` | Pass: PostgreSQL container running via OrbStack on port 54329 |
| `pg_isready -U bayaraman -d bayaraman` | Pass: PostgreSQL accepting connections |
| `git diff --check` | Pass |

## Acceptance Criteria

- Duplicate emails differing only by case are rejected; normalized login uses
  lowercase email; weak passwords remain rejected; login responses are generic.
- `AUTH_SESSION_SECRET` requires at least 32 UTF-8 bytes outside test mode;
  signed HS256 sessions use the approved HTTP-only seven-day cookie boundary.
- Session claims remain limited to account/session identity, product role,
  issued/expiry timestamps; no password, OTP, secret, or financial data enters
  the cookie.
- OTP is six digits, hashed at rest, single-use, five-attempt limited, five
  minutes TTL, and protected by a 60-second cooldown.
- PostgreSQL advisory locking and the partial unique predicate prevent concurrent
  active challenge issuance; a concurrent request returns cooldown behavior.
- Delivery results remain `PENDING`, `SENT`, `FAILED`, or `UNKNOWN`; adapter
  exceptions persist `UNKNOWN` and never verify an account.
- Only a valid, row-locked OTP verification writes `whatsappVerifiedAt`.
- Server-side account/Admin authorization is authoritative; denials are audited
  once with sanitized event-specific payloads.
- UI-SCR-001 and UI-SCR-002 retain constrained mobile-width auth surfaces and
  loading, disabled, error, focus, and delivery-state behavior.

## Scope Confirmation

- BAYAR-003 and later tickets were not implemented.
- No transaction creation, payment, Midtrans, payout, cancellation, complaint,
  risk hold, confirmation OTP, or real WhatsApp provider integration was added.
- OrbStack is only the local PostgreSQL runtime; production remains
  PostgreSQL-compatible and does not depend on OrbStack.

## Residual Risks

- WhatsApp delivery remains provider-neutral. `PENDING` and `SENT` do not prove
  message delivery; a future provider integration must preserve the boundary.
- Persistent session revocation and WhatsApp E.164 canonicalization remain
  deferred as recorded in the approved implementation plan.
- End-to-end browser testing of a real OTP delivery is intentionally deferred;
  this ticket uses the fake/provider-neutral adapter and PostgreSQL integration.

## Status

~~~text
Implementation: Complete
Validation: Passed with residual risks documented
Scope: BAYAR-002 only
~~~
