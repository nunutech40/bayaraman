# BayarAman Product And Engineering Workflow

This repository-local workflow gives each product and engineering stage its own artifact and template. It requires no HumanLayer login.

## Workflow Map

```text
PRODUCT
Product Brief
-> User Journey
-> UX Flow
-> User Requirements
-> UI/UX Design
-> QA Scenarios
-> PRD

ENGINEERING
Technical Design
-> Engineering Tickets

EXECUTION PER TICKET
Codebase Research
-> Implementation Plan
-> Plan Review
-> Implementation
-> Validation And Handoff
```

## Operating Rules

- Run one stage at a time unless the owner explicitly requests more.
- The next stage reads only the minimal approved upstream set named in its context contract, not the whole project history.
- A draft does not become a source until the owner approves it.
- Do not automatically update downstream artifacts when an upstream artifact changes.
- Preserve stable Journey, UX Flow, requirement, UI/UX, and QA IDs through downstream artifacts, tickets, and validation.
- Keep manual operations and system records visibly separate.
- Put unanswered decisions at the first stage that truly needs them.
- If a later stage exposes a missing upstream rule, return that decision to the owning artifact and re-approve it; do not hide a new product rule in UX, QA, technical design, or code.
- Never read `docs/archive/` unless historical reconciliation is explicitly requested.

## Source Isolation

### Product Brief Only

Product Brief may use:

1. Latest product-owner direction.
2. `requirenment/README.md` as the baseline index.
3. The baseline files selected from that index for the requested Product Brief.
4. The Product Brief template.

Detailed conflicts from a one-time legacy migration belong in an archived audit, not in the active brief.

### After Product Brief Approval

The `requirenment/` folder, prototype, and archive leave the normal downstream context. Each stage reads only the approved artifacts named in its context contract, its template, and any specifically referenced IDs.

## Artifact Map

| Stage | Template | Output |
| --- | --- | --- |
| Product Brief | `docs/product/templates/product-brief-template.md` | `docs/product/00-product-brief.md` |
| User Journey | `docs/product/templates/user-journey-template.md` | `docs/product/01-user-journey.md` |
| UX Flow | `docs/product/templates/ux-flow-template.md` | `docs/product/02-ux-flow.md` |
| User Requirements | `docs/product/templates/user-requirements-template.md` | `docs/product/03-user-requirements.md` |
| UI/UX Design | `docs/product/templates/ui-ux-spec-template.md` | `docs/product/04-ui-ux-spec.md` |
| QA Scenarios | `docs/product/templates/qa-scenarios-template.md` | `docs/product/05-qa-scenarios.md` |
| PRD | `docs/product/templates/prd-template.md` | `PRD.md` |
| Technical Design | `docs/engineering/templates/tech-doc-template.md` | `TRD.md`, plus `DATABASE.md`/`AUTH.md` only when needed |
| Engineering Ticket | `docs/engineering/templates/ticket-template.md` | `docs/engineering/tickets/<ticket-id>.md` |
| Codebase Research | `docs/execution/templates/codebase-research-template.md` | `docs/execution/<ticket-id>/01-research.md` |
| Implementation Plan | `docs/execution/templates/implementation-plan-template.md` | `docs/execution/<ticket-id>/02-plan.md` |
| Plan Review | `docs/execution/templates/plan-review-template.md` | `docs/execution/<ticket-id>/03-plan-review.md` |
| Validation | `docs/execution/templates/execution-validation-template.md` | `docs/execution/<ticket-id>/04-validation.md` |

Output paths are conventions. Do not create empty artifacts for stages that have not started.

## Phase 1: Product

### 0. Product Brief

Purpose: reduce raw direction and baseline material into confirmed MVP intent, actors, boundaries, rules, and correctly deferred decisions.

Read:

- Sources listed under `Product Brief Only` above.

Output:

- `docs/product/00-product-brief.md`

Gate:

- No unresolved decision required to describe chronological User Journeys.
- Owner changes status to `Approved`.

### 1. User Journey

Purpose: describe chronological actions for every actor, including system actions, manual actions, data handoffs, status checkpoints, and alternate paths.

Read only:

- `AGENTS.md`
- Approved `docs/product/00-product-brief.md`
- `docs/product/templates/user-journey-template.md`

Output:

- `docs/product/01-user-journey.md`

Gate:

- Each journey has a clear trigger, end state, actor ownership, manual boundary, and unresolved questions.
- Owner approves it.

### 2. UX Flow

Purpose: map approved chronological journeys into experience nodes, screen-to-screen transitions, decisions, channel changes, recovery paths, and manual handoffs before detailed requirements or visual design.

Read only:

- `AGENTS.md`
- Approved `docs/product/00-product-brief.md`
- Approved `docs/product/01-user-journey.md`
- `docs/product/templates/ux-flow-template.md`

Output:

- `docs/product/02-ux-flow.md`

Gate:

- Every meaningful Journey step maps to a stable UX Flow ID, an explicit manual/outside-system handoff, or an explicit non-UI step.
- Entry points, decisions, alternate paths, expiry/recovery, and end states are visible.
- The flow does not invent product policy or final visual styling.
- Owner approves it.

### 3. User Requirements

Purpose: convert approved journey steps into testable user needs, permissions, required data, rules, and exceptions.

Read only:

- `AGENTS.md`
- Approved `docs/product/01-user-journey.md`
- Approved `docs/product/02-ux-flow.md`
- `docs/product/templates/user-requirements-template.md`

Output:

- `docs/product/03-user-requirements.md`

Gate:

- Every meaningful Journey and UX Flow step maps to a requirement, manual operation, or explicit non-scope item.
- Decisions marked `Needed by User Requirements` are resolved.
- Owner approves it.

### 4. UI/UX Design

Purpose: define the information architecture, screens, content, fields, actions, permissions, interaction states, responsive behavior, and reviewed wireframe/prototype needed to implement the approved flow and requirements.

Read only:

- `AGENTS.md`
- Approved `docs/product/02-ux-flow.md`
- Approved `docs/product/03-user-requirements.md`
- `docs/product/templates/ui-ux-spec-template.md`

Output:

- `docs/product/04-ui-ux-spec.md`
- Wireframes or an interactive prototype only when useful, linked from the specification.

Gate:

- Each relevant UX Flow and User Requirement ID maps to a screen, state, interaction, manual handoff, or explicit non-UI behavior.
- Default, loading, empty, error, success, disabled, expired, unauthorized, and manual-review states are handled where relevant.
- Role visibility, sensitive data, responsive behavior, accessibility constraints, and content are reviewable.
- Owner reviews the wireframe/prototype and approves the specification.

### 5. QA Scenarios

Purpose: expose missing policy and experience gaps through happy, negative, edge, recovery, security, interaction-state, and manual-operation scenarios.

Read:

- `AGENTS.md`
- Approved `docs/product/03-user-requirements.md`
- Approved `docs/product/04-ui-ux-spec.md`
- `docs/product/templates/qa-scenarios-template.md`
- Approved User Journey or UX Flow only for a traceability gap.

Output:

- `docs/product/05-qa-scenarios.md`

Gate:

- Every must-have requirement and critical UI state has positive, negative, edge, recovery, security, and manual-operation coverage where relevant.
- Decisions marked `Needed by QA Scenarios` are resolved.
- Owner approves it.

### 6. PRD

Purpose: consolidate approved scope, product rules, priorities, and release acceptance while linking detailed artifacts by ID.

Read:

- `AGENTS.md`
- Approved product artifacts `00` through `05`
- `docs/product/templates/prd-template.md`

Output:

- Create `PRD.md`.

Gate:

- Scope, non-scope, manual operations, risks, success criteria, and release acceptance are agreed.
- Owner approves it.

## Phase 2: Engineering

### 1. Technical Design

Purpose: map approved requirements to architecture, state, data, APIs, authorization, jobs, audit, and tests.

Read:

- `AGENTS.md`
- Approved `PRD.md`
- Relevant requirement, UX Flow, UI/UX, and QA IDs
- Existing application code relevant to the design
- `docs/engineering/templates/tech-doc-template.md`

Output:

- Create `TRD.md`.
- Create `DATABASE.md` or `AUTH.md` only if the design is clearer with separately owned detail.

Gate:

- Technical decisions are traceable to approved product IDs and can be split into bounded tickets.
- Engineering review approves it.

### 2. Engineering Tickets

Purpose: split approved design into independently reviewable implementation units.

Read:

- `AGENTS.md`
- Approved technical-design section
- Relevant requirement, UX Flow, UI/UX, and QA IDs
- `docs/engineering/templates/ticket-template.md`

Output:

- `docs/engineering/tickets/<ticket-id>.md`

Gate:

- Every ticket has bounded scope, source IDs, acceptance criteria, impact map, dependencies, and verification.

Implementation order is decided from the approved technical design, not inherited from an old roadmap.

## Phase 3: Execution Per Ticket

Run these stages independently for each ticket so a coding session never needs the entire product context.

### 1. Codebase Research

Read the selected ticket, affected code/tests, referenced requirement/UX/UI/QA IDs, and the research template. Record current behavior, local patterns, constraints, and likely change surface.

Create `01-research.md` for substantial work; keep the same structure in-session for a tiny task.

### 2. Implementation Plan

Map every ticket acceptance criterion and relevant approved UI/UX state to exact code changes and verification. Create `02-plan.md` for substantial work.

### 3. Plan Review

Review correctness, approved UX behavior, authorization, state/data safety, money handling, manual boundaries, failures, tests, and unintended scope. Revise until the decision is `Approved`. Create `03-plan-review.md` when durable review is useful.

### 4. Implementation

Implement only the approved ticket scope. Preserve user changes and document meaningful deviations from the plan.

### 5. Validation And Handoff

Validate the ticket acceptance criteria, referenced QA cases, and relevant approved UX/UI states. Check role permissions, state transitions, financial records, secrets, responsive behavior where relevant, and unrelated diffs. Create `04-validation.md` when durable evidence is useful.

For the current prototype:

```bash
node --check prototype/app.js
```

Use the real application scripts once an application exists.

## Human Checkpoints

Required approval points:

1. Each product artifact before it becomes upstream context.
2. UX Flow before detailed requirements and UI/UX Design before QA or implementation planning.
3. Technical Design before tickets are created.
4. Implementation plan before substantial or high-risk coding.
5. Diff and validation before merge or deployment.

## Invocation

With the local skill:

```text
Use $bayaraman-workflow. Product Brief sudah saya approve. Buat User Journey saja.
```

```text
Use $bayaraman-workflow. User Journey sudah saya approve. Buat UX Flow saja; jangan buat wireframe dulu.
```

```text
Use $bayaraman-workflow. User Requirements dan UX Flow sudah saya approve. Buat UI/UX Design Spec dan wireframe saja.
```

Without skill support:

```text
Read AGENTS.md and WORKFLOW.md. Jalankan tahap <nama tahap> saja.
```
