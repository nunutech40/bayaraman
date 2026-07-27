# Codebase Research

## Task

~~~text
Ticket ID/title: BAYAR-002 — Account Access and WhatsApp Verification
Requested outcome: An account can register, log in, maintain a seven-day
signed session, verify its WhatsApp number, and participate only after
verification.
Source requirements: UR-ACCOUNT-001, UR-ACCOUNT-002, UR-BR-001, UR-BR-002,
UR-BR-004, UR-BR-026, UR-ADMIN-025.
Source UX Flow/UI/QA IDs: UX-FLOW-001, UX-FLOW-002, UX-FLOW-005,
UX-FLOW-009; UI-SCR-001, UI-SCR-002; QA-ACCOUNT-001..003,
QA-SEC-001..002.
~~~

## Relevant Context Read

| File/doc | Why it is relevant | Key constraint found |
| --- | --- | --- |
| `docs/engineering/tickets/BAYAR-002-auth-whatsapp-verification.md` | Defines the ticket boundary | Account auth and account WhatsApp verification only; no real provider or transaction state. |
| `docs/execution/BAYAR-001/04-validation.md` | Foundation handoff | PostgreSQL migration, append-only audit, role constraint, and integration-test harness are available. |
| `TRD.md` sections 3, 4, 12-14 | Approved technical contract | `jose` HS256 cookie session, server-side authorization, Zod, audit, and only Buyer/Seller/Admin product roles. |
| `PRD.md` v0.2 | Approved product boundary | One reusable account needs verified WhatsApp before transaction participation; transaction role is not permanent. |
| `src/server/db/schema.ts` | Persistence evidence | `accounts` and `account_whatsapp_verifications` already exist; email uniqueness is currently raw-text only. |
| `src/server/auth/*` | Existing implementation evidence | Registration, Argon2id, JWT, cookie, OTP, delivery adapter, and authorization code already exist. |
| `src/app/api/auth/*`, `middleware.ts` | Route/access evidence | Auth endpoints and broad session-cookie redirect already exist; route handlers remain the authoritative guard. |
| `src/components/auth/*`, `src/app/*` | UI evidence | Login, registration, verification, and role-start screens already use the constrained mobile-width shell. |
| `tests/unit/auth.test.ts` | Current automated coverage | Covers normalization, Argon2id, session shape, and OTP format/delivery enum; no database or route-level auth tests. |

## Current Behavior

- Registration validates email/password/name/WhatsApp with Zod, lowercases the
  email, hashes the password with Argon2id, creates an account, creates a
  signed session, and writes an account-registration audit event.
- Login uses the normalized email and returns one generic error for malformed
  or invalid credentials. It creates a `jose` HS256 session in the
  HTTP-only `bayaraman_session` cookie for seven days.
- Session claims contain `accountId`, `sessionId`, `productRole`, `issuedAt`,
  and `expiresAt`. Login currently sets `productRole` to `null`, preserving the
  transaction-scoped Buyer/Seller model.
- WhatsApp verification creates a six-digit SHA-256-hashed challenge with a
  five-minute TTL, five attempts, and a 60-second request cooldown. A
  provider-neutral adapter returns only `PENDING`, `SENT`, `FAILED`, or
  `UNKNOWN`; delivery alone does not verify the account.
- Successful OTP verification updates the challenge and `accounts.whatsapp_verified_at`
  in one database transaction. `canParticipate` checks that timestamp.
- Middleware redirects unauthenticated browser requests for `/dashboard` and
  `/transactions`; server services independently enforce authentication and
  verified-WhatsApp participation.
- The root/login/verification/dashboard UI already exists in the mobile-width
  web surface. The verification screen currently exposes a development OTP in
  the browser response when `NODE_ENV=development`.

## Code Map

| Responsibility | Existing file/module | Symbol/route | Notes |
| --- | --- | --- | --- |
| Account validation | `src/server/auth/account-schema.ts` | `accountInputSchema`, `loginInputSchema` | Normalizes email but does not normalize WhatsApp to a canonical format. |
| Account persistence | `src/server/auth/account-service.ts` | `registerAccount`, `authenticateAccount` | Uses Drizzle and raw-text email lookup. |
| Password boundary | `src/server/auth/password.ts` | `hashPassword`, `verifyPassword` | Argon2id with eight-character minimum. |
| Session boundary | `src/server/auth/session.ts`, `cookies.ts`, `config.ts` | JWT/JWS and cookie helpers | HS256, 7 days, HTTP-only, Lax, production-only Secure. |
| Current account/Admin guard | `src/server/auth/authorization.ts` | `requireAuthenticatedAccount`, `requireAdminAccount`, `canParticipate` | Server-side `accounts.is_admin`; task assignment does not create a role. |
| WhatsApp OTP | `src/server/auth/whatsapp-verification.ts` | request/verify functions | Existing challenge persistence and cooldown; prior open challenges are not invalidated when a new challenge is issued. |
| Delivery seam | `src/server/auth/whatsapp-delivery.ts` | `WhatsappDeliveryAdapter` | Provider-neutral fake/manual implementation only. |
| Auth audit | `src/server/auth/audit.ts` | `recordAuthEvent` | Inserts into the append-only audit table introduced by BAYAR-001. |
| API boundary | `src/app/api/auth/*` | register/login/logout/me/WhatsApp routes | Zod then service; generic login response; OTP request response currently contains local code. |
| Browser gate | `middleware.ts` | `/dashboard`, `/transactions` matcher | Cookie-presence optimization only; route/service validation remains necessary. |
| UI | `src/components/auth/*`, `src/app/dashboard/page.tsx` | `AccountAccess`, `VerifyWhatsapp` | Existing loading/error/disabled states; no visual redesign required. |
| Tests | `tests/unit/auth.test.ts` | BAYAR-002 boundary tests | Extend with database, route, cookie, rotation, OTP lifecycle, and authorization tests. |

## Existing Patterns To Reuse

- Reuse Drizzle, shared `db`, Zod parsing at the route boundary, and the
  append-only audit writer; do not create an in-memory account store.
- Reuse `jose` and the current HTTP-only cookie helper. The server-side account
  record remains authoritative for Admin and verified-WhatsApp checks.
- Reuse the provider-neutral delivery adapter and keep any real WhatsApp API
  outside this ticket.
- Reuse the existing mobile-width UI and Indonesian copy. Improvements should
  be state/error/accessibility fixes, not a prototype port or redesign.
- Reuse BAYAR-001 PostgreSQL integration-test approach with
  `TEST_DATABASE_URL` and transaction rollback.

## Change Surface

| Area | Likely change? | Reason/risk |
| --- | --- | --- |
| UI | Yes, narrow | Remove client-visible development OTP and ensure verification/loading/error/recovery states match the ticket. |
| API | Yes | Preserve generic failures, safe OTP responses, and route-level audit/authorization behavior. |
| State | No transaction state | Account verification/session lifecycle only. |
| Database | Yes, additive | Enforce case-insensitive normalized email uniqueness and add any challenge fields/indexes needed for safe single-use/latest-challenge semantics. |
| Auth | Yes | Audit existing session secret, logout, cookie, OTP concurrency, and account verification checks against TRD. |
| Jobs/integrations | No live provider | Delivery stays provider-neutral; expiry is evaluated during verification. |
| Tests/docs | Yes | Add PostgreSQL and route/service tests; update only BAYAR-002 execution validation after coding. |

## Unknowns And Assumptions

| Item | Can be inferred safely? | Evidence or decision needed |
| --- | --- | --- |
| Case-insensitive email enforcement | Yes | Ticket requires it. Plan should use a lower-email unique PostgreSQL index and handle legacy collisions before adding it. |
| Account WhatsApp canonical format | No | Current validation accepts any trimmed 8-32 character text. Product requires unique/verified WhatsApp but does not define E.164 migration policy for existing accounts. |
| Local OTP testability | Yes | Keep the fake delivery adapter server-side; do not return plaintext OTP to browser/API responses, logs, audit, or cookies. |
| Latest OTP invalidation | Yes | Product requires bounded/single-use OTP. Plan should invalidate earlier unverified account-verification challenges transactionally when issuing a replacement. |
| Concurrent OTP verification | Yes | Plan should use a conditional update/lock so only one valid verification can succeed and attempts cannot race. |
| Server-side logout revocation | No | Current logout clears the cookie; HMAC secret rotation invalidates all sessions. A persistent session/revocation store would broaden scope and needs an explicit product/security decision. |
| Transaction confirmation OTP rules | Yes, defer | Buyer confirmation OTP is a later ticket and must not be conflated with account WhatsApp verification. |

## Research Conclusion

~~~text
Recommended implementation boundary:
Treat BAYAR-002 as a focused hardening and validation pass over the existing
account/auth implementation. Preserve the current jose/Argon2id/Drizzle/mobile
shell structure; add only the database and service changes needed for strict
email uniqueness, safe OTP replacement/concurrency, sanitized delivery
responses, server-side participation/Admin checks, and executable test coverage.

Main risks:
- A case-insensitive email migration can fail if legacy mixed-case duplicates
  exist.
- Returning development OTP values to the browser violates the approved secret
  boundary.
- Existing OTP challenges can remain valid after resend unless retirement is
  made atomic.
- Middleware cookie presence must never be treated as authorization.

Files likely affected:
- src/server/auth/*
- src/app/api/auth/*
- src/components/auth/verify-whatsapp.tsx
- src/server/db/schema.ts
- drizzle/0004_* migration and journal metadata
- tests/unit/auth.test.ts and new PostgreSQL/route-level auth tests
- .env.example and docs/execution/BAYAR-002/04-validation.md

Ready to plan: Yes. The plan must explicitly keep transaction confirmation OTP,
real WhatsApp provider delivery, password reset, and persistent session
revocation out of scope.
~~~
