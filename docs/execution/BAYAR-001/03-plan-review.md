# Plan Review

## Review Metadata

~~~text
Ticket: BAYAR-001 — Application Foundation and Domain Persistence Boundary
Plan reviewed: docs/execution/BAYAR-001/02-plan.md
Reviewer: Codex
Decision: Approved
Status: Approved
~~~

## Traceability Review

| Requirement/UX/UI/AC | Planned step | Verification | Covered? |
| --- | --- | --- | --- |
| Clean build and constrained shell | 1, 9 | typecheck, lint, build, viewport check | Yes |
| Local PostgreSQL, healthcheck, migration runtime | 2, 8 | Compose, healthcheck, migration integration | Yes |
| TRD entities and Midtrans persistence boundary | 3, 4 | schema/migration inspection and persistence fixture | Yes: inactive-by-default invoice rows, partial unique index, and later-ticket lifecycle ownership are explicit |
| Distinct Buyer/Seller and participant constraints | 6 | PostgreSQL constraint tests | Yes: explicit Buyer/Seller-only checks and direct-insert rejection tests |
| One active financial operation, state version | 5, 6 | integration concurrency tests | Yes |
| Idempotency and duplicate request result | 7, 9 | same key/hash and concurrent command tests | Yes: non-null `actor_scope` and its unique index cover account and system commands |
| Atomic business/evidence/audit and rejected-mutation audit | 8, 9 | commit/rollback/immutability tests | Yes: accepted and rejected mutation paths are explicitly separated |
| Buyer/Seller/Admin only, server authorization | 5, 6, 8 | authorization integration test | Yes |
| Sensitive data and immutable evidence | 3, 8, 9 | projection and update/delete rejection tests | Yes: PostgreSQL triggers and sanitized audit payload are specified |
| QA-SEC-004, QA-SEC-005, QA-UI-006 | 9, 10 | integration and viewport checks | Yes |

## Safety And Correctness Review

| Check | Result | Evidence/comment |
| --- | --- | --- |
| Matches approved user journey | Pass | Plan introduces only persistence/shared guards; no user-facing payment behavior |
| Matches approved UX Flow and UI/UX states | Pass | UI work is limited to preserving UI-SCR-001/009 shell boundary |
| Respects state transition guards | Pass | Step 6 limits work to approved vocabulary and conditional version infrastructure |
| Preserves actor authorization | Pass | Plan keeps Buyer/Seller/Admin and server-side ownership boundary |
| Handles sensitive/financial data safely | Pass | Step 8 selects PostgreSQL triggers for insert-only audit and successful financial evidence/reference/result immutability |
| Keeps manual/system boundaries explicit | Pass | Midtrans records are persistence-only; no invoice/webhook/payment behavior is planned |
| Covers failure, retry, and duplicate action | Pass | Step 7 defines persisted account/system actor scopes; Step 8 separates accepted and rejected audit behavior |
| Includes proportional tests | Pass | Unit, PostgreSQL integration, migration, concurrency, and shell checks are proportional |
| Covers relevant responsive and accessibility behavior | Pass | Step 9 limits this to the existing mobile-width shell |
| Avoids unrelated changes | Pass | Additive migration strategy keeps feature cutover with BAYAR-004/005 |

## Findings

| Severity | Finding | Required change |
| --- | --- | --- |
| Resolved blocker | Active-invoice persistence was ambiguous. | Steps 3-4 define `is_active` defaulting to `false`, `retired_at`, the partial unique index, migration, and concurrent-insert test. BAYAR-004/005 retain lifecycle behavior. |
| Resolved blocker | System/job idempotency was not enforceable with nullable account identity. | Step 7 defines non-null `actor_scope` as `ACCOUNT:<uuid>` or `SYSTEM:<job-name>` and unique `(actor_scope, command, key)` with tests. |
| Resolved blocker | Accepted and rejected audit behavior conflicted. | Step 8 separates the atomic accepted path from the durable sanitized rejection audit path and selects PostgreSQL triggers for enforcement. |
| Resolved high | Transaction membership could persist `ADMIN`. | Step 6 adds Buyer/Seller-only PostgreSQL checks and direct-insert rejection tests. |
| Resolved medium | Legacy manual-payment tables had no concrete boundary. | Step 5 adds an explicit compatibility annotation and source-scan verification for new foundation modules. |
| Resolved low | Responsive validation was vague. | Step 10 limits it to a documented manual viewport checklist; no browser automation is added. |

## Scope Leak Review

No scope leak found. The additive migration is appropriate because it creates
the TRD foundation while deferring invoice creation, checkout, webhook,
reconciliation behavior, and legacy route replacement to BAYAR-004/005.

The plan must not remove legacy tables or change current payment feature paths
in BAYAR-001; only schema compatibility, shared guards, and tests may change.

## Decision

~~~text
Decision: Approved

Required changes before execution: None.

Residual risks accepted:
- Legacy payment tables remain temporarily because current routes import them.
- Midtrans provider behavior and feature cutover remain owned by BAYAR-004/005.
- PostgreSQL triggers and the additive migration require local integration
  validation before merge; they must not be weakened outside a reviewed
  forward migration.
- OrbStack remains local-only; production PostgreSQL selection is deferred.
~~~
