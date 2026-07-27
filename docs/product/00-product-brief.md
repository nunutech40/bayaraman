# BayarAman Product Brief

## 1. Document Control

```text
Product: BayarAman
Version: 0.10
Status: Approved
Owner: Product Owner BayarAman
Last updated: 2026-07-25
Previous approved version: 0.8 (2026-07-19)
Previous draft: 0.9 (2026-07-23)
Change request: Lock Midtrans invoice, payment-status, expiry, webhook, and refund decisions
Approved by: Product Owner BayarAman
Approved on: 2026-07-25
```

## 2. Source And Precedence

Sources used, from highest to lowest priority:

1. Latest product-owner direction on 2026-07-25: use Midtrans Invoice API, verified Midtrans notifications, and the recommended status/expiry/refund boundary.
2. Product Brief v0.8 as the last approved product boundary and source for all unchanged behavior, including cancellation.
3. Earlier product-owner decisions on account/role ownership, expiry, completion checkpoints, buyer-confirmation recovery, WhatsApp OTP, complaint hold, and financial outcomes.
4. `requirenment/00-owner-direction.md` for the current transaction flow and business rules.
5. `requirenment/BayarAman — Product Concept (Draft).md` for the problem, positioning, and product principles.
6. The User Journey Blueprint, PRD v1, and Business/Operating Model drafts in `requirenment/` as candidate context only.
7. `docs/product/templates/product-brief-template.md` for artifact structure only.

Version 0.10 preserves the approved cancellation rules while locking the Midtrans invoice/payment-link, status, expiry, webhook, and refund boundary. Archive and prototype sources were excluded, and latest owner direction wins over every baseline draft.

## 3. Problem And Proposition

**Who has the problem:** buyer and seller who already found each other and want to transact outside a marketplace.

**Current friction and risk:** buyer risks transferring money before receiving the agreed goods; seller risks shipping without proof that payment has reached the intermediary; manual rekber coordination can leave data ownership, status, and next actions unclear; and the current approved flow does not define how either party safely stops a transaction before fulfillment or how funded cancellation becomes an audited refund.

**Why it matters:** both parties need a trusted sequence for agreement, payment, fulfillment, confirmation, and payout without maintaining separate buyer/seller accounts or requiring BayarAman to become a marketplace.

**Proposition:** BayarAman helps one user act safely as buyer or seller in different off-marketplace transactions through role-owned data, a verified Midtrans payment boundary, controlled cancellation/refund, WhatsApp operations, buyer OTP confirmation, and recorded seller payout.

## 4. Actors And Account Model

| Actor/role | Goal | Responsibility boundary |
| --- | --- | --- |
| User account | Maintain one reusable identity for all BayarAman activity | Owns common identity and mandatory WhatsApp number; may hold different transaction roles |
| Seller role | Ship only after payment is confirmed and receive the agreed payout | Owns seller-specific data and payout destination, fulfills the deal, reports completion, and responds to eligible cancellation requests |
| Buyer role | Pay through a trusted intermediary and control final confirmation | Owns buyer-specific data, pays the Midtrans invoice, reports completion, completes OTP confirmation, and may request eligible cancellation |
| Admin | Operate the manual rekber process without confusing provider events with trusted BayarAman outcomes | Manages webhook/status exceptions, the WA group, cancellation evidence/decisions, confirmation, seller payout, and buyer refund through authenticated access |
| BayarAman system | Keep each transaction understandable and enforce system-supported checkpoints | Stores roles and data ownership, exposes valid cancellation and transaction actions, records results, handles OTP, and expires unpaid transactions |

### Role Input Ownership

| Data group | Entered/owned by | Product Brief boundary |
| --- | --- | --- |
| Common identity and contact | The account owner | A WhatsApp number is mandatory before transaction participation and reused when the account acts as buyer or seller; verification/change mechanics belong in User Requirements |
| Shared deal details | The buyer or seller who starts the transaction | Describes the agreement for both parties; exact fields and revision rules are deferred |
| Buyer-role data | The account acting as buyer | Buyer supplies and confirms their own required data; another actor must not author it as authoritative buyer data |
| Seller-role data and payout account | The account acting as seller | Seller supplies and confirms their own payout data; buyer must not enter the authoritative seller bank account |

Every transaction binds exactly two distinct accounts: one buyer and one seller. The same account cannot occupy both roles in one transaction or transact with itself.

The counterparty joins through an invitation/link and signs in or creates a different account from the initiator. A transaction becomes payable only after required buyer and seller data are complete. Joining and completing role data replaces a separate `Seller Acceptance` step.

## 5. Confirmed MVP Scope

### Included From Current Owner Direction

- The currently defined MVP flow is for physical goods that a seller ships.
- Every person uses one BayarAman account; the account can be buyer or seller per transaction.
- Every account must provide a WhatsApp number before participating in a transaction.
- Every transaction has exactly two different participant accounts with opposite roles: one buyer and one seller.
- The same account cannot become both parties or create a self-transaction.
- Buyer or seller may start a transaction.
- The initiator enters shared deal details plus their own role-specific data.
- The counterparty joins through an invitation/link and enters their own role-specific data.
- Seller payout data is always owned and supplied by the account acting as seller.
- Buyer data is always owned and supplied by the account acting as buyer.
- There is no separate seller-acceptance action; both role datasets must be complete before payment instructions become available.
- After both role datasets are complete, BayarAman creates one idempotent Midtrans Invoice API invoice using `payment_type: payment_link` and frozen transaction terms.
- Buyer pays through the Midtrans hosted payment page. BayarAman receives and validates Midtrans notifications as the authoritative payment confirmation boundary.
- `Cek status pembayaran` may refresh payment status, but a Buyer action never confirms payment by itself.
- After Midtrans payment is authoritative, admin manually creates a WhatsApp group using the buyer and seller WhatsApp-number snapshots stored for that transaction, then announces that payment has arrived.
- Seller ships the goods after the payment announcement.
- Seller and buyer each report when the order is complete in WhatsApp, and admin records the two reports as separate system checkpoints.
- Admin posts a buyer-confirmation link in the group.
- Buyer opens the link and confirms using an OTP sent only to the buyer WhatsApp-number snapshot used by admin for the transaction group.
- The MVP offers no OTP channel switch or email fallback; resend/recovery stays on the same buyer WhatsApp number.
- Buyer has `2x24 hours` from confirmation-link creation to complete OTP; admin sends a reminder after `1x24 hour` if confirmation remains incomplete.
- When the `2x24-hour` deadline passes, payout remains held and buyer silence never triggers automatic payout.
- Admin may make payout eligible through a controlled exception only when a buyer-complete WA checkpoint already exists, no complaint or payout hold is known, and the WA evidence, reason, operator, and timestamp are recorded.
- Admin manually transfers money to the seller after valid buyer OTP or an eligible audited admin exception.
- An unpaid invoice/transaction expires under the confirmed 1x24-hour policy from invoice availability; late funds never revive the transaction.
- Buyer-seller complaints are discussed and resolved outside the system, while admin must record `PAYOUT_ON_HOLD` before payout and later record the written-WA agreement as release to seller, refund to buyer, or split settlement.
- A known complaint disables normal payout and the buyer-confirmation admin exception; without written agreement, funds remain held in manual review.

### Approved Supporting Scope

- One transaction has one central record/page containing the agreement, roles, amount, payment state, next action, and important activity history.
- Buyer and seller can understand the current state without interpreting bank or WhatsApp activity themselves.
- Manual admin actions that change trusted status or move money have a recorded operator, result, and timestamp.

### Confirmed Cancellation Scope

The actor and status boundary is:

| Transaction condition | Actor who may act | Confirmed cancellation behavior |
| --- | --- | --- |
| Counterparty has not joined and payment instructions are unavailable | Initiator | May cancel unilaterally; transaction ends as `CANCELLED` |
| Both parties have joined but payment instructions are unavailable | Buyer or seller | Either participant may cancel; transaction ends as `CANCELLED` |
| Midtrans invoice is available and no payment exception is under review | Buyer or seller | A request enters `CANCELLATION_PENDING_RECONCILIATION`; the invoice becomes inactive while possible payment events are reconciled for at most two operating hours |
| Midtrans payment status or notification is under review | Buyer or seller | May request cancellation, but it cannot complete until the payment status is authoritative or manually reconciled |
| Payment is confirmed and goods have not shipped | Buyer, seller, or admin for an operational/risk reason | Uses funded-cancellation review, evidence, cause-based service-fee treatment, and manual refund controls |
| Goods have shipped | No participant may cancel | Any issue follows the complaint, payout-hold, and settlement path |
| Payout/refund processing has begun or a terminal financial state exists | No participant may cancel | Cancellation cannot stop or automatically reverse the financial operation |

- Before confirmed funds, cancellation has no separate cancellation fee.
- `CANCELLATION_PENDING_RECONCILIATION` lasts at most two operating hours from the cancellation request. If no funds are found, the transaction becomes `CANCELLED`. If funds are found, funded-cancellation rules apply. Funds arriving after cancellation are handled as a refund exception and never revive the transaction.
- While a Midtrans payment status or notification is under review, an unresolved payment does not complete cancellation; `pending`, `capture`, or unknown results remain under reconciliation, while `settlement + accept` determines the funded path and `deny`, `cancel`, `failure`, or `expire` determines the unfunded path.
- A funded buyer change-of-mind request requires a written seller statement in the transaction WA group that goods have not shipped, plus an admin-recorded checkpoint. A shipping claim or conflicting evidence moves the issue to the complaint path.
- A participant whose response is required for funded cancellation has `1x24 hours` to respond. No response produces `MANUAL_REVIEW_REQUIRED`; it never causes automatic refund or payout, and fulfillment/payout remains held pending review.
- Seller inability to fulfill or cancellation caused by a BayarAman operational/system error gives the buyer a full refund including the service fee.
- There is no separate cancellation fee. For buyer change of mind without seller fault, or a neutral mutual funded cancellation, item price and shipping are refunded while the existing service fee remains non-refundable.
- A prohibited item, suspected fraud, or related policy cancellation enters `RISK_HOLD`. Fulfillment and money movement stop, and the refund, fee, or other financial outcome is recorded only after operational/compliance review.
- Unfunded cancellation ends as `CANCELLED`; funded cancellation remains non-terminal until manual refund succeeds and then ends as `REFUNDED` with cancellation as the reason.
- Every request, response, reason, WA evidence, checkpoint, fee/refund calculation, operator, timestamp, review outcome, and financial reference must remain auditable.

### Explicitly Not Included In The Current MVP Direction

- Separate permanent buyer and seller account types.
- Self-transactions or assigning both transaction roles to the same account.
- Guest participation without a BayarAman account.
- Buyer entering the authoritative seller payout account.
- A separate seller accept/reject step after joining and completing required seller data.
- Marketplace listings, storefronts, internal wallet/balance, native mobile app, or realtime in-app chat.
- In-app complaint negotiation or structured dispute workflow.
- Delivery-proof upload and post-delivery auto-release from the older drafts.
- Automated payout, unsupported-method automatic refunds, and payment-provider settlement beyond the approved Midtrans invoice/notification boundary.
- Digital products and services until their fulfillment and completion rules are explicitly approved.
- Free/Pro subscriptions and the older fixed Rp5,000 cancellation-fee/exemption model.
- Unilateral funded cancellation, cancellation after shipment, or automatic reversal of payout/refund processing.

### Later Possibilities

- Virtual account, QRIS, bank reconciliation, automated WhatsApp group operations, and payout automation.
- Additional transaction categories after the physical-goods flow is validated.
- KYC, risk scoring, seller reputation, and community/white-label integrations.

## 6. Core Business Rules

| ID | Rule | Status |
| --- | --- | --- |
| PB-BR-001 | One account may act as buyer or seller in different transactions | Confirmed |
| PB-BR-002 | Buyer or seller may start a transaction; the initiator enters shared deal data plus their own role data | Confirmed |
| PB-BR-003 | Each actor owns and enters their own role data; seller alone supplies authoritative payout data | Confirmed |
| PB-BR-004 | Both role datasets must be complete before the Midtrans invoice becomes available | Approved |
| PB-BR-005 | Joining and completing seller-role data replaces a separate seller-acceptance step | Approved |
| PB-BR-006 | Buyer pays through a BayarAman-created Midtrans Invoice API invoice using a hosted payment link; funds are not paid directly to seller | Confirmed |
| PB-BR-007 | Payment confirmation requires Midtrans `transaction_status=settlement` and `fraud_status=accept`; a Buyer status action alone never confirms payment | Confirmed |
| PB-BR-008 | Admin creates the WA group and announces payment received before seller ships | Confirmed |
| PB-BR-009 | Seller and buyer both report completion before admin sends the confirmation link | Confirmed |
| PB-BR-010 | Buyer completes OTP through WhatsApp before normal seller payout; OTP is sent only to the buyer WhatsApp-number snapshot used for the transaction group, with no channel switch in MVP | Confirmed |
| PB-BR-011 | Seller payout is transferred manually by admin | Confirmed |
| PB-BR-012 | The 1x24-hour timer starts when the Midtrans invoice becomes available; retries do not reset the deadline and the invoice due date follows it when supported | Confirmed |
| PB-BR-013 | An expired invoice/transaction cannot be revived; late funds become a refund/reconciliation exception | Confirmed |
| PB-BR-014 | Buyer-seller complaints are resolved outside the system | Confirmed |
| PB-BR-015 | Important trusted-status and money-moving actions are auditable | Approved |
| PB-BR-016 | A transaction must bind two distinct accounts with opposite roles; the same account cannot be both buyer and seller | Confirmed |
| PB-BR-017 | Seller and buyer completion reports remain in WhatsApp; admin records one explicit system checkpoint for each role, and both checkpoints are required before the confirmation link is sent | Confirmed |
| PB-BR-018 | Buyer OTP has a 2x24-hour response window with a reminder after 1x24 hour; silence never releases payout automatically, while an audited admin exception may make payout eligible only from an existing buyer-complete WA checkpoint with no known complaint or hold | Confirmed |
| PB-BR-019 | A WhatsApp number is mandatory account data; each transaction snapshots participant numbers, admin uses those snapshots for the WA group, and buyer OTP must target the same buyer snapshot | Confirmed |
| PB-BR-020 | A complaint reported before payout processing starts requires `PAYOUT_ON_HOLD`, disables payout and admin exception, remains negotiated outside the system, and ends only through an admin-recorded written-WA agreement for full seller release, full buyer refund, or split settlement; without agreement funds remain held | Confirmed |
| PB-BR-021 | Before counterparty join only the initiator may cancel; after both parties join and before authoritative payment confirmation either participant may cancel or request cancellation according to payment state, with no separate cancellation fee before confirmed funds | Confirmed |
| PB-BR-022 | Once the Midtrans invoice is available, cancellation enters `CANCELLATION_PENDING_RECONCILIATION` for at most two operating hours; no funds leads to `CANCELLED`, found funds use funded cancellation, and late funds are refunded without reviving the transaction; a request during payment-status review waits for the authoritative result | Confirmed |
| PB-BR-023 | Funded buyer cancellation before shipment requires the seller's written not-shipped statement in the transaction WA group and an admin checkpoint; a required participant has 1x24 hours to respond, after which no response produces `MANUAL_REVIEW_REQUIRED` without automatic refund or payout | Confirmed |
| PB-BR-024 | Seller inability to fulfill or BayarAman operational/system error produces a full buyer refund including service fee | Confirmed |
| PB-BR-025 | Buyer change of mind without seller fault or a neutral mutual funded cancellation refunds item price and shipping but retains the existing service fee; no additional cancellation fee is charged | Confirmed |
| PB-BR-026 | Shipment or conflicting shipping evidence ends cancellation eligibility; later issues use complaint hold and settlement | Confirmed |
| PB-BR-027 | Cancellation cannot stop or reverse a financial transfer after payout/refund processing begins or a terminal financial state is recorded | Confirmed |
| PB-BR-028 | Unfunded cancellation ends `CANCELLED`; funded cancellation ends only after a successful manual refund recorded as `REFUNDED` with cancellation reason; prohibited-item, suspected-fraud, or policy cases enter `RISK_HOLD` until operational/compliance review determines the financial outcome | Confirmed |
| PB-BR-029 | Cancellation requests, responses, WA evidence, checkpoints, calculations, admin/compliance actions, and refund references are auditable | Confirmed |

### Midtrans Payment Boundary

| ID | Rule | Status |
| --- | --- | --- |
| PB-MP-001 | BayarAman creates one idempotent Midtrans Invoice API invoice per active transaction with `payment_type: payment_link` from frozen transaction terms | Confirmed |
| PB-MP-002 | Buyer pays through the Midtrans hosted payment page; BayarAman never exposes provider secrets to the client | Confirmed |
| PB-MP-003 | A verified Midtrans notification with `transaction_status=settlement` and `fraud_status=accept`, supplemented by Get Status API when needed, is required before BayarAman treats payment as authoritative; `capture` remains provider-success but not settlement-complete | Confirmed |
| PB-MP-004 | Duplicate, delayed, or out-of-order notifications and duplicate invoice requests are idempotent; amount mismatch, unknown status, and unverifiable notifications enter Admin reconciliation | Confirmed |
| PB-MP-005 | The BayarAman 1x24-hour deadline starts when the invoice is available, is stored as an absolute timestamp, and is not reset by retries or status refreshes; Midtrans `due_date` follows it when supported | Confirmed |
| PB-MP-006 | Expired invoices and late funds never revive the transaction; late funds follow a refund/reconciliation exception path | Confirmed |
| PB-MP-007 | Payout to Seller remains a separate BayarAman operation and is not implied by Midtrans payment settlement | Confirmed |
| PB-MP-008 | Refund uses Midtrans Refund API when the payment method supports it; otherwise Admin performs a manual refund to the Buyer refund destination; refund operations use `PROCESSING`, `SUCCESS`, `FAILED`, or `UNKNOWN`, with no automatic refund | Confirmed |
| PB-MP-009 | Production launch is blocked until Midtrans merchant settlement, custody of funds, legal/compliance, credentials, and webhook deployment are approved | Confirmed |

## 7. Manual And System Boundary

| Activity | Owner | Manual/system | Minimum system record |
| --- | --- | --- | --- |
| Register/sign in | Buyer or seller account | System | Account identity, mandatory WhatsApp number, contact-verification state, access history |
| Start transaction | Buyer or seller | System | Initiator account, initiator role, shared agreement, creation time |
| Complete buyer role | Account acting as buyer | System | Buyer account association and required buyer-role snapshot |
| Complete seller role | Account acting as seller | System | Seller account association and seller-role/payout snapshot |
| Invite and join counterparty | Initiator and counterparty | Shareable invitation plus authenticated system join | Invitation lifecycle, distinct-account check, joined account, opposite role, timestamp; self-join is rejected |
| Make transaction payable | System | System rule plus Midtrans invoice creation | Both roles complete, frozen amount, Midtrans invoice ID/link, provider status, original expiry timestamp, and idempotency reference |
| Pay invoice | Buyer | Midtrans hosted payment page | Buyer-facing payment link and provider transaction reference; BayarAman does not expose raw provider secrets |
| Receive payment notification | Midtrans and BayarAman | Provider webhook plus server-side signature/status validation | Immutable notification reference, order/transaction reference, provider status, fraud status, amount match result, received/processed timestamps, and audit event; duplicate or out-of-order notifications are idempotent |
| Check payment status | Buyer or Admin | Status read/refresh and exception handling | Current provider status, last checked time, and next action; refresh does not confirm payment independently |
| Create WA group and announce payment | Admin | Manual WhatsApp, checkpoint recorded in system | Buyer and seller transaction WhatsApp-number snapshots, group/announcement checkpoint, operator, timestamp |
| Ship goods and report completion | Seller and buyer, recorded by admin | Outside-system fulfillment and WhatsApp communication; admin records the result in BayarAman | Separate seller-complete and buyer-complete checkpoints, reporting source, operator, and timestamp; exact field shape remains a User Requirements decision |
| Generate confirmation link and verify OTP | Admin and system | Admin-triggered system flow; link and reminder posted manually; OTP sent through WhatsApp only | Link lifecycle, confirmation deadline, reminder checkpoint, exact buyer WhatsApp snapshot used in the group, delivery/verification result, timestamp; no channel switch |
| Review overdue buyer confirmation | Admin | Manual review, result recorded in system | Buyer-complete checkpoint and WA evidence, complaint/hold check, decision, reason, operator, timestamp; silence alone is insufficient |
| Resolve buyer-seller complaint | Buyer, seller, and admin | Negotiation outside system; hold and outcome recorded in BayarAman | Complaint record, `PAYOUT_ON_HOLD`, disabled payout/exception, written-WA evidence, admin/operator, outcome and amounts/references for seller release, buyer refund, or split; unresolved cases remain held |
| Request unfunded cancellation | Eligible buyer, seller, or initiator | System request; after payment instructions exist, system/admin reconciliation runs for at most two operating hours | Requester, role, reason, request time, payment/claim state, `CANCELLATION_PENDING_RECONCILIATION`, reconciliation result/time, and resulting `CANCELLED` record; late funds create a refund exception and do not revive the transaction |
| Review funded cancellation | Buyer, seller, and admin | Agreement/evidence handled in WhatsApp and recorded manually in BayarAman | Request, required responses, 1x24-hour deadline, seller's written not-shipped WA statement, admin checkpoint, cause, fee treatment, decision, operator, timestamp; no response records `MANUAL_REVIEW_REQUIRED` |
| Review risk cancellation | Admin and operational/compliance reviewer | Manual review with fulfillment and money movement held | `RISK_HOLD`, reason/evidence, reviewer, decision, allowed financial outcome, operator, and timestamps |
| Refund funded cancellation | Admin | Midtrans Refund API where supported, otherwise manual bank transfer; result recorded in system | Frozen buyer refund destination, item/shipping/service-fee calculation, provider/manual operation result, operator, timestamp, and financial reference |
| Transfer seller payout | Admin | Manual bank transfer, result recorded in system | Seller-owned payout snapshot, amount, operator, result, timestamp, reference |
| Expire unpaid transaction | System | System policy and provider-expiry coordination | Original invoice deadline, provider expiry state, late-fund result, and resulting status; expiry retry is idempotent |

## 8. Journey Seeds

| Journey | Starts when | Ends when |
| --- | --- | --- |
| Seller-created physical-goods transaction | An authenticated user starts a transaction as seller | Seller payout is recorded, an external issue requires another outcome, or the transaction expires unpaid |
| Buyer-created physical-goods transaction | An authenticated user starts a transaction as buyer | Seller payout is recorded, an external issue requires another outcome, or the transaction expires unpaid |
| Counterparty onboarding | An initiator sends a transaction invitation | The counterparty account joins in the opposite role and completes required role data |
| Buyer final confirmation | Admin posts the confirmation link after both completion checkpoints are recorded | Buyer OTP succeeds, an eligible admin exception is recorded, or payout remains held for manual follow-up |
| Complaint hold and settlement | Buyer or seller reports a complaint before payout | Written agreement is recorded and its release/refund/split transfers complete, or funds remain held for manual review |
| Unpaid transaction expiry | Required role data is complete and the Midtrans invoice becomes available | Authoritative payment confirmation arrives or the 1x24-hour deadline expires |
| Cancellation and cancellation refund | An eligible participant requests cancellation before the cancellation cutoff | The transaction becomes `CANCELLED`, funded money becomes `REFUNDED`, the request is rejected/withdrawn and the prior flow resumes, or unresolved evidence leaves funds in manual review |

## 9. Resolved And Deferred Decisions

### Resolved For User Journey

| ID | Resolution | Status |
| --- | --- | --- |
| PB-OD-001 | One account can act as buyer or seller per transaction; both roles may initiate | Confirmed |
| PB-OD-002 | Initiator enters shared deal details and own role data; invited counterparty enters their own role data | Confirmed |
| PB-OD-003 | Seller owns payout data, buyer owns buyer data, and both must have accounts; no actor authors the other's authoritative role data | Confirmed |
| PB-OD-004 | Transaction becomes payable after both role datasets are complete; joining/completing seller data replaces separate seller acceptance | Approved |
| PB-OD-005 | Expiry starts when the Midtrans invoice is available, is stored as an absolute deadline, and is not reset by status refresh, retry, or unresolved provider notification | Confirmed |
| PB-OD-006 | Each transaction has exactly two different accounts, one buyer and one seller; self-transactions are forbidden | Confirmed |
| PB-OD-007 | Completion reports stay in WhatsApp and admin records seller-complete and buyer-complete as two separate system checkpoints | Confirmed |
| PB-OD-008 | Buyer has 2x24 hours from confirmation-link creation to complete OTP, with a reminder after 1x24 hour; after timeout payout stays held, and only a fully audited admin exception based on the prior buyer-complete WA checkpoint may make payout eligible when no complaint/hold is known | Confirmed |
| PB-OD-009 | OTP is WhatsApp-only with no channel switch in MVP; the destination is the mandatory buyer WhatsApp-number snapshot used by admin when creating the transaction group | Confirmed |
| PB-OD-010 | Complaint negotiation stays outside the system, but admin must record payout hold and a written-WA final outcome of release, refund, or split; unresolved cases remain held and cannot use payout or confirmation exception | Confirmed |

### Resolved Midtrans Decisions

| ID | Decision | Needed by | Status |
| --- | --- | --- | --- |
| PB-MP-OD-001 | Midtrans Invoice API with `payment_type: payment_link` is the canonical integration; Payment Link API is not the primary path | Confirmed |
| PB-MP-OD-002 | Payment is authoritative only for `transaction_status=settlement` and `fraud_status=accept`; `capture` is provider-success but remains non-settled for BayarAman payout purposes | Confirmed |
| PB-MP-OD-003 | BayarAman owns the absolute 1x24-hour deadline; Midtrans `due_date` follows it when supported, and unsynchronized/late payment events enter reconciliation without reviving the transaction | Confirmed |
| PB-MP-OD-004 | Webhook events are signature-validated, idempotent, order-aware, and reconciled through Get Status API when delayed, duplicated, out-of-order, mismatched, or unknown | Confirmed |
| PB-MP-OD-005 | Production remains blocked until Midtrans merchant settlement/custody, legal/compliance, production credentials, and webhook deployment are approved | Confirmed launch gate |

### Required By Later Stages

| Needed by | Decisions |
| --- | --- |
| User Journey / UX Flow | Replace manual-bank `Sudah Bayar` and payment-review steps with invoice, hosted checkout, notification, status-refresh, exception, and late-fund paths using the resolved Midtrans decisions |
| User Requirements | Cancellation request/reason data, participant/admin permissions, refund calculation, sensitive evidence visibility, Midtrans notification/status handling, idempotency, and cancellation/refund SLA |
| QA Scenarios | Invoice creation and retry, duplicate/out-of-order webhook, signature failure, amount mismatch, provider `pending`/`capture`/`settlement`/`deny`/`cancel`/`failure`/`expire` handling, expiry, late funds, cancellation around payment events, and payout separation |
| PRD / TRD | Midtrans merchant account/custody boundary, provider outage handling, financial operation result mapping, and launch gate evidence |
| PRD approval | MVP success metrics, operating SLA, revenue model, and release acceptance |
| Before launch | Midtrans production credentials and webhook deployment, legal/compliance review for holding and moving customer funds, banking approval, privacy/retention policy, prohibited transactions, fraud controls, and incident procedures |

### Resolved Cancellation Decisions

The Product Owner confirmed all six cancellation decisions on 2026-07-19.

| ID | Resolution | Status |
| --- | --- | --- |
| PB-CAN-OD-001 | Initiator may cancel before counterparty join; either participant may cancel or request cancellation after join and before authoritative payment confirmation according to payment state; no separate cancellation fee applies before confirmed funds | Confirmed |
| PB-CAN-OD-002 | There is no separate cancellation fee; service-fee treatment follows the cancellation cause: buyer change of mind or neutral mutual funded cancellation retains it, while seller inability or BayarAman error refunds it | Confirmed |
| PB-CAN-OD-003 | Seller provides a written not-shipped statement in the transaction WA group and admin records the checkpoint; a shipment claim or conflicting evidence moves the case to complaint | Confirmed |
| PB-CAN-OD-004 | A funded cancellation requiring another participant's response has a 1x24-hour window; no response produces `MANUAL_REVIEW_REQUIRED`, never automatic refund or payout | Confirmed |
| PB-CAN-OD-005 | A prohibited item, suspected fraud, or related policy cancellation enters `RISK_HOLD`; operational/compliance review determines and records the allowed financial outcome | Confirmed |
| PB-CAN-OD-006 | Cancellation after the Midtrans invoice is available enters `CANCELLATION_PENDING_RECONCILIATION` for at most two operating hours; late funds are refunded and never revive the transaction | Confirmed |

## 10. Baseline Overrides

The current owner direction replaces these older baseline assumptions:

- Buyer and seller are transaction roles on one account model, not separate permanent account types.
- A transaction requires two distinct participant accounts and forbids self-dealing.
- Buyer-created transactions no longer ask buyer to author the seller payout account.
- Counterparties join and complete their own role data before payment; no separate seller accept/reject action is needed.
- Admin creates a WA group and announces payment before seller fulfillment.
- Completion uses separate seller/buyer WhatsApp reports recorded by admin, followed by a buyer OTP link.
- Buyer-confirmation timeout uses reminder, payout hold, and a controlled audited exception rather than silence-based auto-release.
- OTP is WhatsApp-only to the buyer number used in the transaction group, not a buyer-selected destination or email fallback.
- Complaint negotiation stays outside the system, while payout hold and release/refund/split outcomes remain auditable in BayarAman.
- `1x24 hours` is the unpaid-payment expiry, not a post-delivery auto-release window.
- The older fixed Rp5,000 cancel fee and Free/Pro exemption are not adopted; v0.8 confirms no separate cancellation fee and cause-based service-fee treatment.
- The older cancel path covered only pre-payment states; v0.8 confirms explicit unfunded, reconciliation-pending, under-review, funded-before-shipment, risk-hold, and post-shipment boundaries.
- Manual bank account instructions and Buyer `Sudah Bayar` claims are legacy behavior for migration purposes; the active direction is Midtrans Invoice API, hosted payment link, and verified provider notification.
- Existing BAYAR-004 manual-bank implementation must be revised after this Product Brief and its downstream artifacts are approved; this Product Brief revision does not itself change source code.

## 11. Approval

- [x] Problem, actors, account model, source precedence, and current MVP boundary are visible.
- [x] Role-specific data ownership is explicit.
- [x] Manual operations and minimum system responsibilities are separated.
- [x] Approved v0.8 rules and the Midtrans payment revision are visible.
- [x] Product owner resolves `PB-CAN-OD-001` through `PB-CAN-OD-006`.
- [x] Midtrans Invoice API, status mapping, invoice idempotency, notification validation, expiry, refund fallback, and payout separation are recorded.
- [x] Midtrans launch gate for merchant settlement/custody, legal/compliance, credentials, and webhook deployment is recorded.
- [x] Downstream User Journey, UX Flow, User Requirements, UI/UX, QA, PRD, and TRD remain unchanged and are deferred to their own stages.
- [x] Product owner changes the status from `Draft` to `Approved`.

Product Brief v0.10 is Approved. It does not synchronize User Journey, UX Flow, User Requirements, UI, wireframe, prototype, QA Scenarios, PRD, TRD, or source code; each downstream artifact changes only when its own workflow stage is explicitly requested.
