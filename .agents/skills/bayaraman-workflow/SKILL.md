---
name: bayaraman-workflow
description: Run BayarAman's staged product, UI/UX, and engineering workflow. Use when creating or updating a product brief, user journey, UX flow, user requirements, UI/UX design specification, wireframe or prototype review, QA scenarios, PRD, technical design, engineering tickets, codebase research, implementation plan, plan review, implementation, validation, or handoff for this repository.
---

# BayarAman Workflow

Run the repository-local workflow without HumanLayer or another orchestration service.

## Start

1. Read `AGENTS.md`.
2. If the stage is explicit, open only its section in `WORKFLOW.md`; read the full map only when the stage must be selected.
3. Identify exactly one requested artifact or ticket stage.
4. Check git status and preserve unrelated changes.
5. Load only the context contract for that stage.

If the user says `next`, select the first incomplete stage in this order:

```text
Product Brief -> User Journey -> UX Flow -> User Requirements
-> UI/UX Design -> QA Scenarios -> PRD
-> Technical Design -> Tickets -> Per-ticket execution
```

Never advance more than one stage unless explicitly requested.

## Context Contract

### Product Brief

- Use latest owner direction as highest priority.
- Read `requirenment/README.md` as the baseline index.
- Read the baseline files needed to produce the requested Product Brief; do not use archive or prototype as substitutes.
- Use the Product Brief template.
- Keep the active brief concise: confirmed direction, MVP scope, boundaries, and decisions deferred to their required stage.
- Do not create a review/conflict log by default. If a one-time legacy migration requires detailed audit, archive it and keep it out of downstream context.

### Product Stages After Product Brief

- Read `AGENTS.md`, only the approved artifacts named for the stage in `WORKFLOW.md`, and the requested template.
- Do not read `requirenment/`, prototype, root legacy docs, or `docs/archive/` automatically.
- Open older upstream artifacts only to resolve a traceability gap.

### UI/UX Stages

- UX Flow translates approved Journey steps into experience nodes, decisions, channel changes, and manual handoffs. It does not choose final styling or add product policy.
- UI/UX Design translates approved UX Flow and User Requirements into information architecture, screens, fields, actions, permissions, states, content, responsive/accessibility constraints, and reviewable wireframes or prototypes.
- A prototype demonstrates the approved UI/UX specification; behavior visible only in a prototype is not a product requirement.
- Stop for owner approval after UX Flow and after UI/UX Design, just like every other product artifact.

### Engineering And Coding

- Read the selected approved design/ticket, referenced requirement/UX/UI/QA IDs, affected code/tests, and the requested template.
- Do not load the full product documentation set.
- Create durable research/plan/review/validation files only for substantial or risky work.

## Artifact Rules

- Use the template and output path mapped in `WORKFLOW.md`.
- Keep a new artifact in `Draft` until owner approval.
- Preserve stable Journey, UX Flow, requirement, UI/UX, and QA IDs through downstream artifacts, tickets, and validation.
- Update the mapped output rather than creating duplicates.
- Do not synchronize downstream artifacts unless their stage is requested.
- If a stage exposes a missing upstream rule, revise and re-approve the owning artifact instead of deciding it silently downstream.
- Report the artifact path, verification, and only the decisions that block the next stage.

## Approval Rules

- Pause when an unresolved choice changes approved behavior, money/security policy, architecture, or ticket scope materially.
- Require an approved plan before substantial or high-risk code edits.
- Present validation evidence before merge or deployment.

## Product Decision Boundary

- Do not encode product behavior from this skill, templates, archive, or prototype.
- During Product Brief, derive behavior from current owner direction and `requirenment/`.
- After approval, derive behavior only from the approved input artifacts named for the requested stage.
- Do not touch infographic files unless explicitly requested.

## Finish

State the artifact or code produced, verification performed, files changed, and any decision that truly blocks the next stage.
