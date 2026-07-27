# BayarAman Agent Guide

Read this file first. It defines the minimum context and safety rules for AI or human contributors. The workflow is repository-local and needs no HumanLayer account or external login.

## Current Stage

- Active phase: User Requirements review, with a pending upstream cancellation change.
- Approved sources: `docs/product/00-product-brief.md` v0.7, `docs/product/01-user-journey.md` v0.4, and `docs/product/02-ux-flow.md` v0.1.
- Active draft: `docs/product/03-user-requirements.md` v0.2; prior `UR-OD-001` through `UR-OD-012` are confirmed.
- Before approving User Requirements, revise and re-approve Product Brief, User Journey, and UX Flow for cancellation, one stage at a time.
- Do not create UI/UX Design or QA Scenarios until the owner explicitly approves the User Requirements.
- Root `PRD.md`, `TRD.md`, `DATABASE.md`, and `AUTH.md` will be recreated only in their proper workflow stages.
- Pre-workflow versions are archived under `docs/archive/pre-workflow/`.

## Source Precedence

When sources disagree, use this order:

1. Latest explicit product-owner direction.
2. The latest approved active artifact.
3. Baseline drafts in `requirenment/`, only while producing or revising Product Brief.
4. Repository code for current implementation evidence.
5. Prototype and archive only when explicitly requested.

Never read `docs/archive/` automatically. Never let prototype behavior silently become a product requirement.

## Minimal Context Map

Read only the row required by the task.

| Task | Required context |
| --- | --- |
| Select/run a workflow stage | `AGENTS.md`, `WORKFLOW.md` |
| Product Brief | Latest owner direction, `requirenment/README.md`, baseline files selected from that index, and `docs/product/templates/product-brief-template.md` |
| User Journey | `AGENTS.md`, approved `docs/product/00-product-brief.md`, `docs/product/templates/user-journey-template.md` |
| UX Flow | `AGENTS.md`, approved `docs/product/00-product-brief.md`, approved `docs/product/01-user-journey.md`, `docs/product/templates/ux-flow-template.md` |
| User Requirements | `AGENTS.md`, approved `docs/product/01-user-journey.md`, approved `docs/product/02-ux-flow.md`, `docs/product/templates/user-requirements-template.md` |
| UI/UX Design | `AGENTS.md`, approved `docs/product/02-ux-flow.md`, approved `docs/product/03-user-requirements.md`, `docs/product/templates/ui-ux-spec-template.md` |
| QA Scenarios | `AGENTS.md`, approved `docs/product/03-user-requirements.md`, approved `docs/product/04-ui-ux-spec.md`, `docs/product/templates/qa-scenarios-template.md`; open the Journey or UX Flow only for traceability gaps |
| PRD | Approved product artifacts `00` through `05` and PRD template |
| Technical Design | Approved PRD, relevant requirement/UX/UI/QA IDs, technical-design template, affected code |
| Engineering Ticket | Approved technical-design section, relevant requirement/UX/UI/QA IDs, ticket template |
| Execute ticket | Selected ticket, its research/plan, affected code/tests, referenced requirement/UX/UI/QA IDs |
| Prototype-only change | Approved UI/UX Design and relevant requirements plus affected files under `prototype/` |

Do not load every project document for convenience. Refer to stable IDs instead of copying whole upstream artifacts into later files.

## Product Decision Boundary

`AGENTS.md`, `WORKFLOW.md`, templates, and the workflow skill define process only. They must not define BayarAman product behavior.

- During Product Brief, derive product behavior from current owner direction and `requirenment/`.
- After Product Brief approval, use the approved artifact instead of rereading baseline drafts.
- If an approved artifact and a later explicit owner instruction conflict, record the change in the artifact being revised; do not silently alter downstream files.

## Working Rules

- Work on one requested artifact or ticket at a time.
- Use the previous approved artifact as the main input for the next stage.
- Keep drafts marked as drafts until owner approval.
- Do not synchronize downstream artifacts after every edit.
- Record deferred decisions at the stage that actually needs them.
- Keep UX Flow about sequence and handoffs; keep UI/UX Design about screens, states, interaction, content, and reviewed wireframes/prototypes.
- Preserve unrelated changes in a dirty worktree.
- Do not touch infographic files unless explicitly requested.
- Do not infer product rules from archived documents, prototype behavior, workflow examples, wireframes, or templates.

## Coding Execution

For each engineering ticket:

1. Research only the affected code and contract.
2. Write a scoped implementation plan.
3. Review authorization, state/data safety, failures, manual boundaries, and tests.
4. Implement the approved plan.
5. Validate against acceptance criteria and report evidence.

Use durable files under `docs/execution/<ticket-id>/` for substantial work. For small tasks, keep the same structure in the active session.

## Verification

For the current static prototype:

```bash
node --check prototype/app.js
```

When a real application exists, use its actual lint, typecheck, and test scripts.
