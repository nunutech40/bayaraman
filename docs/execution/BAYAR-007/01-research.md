# Codebase Research: BAYAR-007

## Task

```text
Ticket ID/title: BAYAR-007 — Buyer Confirmation Link and WhatsApp OTP
Requested outcome: Buyer-bound confirmation link and WhatsApp OTP may move an
eligible transaction to READY_FOR_PAYOUT without performing payout.
Source requirements: UR-BUYER-006, UR-BUYER-007, UR-BUYER-008, UR-SYSTEM-002,
UR-SYSTEM-003, UR-ADMIN-008, UR-BR-004, UR-BR-014, UR-BR-015, UR-BR-020,
UR-BR-025, UR-BR-036
Source UX Flow/UI/QA IDs: UX-FLOW-023..025, UX-FLOW-027..030,
UI-SCR-013..016, UI-SCR-020, QA-CONF-001..005, QA-SLA-002,
QA-SEC-001..002
```

## Relevant Context Read

| File/doc | Why it is relevant | Key constraint found |
| --- | --- | --- |
| `docs/engineering/tickets/BAYAR-007-buyer-confirmation-otp.md` | Approved ticket boundary | Only Buyer confirmation/OTP; payout, refund, Seller OTP, and complaint adjudication are out of scope. |
| `docs/execution/BAYAR-006/04-validation.md` | Previous ticket handoff | BAYAR-006 produces `READY_FOR_BUYER_CONFIRMATION`; link/OTP remains BAYAR-007. |
| `PRD.md` v0.2 | Product boundary | Buyer confirmation is separate from payout; silence never authorizes automatic payout. |
| `TRD.md` v1.2 | State, security, and data boundary | Use approved transaction states, state version, idempotency, audit, and masked participant data. |
| `src/server/db/schema.ts` | Existing persistence | `confirmation_links` and `confirmation_otps` already exist, but are not used by any service or route. |
| `src/server/auth/whatsapp-verification.ts` | Existing OTP pattern | Uses SHA-256 hash, row locking, five attempts, five-minute TTL, and 60-second request cooldown. This is account-verification logic, not transaction confirmation logic. |
| `src/server/auth/whatsapp-delivery.ts` | Delivery boundary | Provider-neutral manual adapter with `PENDING`, `SENT`, `FAILED`, `UNKNOWN`; no WhatsApp API. |
| `src/server/auth/authorization.ts` | Authorization pattern | Session resolves the server-side account; Admin access uses `isAdmin`; participant access is transaction-scoped. |
| `src/server/transaction/token.ts` | Token pattern | Generates random URL-safe token and stores SHA-256 hash; raw token is returned only at creation. |
| `src/server/operations/whatsapp.ts` | BAYAR-006 state handoff | Reads checkpoint heads and advances through `READY_FOR_BUYER_CONFIRMATION`; no confirmation-link generation. |
| `src/components/transactions/status.tsx` | Existing participant UI | Uses mobile-width shell and transaction state; no confirmation screen or OTP state exists. |
| `src/server/domain/transaction/state.ts` | State vocabulary | Approved target is `READY_FOR_PAYOUT`; timeout states include `BUYER_CONFIRMATION_OVERDUE` and `MANUAL_REVIEW_REQUIRED`. |

## Current Behavior

- There is no confirmation-link route, service, page, or API.
- `confirmation_links` currently stores:
  `transaction_id`, hashed token, `buyer_whatsapp_snapshot`, `expires_at`,
  `used_at`, and `created_at`.
- `confirmation_otps` currently stores:
  `confirmation_link_id`, hashed code, attempts, expiry, verified timestamp,
  and creation timestamp.
- No code inserts or reads either confirmation table.
- Existing invitation token hashing is reusable for link-token hashing, but
  invitation tokens are a separate transaction-join concern and must not be
  reused as confirmation tokens.
- Existing account WhatsApp verification is authenticated-session based. It
  updates `accounts.whatsapp_verified_at`; BAYAR-007 must instead bind OTP to
  the immutable Buyer transaction snapshot and must not change account contact
  verification as its confirmation side effect.
- The current transaction UI renders state and Midtrans payment status only.
  There is no public confirmation-link page or Buyer OTP form.
- No scheduled job currently handles the confirmation reminder at 1x24 hours
  or overdue transition at 2x24 hours. The existing payment-expiry job is a
  separate deadline and must not be reused without a distinct command/state
  boundary.
- No code currently transitions `READY_FOR_BUYER_CONFIRMATION` to
  `WAITING_BUYER_CONFIRMATION`, `READY_FOR_PAYOUT`, or
  `BUYER_CONFIRMATION_OVERDUE`.
- No code currently prevents payout eligibility on complaint/risk hold at the
  confirmation mutation boundary. BAYAR-007 must check the approved hold
  boundary without implementing payout or complaint adjudication.

## Code Map

| Responsibility | Existing file/module | Symbol/route | Notes |
| --- | --- | --- | --- |
| Confirmation link persistence | `src/server/db/schema.ts` | `confirmationLinks` | Has hashed token and expiry, but no `issuedAt` or explicit buyer account FK. Buyer binding is currently a snapshot field and transaction relation. |
| OTP persistence | `src/server/db/schema.ts` | `confirmationOtps` | Hash and attempts exist; no cooldown/send-count/lock fields or delivery result. |
| Account OTP generation | `src/server/auth/whatsapp-verification.ts` | `generateOtp`, `requestWhatsappVerification`, `verifyWhatsappCode` | Reuse hashing/locking ideas, not account verification side effects or endpoint contract. |
| Manual delivery adapter | `src/server/auth/whatsapp-delivery.ts` | `WhatsappDeliveryAdapter` | Suitable provider-neutral boundary and fake adapter pattern. |
| Session authorization | `src/server/auth/authorization.ts` | `requireAuthenticatedAccount`, `requireAdminAccount` | Buyer link access still needs transaction participant and link-token checks. |
| Token hashing | `src/server/transaction/token.ts` | `createInvitationToken`, `hashInvitationToken` | Adapt pattern for one-time confirmation token without exposing raw token in persistence/logs. |
| Transaction state vocabulary | `src/server/domain/transaction/state.ts` | `TRANSACTION_STATES` | All likely states already exist; no new state should be added. |
| Transaction mutation/idempotency | `src/server/transaction/mutation.ts` | `findIdempotentResult`, `saveIdempotentResult` | Use actor scope plus command/key/request hash for link and OTP commands. |
| Audit | `src/server/transaction/audit.ts` | `recordTransactionEvent` | Use sanitized evidence references and correlation IDs; never write raw token or OTP. |
| Transaction access projection | `src/server/transaction/read.ts` | `readTransaction` | Participant-scoped read pattern; needs confirmation summary only if UI integrates it. |
| Existing transaction UI | `src/components/transactions/status.tsx` | `TransactionStatus` | Reuse `app-shell`, loading, error, and mobile-width surface patterns. |
| Existing scheduled job | `src/server/jobs/run-payment-expiry.ts` | payment expiry command | Separate confirmation reminder/overdue job boundary is needed; payment expiry must not be changed. |

## Existing Patterns To Reuse

- **Validation:** Zod request schemas in auth and transaction API routes.
- **Authorization:** Resolve the session server-side, then verify the Buyer
  participant for the specific transaction and confirmation-link hash.
- **OTP:** SHA-256 hash comparison, row lock, attempt increment, TTL check,
  cooldown, and provider-neutral delivery adapter from account WhatsApp
  verification. The final implementation must add transaction-specific
  single-use and delivery controls rather than update account verification.
- **Tokens:** Random URL-safe token plus persisted hash from
  `src/server/transaction/token.ts`; raw token may only be returned in the
  Admin/manual posting boundary and must not enter logs, cookies, or audit.
- **Mutations:** Database transaction, state-version conditional update,
  idempotency lookup/save, and append-only audit event.
- **UI:** Existing `app-shell`/`surface` mobile-width layout and explicit
  loading/error/disabled states.
- **Tests:** Vitest unit tests plus PostgreSQL integration tests gated by
  `TEST_DATABASE_URL`; use fixed clocks or injected time for expiry tests.

## Change Surface

| Area | Likely change? | Reason/risk |
| --- | --- | --- |
| UI | Yes | Add confirmation-link landing and OTP input states for UI-SCR-013/014; possibly Admin overdue/exception status projection without implementing exception payout. |
| API | Yes | Public token preview/link route, OTP request route, OTP verification route, and safe status/recovery route. Exact paths remain to be fixed in the Implementation Plan. |
| State | Yes | Add approved transitions only: confirmation-link creation/start, waiting confirmation, valid OTP to `READY_FOR_PAYOUT`, and timeout to `BUYER_CONFIRMATION_OVERDUE`. Do not add enum values. |
| Database | Yes | Existing tables need a concrete migration for buyer binding, single-use/concurrency enforcement, OTP lifecycle controls, and reminder/overdue timestamps or equivalent persistence. |
| Auth | Yes | Link-token plus Buyer transaction snapshot authorization; normal account session behavior must not allow Seller or another Buyer to use the link. |
| Jobs/integrations | Yes | Add separate deterministic reminder/overdue boundary and use the existing WhatsApp delivery adapter; no real WhatsApp provider. |
| Tests/docs | Yes | Unit, integration, security, fixed-clock, concurrency, delivery, UI-state, and validation evidence. |

## Unknowns And Assumptions

| Item | Can be inferred safely? | Evidence or decision needed |
| --- | --- | --- |
| Exact public confirmation-link route and OTP API routes | No | Must be fixed in Implementation Plan against repository routing conventions. |
| Whether link creation is Admin-only or a system mutation triggered by the second completion | No | Ticket says Admin posts the link, while the system starts the deadline; ownership and idempotency actor scope must be made concrete in the plan. |
| Confirmation-link deadline storage | Partially | Approved flow requires one absolute 2x24-hour window; existing `expires_at` can represent it, but reminder/overdue timestamp and job correlation need a persistence decision. |
| OTP resend policy | Partially | Approved requirements include 60-second cooldown, five invalid attempts, three sends per 30 minutes, and 30-minute lock; current account config only implements the first two basic limits. Plan must define transaction OTP fields/enforcement. |
| Buyer binding model | Partially | Existing snapshot field is not a foreign key. Plan must decide whether to add `buyer_account_id`, a composite participant FK, or an equivalent service/database invariant. |
| OTP delivery `FAILED`/`UNKNOWN` persistence | No | Existing account table has delivery result only for account verification. Confirmation OTP needs a concrete transaction-level delivery result and retry behavior. |
| Confirmation after complaint/risk hold | No | Approved requirements say active complaint hold blocks confirmation exception and payout; plan must define the exact guard without implementing complaint adjudication. |
| Manual confirmation reminder recording | No | UR-ADMIN-008 requires due time, posted time, and operator; persistence/API boundary must be specified. |
| Admin exception after overdue | No | BAYAR-007 ticket includes manual recovery/overdue but excludes payout; plan must define whether only eligibility is recorded and what two-Admin authorization boundary is required upstream. |

## Research Conclusion

```text
Recommended implementation boundary:
- Add a dedicated confirmation service around the existing confirmation link
  and OTP tables, with a separate migration for Buyer binding, lifecycle
  limits, reminder/overdue timestamps, and single-use constraints.
- Add buyer-bound token routes, WhatsApp-only OTP adapter calls, approved state
  transitions, audit/idempotency/state-version guards, and mobile UI states.
- Keep payout execution, refund, cancellation adjudication, complaint/risk
  decisioning, email fallback, Seller OTP, and real WhatsApp API out of scope.

Main risks:
- Reusing account verification directly could incorrectly mutate account-level
  WhatsApp verification or permit the wrong Buyer.
- A link-token route without transaction snapshot and state checks could permit
  replay or cross-transaction confirmation.
- Concurrent OTP verification could produce duplicate confirmation or bypass
  single-use behavior unless the row and transaction are locked together.
- Reminder/overdue automation could accidentally create payout eligibility or
  reset the original confirmation deadline.

Files likely affected:
- `src/server/db/schema.ts`
- New BAYAR-007 migration and journal entry
- New confirmation service/contracts/routes and confirmation UI components
- Confirmation/reminder job boundary
- Unit/integration tests

Ready to plan: Yes, after the unresolved route, link-ownership, OTP lifecycle,
and reminder/overdue persistence decisions are made concretely in the plan.
```
