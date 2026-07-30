# Plan Review: BAYAR-011

## Review Metadata

```text
Ticket: BAYAR-011 - Admin Risk Hold and Outcome-Neutral Review
Plan reviewed: docs/execution/BAYAR-011/02-plan.md v0.1 Draft
Reviewer: Codex
Decision: Approved
Status: Approved
Review basis: docs/execution/templates/plan-review-template.md
Reviewed against: revised BAYAR-011 ticket, 01-research.md, previous Plan
  Review, PRD.md v0.2, TRD.md v1.2, approved requirement/UX/UI/QA IDs,
  BAYAR-009 handoff implementation, and current repository schema
```

## Previous Finding Closure

| Previous finding | Revised-plan evidence | Result |
| --- | --- | --- |
| Ticket used cancellation/refund IDs as primary risk sources | Ticket and plan now use `UR-CANCEL-022/023`, `UR-BR-060/061`, and `UX-FLOW-072/073`; old IDs are downstream context only | Closed |
| Pre-payment hold had no safe recovery | Pre-authority states are record-only; active false-positive hold clears only to `MANUAL_REVIEW_REQUIRED`, never a stale source state | Closed |
| Seller release, split, and fee rules were inferred | Risk MVP allows only `KEEP_HOLD`, `CLEAR_TO_MANUAL_REVIEW`, and `BUYER_REFUND`; Seller release, split, payout, and risk fee policy are excluded | Closed |
| Competing complaint/cancellation could produce two outcomes | Competing owner states create record-only risk evidence with validated owner metadata and cannot expose a risk handoff | Closed |
| Handoff contract was descriptive rather than executable | Exact `RiskRefundHandoffSnapshot`, `readForUpdate`, `claim`, operation matching, source state/version, replay, trigger, rollback, and caller transaction are defined | Closed |
| Release-gate authority and evidence history were ambiguous | `RELEASE_GATE_REVIEW` gates mutation; item events and reviews are append-only; `APPROVED` requires all fixed items and an immutable external decision reference | Closed |
| Legacy migration and FK behavior were incomplete | Migration order replaces cascade FK with restrict, rejects legacy outcome, preserves compatibility column, orders child/current-pointer FKs, and names mutation triggers | Closed |
| `KEEP_HOLD` finalization was unclear | One assigned approval finalizes the review as `APPROVED`, moves lifecycle to `REVIEWED_HOLD`, keeps the case active, and permits a later version only with current evidence | Closed |
| Accessibility coverage was generic | Keyboard, labels, focus recovery, live regions, non-color state, contrast, and constrained-width checks are explicit | Closed |
| Assignment provisioning had no validation path | Deterministic local/test fixtures are planned for all three internal assignment scopes | Closed |

## Traceability Review

| Requirement/UX/UI/AC | Planned step | Verification | Covered? |
| --- | --- | --- | --- |
| Ticket AC-1 / `UR-CANCEL-022` / `UR-BR-060` / `UX-FLOW-072` | Steps 1-4, 7-12 | Exact active/record-only matrix, state-version guard, assignment, evidence, masking, UI, and PostgreSQL tests | Yes |
| Ticket AC-2 / `UR-CANCEL-023` / `UR-BR-061` / `UX-FLOW-073` | Steps 3-5, 7-12 | Three MVP review outcomes, restricted evidence, finalization, denial audit, and no-default behavior | Yes |
| Ticket AC-3 / `UR-BR-039` / `UR-BR-040` | Steps 1, 4-5, 7, 11-12 | Exact assignment scopes, two distinct refund approvals, immutable review, atomic handoff, and concurrency tests | Yes |
| Ticket AC-4 / `UR-BR-046` / `QA-LAUNCH-001` | Steps 1-2, 6-7, 10-12 | Separate gate aggregate, fixed items, external decision reference, assignment, append-only evidence, and no transaction mutation | Yes |
| `UR-BR-045` / `QA-SEC-003` | Steps 3-4, 7-10, 12 | Participant allowlist, assignment-gated Admin projection, sanitized audit, and forbidden-field tests | Yes |
| `UI-SCR-024` | Steps 3-4, 7, 10, 12 | Intake, evidence, review, approval, record-only, disabled, error, recovery, accessibility, and mobile-width states | Yes |
| `QA-RISK-001` | Steps 1-4, 7-12 | `PAYMENT_CONFIRMED -> RISK_HOLD`, action blocking, generic participant view, and audit | Yes |
| `QA-RISK-002` | Steps 3-5, 7-12 | Restricted evidence, authorized review, missing/rejected decision, manual recovery, and no inferred financial route | Yes |
| BAYAR-008 dependency | Step 5 | Typed Buyer-refund handoff, one-time claim, operation/type matching, replay, conflict, and rollback tests | Yes |
| PRD/TRD manual/financial boundary | Steps 1-13 | No automatic risk decision, provider mutation, financial operation, money movement, or terminal financial result | Yes |

## Safety And Correctness Review

| Check | Result | Evidence/comment |
| --- | --- | --- |
| Matches approved user journey | Pass | Risk investigation remains manual/external; BayarAman records an outcome-neutral hold and only an explicitly authorized Buyer-refund route. |
| Matches approved UX Flow and UI/UX states | Pass | `UX-FLOW-072/073` and UI-SCR-024 are primary; participant messaging remains generic and UI exposes no default financial action. |
| Respects state transition guards | Pass | Exact state categories, expected version, row locks, no source restoration, no reversal, and approved `RISK_HOLD`, `MANUAL_REVIEW_REQUIRED`, and `REFUND_READY` states are explicit. |
| Preserves actor authorization | Pass | Product roles remain unchanged; three internal assignment scopes, revocation, participant ownership, and two distinct refund approvers are defined and tested. |
| Handles sensitive/financial data safely | Pass | Append-only evidence, restricted projections, audit allowlist, immutable refund snapshot, destination binding, and participant masking are concrete. |
| Keeps manual/system boundaries explicit | Pass | External risk/launch decisions are only recorded; BAYAR-008 alone creates and executes the financial operation. |
| Covers failure, retry, and duplicate action | Pass | Idempotency hash, state/gate version, correction/current pointer, approval/rejection race, same-operation replay, competing claim, and rollback are covered. |
| Includes proportional tests | Pass | Migration, direct SQL, service, route, privacy, authorization, concurrency, handoff, gate, regression, UI, and accessibility tests are mapped. |
| Covers relevant responsive and accessibility behavior | Pass | Keyboard, labels, focus, live region, contrast, non-color status, mobile, and constrained desktop checks are explicit. |
| Avoids unrelated changes | Pass | Seller release, split, payout, provider, complaint/cancellation adjudication, WhatsApp, notifications, launch deployment, and BAYAR-008 execution remain outside scope. |

## Findings

| Severity | Finding | Required change |
| --- | --- | --- |
| Low | `sourceOwnerType/sourceOwnerId` is intentionally polymorphic and cannot use one ordinary database foreign key across complaint, cancellation, refund, operation, and terminal sources. | Keep the service-enforced owner lookup, indexed owner pair, and state/owner integration tests. Do not claim generic FK enforcement in implementation or validation. |
| Low | Release-gate `APPROVED` records an external authority reference but cannot prove that the external legal/business decision itself was valid. | Keep production blocked operationally unless the referenced external decision is independently verified; validation must state that BAYAR-011 records rather than originates launch approval. |
| Low | Assignment provisioning remains a manual/internal operation. | Include deterministic local fixtures and document the provisioning command/evidence in `04-validation.md`; do not add assignment-management UI. |
| Low | BAYAR-008 currently predates this final risk-refund handoff contract. | Revise BAYAR-008 research/plan to consume this exact source-owned contract before its implementation resumes. |

## Decision

```text
Decision: Approved
Status: Approved

Required changes before execution:
- None.

Residual risks accepted:
- Polymorphic source-owner integrity is service-enforced and must be proven by
  state/owner integration tests.
- External launch authority remains outside BayarAman; BAYAR-011 only records
  its immutable reference and gate evidence.
- Internal assignment provisioning needs deterministic local/test fixtures
  and validation evidence.
- BAYAR-008 must adopt the approved RiskRefundHandoffSnapshot and atomic claim
  contract before financial implementation resumes.
- Implementation must remain limited to BAYAR-011 and pass all planned
  migration, authorization, privacy, concurrency, handoff, release-gate,
  accessibility, regression, and PostgreSQL validation before closure.
```
