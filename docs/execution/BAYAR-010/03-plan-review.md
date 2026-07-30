# Plan Review: BAYAR-010

## Review Metadata

```text
Ticket: BAYAR-010 - Cancellation Lifecycle and Midtrans Reconciliation Handoff
Plan reviewed: docs/execution/BAYAR-010/02-plan.md v0.1 Draft (final revision)
Reviewer: Codex
Decision: Approved
Status: Approved
Review basis: docs/execution/templates/plan-review-template.md
Reviewed against: BAYAR-010 ticket, 01-research.md, previous Plan Reviews,
  PRD.md v0.2, TRD.md v1.2, approved requirement/UX/UI/QA IDs,
  implemented BAYAR-005/BAYAR-006/BAYAR-009/BAYAR-011 boundaries,
  and current repository code
```

## Previous Finding Closure

| Previous finding | Final-plan evidence | Result |
| --- | --- | --- |
| Participant risk cause inherited Admin authority | Participant only marks `RISK/REQUIRED`; assigned `RISK_INTAKE` Admin performs the handoff | Closed |
| Direct risk request could close before BAYAR-011 intake | Transaction may be `CANCELLED`, but request remains `ACTIVE/RISK_REQUIRED` and source-owned until atomic risk linkage/closure | Closed |
| Risk versus complaint precedence was undefined | Immutable risk cause has permanent priority; non-risk shipped/conflict selects complaint; referred delegation cannot change | Closed |
| Reconciliation timeout had no recovery | Immutable timeout reason plus shared-resolver Admin recovery matrix | Closed |
| Funded-response timeout had no recovery | Separate append-only evidence and explicit response-recovery command | Closed |
| Midtrans classifier had overlapping branches | Total identity -> amount/currency -> status precedence | Closed |
| Late-fund caller/atomicity was undefined | Static provider-event orchestration, caller-owned transaction, unique provider resolution, and one handoff | Closed |
| Late-fund incorrectly required normal invoice authority | Funded and late-fund use separate named guards; late event leaves authority pointer unchanged/null | Closed |
| Late-fund hash/timestamp semantics were undefined | Source-neutral `sourceHash` and `sourceFinalizedAt` have exact branch-specific derivation | Closed |
| Timed-out reconciliation recovery could rewrite history | `TIMED_OUT` projection remains immutable; recovery appends provider resolution and updates request/transaction atomically | Closed |
| Resolver composition depended on runtime registration | Named static `src/server/payment/process-provider-event.ts` is used by webhook, Get Status, and Admin recovery | Closed |
| Complaint evidence inherited complaint authority | Evidence marks complaint required; assigned `COMPLAINT_INTAKE` Admin performs separate handoff | Closed |
| Migration used undefined remediation marker | Migration hard-stops on every legacy cancellation row before DDL | Closed |
| Existing payment-review completion had no application contract | Exact single-application function delegates to the shared resolver | Closed |
| Calculation rejection outcome was ambiguous | Immutable rejection remains funded review; new version requires changed server-derived input/evidence | Closed |

## Traceability Review

| Requirement/UX/UI/AC | Planned step | Verification | Covered? |
| --- | --- | --- | --- |
| Ticket AC-1 / `UR-CANCEL-001..003` / `UX-FLOW-051..053` | Steps 1-3, 9-10 | Direct non-risk closure, direct-risk active source owner, invitation revocation, duplicate/concurrency, and audit | Yes |
| Ticket AC-2 / `UR-CANCEL-004..007` / `UX-FLOW-054..057` | Steps 1, 3-4, 9-11 | Invoice retirement, total classifier, static resolver orchestration, immutable deadline, and recovery | Yes |
| Ticket AC-3 / `UR-CANCEL-008..013` / `UX-FLOW-049/050/058..063` | Steps 1, 3-4, 7, 9-10 | Funded/late branch guards, no pointer mutation/revival, linked review, one handoff, and caller convergence | Yes |
| Ticket AC-4 / `UR-CANCEL-014..018` / `UX-FLOW-064..068` | Steps 3, 5, 8-11 | Funded evidence, timeout/recovery, delegation precedence, and separate complaint intake | Yes |
| `UR-CANCEL-019..021` / `UX-FLOW-069..071` | Steps 1, 6, 9-10 | Calculation, rejection versioning, two-Admin approval, source-neutral handoff, and claim | Yes |
| `UR-CANCEL-022..023` / `UX-FLOW-072..073` | Steps 3, 8-10 | Active cancellation source owner, assigned risk intake, active/record-only mode, and generic projection | Yes |
| Ticket AC-5 / `UR-CANCEL-024..025` / `UX-FLOW-074..075` | Steps 3, 9-10 | Shipment/financial cutoff, safe restoration, stale version, duplicate, and concurrent action | Yes |
| `UR-CAN-OD-001..008`, `UR-BR-047..062` | Steps 1-12 | Vocabulary, permission, deadlines, immutable evidence, provider/refund boundary, concurrency, privacy, and SLA | Yes |
| `UI-SCR-021..023` | Steps 2, 9-10 | Participant/Admin permissions, timeout/UNKNOWN/recovery, masking, accessibility, and mobile-width layout | Yes |
| `QA-CANCEL-001..014`, `QA-EXP-004`, `QA-SEC-003..005` | Step 12 | Unit, PostgreSQL, route, orchestration, fixed-clock, delegation, privacy, and regression suites | Yes |

## Safety And Correctness Review

| Check | Result | Evidence/comment |
| --- | --- | --- |
| Matches approved user journey | Pass | Direct, provider-reconciled, funded, timeout, complaint/risk, late-fund, and no-revival paths are represented. |
| Matches approved UX Flow and UI/UX states | Pass | Participant/Admin screens and manual-review recovery states map to approved UX/UI IDs. |
| Respects state transition guards | Pass | Exact entry/cutoff/restoration/recovery matrices, ACTIVE/CLOSED request lifecycle, expected version, and row-lock order are defined. |
| Preserves actor authorization | Pass | Participant, cancellation Admin, Complaint Admin, and Risk Admin commands are independently assignment-gated. |
| Handles sensitive/financial data safely | Pass | Provider/WhatsApp/bank secrets remain server-side; evidence, resolutions, calculations, and handoffs are immutable and masked. |
| Keeps manual/system boundaries explicit | Pass | Midtrans transport, Admin recovery, complaint/risk intake, BAYAR-008 execution, and BAYAR-012 scheduling are separated. |
| Covers failure, retry, and duplicate action | Pass | Idempotency, state version, races, duplicate/out-of-order provider events, timeout recovery, delegation competition, and handoff claims are covered. |
| Includes proportional tests | Pass | Migration, direct SQL, classifier, orchestration, service, route, fixed-clock, authorization, privacy, UI, and regression tests are mapped. |
| Covers relevant responsive and accessibility behavior | Pass | Mobile-width desktop surface, labels, focus, non-color states, timeout/recovery, and masking checks are included. |
| Avoids unrelated changes | Pass | No refund execution, risk outcome, complaint adjudication, scheduler deployment, or new product state/role is introduced. |

## Findings

| Severity | Finding | Required change |
| --- | --- | --- |
| Low | `sourceHash/sourceFinalizedAt` replace the earlier source-specific BAYAR-008 handoff names. | BAYAR-008 research/plan must consume the approved final contract before BAYAR-008 implementation resumes. |
| Low | Migration `0012` intentionally hard-stops when any legacy cancellation row exists. | Validation must prove empty-table migration and preserve the documented separate-remediation requirement rather than bypassing preflight. |
| Low | Static provider orchestration changes the current payment call path shared by webhook and Get Status. | Keep the change narrowly scoped and require BAYAR-005 regression tests plus transaction/duplicate/import-cycle evidence. |
| Low | External WhatsApp statements and Midtrans availability remain outside system control. | Preserve append-only/manual evidence and keep `UNKNOWN` in reconciliation/manual review without inferred money outcome. |

## Decision

```text
Decision: Approved
Status: Approved

Required changes before execution:
- None.

Residual risks accepted:
- BAYAR-008 must adopt sourceHash/sourceFinalizedAt before financial
  implementation resumes.
- Migration must stop rather than infer legacy cancellation history.
- Static payment orchestration must preserve all BAYAR-005 authority,
  idempotency, and out-of-order behavior.
- WhatsApp evidence remains manual and Midtrans UNKNOWN remains non-authoritative.
- BAYAR-008 alone owns financial-operation creation/execution.
- BAYAR-012 alone owns production scheduling/escalation.
- Implementation must remain limited to BAYAR-010 and pass all planned
  migration, PostgreSQL, provider, authorization, concurrency, privacy,
  responsive, accessibility, regression, and no-revival validation.
```
