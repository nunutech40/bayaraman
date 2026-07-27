# Engineering Ticket

## Ticket

~~~text
ID: BAYAR-012
Title: Background Jobs, Notifications, Audit, and SLA Infrastructure
Type: Chore
Priority: P0
Owner: Engineering
Status: Draft
Depends on: BAYAR-001, BAYAR-004, BAYAR-005, BAYAR-007, BAYAR-008, BAYAR-010
Blocks: None
Source requirement IDs: UR-SYSTEM-004, UR-SYSTEM-005, UR-SYSTEM-006, UR-SYSTEM-007, UR-SYSTEM-008, UR-SYSTEM-009, UR-SYSTEM-010, UR-SYSTEM-011, UR-BR-009, UR-BR-010, UR-BR-014, UR-BR-025, UR-BR-036, UR-BR-043, UR-BR-044
Source UX Flow IDs: UX-FLOW-045, UX-FLOW-046, UX-FLOW-048, UX-FLOW-049, UX-FLOW-050, UX-FLOW-051, UX-FLOW-052, UX-FLOW-053, UX-FLOW-071, UX-FLOW-072, UX-FLOW-073, UX-FLOW-074, UX-FLOW-075
Source UI IDs/states: UI-SCR-009, UI-SCR-012, UI-SCR-015, UI-SCR-022
Source QA scenario IDs: QA-EXP-001, QA-EXP-002, QA-EXP-003, QA-EXP-004, QA-SLA-001, QA-SLA-002, QA-NOTIFY-001, QA-SEC-004, QA-SEC-005, QA-UI-006
Source technical design section: TRD Sections 5, 8, 10, 13, 14, 15
~~~

## Outcome

Provide rerunnable jobs, capped notifications, append-only audit, and WIB SLA
tracking without converting timeout or delivery failure into a financial
success.

## In Scope

- Invoice expiry at the absolute 1x24-hour deadline and no-revival guard.
- Midtrans reconciliation SLA of two operating hours, Admin hours 09:00-21:00
  WIB, confirmation reminder/overdue, funded-cancellation timeout, payout and
  refund/split target tracking, and daily escalation reminders.
- Maximum three notification attempts, delivery result/audit, job correlation,
  idempotency, and secured Admin task/query boundary.
- Lazy/deterministic scheduler boundary suitable for local and production
  deployment without requiring a new product role or transaction state.

## Out Of Scope

WhatsApp API, provider parsing, financial execution, and new feature screens.

## Acceptance Criteria

- Each due job uses an atomic conditional update with state/version/deadline
  guards; reruns create no duplicate transition or audit event.
- Operating-hour timers pause outside 09:00-21:00 WIB; timeout creates a
  reminder or `MANUAL_REVIEW_REQUIRED` only where approved, never a financial
  success.
- Notification delivery is attempted at most three times; final failure is
  visible/audited to Admin and never changes transaction state.
- Same correlation/idempotency key returns the original job/audit result;
  append-only corrections preserve prior evidence.

## Verification

Run QA-EXP-001..004, QA-SLA-001..002, QA-NOTIFY-001, QA-SEC-004..005, and
QA-UI-006 with fixed clocks, WIB boundary, duplicate jobs, outage, retry,
notification failure, and audit immutability.

## Definition Of Done

Only valid UI screen/state references and approved status vocabulary are used;
the ticket stays Draft.
