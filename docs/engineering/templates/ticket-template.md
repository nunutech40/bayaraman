# Engineering Ticket Template

Use this template to split an approved technical design into small, independently reviewable work.

## Ticket

```text
ID:
Title:
Type: Feature / Fix / Chore / Migration
Priority:
Owner:
Depends on:
Blocks:
Source requirement IDs:
Source UX Flow IDs:
Source UI IDs/states:
Source QA scenario IDs:
Source technical design section:
```

## Outcome

One or two sentences describing the observable result when this ticket is done.

## Context

Include only context needed for this ticket. Link to the source documents for everything else.

## In Scope

- ...

## Out Of Scope

- ...

## Acceptance Criteria

Use observable conditions.

```text
Given ...
When ...
Then ...
```

## Impact Map

| Area | Expected impact |
| --- | --- |
| UI/routes | |
| Approved UI states/content | |
| API/actions | |
| State transitions | |
| Database/migration | |
| Authorization | |
| Audit/notifications | |
| Manual operations | |

## Implementation Constraints

- Existing patterns that must be followed.
- Compatibility or rollout requirements.
- Explicit forbidden scope.

## Verification

| Check | Command or steps | Expected result |
| --- | --- | --- |
| | | |

## Definition Of Done

- Acceptance criteria are met.
- Relevant approved UX Flow transitions and UI/UX states are implemented without adding hidden behavior.
- Relevant automated/manual checks pass.
- Important state and financial actions remain auditable when required by the ticket.
- Docs are updated only where behavior changed.
- No unrelated files are changed.
- Remaining risks are stated in the handoff.
