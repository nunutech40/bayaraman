# BayarAman User Journey

## 1. Document Control

```text
Product/feature: BayarAman MVP physical-goods transaction
Version: 0.6
Status: Approved
Owner: Product Owner BayarAman
Last updated: 2026-07-25
Source Product Brief: docs/product/00-product-brief.md v0.10 (Approved)
Previous approved version: 0.5 (2026-07-19)
Change request: Replace manual-bank payment journey with Midtrans invoice and webhook journey
Approved by: Product Owner BayarAman
Approved on: 2026-07-25
```

This artifact describes chronological behavior and handoffs. Status labels are journey candidates for review, not a database or API contract.

## 2. Journey Index

| Journey ID | Journey name | Primary actor | Starts when | Ends when |
| --- | --- | --- | --- | --- |
| `UJ-SELLER` | Seller-created transaction | User acting as seller | Authenticated user starts a transaction as seller | Seller payout, expiry, cancellation/refund, or complaint/risk/manual review takes ownership |
| `UJ-BUYER` | Buyer-created transaction | User acting as buyer | Authenticated user starts a transaction as buyer | Seller payout, expiry, cancellation/refund, or complaint/risk/manual review takes ownership |
| `UJ-CONFIRMATION-RECOVERY` | Buyer-confirmation timeout and controlled exception | Admin and system | Buyer confirmation link exists and OTP is incomplete | OTP succeeds, controlled exception makes payout eligible, or payout remains held |
| `UJ-COMPLAINT-HOLD` | External complaint, payout hold, and settlement | Buyer, seller, and Admin | Complaint is reported before payout processing | Seller release, buyer refund, split settlement, or funds remain held |
| `UJ-PAYMENT-RECOVERY` | Midtrans payment status, expiry, and late-fund recovery | Buyer, Admin, and system | Invoice exists or a provider event needs reconciliation | Authoritative payment, expiry, late-fund refund, or manual review |
| `UJ-CANCELLATION` | Controlled cancellation and refund | Buyer, seller, or Admin according to state | Eligible cancellation or risk concern is raised | `CANCELLED`, `REFUNDED`, valid prior flow resumes, or funds remain held |

## 3. Actor Definitions

### User Account

- One reusable account can act as Buyer or Seller in different transactions.
- The account supplies identity, authentication, and a mandatory verified WhatsApp number.
- The same account cannot be both participants in one transaction.

### Seller Role

- Owns seller-role data and payout destination.
- Ships only after Admin records authoritative Midtrans payment.
- Reports completion in WhatsApp and responds to eligible cancellation requests.

### Buyer Role

- Owns buyer-role data and pays the Midtrans invoice.
- Reports completion, receives OTP on the transaction WhatsApp snapshot, and confirms receipt.
- May request eligible cancellation.

### Admin

- Handles Midtrans exception/reconciliation, WhatsApp group operations, cancellation evidence, complaint hold, refund, and seller payout.
- Does not treat a Buyer status refresh as payment confirmation.
- Ops, Finance, Supervisor, and Reviewer are internal Admin task assignments, not product roles.

### BayarAman System

- Enforces participant, role, invitation, invoice, deadline, webhook, OTP, cancellation, audit, and financial-operation boundaries.
- Stores provider references and immutable event evidence without exposing provider secrets.

### Participant Invariants

- Every transaction has exactly two distinct authenticated accounts: one Buyer and one Seller.
- Each participant enters their own role-owned data.
- Buyer and Seller WhatsApp numbers are snapshotted for the transaction.
- Buyer OTP always targets the Buyer snapshot used for the transaction WhatsApp group.

## 4. Journey Detail

### 4.1 `UJ-SELLER` Metadata

```text
Journey ID: UJ-SELLER
Journey name: Seller-created physical-goods transaction
Primary actor: User acting as seller
Supporting actors: Buyer, Admin, BayarAman system, Midtrans
Entry point: Authenticated user chooses to create a transaction as Seller
End state: PAID_OUT, PAYMENT_EXPIRED, CANCELLED, REFUNDED, or complaint/risk/manual-review handoff
```

### 4.2 `UJ-SELLER` Steps

| Step ID | Actor | User action | System action | Manual operation? | Data involved | Status after step | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `UJ-SELLER-001` | Seller | Logs in or creates an account and supplies WhatsApp | Authenticates and requires verified WhatsApp before participation | No | Account, WhatsApp verification | No transaction | Verification mechanics remain in User Requirements |
| `UJ-SELLER-002` | Seller | Chooses Seller as transaction role | Creates transaction with Seller initiator | No | Initiator account, role | `DRAFT` | Account may be Buyer elsewhere |
| `UJ-SELLER-003` | Seller | Enters shared terms, goods, amount, and seller data including payout destination | Validates and stores Seller-owned data and WhatsApp snapshot | No | Frozen-candidate terms, Seller data, payout destination | `DRAFT` | Seller owns authoritative payout data |
| `UJ-SELLER-004` | Seller | Shares invitation link to Buyer | Creates invitation and records lifecycle | Yes, external sharing | Invitation token, initiator context | `WAITING_COUNTERPARTY` | Seller may cancel before Buyer joins |
| `UJ-SELLER-005` | Buyer | Opens invitation, logs in or creates a different account, and joins | Rejects same-account/self-join and assigns Buyer role | No | Buyer account, Seller account, invitation | `WAITING_COUNTERPARTY_DATA` | No Seller acceptance step |
| `UJ-SELLER-006` | Buyer | Enters Buyer data and verified WhatsApp | Stores Buyer-owned data and snapshot; checks both roles | No | Buyer data, Buyer WhatsApp snapshot | `WAITING_COUNTERPARTY_DATA` | Buyer owns their own data |
| `UJ-SELLER-007` | System | No user action | Freezes transaction terms and creates one idempotent Midtrans Invoice API invoice with `payment_type: payment_link` | No | Frozen terms, invoice ID, payment link, amount, invoice/deadline, idempotency reference | `WAITING_BUYER_PAYMENT` | BayarAman deadline starts when invoice is available |
| `UJ-SELLER-008` | Buyer | Opens hosted Midtrans payment page | Displays invoice/payment methods through Midtrans | No | Payment link, invoice details | `WAITING_BUYER_PAYMENT` | No manual BayarAman bank instruction |
| `UJ-SELLER-009` | Buyer | Pays the invoice | Midtrans processes payment and sends notification | No | Provider transaction, amount, payment method | `WAITING_BUYER_PAYMENT` or provider pending | Buyer cannot confirm payment by button |
| `UJ-SELLER-010` | Midtrans/System | Sends payment notification | Validates signature, order ID, amount, and fraud status; deduplicates event | No | Webhook event, provider status, fraud status | `WAITING_BUYER_PAYMENT` or `PAYMENT_UNDER_REVIEW` | `pending`, `capture`, `settlement`, `deny`, `cancel`, `failure`, and `expire` are handled distinctly |
| `UJ-SELLER-011` | System/Admin | No user action or reviews an exception | Uses Get Status API for delayed, duplicate, out-of-order, mismatched, or unknown event | Yes for exception review | Provider reference, status lookup, reconciliation evidence | `PAYMENT_UNDER_REVIEW` or `PAYMENT_CONFIRMED` | `settlement + accept` is authoritative; `capture` is not settlement-complete |
| `UJ-SELLER-012` | Admin | Records/observes authoritative payment | Records payment event and creates WhatsApp group from transaction snapshots | Yes, WhatsApp | Verified provider event, group reference, participant snapshots | `WA_GROUP_CREATED` | Midtrans settlement is not Seller payout |
| `UJ-SELLER-013` | Admin | Announces payment received in group | Records announcement checkpoint | Yes, WhatsApp | Announcement, operator, timestamp | `READY_FOR_FULFILLMENT` | Shipping trigger |
| `UJ-SELLER-014` | Seller | Ships physical goods | Waits for completion reports | Yes, outside system | Goods/shipping information | `WAITING_COMPLETION_REPORTS` | Shipment ends cancellation eligibility |
| `UJ-SELLER-015` | Seller or Buyer, then Admin | First party reports completion in WhatsApp | Records role-specific checkpoint | Yes, WhatsApp/admin entry | Report reference, role, operator, time | `WAITING_OTHER_COMPLETION_REPORT` | No automatic WhatsApp parsing |
| `UJ-SELLER-016` | Other party, then Admin | Other party reports completion | Records second checkpoint and enables confirmation link | Yes, WhatsApp/admin entry | Second report reference, role, operator, time | `READY_FOR_BUYER_CONFIRMATION` | Both checkpoints required |
| `UJ-SELLER-017` | Admin | Posts Buyer confirmation link in group | Creates link and starts 2x24-hour confirmation window | Yes, WhatsApp | Link token, deadline, Buyer | `WAITING_BUYER_CONFIRMATION` | Timeout follows `UJ-CONFIRMATION-RECOVERY` |
| `UJ-SELLER-018` | Buyer | Opens link and requests/receives OTP | Sends OTP only to Buyer WhatsApp snapshot | No | OTP challenge, fixed destination, delivery result | `WAITING_BUYER_CONFIRMATION` | No email or alternate number |
| `UJ-SELLER-019` | Buyer | Enters OTP and confirms goods received | Records confirmation and makes payout eligible only without hold | No | OTP result, confirmation time, hold state | `READY_FOR_PAYOUT` or `PAYOUT_ON_HOLD` | No money moves yet |
| `UJ-SELLER-020` | Admin | Processes seller payout | Executes separate payout operation and records result | Yes, bank/manual payout | Seller payout snapshot, operation result, reference | `PAYOUT_PROCESSING` | Payment provider settlement is not payout |
| `UJ-SELLER-021` | Admin | Records payout success and evidence | Closes successful payout | No | Financial reference, evidence, time | `PAID_OUT` | Only `SUCCESS` with evidence is terminal |

### 4.3 `UJ-BUYER` Metadata

```text
Journey ID: UJ-BUYER
Journey name: Buyer-created physical-goods transaction
Primary actor: User acting as buyer
Supporting actors: Seller, Admin, BayarAman system, Midtrans
Entry point: Authenticated user chooses to create a transaction as Buyer
End state: PAID_OUT, PAYMENT_EXPIRED, CANCELLED, REFUNDED, or complaint/risk/manual-review handoff
```

### 4.4 `UJ-BUYER` Steps

The Buyer-created journey follows the same payment and fulfillment sequence as `UJ-SELLER`; only initiator role and counterparty role reverse.

| Step ID | Actor | User action | System action | Manual operation? | Data involved | Status after step | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `UJ-BUYER-001` | Buyer | Logs in or creates an account and supplies WhatsApp | Authenticates and requires verified WhatsApp | No | Account, WhatsApp verification | No transaction | Same account may be Seller elsewhere |
| `UJ-BUYER-002` | Buyer | Chooses Buyer as transaction role | Creates transaction with Buyer initiator | No | Initiator account, role | `DRAFT` | |
| `UJ-BUYER-003` | Buyer | Enters shared terms and Buyer-owned data | Stores Buyer data and WhatsApp snapshot | No | Terms, Buyer data, snapshot | `DRAFT` | Buyer does not author Seller payout data |
| `UJ-BUYER-004` | Buyer | Shares invitation link to Seller | Creates invitation | Yes, external sharing | Invitation token | `WAITING_COUNTERPARTY` | Buyer may cancel before Seller joins |
| `UJ-BUYER-005` | Seller | Opens invitation, logs in/creates a different account, and joins | Rejects same-account join and assigns Seller role | No | Seller account, Buyer account, invitation | `WAITING_COUNTERPARTY_DATA` | No Seller acceptance step |
| `UJ-BUYER-006` | Seller | Enters Seller data, payout destination, and verified WhatsApp | Stores Seller-owned data and checks both roles | No | Seller data, payout destination, snapshot | `WAITING_COUNTERPARTY_DATA` | Seller owns payout data |
| `UJ-BUYER-007` | System | No user action | Freezes terms and creates one idempotent Midtrans Invoice API invoice with `payment_type: payment_link` | No | Frozen terms, invoice ID/link, deadline | `WAITING_BUYER_PAYMENT` | Starts 1x24-hour deadline |
| `UJ-BUYER-008` | Buyer | Opens hosted Midtrans payment page | Displays invoice/payment methods through Midtrans | No | Payment link, invoice details | `WAITING_BUYER_PAYMENT` | |
| `UJ-BUYER-009` | Buyer | Pays invoice | Midtrans processes payment and sends notification | No | Provider transaction, amount | `WAITING_BUYER_PAYMENT` or provider pending | No `Sudah Bayar` confirmation |
| `UJ-BUYER-010` | Midtrans/System | Sends notification | Validates signature, order ID, amount, and fraud status | No | Webhook, provider status, fraud status | Existing payment state | Duplicate/out-of-order is idempotent |
| `UJ-BUYER-011` | System/Admin | No user action or reviews exception | Uses Get Status API when needed; `settlement + accept` becomes authoritative | Yes for exception | Provider status, reconciliation evidence | `PAYMENT_UNDER_REVIEW` or `PAYMENT_CONFIRMED` | `capture` is not settlement-complete |
| `UJ-BUYER-012` | Admin | Records authoritative payment and creates WA group | Records group checkpoint from snapshots | Yes, WhatsApp | Provider event, group reference | `WA_GROUP_CREATED` | Not payout |
| `UJ-BUYER-013` | Admin | Announces payment received | Records announcement | Yes, WhatsApp | Announcement checkpoint | `READY_FOR_FULFILLMENT` | |
| `UJ-BUYER-014` | Seller | Ships goods | Waits for completion reports | Yes, outside system | Goods/shipping data | `WAITING_COMPLETION_REPORTS` | |
| `UJ-BUYER-015` | First party, then Admin | Reports completion in WhatsApp | Records first role checkpoint | Yes, WhatsApp/admin | Report reference, role, time | `WAITING_OTHER_COMPLETION_REPORT` | |
| `UJ-BUYER-016` | Other party, then Admin | Reports completion | Records second checkpoint | Yes, WhatsApp/admin | Report reference, role, time | `READY_FOR_BUYER_CONFIRMATION` | |
| `UJ-BUYER-017` | Admin | Posts Buyer confirmation link | Starts confirmation window | Yes, WhatsApp | Link token, deadline | `WAITING_BUYER_CONFIRMATION` | |
| `UJ-BUYER-018` | Buyer | Opens link and receives OTP | Sends OTP to fixed Buyer snapshot | No | OTP challenge, delivery result | `WAITING_BUYER_CONFIRMATION` | |
| `UJ-BUYER-019` | Buyer | Enters OTP and confirms receipt | Records confirmation and payout eligibility | No | OTP result, hold state | `READY_FOR_PAYOUT` or `PAYOUT_ON_HOLD` | |
| `UJ-BUYER-020` | Admin | Processes Seller payout | Executes separate payout operation | Yes, bank/manual payout | Seller destination, operation result | `PAYOUT_PROCESSING` | |
| `UJ-BUYER-021` | Admin | Records payout success | Closes payout | No | Reference, evidence, time | `PAID_OUT` | |

### 4.5 `UJ-CONFIRMATION-RECOVERY`

| Step ID | Actor | User action | System action | Manual operation? | Data involved | Status after step | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `UJ-CONFIRMATION-RECOVERY-001` | System | No action | Starts 2x24-hour window and binds OTP to Buyer snapshot | No | Link, deadline, WhatsApp snapshot | `WAITING_BUYER_CONFIRMATION` | |
| `UJ-CONFIRMATION-RECOVERY-002` | Admin | Posts reminder after 1x24 hour | Records reminder checkpoint | Yes, WhatsApp | Reminder, operator, time | `WAITING_BUYER_CONFIRMATION` | |
| `UJ-CONFIRMATION-RECOVERY-003` | System | No valid OTP by 2x24 hours | Marks confirmation overdue and keeps payout held | No | Deadline, OTP state | `BUYER_CONFIRMATION_OVERDUE` | Silence never pays out |
| `UJ-CONFIRMATION-RECOVERY-004` | Admin | Reviews Buyer-complete checkpoint, evidence, and holds | Evaluates exception eligibility | Yes | Evidence, complaint/hold state | `BUYER_CONFIRMATION_OVERDUE` | |
| `UJ-CONFIRMATION-RECOVERY-005` | Admin | Records eligible controlled exception | Makes payout eligible and audits reason | Yes | Evidence, reason, operator | `READY_FOR_PAYOUT` | Payout remains separate |
| `UJ-CONFIRMATION-RECOVERY-006` | Admin | Rejects exception | Keeps payout held | Yes | Review result, reason | `MANUAL_REVIEW_REQUIRED` | |
| `UJ-CONFIRMATION-RECOVERY-007` | Buyer | Completes valid OTP | Records confirmation and payout eligibility | No | OTP result, hold state | `READY_FOR_PAYOUT` or `PAYOUT_ON_HOLD` | |

### 4.6 `UJ-COMPLAINT-HOLD`

| Step ID | Actor | User action | System action | Manual operation? | Data involved | Status after step | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `UJ-COMPLAINT-HOLD-001` | Buyer or Seller | Reports complaint in WhatsApp before payout | Does not parse WhatsApp automatically | Yes | Reporter, WA context, time | Current state | Negotiation stays outside system |
| `UJ-COMPLAINT-HOLD-002` | Admin | Records complaint | Places payout hold and disables exception | Yes | Complaint, operator, time | `PAYOUT_ON_HOLD` | |
| `UJ-COMPLAINT-HOLD-003` | Buyer and Seller | Negotiate outside system | Keeps funds held | Yes | External discussion | `PAYOUT_ON_HOLD` | |
| `UJ-COMPLAINT-HOLD-004` | Admin | Records no agreement | Keeps funds held | Yes | Follow-up note | `MANUAL_REVIEW_REQUIRED` | |
| `UJ-COMPLAINT-HOLD-005` | Admin | Records written agreement and outcome | Enables only agreed financial operation | Yes | WA evidence, amounts, outcome | `SETTLEMENT_READY` | Seller release, Buyer refund, or split |
| `UJ-COMPLAINT-HOLD-006` | Admin | Selects seller release | Enables payout | Yes | Agreement evidence | `READY_FOR_PAYOUT` | |
| `UJ-COMPLAINT-HOLD-007` | Admin | Starts Buyer refund | Uses Midtrans Refund API if supported, otherwise manual refund | Yes | Refund destination, amount, operation | `REFUND_PROCESSING` | |
| `UJ-COMPLAINT-HOLD-008` | Admin | Records refund success | Closes refund | No | Reference, evidence | `REFUNDED` | |
| `UJ-COMPLAINT-HOLD-009` | Admin | Starts agreed split | Executes separate operations | Yes | Seller/Buyer amounts, references | `SPLIT_PROCESSING` | |
| `UJ-COMPLAINT-HOLD-010` | Admin | Records both successful transfers | Closes split | No | Both references | `SPLIT_SETTLED` | |

### 4.7 `UJ-PAYMENT-RECOVERY`

| Step ID | Actor | User action | System action | Manual operation? | Data involved | Status after step | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `UJ-PAYMENT-RECOVERY-001` | System | No action | Starts absolute 1x24-hour deadline when invoice is available; aligns Midtrans `due_date` if supported | No | Invoice, deadline, due date | `WAITING_BUYER_PAYMENT` | Retry does not reset deadline |
| `UJ-PAYMENT-RECOVERY-002` | System/Midtrans | No payment before deadline | Expires BayarAman and handles provider expiry | No | Deadline, provider status | `PAYMENT_EXPIRED` | No revival |
| `UJ-PAYMENT-RECOVERY-003` | Midtrans | Sends `pending` | Keeps payment waiting | No | Notification, provider reference | `WAITING_BUYER_PAYMENT` | Not paid |
| `UJ-PAYMENT-RECOVERY-004` | Midtrans/System | Sends `capture` or unknown/out-of-order event | Records event and calls Get Status API when needed | No/yes for Admin exception | Event, lookup result | `PAYMENT_UNDER_REVIEW` | `capture` is not settlement-complete |
| `UJ-PAYMENT-RECOVERY-005` | Midtrans/System | Sends `settlement + accept` | Validates and records authoritative payment | No | Signature, order ID, amount, fraud status | `PAYMENT_CONFIRMED` | Continues to WA group |
| `UJ-PAYMENT-RECOVERY-006` | Midtrans/System | Sends `deny`, `cancel`, `failure`, or `expire` | Records failed/expired provider result without marking paid | No | Provider status, reason | `PAYMENT_EXPIRED` or existing non-paid state | No payout |
| `UJ-PAYMENT-RECOVERY-007` | Admin | Reconciles signature failure, amount mismatch, outage, unknown, or late event | Records manual decision; late funds use refund exception | Yes | Provider evidence, decision, timestamps | `MANUAL_REVIEW_REQUIRED`, `REFUND_PROCESSING`, or approved state | No transaction revival |

### 4.8 `UJ-CANCELLATION`

| Step ID | Actor | User action | System action | Manual operation? | Data involved | Status after step | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `UJ-CANCELLATION-001` | Eligible actor/Admin | Requests cancellation or records risk reason | Validates actor, payment, shipment, and financial state | Yes for Admin risk | Requester, cause, state, time | `CANCELLATION_REQUESTED` or `RISK_HOLD` | |
| `UJ-CANCELLATION-002` | Initiator | Cancels before counterparty joins | Closes invitation and transaction | No | Initiator, invitation, reason | `CANCELLED` | |
| `UJ-CANCELLATION-003` | Buyer/Seller | Cancels after join before invoice | Closes unfunded transaction | No | Participants, reason | `CANCELLED` | |
| `UJ-CANCELLATION-004` | Buyer/Seller | Requests cancellation after invoice before authoritative payment | Deactivates invoice flow and starts max two-operating-hour reconciliation | No | Request, deadline, invoice | `CANCELLATION_PENDING_RECONCILIATION` | |
| `UJ-CANCELLATION-005` | System/Admin | Reconciles pending/unknown payment status | Uses webhook/status evidence; does not treat absence of webhook as no-fund | Yes for exception | Provider event, lookup, evidence | `PAYMENT_UNDER_REVIEW` | |
| `UJ-CANCELLATION-006` | Admin | Records definitive no-payment result before deadline | Completes unfunded cancellation | Yes | Provider result, operator, time | `CANCELLED` | |
| `UJ-CANCELLATION-007` | Admin | Records `settlement + accept` | Moves to funded-cancellation review | Yes | Provider evidence, amount | `FUNDED_CANCELLATION_REVIEW` | |
| `UJ-CANCELLATION-008` | Admin | Detects late authoritative payment after cancellation | Creates late-fund refund exception without revival | Yes | Cancelled transaction, provider reference | `REFUND_READY` | |
| `UJ-CANCELLATION-009` | Admin | Starts late-fund refund | Uses Midtrans Refund API if supported, otherwise manual refund | Yes | Amount, destination, operation | `REFUND_PROCESSING` | |
| `UJ-CANCELLATION-010` | Admin | Records refund success | Closes late-fund exception | No | Reference, evidence | `REFUNDED` | |
| `UJ-CANCELLATION-011` | Buyer/Seller | Requests cancellation while payment is pending/unknown/reconciled | Keeps request pending until authoritative result | No | Request, provider state | `PAYMENT_UNDER_REVIEW` | No automatic result |
| `UJ-CANCELLATION-012` | Admin | Records definitive non-paid provider outcome | Applies unfunded outcome | Yes | Provider result | `CANCELLED` | |
| `UJ-CANCELLATION-013` | Admin | Records authoritative settlement | Applies funded-cancellation branch | Yes | Settlement evidence | `FUNDED_CANCELLATION_REVIEW` | |
| `UJ-CANCELLATION-014` | Buyer/Seller/Admin | Requests or continues funded cancellation before shipment | Holds fulfillment and payout | Yes for Admin review | Cause, shipment state | `FUNDED_CANCELLATION_REVIEW` | Not unilateral authorization |
| `UJ-CANCELLATION-015` | Admin | Uses WA group and requests response | Records message reference and starts 1x24-hour response window | Yes | Group/message reference, deadline | `FUNDED_CANCELLATION_REVIEW` | |
| `UJ-CANCELLATION-016` | Seller/participant/Admin | Seller states whether goods shipped and participant responds | Records immutable WA evidence/checkpoints | Yes | Statement, response, timestamp | `FUNDED_CANCELLATION_REVIEW` | |
| `UJ-CANCELLATION-017` | System/Admin | Response deadline passes without response | Holds fulfillment/payout and records unresolved review | Yes for Admin review | Deadline, missing response | `MANUAL_REVIEW_REQUIRED` | No auto-refund/payout |
| `UJ-CANCELLATION-018` | Seller/Admin | Shipment or conflicting evidence is reported | Stops cancellation and hands off to complaint | Yes | Evidence, operator | `PAYOUT_ON_HOLD` | |
| `UJ-CANCELLATION-019` | Admin | Accepts evidence, cause, responses, and refund calculation | Makes approved refund operation available | Yes | Cause, amount, fee, evidence | `REFUND_READY` | No separate cancellation fee |
| `UJ-CANCELLATION-020` | Admin | Starts cancellation refund | Uses Midtrans refund where supported, otherwise manual refund | Yes | Amount, destination, operation result | `REFUND_PROCESSING` | Result: `PROCESSING`, `SUCCESS`, `FAILED`, `UNKNOWN` |
| `UJ-CANCELLATION-021` | Admin | Records refund success | Closes funded cancellation | No | Financial reference/evidence | `REFUNDED` | Only `SUCCESS` is terminal |
| `UJ-CANCELLATION-022` | Admin | Records prohibited item, fraud, or policy concern | Blocks fulfillment and money movement | Yes | Risk reason/evidence | `RISK_HOLD` | No default financial outcome |
| `UJ-CANCELLATION-023` | Admin | Records operational/compliance outcome | Enables only authorized manual operation | Yes | Evidence, decision, operator | `RISK_HOLD` or authorized held/refund state | No new product role |
| `UJ-CANCELLATION-024` | Buyer/Seller | Attempts cancellation after shipment or financial processing | Rejects cancellation and preserves existing operation | No | State, rejection reason | Existing state or complaint hold | No reversal |
| `UJ-CANCELLATION-025` | Requester/Admin | Withdraws or rejects request before financial operation | Resumes only a still-valid prior state; validates state version | Yes for Admin rejection | Request, reason, prior state | Prior valid state or `MANUAL_REVIEW_REQUIRED` | Idempotency belongs downstream |

## 5. Data Inputs

### Account Inputs

- Identity, email, password, mandatory verified WhatsApp number, and authentication data.

### Initiator Inputs

- Initiator role, shared transaction terms, physical-goods details, amount, and invitation context.

### Buyer Inputs

- Buyer-owned data, shipping data, Midtrans invoice payment, completion report, OTP, and eligible cancellation response/request.

### Seller Inputs

- Seller-owned data, payout destination, completion report, shipment statement, and eligible cancellation response/request.

### Admin Inputs

- Webhook/status exception decisions, WA checkpoints, cancellation evidence, complaint/risk hold, refund/payout operation result, operator, timestamps, and financial references.

### System/Provider Data

- Frozen terms, Midtrans invoice ID/link, provider transaction/order ID, deadline, webhook reference, provider status, fraud status, amount match, idempotency reference, Get Status result, OTP lifecycle, audit events, and financial operation evidence.

## 6. Status Timeline

### Main Journey

```text
DRAFT
-> WAITING_COUNTERPARTY
-> WAITING_COUNTERPARTY_DATA
-> WAITING_BUYER_PAYMENT
-> PAYMENT_UNDER_REVIEW (provider exception, capture, unknown, or reconciliation)
-> PAYMENT_CONFIRMED (settlement + fraud_status=accept)
-> WA_GROUP_CREATED
-> READY_FOR_FULFILLMENT
-> WAITING_COMPLETION_REPORTS
-> WAITING_OTHER_COMPLETION_REPORT
-> READY_FOR_BUYER_CONFIRMATION
-> WAITING_BUYER_CONFIRMATION
-> READY_FOR_PAYOUT
-> PAYOUT_PROCESSING
-> PAID_OUT
```

`PAYMENT_CONFIRMED` is reached only from `settlement + fraud_status=accept`. `capture` is not payout eligibility. No new transaction state is introduced by this journey.

### Payment Recovery

```text
WAITING_BUYER_PAYMENT
-> PAYMENT_EXPIRED (deadline/provider expire)
-> PAYMENT_UNDER_REVIEW (unknown, mismatch, signature failure, capture, outage)
-> PAYMENT_CONFIRMED (settlement + accept)
```

`pending`, `deny`, `cancel`, `failure`, and `expire` never become paid. Late payment never revives a transaction and enters refund/reconciliation.

### Confirmation Recovery

```text
WAITING_BUYER_CONFIRMATION
-> READY_FOR_PAYOUT (valid OTP)
-> BUYER_CONFIRMATION_OVERDUE (no OTP after 2x24 hours)
-> READY_FOR_PAYOUT (eligible audited Admin exception)
-> MANUAL_REVIEW_REQUIRED (exception blocked)
```

### Complaint, Cancellation, and Refund

```text
Eligible pre-invoice state -> CANCELLATION_REQUESTED -> CANCELLED
Invoice available -> CANCELLATION_PENDING_RECONCILIATION
-> CANCELLED (definitive non-paid result)
-> FUNDED_CANCELLATION_REVIEW (settlement + accept)
-> MANUAL_REVIEW_REQUIRED (timeout/conflict)
-> REFUND_READY -> REFUND_PROCESSING -> REFUNDED
```

Financial operation result is only `PROCESSING`, `SUCCESS`, `FAILED`, or `UNKNOWN`. `UNKNOWN` requires reconciliation before retry.

## 7. Notifications And Channel Handoffs

| Moment | Channel | Recipient | Message intent |
| --- | --- | --- | --- |
| Invitation created | BayarAman/external link | Counterparty | Join in the opposite role |
| Invoice created | BayarAman | Buyer | Open Midtrans hosted payment page and deadline |
| Payment pending | BayarAman/Midtrans | Buyer | Payment is not confirmed yet |
| Payment authoritative | BayarAman and WhatsApp | Buyer/Seller | Payment verified; Admin will create group |
| Webhook exception | BayarAman | Admin | Reconciliation required; no payment assumption |
| Invoice expiry | BayarAman | Buyer/Seller/Admin | Payment window closed; late funds do not revive transaction |
| WA group created | WhatsApp | Buyer/Seller | Trust group is ready |
| Payment announced | WhatsApp | Buyer/Seller | Seller may ship |
| Confirmation link | WhatsApp | Buyer | Confirm receipt with WhatsApp OTP |
| Confirmation reminder | WhatsApp | Buyer | Complete OTP before deadline |
| Payout/refund | BayarAman/approved operational channel | Seller/Buyer | Show operation result and reference |
| Cancellation/reconciliation | BayarAman/WhatsApp | Buyer/Seller/Admin | Explain pending, funded, cancelled, held, or refunded outcome |

## 8. Edge Cases And Outside-System Boundaries

- Same-account or self-join is rejected.
- Missing or unverified WhatsApp prevents participation.
- Invitation expiry, wrong account, or revoked token remains before payable state.
- Buyer or Seller incomplete data prevents invoice creation.
- Duplicate invoice request returns the same invoice result.
- Provider signature failure, amount mismatch, unknown status, outage, duplicate, delayed, or out-of-order webhook enters reconciliation.
- `settlement + accept` is required for authoritative payment; `capture` does not make payout eligible.
- Invoice retry does not reset the 1x24-hour deadline.
- Invoice expiry and BayarAman expiry close the transaction; late payment never revives it.
- Cancellation after invoice requires reconciliation; lack of webhook alone is not proof of no payment.
- Cancellation after settlement enters funded cancellation; cancellation after shipment or financial processing is rejected and follows complaint/hold.
- Funded cancellation requires Seller not-shipped evidence and Admin checkpoint.
- Funded response timeout after 1x24 hours becomes `MANUAL_REVIEW_REQUIRED`, never automatic refund/payout.
- Refund uses Midtrans when supported, otherwise Admin manual refund; failed/unknown operations do not become terminal success.
- OTP delivery failure, invalid OTP, expiry, or buyer silence keeps payout held; no email fallback or alternate number.
- Complaint negotiation stays outside BayarAman; Admin records hold and agreed seller release, Buyer refund, or split outcome.
- Production remains blocked until merchant settlement/custody, legal/compliance, production credentials, and webhook deployment are approved.

## 9. Open Questions For Review

- Exact existing transaction-state mapping for `settlement + accept` must be confirmed against the approved TRD without adding a new state.
- Exact Midtrans due-date behavior when provider cannot accept the BayarAman deadline remains a TRD/QA implementation detail.
- Refund-method availability by Midtrans payment method and the manual fallback controls remain a User Requirements/QA detail.
- Production merchant settlement/custody and legal/compliance launch evidence remain required before production.

## 10. Acceptance Summary

- [x] Seller-created and Buyer-created journeys use one account model and distinct participant accounts.
- [x] Role-owned data, invitation, WhatsApp snapshots, and manual Admin handoffs are explicit.
- [x] Midtrans Invoice API and hosted payment-link flow replace manual bank instructions.
- [x] Payment authority is `settlement + fraud_status=accept`; Buyer action never confirms payment.
- [x] Webhook validation, idempotency, out-of-order handling, status lookup, expiry, and late-fund recovery are explicit.
- [x] Cancellation, complaint, risk hold, refund, payout, OTP, and confirmation recovery remain represented.
- [x] Existing relevant Journey IDs, including `UJ-CANCELLATION-001..025`, are retained.
- [x] Product owner reviews and changes User Journey v0.6 from `Draft` to `Approved`.

User Journey v0.6 is Approved. The remaining implementation details are deferred to their owning downstream stages. This approval does not change Product Brief, User Requirements, UI/UX, QA, PRD, TRD, tickets, or source code.
