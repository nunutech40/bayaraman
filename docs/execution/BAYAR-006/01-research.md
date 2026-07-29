# Codebase Research

## Task

```text
Ticket ID/title: BAYAR-006 — WhatsApp Group Operations and Completion Checkpoints
Requested outcome: After authoritative Midtrans payment, let an authorized Admin
record the external WhatsApp group, payment announcement, and two separate
Seller/Buyer completion checkpoints, then unlock the next confirmation-link handoff.
Source requirements: UR-ADMIN-003, UR-ADMIN-004, UR-ADMIN-005, UR-PARTY-001,
UR-PARTY-002, UR-PARTY-003, UR-BR-012, UR-BR-013, UR-BR-023, UR-BR-025,
UR-BR-044
Source UX Flow/UI/QA IDs: UX-FLOW-017..023, UI-SCR-012, UI-SCR-013,
QA-WA-001..004, QA-SEC-003
```

## Relevant Context Read

| File/doc | Why it is relevant | Key constraint found |
| --- | --- | --- |
| `AGENTS.md` | Repository and execution rules | Work one ticket at a time; preserve approved IDs and use the affected code/test surface only. |
| `docs/engineering/tickets/BAYAR-006-whatsapp-checkpoints-completion.md` | Ticket boundary and acceptance criteria | WhatsApp is external/manual; Admin records trusted checkpoints; no automatic parsing, Seller OTP, payout, complaint adjudication, or seven-checkpoint model. |
| `docs/execution/BAYAR-005/04-validation.md` | Dependency evidence | Midtrans webhook/reconciliation is implemented; BAYAR-006 may depend on `PAYMENT_CONFIRMED`, but must not change payment authority. |
| `PRD.md` v0.2 | Product boundary | WhatsApp work is manual Admin operation; participant status is based on recorded facts; payout remains a later, separate operation. |
| `TRD.md` v1.2, Sections 5, 6, 10, 11, 12, 13, 14 | State, schema, API, authorization, failure, and testing constraints | Product roles remain Buyer/Seller/Admin; raw WhatsApp evidence is Admin-restricted; state-version, idempotency, audit, retry, and notification failure rules apply. |
| `docs/product/03-user-requirements.md` v0.4 | Functional requirements | Group creation and payment announcement require Admin; Seller and Buyer completion reports are separate; second valid checkpoint enables confirmation-link handoff. |
| `docs/product/02-ux-flow.md` v0.3 | Sequence and handoff source | `UX-FLOW-017` group, `018` announcement, `019` shipment, `020` first checkpoint, `021` second checkpoint, `022` confirmation-link eligibility, `023` OTP handoff. |
| `docs/product/04-ui-ux-spec.md` v0.2 | Screen/state contract | `UI-SCR-012` is the Admin operations surface; `UI-SCR-013` is the Buyer confirmation link and is only a handoff boundary for this ticket. |
| `docs/product/05-qa-scenarios.md` v0.2 | Executable QA source | `QA-WA-001..004` cover correct/wrong group, separate checkpoints, delivery failure/retry, and Admin authorization/privacy. |
| `src/server/db/schema.ts` | Existing persistence | `whatsapp_groups` and `whatsapp_checkpoints` tables already exist, but have no checkpoint-type constraint, idempotency reference, delivery result, or dedicated relations. |
| `src/server/payment/provider-webhook.ts`, `src/server/payment/reconciliation.ts` | Payment dependency | Authoritative Midtrans settlement transitions the transaction to `PAYMENT_CONFIRMED`; later work must consume that state and not reimplement it. |
| `src/server/transaction/audit.ts`, `src/server/transaction/mutation.ts` | Existing mutation/audit patterns | Mutations use idempotency keys and append-only audit; rejection audit is sanitized and written outside the rolled-back business transaction. |
| `src/components/transactions/status.tsx`, `src/app/globals.css` | Existing participant UI and responsive pattern | Existing mobile-width web shell and status view can show recorded status; no Admin WhatsApp operations UI or API currently exists. |

## Current Behavior

- Entry point: the transaction reaches `PAYMENT_CONFIRMED` through the
  implemented Midtrans webhook or Get Status reconciliation boundary.
- The database already has `whatsapp_groups` with transaction ID, external
  group reference, Admin creator, and timestamp.
- The database already has `whatsapp_checkpoints` with group ID, checkpoint
  type, optional author/message/evidence references, snapshot hash, recorder,
  and timestamp.
- No service or route creates a WhatsApp group record, records a payment
  announcement, or records Seller/Buyer completion checkpoints.
- No code advances a confirmed transaction through
  `READY_FOR_FULFILLMENT`, `WAITING_COMPLETION_REPORTS`,
  `WAITING_OTHER_COMPLETION_REPORT`, or
  `READY_FOR_BUYER_CONFIRMATION`.
- No current route validates that the actor is an Admin, that payment is
  authoritative, that the group participants match the transaction snapshots,
  or that checkpoint roles are distinct.
- No current API exposes raw WhatsApp evidence to Admin or masked summaries to
  participants.
- No automatic WhatsApp API, message parser, delivery trust, or external
  group integration exists. This is consistent with the ticket and must stay
  out of scope.
- The existing participant transaction screen shows the canonical transaction
  state and Midtrans payment status, but has no Admin operation controls.

## Code Map

| Responsibility | Existing file/module | Symbol/route | Notes |
| --- | --- | --- | --- |
| Transaction state enum | `src/server/db/schema.ts` | `transactionState` | Required BAYAR-006 states already exist in the enum. |
| State assertion | `src/server/domain/transaction/state.ts` | `assertKnownTransactionState`, `assertExpectedStateVersion` | Reuse for guarded checkpoint transitions. |
| Transaction persistence | `src/server/db/schema.ts` | `transactions`, `transactionParticipants` | Participants contain immutable name and WhatsApp snapshots. |
| WhatsApp group persistence | `src/server/db/schema.ts` | `whatsappGroups` | Existing table; no unique transaction/group policy is enforced yet. |
| WhatsApp checkpoint persistence | `src/server/db/schema.ts` | `whatsappCheckpoints` | Existing table; needs explicit checkpoint vocabulary/uniqueness and mutation contract. |
| Admin authorization | `src/server/auth/authorization.ts` | `requireAdminAccount` | Server-side `accounts.isAdmin`; internal task assignment is not a product role. |
| Idempotency | `src/server/transaction/mutation.ts`, `src/server/domain/idempotency/index.ts` | `requireIdempotencyKey`, `findIdempotentResult`, `saveIdempotentResult` | Reuse account-scoped Admin command keys; no system account. |
| Audit | `src/server/transaction/audit.ts` | `recordTransactionEvent`, `recordRejectedMutationEvent` | Checkpoint creation, rejection, retry, and correction need sanitized audit events. |
| Payment prerequisite | `src/server/payment/provider-webhook.ts`, `src/server/payment/reconciliation.ts` | Midtrans authority paths | BAYAR-006 consumes `PAYMENT_CONFIRMED`; it does not modify webhook authority. |
| Participant status UI | `src/components/transactions/status.tsx` | `TransactionStatus` | Existing mobile-width shell; currently participant-facing only. |
| Admin review UI pattern | `src/components/admin/payment-review.tsx` | `PaymentReview` | Reuse Admin mobile-width surface and loading/error/empty conventions. |
| Admin API pattern | `src/app/api/admin/transactions/[id]/payment-reconciliation/route.ts` | `GET`/`POST` | Reuse Admin guard and route error mapping, with a dedicated WhatsApp operations route. |
| Test pattern | `tests/integration/foundation.test.ts`, `tests/integration/payment-reconciliation.test.ts`, `tests/unit/foundation.test.ts` | Vitest + PostgreSQL | Integration tests are gated by `TEST_DATABASE_URL`; use rollback/isolation for state and trigger checks. |

## Existing Patterns To Reuse

- **Validation:** Use Zod request schemas at route boundaries. Validate
  transaction ID, expected state version, checkpoint type, participant role,
  references, and bounded timestamp/input lengths.
- **Data access:** Use Drizzle transactions and row locks for the transaction
  before creating a group or advancing a checkpoint. Conditional updates must
  include transaction ID, expected state, and state version.
- **Authorization:** Call `requireAdminAccount` server-side. Resolve
  participant snapshots from the database; never trust client-supplied names,
  phone numbers, role, or Admin task assignment.
- **Idempotency:** Require `Idempotency-Key` on every mutation. Return the
  original result for an exact duplicate and reject a reused key with a
  different request hash.
- **Audit:** Record successful mutation and trusted evidence atomically. Record
  sanitized rejected mutation evidence through the existing rejection path.
- **UI:** Reuse `.app-shell`, `.surface`, existing Admin status patterns, and
  explicit loading/empty/error/disabled/manual-review states. Keep desktop
  rendering constrained to the mobile-width web surface.
- **Testing:** Unit-test vocabulary and transition guards; integration-test
  authorization, uniqueness, concurrency, idempotency, append-only evidence,
  and two-checkpoint progression against PostgreSQL.

## Change Surface

| Area | Likely change? | Reason/risk |
| --- | --- | --- |
| UI | Yes | Add the Admin operations surface for group/announcement/checkpoints and participant summary states. Do not build Buyer OTP or payout controls. |
| API | Yes | Add Admin-only group/checkpoint read and mutation contracts. Exact routes and payloads belong in the implementation plan. |
| State | Yes | Add guarded transitions using only existing approved states; no new transaction state. |
| Database | Yes | Existing tables need concrete uniqueness, checkpoint vocabulary, idempotency/evidence handling, and possibly a migration. Do not store raw WhatsApp messages. |
| Auth | Yes, boundary only | Reuse Admin authorization; no new product role or external WhatsApp identity flow. |
| Jobs/integrations | No | WhatsApp remains manual/external. Notification retry may use existing boundary only if required by the approved ticket; no WhatsApp API integration. |
| Tests/docs | Yes | Add unit/integration/UI-state coverage and later execution validation. |

## Unknowns And Assumptions

| Item | Can be inferred safely? | Evidence or decision needed |
| --- | --- | --- |
| Exact API route and command split for group creation, payment announcement, and role checkpoints | No | Implementation Plan must choose concrete routes and idempotency commands consistent with TRD. |
| Canonical checkpoint type vocabulary | No | The schema currently accepts free text; plan must select stable values for group, announcement, seller completion, and buyer completion. |
| Whether one group record is allowed per transaction or group replacement/reissue is needed | No | Ticket requires a correct group and duplicate recovery but does not define replacement semantics; plan must state the safest MVP rule. |
| Whether message delivery result is persisted in BAYAR-006 | No | Ticket requires delivery failure/retry recovery, while WhatsApp itself is external; plan must define a sanitized operational result without trusting message content. |
| Exact participant-facing summary projection | Yes, partially | Raw evidence is Admin-only; participants may see group/checkpoint status summary. Field-level projection should be confirmed in the plan against UI-SCR-012/013. |
| Whether a checkpoint can be corrected | Yes, partially | Approved flow requires append-only correction/audit; plan must define correction as a new event/snapshot rather than overwriting original evidence. |
| Confirmation-link generation | No for this ticket | `UX-FLOW-022` makes the handoff eligible, but Buyer confirmation link/OTP behavior belongs to BAYAR-007. BAYAR-006 should expose eligibility only and not generate or send OTP. |
| Seller shipment event semantics | Yes, partially | Seller ships outside the system; BAYAR-006 records completion checkpoints, not delivery proof or shipment tracking. |

## Research Conclusion

```text
Recommended implementation boundary:
- Build an Admin-only WhatsApp operations service/API over the existing
  whatsapp_groups and whatsapp_checkpoints tables.
- Record group creation, payment announcement, Seller completion, and Buyer
  completion as immutable/sanitized checkpoint evidence.
- Require PAYMENT_CONFIRMED before group/announcement mutation, then use
  guarded existing transitions through READY_FOR_FULFILLMENT,
  WAITING_COMPLETION_REPORTS, WAITING_OTHER_COMPLETION_REPORT, and
  READY_FOR_BUYER_CONFIRMATION.
- Keep external WhatsApp activity manual and untrusted until recorded by Admin.
- Provide participant-safe summaries and leave confirmation-link/OTP creation
  to BAYAR-007.

Main risks:
- Free-text checkpoint type and missing uniqueness currently allow duplicate or
  role-confused checkpoints.
- Existing tables do not persist a command idempotency/correction identity for
  checkpoint mutations.
- A transition can be advanced incorrectly unless payment, group, role,
  evidence, and state-version checks are atomic.
- Raw WhatsApp evidence could leak through projections or audit unless all
  payloads remain sanitized and reference-only.
- The singular WAITING_OTHER_COMPLETION_REPORT state must be used exactly as
  approved; no replacement state may be introduced.

Files likely affected:
- src/server/db/schema.ts
- drizzle/0008_bayar006_whatsapp_checkpoints.sql (if migration is required)
- src/server/operations/whatsapp.ts (new service boundary)
- src/app/api/admin/transactions/[id]/whatsapp/route.ts (new Admin API)
- src/app/api/admin/transactions/[id]/whatsapp/checkpoints/route.ts (new Admin API)
- src/app/admin/operations/page.tsx and src/components/admin/whatsapp-operations.tsx
- focused unit/integration tests and BAYAR-006 validation report

Ready to plan: Yes
```
