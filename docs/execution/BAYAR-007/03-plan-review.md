# Plan Review: BAYAR-007

## Review Metadata

```text
Ticket: BAYAR-007 - Buyer Confirmation Link and WhatsApp OTP
Plan reviewed: docs/execution/BAYAR-007/02-plan.md v0.1
Reviewer: Codex
Decision: Approved
Status: Approved
Review basis: docs/execution/templates/plan-review-template.md
```

## Traceability Review

| Requirement/UX/UI/AC | Planned step | Verification | Covered? |
| --- | --- | --- | --- |
| UR-BUYER-006 / UX-FLOW-023 / UI-SCR-013 / QA-CONF-001 | Steps 1-3, 5 | Buyer binding, one link per transaction, token privacy, route authorization, expiry and replay tests | Yes |
| UR-BUYER-007 / UX-FLOW-024 / UI-SCR-014 / QA-CONF-002 | Step 4 | Hash-only OTP, atomic verification, valid transition, duplicate and concurrent verification tests | Yes |
| UR-BUYER-008 / UX-FLOW-025, UX-FLOW-033 / UI-SCR-014, UI-SCR-020 / QA-CONF-004 | Steps 4, 7, 8 | WhatsApp-only delivery boundary, PENDING/SENT/FAILED/UNKNOWN, retry and failure-state tests | Yes |
| UR-SYSTEM-002 / UX-FLOW-027, UX-FLOW-028 / UI-SCR-013, UI-SCR-015 / QA-SLA-002 | Step 6 | Named reminder sweep, absolute deadline, system actor scope, conditional update and rerun tests | Yes |
| UR-SYSTEM-003 / UX-FLOW-029 / UI-SCR-016 / QA-CONF-005 | Step 6 | Overdue sweep, fixed-clock boundary, no deadline reset and no-auto-payout tests | Yes |
| UR-ADMIN-005 / UX-FLOW-022 / UI-SCR-013 / QA-CONF-001 | Steps 3, 5 | `requireAdminAccount`, `accounts.isAdmin`, no-store response, link creation and rejection tests | Yes |
| UR-ADMIN-008 / UX-FLOW-028 / UI-SCR-015 / QA-CONF-005 | Steps 5-7 | Admin status, reminder persistence, sanitized evidence and authorization tests | Yes |
| UR-ADMIN-009..011 / UX-FLOW-030..032 / UI-SCR-015 / QA-CONF-005 | Steps 1, 2, 5-7 | Controlled exception schema, Buyer completion evidence, two distinct Admin approvals, hold guard and no-payout tests | Yes |
| UR-BR-004, UR-BR-036 / UX-FLOW-023, UX-FLOW-024 / QA-CONF-003, QA-CONF-004 | Steps 1, 4, 8 | Named OTP fields/checks/index, supersession, cooldown, send window, lock and direct-insert tests | Yes |
| Ticket AC: replay, wrong account, wrong snapshot, sensitive data | Steps 2-5, 8 | Server-side binding, masked DTO, no-store, leakage, unauthorized and malformed-input tests | Yes |
| Ticket AC: valid OTP exactly once | Steps 1, 4, 8 | `used_at IS NULL` conditional update, row locks, state version, idempotency and concurrency tests | Yes |
| Ticket AC: Buyer silence never enables payout | Steps 5-7 | Overdue transition only, exception eligibility only, explicit no payout dependency/test | Yes |

## Safety And Correctness Review

| Check | Result | Evidence/comment |
| --- | --- | --- |
| Matches approved user journey | Pass | Buyer confirmation remains after completion checkpoints and before separate payout. |
| Matches approved UX Flow and UI/UX states | Pass | UI-SCR-013..016/020 are covered, including overdue and controlled Admin recovery. |
| Respects state transition guards | Pass | Link creation, OTP verification, overdue sweep, and exception transition use explicit states, expected state version, and conditional updates. |
| Preserves actor authorization | Pass | Admin routes use `requireAdminAccount` and `accounts.isAdmin`; Buyer routes require the bound Buyer; assignments remain metadata only. |
| Handles sensitive/financial data safely | Pass | Raw token/OTP and sensitive evidence are excluded from logs, audit, cookies, and participant DTOs; no financial operation is executed. |
| Keeps manual/system boundaries explicit | Pass | WhatsApp remains manual/provider-neutral; named system sweeps use `SYSTEM:confirmation-*`; payout remains BAYAR-008. |
| Covers failure, retry, and duplicate action | Pass | Link uniqueness, OTP supersession, delivery outcomes, idempotency, state-version conflicts, locks, and rerun behavior are specified. |
| Includes proportional tests | Pass | Migration, direct-insert, service, route, fixed-clock, concurrency, privacy, exception, and regression tests are planned. |
| Covers relevant responsive and accessibility behavior | Pass | Buyer/Admin mobile-width surfaces, loading/error/expired/locked/overdue states, labels and focus are included. |
| Avoids unrelated changes | Pass | No payout, refund, cancellation, complaint adjudication, risk decisioning, Seller OTP, email fallback, or real WhatsApp API is planned. |

## Findings

| Severity | Finding | Required change |
| --- | --- | --- |
| None | All blocker and high findings from the previous review are closed in the revised plan. | No plan revision required before implementation. |

## Residual Risks

- Migration implementation must preserve the named constraints, partial index
  predicate, trigger behavior, and preflight-before-DDL ordering exactly.
- The controlled exception is eligibility recording only; implementation must
  not import or call BAYAR-008 payout code.
- The existing repository schema may require exact column/FK names to be
  aligned during implementation without weakening the stated Buyer binding or
  Admin authorization rules.

## Decision

```text
Decision: Approved
Status: Approved

Required changes before execution:
- None. The implementation must follow the approved plan and its named
  constraints, route contracts, state guards, and scope boundaries.

Residual risks accepted:
- Exact migration details and repository naming alignment will be verified
  during implementation and validation.
- BAYAR-008 remains the sole owner of payout execution.
```
