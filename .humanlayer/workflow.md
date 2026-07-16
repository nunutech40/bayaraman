# BayarAman Reusable Coding Workflow

Use this workflow for every HumanLayer/Codex coding task in this repository.

The goal is to keep implementation aligned with BayarAman's latest manual rekber flow, while forcing planning, execution, verification, and handoff discipline.

## 0. Source of Truth

Before planning or coding, read these files:

1. `README.md`
2. `PRD.md`
3. `TRD.md`
4. `AUTH.md`
5. `DATABASE.md`
6. `.humanlayer/tasks.md`

Latest product truth:

- Seller or buyer can create a transaction.
- Buyer pays to BayarAman's bank account.
- Buyer clicks `Sudah Bayar`.
- Admin manually checks incoming payment.
- Admin creates WhatsApp group.
- Admin announces payment received in the group.
- Seller ships goods/service.
- Seller and buyer report completion in the group.
- Admin sends buyer confirmation link.
- Buyer confirms with OTP by email or WhatsApp.
- Admin manually transfers payout to seller.
- Complaints are handled outside the system in MVP.
- Unpaid transactions expire after 1x24 hours.

## 1. Planning Phase

Do this before implementation.

### 1.1 Restate Task

Write a short restatement:

```text
Task:
<what this task will implement>
```

### 1.2 Boundaries

Write:

```text
In scope:
- ...

Out of scope:
- ...
```

Default out of scope unless explicitly requested:

- Payment gateway/Midtrans integration.
- Automated payout/disbursement.
- In-app dispute center.
- KYC automation.
- Marketplace/storefront.
- Editing infographic files.

### 1.3 Map to TRD Module

Pick one primary module:

- Auth and Identity
- Transaction
- Manual Payment
- WhatsApp Operations
- Buyer Confirmation
- Manual Outcome and Issue Recording
- Manual Payout
- Payment Expiry

### 1.4 Data and State Impact

List affected entities/statuses.

Expected status model:

```text
DRAFT
WAITING_BUYER_PAYMENT
PAYMENT_UNDER_REVIEW
PAYMENT_CONFIRMED
WA_GROUP_CREATED
PAYMENT_ANNOUNCED
SELLER_SHIPPED
WAITING_BUYER_CONFIRMATION
BUYER_CONFIRMED
PAYOUT_PENDING
PAYOUT_PROCESSING
PAID_OUT
PAYMENT_EXPIRED
PAYMENT_INVALID
MANUAL_REVIEW
ISSUE_REPORTED
REFUND_PENDING
REFUNDED
SPLIT_SETTLEMENT
CANCELLED
```

### 1.5 Implementation Plan

Write 3-7 concrete steps.

Example:

```text
Plan:
1. Add route/action for buyer payment claim.
2. Persist manual_payment_claims record.
3. Move transaction to PAYMENT_UNDER_REVIEW.
4. Write audit log.
5. Add tests for valid claim and invalid status.
```

Do not start coding before this is clear.

## 2. Execution Phase

### 2.1 Code Rules

- Keep implementation scoped to the task.
- Follow existing project patterns.
- Prefer typed, explicit state transitions.
- Do not allow buyer `Sudah Bayar` to confirm payment.
- Payment confirmation must be admin-driven.
- Preserve seller bank snapshots for payout.
- Store tokens/OTPs hashed when persistence exists.
- Audit important financial/status actions.

### 2.2 State Transition Rules

Manual payment:

```text
WAITING_BUYER_PAYMENT
  -> PAYMENT_UNDER_REVIEW
  -> PAYMENT_CONFIRMED
```

WA operations:

```text
PAYMENT_CONFIRMED
  -> WA_GROUP_CREATED
  -> PAYMENT_ANNOUNCED
```

Fulfillment and confirmation:

```text
PAYMENT_ANNOUNCED
  -> SELLER_SHIPPED
  -> WAITING_BUYER_CONFIRMATION
  -> BUYER_CONFIRMED
```

Payout:

```text
BUYER_CONFIRMED
  -> PAYOUT_PENDING
  -> PAYOUT_PROCESSING
  -> PAID_OUT
```

Expiry:

```text
WAITING_BUYER_PAYMENT
  -> PAYMENT_EXPIRED
```

## 3. Verification Phase

Run the strongest available checks.

If app exists:

```bash
npm run lint
npm run typecheck
npm test
```

If app does not exist yet:

```bash
node --check prototype/app.js
```

Also verify:

- The requested flow still matches `TRD.md`.
- No unrelated infographic files were changed.
- No secrets or local-only files were committed.
- `.humanlayer/workspace.local.json` remains untracked/ignored.

## 4. Handoff Phase

End every task with:

```text
Summary:
- ...

Verification:
- ...

Changed files:
- ...

Follow-up:
- ...
```

If something was not run, say why.

## 5. HumanLayer Task Prompt Template

Use this inside HumanLayer task descriptions:

```text
Use .humanlayer/workflow.md.

Task:
<task name>

Goal:
<goal>

Primary TRD module:
<module>

Scope:
- ...

Acceptance criteria:
- ...

Verification:
- Run relevant checks.
- Report anything not run.
```

