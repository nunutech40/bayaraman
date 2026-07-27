# Plan Review Template

Use this to review an implementation plan before execution. Review against source requirements and repository evidence, not writing style.

## Review Metadata

```text
Ticket:
Plan reviewed:
Reviewer:
Decision: Approved / Changes required / Blocked
```

## Traceability Review

| Requirement/UX/UI/AC | Planned step | Verification | Covered? |
| --- | --- | --- | --- |
| | | | Yes/No |

## Safety And Correctness Review

| Check | Result | Evidence/comment |
| --- | --- | --- |
| Matches approved user journey | Pass/Fail | |
| Matches approved UX Flow and UI/UX states | Pass/Fail | |
| Respects state transition guards | Pass/Fail | |
| Preserves actor authorization | Pass/Fail | |
| Handles sensitive/financial data safely | Pass/Fail | |
| Keeps manual/system boundaries explicit | Pass/Fail | |
| Covers failure, retry, and duplicate action | Pass/Fail | |
| Includes proportional tests | Pass/Fail | |
| Covers relevant responsive and accessibility behavior | Pass/Fail | |
| Avoids unrelated changes | Pass/Fail | |

## Findings

List findings by severity and point to the exact plan step or missing requirement.

| Severity | Finding | Required change |
| --- | --- | --- |
| Blocker/High/Medium/Low | | |

## Decision

```text
Decision:
Required changes before execution:
Residual risks accepted:
```
