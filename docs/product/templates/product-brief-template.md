# Product Brief Template

Use this template to turn raw product direction and baseline research into a short, reviewable product source. Keep only confirmed direction, active MVP scope, and decisions that must be made later. Do not turn it into a PRD or a legacy-document audit.

## 1. Document Control

```text
Product:
Version:
Status: Draft / Review / Approved
Owner:
Last updated:
```

## 2. Source And Precedence

List only the sources actually used and state which source wins when they differ.

1. Latest owner direction.
2. Approved active product artifact.
3. Baseline research or drafts.

Archive/prototype sources are excluded unless the task explicitly requires historical or implementation evidence.

## 3. Problem And Proposition

```text
Who has the problem:
Current friction/risk:
Why it matters:

<Product> helps <target actor> to <outcome> by <approach> without <current limitation>.
```

## 4. Actors

| Actor | Goal | Responsibility boundary |
| --- | --- | --- |
| | | |

## 5. Confirmed MVP Scope

### Included

- ...

### Explicitly Not Included

- ...

### Later Possibilities

- ...

## 6. Core Business Rules

| ID | Rule | Status |
| --- | --- | --- |
| PB-BR-001 | | Confirmed/Open |

## 7. Manual And System Boundary

| Activity | Owner | Manual/system | Minimum system record |
| --- | --- | --- | --- |
| | | | |

## 8. Journey Seeds

List only journey names and start/end points. Detailed steps belong in User Journey.

| Journey | Starts when | Ends when |
| --- | --- | --- |
| | | |

## 9. Deferred Decisions

Group unresolved decisions by the stage that needs them. Do not block the next stage with questions it does not require.

| Needed by | Decisions |
| --- | --- |
| User Journey | |
| UX Flow | |
| User Requirements | |
| UI/UX Design | |
| QA Scenarios | |
| PRD approval | |
| Before launch | |

## 10. Optional Migration Note

Use only when replacing conflicting legacy documentation. Summarize the winning direction in a few bullets and archive the detailed audit separately. Do not carry the audit into downstream context.

## 11. Approval

- [ ] Problem, actors, and MVP boundary are clear.
- [ ] Confirmed decisions are separated from deferred decisions.
- [ ] Manual and system responsibilities are clear.
- [ ] No decision needed by User Journey remains unresolved.
- [ ] Product owner changed the status to `Approved`.
