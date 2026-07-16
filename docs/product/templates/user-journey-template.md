# User Journey Template

Use this template before writing user requirements, QA scenarios, PRD updates, or tickets.

Goal:

- Make actor flow clear.
- Separate system actions from manual actions.
- Identify what data is entered at each step.
- Identify status changes.
- Identify open questions before engineering.

## 1. Journey Metadata

```text
Journey name:
Primary actor:
Supporting actors:
Entry point:
End state:
```

## 2. Actor Definitions

List actors involved.

```text
Actor:
Role in journey:
What they input:
What they expect:
```

## 3. Step-by-Step Journey

Use this table.

| Step | Actor | User action | System action | Manual operation? | Data involved | Status after step | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | | | | Yes/No | | | |

Rules:

- One row = one meaningful step.
- Mark manual operations clearly.
- Do not hide admin/operator work.
- Do not merge payment claim and payment confirmation.
- Do not merge buyer confirmation and payout.

## 4. Data Inputs

Group required data by actor.

### Buyer Inputs

- ...

### Seller Inputs

- ...

### Admin/Operator Inputs

- ...

## 5. Status Timeline

Write the status changes only.

```text
DRAFT
-> ...
```

## 6. Notifications / Messages

List user-facing messages by channel.

| Moment | Channel | Recipient | Message intent |
| --- | --- | --- | --- |

## 7. Edge Cases

List likely deviations.

- ...

## 8. Open Questions

List unanswered product/policy decisions.

- ...

## 9. Acceptance Summary

This journey is ready when:

- Actors are clear.
- Required data is clear.
- Manual steps are clear.
- Status changes are clear.
- Edge cases are listed.
- Open questions are explicit.
