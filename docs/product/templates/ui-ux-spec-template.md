# UI/UX Design Specification Template

Use this template after UX Flow and User Requirements are approved. Define a reviewable experience contract before QA scenarios, technical design, or implementation.

## 1. Document Control

```text
Product/feature:
Version:
Status: Draft / Review / Approved
Owner/designer:
Last updated:
Source UX Flow:
Source User Requirements:
Wireframe/prototype reference:
```

## 2. Experience Scope

```text
Target actors:
Platforms:
Supported viewport/device classes:
Included UX Flow IDs:
Included User Requirement IDs:
Excluded experience areas:
```

## 3. Design Principles And Constraints

- Product-specific usability principles.
- Operational/manual-work constraints.
- Content, accessibility, privacy, or device constraints.
- Existing design-system rules that must be preserved, if any.

Do not use this section to add unapproved product behavior.

## 4. Information Architecture And Navigation

| Area | Actor | Contains | Entry method | Exit/next area |
| --- | --- | --- | --- | --- |
| | | | | |

Add a sitemap or navigation diagram when it improves clarity.

## 5. Screen Inventory

Use stable IDs such as `UI-SCR-001`, `UI-MOD-001`, and `UI-MSG-001`.

| UI ID | Screen/component | Actor | Purpose | Source UX IDs | Source requirement IDs |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

## 6. Screen Specification

Repeat this block for every screen or substantial modal.

### `<UI ID>: <Screen Name>`

```text
Purpose:
Allowed actors:
Entry conditions:
Source UX Flow IDs:
Source requirement IDs:
```

**Content and hierarchy**

- Primary information:
- Secondary information:
- Status/help content:

**Fields and displayed data**

| Element/field | Type | Required? | Editable by | Validation/content rule | Sensitive/masked? |
| --- | --- | --- | --- | --- | --- |
| | | Yes/No | | | Yes/No |

**Actions and navigation**

| Action | Actor | Enabled when | Result/feedback | Destination UI ID |
| --- | --- | --- | --- | --- |
| | | | | |

**States**

| State | Trigger | What is shown | Available recovery/action |
| --- | --- | --- | --- |
| Default | | | |
| Loading | | | |
| Empty | | | |
| Error | | | |
| Success | | | |
| Disabled | | | |
| Expired | | | |
| Unauthorized | | | |
| Manual review | | | |

Remove states that genuinely do not apply; do not leave relevant states implicit.

## 7. Cross-Screen Interactions And Feedback

| Trigger | UI response | Status feedback | Notification/channel | Retry or next action |
| --- | --- | --- | --- | --- |
| | | | | |

## 8. Role Visibility, Privacy, And Safety

| Data/action | Visible to | Hidden/masked from | Reason/source ID |
| --- | --- | --- | --- |
| | | | |

Record confirmation, destructive-action, financial, and sensitive-data safeguards where required upstream.

## 9. Responsive And Accessibility Specification

| Area/UI ID | Small viewport behavior | Large viewport behavior | Keyboard/focus | Label/contrast/announcement needs |
| --- | --- | --- | --- | --- |
| | | | | |

## 10. Content And Terminology

| UI ID | Element | Approved copy/intent | Dynamic values | Error/help copy |
| --- | --- | --- | --- | --- |
| | | | | |

## 11. Wireframe Or Prototype References

| UI/flow IDs | Artifact/link | Fidelity | What must be reviewed | Status |
| --- | --- | --- | --- | --- |
| | | Low/Mid/High | | Draft/Reviewed |

A prototype demonstrates this approved specification. Prototype behavior does not become a requirement unless it is recorded here and traced upstream.

## 12. Usability Review Scenarios

| Review ID | Actor/task | Starting point | Success signal | Observed issue/decision |
| --- | --- | --- | --- | --- |
| | | | | |

## 13. Traceability

| UX Flow ID | Requirement IDs | UI IDs/states | Coverage |
| --- | --- | --- | --- |
| | | | Covered/Non-UI/Gap |

## 14. Open Decisions

| Decision | Impact | Owner | Needed before |
| --- | --- | --- | --- |
| | | | QA/Technical Design/Implementation |

## 15. Design Approval Checklist

- Relevant UX Flow and User Requirement IDs are traced.
- Screens, data, actions, permissions, and navigation are explicit.
- Relevant default, loading, empty, error, success, disabled, expired, unauthorized, and manual-review states are defined.
- Manual and external-channel handoffs remain visible.
- Responsive, accessibility, privacy, and sensitive-data constraints are reviewable.
- Wireframe/prototype matches the specification and adds no hidden product rules.
- Owner reviewed the experience and changed status to `Approved`.
