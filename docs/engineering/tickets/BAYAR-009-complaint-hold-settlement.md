# Engineering Ticket

## Ticket

~~~text
ID: BAYAR-009
Title: Complaint Hold and External Settlement Recording
Type: Feature
Priority: P0
Owner: Engineering
Status: Draft
Depends on: BAYAR-006
Blocks: BAYAR-008, BAYAR-010, BAYAR-011
Source requirement IDs: UR-PARTICIPANT-004, UR-PARTY-004, UR-ADMIN-012, UR-ADMIN-013, UR-ADMIN-014, UR-BR-017, UR-BR-018, UR-BR-019, UR-BR-023, UR-BR-025, UR-BR-040
Source UX Flow IDs: UX-FLOW-035, UX-FLOW-036, UX-FLOW-037, UX-FLOW-038, UX-FLOW-039, UX-FLOW-040, UX-FLOW-041, UX-FLOW-042
Source UI IDs/states: UI-SCR-017, UI-SCR-018, UI-SCR-019
Source QA scenario IDs: QA-COMPLAINT-001, QA-COMPLAINT-002, QA-COMPLAINT-003, QA-COMPLAINT-004, QA-FIN-005, QA-SEC-003
Source technical design section: TRD Sections 5, 6, 9, 10, 11, 12, 13, 14
~~~

## Outcome

Admin records a complaint reported outside BayarAman, creates `PAYOUT_ON_HOLD`,
and records only a written agreement outcome. The system does not adjudicate
the Buyer-Seller complaint.

## In Scope

- Complaint intake before payout processing and participant-visible summary.
- Raw WhatsApp/evidence reference, checkpoint, immutable correction, and audit.
- Disabled payout/confirmation exception while unresolved.
- Full seller release, full buyer refund, or split handoff to BAYAR-008.
- Two-Admin approval and assignment boundary for controlled financial outcome.

## Out Of Scope

Adjudication, automatic evidence interpretation, reversal after financial
processing, new roles/states, or direct financial execution.

## Acceptance Criteria

- A complaint before payout processing creates `PAYOUT_ON_HOLD` and disables
  payout; complaint after processing is recorded without silent reversal.
- Without written agreement, no refund, payout, or split operation is created.
- A valid agreement with frozen destinations and required approvals creates a
  handoff only; BAYAR-008 owns the financial operation and result.
- Participants see only summary; raw evidence is restricted to assigned Admin.

## Verification

Run QA-COMPLAINT-001..004, QA-FIN-005, and QA-SEC-003, including pre/post-
processing behavior, evidence conflict, approval, masking, and idempotency.
## Definition Of Done

Complaint resolution remains outside the system and the ticket stays Draft until review.
