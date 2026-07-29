# Implementation Plan

## Task

~~~text
Ticket ID/title: BAYAR-005 — Midtrans Payment Webhook and Provider Reconciliation
Outcome: Process validated Midtrans webhook and Get Status API results as the
authoritative payment boundary. Only settlement with fraud_status=accept may
move an eligible transaction to PAYMENT_CONFIRMED.
Source research: docs/execution/BAYAR-005/01-research.md
Source requirements and QA scenarios: UR-ADMIN-001, UR-ADMIN-002,
UR-ADMIN-003, UR-ADMIN-004, UR-ADMIN-005, UR-ADMIN-020, UR-ADMIN-021,
UR-ADMIN-022, UR-ADMIN-023, UR-BR-008, UR-BR-011, UR-BR-031, UR-BR-033,
UR-BR-034, UR-BR-035, UR-BR-044, UR-SYSTEM-005, UR-SYSTEM-006,
UR-PAYMENT-004, UR-PAYMENT-005, UR-PAYMENT-006, UR-PAYMENT-007;
QA-MP-004, QA-MP-005, QA-MP-006, QA-MP-007, QA-MP-008, QA-PAY-003,
QA-PAY-004, QA-PAY-005, QA-PAY-006, QA-PAY-007, QA-PAY-008, QA-PAY-009,
QA-PAY-010, QA-EXP-003, QA-EXP-004, QA-SEC-003
Source UX Flow and UI IDs/states: UX-FLOW-015, UX-FLOW-016, UX-FLOW-047,
UX-FLOW-048, UX-FLOW-049, UX-FLOW-050, UX-DEC-026, UI-SCR-011, UI-SCR-022
Source product/technical decisions: PB-MP-001, PB-MP-002, PB-MP-003,
PB-MP-004, PB-MP-005, PB-MP-006, PB-MP-007, PB-MP-008, PB-MP-009,
PB-MP-OD-001, PB-MP-OD-002, PB-MP-OD-003, PB-MP-OD-004, PB-MP-OD-005,
PRD.md v0.2, TRD.md v1.2 Sections 5, 6, 7, 8, 10, 11,
13, and 14
~~~

Version: 0.1
Status: Draft
Depends on: BAYAR-004 implementation and validation
Blocks: BAYAR-006, BAYAR-010, BAYAR-012

## Scope

### In Scope

- Public Midtrans webhook ingestion at `POST /api/webhooks/midtrans`.
- Server-side signature, order, invoice, transaction, amount, currency,
  fraud-status, event ID, event time, and payload-hash validation.
- Immutable provider event storage with duplicate, delayed, out-of-order,
  and equal-time conflict handling.
- Provider-neutral Get Status API adapter and bounded reconciliation service.
- One guarded authoritative transition to `PAYMENT_CONFIRMED` for a valid
  `settlement + fraud_status=accept` result.
- Admin-only reconciliation and exception review using masked projections.
- State-version, idempotency, correlation, audit, no-revival, and late-fund
  handoff boundaries.
- UI-SCR-011 and UI-SCR-022 provider review/reconciliation states only.

### Out Of Scope

- Invoice/payment-link creation, hosted checkout creation, or expiry ownership;
  these remain BAYAR-004 responsibilities.
- Refund, payout, split settlement, money movement, WhatsApp group, Buyer OTP,
  cancellation, complaint, risk operation, and fulfillment behavior.
- Normal manual bank-check payment flow or any reactivation of legacy payment
  claim/instruction routes.
- Provider integrations other than the Midtrans payment-status boundary.
- Production credential provisioning, merchant settlement, custody, legal or
  compliance launch approval, and real webhook deployment.
- New product roles, transaction states, or financial operation results.

## Approved Implementation Decisions

1. **Webhook contract and identity:** Implement `POST /api/webhooks/midtrans`
   as a public provider callback. It requires no BayarAman session. Use the
   supplied Midtrans event ID as `providerEventId`; when absent, derive
   `MIDTRANS-HASH:<sha256(canonical validated provider fields)>`. The
   canonical fields are order ID, transaction status, status code, gross
   amount, currency, fraud status, event time, and settlement time. The raw
   body is never stored. `payloadHash` remains the hash of the normalized
   payload and detects a same-event-ID/different-payload conflict.
2. **Signature/config boundary:** Validate the Midtrans SHA-512 signature over
   `order_id + status_code + gross_amount + MIDTRANS_SERVER_KEY`. Read the key,
   environment, base URL, and timeout only from server-side configuration.
   Never return, log, or audit the signature material, authorization header,
   server key, or raw request body.
3. **Provider adapter:** Add a provider-neutral status contract with
   `getStatus(providerOrderId)` returning a normalized provider status,
   fraud status, event time, provider event/reference, and a safe outcome.
   The Midtrans implementation calls `GET /v2/{order_id}/status` with bounded
   timeout and server-side Basic authentication. Timeout, outage, malformed
   response, and unknown provider state normalize to `UNKNOWN`; they never
   become payment authority.
4. **Event precedence:** Compare provider event time before received time.
   A valid settlement/accept event is authoritative only once, while the
   transaction is exactly `WAITING_BUYER_PAYMENT`, the invoice is active and
   unexpired, and the state version matches. A prior authoritative settlement
   cannot be downgraded. Older/non-paid events are stored without canonical
   mutation. Equal-time conflicting events are stored and routed to
   `UNKNOWN`/Admin reconciliation; arrival order never resolves the conflict.
5. **Canonical evidence:** Keep provider event rows insert-only. Add a nullable
   UUID `payment_invoices.authoritative_provider_event_id` pointer that may
   change only once from null to the accepted event row ID. A partial unique
   index on the pointer prevents one event from being authoritative for more
   than one invoice, and a database trigger rejects changing or clearing it
   after assignment. The pointer and guarded transaction transition commit
   atomically with the event and audit.
   The service and trigger must verify that the event belongs to the same
   invoice and provider and has `validation_outcome=ACCEPTED`,
   `transaction_status=settlement`, `fraud_status=accept`, and matching
   amount/currency before assigning the pointer.
6. **Validation metadata:** Add `validation_outcome` to provider events. It is
   written with the final sanitized value during the insert transaction;
   provider event rows are never updated or deleted. Do not add
   `reconciliation_id` or `is_authoritative`: the reconciliation join table and
   invoice pointer are the only canonical relation/authority boundaries.
   Validation outcomes are technical evidence, not transaction states or
   financial results.
7. **Admin boundary:** Expose reconciliation through
   `GET/POST /api/admin/transactions/[id]/payment-reconciliation`. Require a
   server-side Admin account and transaction access; client-submitted account
   IDs are ignored. Internal Ops/Finance/Supervisor/Reviewer assignments are
   task metadata under Admin and do not create product roles. Controlled
   financial outcomes are only recorded as an Admin handoff reference. The
   two-Admin approval and execution persistence belongs to the owning future
   refund/payout/split ticket; BAYAR-005 does not create approval records,
   execute financial actions, or claim that a controlled outcome is approved.
8. **Idempotency:** Webhook identity is `(provider, providerEventId)` plus
   payload hash. System reconciliation uses `SYSTEM:midtrans-status-reconciliation`
   and the existing `(actor_scope, command, key)` boundary. Admin mutations use
   `ACCOUNT:<adminId>` and `Idempotency-Key`. A duplicate with the same hash
   returns the saved safe result; a same-ID/different-payload conflict is
   recorded as a sanitized conflict evidence row/reconciliation reference
   without inserting a second provider event or mutating authority.
9. **Conflict evidence:** Store same-identity/different-hash cases as an
   immutable `payment_reconciliation_events` row with
   `relation_type=CONFLICT_EVENT`, the original provider event ID, incoming
   payload hash, sanitized reason, correlation ID, and idempotency key. No
   second provider event or separate conflict table is created.

## Planned Changes

| Step | Change | File/module | Requirement/UX/UI/AC covered | Verification |
| --- | --- | --- | --- | --- |
| 1 | Define normalized webhook/status contracts, Midtrans signature verifier, server-only configuration, and safe error mapping. | `src/server/providers/payment-status.ts`, `src/server/providers/midtrans/status.ts`, `src/server/providers/midtrans/signature.ts`, `src/server/providers/midtrans/config.ts`, `src/server/providers/midtrans/fake.ts` | UR-ADMIN-001, UR-ADMIN-002, UR-ADMIN-023, UR-PAYMENT-004, UR-PAYMENT-006; PB-MP-002, PB-MP-003, PB-MP-005; TRD 7, TRD 8, TRD 10; QA-MP-004, QA-MP-005, QA-MP-007 | Unit tests prove signature, order, amount, currency, fraud, timeout, malformed response, and `UNKNOWN` mapping without leaking secrets. |
| 2 | Add final provider-event metadata, canonical invoice pointer, one immutable reconciliation join table, indexes, and insert-only/authority-once triggers. | `src/server/db/schema.ts`, `drizzle/0007_bayar005_provider_reconciliation.sql` | UR-ADMIN-020, UR-ADMIN-021, UR-PAYMENT-005, UR-PAYMENT-006; PB-MP-004, PB-MP-005; TRD 7.3, TRD 10, TRD 13; QA-MP-006, QA-SEC-003 | Clean migration, preflight abort, duplicate-event identity test, join-row conflict idempotency/concurrency test, one-authority-per-invoice index, immutable event/join tests, pointer validation test, and rollback/recovery test. |
| 3 | Implement public webhook ingestion: parse/validate event, derive identity, resolve invoice from provider order ID, persist sanitized event or conflict evidence, and invoke the canonical mutation service. | `src/app/api/webhooks/midtrans/route.ts`, `src/server/payment/provider-webhook.ts`, `src/server/payment/provider-validation.ts` | UR-ADMIN-001, UR-ADMIN-002, UR-ADMIN-020, UR-ADMIN-021; UX-FLOW-015, UX-FLOW-016, UX-FLOW-047; UI-SCR-011; QA-MP-004, QA-MP-005, QA-MP-006, QA-PAY-003, QA-PAY-004, QA-PAY-005, QA-PAY-006, QA-SEC-003; AC invalid/duplicate/ordering | Integration tests cover no-session delivery, every response-matrix branch, deterministic missing-ID identity, exact duplicate, same-ID payload conflict, and safe provider response. |
| 4 | Implement canonical event precedence and guarded settlement mutation. | `src/server/payment/provider-authority.ts`, `src/server/transaction/service.ts`, `src/server/transaction/audit.ts` | UR-ADMIN-002, UR-ADMIN-020, UR-ADMIN-021, UR-BR-031, UR-BR-033; UX-FLOW-016, UX-FLOW-047; PB-MP-003, PB-MP-004; TRD 5, TRD 6, TRD 7; QA-MP-005, QA-MP-006, QA-PAY-004, QA-PAY-005 | Concurrent settlement test yields one `PAYMENT_CONFIRMED`; pending/capture/non-paid/old/equal-time events cannot downgrade or revive; audit follows successful mutation only. |
| 5 | Implement provider-neutral Get Status API reconciliation and late/ambiguous handling. | `src/server/payment/provider-reconciliation.ts`, `src/server/providers/midtrans/status.ts`, `src/server/domain/idempotency/index.ts` | UR-ADMIN-023, UR-PAYMENT-006, UR-PAYMENT-007, UR-SYSTEM-005, UR-SYSTEM-006; UX-FLOW-047, UX-FLOW-048, UX-FLOW-049, UX-FLOW-050; UI-SCR-022; PB-MP-005, PB-MP-006; QA-MP-007, QA-MP-008, QA-EXP-003, QA-EXP-004, QA-PAY-007, QA-PAY-009, QA-PAY-010 | Fake/provider integration tests cover authoritative lookup, `UNKNOWN`, outage retry, deadline preservation, expired/cancelled no-revival, late-fund exception, and idempotency conflict. |
| 6 | Add Admin reconciliation read/action routes with masked participant projection, correlation ID, state-version guard, idempotent handoff reference, and explicit no-financial-execution boundary. | `src/app/api/admin/transactions/[id]/payment-reconciliation/route.ts`, `src/server/admin/authorization.ts`, `src/server/payment/reconciliation.ts` | UR-ADMIN-003, UR-ADMIN-004, UR-ADMIN-005, UR-ADMIN-020, UR-ADMIN-022, UR-ADMIN-023, UR-BR-044; UX-FLOW-047, UX-FLOW-050; UI-SCR-011, UI-SCR-022; QA-SEC-003; AC Admin-only/masked data | Unit/route tests reject Buyer/Seller/unauthenticated access, accept only Admin, reject stale version/duplicate action, reuse an active reconciliation, preserve masking, and record sanitized rejection audit. Controlled financial actions are asserted absent. |
| 7 | Add concrete Admin provider-event/reconciliation screens and states without payment, refund, payout, WhatsApp, or cancellation controls. | `src/app/admin/payment-review/page.tsx`, `src/components/admin/payment-review.tsx`, `src/components/admin/payment-reconciliation.tsx` | UI-SCR-011, UI-SCR-022; UX-FLOW-015, UX-FLOW-047, UX-FLOW-050; QA-UI-005 | Manual/mobile-width and accessibility checks cover loading, empty, mismatch, duplicate, delayed, UNKNOWN, timeout, unauthorized, manual-review, retry, recovery, and masked participant data. |
| 8 | Add focused unit/integration/concurrency/audit verification and execution report. | `tests/unit/payment-provider.test.ts`, `tests/integration/payment-provider.test.ts`, `tests/integration/payment-reconciliation.test.ts`, `docs/execution/BAYAR-005/04-validation.md` | QA-MP-004, QA-MP-005, QA-MP-006, QA-MP-007, QA-MP-008, QA-PAY-003, QA-PAY-004, QA-PAY-005, QA-PAY-006, QA-PAY-007, QA-PAY-008, QA-PAY-009, QA-PAY-010, QA-EXP-003, QA-EXP-004, QA-SEC-003; all ticket AC | `npm test`, typecheck, lint, build, migration check, PostgreSQL healthcheck, and `git diff --check` pass; report confirms only BAYAR-005 scope. |

### Dependency Order

1. Confirm the existing invoice/event/reconciliation schema and add migration
   `0007` with preflight, triggers, indexes, and rollback instructions.
2. Add provider-neutral contracts, Midtrans signature/status adapter, config,
   and fake adapter.
3. Implement event validation and persistence before canonical mutation.
4. Implement precedence and state-version guarded settlement authority.
5. Implement Get Status reconciliation and late/no-revival handling.
6. Add Admin authorization, API projection/action, and scoped UI states.
7. Run PostgreSQL concurrency, provider, security, and UI-state validation.

No invoice creation, expiry-job rewrite, refund, payout, or other ticket work
may be included in these steps.

## State And Data Impact

~~~text
State transitions added/changed:
- WAITING_BUYER_PAYMENT -> PAYMENT_CONFIRMED only for a validated Midtrans
  settlement with fraud_status=accept, active/unexpired invoice, exact
  transaction/order/amount/currency match, and successful state-version update.
- Existing PAYMENT_CONFIRMED cannot be downgraded by a delayed, duplicate,
  capture, pending, denied, cancelled, failed, or expired provider event.
- Expired, cancelled, or financial-terminal transactions never revive. Late
  success is stored and handed to later exception/refund work.
- No transaction state, product role, or financial result is added.

Schema/migration impact:
- Add `payment_provider_events.validation_outcome` as non-null `text` with
  default `LEGACY_UNASSESSED` for existing rows. New values are limited to
  `ACCEPTED`, `NON_AUTHORITATIVE`, `INVALID_SIGNATURE`, `UNKNOWN_ORDER`,
  `IDENTITY_MISMATCH`, `AMOUNT_MISMATCH`, `CURRENCY_MISMATCH`,
  `FRAUD_MISMATCH`, `CONFLICT`, and `UNKNOWN` by application validation.
- Add nullable UUID `payment_invoices.authoritative_provider_event_id`.
  Add foreign-key validation after both tables exist, plus the named unique
  partial index `payment_invoices_authoritative_event_unique` on the pointer
  where it is not null. Add trigger
  `payment_invoices_authority_pointer_once` allowing only NULL -> one event
  ID after checking same invoice/provider, accepted validation, settlement,
  accepted fraud status, and matching amount/currency; reject UPDATE/DELETE
  after assignment. The service performs the same checks before the trigger.
- Add insert-only trigger `payment_provider_events_insert_only` rejecting all
  UPDATE and DELETE operations. The row contains final sanitized validation
  values at insert time. Do not add `is_authoritative`; the invoice pointer is
  the only canonical authority source.
- Add one table `payment_reconciliation_events` with non-null fields:
  `id` UUID, `reconciliation_id` UUID, `provider_event_id` UUID,
  `relation_type` text, `incoming_payload_hash` text,
  `sanitized_reason` text, `correlation_id` UUID, `idempotency_key` text, and
  `created_at` timestamp. Add foreign keys to
  `payment_reconciliations.id` and `payment_provider_events.id`, both using
  `ON DELETE RESTRICT`, plus insert-only trigger
  `payment_reconciliation_events_insert_only`.
- Add check constraint
  `payment_reconciliation_events_relation_type_check` for exactly
  `PRIMARY_EVENT`, `CONFLICT_EVENT`, `OUT_OF_ORDER_EVENT`, `UNKNOWN_EVENT`,
  and `LATE_EVENT`. Add unique constraint
  `payment_reconciliation_events_identity_unique` on
  `(reconciliation_id, provider_event_id, relation_type,
  incoming_payload_hash)`. The hash is the only conflicting payload evidence
  retained; raw body, signature, secret, headers, and participant data are
  prohibited.
- Add partial unique index
  `payment_reconciliations_one_active_transaction_idx` on `transaction_id`
  where `completed_at IS NULL`. Existing active duplicates are detected in a
  preflight `DO` block before any DDL; migration aborts if found. Repeated
  requests reuse the active row through idempotency rather than inserting a
  second active row.
- Migration preflight runs in a PostgreSQL transaction before DDL and raises an
  exception with table/count diagnostics for duplicate active
  `payment_reconciliations`, missing provider/event/order identity, missing
  invoice references, duplicate non-null authority pointers, inconsistent
  authority/event pairs, and unknown legacy `payment_reconciliations.decision`
  values. It checks only tables that exist before this migration.
- Migration order is: preflight existing tables; add nullable columns/tables;
  backfill `validation_outcome` with `LEGACY_UNASSESSED`; add nullable
  `payment_reconciliations.decision_code`; create
  `payment_reconciliation_events`; add FKs with `ON DELETE RESTRICT`; create
  unique/partial indexes; add validation/relation/decision_code check
  constraints; install insert-only and authority-pointer triggers; then
  finalize new-column defaults. The whole DDL is one PostgreSQL transaction.
  Existing BAYAR-004 invoice fields, legacy `decision` values, and
  compatibility payment tables are not removed or rewritten. The migration
  file is exactly `drizzle/0007_bayar005_provider_reconciliation.sql`.
- Migration tests cover clean apply, preflight abort before DDL, duplicate
  active reconciliation recovery, deterministic missing-event-ID identity,
  join-row duplicate/concurrency attachment, event/join insert-only triggers,
  pointer one-time/cross-invoice/provider validation, invalid direct outcome
  and relation inserts, legacy decision compatibility, and rollback/re-run.
- Existing `payment_reconciliations.decision` remains compatibility-only and
  is never constrained or rewritten. Add nullable
  `payment_reconciliations.decision_code`; new reconciliation rows require one
  of `PROVIDER_STATUS_REVIEW`, `LATE_FUND_HANDOFF`, or
  `CONTROLLED_EXCEPTION_HANDOFF`. These are internal reconciliation decisions,
  not transaction states. Its `result` uses only `PROCESSING`, `SUCCESS`,
  `FAILED`, or `UNKNOWN` when a financial result is represented.
- Add named check constraint
  `payment_provider_events_validation_outcome_check` for exactly
  `LEGACY_UNASSESSED`, `ACCEPTED`, `NON_AUTHORITATIVE`,
  `INVALID_SIGNATURE`, `UNKNOWN_ORDER`, `IDENTITY_MISMATCH`,
  `AMOUNT_MISMATCH`, `CURRENCY_MISMATCH`, `FRAUD_MISMATCH`, `CONFLICT`, and
  `UNKNOWN`. Add named check constraint
  `payment_reconciliations_decision_code_check` for exactly
  `PROVIDER_STATUS_REVIEW`, `LATE_FUND_HANDOFF`, and
  `CONTROLLED_EXCEPTION_HANDOFF`. These are internal reconciliation decisions,
  not transaction states or financial results.

Authorization impact:
- Webhook route has no user session requirement; authenticity is established
  by signature and payload validation.
- Get Status system work uses SYSTEM:midtrans-status-reconciliation. No system
  account or product role is created.
- Admin reconciliation requires server-side `accounts.is_admin`; Buyer and
  Seller cannot read raw provider evidence or invoke Admin actions.
- Participant projections contain only masked participant data and safe
  provider references. Server keys, signatures, raw payloads, and headers are
  never returned or logged.

Audit/notification impact:
- Record correlation-linked audit for accepted settlement, invalid signature,
  order/amount/currency/fraud mismatch, duplicate/conflicting event,
  delayed/out-of-order/equal-time handling, Get Status reconciliation,
  Admin authorization denial, and no-revival late-fund handling.
- Successful event persistence, canonical pointer, transaction mutation, and
  audit commit atomically. Rejected domain mutation rolls back and then writes
  one sanitized rejection audit event in a separate audit transaction.
- No Buyer/Seller payment-confirmation notification, WhatsApp, payout, or
  refund notification is added by BAYAR-005.

Manual operation impact:
- Admin reviews provider events and UNKNOWN/late-fund exceptions through the
  Admin boundary. Internal task assignments remain Admin metadata.
- Any refund, payout, split, complaint, risk, or cancellation outcome is a
  handoff to the owning later ticket; BAYAR-005 does not execute money movement.
~~~

## Webhook Response Matrix

| Condition | Durable action | HTTP response | Provider retry behavior |
| --- | --- | --- | --- |
| Malformed JSON/schema or missing identity fields | No event row; sanitized request metric only | `400` | Provider may retry only if it sends a validly shaped request; malformed input is not treated as authority |
| Invalid signature with a derivable identity | Insert immutable event with `INVALID_SIGNATURE` and audit | `200` | No retry required; evidence is available for Admin review |
| Unknown order ID | Insert immutable event with `UNKNOWN_ORDER` and audit | `200` | No retry required; Get Status/Admin reconciliation handles it |
| Invoice/transaction/order mismatch | Insert immutable event with `IDENTITY_MISMATCH` and audit | `200` | No retry required; no state mutation |
| Amount or currency mismatch | Insert immutable event with mismatch outcome and audit | `200` | No retry required; no state mutation |
| Invalid fraud status or unsupported provider status | Insert immutable `FRAUD_MISMATCH`/`NON_AUTHORITATIVE` event and audit | `200` | No retry required; no authority |
| Valid `settlement + fraud_status=accept` | Insert event, pointer, transaction transition, and audit atomically | `200` | Duplicate delivery returns the stored result |
| Valid non-paid (`capture`, `pending`, `deny`, `cancel`, `failure`, `expire`) | Insert immutable `NON_AUTHORITATIVE` event and audit | `200` | No retry required; never downgrades or revives |
| Exact duplicate: same provider/event identity and payload hash | No second event or mutation; return saved safe result | `200` | Provider retry is idempotent |
| Same identity with different payload hash | Keep original event immutable; insert one `payment_reconciliation_events` row with `CONFLICT_EVENT` plus sanitized audit | `200` | No second authority; repeated same hash reuses the join result |
| Provider outage/internal database failure before durable commit | No partial domain mutation or audit success event | `503` | Provider may retry; retry is safe after commit succeeds |

Responses never include raw payload, signature, server key, auth header,
participant data, or reconciliation internals.

## API And Event Contract

~~~text
POST /api/webhooks/midtrans
- Public provider callback; no BayarAman session or client account ID.
- Validate JSON shape, signature, provider/order/invoice identity, amount,
  currency, fraud status, provider event identity, event time, and payload
  hash. Use the supplied event ID or the deterministic hash identity defined
  in Approved Implementation Decision 1.
- Persist a sanitized immutable event and correlation ID, or insert a
  `payment_reconciliation_events` row with `CONFLICT_EVENT`, the original event
  ID, and incoming payload hash when the unique event identity already exists
  with another payload hash.
- Exact duplicate returns the prior safe ingestion result. Same provider/event
  ID with another payload hash is rejected and routed to reconciliation.
- Valid settlement+accept may atomically transition an eligible transaction
  to PAYMENT_CONFIRMED. All other results are non-authoritative.
- Return only provider-safe acknowledgement/error codes; never return raw
  payload, signature, server key, participant data, or reconciliation detail.

GET /api/admin/transactions/[id]/payment-reconciliation
- Admin-only read projection of provider event summaries, validation outcome,
  event ordering, reconciliation status, deadline, and safe references.
- Raw provider payload, signature material, and sensitive participant data are
  excluded or masked.

POST /api/admin/transactions/[id]/payment-reconciliation
- Admin-only action for status lookup/reconciliation or controlled exception
  handoff. Requires Idempotency-Key, request hash, correlation ID, expected
  state version, and the existing `ACCOUNT:<adminId>` actor scope. It cannot
  perform refund, payout, split, or other money move. A controlled exception
  stores only a handoff reference; two-Admin approval/execution belongs to the
  later financial ticket.
- Duplicate returns the stored safe result. Stale state/version is rejected
  and sanitized audit is written; it does not retry a conflicting mutation.

getStatus(providerOrderId)
- Provider-neutral adapter operation with bounded timeout and no deadline
  mutation. Midtrans calls `GET /v2/{order_id}/status` with server-only Basic
  authentication and maps authoritative, non-paid, provider-error, malformed,
  and UNKNOWN outcomes to safe internal data.

ingestMidtransEvent(event, correlationId)
- Uses SYSTEM:midtrans-webhook idempotency scope and provider/event identity.
- Compares event time to canonical event time; never uses arrival order as
  authority. Equal-time conflict creates/updates reconciliation evidence but
  does not mark payment confirmed.
- Event insert, invoice pointer assignment, transaction state mutation, and
  successful audit commit together. A rejected mutation rolls back and writes
  one sanitized rejection audit transaction separately.
~~~

## Traceability Matrix

| Source ID | Plan step | Verification |
| --- | --- | --- |
| UR-ADMIN-001 | 1, 3 | Signature/order/amount/currency/fraud validation tests |
| UR-ADMIN-002 | 1, 4 | Settlement authority and no-downgrade tests |
| UR-ADMIN-003 | 6 | Admin reconciliation authorization tests |
| UR-ADMIN-004 | 6 | Masked provider-event projection tests |
| UR-ADMIN-005 | 6 | Admin exception handoff and audit tests |
| UR-ADMIN-020 | 2, 3, 4, 6 | Idempotency, state-version, concurrency, and authorization tests |
| UR-ADMIN-021 | 2, 4 | Atomic authority/evidence/audit tests |
| UR-ADMIN-022 | 6 | Reconciliation decision and controlled-handoff tests |
| UR-ADMIN-023 | 1, 5, 6 | Get Status, UNKNOWN, outage, and Admin recovery tests |
| UR-BR-008 | 3, 4 | Frozen invoice/order amount matching test |
| UR-BR-011 | 3, 4 | Valid settlement authority test |
| UR-BR-031 | 4 | PAYMENT_CONFIRMED guarded transition test |
| UR-BR-033 | 4, 5 | Non-paid and late-fund no-revival tests |
| UR-BR-034 | 5 | Expiry/deadline preservation test |
| UR-BR-035 | 5 | Late payment exception test |
| UR-BR-044 | 6 | Admin-only masked reconciliation test |
| UR-PAYMENT-004 | 1, 3 | Webhook validation tests |
| UR-PAYMENT-005 | 2, 3, 4 | Provider event ordering/idempotency tests |
| UR-PAYMENT-006 | 1, 5 | Get Status and UNKNOWN tests |
| UR-PAYMENT-007 | 5 | No deadline reset/no revival tests |
| UR-SYSTEM-005 | 5 | Expiry race test |
| UR-SYSTEM-006 | 5 | Late provider result test |
| UX-FLOW-015 | 3 | Invalid webhook/provider event review test |
| UX-FLOW-016 | 4 | Authoritative settlement flow test |
| UX-FLOW-047 | 3, 5, 6 | Provider reconciliation flow test |
| UX-FLOW-048 | 5 | Expiry boundary test |
| UX-FLOW-049 | 5 | Late-fund non-revival test |
| UX-FLOW-050 | 5, 6 | UNKNOWN/Admin recovery test |
| UJ-PAYMENT-RECOVERY-001 | 3, 5 | Signature/provider recovery test |
| UJ-PAYMENT-RECOVERY-002 | 3 | Amount/order mismatch test |
| UJ-PAYMENT-RECOVERY-003 | 3, 4 | Duplicate/out-of-order test |
| UJ-PAYMENT-RECOVERY-004 | 5 | Get Status outage/UNKNOWN test |
| UJ-PAYMENT-RECOVERY-005 | 5 | Late payment exception test |
| UJ-PAYMENT-RECOVERY-006 | 5, 6 | Admin reconciliation handoff test |
| UJ-PAYMENT-RECOVERY-007 | 4, 5 | Expired/cancelled no-revival test |
| UX-DEC-026 | 4 | Equal-time conflict test |
| UI-SCR-011 | 3, 6, 7 | Provider event review screen/state tests |
| UI-SCR-022 | 5, 6, 7 | UNKNOWN/late-fund reconciliation screen/state tests |
| QA-MP-004 | 1, 3 | Signature validation executable scenario |
| QA-MP-005 | 1, 4 | Settlement/fraud authority executable scenario |
| QA-MP-006 | 2, 3, 4 | Duplicate/delayed/out-of-order executable scenario |
| QA-MP-007 | 1, 5 | Get Status/outage executable scenario |
| QA-MP-008 | 5 | Late-fund/no-revival executable scenario |
| QA-PAY-003 | 3 | Webhook identity and validation executable scenario |
| QA-PAY-004 | 4 | Settlement authority executable scenario |
| QA-PAY-005 | 4 | Event precedence executable scenario |
| QA-PAY-006 | 3 | Mismatch/rejected event executable scenario |
| QA-PAY-007 | 5 | UNKNOWN/reconciliation executable scenario |
| QA-PAY-008 | 3, 4 | Duplicate/conflict executable scenario |
| QA-PAY-009 | 5 | Expired/late payment executable scenario |
| QA-PAY-010 | 5 | No-revival executable scenario |
| QA-EXP-003 | 5 | Expiry/Get Status race executable scenario |
| QA-EXP-004 | 5 | Late-fund executable scenario |
| QA-SEC-003 | 1, 3, 6 | Signature, authorization, masking, and sanitization executable scenario |
| QA-UI-005 | 7 | Admin loading/error/UNKNOWN/recovery UI scenario |
| PB-MP-001 | 1, 3 | Payment provider event boundary test |
| PB-MP-002 | 1, 3 | Signature and provider validation test |
| PB-MP-003 | 4 | Settlement authority test |
| PB-MP-004 | 2, 4 | Duplicate/order precedence test |
| PB-MP-005 | 5 | Get Status/UNKNOWN test |
| PB-MP-006 | 5 | Expiry/late-fund test |
| PB-MP-007 | 3, 5 | Provider exception recovery test |
| PB-MP-008 | 6 | Admin reconciliation handoff test |
| PB-MP-009 | 1, 5 | Production launch boundary test |
| PB-MP-OD-001 | 1 | Provider contract validation |
| PB-MP-OD-002 | 1, 3 | Webhook identity/signature test |
| PB-MP-OD-003 | 2, 4 | Event precedence test |
| PB-MP-OD-004 | 5 | UNKNOWN/Get Status test |
| PB-MP-OD-005 | 5 | Deadline/no-revival test |
| PRD §9 Functional Requirements | 1, 3, 4, 5, 6 | Midtrans authority, reconciliation, and no-revival acceptance tests |
| PRD §15 Release Acceptance | 1, 5, 6 | Launch-gate and operational acceptance evidence |
| TRD-5 | 4 | State machine transition test |
| TRD-6 | 4, 5 | Concurrency and deadline test |
| TRD-7 | 1, 2, 3, 4 | Provider event and authority test |
| TRD-8 | 5 | Reconciliation/no-revival test |
| TRD-10 | 1, 2, 3, 6 | Idempotency/audit/authorization test |
| TRD-11 | 6, 7 | Admin projection and UI test |
| TRD-13 | 2, 4 | Immutable evidence test |
| TRD-14 | 6 | Sensitive-data boundary test |

PRD v0.2 uses section anchors rather than stable `PRD-*` IDs, so this plan
references `PRD §9` and `PRD §15` directly and does not invent PRD IDs.

## Test Plan

| Layer | Case | Expected evidence |
| --- | --- | --- |
| Static/type/lint | Typecheck, lint, build, diff check | No type, lint, build, or whitespace errors; no invalid state/role/result literals |
| Migration | Clean migration, preflight failure, duplicate-event, join relation, one-authority, trigger, rollback/recovery | Migration is additive; event/join insert-only and authority pointer rules are database-enforced |
| Unit | Signature and normalized provider status | Valid signature accepted; invalid/missing signature, malformed response, timeout, outage, and UNKNOWN never become authority |
| Unit | Validation and precedence | Order/transaction/amount/currency/fraud mismatch rejected; older/non-paid cannot downgrade settlement; equal-time conflict reconciles |
| Integration | Webhook ingestion | No-session valid callback persists one event; duplicate same hash is idempotent; same ID/different hash persists one immutable conflict join row and is audited |
| Integration | Settlement authority | Only settlement+accept moves eligible transaction to PAYMENT_CONFIRMED; one concurrent winner; audit/evidence commit atomically |
| Integration | Status reconciliation | Get Status resolves UNKNOWN when authoritative, preserves deadline, retries bounded failures, and never revives expired/cancelled transaction |
| Integration | Admin authorization | Buyer/Seller/unauthenticated denied; Admin can see masked projection; stale state, duplicate action, and unauthorized action are audited |
| Security | Sanitization | Server key, signature, raw body, auth header, participant sensitive data, and raw provider evidence are absent from response/log/audit |
| UI/manual | UI-SCR-011/UI-SCR-022 states | Loading, empty, mismatch, duplicate, delayed, timeout, UNKNOWN, unauthorized, manual-review, retry/recovery, and mobile-width states are usable |

## Risks And Safeguards

| Risk | Safeguard | Recovery/rollback |
| --- | --- | --- |
| Provider event arrives out of order and downgrades authority | Compare event time, preserve canonical pointer, and guard transaction state/version | Store event as non-authoritative evidence and reconcile with Get Status; no state rollback |
| Equal-time events disagree | Treat conflict as UNKNOWN/reconciliation, never resolve by arrival time | Admin resolves through approved reconciliation boundary; later financial owner handles outcome |
| Webhook duplicate or provider retry creates duplicate mutation | Unique provider/event key, payload hash, idempotency result, and state-version conditional update | Return prior safe result; conflicting hash is rejected and audited |
| Midtrans status API is unavailable or malformed | Bounded timeout, normalized UNKNOWN, retry policy, and no deadline mutation | Keep transaction unchanged and create Admin reconciliation follow-up |
| Late settlement arrives after expiry/cancellation | Require active/unexpired eligible state before authority transition | Persist late event only; hand off to refund/reconciliation owner without revival |
| Raw webhook or participant data leaks | Zod normalization, sanitized audit/event fields, masked Admin projections, server-only config | Reject payload, audit sanitized reason, rotate credentials if operational review finds exposure |
| Schema migration conflicts with existing event data | Preflight duplicate/null checks, additive migration, named indexes/triggers, PostgreSQL backup/recovery procedure | Stop before DDL mutation on preflight failure; restore/re-run unchanged migration |
| BAYAR-005 performs money movement accidentally | Route/service contract explicitly excludes refund/payout/split and tests assert no such calls | Revert only BAYAR-005 changes; leave invoice and later financial owners untouched |

## Plan Completion Check

- [x] Every ticket acceptance criterion maps to a planned change and
  verification: validation rejection, duplicate/order handling, authority,
  no-revival, and Admin authorization/masking.
- [x] Every referenced approved UX transition and UI state maps to a planned
  route/service/UI test: UX-FLOW-015, UX-FLOW-016, UX-FLOW-047, UX-FLOW-048,
  UX-FLOW-049, UX-FLOW-050, UI-SCR-011, and UI-SCR-022.
- [x] Webhook route, Get Status adapter, Admin route, idempotency scopes,
  event precedence, migration fields/indexes/triggers, and failure responses
  are concrete; no implementation decision is left ambiguous.
- [x] Dependencies and migration order are explicit and additive.
- [x] State-version, concurrency, append-only audit, immutable evidence,
  masking, timeout, retry, recovery, and no-revival behavior are covered.
- [x] Same-event-ID/different-payload conflict evidence uses the single
  immutable reconciliation-event join table with restricted foreign keys,
  unique identity hash, retention boundary, idempotency behavior, and tests.
- [x] Migration preflight, backfill, DDL transaction boundary, check
  constraints, trigger order, and recovery/re-run behavior are concrete.
- [x] Scope excludes BAYAR-004 invoice creation and BAYAR-006, BAYAR-010,
  and BAYAR-012 refund, payout, split, WhatsApp, OTP, cancellation,
  complaint, and risk behavior.
- [x] Product role remains Buyer, Seller, Admin; internal assignments do not
  become product roles.
- [ ] Implementation, migration, and validation are intentionally pending
  approval of this Draft plan.

Status: Draft — ready for Plan Review.
