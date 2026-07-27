# Engineering Ticket

## Ticket

~~~text
ID: BAYAR-006
Title: WhatsApp Group Operations and Completion Checkpoints
Type: Feature
Priority: P0
Owner: Engineering
Status: Draft
Depends on: BAYAR-005
Blocks: BAYAR-007, BAYAR-009
Source requirement IDs: UR-ADMIN-003, UR-ADMIN-004, UR-ADMIN-005, UR-PARTY-001, UR-PARTY-002, UR-PARTY-003, UR-BR-012, UR-BR-013, UR-BR-023, UR-BR-025, UR-BR-044
Source UX Flow IDs: UX-FLOW-017, UX-FLOW-018, UX-FLOW-019, UX-FLOW-020, UX-FLOW-021, UX-FLOW-022, UX-FLOW-023
Source UI IDs/states: UI-SCR-012, UI-SCR-013
Source QA scenario IDs: QA-WA-001, QA-WA-002, QA-WA-003, QA-WA-004, QA-SEC-003
Source technical design section: TRD Sections 5, 6, 10, 11, 12, 13, 14
~~~

## Outcome

After authoritative Midtrans payment, Admin records the external WhatsApp
group, payment announcement, and two separate completion checkpoints. WhatsApp
messages remain untrusted until an Admin records the checkpoint.

## In Scope

- Group reference, participant snapshot, announcement evidence, and retries.
- Separate Seller shipment/completion and Buyer completion checkpoints.
- Evidence reference, author, timestamp, recorder, immutable snapshot/hash,
  masking, append-only correction, and participant summary views.
- Approved transitions through `READY_FOR_FULFILLMENT`,
  `WAITING_COMPLETION_REPORTS`, `WAITING_OTHER_COMPLETION_REPORTS`, and
  `READY_FOR_BUYER_CONFIRMATION`.

## Out Of Scope

WhatsApp API/parsing, automatic message trust, Seller OTP, payout, complaint
adjudication, and a seven-checkpoint model.

## Acceptance Criteria

- Admin can record a correct group and payment announcement only after
  `PAYMENT_CONFIRMED`; fulfillment remains disabled otherwise.
- Seller and Buyer checkpoints are separate, idempotent, and each has a
  required evidence reference; the second valid checkpoint enables the
  confirmation-link handoff exactly once.
- Delivery failure, wrong-group evidence, duplicate action, and conflicting
  checkpoint remain recoverable without unauthorized state advancement.
- Participants see status/summary only; raw WhatsApp evidence is Admin-only.

## Verification

Run QA-WA-001..004 and QA-SEC-003, including Admin authorization, duplicate
checkpoint, wrong group, evidence correction, notification failure, and
mobile state tests.

## Definition Of Done

No automatic WhatsApp parsing or Seller OTP; the ticket remains Draft until review.
