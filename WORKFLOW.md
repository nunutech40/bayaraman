# BayarAman Workflow

This is the reusable workflow for building BayarAman with AI agents or humans.

Goal:

- Keep the work structured.
- Avoid loading the whole project context for every task.
- Start from product clarity before engineering.
- Execute tickets safely without damaging unrelated work.

## Phase 1: Product

Use this phase when the flow, user needs, or requirements are still being shaped.

### 1. User Journey

Output:

- Clear step-by-step journey for each actor.
- Actor ownership: buyer, seller, admin/operator.
- Manual steps explicitly marked.

BayarAman current journeys:

- Seller input journey.
- Buyer input journey.
- Admin/operator manual journey.
- Buyer confirmation journey.

Read:

- `AGENTS.md`
- `README.md`
- `PRD.md`

### 2. User Requirement

Output:

- What each actor needs to do.
- What data each actor must input.
- What the system must store.
- What is manual vs system-supported.

Read:

- `AGENTS.md`
- `PRD.md`
- `AUTH.md` if permissions/roles are involved.
- `DATABASE.md` if persisted data is involved.

### 3. QA List / Scenario

Output:

- Happy path scenarios.
- Failed/edge scenarios.
- Manual operation scenarios.
- Acceptance checks.

Minimum BayarAman scenarios:

- Seller creates transaction, buyer pays, admin confirms, seller ships, buyer OTP, admin payout.
- Buyer creates transaction with seller bank, buyer pays, admin confirms, seller ships, buyer OTP, admin payout.
- Buyer clicks `Sudah Bayar` but admin cannot find payment.
- Transaction is unpaid for 1x24 hours and expires.
- Buyer OTP fails.
- Admin records refund/split/cancel final outcome after external complaint handling.

Read:

- `AGENTS.md`
- `PRD.md`
- `TRD.md`

### 4. PRD

Output:

- Final product requirement.
- Scope and non-scope.
- Actor flows.
- Business rules.
- Acceptance criteria.

Read/update:

- `PRD.md`

## Phase 2: Engineering

Use this phase after product flow is stable enough to build.

### 1. Tech Doc

Output:

- Architecture.
- State model.
- API surface.
- Data model.
- Background jobs.
- External/manual operation boundaries.

Read/update:

- `TRD.md`
- `DATABASE.md`
- `AUTH.md`

### 2. Tickets

Output:

- Small implementation tickets.
- Each ticket should be independently reviewable.
- Each ticket should name its source docs and acceptance criteria.

Current recommended ticket order:

1. Scaffold Next.js + TypeScript app.
2. Port prototype into real app routes/components.
3. Add database schema with Prisma or Drizzle.
4. Implement seller-created and buyer-created transaction creation.
5. Implement buyer `Sudah Bayar` payment claim.
6. Implement admin manual payment review.
7. Implement WhatsApp ops tracking.
8. Implement buyer confirmation link + OTP.
9. Implement manual payout recording.
10. Implement payment expiry job.

Read:

- `AGENTS.md`
- `TRD.md`
- `DATABASE.md`
- `.humanlayer/tasks.md` if using HumanLayer-style task list.

## Phase 3: Execution Per Ticket

Use this phase for every coding ticket.

### 1. Research Codebase

Do:

- Read `AGENTS.md`.
- Read only task-relevant docs from the map below.
- Inspect existing files before editing.
- Check git status.

Context map:

| Ticket area | Read |
| --- | --- |
| Frontend/UI | `AGENTS.md`, `PRD.md`, `TRD.md`, `prototype/` |
| Auth/roles | `AGENTS.md`, `AUTH.md`, `DATABASE.md` |
| Database | `AGENTS.md`, `DATABASE.md`, `TRD.md` |
| API/state | `AGENTS.md`, `TRD.md`, `DATABASE.md` |
| Payment claim/admin ops | `AGENTS.md`, `TRD.md`, `DATABASE.md`, `PRD.md` |
| Product docs | `AGENTS.md`, `README.md`, `PRD.md` |

### 2. Implementation Plan

Before coding, write:

```text
Task:
<what will be done>

In scope:
- ...

Out of scope:
- ...

Plan:
1. ...
2. ...
3. ...

Verification:
- ...
```

Keep it short. Do not write a thesis.

### 3. Execution

Rules:

- Keep changes scoped to the ticket.
- Do not touch infographic files unless explicitly requested.
- Do not introduce Midtrans/payment gateway into MVP.
- Do not build in-app dispute center unless explicitly requested.
- Do not treat `Sudah Bayar` as payment confirmation.
- Admin review is the payment source of truth.
- Preserve auditability for financial/status actions.

### 4. Validation

Run available checks.

If app exists:

```bash
npm run lint
npm run typecheck
npm test
```

If only prototype exists:

```bash
node --check prototype/app.js
```

Also check:

- Status flow still matches `AGENTS.md`.
- No unrelated files changed.
- No secrets committed.

### 5. Handoff

Final response should include:

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

## How To Use This With An AI Agent

For product work:

```text
Read AGENTS.md and WORKFLOW.md.
Use Phase 1: Product.
Help me produce <User Journey/User Requirement/QA List/PRD>.
```

For engineering planning:

```text
Read AGENTS.md and WORKFLOW.md.
Use Phase 2: Engineering.
Turn the current TRD into implementation tickets.
```

For coding:

```text
Read AGENTS.md and WORKFLOW.md.
Use Phase 3: Execution Per Ticket.
Work on ticket <ticket name>.
```

