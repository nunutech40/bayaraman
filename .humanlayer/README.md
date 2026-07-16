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

1. Read `README.md`, `PRD.md`, `TRD.md`, `AUTH.md`, and `DATABASE.md` first.
2. Treat the latest manual-payment flow as source of truth.
3. Keep buyer/seller as transaction-level roles.
4. Keep admin/finance/super-admin as future global/internal roles.
5. Preserve the rule that payment is only confirmed by admin review, not by buyer clicking `Sudah Bayar`.
6. Preserve 1x24 hour payment expiry for unpaid transactions.
7. Keep buyer-seller complaints outside the MVP system and record only final outcomes.
8. Add or update tests for any implemented business rule.
9. Avoid touching infographic files unless the task explicitly asks for it.

## Suggested First HumanLayer Tasks

Use `tasks.md` as the implementation roadmap.
