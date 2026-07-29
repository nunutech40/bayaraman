# Implementation Plan

## Task

```text
Ticket ID/title: BAYAR-006 — WhatsApp Group Operations and Completion Checkpoints
Outcome: Let an authorized Admin record the external WhatsApp group, the
authoritative Midtrans payment announcement, and separate Seller/Buyer
completion checkpoints without trusting or parsing WhatsApp messages.
Source research: docs/execution/BAYAR-006/01-research.md
Source requirements and QA scenarios: UR-ADMIN-003, UR-ADMIN-004,
UR-ADMIN-005, UR-PARTY-001, UR-PARTY-002, UR-PARTY-003, UR-BR-012,
UR-BR-013, UR-BR-023, UR-BR-025, UR-BR-044; QA-WA-001..004, QA-SEC-003
Source UX Flow and UI IDs/states: UX-FLOW-017..023, UI-SCR-012, UI-SCR-013
Source technical design: PRD.md v0.2 Approved; TRD.md v1.2 Approved,
Sections 5, 6, 10, 11, 12, 13, 14
```

Version: 0.1
Status: Draft
Depends on: BAYAR-005 implementation and validation
Blocks: BAYAR-007, BAYAR-009

## Scope

### In Scope

- Admin-only API and service for recording one canonical external WhatsApp
  group after `PAYMENT_CONFIRMED`.
- Participant WhatsApp snapshot validation against persisted Buyer/Seller
  transaction participants.
- Admin recording of payment announcement evidence.
- Separate Seller and Buyer completion checkpoints.
- Idempotent state transitions through
  `READY_FOR_FULFILLMENT`, `WAITING_COMPLETION_REPORTS`,
  `WAITING_OTHER_COMPLETION_REPORT`, and
  `READY_FOR_BUYER_CONFIRMATION`.
- Immutable/sanitized checkpoint evidence, append-only correction records,
  masking, audit, retry, and notification failure handling.
- Participant-safe status summaries and an Admin mobile-width operations UI.

### Out Of Scope

- Midtrans invoice creation, webhook authority, payment reconciliation,
  expiry, or payment status changes; `PAYMENT_CONFIRMED` is consumed only as a
  prerequisite from BAYAR-005.
- WhatsApp API integration, message parsing, automatic message trust,
  automatic group creation, or delivery-content verification.
- Buyer confirmation link generation, Buyer OTP, confirmation timeout, or
  payout; BAYAR-007 and BAYAR-008 own those boundaries.
- Refund, split settlement, cancellation, complaint adjudication, risk hold,
  fulfillment tracking, delivery-proof upload, or new product roles/states.
- Seven-checkpoint or legacy WhatsApp checkpoint behavior.

## Approved Implementation Decisions

1. **Canonical payment boundary:** Group creation and payment announcement
   require the transaction state `PAYMENT_CONFIRMED`. No participant or Admin
   action in BAYAR-006 can make a non-authoritative Midtrans event paid.
2. **External WhatsApp boundary:** WhatsApp remains a manual external channel.
   Store references, timestamps, authors, and immutable snapshot hashes only;
   never store raw message text, media, access tokens, or provider secrets.
3. **Checkpoint vocabulary:** Use exactly `PAYMENT_ANNOUNCED`,
   `SELLER_SHIPMENT`, `SELLER_COMPLETION`, and `BUYER_COMPLETION` for
   checkpoint records. `SELLER_SHIPMENT` is an explicit Admin record of the
   seller's external shipment statement; it is not delivery tracking or proof
   of delivery. Group creation is represented by the `whatsapp_groups` row
   plus a `GROUP_CREATED` audit event, not a legacy seven-checkpoint model.
4. **Append-only correction model:** `whatsapp_checkpoints` is an immutable
   event log. `whatsapp_checkpoint_heads` is a mutable projection with one
   current pointer per `(transaction_id, checkpoint_type)`. A correction
   inserts a new event linked to the prior event and atomically moves the head;
   it never updates or deletes the original evidence. One active canonical
   group is allowed per transaction and duplicate group requests return the
   original result.
5. **Checkpoint progression:** Use the exact transition matrix in the State
   And Data Impact section. Every mutation locks the transaction row and checks
   source state, canonical prerequisites, role ownership, and state version.
   Seller shipment is still external and is never inferred from WhatsApp
   content.
6. **Confirmation handoff:** BAYAR-006 makes the transaction eligible for the
   next Buyer confirmation-link ticket. It does not create a link, send OTP, or
   move money.
7. **Authorization:** Only server-resolved Admin accounts can mutate group or
   checkpoint records. Internal Ops/Finance/Supervisor/Reviewer assignment is
   metadata under Admin, not a product role. Participants receive summaries
   only.

## Planned Changes

| Step | Change | File/module | Requirement/UX/UI/AC covered | Verification |
| --- | --- | --- | --- | --- |
| 1 | Add immutable checkpoint event fields, `whatsapp_checkpoint_heads` current-pointer projection, delivery result metadata, checkpoint constraints, one-group uniqueness, and insert-only triggers without storing raw WhatsApp content. | `src/server/db/schema.ts`, `drizzle/0008_bayar006_whatsapp_checkpoints.sql` | UR-ADMIN-003/004, UR-PARTY-001/002, UR-BR-012/013/023/025; TRD 10/12/13; QA-WA-001/002/003, QA-SEC-003 | Clean migration, preflight/re-run test, invalid-type rejection, one-group/head uniqueness, append-only correction, concurrent-head, and trigger tests. |
| 2 | Create service contracts for group creation, payment announcement, Seller shipment statement, and Seller/Buyer completion. Lock transaction rows, validate the exact transition matrix, participant snapshots, checkpoint ownership, evidence references, and expected state version. | `src/server/operations/whatsapp.ts`, `src/server/operations/contracts.ts` | UR-ADMIN-003/004/005, UR-PARTY-001/002/003; UX-FLOW-017..022; ticket AC 1/2 | Unit tests cover every source/target state, wrong group, wrong role, missing evidence, duplicate, stale version, and unauthorized path. |
| 3 | Implement Admin routes for reading operations and mutating the canonical group/checkpoints, plus a read-only participant summary projection. | `src/app/api/admin/transactions/[id]/whatsapp/route.ts`, `src/app/api/admin/transactions/[id]/whatsapp/checkpoints/route.ts`, `src/app/api/transactions/[id]/whatsapp/route.ts` | UI-SCR-009, UI-SCR-012, UI-SCR-013; QA-WA-001..004, QA-SEC-003 | Route tests verify Admin-only mutation/raw projection, participant masked summary, idempotency, sanitized responses, error mapping, and no link/OTP operation. |
| 4 | Implement atomic state transitions and audit events for group, announcement, seller shipment, first completion, second completion, and corrections. | `src/server/operations/whatsapp.ts`, `src/server/transaction/audit.ts`, `src/server/domain/transaction/state.ts` | UX-FLOW-017..022; UR-ADMIN-003/004/005, UR-PARTY-001/002; QA-WA-003/004 | PostgreSQL tests prove the matrix, one head per type, original evidence preservation, no advancement after conflict/missing prerequisite, and notification failure safety. |
| 5 | Add separate Admin and participant-safe projections and Admin mobile-width operations screen. UI-SCR-013 is read-only eligibility handoff only. | `src/server/transaction/projection.ts`, `src/app/admin/operations/page.tsx`, `src/components/admin/whatsapp-operations.tsx`, `src/app/globals.css` | UI-SCR-009, UI-SCR-012, UI-SCR-013; UX-FLOW-017..023; QA-SEC-003 and mobile states | Manual responsive/accessibility check covers loading, empty, error, disabled, unauthorized, retry, manual-review, masking, and no-link/no-OTP states. |
| 6 | Add focused unit/integration tests and execution validation report. | `tests/unit/whatsapp-operations.test.ts`, `tests/integration/whatsapp-operations.test.ts`, `docs/execution/BAYAR-006/04-validation.md` | QA-WA-001..004, QA-SEC-003; all ticket acceptance criteria | `npm test`, typecheck, lint, build, migration check, PostgreSQL healthcheck, and diff check; changed-file review confirms no BAYAR-007+ behavior. |

### Concrete API Contract

- `GET /api/admin/transactions/[id]/whatsapp`: Admin-only masked operation
  summary. Admin fields: checkpoint event IDs, sanitized evidence/message
  references, snapshot hashes, correction chain, operator, timestamps, and
  delivery result. Raw message/media content is never returned.
- `POST /api/admin/transactions/[id]/whatsapp`: Create/reuse the canonical
  group record. Body contains:
  `{ groupReference, buyerSnapshotConfirmation, sellerSnapshotConfirmation,
  evidenceReference, recordedAt, expectedStateVersion }`. Each snapshot
  confirmation contains only the expected masked/last-four WhatsApp value;
  the server compares it with frozen `transaction_participants` snapshots.
  It requires `Idempotency-Key`.
- `POST /api/admin/transactions/[id]/whatsapp/checkpoints`: Record one
  `PAYMENT_ANNOUNCED`, `SELLER_SHIPMENT`, `SELLER_COMPLETION`, or
  `BUYER_COMPLETION` checkpoint.
  Body contains `{ checkpointType, sourceAuthorRole, evidenceReference,
  messageReference, snapshotHash, deliveryResult, recordedAt,
  correctedCheckpointId, correctionReason, expectedStateVersion }`. The
  server validates the role/type pairing and exact source-state matrix. A
  correction requires an existing checkpoint, a reason, and a new idempotent
  command.
- `GET /api/transactions/[id]/whatsapp`: Buyer/Seller read-only summary with
  current state, group existence, announcement/shipment/completion status,
  missing role, and deadlines. It returns no evidence reference, raw data,
  correction chain, or operator details.
- No route accepts raw WhatsApp message text, media, provider credentials, or
  client-supplied Admin identity. Buyer/Seller cannot mutate Admin routes.

### Dependency Order

1. Apply and validate additive schema migration.
2. Implement service validation and transition helpers.
3. Add Admin routes and projections.
4. Add Admin UI and participant summary.
5. Run concurrency, authorization, migration, UI-state, and full validation.

## State And Data Impact

```text
State transitions added/changed:
- Matrix A: `PAYMENT_CONFIRMED` + canonical group + no existing
  `PAYMENT_ANNOUNCED` + Admin evidence -> `READY_FOR_FULFILLMENT`.
- Matrix B: `READY_FOR_FULFILLMENT` + canonical group + Admin
  `SELLER_SHIPMENT` evidence -> `WAITING_COMPLETION_REPORTS`.
- Matrix C: `WAITING_COMPLETION_REPORTS` + first valid
  `SELLER_COMPLETION` or `BUYER_COMPLETION` + corresponding participant
  evidence -> `WAITING_OTHER_COMPLETION_REPORT`.
- Matrix D: `WAITING_OTHER_COMPLETION_REPORT` + the opposite role's valid
  completion evidence -> `READY_FOR_BUYER_CONFIRMATION`.
- Every matrix row requires the transaction row lock, expected state version,
  Admin authorization, idempotency key, required canonical group, and
  append-only audit. Duplicate actions return the existing result; stale or
  invalid actions are rejected without state advancement.
- `SELLER_SHIPMENT` is a manual shipment statement only. It is not delivery
  tracking, delivery proof, automatic WhatsApp parsing, or a new state.
- No payment, financial, cancellation, complaint, risk, OTP, or payout state
  is added or mutated by this ticket.

Schema/migration impact:
- Keep existing whatsapp_groups and whatsapp_checkpoints tables and add an
  additive migration with named constraints/indexes plus
  `whatsapp_checkpoint_heads`.
- Restrict checkpoint_type to PAYMENT_ANNOUNCED, SELLER_SHIPMENT,
  SELLER_COMPLETION, and BUYER_COMPLETION; group creation remains a group row
  plus audit event.
- `whatsapp_checkpoints` remains append-only and receives an immutable event
  ID, `idempotency_key`, bounded `delivery_result`, optional
  `corrected_checkpoint_id`, and sanitized correction reason. Its existing
  rows cannot be updated or deleted by trigger.
- `whatsapp_checkpoint_heads` contains one row per
  `(transaction_id, checkpoint_type)` and points to the current event. Its
  unique index is the active uniqueness enforcement; changing a head is a
  projection update, never evidence mutation. Insert event plus head update
  is one database transaction.
- Enforce at most one canonical group per transaction. Existing duplicate
  group/checkpoint data is detected in migration preflight and aborts before
  DDL; recovery requires Admin data review, not silent deduplication.
- Foreign keys and indexes must preserve transaction/group ownership and make
  duplicate/concurrent writes deterministic.

Authorization impact:
- requireAdminAccount is required for group/checkpoint writes and raw Admin
  reads. Participant summaries are masked and read-only.
- Participant role and WhatsApp snapshots are resolved server-side from
  transaction_participants. Product roles remain Buyer, Seller, Admin only.

Audit/notification impact:
- Successful group, announcement, checkpoint, correction, retry, and state
  transition mutations write append-only audit events with correlation ID and
  sanitized references.
- Delivery result is manually recorded operational metadata only; no WhatsApp
  provider integration supplies it. `PENDING`, `SENT`, `FAILED`, and `UNKNOWN`
  are allowed. FAILED can be retried with a new idempotent command; UNKNOWN
  requires Admin follow-up and cannot be treated as success. Neither result
  changes trusted transaction state by itself.
- Audit never contains raw message text, media, OTP, secrets, or full sensitive
  participant data.

Manual operation impact:
- Admin creates the group and posts/records the payment announcement manually.
- Seller ships and both parties report completion through external WhatsApp.
- Admin records each role checkpoint separately. BAYAR-007 owns the next
  confirmation link and OTP flow.
```

## Test Plan

| Layer | Case | Expected evidence |
| --- | --- | --- |
| Static/lint/type | Schema, route, service, and UI compile; approved state/result vocabulary only | Typecheck/lint/build pass; no new role/state/result. |
| Migration | Clean apply, duplicate legacy group/checkpoint preflight, head projection, rerun, rollback/recovery | Migration is additive, deterministic, and fails before DDL on unsafe duplicates. |
| Unit | Checkpoint vocabulary, evidence/reference validation, participant snapshot matching, exact state matrix | Invalid type/role/evidence/prerequisite/source state is rejected with no state advancement. |
| Unit | Exact duplicate and reused idempotency key with different request hash | Exact duplicate returns original result; conflicting key is rejected/audited. |
| Integration | Admin vs Buyer/Seller/unauthenticated route access | Only Admin can read raw or mutate; participant summary is masked/read-only. |
| Integration | Correct group, wrong group, missing participant, duplicate group | Correct group persists once; invalid/duplicate requests recover without advancement. |
| Integration | Payment announcement before/after `PAYMENT_CONFIRMED` | Pre-confirmation is rejected; authoritative payment prerequisite is enforced. |
| Integration | Seller shipment plus first and second distinct completion checkpoints | Matrix B/C/D transitions occur exactly once; wrong order or missing role is rejected. |
| Integration | Same-role duplicate, concurrent opposite-role writes, stale state version | One canonical outcome; conflicts are rejected and audited; no over-advancement. |
| Integration | Evidence correction, head projection, and append-only protection | Original evidence remains unchanged; correction links to original; one current head is selected atomically. |
| Integration | Manually recorded FAILED/UNKNOWN delivery result | Retry is possible; trusted transaction state does not change automatically and no provider integration is called. |
| UI/manual | UI-SCR-012 loading/empty/error/disabled/unauthorized/manual-review/success; mobile-width desktop | Admin sees operations states; no payout/OTP/cancellation controls appear. |
| UI/manual | Participant transaction status summary and masking | Buyer/Seller see status/checkpoint summary only; raw evidence is hidden. |

## Risks And Safeguards

| Risk | Safeguard | Recovery/rollback |
| --- | --- | --- |
| Admin records a group before authoritative Midtrans payment | Lock transaction and require exact `PAYMENT_CONFIRMED` state | Reject and audit; no group/transition mutation. |
| Wrong WhatsApp group or participant number is recorded | Compare submitted confirmations with persisted Buyer/Seller snapshots; store only sanitized references | Reject; Admin corrects through append-only correction flow. |
| Duplicate/concurrent checkpoint advances twice | Partial unique indexes, transaction row lock, idempotency, and state-version conditional update | Return existing result or reject conflict; reload canonical state. |
| Raw WhatsApp evidence leaks | Accept references/hash only; masked participant projection; sanitized audit | Reject unsafe payload; preserve original evidence; Admin-only raw reference access. |
| External delivery fails or is ambiguous | Persist bounded `PENDING/SENT/FAILED/UNKNOWN` operational result; never infer trusted state | Retry with same command boundary; escalate after policy limit without changing state. |
| Correction overwrites evidence | Append-only correction row and insert-only trigger | Reconcile using latest valid correction while retaining original. |
| Scope leaks into Buyer confirmation/payout | Keep explicit route/service boundary and tests for absent controls | Defer to BAYAR-007/008; revert only BAYAR-006 files if needed. |
| Legacy seven-checkpoint assumptions reappear | Enforce the four BAYAR-006 checkpoint values and ticket-level traceability | Reject invalid type at DB and service boundary. |
| UI-SCR-013 accidentally implements BAYAR-007 | Make it a read-only eligibility summary and assert no link/OTP creation in route/service tests | Handoff remains available; Buyer confirmation stays deferred. |

## Plan Completion Check

- [x] Every BAYAR-006 acceptance criterion maps to a planned change and verification.
- [x] Midtrans is the only payment authority; BAYAR-006 consumes `PAYMENT_CONFIRMED` and does not recreate payment review.
- [x] Every UX transition `UX-FLOW-017..023` and UI surface `UI-SCR-012/013` maps to a change or explicit handoff.
- [x] Buyer/Seller/Admin authorization boundaries are explicit; internal Admin assignments are not product roles.
- [x] Migration, API, state-version, idempotency, audit, masking, retry, and recovery behavior are ordered.
- [x] Immutable event log and mutable current-pointer projection are separated; corrections cannot overwrite evidence.
- [x] Exact state transition matrix covers group, announcement, shipment, first completion, and second completion.
- [x] Admin/participant DTO boundaries and manual delivery-result ownership are explicit.
- [x] WhatsApp remains manual/external; no parser, API integration, Seller OTP, payout, cancellation, complaint, or risk behavior is included.
- [x] `READY_FOR_BUYER_CONFIRMATION` is an eligibility handoff only; Buyer link/OTP remains BAYAR-007.
- [ ] Owner review and approval of this plan is still pending.

Status: Draft. Stop before coding until this plan is reviewed and approved.
