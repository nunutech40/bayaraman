# User Journey Template

Use this template after the Product Brief is approved and before writing UX Flow, user requirements, UI/UX Design, QA scenarios, PRD updates, or tickets.

Goal:

- Make actor flow clear.
- Separate system actions from manual actions.
- Identify what data is entered at each step.
- Identify status changes.
- Identify open questions before engineering.

## 1. Document Control

```text
Product/feature:
Version:
Status: Draft / Review / Approved
Owner:
Last updated:
Source Product Brief:
```

## 2. Journey Index

Use a stable Journey ID such as `UJ-SELLER` or `UJ-BUYER`.

| Journey ID | Journey name | Primary actor | Starts when | Ends when |
| --- | --- | --- | --- | --- |
| | | | | |

## 3. Actor Definitions

List actors involved across the journeys.

```text
Actor:
Role in journey:
What they input:
What they expect:
```

## 4. Journey Detail

Repeat sections 4.1 and 4.2 for every Journey ID.

### 4.1 Journey Metadata

```text
Journey ID:
Journey name:
Primary actor:
Supporting actors:
Entry point:
End state:
```

### 4.2 Step-by-Step Journey

Use stable step IDs such as `UJ-SELLER-001` and `UJ-BUYER-001`.

| Step ID | Actor | User action | System action | Manual operation? | Data involved | Status after step | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | Yes/No | | | |

Rules:

- One row = one meaningful step.
- Keep step IDs stable after approval so downstream artifacts can reference them.
- Mark manual operations clearly.
- Do not hide operator or other supporting-actor work.
- Do not merge a user claim with authoritative verification when they are separate events.
- Do not merge a prerequisite confirmation with a later operational or financial action.

## 5. Data Inputs

Repeat this subsection for every actor that enters or changes data.

### `<Actor>` Inputs

- ...

## 6. Status Timeline

Write the status changes only.

```text
DRAFT
-> ...
```

## 7. Notifications / Messages

List user-facing messages by channel.

| Moment | Channel | Recipient | Message intent |
| --- | --- | --- | --- |

## 8. Edge Cases

List likely deviations.

- ...

## 9. Open Questions

List unanswered product/policy decisions.

- ...

## 10. Acceptance Summary

This journey is ready when:

- Actors are clear.
- Required data is clear.
- Manual steps are clear.
- Status changes are clear.
- Edge cases are listed.
- Open questions are explicit.
- Every meaningful step has a stable ID ready for UX Flow traceability.
- Product owner reviewed the journeys and changed status to `Approved`.
