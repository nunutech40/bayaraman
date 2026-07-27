# Implementation Plan

## Task

~~~text
Ticket ID/title: BAYAR-002 — Account Access and WhatsApp Verification
Outcome: Harden the existing account/session/WhatsApp-verification implementation
to the approved ticket and TRD boundaries without rebuilding it or adding
transaction behavior.
Source research: docs/execution/BAYAR-002/01-research.md
Source requirements and QA scenarios: UR-ACCOUNT-001, UR-ACCOUNT-002,
UR-BR-001, UR-BR-002, UR-BR-004, UR-BR-026, UR-ADMIN-025;
QA-ACCOUNT-001..003, QA-SEC-001..002.
Source UX Flow and UI IDs/states: UX-FLOW-001, UX-FLOW-002, UX-FLOW-005,
UX-FLOW-009; UI-SCR-001, UI-SCR-002.
~~~

Status: Draft

## Scope

### In Scope

- Preserve the existing Argon2id, `jose` HS256 session, HTTP-only cookie,
  server-side authorization, provider-neutral WhatsApp adapter, and mobile UI.
- Add database enforcement for case-insensitive email uniqueness and safe
  current-account OTP replacement/single-use verification.
- Remove plaintext OTP from browser/API responses, logs, and audit.
- Test verified-WhatsApp participation and server-side Admin denial.

### Out Of Scope

- Real WhatsApp API, email/alternate-channel OTP, password reset, social login,
  persistent session revocation, transaction confirmation OTP, or transaction
  behavior of any kind.
- Permanent Buyer/Seller account roles, Admin task-assignment UI, new roles,
  states, or a visual redesign.
- Retroactive E.164 conversion of existing WhatsApp data. Exact trimmed-string
  uniqueness stays in place until a separate data-format decision is approved.

## Planned Changes

| Step | Change | File/module | Requirement/UX/UI/AC covered | Verification |
| --- | --- | --- | --- | --- |
| 1 | Keep existing dependencies and environment names. Change session-secret validation to UTF-8 byte length; preserve HS256, seven-day expiry, cookie name/flags, and test-only secret. | `src/server/auth/config.ts`, `.env.example` | TRD 3/4/12; session AC | Missing/short non-test secret fails; test secret works; old token fails after rotation. |
| 2 | Add additive `0004` migration. Run a SQL `DO` preflight that groups by `lower(email)` and raises before any index/row mutation when duplicates exist. Create named expression index `accounts_email_normalized_unique ON accounts (lower(email))`; retain `accounts_email_unique` as a compatibility raw index while the expression index is canonical. Add nullable `superseded_at`, `delivery_result`, and `delivery_attempted_at`; named delivery-result check; and partial unique active-challenge index with predicate `verified_at IS NULL AND superseded_at IS NULL`. | `src/server/db/schema.ts`, `drizzle/0004_*`, `drizzle/meta/_journal.json` | UR-ACCOUNT-001/002, UR-BR-002/026 | Clean migration, collision fixture, duplicate active challenge, invalid delivery result, and schema inspection tests. |
| 3 | Keep Zod email normalization and Argon2id, but use the lower-email invariant for lookup/registration. Map unique conflict to safe generic registration response; preserve identical login responses for malformed, unknown, and bad credentials. | `src/server/auth/account-schema.ts`, `account-service.ts`, register/login routes | UR-ACCOUNT-001; UI-SCR-001; QA-ACCOUNT-001/002 | Case-variant duplicate, weak password, normalized login, and enumeration-safe response tests. |
| 4 | Keep the signed-cookie model. Validate only approved claims/expiry, retain `productRole: null` at login, and resolve authority server-side. Invalid/expired/forged sessions return API `401`; server pages redirect to `/login`; middleware remains a coarse cookie-presence redirect and does not write audit. Logout clears the cookie; no session store/revocation is added. | `session.ts`, `cookies.ts`, `authorization.ts`, auth routes/pages, `middleware.ts` only for coarse routing | UR-BR-001, UR-ADMIN-025; UX-FLOW-001/002/005 | HS256 claims, forged/expired token, cookie flags, rotation, API 401, page redirect, and server guard tests. |
| 5 | Serialize OTP requests with a PostgreSQL transaction-scoped advisory lock keyed by `accountId`. After the lock, read newest request for the 60-second cooldown; active means exactly `verified_at IS NULL AND superseded_at IS NULL`; supersede all active rows and insert one challenge in the same transaction. Commit before calling the delivery adapter. Update `delivery_result` and `delivery_attempted_at` afterward; adapter throw records `UNKNOWN` without cancelling the challenge. A concurrent second request returns the cooldown result, not HTTP 500. | `whatsapp-verification.ts`, `whatsapp-delivery.ts`, schema/migration | UR-ACCOUNT-002, UR-BR-002/026; QA-ACCOUNT-001/002 | Parallel first requests, resend, prior-code rejection, `FAILED`, `UNKNOWN`, and adapter-throw PostgreSQL tests. |
| 6 | Make OTP verification single-use and concurrency-safe. Lock the active challenge row with `FOR UPDATE`, atomically increment failed attempts, reject expired/over-limit/superseded/used codes, and atomically mark the valid challenge plus `accounts.whatsapp_verified_at`. | `whatsapp-verification.ts` | UR-ACCOUNT-002; QA-ACCOUNT-001/002 | Fixed-clock and parallel verification tests; exactly one success updates account. |
| 7 | Sanitize public/audit behavior. OTP API returns challenge ID and delivery result only; remove `developmentCode`. Audit allowlists are explicit: registration/login success `{accountId, correlationId, outcome}`, login failure `{correlationId, outcome: DENIED}`, logout `{accountId, correlationId, outcome}`, OTP request `{accountId, correlationId, deliveryResult}`, OTP verification `{accountId, correlationId, outcome}`, and authorization denial `{accountId?, correlationId, resource, reasonCategory}`. No challengeId, OTP, token, phone, password, cookie, secret, or provider payload enters audit. | WhatsApp request route, `VerifyWhatsapp`, auth audit/authorization modules | TRD 12/14; UR-ADMIN-025; QA-SEC-001/002 | Response/audit redaction tests and one-event-per-denial tests. |
| 8 | Preserve UI-SCR-001/002. Keep loading, disabled, error, verified redirect, role start, labels, focus, and constrained mobile-width layout. Change OTP copy to delivery status only. | `src/components/auth/*`, auth pages only if required | UI-SCR-001/002; UX-FLOW-001/002/009 | Manual mobile/desktop and keyboard/error-announcement check. |
| 9 | Add unit, PostgreSQL integration, and direct route/service tests. Update only BAYAR-002 validation document after implementation. | `tests/unit/auth.test.ts`, `tests/integration/auth.test.ts`, `docs/execution/BAYAR-002/04-validation.md` | Ticket AC; QA-ACCOUNT-001..003, QA-SEC-001/002 | Tests, typecheck, lint, build, migration, healthcheck, diff check. |

### Step Dependencies

1. Validate secret/session assumptions first.
2. Apply the collision-safe `0004` migration and database predicates before
   service changes depend on them.
3. Harden account, session recovery, advisory-locked OTP, audit, and UI in that
   order.
4. Run local OrbStack migration/tests last. No step calls a real provider or a
   transaction command.

## State And Data Impact

~~~text
State transitions added/changed:
None. Account verification remains the prerequisite represented by
accounts.whatsapp_verified_at. Challenge lifecycle values are persistence-only,
not transaction or product-role states.

Schema/migration impact:
One additive 0004 migration first runs a `DO` collision preflight, then creates
the named `accounts_email_normalized_unique` expression index on lower(email),
retaining the raw compatibility index. It adds nullable superseded_at,
delivery_result, and delivery_attempted_at, a named delivery-result check, and
the partial unique active predicate `verified_at IS NULL AND superseded_at IS
NULL`. No accounts are merged or rewritten automatically.

Authorization impact:
Claims never grant Buyer/Seller authority. Protected commands reload the
account server-side; participation requires whatsapp_verified_at and Admin
requires accounts.is_admin. Internal assignment labels remain non-role data.

Audit/notification impact:
Audit events are append-only and use the event-specific allowlists in Step 7.
Password, OTP, session secret, raw phone, challenge/token, cookie/JWT, raw
WhatsApp evidence, and provider credentials are excluded. Delivery result is
PENDING, SENT, FAILED, or UNKNOWN only and never marks verification. Middleware
does not audit; server-side authorization does, with one correlation ID/event
per denial.

Manual operation impact:
Delivery remains provider-neutral. Tests use a server-side fake adapter; no
browser-visible development OTP or real message delivery is introduced.
~~~

## Test Plan

| Layer | Case | Expected evidence |
| --- | --- | --- |
| Static | Typecheck, lint, production build | Auth routes/mobile shell compile without new transaction behavior. |
| Migration | Mixed-case email preflight then `0004` application | `DO` block fails before index/row mutation on collision; clean database gains named expression index, columns, checks, and partial predicate. |
| PostgreSQL | Duplicate normalized email, active challenge, delivery result | Database rejects invalid identity/challenge writes. |
| Unit | Argon2id, input normalization, generic login response | Password remains server-only; account existence is not revealed. |
| Unit | JWT, cookie, expiry, secret rotation | Exact HS256 claims; invalid/old tokens fail. |
| Integration | OTP request/resend/verify and concurrency | Advisory lock serializes parallel requests; hash at rest, TTL/cooldown/attempts, one current challenge, one verifier; adapter throw records UNKNOWN. |
| Integration | Auth/authorization/audit | API 401, server-page redirect, unverified/non-Admin denial, forged session, and Admin success are safe; one sanitized audit per denial. |
| UI/manual | UI-SCR-001/002 | Labels, error announcement, disabled controls, focus, and mobile-width desktop surface work. |

## Risks And Safeguards

| Risk | Safeguard | Recovery/rollback |
| --- | --- | --- |
| Mixed-case legacy email blocks uniqueness index | Read-only preflight fails before index creation; no auto-merge | Resolve duplicates explicitly then rerun migration. |
| Migration accidentally changes account ownership | `DO` preflight runs before index/row mutation and migration has clean/collision fixtures | Stop migration, resolve data externally, and rerun unchanged migration. |
| Concurrent OTP request bypasses cooldown | Transaction-scoped advisory lock keyed by account ID plus partial unique active predicate | Return cooldown result from second request; do not issue a second active challenge. |
| Resend leaves old OTP valid | Partial unique active challenge plus transactional supersede/issue | Invalidate active challenge using reviewed corrective tooling only. |
| OTP leaks in local development | Remove `developmentCode`; test with dependency-injected fake adapter | Invalidate challenge and rotate affected secret if exposed. |
| Delivery is treated as verification | Write verified timestamp only after valid locked OTP verification | Keep account blocked and retry only after cooldown. |
| Middleware becomes authorization source | Recheck signed session and account record in every server command | Reject/audit invalid request and route to login. |
| Confirmation OTP is changed accidentally | Keep account verification separate from confirmation-link OTP tables | Revert scope-leaking code; later ticket owns confirmation. |
| OrbStack leaks into production | Local migration/test runtime only | Production remains PostgreSQL-compatible. |

## Plan Completion Check

- [x] Every BAYAR-002 acceptance criterion maps to a change and verification.
- [x] UI-SCR-001 and UI-SCR-002 map to narrow existing-screen changes only.
- [x] Product roles remain Buyer, Seller, and Admin; Buyer/Seller stay transaction-scoped.
- [x] No transaction state, provider API, payment, or confirmation OTP is in scope.
- [x] Email and current OTP challenge rules have concrete PostgreSQL enforcement.
- [x] Session, cookie, secret, OTP retry/concurrency, and audit boundaries are explicit.
- [x] OTP request advisory lock, active predicate, delivery update timing, and
  adapter-throw result are explicit.
- [x] Server-side denial audit, middleware limitation, API 401/page redirect,
  and per-event audit allowlists are explicit.
- [x] `0004` preflight, expression index, raw compatibility index, named checks,
  and clean/collision migration tests are explicit.
- [x] WhatsApp canonicalization and persistent-session revocation are deferred explicitly.
- [ ] Plan Review approval is required before implementation.
