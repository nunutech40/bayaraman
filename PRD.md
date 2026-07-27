# BayarAman Product Requirements Document

## 1. Document Control

```text
Product: BayarAman
Feature/release: MVP physical-goods trusted transaction with Midtrans payment
Version: 0.2
Status: Approved
Owner: Product Owner BayarAman
Last updated: 2026-07-26
Approved by: Product Owner BayarAman
Approved on: 2026-07-26
Source Product Brief: docs/product/00-product-brief.md v0.10 (Approved)
Source journey: docs/product/01-user-journey.md v0.6 (Approved)
Source UX Flow: docs/product/02-ux-flow.md v0.3 (Approved)
Source requirements: docs/product/03-user-requirements.md v0.4 (Approved)
Source UI/UX Design: docs/product/04-ui-ux-spec.md v0.2 (Approved)
Source QA scenarios: docs/product/05-qa-scenarios.md v0.2 (Approved)
```

This PRD consolidates approved product intent. It does not define database
schema, API implementation, authentication architecture, or infrastructure.

## 2. Executive Summary

BayarAman is a web application for trusted transactions involving shippable
physical goods. One reusable account may act as Buyer or Seller per
transaction. Each transaction has exactly one Buyer and one Seller, and the
accounts must be different.

After both parties complete their role-owned data, BayarAman freezes the
transaction terms and creates one Midtrans Invoice API payment link. Buyer
payment is authoritative only when Midtrans reports `settlement` with
`fraud_status=accept`. BayarAman then coordinates manual WhatsApp checkpoints,
shipment, Buyer receipt confirmation through WhatsApp OTP, and a separate
Admin payout to Seller.

## 3. Goals And Success Measures

| Goal | Success signal | Measurement method |
| --- | --- | --- |
| Make the lifecycle understandable | Actor can see status, next actor, deadline, and allowed action | `QA-UI-001`, `QA-UI-002`, `QA-TRANS-001` to `QA-TRANS-006` |
| Prevent premature fulfillment or payout | Shipment and payout unlock only after authoritative payment and required confirmation | `QA-MP-004`, `QA-MP-005`, `QA-WA-003`, `QA-CONF-002`, `QA-FIN-001` |
| Preserve payment and financial integrity | Provider events and financial operations are idempotent, auditable, and recoverable | `QA-MP-006`, `QA-MP-007`, `QA-FIN-003`, `QA-FIN-004`, `QA-SEC-004`, `QA-SEC-005` |
| Make external operations recoverable | Webhook, WhatsApp, refund, payout, and timeout failures have an owner and recovery path | `QA-MP-007`, `QA-WA-004`, `QA-SLA-001`, `QA-SLA-002`, `QA-NOTIFY-001` |
| Validate real-money readiness | Production launch is blocked until merchant settlement, custody, legal, compliance, credentials, and webhook evidence are approved | `UR-BR-046`, `PB-MP-009`, `PB-MP-OD-005`, `QA-LAUNCH-001` |

Quantitative pilot targets remain deferred until baseline data and operating
capacity are available. Engineering must not invent launch thresholds.

## 4. Non-Goals

- Permanent separate Buyer and Seller account types.
- Self-transactions, marketplace listings, storefronts, ratings, or wallet balances.
- Native mobile applications; this is a web application with a mobile-width surface.
- Manual bank account instructions as the normal payment flow.
- Automatic WhatsApp parsing, automatic shipment confirmation, or automatic payout.
- In-app adjudication of Buyer-Seller complaints; complaints are resolved outside BayarAman.
- Digital goods, services, and prohibited or unsupported physical-goods categories.
- Cancellation after shipment, financial processing, refund processing, payout processing, or terminal financial state.
- OTP email or alternate OTP channel in the MVP.
- Production real-money launch before the approved launch gate.

## 5. Actors

| Actor | Responsibility | Main goal | Boundary |
| --- | --- | --- | --- |
| Buyer | Starts or joins, owns Buyer data, opens Midtrans checkout, confirms receipt, and requests eligible cancellation | Receive goods with controlled payment release | Cannot edit Seller payout data or authorize Admin operations |
| Seller | Starts or joins, owns Seller data, ships after payment announcement, and receives payout | Ship only after trusted payment and receive funds | Cannot edit Buyer data or confirm receipt for Buyer |
| Admin | Reconciles provider events, records WhatsApp checkpoints, manages holds/refunds, and executes payout | Operate the trust process with auditable evidence | Only operational product role besides Buyer/Seller |
| BayarAman system | Enforces account, role, state, deadline, permission, idempotency, and audit rules | Preserve one trusted transaction record | Does not infer payment, shipment, complaint, or financial success without approved evidence |

Ops, Finance, Supervisor, and Reviewer are internal Admin task assignments,
not additional product roles.

## 6. Scope

### Included

- One reusable account with verified WhatsApp before transaction participation.
- Seller-created and buyer-created physical-goods transactions.
- Invitation, distinct counterparty join, and role-owned data completion.
- Frozen transaction terms and one active Midtrans Invoice API payment link using `payment_type: payment_link`.
- Hosted Midtrans payment page with frozen amount and BayarAman deadline.
- Midtrans `due_date` follows the BayarAman deadline when supported; provider retry never creates a new deadline.
- Midtrans webhook signature, order ID, amount, and fraud validation.
- Provider status handling for `pending`, `capture`, `settlement`, `deny`, `cancel`, `failure`, `expire`, and `UNKNOWN`.
- Duplicate, delayed, out-of-order, mismatch, outage, and Get Status API reconciliation.
- `Cek status pembayaran` as a refresh/status request only; no `Sudah Bayar` confirmation action.
- One-timespan 1x24-hour expiry from invoice availability, without deadline reset.
- Late-fund reconciliation/refund exception without transaction revival.
- Manual WhatsApp group, payment announcement, separate Seller/Buyer completion checkpoints, Buyer OTP, and Admin payout.
- Cancellation, funded cancellation, complaint hold, risk hold, refund, late-fund refund, and cutoff behavior.
- Midtrans Refund API where supported; manual Admin refund fallback where unsupported.
- Financial result handling: `PROCESSING`, `SUCCESS`, `FAILED`, and `UNKNOWN`.
- Mobile-width web presentation, accessibility, masking, audit, idempotency, and notification recovery.

### Post-MVP / Excluded

- Automated payout, refund, or WhatsApp operations beyond provider/API boundaries approved later.
- Additional fulfillment categories without new approved product rules.
- In-app complaint adjudication or legal settlement.
- Real-money launch before `QA-LAUNCH-001` and `UR-BR-046` are approved.

## 7. Approved User Journeys

| Journey | Summary | Source |
| --- | --- | --- |
| Seller-created | Seller starts, Buyer joins, terms freeze, Midtrans invoice is paid authoritatively, Admin opens WhatsApp operations, Seller ships, both checkpoints complete, Buyer confirms by OTP, Admin pays Seller | `UJ-SELLER-*`, `UX-FLOW-001` to `UX-FLOW-026` |
| Buyer-created | Buyer starts, Seller joins with Seller-owned data, then the same payment, WhatsApp, shipment, confirmation, and payout sequence applies | `UJ-BUYER-*`, `UX-FLOW-007` to `UX-FLOW-026` |
| Payment recovery | Provider events are validated and reconciled; non-authoritative or late payment never revives a closed transaction | `UJ-PAYMENT-RECOVERY-*`, `UX-FLOW-044` to `UX-FLOW-050` |
| Cancellation and holds | Eligible cancellation becomes direct cancellation, reconciliation, funded review, refund, complaint hold, or risk hold according to state and evidence | `UJ-CANCELLATION-001` to `UJ-CANCELLATION-025`, `UX-FLOW-051` to `UX-FLOW-075` |

## 8. Approved Experience

The product is a web application rendered as a constrained mobile-width
surface, including on desktop browsers. The approved screen inventory is
`UI-SCR-001` to `UI-SCR-024`.

Experience rules:

- Show one trusted status, next responsible actor, deadline, and permitted action.
- Open the hosted Midtrans payment page from the invoice/payment link.
- Show `Cek status pembayaran` only as refresh/status request.
- Never treat Buyer action, webhook delivery, or provider `capture` as settlement authority.
- Authority is only `settlement + fraud_status=accept` after signature, order, amount, and fraud validation.
- Keep Midtrans payment, WhatsApp checkpoints, complaint/risk holds, refund, and Seller payout as separate boundaries.
- Support loading, empty, error, disabled, expired, unauthorized, timeout, UNKNOWN, manual-review, and recovery states.

Traceability: `UX-FLOW-001` to `UX-FLOW-075`, `UI-SCR-001` to `UI-SCR-024`,
`QA-ACCOUNT-001` to `QA-LAUNCH-001`.

## 9. Functional Requirements

| Requirement IDs | Capability | Requirement | Priority |
| --- | --- | --- | --- |
| `UR-ACCOUNT-001` to `UR-ACCOUNT-002` | Account readiness | Require authenticated account and verified WhatsApp before participation | Must |
| `UR-INIT-001` to `UR-INIT-005` | Transaction initiation | Support Seller-created and Buyer-created transactions with invitation and role-owned data | Must |
| `UR-BUYER-001` to `UR-BUYER-003`, `UR-SELLER-001` to `UR-SELLER-003` | Counterparty join | Require distinct opposite account and complete role-owned data | Must |
| `UR-SYSTEM-001`, `UR-PARTICIPANT-001` | Frozen terms | Freeze terms after both participants complete required data | Must |
| `PB-MP-001` to `PB-MP-009`, `PB-MP-OD-001` to `PB-MP-OD-005`, `UR-PAYMENT-001` to `UR-PAYMENT-007` | Midtrans payment | Create idempotent payment link, validate provider events, reconcile status, and preserve deadline | Must |
| `UR-ADMIN-001` to `UR-ADMIN-004`, `UR-ADMIN-020` to `UR-ADMIN-023` | Admin payment operations | Admin owns provider reconciliation and exception handling, not normal manual bank checking | Must |
| `UR-ADMIN-003` to `UR-ADMIN-005`, `UR-SELLER-004`, `UR-PARTY-001` to `UR-PARTY-002` | WhatsApp fulfillment | Record group, payment announcement, and separate completion checkpoints | Must |
| `UR-BUYER-006` to `UR-BUYER-008`, `UR-SYSTEM-002` to `UR-SYSTEM-003` | Buyer confirmation | Send WhatsApp OTP to frozen Buyer number and protect payout from silence | Must |
| `UR-ADMIN-006` to `UR-ADMIN-007`, `UR-FINANCIAL-001` to `UR-FINANCIAL-003` | Refund and payout | Keep payout separate from settlement; use approved financial results and evidence | Must |
| `UR-BR-039`, `UR-BR-040` | Financial authorization | Require assigned Admin ownership, two-Admin approval for controlled financial actions, and re-authentication for ordinary payout | Must |
| `UR-CANCEL-001` to `UR-CANCEL-025`, `UR-CAN-OD-001` to `UR-CAN-OD-008` | Cancellation and holds | Enforce eligibility, reconciliation, funded evidence, refund, complaint, risk, cutoff, and recovery | Must |
| `UR-BR-001` to `UR-BR-065` | Business rules | Enforce approved privacy, audit, deadline, financial, notification, and launch rules | Must |

QA acceptance reference: `QA-ACCOUNT-001` through `QA-LAUNCH-001` in
`docs/product/05-qa-scenarios.md` v0.2.

Authorization and SLA traceability: `UR-BR-039`, `UR-BR-040`, `UR-BR-043`,
`PB-MP-006`, `PB-MP-OD-005`, `QA-FIN-006`, `QA-FIN-008`, `QA-SLA-001`,
`QA-SLA-002`, and `QA-LAUNCH-001`.

## 10. Business Rules

| Rule IDs | Rule | Rationale | Alternate outcome |
| --- | --- | --- | --- |
| `PB-BR-001`, `UR-BR-001` to `UR-BR-004` | One account may hold one transaction role; Buyer and Seller must be different accounts | Prevent self-dealing and preserve role ownership | Reject invalid join or mutation |
| `PB-BR-004`, `UR-SYSTEM-001` | Invoice/payment link is available only after both role datasets are complete and terms are frozen | Prevent incomplete payment terms | Remain in waiting state |
| `PB-MP-001`, `PB-MP-OD-001` | Create one active Midtrans payment link idempotently using frozen amount and deadline | Prevent duplicate invoices and amount changes | Return existing invoice result |
| `PB-MP-002` to `PB-MP-005`, `PB-MP-OD-002` to `PB-MP-OD-004` | Validate signature, order ID, amount, fraud status, duplicate, delayed, and out-of-order events | Prevent forged or stale payment authority | Reject, retain UNKNOWN, or reconcile through Get Status API |
| `PB-MP-004`, `PB-MP-OD-002` | Only `settlement + fraud_status=accept` is authoritative; `capture` is not settlement for payout | Separate payment settlement from payout eligibility | Keep waiting or manual review |
| `PB-MP-006`, `UR-SYSTEM-005` to `UR-SYSTEM-007` | Expire 1x24 hours from invoice availability; retry never resets deadline | Keep expiry deterministic | `PAYMENT_EXPIRED` or late-fund exception |
| `PB-MP-007` to `PB-MP-008`, `UR-FINANCIAL-001` to `UR-FINANCIAL-003` | Refund through Midtrans if supported, otherwise Admin fallback; only SUCCESS with evidence is terminal | Protect money movement | FAILED retry; UNKNOWN reconciliation |
| `UR-BR-039`, `UR-BR-040` | Refund, split, exception, and payout actions require the assigned Admin boundary; controlled actions require two Admin approval and ordinary payout requires re-authentication | Prevent unauthorized or duplicate financial action | Action remains disabled until authorization is complete; all approval and re-auth events are append-only audit records |
| `UR-BR-043` | Admin operations run 09.00-21.00 WIB; reconciliation target is two operating hours, payout target is 1x24 hours after eligibility, and refund/split target is 2x24 hours after approval | Give every waiting operation an owner and deadline | Escalation reminder every 1x24 hours; timeout creates reminder/manual review, never financial success |
| `PB-MP-006`, `UR-BR-010` | Midtrans `due_date` follows the absolute BayarAman deadline when supported | Align provider expiry with the trusted transaction deadline | Unsupported due date keeps BayarAman deadline authoritative |
| `UR-BR-012` to `UR-BR-020` | WhatsApp group and completion checkpoints are manual and separate; Buyer OTP authenticates receipt | External activity is not automatically trusted | Hold or manual review |
| `PB-CAN-OD-001` to `PB-CAN-OD-006`, `UR-CAN-OD-001` to `UR-CAN-OD-008` | Cancellation follows actor/state/cause/evidence/cutoff rules; late funds never revive | Prevent unsafe reversal | CANCELLED, REFUNDED, hold, or manual review |
| `UR-CAN-OD-007`, `UR-BR-041`, `UR-BR-042` | Mutations and financial operations are idempotent, state-versioned, unique, and append-only | Prevent duplicate money movement | Duplicate returns same result; conflict rejected |
| `PB-MP-009`, `PB-MP-OD-005`, `UR-BR-046` | Real-money launch is blocked until Midtrans settlement, custody, legal/compliance, credentials, and webhook gates are approved | Control production risk | Remain non-production |

## 11. Data And Privacy

- Account data includes identity and verified WhatsApp number.
- Buyer data includes shipping and refund destination; Seller data includes payout destination.
- Transaction terms, invoice references, provider status, timestamps, and deadline are frozen or audited as applicable.
- Raw provider credentials, raw bank values, and raw WhatsApp evidence are never exposed to Buyer/Seller or written to client logs.
- Buyer/Seller see only their permitted financial view and masked counterparty data.
- Admin may access raw evidence only under an internal Admin task assignment.
- Cancellation evidence remains available until case closure; production retention and legal hold remain launch decisions.

Traceability: `UR-OD-001`, `UR-OD-002`, `UR-OD-008`, `UR-OD-012`, `UR-BR-025`,
`UR-BR-032`, `UR-BR-045`, `QA-SEC-001` to `QA-SEC-005`.

## 12. Manual Operations

| Manual action | Owner | Trigger | System record | Operational risk |
| --- | --- | --- | --- | --- |
| Midtrans reconciliation | Assigned Admin | Webhook mismatch, UNKNOWN, outage, late event, or exception | Provider event/status, decision, operator, time, evidence, SLA, and escalation state | False authority or missed deadline |
| WhatsApp group/checkpoint | Admin | Authoritative payment and fulfillment milestones | Group/message reference, participants, checkpoint, time | Wrong group or untrusted evidence |
| Complaint/risk hold | Admin assignment | Complaint, prohibited item, or suspected fraud | Hold, evidence, decision, audit | Unsafe automatic outcome |
| Midtrans/manual refund | Assigned Admin with second Admin approval | Approved cancellation, complaint, risk, or late-fund outcome | Operation ID, approval participants, result, reference, audit, 2x24-hour target | Duplicate or wrong refund |
| Seller payout | Assigned Admin with re-authentication; second Admin approval when required | Buyer confirmation or approved exception, no hold | Operation ID, re-auth/approval evidence, result, reference, audit, 1x24-hour target | Payout before eligibility |

Financial results are `PROCESSING`, `SUCCESS`, `FAILED`, or `UNKNOWN`.
`FAILED` may retry. `UNKNOWN` must be reconciled before retry. Only
`SUCCESS` with evidence/reference may create a financial terminal result:
`PAID_OUT` for Seller payout or `REFUNDED` for Buyer refund. Settlement from
Midtrans never creates `PAID_OUT` automatically.

All manual deadlines use WIB and Admin operating hours of 09.00-21.00 WIB.
Payment reconciliation targets two operating hours, payout targets 1x24 hours
after eligibility, refund/split targets 2x24 hours after approval, and an
escalation reminder is sent every 1x24 hours until the case is handled. A
timeout only creates a reminder or `MANUAL_REVIEW_REQUIRED` path; it never
creates financial success.

## 13. Notifications And External Dependencies

| Event | Channel/provider | Required behavior | Fallback |
| --- | --- | --- | --- |
| Invoice/payment link | Midtrans hosted page plus BayarAman | Show frozen amount, link, provider status, original WIB deadline, and provider `due_date` when supported | Status refresh and Admin reconciliation |
| Provider payment event | Midtrans webhook/Get Status API | Validate signature/order/amount/fraud and handle ordering/idempotency | Admin reconciliation; never infer authority |
| Payment announcement and fulfillment | WhatsApp plus Admin checkpoint | Announce only after authoritative settlement; record separate checkpoints | Retry without state mutation |
| Buyer confirmation | WhatsApp OTP | Send to frozen Buyer number; enforce expiry, attempts, cooldown, and lock | Admin manual review; no channel switch in MVP |
| Refund/payout | Midtrans Refund API or manual bank fallback / payout flow | Persist result and immutable reference; require assigned Admin authorization, two-Admin approval where applicable, and payout re-authentication | Retry FAILED; reconcile UNKNOWN; escalate every 1x24 hours |
| Notification | BayarAman notification mechanism | Maximum three delivery attempts; failure does not change trusted status | Manual Admin communication |

External provider delivery or response is not payment authority by itself.

## 14. Risks And Assumptions

| Risk/assumption | Impact | Mitigation/validation |
| --- | --- | --- |
| Midtrans merchant settlement, custody, and webhook production access are not ready | Real-money launch unsafe | Block at `QA-LAUNCH-001`, `PB-MP-009`, and `PB-MP-OD-005` |
| Provider outage, mismatch, duplicate, or UNKNOWN event | Wrong payment outcome | Signature validation, idempotency, Get Status API, Admin reconciliation |
| Late, partial, excess, or duplicate payment | Transaction could be revived incorrectly | Immutable deadline and refund-only exception |
| WhatsApp evidence is missing or conflicting | Wrong shipment/cancellation outcome | Admin checkpoint, immutable evidence, complaint/risk hold |
| Buyer does not complete OTP | Payout remains held | Reminder, overdue state, controlled Admin exception |
| Financial result UNKNOWN | Duplicate money movement | Reconcile before retry and preserve operation evidence |
| Financial authorization or SLA is incomplete | Unauthorized transfer, missed deadline, or silent timeout | Disable action, require assigned Admin/re-auth/approval, show WIB deadline, and escalate every 1x24 hours |
| Legal/compliance or retention policy is unresolved | Production launch blocked | Validate before real-money pilot and configure legal hold |

## 15. Release Acceptance

- All linked Must requirements are implemented or have an approved manual/non-UI boundary.
- Seller-created and buyer-created journeys pass relevant P0 QA scenarios.
- Midtrans invoice, hosted checkout, webhook validation, reconciliation, expiry, and late-fund paths pass QA.
- No payment is authoritative except `settlement + fraud_status=accept` with validated evidence.
- Refund and payout use approved financial results; `SUCCESS` plus evidence produces `REFUNDED` or `PAID_OUT`, while payout remains separate from settlement.
- Refund, split, controlled exception, and risk outcomes have two-Admin approval; ordinary payout has Admin re-authentication.
- Admin hours, reconciliation/payment, payout, refund/split SLA, WIB deadlines, and escalation reminders are validated.
- Midtrans `due_date` follows the BayarAman deadline when supported and never resets the absolute 1x24-hour expiry.
- Cancellation, complaint hold, risk hold, OTP, audit, permission, and masking scenarios pass.
- Mobile-width desktop surface, accessibility, and recovery states pass.
- Midtrans merchant settlement, custody, legal/compliance, credentials, and webhook deployment gates are approved before production.
- Traceability remains valid through `QA-LAUNCH-001`, `UX-FLOW-001` to `UX-FLOW-075`, `UI-SCR-001` to `UI-SCR-024`, and relevant UR/PB IDs.

## 16. Open Decisions

| Decision | Owner | Target | Status |
| --- | --- | --- | --- |
| Pilot success thresholds and operational capacity targets | Product Owner / Admin operations | Before pilot approval | Open; does not block this Draft |
| Production retention duration and legal-hold policy | Legal/Compliance | Before real-money launch | Open; launch blocker |
| Midtrans merchant settlement, custody, and production webhook arrangement | Product Owner / Legal / Midtrans partner | Before real-money launch | Open; launch blocker |
| Final notification provider and escalation channel | Product Owner / Engineering | Technical Design | Deferred |
| Final API, schema, job, and provider integration design | Engineering | Technical Design | Deferred |

## 17. Migration Note

PRD v0.1 described manual bank instructions, Buyer `Sudah Bayar`, and Admin
bank review as the normal payment flow. PRD v0.2 replaces that behavior with
Midtrans Invoice API and hosted payment links. Manual bank activity remains
only as an approved payout or refund fallback, not as the primary payment
collection path.

Existing engineering tickets and execution plans based on the manual-bank
model are not valid engineering sources until reviewed against this PRD and
the approved Midtrans artifacts.

## 18. PRD Approval Checklist

- [x] Approved Product Brief, User Journey, UX Flow, User Requirements, UI/UX Specification, and QA Scenarios are linked.
- [x] Midtrans payment authority and recovery behavior are explicit.
- [x] Product roles and manual Admin boundaries are explicit.
- [x] Cancellation, complaint, risk, refund, expiry, OTP, and payout are traceable.
- [x] Non-goals, risks, launch constraints, and acceptance criteria are included.
- [x] Migration from the manual-bank payment model is documented.
- [x] Product Owner review and approval completed.

PRD v0.2 is `Approved`.
