# User Requirements Template

Use this template after the User Journey and UX Flow are approved. Describe what users and operators need; do not decide the visual or technical implementation here.

## 1. Document Metadata

```text
Feature/product area:
Version:
Status: Draft / Review / Approved
Source user journey:
Source UX flow:
Owner:
Last updated:
```

## 2. Problem And Outcome

```text
Problem:
Expected user outcome:
Expected business outcome:
```

## 3. Actors And Goals

| Actor | Goal | Entry point | Successful end state |
| --- | --- | --- | --- |
| | | | |

## 4. User Requirements

Use stable IDs such as `UR-<ACTOR>-001`.

| ID | Actor | Requirement | Source Journey step | Source UX Flow ID | Priority | System or manual | Acceptance summary |
| --- | --- | --- | --- | --- | --- | --- | --- |
| | | As a ..., I need ..., so that ... | | | Must/Should/Could | | |

Rules:

- One requirement must describe one observable user need.
- Keep implementation choices out of the requirement.
- Mark every manual operation explicitly.
- Keep claims, authoritative verification, prerequisite approval, and later settlement as separate requirements when the approved journey distinguishes them.

## 5. Data Requirements

| Data | Entered by | Required? | When collected | Validation | Stored? | Sensitive? | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| | | Yes/No | | | Yes/No | Yes/No | |

## 6. Permissions And Ownership

| Action | Allowed actor | Preconditions | Forbidden actor | Audit required? |
| --- | --- | --- | --- | --- |
| | | | | Yes/No |

## 7. Business Rules

| Rule ID | Rule | Applies to | Failure/alternate outcome |
| --- | --- | --- | --- |
| BR-001 | | | |

## 8. Notifications And Messages

| Trigger | Recipient | Channel | Message intent | Manual or automatic |
| --- | --- | --- | --- | --- |
| | | | | |

## 9. Exceptions And Recovery

| Case | Expected user experience | Operator action | Final state |
| --- | --- | --- | --- |
| | | | |

## 10. Out Of Scope

- ...

## 11. Open Decisions

| Decision | Why it matters | Owner | Due before |
| --- | --- | --- | --- |
| | | | |

## 12. Ready For QA Checklist

- Every Journey step and UX Flow transition maps to a requirement or an explicitly manual/non-UI/out-of-scope action.
- Required data and validation are defined.
- Actor permissions are unambiguous.
- Happy path and alternate outcomes are described.
- Open decisions are visible.
- Requirement IDs are stable enough for UI/UX Design and QA traceability.
