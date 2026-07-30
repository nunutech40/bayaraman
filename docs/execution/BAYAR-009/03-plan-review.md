# Plan Review: BAYAR-009

## Review Metadata

```text
Ticket: BAYAR-009 - Complaint Hold and External Settlement Recording
Plan reviewed: docs/execution/BAYAR-009/02-plan.md v0.1 Draft
Reviewer: Codex
Decision: Approved
Status: Approved
Review basis: docs/execution/templates/plan-review-template.md
Reviewed against: BAYAR-009 ticket, 01-research.md, previous Plan Review,
  PRD.md v0.2, TRD.md v1.2, approved requirement/UX/UI/QA IDs,
  and current repository schema
```

## Previous Finding Closure

| Previous finding | Revised-plan evidence | Result |
| --- | --- | --- |
| Handoff source state/version was ambiguous | Outcome matrix and handoff contract store the post-approval target state and resulting incremented version; read/claim compare both to the current transaction | Closed |
| Immutable handoff conflicted with one-time claim | Named `complaint_financial_handoffs_claim_once_guard` permits only the complete null-to-non-null consumption transition while every snapshot field stays fixed | Closed |
| Single assignment text could not model intake and approval scopes | Normalized `admin_task_assignments` supports separate active `COMPLAINT_INTAKE` and `COMPLAINT_APPROVAL` rows; legacy text is compatibility-only | Closed |
| Legacy complaint backfill could create false holds | Migration preflight classifies eligible, hold, and post-processing states explicitly and aborts ambiguous, duplicate, orphan, invalid, or unmappable rows before DDL | Closed |
| Agreement-level uniqueness allowed two case outcomes | Unique handoff indexes exist for both `agreement_id` and `complaint_case_id`; case/current-version locks guard finalization | Closed |
| Approval and rejection could race | Agreement status is conditionally locked as `PENDING`; only one approval/rejection path may finalize, while losing mutations reject and audit | Closed |
| Claim event/audit was not atomic | Parent operation, conditional claim, `HANDOFF_CLAIMED` event, and sanitized audit share the caller transaction; replay does not duplicate evidence | Closed |
| Complaint authority could be cascade-deleted | Case, event, agreement, approval, handoff, and consumed-operation authority references use `ON DELETE RESTRICT` | Closed |
| Participant summary vocabulary was unspecified | Public projection is restricted to four statuses and six allowlisted fields; outcome, evidence, Admin, approval, destination, calculation, and consumption details are excluded | Closed |

## Traceability Review

| Requirement/UX/UI/AC | Planned step | Verification | Covered? |
| --- | --- | --- | --- |
| Ticket AC-1 / `UR-ADMIN-012` / `UR-BR-017` / `UX-FLOW-035` | Steps 1-5, 10-12 | Deterministic migration, state matrix, intake, correction, active projection, route, and UI tests | Yes |
| Ticket AC-2 / `UR-PARTY-004` / `UR-ADMIN-013` / `UR-BR-018` / `UX-FLOW-036..037` | Steps 6, 10, 12 | No-agreement transition, active hold guard, participant summary, and no-financial-row tests | Yes |
| Ticket AC-3 / `UR-ADMIN-014` / `UR-BR-019` / `UR-BR-040` / `UX-FLOW-038..042` | Steps 7-9 | Frozen calculation, current agreement, two distinct approvals, unique final route, resulting state/version, and atomic handoff tests | Yes |
| Ticket AC-4 / `UR-PARTICIPANT-004` / `QA-SEC-003` | Steps 1-3, 5, 11-12 | Normalized assignment, restricted raw evidence, allowlisted participant DTO, sanitized audit, and route tests | Yes |
| `QA-COMPLAINT-001` | Steps 1, 4-5 | Pre-processing intake, duplicate, conflict, correction, migration, and audit tests | Yes |
| `QA-COMPLAINT-002` | Steps 6, 10 | Unresolved hold, disabled action, no agreement, and historical projection tests | Yes |
| `QA-COMPLAINT-003` / `QA-FIN-005` | Steps 7-9 | Three outcomes, calculation, approval/rejection race, handoff uniqueness, source snapshot, and claim tests | Yes |
| `QA-COMPLAINT-004` | Steps 1, 4, 6 | Manual review and post-processing record-only/no-reversal fixtures | Yes |
| `UI-SCR-017` | Steps 3, 11-12 | Intake, evidence, correction, no agreement, proposal, approval, and recovery states | Yes |
| `UI-SCR-018..019` | Steps 7-9, 12 | Eligibility/handoff messaging only; no transfer control or operation execution | Yes |
| PRD/TRD manual/financial boundary | Steps 4-10 | Manual WA evidence, no adjudication, approved states, no terminal result, and downstream-only money movement | Yes |

## Safety And Correctness Review

| Check | Result | Evidence/comment |
| --- | --- | --- |
| Matches approved user journey | Pass | Complaint negotiation remains outside the system; BayarAman records hold and written agreement only. |
| Matches approved UX Flow and UI/UX states | Pass | Hold, no agreement, seller release, refund, split, and post-processing paths use approved states without `SETTLEMENT_READY`. |
| Respects state transition guards | Pass | Exact source states, expected version, row locks, resulting state/version snapshot, stale-handoff rejection, and no-reversal matrix are explicit. |
| Preserves actor authorization | Pass | Product roles remain unchanged; normalized active scopes, `isAdmin`, two distinct approvers, revocation, and participant ownership are tested. |
| Handles sensitive/financial data safely | Pass | Raw WA/financial/internal data stays Admin-only; participant projection and audit payloads are allowlisted and sanitized. |
| Keeps manual/system boundaries explicit | Pass | WhatsApp and agreement remain manual; complaint authority is recorded in-system; BAYAR-008 alone creates and executes financial operations. |
| Covers failure, retry, and duplicate action | Pass | Request hashes, idempotent replay, stale-state rejection, approval/rejection race, competing versions, one-time claim, and rollback are covered. |
| Includes proportional tests | Pass | Migration, direct SQL, service, route, privacy, concurrency, regression, UI, and producer/consumer contract tests are planned. |
| Covers relevant responsive and accessibility behavior | Pass | UI verification includes loading/error/stale/manual-review/approval states, masking, focus/keyboard behavior, and desktop mobile-width layout. |
| Avoids unrelated changes | Pass | Cancellation, risk, payment authority, OTP, notifications, and money execution stay in their owning tickets. |

## Findings

| Severity | Finding | Required change |
| --- | --- | --- |
| Low | Assignment provisioning is intentionally manual/internal in BAYAR-009, so implementation must provide test fixtures or documented local seed data before the complaint UI can be exercised. | Record the local provisioning command/fixture in validation; do not add assignment-management UI to this ticket. |
| Low | BAYAR-008 currently has an older draft handoff/migration assumption. | After BAYAR-009 validation, revise BAYAR-008 to consume this source-specific atomic claim contract and renumber its migration in dependency order. |

## Decision

```text
Decision: Approved
Status: Approved

Required changes before execution:
- None.

Residual risks accepted:
- Raw evidence retention duration and legal-hold policy remain production
  Legal/Compliance launch decisions.
- Admin task-assignment provisioning remains an internal/manual operation;
  BAYAR-009 must include local fixtures and validation evidence.
- BAYAR-008, BAYAR-010, and BAYAR-011 remain downstream dependencies and must
  adopt the approved source-specific handoff/assignment boundaries.
- Implementation must remain limited to BAYAR-009 and pass the planned
  migration, PostgreSQL, concurrency, privacy, authorization, UI, and
  repository validation before closure.
```
