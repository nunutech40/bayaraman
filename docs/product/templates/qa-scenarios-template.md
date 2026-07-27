# QA Scenarios Template

Use this template after User Requirements and UI/UX Design are approved. Test observable behavior, business rules, interaction states, and manual operations.

## 1. Document Metadata

```text
Feature/product area:
Version:
Status: Draft / Review / Approved
Source requirements:
Source UI/UX Design:
Source User Journey/UX Flow (traceability gaps only):
Owner:
```

## 2. Coverage Map

| Requirement/UI state ID | Covered by scenario IDs | Coverage status |
| --- | --- | --- |
| | | Covered/Non-UI/Gap |

## 3. Scenario List

Use IDs such as `QA-TRANS-001`.

| ID | Type | Actor | Scenario | Preconditions | Expected result | Priority | Manual/system |
| --- | --- | --- | --- | --- | --- | --- | --- |
| | Happy/Negative/Edge/Recovery/Security/Interaction/Accessibility/Responsive | | | | | P0/P1/P2 | |

## 4. Detailed Scenario

Copy this block for each scenario that needs executable detail.

```text
Scenario ID:
Requirement IDs:
UX Flow IDs:
UI IDs/states:
Title:
Type:
Priority:

Given:
- ...

When:
1. ...

Then:
- ...

Data setup:
- ...

Expected state transition:
<FROM> -> <TO>

Expected audit/notification:
- ...

Cleanup:
- ...
```

## 5. Required Coverage

- Happy path for every primary journey.
- Invalid and missing required input.
- Unauthorized actor action.
- Invalid state transition or repeated action.
- Loading, empty, disabled, error, success, expired, unauthorized, and manual-review UI states where relevant.
- Keyboard/focus, labels/announcements, contrast, and supported responsive layouts where relevant.
- Expiry and time boundary.
- Manual operator success and failure.
- Temporary verification credential invalid, expired, and attempt limit when applicable.
- Financial amount mismatch and settlement failure when applicable.
- Audit trail and sensitive-data handling where required upstream.

## 6. Manual Operation Checks

| Operation | Evidence needed | System record expected | Recovery if operator makes a mistake |
| --- | --- | --- | --- |
| | | | |

## 7. Regression Checklist

- Existing approved journeys still work.
- Approved UX Flow transitions and UI/UX states remain consistent.
- No deprecated terms or state names reappear.
- Manual actions are not shown as automatic.
- Important status or financial actions remain auditable when required.
- No unrelated role gains access.

## 8. Exit Criteria

- Every must-have requirement and critical UI state has at least one positive and one relevant negative scenario.
- P0 scenarios pass.
- Known gaps have an owner and decision.
- Test evidence is recorded.
