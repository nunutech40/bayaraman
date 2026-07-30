# Plan Review: BAYAR-008

## Review Metadata

```text
Ticket: BAYAR-008 - Admin Payout, Refund, and Split Financial Operations
Plan reviewed: docs/execution/BAYAR-008/02-plan.md v0.1
Reviewer: Codex
Reviewed on: 2026-07-30
Decision: Approved
Status: Approved
Review basis: docs/execution/templates/plan-review-template.md
Reviewed against: BAYAR-008 ticket, current code/schema, PRD.md v0.2,
TRD.md v1.2, and Passed validations for BAYAR-007/009/010/011
```

## Previous Finding Closure

| Previous finding | Revised-plan evidence | Result |
| --- | --- | --- |
| Prepared operation was indistinguishable from transfer processing | Approved decisions 7 and 14, migration step 1, lifecycle matrix, and prepared-lifecycle tests define `result IS NULL` until execution atomically sets `PROCESSING` | Closed |
| Provider capability lookup and source claim ordering was unsafe | Approved decision 9 and Refund Capability Contract define snapshot, provider lookup outside a database transaction, then locked revalidation and atomic assessment/claim | Closed |
| Re-auth invalidation exceeded the current JWT capability | Approved decision 8 limits the guarantee to a valid current JWT, matching session hash, five-minute expiry, explicit invalidation, and atomic consume; global revocation is explicitly deferred | Closed |
| Financial assignment authority was ambiguous | Approved decision 3 and the authorization matrix use only active `admin_task_assignments`; the legacy account field is explicitly non-authoritative | Closed |
| Source types could produce unsupported outcomes | The Source/Outcome Matrix permits only the implemented outcome for each source and requires rejection/audit before operation creation | Closed |
| Cross-source handoff claiming was read-only or inconsistent | Approved decisions 5 and 6 define caller-owned atomic read/claim adapters and normalize `sourceHash` plus `sourceFinalizedAt` | Closed |
| Refund capability and selected route lacked immutable evidence | The append-only capability assessment and selected-assessment pointer bind the definitive provider/manual route to the prepared root | Closed |

## Traceability Review

| Requirement/UX/UI/AC | Planned step | Verification | Covered? |
| --- | --- | --- | --- |
| Ticket AC-1 / UR-ADMIN-006..007 / UX-FLOW-025..026 / QA-FIN-001..003 | Steps 4, 6, 9 | Payout eligibility, prepared lifecycle, re-auth grant, provider result, and terminal evidence tests | Yes |
| Ticket AC-2 / UR-ADMIN-016..017 / UX-FLOW-040..041 / QA-FIN-004 | Steps 3, 8, 11 | Atomic source claim, unlocked capability lookup, final revalidation, Midtrans/manual route, and recovery tests | Yes |
| Ticket AC-3 / UR-ADMIN-009..011 / QA-FIN-006/008 | Steps 5-7, 10-11 | Canonical assignment scopes, two distinct Admins, re-auth, source ownership, and split authorization | Yes |
| Ticket AC-4 / UR-BR-041..042 / QA-FIN-002..005 | Steps 1, 8-10 | Prepared/processing/result constraints, FAILED retry, UNKNOWN reconciliation, and immutable success evidence | Yes |
| Ticket AC-5 / QA-FIN-007 | Steps 1, 3, 5, 8-10 | Idempotency, atomic claim, active-operation uniqueness, external keys, and concurrency tests | Yes |
| Complaint, risk, funded-cancellation, and late-fund handoffs | Steps 3, 5, 7-8 | Source-specific adapters, normalized snapshots, source/outcome matrix, and misuse tests | Yes |
| UI-SCR-015/016/018/019/020 | Steps 11-12 | Mobile-width prepared, approval, re-auth, processing, result, disabled, and recovery states | Yes |
| PRD Sections 9/15 and TRD Sections 9-14 | Steps 1-13 | Schema, state, authorization, API, failure recovery, UI, security, and release checks | Yes |

## Safety And Correctness Review

| Check | Result | Evidence/comment |
| --- | --- | --- |
| Matches approved user journey | Pass | Buyer confirmation or approved controlled exception precedes payout; Midtrans settlement does not trigger payout |
| Matches approved UX Flow and UI/UX states | Pass | Payout, refund, split, prepared, disabled, PROCESSING, FAILED, UNKNOWN, and recovery states are represented |
| Respects state transition guards | Pass | Exact source states, state versions, holds, source hashes, operation lifecycle checks, and terminal evidence are required |
| Preserves actor authorization | Pass | Product roles remain Buyer, Seller, and Admin; financial scopes are internal Admin assignments |
| Handles sensitive/financial data safely | Pass | Raw destinations, credentials, provider evidence, and session identifiers remain server-side or hashed; participant projections are masked |
| Keeps manual/system boundaries explicit | Pass | Provider capability lookup is outside locks; payout/refund execution is separate from preparation and source decisioning |
| Covers failure, retry, and duplicate action | Pass | FAILED creates a linked retry, UNKNOWN requires reconciliation, source claims are atomic, and external keys protect crash windows |
| Includes proportional tests | Pass | Migration, direct-SQL guards, authorization, source adapters, lifecycle, concurrency, capability races, financial recovery, and UI security are covered |
| Covers relevant responsive and accessibility behavior | Pass | Mobile-width UI states, masking, keyboard/focus, disabled actions, and recovery behavior are included |
| Avoids unrelated changes | Pass | Upstream source owners remain authoritative and BAYAR-012 retains scheduler/reminder ownership |

## Findings

| Severity | Finding | Required change |
| --- | --- | --- |
| Low | Production Midtrans refund capability and real money movement cannot be validated without approved credentials, merchant configuration, and launch gates. | No plan change required. Keep fake/provider-neutral adapters and block production activation until the approved launch gates pass. |
| Low | The current JWT model cannot revoke every grant globally after a password change or server-side session revocation. | No plan change required for MVP. Preserve the explicitly scoped current-session guarantee and track persistent session revocation as a future auth enhancement. |
| Low | Scheduled SLA reminders and escalations are not executed by this ticket. | No plan change required. Preserve the read-only SLA handoff contract for BAYAR-012. |

## Decision

```text
Decision: Approved
Status: Approved

Required changes before execution:
- None.

Residual risks accepted:
- Production provider capability and real-money execution remain disabled until
  Midtrans credentials, merchant configuration, legal/compliance, and launch
  gates are approved.
- Re-authentication uses the current JWT/session boundary; global persisted
  session revocation remains a future auth enhancement.
- BAYAR-012 remains responsible for scheduled reminders and escalation jobs.

Implementation may start:
- Yes. Execute only the approved BAYAR-008 scope in 02-plan.md.
```
