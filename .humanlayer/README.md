# HumanLayer Workflow for BayarAman

HumanLayer is used here as the coding workflow layer for BayarAman.

It should create isolated task worktrees and task branches before real implementation work begins.

## Local Setup

Install and authenticate HumanLayer:

```bash
npm install -g @humanlayer/cli@latest
humanlayer login
humanlayer agents auth codex
```

The installed CLI version used when this workflow was added:

```text
humanlayer 0.29.0
```

## Workspace Behavior

Shared config:

```text
.humanlayer/workspace.json
```

Current behavior:

- Creates task worktrees under `~/.humanlayer/workspaces/{{ TASKSLUG }}/{{ REPOBASENAME }}`.
- Creates task branches as `hl/{{ TASKSLUG }}`.
- Uses `main` as the source ref.
- Runs `test -f package.json && npm install || true`.

The setup command is intentionally tolerant because this repo is still in docs/prototype phase. Once the Next.js app exists, replace it with a stricter install command such as:

```json
"setupCommand": "npm install"
```

Local overrides:

```text
.humanlayer/workspace.local.json
```

This file is ignored by git and can be used for machine-specific paths, secrets, copied env files, or local setup commands.

## BayarAman Task Rules

Every HumanLayer coding task should:

1. Follow root `WORKFLOW.md`.
2. Follow `.humanlayer/workflow.md` only for HumanLayer-specific task setup.
3. Read `README.md`, `PRD.md`, `TRD.md`, `AUTH.md`, and `DATABASE.md` only as needed by the task.
3. Treat the latest manual-payment flow as source of truth.
4. Keep buyer/seller as transaction-level roles.
5. Keep admin/finance/super-admin as future global/internal roles.
6. Preserve the rule that payment is only confirmed by admin review, not by buyer clicking `Sudah Bayar`.
7. Preserve 1x24 hour payment expiry for unpaid transactions.
8. Keep buyer-seller complaints outside the MVP system and record only final outcomes.
9. Add or update tests for any implemented business rule.
10. Avoid touching infographic files unless the task explicitly asks for it.

## Suggested First HumanLayer Tasks

Use `tasks.md` as the implementation roadmap.

Use `workflow.md` as the reusable planning and execution workflow.
