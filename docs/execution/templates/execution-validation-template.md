# Execution And Validation Template

Use this during and after implementation. Record deviations and evidence; do not rewrite the original plan.

## Execution Record

```text
Ticket:
Plan:
Started:
Completed:
```

## Implemented Changes

| Planned step | Result | Files changed | Deviation/reason |
| --- | --- | --- | --- |
| | Done/Changed/Skipped | | |

## Acceptance Evidence

| Acceptance criterion or UX/UI state | Evidence | Result |
| --- | --- | --- |
| | | Pass/Fail |

## Automated Checks

| Command/check | Result | Relevant output/notes |
| --- | --- | --- |
| | Pass/Fail/Not run | |

## Manual Checks

| Scenario | Steps/evidence | Result |
| --- | --- | --- |
| | | Pass/Fail |

## Final Safety Review

- State transitions match the approved model.
- Relevant UX Flow transitions, UI states, content, and responsive behavior match the approved UI/UX Design.
- Relevant keyboard, focus, label, and accessibility behavior is verified.
- Actor authorization is enforced.
- Important status and financial actions are audited when required upstream.
- Sensitive values and secrets are not exposed.
- Migration/retry behavior is safe.
- Unrelated user changes are preserved.
- Changed-file list contains only intended work.

## Handoff

```text
Summary:
- ...

Verification:
- ...

Changed files:
- ...

Remaining risks/follow-up:
- ...
```
