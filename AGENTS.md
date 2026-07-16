# BayarAman Agent Operating Manual

This file is the first context an AI coding agent should read when working on BayarAman.

Purpose:

- Keep work consistent across Codex, Claude Code, Cursor, HumanLayer, or manual agent sessions.
- Avoid rereading every long document for every task.
- Provide the compact source of truth, workflow rules, and task-specific reading map.

HumanLayer login is not required to use this file. HumanLayer is optional orchestration only.

## Project Summary

BayarAman is a rekber-style trust layer for transactions outside marketplaces.

BayarAman is not:

- marketplace
- wallet
- payment gateway
- automated payout system

Current MVP direction:

- Manual payment collection to BayarAman's bank account.
- Buyer clicks `Sudah Bayar`.
- Admin manually checks incoming payment.
- Admin creates WhatsApp group.
- Admin announces payment received in the group.
- Seller ships goods/service.
- Seller and buyer report completion in the group.
- Admin sends buyer confirmation link.
- Buyer confirms via OTP to email or WhatsApp.
- Admin manually transfers payout to seller.
- Buyer-seller complaints are handled outside the system during MVP.
- Unpaid transactions expire after 1x24 hours.

## Source of Truth

Read only the files needed for the task.

Always read:

- `AGENTS.md`

Read by task type:

| Task type | Also read |
| --- | --- |
| Product/flow changes | `README.md`, `PRD.md`, `TRD.md` |
| Frontend/prototype/app UI | `README.md`, `PRD.md`, `TRD.md`, `prototype/` |
| Auth/roles/permissions | `AUTH.md`, `DATABASE.md` |
| Database/schema | `DATABASE.md`, `TRD.md` |
| API/state transitions | `TRD.md`, `DATABASE.md` |
| Manual payment/admin ops | `TRD.md`, `DATABASE.md`, `PRD.md` |
| HumanLayer/task workflow | `.humanlayer/workflow.md`, `.humanlayer/tasks.md` |

Avoid loading all docs unless the task touches multiple domains.

## Latest User Journey

### Seller as Input User

```text
seller -> bikin transaksi di BayarAman
buyer -> bayar ke rekening BayarAman
buyer -> klik Sudah Bayar
admin -> cek pembayaran
admin -> buat group WA
admin -> info di group pembayaran masuk
seller -> kirim barang
seller & buyer -> info kalau pesanan selesai
admin -> kirim link konfirmasi di group
buyer -> klik link konfirmasi
buyer -> OTP ke email atau WhatsApp
admin -> transfer uang ke seller
```

### Buyer as Input User

```text
buyer -> bikin transaksi di BayarAman dan masukin no rek seller
buyer -> bayar ke rekening BayarAman
buyer -> klik Sudah Bayar
admin -> cek pembayaran
admin -> buat group WA
admin -> info di group pembayaran masuk
seller -> kirim barang
seller & buyer -> info kalau pesanan selesai
admin -> kirim link konfirmasi di group
buyer -> klik link konfirmasi
buyer -> OTP ke email atau WhatsApp
admin -> transfer uang ke seller
```

## Role Model

Global/internal roles:

- `USER`
- `ADMIN`
- `FINANCE`
- `SUPER_ADMIN`

Transaction roles:

- `BUYER`
- `SELLER`

Important rule:

- Buyer/seller are per-transaction roles, not global account types.
- A user can be buyer in one transaction and seller in another.

## State Model

Core happy path:

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
```

Important alternate states:

```text
PAYMENT_EXPIRED
PAYMENT_INVALID
MANUAL_REVIEW
ISSUE_REPORTED
REFUND_PENDING
REFUNDED
SPLIT_SETTLEMENT
CANCELLED
PAYOUT_FAILED
```

Do not use older states such as:

- `FUNDS_SECURED`
- `DELIVERED`
- `PAYMENT_PENDING`
- `PAYMENT_SESSION_CREATED`
- `WAITING_SELLER_ACCEPTANCE`
- `IN_FULFILLMENT`

## Critical Business Rules

- Buyer `Sudah Bayar` is only a claim.
- Payment is confirmed only after admin review.
- Seller should ship only after admin announces payment received in WhatsApp group.
- Payout should happen only after buyer confirmation with OTP, unless a manual override/outcome exists.
- Complaint/dispute handling is outside the MVP system.
- The system records final outcome only: release, refund, split, cancelled.
- Payment expiry is 1x24 hours after transaction becomes payable.
- Store seller bank snapshots for payout records.
- Financial records should not be hard-deleted.
- Important state/financial actions must be audit-logged.

## Implementation Workflow

Use this for every coding task.

### 1. Plan

Before editing:

1. Restate the task.
2. Identify the task type.
3. Read only the relevant docs from the reading map.
4. List in-scope and out-of-scope.
5. Identify affected state transitions and data models.
6. Write a short 3-7 step plan.

### 2. Execute

During coding:

- Keep changes tightly scoped.
- Prefer existing project patterns.
- Avoid unrelated refactors.
- Do not touch infographic files unless explicitly asked.
- Do not introduce payment gateway/Midtrans into MVP.
- Do not build in-app dispute workflow unless explicitly asked.
- Keep manual admin operations explicit in UI/state.

### 3. Verify

Run the strongest available checks.

If Next.js/app exists:

```bash
npm run lint
npm run typecheck
npm test
```

If only prototype exists:

```bash
node --check prototype/app.js
```

If checks cannot run, state why.

### 4. Handoff

Final task response should include:

- Summary
- Verification
- Changed files
- Any remaining risk or follow-up

## Current Repo Status

As of this manual:

- Repo is product definition + static prototype.
- No real Next.js application exists yet.
- Static prototype lives in `prototype/`.
- GitHub Pages prototype URL:
  `https://nunutech40.github.io/bayaraman/prototype/`

## Recommended Implementation Order

1. Scaffold Next.js + TypeScript app.
2. Port prototype into real routes/components.
3. Add database schema with Prisma or Drizzle.
4. Implement transaction creation.
5. Implement buyer `Sudah Bayar` claim.
6. Implement admin manual payment review.
7. Implement WhatsApp ops tracking.
8. Implement buyer confirmation link + OTP.
9. Implement manual payout recording.
10. Implement payment expiry job.

## HumanLayer Notes

HumanLayer is optional. The project can be worked on without logging in to HumanLayer.

If HumanLayer auth works:

- Use `.humanlayer/workspace.json` for task worktrees.
- Use `.humanlayer/workflow.md` for planning/execution workflow.
- Use `.humanlayer/tasks.md` for task roadmap.

If HumanLayer auth is down:

- Use `AGENTS.md` directly with Codex or another coding agent.
- Optionally create manual worktrees/branches with `git worktree`.

