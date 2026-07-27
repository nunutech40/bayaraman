# Engineering Ticket

## Ticket

~~~text
ID: BAYAR-007
Title: Buyer Confirmation Link and WhatsApp OTP
Type: Feature
Priority: P0
Owner: Engineering
Status: Draft
Depends on: BAYAR-006
Blocks: BAYAR-008
Source requirement IDs: UR-BUYER-006, UR-BUYER-007, UR-BUYER-008, UR-SYSTEM-002, UR-SYSTEM-003, UR-ADMIN-008, UR-BR-004, UR-BR-014, UR-BR-015, UR-BR-020, UR-BR-025, UR-BR-036
Source UX Flow IDs: UX-FLOW-023, UX-FLOW-024, UX-FLOW-025, UX-FLOW-027, UX-FLOW-028, UX-FLOW-029, UX-FLOW-030
Source UI IDs/states: UI-SCR-013, UI-SCR-014, UI-SCR-015, UI-SCR-016, UI-SCR-020
Source QA scenario IDs: QA-CONF-001, QA-CONF-002, QA-CONF-003, QA-CONF-004, QA-CONF-005, QA-SLA-002, QA-SEC-001, QA-SEC-002
Source technical design section: TRD Sections 5, 6, 8, 9, 10, 11, 12, 13, 14
~~~

## Outcome

Buyer confirms receipt using a single-use link and WhatsApp OTP bound to the
transaction Buyer snapshot. Valid confirmation enables payout eligibility;
silence never authorizes automatic payout.

## In Scope

- Link creation, expiry, single use, Buyer binding, and privacy boundary.
- WhatsApp-only six-digit OTP with five-minute TTL, five attempts,
  60-second resend cooldown, hash storage, single use, and audit.
- Reminder at 1x24 hours, overdue at 2x24 hours, manual recovery, and all
  loading/error/expired/unauthorized states.
- Transition to `READY_FOR_PAYOUT` only after valid Buyer confirmation.

## Out Of Scope

Seller OTP, email fallback, force confirmation, automatic payout, refund, or
complaint adjudication.

## Acceptance Criteria

- Only the Buyer transaction snapshot can open/request/submit the link and OTP;
  token replay, wrong account, expired link, and unauthorized access fail.
- Valid OTP within limits creates one audited confirmation and
  `READY_FOR_PAYOUT`; invalid, expired, or over-limit OTP does not.
- Reminder/overdue jobs use absolute deadlines in WIB and never convert Buyer
  silence into payout eligibility.
- OTP plaintext, link token, and sensitive participant data never enter logs,
  cookies, or participant-facing responses.

## Verification

Run QA-CONF-001..005, QA-SLA-002, and QA-SEC-001..002, including replay,
wrong-snapshot, rate-limit, timeout, notification failure, and concurrency
tests.

## Definition Of Done

Payout remains a separate BAYAR-008 operation and the ticket remains Draft until review.
