# Engineering Ticket

## Ticket

~~~text
ID: BAYAR-001
Title: Application Foundation and Domain Persistence Boundary
Type: Chore
Priority: P0
Owner: Engineering
Status: Draft
Depends on: None
Blocks: BAYAR-002, BAYAR-003, BAYAR-012
Source requirement IDs: UR-ACCOUNT-001, UR-ACCOUNT-002, UR-PARTICIPANT-001, UR-PARTICIPANT-002, UR-PARTICIPANT-003, UR-SYSTEM-008, UR-SYSTEM-009, UR-SYSTEM-010, UR-SYSTEM-011, UR-BR-001, UR-BR-025, UR-BR-040, UR-BR-041, UR-BR-042, UR-BR-045
Source UX Flow IDs: UX-FLOW-001, UX-FLOW-002, UX-FLOW-071, UX-FLOW-072, UX-FLOW-073, UX-FLOW-074, UX-FLOW-075
Source UI IDs/states: UI-SCR-001, UI-SCR-009
Source QA scenario IDs: QA-SEC-004, QA-SEC-005, QA-UI-006
Source technical design section: TRD Sections 3, 4, 5, 10, 12, 13, 14, 15
Source product decisions: PB-MP-001, PB-MP-002, PB-MP-003, PB-MP-004, PB-MP-005, PB-MP-006, PB-MP-007, PB-MP-008, PB-MP-009
~~~

## Outcome

Provide a runnable Next.js/TypeScript foundation with PostgreSQL/Drizzle
persistence and shared mutation guards for the approved BayarAman domain.

## In Scope

- Next.js App Router, strict TypeScript, Tailwind, and mobile-width web shell.
- PostgreSQL local runtime boundary, Drizzle schema and migrations.
- Accounts, transactions, participants, frozen terms, invitations, payment
  invoices/provider events/reconciliations, WhatsApp evidence, confirmation,
  cancellation, complaint/risk holds, financial operations, idempotency, and
  append-only audit tables as defined in TRD Section 10.
- State-version, idempotency, authorization, immutable evidence, and audit
  transaction helpers.
- Zod validation and test foundation.

## Out Of Scope

Feature behavior owned by BAYAR-002 through BAYAR-012, real Midtrans/WhatsApp
traffic, money movement, production launch, DATABASE.md, and AUTH.md.

## Acceptance Criteria

- A clean checkout passes typecheck/build and renders the mobile-width shell.
- Schema migration creates the TRD entities and rejects a same-account Buyer
  and Seller, duplicate active invoice, duplicate active operation, and stale
  state-version mutation.
- Reusing an idempotency key returns the original result without a second
  mutation; concurrent conflicting mutations produce one winner.
- Business mutation, immutable evidence, and audit event commit atomically;
  rejected mutations are audited without leaking secrets or raw financial data.
- Product roles are limited to Buyer, Seller, and Admin.

## Impact Map

| Area | Expected impact |
| --- | --- |
| UI/routes | App shell only |
| API/modules | Shared validated command, state, idempotency, audit boundaries |
| Database | Initial schema, constraints, indexes, migration harness |
| Authorization | Server-side Buyer/Seller/Admin boundary |
| External systems | Provider-neutral adapters only; no live calls |

## Implementation Constraints

- Use TRD Sections 3-5, 10, 12-15; do not add roles, states, or provider
  behavior. Keep Midtrans data provider-neutral until BAYAR-004/005.

## Verification

- Test schema constraints, state-version conflict, duplicate idempotency,
  append-only audit, immutable financial evidence, and unauthorized access.

## Definition Of Done

- DoD: acceptance criteria and mapped QA tests pass, migration is repeatable,
  `git diff --check` passes, and the ticket remains Draft until review.
