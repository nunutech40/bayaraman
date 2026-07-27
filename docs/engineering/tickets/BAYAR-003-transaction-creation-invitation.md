# Engineering Ticket

## Ticket

~~~text
ID: BAYAR-003
Title: Transaction Creation, Role-Owned Data, and Invitation Join
Type: Feature
Priority: P0
Owner: Engineering
Status: Draft
Depends on: BAYAR-002
Blocks: BAYAR-004
Source requirement IDs: UR-INIT-001, UR-INIT-002, UR-INIT-003, UR-INIT-004, UR-INIT-005, UR-BUYER-001, UR-BUYER-002, UR-BUYER-003, UR-SELLER-001, UR-SELLER-002, UR-SELLER-003, UR-PARTICIPANT-001, UR-PARTICIPANT-002, UR-PARTICIPANT-003, UR-SYSTEM-001, UR-BR-001, UR-BR-005, UR-BR-006, UR-BR-007, UR-BR-027, UR-BR-028, UR-BR-029, UR-BR-030, UR-BR-032, UR-BR-037
Source UX Flow IDs: UX-FLOW-002, UX-FLOW-003, UX-FLOW-004, UX-FLOW-005, UX-FLOW-006, UX-FLOW-009, UX-FLOW-010, UX-FLOW-011, UX-FLOW-012
Source UI IDs/states: UI-SCR-002, UI-SCR-003, UI-SCR-004, UI-SCR-005, UI-SCR-006, UI-SCR-007, UI-SCR-008
Source QA scenario IDs: QA-TRANS-001, QA-TRANS-002, QA-TRANS-003, QA-TRANS-004, QA-TRANS-005, QA-TRANS-006, QA-SEC-001, QA-UI-001
Source technical design section: TRD Sections 5, 6, 10, 11, 12, 13, 14
~~~

## Outcome

A verified account can initiate as Buyer or Seller, invite the opposite role,
and complete only its own role-owned data. Both distinct participants and
frozen terms become ready for BAYAR-004 without creating an invoice here.

## In Scope

- Seller-created and Buyer-created transaction creation.
- Concrete invitation preview/join/reissue contracts and single-use tokens.
- Buyer shipping/refund data and Seller contact/payout data with ownership,
  masking, and payable-time lock boundaries.
- Physical-goods eligibility and frozen item, shipping, fee, and destination
  snapshots.
- `WAITING_COUNTERPARTY` and `WAITING_COUNTERPARTY_DATA` only.

## Out Of Scope

Midtrans invoice/payment link, payment deadline, webhook, payment review,
WhatsApp group, payout, cancellation after invoice, or permanent roles.

## Acceptance Criteria

- `POST /api/transactions` supports either initiator role and creates one
  invitation; duplicate idempotency returns the original transaction.
- `GET /api/invitations/[token]`, join, and reissue enforce session,
  verified WhatsApp, opposite role, distinct account, expiry, revoke/use,
  idempotency, and state-version checks; raw tokens are never logged/stored.
- Only the owning participant can write role data; Buyer and Seller are
  distinct and exactly one of each is persisted.
- Completing both role datasets freezes terms and destination snapshots but
  does not create `payment_instructions`, an invoice, or a deadline.
- Invalid/prohibited goods, stale mutations, and unauthorized writes are
  rejected and audited.

## Verification

Run QA-TRANS-001..006, QA-SEC-001, and QA-UI-001, including concurrent join,
reissue, self-join, masked/raw DTO, lock-boundary, and idempotency tests.

## Definition Of Done

No BAYAR-004 behavior is included and the ticket remains Draft until review.
