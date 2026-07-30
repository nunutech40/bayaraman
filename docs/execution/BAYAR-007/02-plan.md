# Implementation Plan: BAYAR-007

## Task

```text
Ticket ID/title: BAYAR-007 — Buyer Confirmation Link and WhatsApp OTP
Outcome: A Buyer-bound confirmation link and WhatsApp OTP can record receipt
and move an eligible transaction to READY_FOR_PAYOUT without executing payout.
Source research: docs/execution/BAYAR-007/01-research.md
Source requirements and QA scenarios: UR-BUYER-006..008, UR-SYSTEM-002..003,
UR-ADMIN-008, UR-BR-004, UR-BR-014, UR-BR-015, UR-BR-020, UR-BR-025,
UR-BR-036; QA-CONF-001..005, QA-SLA-002, QA-SEC-001..002
Source UX Flow and UI IDs/states: UX-FLOW-023..025, UX-FLOW-027..030;
UI-SCR-013..016, UI-SCR-020
```

## Scope

### In Scope

- Admin creation of one Buyer-bound confirmation link after
  `READY_FOR_BUYER_CONFIRMATION`.
- Buyer-only token access, WhatsApp OTP request, OTP verification, and the
  approved transition to `READY_FOR_PAYOUT`.
- OTP lifecycle controls: six digits, five-minute TTL, five attempts,
  60-second cooldown, three sends per 30 minutes, and 30-minute lock after
  invalid-attempt limit.
- Manual/provider-neutral WhatsApp delivery result handling.
- Confirmation reminder due at 1x24 hours and overdue transition at 2x24 hours.
- Admin recovery/status projection, manual reminder recording, and controlled
  exception eligibility recording after overdue.
- Mobile-width Buyer confirmation/OTP UI and Admin status/recovery UI.
- Audit, idempotency, state-version, single-use, privacy, and concurrency
  enforcement.

### Out Of Scope

- Payout execution or bank transfer; BAYAR-008 owns that operation.
- Automatic payout, refund, cancellation adjudication, complaint adjudication,
  or risk decisioning. BAYAR-007 may record a controlled confirmation
  exception eligibility decision, but never executes a financial operation.
- Seller OTP, email fallback, alternate number, or channel switching.
- Real WhatsApp API integration or automatic WhatsApp parsing.
- Changing BAYAR-006 checkpoint events or payment/Midtrans authority.
- New product role, transaction state, or financial operation result.

## Approved Implementation Decisions

1. **Routes and ownership**
   - `POST /api/admin/transactions/[id]/confirmation-link` creates the link.
     The authenticated account must pass `requireAdminAccount`, which checks
     server-side `accounts.isAdmin = true`. `admin_task_assignment` is retained
     only as internal audit/task metadata and never creates a product role or
     a second permission boundary.
   - `GET /api/confirmation/[token]` returns a minimal Buyer confirmation
     preview only after a valid authenticated Buyer session is established.
   - `POST /api/confirmation/[token]/otp` requests WhatsApp OTP for the bound
     Buyer.
   - `POST /api/confirmation/[token]/verify` verifies the OTP and records
     receipt. Both Buyer routes require the session account to match the
     stored Buyer participant binding.
   - `GET /api/admin/transactions/[id]/confirmation` returns Admin status.
   - `POST /api/admin/transactions/[id]/confirmation/reminder` records that
     the Admin posted the due reminder externally. It does not extend expiry,
     create payout eligibility, or change the transaction state.
   - `POST /api/admin/transactions/[id]/confirmation/exception` records a
     controlled exception eligibility request/approval. It requires a valid
     Buyer completion checkpoint, no complaint/risk hold, a reason, an
     evidence reference, and two approvals from distinct Admin accounts. The
     second approval may transition only `BUYER_CONFIRMATION_OVERDUE` to
     `READY_FOR_PAYOUT`; it never executes payout.
   - The Admin create response may contain the raw URL only in the secured
     Admin/manual-posting response and includes `Cache-Control: no-store`.
     It is never logged, audited, placed in a cookie, or returned to a
     participant projection. MVP has no revoke/reissue operation.

2. **Confirmation lifecycle**
   - Link creation is allowed only in `READY_FOR_BUYER_CONFIRMATION`, with
     both completion checkpoints present through the BAYAR-006 projection and
     no blocking complaint/risk/payout hold.
   - Creation inserts one link with a random token hash and an absolute
     `expiresAt = createdAt + 2x24 hours`, then atomically changes the
     transaction to `WAITING_BUYER_CONFIRMATION`.
   - A duplicate Admin create request with the same idempotency key returns
     the same result. `confirmation_links_one_transaction_unique` enforces
     one link row per transaction in MVP; a second link is rejected by the
     database. A named `confirmation_links_used_at_immutable_trigger` allows
     `used_at` only once from NULL to a timestamp and rejects later updates or
     deletes of the consumed link.
   - Expiry and reminder timestamps are absolute and never reset by refresh,
     OTP resend, delivery retry, or reminder recording.
   - Valid OTP changes only `WAITING_BUYER_CONFIRMATION` to
     `READY_FOR_PAYOUT`; no payout operation is started.
   - Overdue processing changes only an eligible
     `WAITING_BUYER_CONFIRMATION` transaction to
     `BUYER_CONFIRMATION_OVERDUE`. Buyer silence never changes it to payout.

3. **Buyer binding and privacy**
   - Store `buyerAccountId` together with the Buyer WhatsApp snapshot and a
     composite foreign key to the Buyer participant row.
   - Every token request validates token hash, transaction, Buyer account,
     snapshot, current state, expiry, usedAt, and hold state server-side.
   - Participant responses contain only masked WhatsApp data, deadline,
     delivery status, attempt/cooldown messaging, and transaction summary.
   - Raw token, OTP plaintext, raw WhatsApp content, secrets, and unrelated
     participant/financial data never enter logs, audit payloads, cookies, or
     participant responses.

4. **OTP and delivery**
   - Use a dedicated confirmation OTP service, reusing hash and row-lock
     patterns from account verification without changing
     `accounts.whatsappVerifiedAt`.
   - Store only the SHA-256 OTP hash. Only the newest non-superseded challenge
     is valid for the link.
   - Request cooldown is measured from the last request. Send count is tracked
     in a rolling 30-minute window; the third send is the final permitted send
     in that window. Invalid attempts are counted atomically and a fifth
     invalid attempt sets a 30-minute lock.
   - Delivery results are `PENDING`, `SENT`, `FAILED`, and `UNKNOWN`. `FAILED`
     can retry after cooldown; `UNKNOWN` cannot be treated as delivered.
     Delivery failure does not alter the transaction state.
   - OTP verification runs in one PostgreSQL transaction and locks the
     confirmation link, the newest OTP challenge, and the transaction row.
     It validates token hash, Buyer account/snapshot, state, link expiry,
     `used_at`, challenge expiry, attempts, `locked_until`,
     `superseded_at`, and expected state version before a conditional update.
     The update predicate requires `used_at IS NULL` and the expected state;
     only one concurrent verification can succeed. A retry with the same
     idempotency key returns its stored final result.

5. **Manual recovery**
   - `CONFIRMATION_REMINDER_SWEEP` and `CONFIRMATION_OVERDUE_SWEEP` are
     deterministic commands entered through
     `src/server/jobs/run-confirmation-recovery.ts`, using actor scopes
     `SYSTEM:confirmation-reminder` and `SYSTEM:confirmation-overdue`.
     Conditional updates use transaction ID, state, state version,
     `reminderDueAt`, and `expiresAt`; reruns are idempotent.
   - Admin reminder recording stores operator, timestamp, and sanitized
     external evidence reference. It does not reset the deadline.
   - All authenticated `isAdmin=true` accounts may record status/reminder and
     participate in the two-Admin exception approval. The exception service
     records eligibility only; payout execution remains BAYAR-008.

## Planned Changes

| Step | Change | File/module | Requirement/UX/UI/AC covered | Verification |
| --- | --- | --- | --- | --- |
| 1 | Add additive confirmation lifecycle schema. Create `confirmation_links_one_transaction_unique` on `confirmation_links(transaction_id)` and enforce one MVP link per transaction; add `used_at` NULL-to-once trigger/guard. Add OTP fields `last_requested_at`, `send_window_started_at`, `send_count`, `cooldown_until`, `locked_until`, `superseded_at`, `delivery_result`, and `idempotency_key`; add checks for attempts `0..5`, send count `0..3`, and delivery `PENDING|SENT|FAILED|UNKNOWN`; add partial unique `confirmation_otps_one_active_link_unique` for one non-superseded challenge per link. Add `confirmation_exceptions` with reason, Buyer completion checkpoint, evidence reference, two distinct Admin approvers, approval timestamps, idempotency key, expected state version, and append-only audit references. Migration `0009` has duplicate/preflight checks and is transactional. | `src/server/db/schema.ts`, `drizzle/0009_bayar007_confirmation_otp.sql`, `drizzle/meta/_journal.json` | UR-BUYER-006..008, UR-ADMIN-009..011, UR-SYSTEM-002..003, UR-BR-036, QA-CONF-001..005, QA-SLA-002 | Clean migration, preflight failure, duplicate active link, invalid lifecycle values, direct-insert rejection, concurrent link/OTP/exception tests. |
| 2 | Define Zod contracts and sanitized result DTOs for link preview, OTP request/verify, Admin status, reminder recording, and exception request/approval. The exception contract uses `approvalAction: REQUEST|APPROVE`, requires reason/evidence/checkpoint references, and never accepts a payout command. | `src/server/confirmation/contracts.ts` | UI-SCR-013..016/020, UI-SCR-015, UR-ADMIN-009..011, QA-SEC-001..002 | Contract tests reject malformed tokens, OTPs, hashes, timestamps, unauthorized fields, missing exception evidence, and payout fields. |
| 3 | Implement confirmation link creation and Buyer-bound access service. Lock transaction, verify exact state/hold/checkpoint prerequisite, create token hash, store snapshot, transition to waiting confirmation, audit, and save idempotent result. Enforce `requireAdminAccount` from `accounts.isAdmin`; no assignment-based role is introduced. Return raw URL only to the Admin/manual-posting response with `Cache-Control: no-store`. | `src/server/confirmation/service.ts`, `src/server/transaction/audit.ts`, `src/server/transaction/mutation.ts`, `src/server/auth/authorization.ts` | UR-ADMIN-005, UR-BUYER-006, UR-BR-014, UX-FLOW-022..023, QA-CONF-001, QA-SEC-001 | Service/route tests cover valid Admin, Buyer/Seller rejection, wrong state, missing checkpoint, duplicate, unique-index collision, token privacy, no-store header, and state-version conflict. |
| 4 | Implement WhatsApp OTP request/verification using the existing provider-neutral adapter. Bind destination to the frozen Buyer snapshot, hash OTP, enforce TTL/cooldown/send window/attempt lock, single-use row lock, and only valid transition to `READY_FOR_PAYOUT`. | `src/server/confirmation/service.ts`, `src/server/auth/whatsapp-delivery.ts` | UR-BUYER-006..008, UR-BR-004, UR-BR-015, UR-BR-036, UX-FLOW-023..025, UX-FLOW-033, QA-CONF-002..004, QA-SEC-002 | Fixed-clock tests cover valid/invalid/expired/locked/cooldown/delivery results, duplicate verification, concurrent verification, hold guard, and no payout call. |
| 5 | Add API routes with session and Buyer/Admin permission boundaries. Never accept Buyer account, WhatsApp number, state, or token hash as authoritative client input. Add controlled exception request/second-Admin approval route with concrete reason, evidence reference, Buyer completion checkpoint, two distinct `isAdmin` approvers, idempotency, and expected state version. | `src/app/api/admin/transactions/[id]/confirmation-link/route.ts`, `src/app/api/confirmation/[token]/route.ts`, `src/app/api/confirmation/[token]/otp/route.ts`, `src/app/api/confirmation/[token]/verify/route.ts`, `src/app/api/admin/transactions/[id]/confirmation/route.ts`, `src/app/api/admin/transactions/[id]/confirmation/reminder/route.ts`, `src/app/api/admin/transactions/[id]/confirmation/exception/route.ts` | UR-BUYER-006..008, UR-ADMIN-008..011, UX-FLOW-023..030, QA-SEC-001..002 | Route tests cover unauthenticated, Buyer/Seller rejection, wrong Buyer, expired token, Admin acceptance, two-Admin distinctness, hold/evidence rejection, idempotency conflict, no-store, and sanitized responses. |
| 6 | Add reminder/overdue service and job boundary with absolute timestamps and conditional state updates. Use fixed clock, exact commands `CONFIRMATION_REMINDER_SWEEP` and `CONFIRMATION_OVERDUE_SWEEP`, actor scopes, append-only audit, and no deadline reset. Add controlled exception service that can perform only `BUYER_CONFIRMATION_OVERDUE -> READY_FOR_PAYOUT` after two Admin approvals; it never calls payout. | `src/server/jobs/run-confirmation-recovery.ts`, `src/server/confirmation/recovery.ts`, `src/server/confirmation/exception.ts`, `package.json` script | UR-SYSTEM-002..003, UR-ADMIN-008..011, UR-BR-014..015, UX-FLOW-027..030, QA-SLA-002 | Job rerun/idempotency, exact 1x24/2x24 boundaries, stale state, hold, two-Admin approval, and no-auto-payout tests. |
| 7 | Build Buyer confirmation link/OTP pages and Admin status/recovery/controlled-exception surface using the existing mobile-width shell. | `src/app/confirm/[token]/page.tsx`, `src/components/confirmation/buyer-confirmation.tsx`, `src/app/admin/confirmation/page.tsx`, `src/components/admin/confirmation-status.tsx`, `src/components/admin/confirmation-exception.tsx` | UI-SCR-013..016/020, UI-SCR-015; UX-FLOW-023..030 | Manual/browser checks cover loading, empty/invalid, expired, cooldown, locked, UNKNOWN, success, overdue, exception evidence/approval, unauthorized, keyboard labels, focus, and mobile-width layout. |
| 8 | Add unit, service, PostgreSQL integration, route, job, privacy, and regression tests. | `tests/unit/confirmation.test.ts`, `tests/integration/confirmation.test.ts`, `tests/integration/confirmation-recovery.test.ts` | QA-CONF-001..005, QA-SLA-002, QA-SEC-001..002 and all ticket acceptance criteria | Full test suite, migration, typecheck, lint, build, healthcheck, and diff check. |

## State And Data Impact

```text
State transitions added/changed:
- READY_FOR_BUYER_CONFIRMATION -> WAITING_BUYER_CONFIRMATION when Admin
  creates the single confirmation link.
- WAITING_BUYER_CONFIRMATION -> READY_FOR_PAYOUT only after valid Buyer OTP,
  exact snapshot binding, no blocking hold, and successful conditional update.
- WAITING_BUYER_CONFIRMATION -> BUYER_CONFIRMATION_OVERDUE after the absolute
  2x24-hour deadline when no valid confirmation exists.
- No new transaction state or financial result is introduced.

Schema/migration impact:
- Extend `confirmation_links` with buyer binding, reminder/overdue lifecycle,
  active-link enforcement, sanitized reminder evidence/operator fields, and a
  trigger/conditional update that permits `used_at` only from NULL once.
- Add unique `confirmation_links_one_transaction_unique` on
  `transaction_id`; MVP has no revoke/reissue and therefore no partial link
  predicate is needed.
- Extend `confirmation_otps` with `last_requested_at`,
  `send_window_started_at`, `send_count`, `cooldown_until`, `locked_until`,
  `superseded_at`, `delivery_result`, and `idempotency_key`. Add named checks
  `confirmation_otps_attempts_check`, `confirmation_otps_send_count_check`,
  and `confirmation_otps_delivery_result_check`, plus partial unique
  `confirmation_otps_one_active_link_unique` where `superseded_at IS NULL`.
- Add `confirmation_exceptions` with `transaction_id`,
  `buyer_completion_checkpoint_id`, `reason`, `evidence_reference`,
  `first_approved_by_admin_id`, `second_approved_by_admin_id`, approval
  timestamps, `decision`, `idempotency_key`, and `expected_state_version`.
  A database check requires two distinct Admin accounts before approval.
- Migration `0009_bayar007_confirmation_otp.sql` runs preflight checks for
  duplicate transaction links, multiple active OTPs, invalid lifecycle values,
  and incomplete buyer bindings before DDL; DDL is transactional and additive.
- Migration does not touch BAYAR-006 checkpoint evidence or Midtrans tables.

Authorization impact:
- `requireAdminAccount` checks authenticated session plus
  `accounts.isAdmin = true` for every Admin route. Assignment metadata may be
  displayed/audited but cannot grant access. The exception approval stores two
  distinct Admin account IDs and rejects self-approval.
- Only the bound Buyer participant can preview, request OTP, or verify OTP.
- Seller and unrelated accounts are rejected; Admin cannot use the Buyer OTP
  route as a substitute for Buyer confirmation.

Audit/notification impact:
- Audit link creation, OTP request/result, confirmation success/failure,
  reminder recording, and overdue transition with sanitized references.
- Never record raw link token, OTP plaintext, raw WhatsApp message, or secrets.
- Delivery adapter result is recorded; no real WhatsApp integration is added.

Manual operation impact:
- Admin manually posts the returned confirmation link in the existing WA group
  and records the reminder when due. Admin may record the two-Admin controlled
  exception eligibility after overdue, but payout remains downstream.
```

## API Contract

| Route | Actor | Request | Success | Failure/recovery |
| --- | --- | --- | --- | --- |
| `POST /api/admin/transactions/[id]/confirmation-link` | Authorized Admin | `expectedStateVersion`, `Idempotency-Key` | Returns one-time Admin posting URL and lifecycle summary | Wrong state/hold/duplicate/stale version rejected; retry same key returns same result. |
| `GET /api/confirmation/[token]` | Bound Buyer session | Token route parameter only | Masked transaction/OTP eligibility/deadline | Invalid, expired, used, wrong account, Seller, or hold returns safe generic response. |
| `POST /api/confirmation/[token]/otp` | Bound Buyer session | `Idempotency-Key`, no destination input | Challenge status and delivery result, never OTP | Cooldown/lock/expired/FAILED/UNKNOWN returns safe state; retry allowed only by lifecycle rules. |
| `POST /api/confirmation/[token]/verify` | Bound Buyer session | `Idempotency-Key`, `challengeId`, six-digit `code`, `expectedStateVersion` | One audited confirmation and `READY_FOR_PAYOUT` | Invalid/expired/over-limit/concurrent/stale/hold response does not advance state. |
| `GET /api/admin/transactions/[id]/confirmation` | Authorized Admin | Transaction path only | Sanitized link/OTP/recovery status | Unauthorized or missing transaction rejected. |
| `POST /api/admin/transactions/[id]/confirmation/reminder` | Authorized Admin | `Idempotency-Key`, `evidenceReference`, `recordedAt`, `expectedStateVersion` | Reminder recorded once | Duplicate returns same result; deadline and state remain unchanged. |
| `POST /api/admin/transactions/[id]/confirmation/exception` | Admin (`isAdmin=true`) | `Idempotency-Key`, `expectedStateVersion`, `buyerCompletionCheckpointId`, `reason`, `evidenceReference`, optional `exceptionId`, `approvalAction` | First distinct Admin records pending eligibility; second distinct Admin approves and conditionally transitions `BUYER_CONFIRMATION_OVERDUE` to `READY_FOR_PAYOUT` | Missing/invalid Buyer completion, complaint/risk hold, same approver, wrong state, stale version, duplicate, or missing evidence is rejected and sanitized-audited; no payout call. |

## Test Plan

| Layer | Case | Expected evidence |
| --- | --- | --- |
| Static/lint/type | TypeScript, lint, build, `git diff --check` | No errors; no new role/state/result. |
| Migration | Clean apply, preflight, rollback, rerun, active-link uniqueness, OTP lifecycle checks, distinct-Admin exception constraints | Migration `0009_bayar007_confirmation_otp.sql` is additive and repeat-safe; duplicate/preflight failure happens before DDL. |
| Unit | Token hash, OTP format/hash, fixed-clock expiry, send window, cooldown, lock, DTO masking | Raw token/OTP never appears in result or audit payload. |
| Service integration | Link create, Buyer binding, state transitions, hold guards, idempotency | Exactly one active link and one successful confirmation. |
| Admin exception | Overdue eligibility, Buyer completion evidence, two distinct Admin approvals, reason/evidence, hold guard, stale version | Exactly one controlled transition to `READY_FOR_PAYOUT`; no payout/refund operation is called. |
| Concurrency | Two verify requests, duplicate OTP request, stale state version | One success; other request returns same final result or conflict; no duplicate transition. |
| Delivery/notification | PENDING/SENT/FAILED/UNKNOWN | Only valid OTP can confirm; manual/provider-neutral notification failure leaves transaction state unchanged and can be retried under the cooldown rules. |
| Recovery job | Reminder at 1x24, overdue at 2x24, rerun, expired link | Absolute deadlines remain unchanged; silence never becomes payout eligibility. |
| Route/security | Unauthenticated, Seller, wrong Buyer, expired/used token, malformed input | Safe 401/403/400/404 response without sensitive disclosure. |
| UI/manual | UI-SCR-013..016/020 states, labels, focus, mobile-width desktop surface | All approved loading/error/expired/locked/overdue/recovery states visible and accessible. |

## Risks And Safeguards

| Risk | Safeguard | Recovery/rollback |
| --- | --- | --- |
| Token replay or cross-transaction use | Hash-only token, Buyer account + participant FK, state/expiry/used checks, one active link | Reject request; audit sanitized denial; no state mutation. |
| OTP race creates duplicate confirmation | Lock OTP and transaction rows; conditional state-version update; idempotency result | Return final result or conflict; never retry a successful financial transition. |
| OTP destination changes | Compare stored snapshot with participant snapshot; no client destination input or channel switch | Keep confirmation unavailable; Admin manual recovery status only. |
| Reminder/overdue job resets deadline or releases payout | Store absolute timestamps; conditional updates; system actor scope; no payout module dependency | Rerun safely; manual Admin review. |
| Delivery UNKNOWN is treated as success | Persist bounded delivery result; require valid OTP for confirmation | Retry/reconcile delivery without state change. |
| Complaint/risk hold bypass | Guard confirmation and exception eligibility against blocking state/hold | Keep state held; handoff to Admin operation outside this ticket. |
| Admin exception approval bypass | `isAdmin` check, distinct approver IDs, Buyer completion evidence, append-only audit, state-version guard | Reject incomplete/duplicate/self approvals; no financial operation is started. |
| Raw secrets leak through UI/audit | Sanitized DTOs, generic errors, no raw token/OTP logging, masked snapshot | Rotate/invalidates active link/challenge if exposure is suspected. |

## Traceability Matrix

| Contract | Implementation plan | Source IDs | Verification |
| --- | --- | --- | --- |
| Buyer-bound link, single use, and 2x24-hour expiry | Steps 1-3 | UR-BUYER-006, UR-BR-014, UX-FLOW-022..023, UI-SCR-013, QA-CONF-001 | Migration, link service, route, replay, expiry, and state-version tests |
| WhatsApp OTP lifecycle and Buyer confirmation | Step 4 | UR-BUYER-006..008, UR-BR-004, UR-BR-015, UR-BR-036, UX-FLOW-023..025, UI-SCR-014, QA-CONF-002..004 | Fixed-clock, hash/privacy, cooldown, attempt, delivery, duplicate, and concurrency tests |
| Reminder and overdue recovery | Step 6 | UR-SYSTEM-002..003, UX-FLOW-027..030, UI-SCR-016/020, QA-SLA-002 | Fixed-clock sweep, rerun, conditional-update, and notification-failure tests |
| Admin status, evidence, and controlled exception eligibility | Steps 5-7 | UR-ADMIN-008..011, UX-FLOW-028..030, UI-SCR-015, QA-SEC-001..002 | Admin ACL, two-distinct-Admin approval, evidence/hold, audit, and no-payout tests |
| Privacy, masking, idempotency, and state-version safety | Steps 1-8 | UR-BR-020, QA-SEC-001..002, QA-CONF-005 | DTO leakage, unauthorized, duplicate, stale-version, rollback, and append-only audit tests |

## Plan Completion Check

- [x] Every BAYAR-007 acceptance criterion maps to a change and verification.
- [x] Link creation, Buyer binding, expiry, single use, and replay recovery
  are concrete.
- [x] OTP TTL, attempts, cooldown, send window, lock, hash, single use,
  delivery results, and recovery are concrete.
- [x] Approved state transitions are explicit; no new state/result is planned.
- [x] Reminder and overdue jobs use absolute deadlines and cannot authorize
  payout automatically.
- [x] Routes, `requireAdminAccount`, two-Admin exception approval,
  idempotency, audit, and sensitive-data rules are concrete.
- [x] UI-SCR-013..016/020 and controlled-exception states are covered.
- [x] Payout, refund, cancellation, complaint adjudication, risk decisioning,
  Seller OTP, email fallback, and WhatsApp API are excluded.
- [x] Dependencies and migration order are stated; no unresolved decision is
  left to coding.
- [x] Active-link, OTP lifecycle, used-at immutability, Buyer binding,
  exception approval, migration preflight, and recovery behavior are explicit.

Status: Draft
