# Implementation Plan Template

Use this after codebase research and before editing code.

## Task

```text
Ticket ID/title:
Outcome:
Source research:
Source requirements and QA scenarios:
Source UX Flow and UI IDs/states:
```

## Scope

### In Scope

- ...

### Out Of Scope

- ...

## Planned Changes

Each step should name the responsibility and likely file/module, not just say "implement feature."

| Step | Change | File/module | Requirement/UX/UI/AC covered | Verification |
| --- | --- | --- | --- | --- |
| 1 | | | | |

## State And Data Impact

```text
State transitions added/changed:
Schema/migration impact:
Authorization impact:
Audit/notification impact:
Manual operation impact:
```

## Test Plan

| Layer | Case | Expected evidence |
| --- | --- | --- |
| Static/lint/type | | |
| Unit/integration | | |
| UI/end-to-end/manual | | |

## Risks And Safeguards

| Risk | Safeguard | Recovery/rollback |
| --- | --- | --- |
| | | |

## Plan Completion Check

- Every acceptance criterion maps to a change and verification.
- Every relevant approved UX transition and UI state maps to a change and verification.
- Dependencies and migrations are ordered.
- Unrelated refactors are excluded.
- Failure and retry behavior are covered.
- No unresolved decision makes the implementation ambiguous.
