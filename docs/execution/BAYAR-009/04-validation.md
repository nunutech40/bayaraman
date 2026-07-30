# Execution And Validation: BAYAR-009

## Execution Record

```text
Ticket: BAYAR-009 - Complaint Hold and External Settlement Recording
Plan: docs/execution/BAYAR-009/02-plan.md
Started: 2026-07-30
Completed: 2026-07-30
Status: Passed
```

## Implemented Changes

| Planned step | Result | Files changed | Deviation/reason |
| --- | --- | --- | --- |
| Complaint persistence and migration | Done | `src/server/db/schema.ts`, `drizzle/0010_bayar009_complaint_handoff.sql`, `drizzle/meta/_journal.json` | `current_event_id` remains nullable during the case/event insert cycle and is populated before the service transaction commits. A database `NOT NULL` constraint would make that atomic creation cycle impossible. |
| Assignment and complaint contracts | Done | `src/server/complaint/contracts.ts`, `src/server/complaint/service.ts` | Active assignments are provisioned manually or through test fixtures. Assignment-management UI remains out of scope. |
| Append-only evidence and no-agreement | Done | `src/server/complaint/service.ts`, migration triggers | Corrections append an event and move the case pointer without replaying a transaction transition. |
| Versioned agreement and two-Admin approval | Done | `src/server/complaint/service.ts`, schema and migration | Agreement outcome and amounts are server-derived from frozen terms/destinations except validated split portions. |
| Single-consumption handoff | Done | `src/server/complaint/handoff.ts`, schema and migration | Repository contract is published for BAYAR-008; BAYAR-009 does not create a financial operation. |
| Admin and participant APIs | Done | `src/app/api/admin/transactions/[id]/complaints/`, `src/app/api/transactions/[id]/complaint/route.ts` | Participant projection intentionally excludes evidence, amounts, destinations, Admin identity, and approval detail. |
| Mobile-width UI states | Done | `src/app/admin/complaints/page.tsx`, `src/components/admin/complaint-operations.tsx`, `src/components/transactions/status.tsx`, `src/app/globals.css` | UI-SCR-018/019 expose handoff eligibility only; there is no money action. |
| Active hold regression guard | Done | `src/server/confirmation/service.ts` | Resolved complaint history no longer blocks confirmation; only an active complaint does. |
| Automated coverage | Done | `tests/unit/complaint.test.ts`, `tests/integration/complaint.test.ts` | PostgreSQL integration tests use the local OrbStack database via a temporary `TEST_DATABASE_URL` mapping. |

## Acceptance Evidence

| Acceptance criterion or UX/UI state | Evidence | Result |
| --- | --- | --- |
| Eligible pre-processing complaint creates `PAYOUT_ON_HOLD` | Integration test starts from `PAYMENT_CONFIRMED` and verifies state/version transition | Pass |
| Post-processing complaint is record-only | Integration test preserves `PAYOUT_PROCESSING` and state version | Pass |
| No written agreement creates no payout/refund/split | Integration test reaches `MANUAL_REVIEW_REQUIRED` and verifies zero `financial_operations` | Pass |
| Agreement requires two distinct assigned Admin accounts | Integration test verifies first approval remains pending and second approval publishes the handoff | Pass |
| Agreement uses frozen amount and destination boundary | Seller-release test derives IDR 110,000 from frozen item plus shipping and verifies zero Buyer amount | Pass |
| Handoff does not execute money movement | Approved outcome creates one handoff and zero financial operations | Pass |
| Handoff snapshot is immutable | PostgreSQL trigger rejects direct amount mutation | Pass |
| Evidence correction is append-only | Integration test retains original event and appends `EVIDENCE_CORRECTED` | Pass |
| Assignment boundary is enforced | Unassigned Admin is rejected with `COMPLAINT_ASSIGNMENT_REQUIRED` | Pass |
| Participant projection is masked | Integration test confirms no WhatsApp evidence reference or raw account number is returned | Pass |
| UI-SCR-017 and participant status compile | Production build includes `/admin/complaints` and participant complaint API | Pass |
| Existing confirmation honors only active hold | Full BAYAR-007 regression suite passes after active-case guard update | Pass |

## Automated Checks

| Command/check | Result | Relevant output/notes |
| --- | --- | --- |
| Full PostgreSQL test suite | Pass | 16 files, 46 tests passed; no skipped tests |
| `npm run typecheck` | Pass | Serial run after production build completed |
| `npm run lint` | Pass | No ESLint warnings or errors |
| `npm run build` | Pass | 20 static/dynamic routes generated; new complaint routes compiled |
| `npx drizzle-kit check` | Pass | Schema consistency reported as valid |
| Main database migration | Pass | Migration `0010` applied successfully |
| Clean database migration | Pass | All migrations applied to a fresh temporary PostgreSQL database |
| Migration rerun | Pass | Second migration run completed without applying duplicate DDL |
| PostgreSQL healthcheck | Pass | OrbStack container reported `healthy` on port 54329 |
| `git diff --check` | Pass | No whitespace errors |

The first parallel typecheck overlapped with `next build` replacing
`.next/types` and reported missing generated files. The required serial
typecheck after build passed; this was a command-order race, not a source-code
failure.

## Manual Checks

| Scenario | Steps/evidence | Result |
| --- | --- | --- |
| Production page smoke test | Started production build on port 3005 and requested `/admin/complaints` | Pass (`200`) |
| Unauthorized participant API | Requested participant complaint endpoint without a session | Pass (`401`) |
| No financial controls in complaint UI | Reviewed rendered component contract and production route output | Pass |
| Mobile-width shell and labelled controls | Complaint screen uses existing `app-shell`, semantic labels, disabled/loading/error/status states | Pass |

## Final Safety Review

- State transitions use only approved transaction states.
- Complaint lifecycle, agreement status, approval decision, and assignment
  scope remain internal metadata rather than new product roles or states.
- Product roles remain Buyer, Seller, and Admin.
- Midtrans remains the payment authority; BAYAR-009 does not alter payment
  reconciliation.
- No payout, refund, split, cancellation, risk, OTP, or WhatsApp API execution
  was added.
- All complaint authority rows use restrictive references, append-only guards,
  immutable final agreement behavior, or the one-time handoff claim guard.
- Financial handoff approval, transaction mutation, event, audit, and
  idempotency result are committed atomically.
- Raw bank values and raw complaint evidence are absent from participant DTOs,
  logs, and audit payloads.
- Unrelated untracked `docs/execution/BAYAR-008/` content was preserved.

## Handoff

```text
Summary:
- BAYAR-009 complaint intake, hold, correction, no-agreement, written
  agreement, two-Admin approval, participant summary, and immutable financial
  handoff are implemented.
- Complaint adjudication remains outside BayarAman.
- Approved agreement creates a handoff only; no money is moved.

Verification:
- 46/46 tests passed against PostgreSQL.
- Typecheck, lint, production build, Drizzle check, clean migration, migration
  rerun, PostgreSQL healthcheck, API smoke test, and git diff check passed.

Changed files:
- Migration/schema and complaint domain modules.
- Admin/participant complaint APIs and mobile-width UI.
- Confirmation active-hold guard.
- Unit/integration tests and this validation record.

Remaining risks/follow-up:
- Production needs a controlled provisioning process for
  COMPLAINT_INTAKE/COMPLAINT_APPROVAL assignments; MVP local/test provisioning
  is manual and intentionally has no management UI.
- BAYAR-008 must consume the published handoff using the caller-owned database
  transaction and must not recreate complaint authority rules.
- A signed-in browser walkthrough with two separately assigned Admin accounts
  remains useful before release, although route, build, authorization, and
  integration behavior are validated.
```
