# Technical Design Template

Use this template after the PRD and its source product artifacts are approved. Record technical decisions and their tradeoffs without rewriting the PRD or UI/UX Design.

## 1. Document Control

```text
Feature/system:
Version:
Status: Draft / Review / Approved
Author/reviewer:
Source PRD and requirement IDs:
Source UX Flow/UI/QA IDs:
Related decisions/tickets:
```

## 2. Technical Outcome

```text
Problem being solved:
Expected technical outcome:
Key constraints:
```

## 3. Scope And Non-Scope

### In Scope

- ...

### Out Of Scope

- ...

## 4. Current State

- Relevant modules and behavior.
- Existing conventions to preserve.
- Known limitations or technical debt affecting this change.

## 5. Proposed Design

Describe the component boundaries and request/event flow. Map user-facing routes/components and interaction states to approved UI IDs. Add a diagram only when it clarifies a multi-step interaction.

## 6. State Model

| From state | Event/action | Actor | Guard | To state | Audit event |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

## 7. Data Model

| Entity/field | Type | Required? | Source | Validation | Retention/sensitivity | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| | | | | | | |

Include migrations, indexes, uniqueness, snapshots, and deletion policy.

## 8. API / Interface Contract

| Method/event | Path/name | Actor | Input | Success result | Errors | Idempotent? |
| --- | --- | --- | --- | --- | --- | --- |
| | | | | | | Yes/No |

## 9. UI Implementation Contract

| UI ID/state | Route/component boundary | Data source/action | Authorization | Failure/loading behavior |
| --- | --- | --- | --- | --- |
| | | | | |

## 10. Authorization And Security

- Identity and role checks.
- Resource-level ownership checks.
- Temporary verification credential handling when required.
- Sensitive-field masking and storage.
- Rate limits and abuse controls.
- Important status and financial audit logging when required.

## 11. Manual Operation Boundary

| Manual action | System trigger/input | Stored evidence | Retry/correction path |
| --- | --- | --- | --- |
| | | | |

## 12. Background Jobs And Time Rules

| Job | Trigger/schedule | Selection rule | Idempotency | Failure handling |
| --- | --- | --- | --- | --- |
| | | | | |

## 13. Failure And Concurrency Handling

- Duplicate requests.
- Stale state updates.
- Partial external-provider failure.
- Retry behavior.
- Operator correction/override.

## 14. Observability

- Structured logs.
- Metrics and alerts.
- Audit events.
- Operational dashboard/query needs.

## 15. Rollout And Migration

- Migration order.
- Backfill or compatibility needs.
- Feature flag/rollback strategy.

## 16. Test Strategy

| Layer | Cases | Tool/approach |
| --- | --- | --- |
| Unit | | |
| Integration | | |
| End-to-end/manual | | |

## 17. Alternatives And Decisions

| Option | Benefits | Costs/risks | Decision |
| --- | --- | --- | --- |
| | | | |

## 18. Open Questions

- ...

## 19. Ready For Tickets Checklist

- Product requirement IDs are mapped.
- Relevant UX Flow, UI, and QA IDs are mapped.
- State, data, API, and authorization effects are explicit.
- Manual/system boundaries are explicit.
- Failure and rollback paths are defined.
- Test strategy is feasible.
