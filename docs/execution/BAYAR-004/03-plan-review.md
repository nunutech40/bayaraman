# Plan Review

## Review Metadata

~~~text
Ticket: BAYAR-004 — Midtrans Invoice, Hosted Checkout, and Payment Expiry
Plan reviewed: docs/execution/BAYAR-004/02-plan.md v0.1 Draft
Reviewer: Codex
Decision: Approved
Status: Approved
Reviewed on: 2026-07-29
~~~

## Traceability Review

| Requirement/UX/UI/AC | Planned step | Verification | Covered? |
| --- | --- | --- | --- |
| UR-SYSTEM-004 / PB-MP-001 / UX-FLOW-013 / UI-SCR-010: one Midtrans payment link | 1-4 | Provider adapter, invoice service, route, and idempotency tests verify `payment_type: payment_link` and one active invoice | Yes |
| UR-BUYER-004 / PB-MP-002 / UI-SCR-010: hosted checkout and secret isolation | 1, 4, 6 | Safe projection, fake adapter, server-only config, and UI tests | Yes |
| UR-PAYMENT-001 / PB-MP-001: frozen amount, URL, IDs, timestamps, and idempotency reference immutable | 2-3 | Frozen-term checks, unique idempotency-reference index, named PostgreSQL trigger, and update/delete tests | Yes |
| UR-PAYMENT-002 / PB-MP-001: one active invoice and duplicate request result | 2-3, 7 | Partial active-invoice index, unique idempotency reference, request-hash conflict test, and concurrent creation test | Yes |
| UR-SYSTEM-005/006 / PB-MP-005 / UX-FLOW-044/045: invoice expiry | 5 | Fixed-clock boundary tests and atomic state/version/deadline update | Yes |
| UR-BR-034/035 / PB-MP-006 / late-fund boundary | 2, 5, 7 | Late-provider-success fixture confirms no revival and handoff to BAYAR-005/later reconciliation | Yes as boundary |
| UI-SCR-009/010/021 / QA-UI-002 | 4, 6, 7 | Mobile-width manual check, loading/error/expired/unauthorized states, and deferred cancellation boundary | Yes |
| Ticket AC-1..5 | 1-8 | Adapter, persistence, routes, expiry, UI, and scope validation checks | Yes |

## Safety And Correctness Review

| Check | Result | Evidence/comment |
| --- | --- | --- |
| Matches approved user journey | Pass | Frozen role data produces a Midtrans hosted payment link; late payment does not revive the transaction |
| Matches approved UX Flow and UI/UX states | Pass | Hosted/status states, expiry, recovery, and deferred cancellation boundary are mapped |
| Respects state transition guards | Pass | Plan uses only approved transitions and protects them with exact state version/deadline predicates; no new state or payment authority is introduced |
| Preserves actor authorization | Pass | Authenticated Buyer/Seller participant routes are explicit; Admin, unrelated, and unauthenticated requests are denied; server performs the domain mutation |
| Handles sensitive/financial data safely | Pass | Server-only Midtrans config, safe provider projection, no raw provider payloads, and immutable invoice fields are defined |
| Keeps manual/system boundaries explicit | Pass | Webhook authority, Admin reconciliation, refund, payout, and money movement remain BAYAR-005/later scope; expiry uses `SYSTEM:payment-expiry` without a system account |
| Covers failure, retry, and duplicate action | Pass | Adapter error categories, idempotency/request hash, concurrent creation, legacy 410 quarantine, deadline races, and late-fund recovery are planned |
| Includes proportional tests | Pass | Unit, fake-adapter, route, PostgreSQL migration/trigger, concurrency, fixed-clock, and UI-state checks are listed |
| Covers relevant responsive and accessibility behavior | Pass | Existing mobile-width shell is preserved and responsive/accessibility checks remain manual and proportional |
| Avoids unrelated changes | Pass | No webhook authority, payment confirmation, refund, payout, cancellation operation, WhatsApp, provider API beyond invoice creation, or other ticket scope is planned |

## Findings

| Severity | Finding | Required change |
| --- | --- | --- |
| Minor | Midtrans API response details and credential deployment remain implementation-time concerns. | Validate the provider contract through the fake adapter and server-only config during implementation; production credentials and deployment remain launch-gated. |
| Minor | Existing legacy payment routes/tables remain in the repository for compatibility. | Keep the planned `410 Gone` quarantine and regression tests; do not remove legacy tables or reuse their payment behavior in BAYAR-004. |

No blocker or high-severity finding remains. The minor items are explicitly bounded in the plan and do not prevent implementation.

## Scope Leak Review

The plan stays within BAYAR-004. It creates the Midtrans invoice/payment-link
boundary, hosted-link/status projection, and deterministic invoice expiry only.
Webhook authority and reconciliation, refund, payout, money movement, and
other transaction features remain outside this ticket. No new product role,
transaction state, or financial result is introduced. OrbStack is local-only.

## Decision

~~~text
Decision: Approved
Status: Approved

Required changes before execution: None.

Residual risks accepted:
- Midtrans response mapping and production credential/deployment details must
  be validated during implementation and remain behind the launch gate.
- Legacy manual-payment compatibility code remains present but must stay
  quarantined and must not become the primary payment path.
- BAYAR-005 owns authoritative webhook/Get Status reconciliation and may race
  with expiry through the approved state-version guard.
~~~

## Review Completion

- [x] Reviewed against `docs/execution/templates/plan-review-template.md`.
- [x] Reviewed against the BAYAR-004 ticket, research, PRD v0.2, and TRD v1.2.
- [x] Confirmed Midtrans `payment_type: payment_link`, frozen amount/deadline, and hosted checkout boundary.
- [x] Confirmed idempotency reference format, unique mapping, active-invoice guard, and request-hash conflict behavior.
- [x] Confirmed migration preflight/backfill, immutable trigger names/columns, lifecycle exceptions, and recovery instructions.
- [x] Confirmed participant authorization and server-side system mutation boundary for `/api/transactions/[id]/payment-link`.
- [x] Confirmed server-only Midtrans configuration and fake-adapter/error test boundary.
- [x] Confirmed invoice expiry, late-fund non-revival, legacy route quarantine, and BAYAR-005 scope separation.
- [x] Confirmed no unapproved product role, transaction state, financial result, or unrelated ticket behavior.
- [x] Plan approved for implementation.
