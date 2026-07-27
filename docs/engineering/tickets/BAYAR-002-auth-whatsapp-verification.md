# Engineering Ticket

## Ticket

~~~text
ID: BAYAR-002
Title: Account Access and WhatsApp Verification
Type: Feature
Priority: P0
Owner: Engineering
Status: Draft
Depends on: BAYAR-001
Blocks: BAYAR-003
Source requirement IDs: UR-ACCOUNT-001, UR-ACCOUNT-002, UR-BR-001, UR-BR-002, UR-BR-004, UR-BR-026, UR-ADMIN-025
Source UX Flow IDs: UX-FLOW-001, UX-FLOW-002, UX-FLOW-005, UX-FLOW-009
Source UI IDs/states: UI-SCR-001, UI-SCR-002
Source QA scenario IDs: QA-ACCOUNT-001, QA-ACCOUNT-002, QA-ACCOUNT-003, QA-SEC-001, QA-SEC-002
Source technical design section: TRD Sections 3, 4, 12, 13, 14
~~~

## Outcome

An account can register, log in, maintain a seven-day signed session, verify
one WhatsApp number, and participate only after verification. Transaction role
is selected per transaction, never stored as a permanent account role.

## In Scope

- Lowercase email normalization, Argon2id password hashing, duplicate rejection,
  generic login failure, and server-side Admin flag authorization.
- `jose` HS256/JWS in HTTP-only `bayaraman_session`, SameSite=Lax, Secure only
  in production, path `/`, seven-day expiry, and minimal approved claims.
- `AUTH_SESSION_SECRET` validation (minimum 32 random bytes), test secret,
  rotation invalidation, and logout.
- WhatsApp-only six-digit OTP, five-minute TTL, five attempts, 60-second
  request cooldown, hashed single-use codes, and provider-neutral delivery
  results `PENDING`, `SENT`, `FAILED`, `UNKNOWN`.
- UI-SCR-001/002 states and append-only security audit.

## Out Of Scope

Real WhatsApp API, email OTP, password reset, transaction creation, payment,
and any transaction state.

## Acceptance Criteria

- Duplicate emails differing only by case are rejected; weak passwords are
  rejected; login errors do not reveal account existence.
- Missing/short production secret fails startup; test configuration is explicit;
  rotating the secret invalidates existing sessions.
- Valid session claims contain only accountId, sessionId, productRole,
  issuedAt, and expiresAt; password, OTP, secret, and financial data never
  enter cookies, logs, or audit.
- OTP rules, cooldown, expiry, attempt limit, single-use, and delivery result
  handling are enforced; only valid OTP writes `whatsappVerifiedAt`.
- Unverified participation and non-Admin access to Admin resources are denied
  server-side and audited.

## Verification

Run QA-ACCOUNT-001..003 and QA-SEC-001..002 plus tests for Argon2id, JWT/cookie
flags, secret rotation, OTP boundaries, fake delivery, enumeration resistance,
and mobile states.

## Definition Of Done

No live provider call, no new role/state, and ticket remains Draft until review.
