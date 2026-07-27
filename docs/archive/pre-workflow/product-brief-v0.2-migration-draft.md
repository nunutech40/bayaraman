# BayarAman Product Brief

> Archived on 2026-07-16. This was a one-time migration audit containing legacy conflicts and is not an active product source. No Product Brief is currently active; a future draft will be created fresh from `requirenment/`.

## 1. Document Control

```text
Product: BayarAman
Version: Product Brief v0.2
Status: Draft for final product owner approval
Owner: BayarAman Product Owner
Last updated: 2026-07-16
```

This brief is the first active product artifact. It captures confirmed owner direction, separates it from older assumptions, and must be approved before a new User Journey is created.

Product-owner decisions recorded on 2026-07-16:

- MVP supports physical goods only.
- Seller-created flow: seller enters the deal and seller data; buyer enters their own contact data after opening the shared link.
- Buyer-created flow: buyer enters the deal, buyer data, and seller contact/payout data.

## 2. Source Inputs And Precedence

| Source | Date/version | What it contributes | Priority | Conflict notes |
| --- | --- | --- | --- | --- |
| Product owner's latest flow and decision responses | Current direction, 2026-07-16 | Core actors, sequence, physical-goods scope, data ownership, OTP, external complaint handling, and 1x24-hour expiry | Highest | Overrides seller-acceptance, seller-entered buyer-contact, service-scope, and automation assumptions in older artifacts |
| `AGENTS.md` raw product direction and guardrails | Current repository snapshot | Consolidated owner flow, role boundary, payment truth, payout and audit guardrails | High | Product details beyond the raw journey still require owner review |
| `README.md` | Current reference draft | Positioning, manual-payment model, proposed fee model, exclusions | Reference | Fees, limits, tiers, and some exclusions were not reaffirmed in the latest direction |
| `PRD.md` v4.0 | 2026-07-14 reference draft | Candidate scope, rules, screens, metrics, and requirements | Reference | Contains seller acceptance/verification and auth/admin assumptions not confirmed by the latest direction |
| `TRD.md` v4.0 | 2026-07-14 reference draft | Candidate system boundaries, state model, APIs, and technical constraints | Reference | Technical choices are not product approval and must wait for the Engineering phase |
| `prototype/` | Current static prototype | Candidate forms, operational controls, status progression, and static data | Reference | Contains stale seller-verification guidance and hardcoded fee, bank account, and OTP demo values |
| Archived pre-brief User Journey | Archived 2026-07-16 | Candidate fields, alternate cases, and detailed operational assumptions | Reference only | Created before this brief; it is not an approved source |
| Customer research, legal review, and live operational evidence | Not available | Validation of demand, trust, compliance, fraud, and operational feasibility | Missing | Must not be implied as completed |

Source precedence when artifacts conflict:

1. Latest explicit product-owner direction.
2. Approved product artifacts.
3. Active repository guardrails.
4. Existing draft documents.
5. Prototype and archived behavior.

## 3. Problem

```text
Who has the problem:
Buyers and sellers who make goods transactions outside a marketplace and need a trusted intermediary.

Current situation:
The parties coordinate directly, while payment, shipment, completion, and fund release do not share one trusted process.

Main risk/friction:
The buyer risks paying without receiving the goods, the seller risks shipping without reliable payment assurance, and manual coordination can become ambiguous or unauditable.

Why it matters now:
BayarAman needs to validate a simple, manually operated rekber flow before committing to payment, WhatsApp, or payout automation.
```

## 4. Product Proposition

BayarAman helps buyers and sellers complete goods transactions outside marketplaces with a shared trust process by receiving buyer funds into a BayarAman account, having an operator verify payment and coordinate fulfillment, requiring buyer OTP confirmation, and manually paying the seller after completion.

The MVP validates this trust workflow without requiring BayarAman to become a marketplace, wallet, automated payment gateway, or automated payout service.

## 5. Actors

| Actor | Context | Main goal | Responsibility boundary |
| --- | --- | --- | --- |
| Seller | Sells goods outside a marketplace; may create the BayarAman transaction or be entered by the buyer | Ship only after BayarAman confirms and announces payment; receive the agreed payout | Supplies seller identity/payout data as required, fulfills the order, and reports completion; does not confirm buyer payment |
| Buyer | Buys goods outside a marketplace; may create or open a BayarAman transaction | Pay through the trust flow and control final completion confirmation | Pays BayarAman, submits `Sudah Bayar`, participates in the WA group, and confirms completion using OTP |
| Admin/Operator | Runs the BayarAman manual trust operation | Move each transaction through payment review, coordination, confirmation, and payout with clear evidence | Checks the bank account, creates and manages the WA group, sends the confirmation link, and transfers seller payout |
| BayarAman system | Supports the transaction and records trusted checkpoints | Keep the parties informed and preserve the transaction record | Must not represent a buyer claim as confirmed payment or represent a manual transfer as automatic |

Buyer and seller are roles within each transaction, not permanent global account types.

## 6. Desired Outcomes

| Actor/business | Desired outcome | Observable signal |
| --- | --- | --- |
| Buyer | Funds are not released to the seller before the agreed completion confirmation | Buyer can see the trusted flow and a seller payout becomes eligible only after valid confirmation or an authorized final outcome |
| Seller | Has evidence that BayarAman received payment before shipping | Seller receives the admin payment announcement before fulfillment and later receives a recorded payout |
| Admin/Operator | Can identify the next valid manual action without confusing a claim with confirmation | Each critical operation has an owner, prerequisite, status, timestamp, and note/reference where needed |
| BayarAman | Validates whether the manual rekber operation is useful and operable before automating it | Transactions can complete, expire, or reach a recorded alternate outcome with traceable operational history |

No numeric success targets are approved yet.

## 7. MVP Scope

### Confirmed Flow Scope

- In the seller-created flow, seller enters the deal details plus seller identity, WhatsApp, and payout-bank data, then shares the transaction link.
- After opening a seller-created link, buyer enters their own name, WhatsApp, and email before paying.
- In the buyer-created flow, buyer enters the deal details, their own name/WhatsApp/email, and the seller name/WhatsApp/payout-bank data.
- Buyer pays to a BayarAman-controlled bank account.
- Buyer clicks `Sudah Bayar` after transferring.
- Admin manually checks whether the payment arrived.
- Admin manually creates a WhatsApp group and announces that payment arrived.
- Seller ships the goods only after that announcement.
- Seller and buyer report in the group when the order is complete.
- Admin sends a buyer confirmation link in the group.
- Buyer confirms using OTP delivered through email or WhatsApp.
- Admin manually transfers the seller payout after valid buyer confirmation.
- A transaction that remains unpaid expires after 1x24 hours.
- Buyer-seller complaint handling happens outside the system.

### Proposed Supporting Scope, Pending Product Review

- A transaction record accessible to the relevant buyer, seller, and operator.
- Minimum status and audit tracking for payment claim, payment review, WA operations, confirmation, final outcome, and payout.
- Seller payout-bank snapshot and payout reference recording.
- Minimal final-outcome recording for release, refund, split, or cancellation after external handling.
- System-enforced payment expiry; the exact expiry start and retry behavior remain open.

### Explicitly Not Included

- In-app buyer-seller complaint negotiation or dispute case management.
- Payment confirmation based only on the buyer's `Sudah Bayar` claim.
- A seller-acceptance step before buyer payment in the buyer-created flow.
- Automated bank reconciliation, automated WhatsApp group creation, or automated seller payout in the current MVP direction.
- Marketplace listings, wallet/balance, and storefront behavior under the current repository direction.

### Later Possibilities, Not Commitments

- Payment gateway, virtual account, QRIS, or bank-mutation automation.
- WhatsApp API automation.
- Automated payout/disbursement.
- Expanded admin dashboard and operational tooling.
- KYC automation.
- Support for service transactions through a future product-scope change.

## 8. Core Business Rules

| Rule ID | Rule | Why it exists | Decision status |
| --- | --- | --- | --- |
| PB-BR-001 | Either seller or buyer may create a transaction | Supports both owner-defined entry journeys | Confirmed |
| PB-BR-002 | In the buyer-created flow, the buyer enters the seller payout bank account and proceeds to buyer payment without a seller-acceptance gate | Matches the latest explicit journey | Confirmed |
| PB-BR-003 | The buyer always pays BayarAman, not the seller, within this flow | Establishes BayarAman as the trust intermediary | Confirmed |
| PB-BR-004 | An unpaid transaction expires after 1x24 hours | Limits stale payable transactions | Confirmed; start-time detail open |
| PB-BR-005 | `Sudah Bayar` is only a buyer payment claim | Prevents false payment confirmation | Confirmed |
| PB-BR-006 | Payment becomes confirmed only after admin verifies incoming funds | Makes the bank check the payment source of truth | Confirmed |
| PB-BR-007 | Admin creates the WA group and announces payment received before the seller ships | Gives the seller an explicit fulfillment trigger | Confirmed |
| PB-BR-008 | Seller and buyer both report completion before admin sends the confirmation link | Preserves the owner-defined completion sequence | Confirmed; non-response handling open |
| PB-BR-009 | Buyer must validate the confirmation link with OTP through email or WhatsApp before normal payout | Protects final fund release | Confirmed; OTP policy open |
| PB-BR-010 | Seller payout is transferred manually by admin | Keeps payout operations manual in MVP | Confirmed |
| PB-BR-011 | Buyer-seller complaints are resolved outside the product; the system does not mediate the discussion | Keeps the MVP operationally small | Confirmed |
| PB-BR-012 | Critical status and financial actions must remain traceable and must not be hard-deleted | Supports operational accountability | Current repository guardrail; owner review required |
| PB-BR-013 | In the seller-created flow, seller supplies deal and seller data while buyer supplies their own contact data after opening the link and before payment | Keeps buyer contact accurate and owned by the buyer | Confirmed |

## 9. Manual And System Boundaries

| Activity | Owner | Manual/system | What the system must record |
| --- | --- | --- | --- |
| Create seller-created transaction | Seller | System-supported | Deal details, seller name/WhatsApp/payout bank, creator role, creation time, and expiry time; detailed validation belongs in User Requirements |
| Open seller-created transaction | Buyer | System-supported link opened after manual sharing | Buyer name, WhatsApp, and email entered by buyer before payment; transaction association and access details |
| Create buyer-created transaction | Buyer | System-supported | Deal details, buyer name/WhatsApp/email, seller name/WhatsApp/payout bank, creator role, creation time, and expiry time |
| Transfer buyer funds | Buyer | Manual in bank channel | Expected destination/amount and later buyer claim; no automatic confirmation |
| Click `Sudah Bayar` | Buyer | System action | Claim time and resulting under-review state; supporting claim fields are open |
| Check incoming funds | Admin | Manual in bank channel, system-recorded result | Review result, operator, time, amount/reference where available, and note for anomalies |
| Create WA group | Admin | Manual in WhatsApp | Proposed minimum: group name/link and created time; owner approval required |
| Announce payment received | Admin | Manual in WhatsApp | Proposed minimum: announcement marker/time; owner approval required |
| Ship goods | Seller | Outside-system fulfillment and WA communication | Whether BayarAman stores a shipping status or only an operator marker is open |
| Report order complete | Seller and buyer | Manual in WhatsApp | The system need not parse messages; admin's later confirmation-link action provides the trusted checkpoint |
| Generate confirmation link and deliver OTP | Admin plus BayarAman system | Admin-triggered and system-supported | Link lifecycle, buyer destination, OTP verification result, expiry, and attempts; policy details are open |
| Handle complaint | Buyer, seller, and admin | Outside system, mainly WhatsApp | Only the authorized final outcome and an operational note are proposed for MVP |
| Transfer seller payout | Admin | Manual in bank channel, system-recorded result | Seller bank snapshot, payout amount, operator, time, status, and reference |
| Expire unpaid transaction | BayarAman system | System policy | Expiry time and final expired state; scheduling details belong to Technical Design |

## 10. High-Level Journey Seeds

These are seeds only. Detailed actions, fields, and statuses belong in the next approved User Journey artifact.

| Journey | Primary actor | Starts when | Ends when |
| --- | --- | --- | --- |
| Seller-created goods transaction | Seller | Seller enters the deal and seller data, then shares the generated link for buyer contact entry | Seller is paid, an authorized alternate outcome is recorded, or the transaction expires before payment |
| Buyer-created goods transaction | Buyer | Buyer enters the deal, buyer data, and seller contact/payout details | Seller is paid, an authorized alternate outcome is recorded, or the transaction expires before payment |
| Buyer completion confirmation | Buyer | Admin sends the confirmation link after both parties report completion | OTP confirmation succeeds or the confirmation requires follow-up |
| External issue outcome | Admin/Operator | Buyer or seller reports a problem outside the system | An authorized release, refund, split, or cancellation outcome is recorded |
| Unpaid expiry | BayarAman system | A transaction becomes payable | Buyer claims payment in time or the transaction reaches the 1x24-hour limit and expires |

## 11. Assumptions And Constraints

| ID | Assumption/constraint | Evidence | Risk if wrong | How to validate |
| --- | --- | --- | --- | --- |
| PB-AS-001 | Buyer and seller already have a deal before using BayarAman | Product positioning and existing drafts | BayarAman may accidentally require marketplace/discovery features | Confirm with product owner in brief review |
| PB-AS-002 | The initial flow is limited to physical goods that can be shipped | Explicit product-owner approval on 2026-07-16 | Service transactions need a different completion model | Resolved for MVP; revisit only through a future scope decision |
| PB-AS-003 | Admin has reliable access to the BayarAman bank account and can identify incoming funds | Required by the confirmed manual review flow | Payment review may be slow or ambiguous | Define the operational bank-checking method and claim data |
| PB-AS-004 | Buyer and seller can join a WhatsApp group and provide usable contact details | Buyer and seller WhatsApp ownership confirmed; fallback is not defined | Operator cannot coordinate or deliver the confirmation link | Define invalid/unavailable-contact fallback before QA |
| PB-AS-005 | Buyer has either email or WhatsApp available for OTP | Explicit latest direction | Buyer cannot confirm and payout becomes blocked | Define channel eligibility and fallback before QA |
| PB-AS-006 | Manual payment review, WA coordination, and payout are operationally viable at MVP volume | Current manual MVP direction | Slow response, human error, or fraud may make the flow unusable | Run a limited operational pilot with measured turnaround and error logs |
| PB-AS-007 | Prototype values and flows are illustrative, not approved production configuration | Static prototype uses hardcoded actors, bank, fee, and OTP | Demo data could become accidental product policy | Replace only after the related product decisions are approved |
| PB-AS-008 | Receiving, holding, refunding, splitting, and paying customer funds is legally and operationally permitted | Not validated in current artifacts | Real-money launch may create legal, compliance, banking, tax, or fraud exposure | Obtain qualified legal/compliance and banking review before handling live funds |

## 12. Product Decisions

### 12.1 Resolved Decisions

| ID | Decision | Approved resolution | Recorded |
| --- | --- | --- | --- |
| PB-OD-001 | Supported transaction type | MVP supports physical goods only; services require a future scope decision | Product owner, 2026-07-16 |
| PB-OD-002 | Required data ownership by creator | Seller-created: seller enters deal and seller identity/WhatsApp/payout bank; buyer-created: buyer enters deal, buyer identity/WhatsApp/email, and seller identity/WhatsApp/payout bank | Product owner, 2026-07-16 |
| PB-OD-003 | Buyer contact in seller-created flow | Seller shares the generated link; buyer enters their own name, WhatsApp, and email after opening it and before payment | Product owner, 2026-07-16 |

Detailed field validation and optional fields will be defined in User Requirements without changing this approved ownership split.

### 12.2 Open Decisions

| ID | Decision | Options / question | Impact | Needed by | Owner |
| --- | --- | --- | --- | --- | --- |
| PB-OD-004 | Fee model | Is the 2% fee with Rp20,000 minimum and Rp100,000 maximum still valid? Who pays: buyer, seller, or split? | Changes payment amount, seller net, UI, and payout | Before User Requirements | Product/business owner |
| PB-OD-005 | Transaction and subscription limits | Are free/pro limits and proposed subscription prices active MVP decisions? | Changes eligibility, pricing, and auth requirements | Before PRD | Product/business owner |
| PB-OD-006 | Seller bank verification | Who verifies seller account ownership, especially when buyer enters it? | Wrong data can send payout to the wrong account | Before User Requirements | Product/operations owner |
| PB-OD-007 | Account and identity requirements | Can parties use transaction links without accounts? Which actions require login, verified email, or verified phone? | Changes entry friction, security, and main screens | Before User Requirements | Product owner |
| PB-OD-008 | Payment claim and matching data | Exact BayarAman account, unique amount/reference, sender bank/name, and optional proof requirements | Determines whether admin can reliably match payment | Before User Requirements | Product/operations owner |
| PB-OD-009 | Payment anomaly policy | What happens for wrong amount, duplicate transfer, late transfer, overpayment, or underpayment? | Affects money handling and recovery scenarios | Before QA Scenarios | Product/operations owner |
| PB-OD-010 | Expiry semantics | When does the 1x24-hour timer start, and what happens if payment is claimed, not found, or arrives after expiry? | Changes status and customer communication | Before User Requirements | Product owner |
| PB-OD-011 | Operator access and roles | Is one admin role enough for MVP, or must payment review and payout be separated? What controlled interface is required? | Affects fraud control and operational usability | Before User Requirements | Product/operations owner |
| PB-OD-012 | OTP and confirmation policy | Who chooses email/WhatsApp, how long link/OTP lasts, attempt limits, resend policy, and fallback? | Affects completion security and blocked payouts | Before QA Scenarios | Product/security owner |
| PB-OD-013 | Completion non-response | What happens when only seller or only buyer reports completion, or buyer never confirms? | Determines payout hold, escalation, and issue outcome | Before QA Scenarios | Product/operations owner |
| PB-OD-014 | External complaint authority | Who may decide release, refund, split, or cancellation, and what minimum evidence/note is required? | Controls high-risk financial outcomes | Before QA Scenarios | Product/operations owner |
| PB-OD-015 | Payout policy | Payout SLA, fee deduction, retry/failure handling, proof/reference requirement, and manual override authority | Determines seller expectation and financial controls | Before QA Scenarios | Product/operations owner |
| PB-OD-016 | Operational tracking depth | Which WA, shipping, completion, and manual-operation checkpoints need explicit system statuses? | Prevents either an overbuilt admin product or an unauditable process | Before User Requirements | Product owner |
| PB-OD-017 | Live-money readiness | What legal, compliance, banking, privacy, fraud, and data-retention approvals are required? | Blocks responsible production handling of customer funds | Before any live-money pilot | Business/legal owner |
| PB-OD-018 | MVP success targets | What transaction completion, review time, payout time, issue rate, and repeat-use targets indicate validation? | Needed to judge whether MVP works | Before PRD approval | Product/business owner |

## 13. Conflicts With Existing Artifacts

| ID | Existing artifact/section | Conflict | Product Brief decision | Downstream action |
| --- | --- | --- | --- | --- |
| PB-CF-001 | `PRD.md` User Roles and Acceptance Criteria | Says seller can accept or verify a buyer-created transaction before payment | Latest owner journey has no seller-acceptance gate before buyer payment | Revise during PRD reconciliation |
| PB-CF-002 | `prototype/app.js` buyer guidance | Says seller must accept/verify data before buyer pays | Contradicts the latest direct buyer-created flow | Remove when prototype is next updated; do not use as journey source |
| PB-CF-003 | `README.md` Business Model and prototype fee calculation | Treats fee percentage, caps, limits, and subscription pricing as decided | Latest owner direction did not reaffirm pricing or fee payer | Keep as reference only until PB-OD-004 and PB-OD-005 are approved |
| PB-CF-004 | `PRD.md` Auth and Main Screens | Requires user registration/verification while saying full admin login/dashboard is post-MVP | Identity and controlled operator access are unresolved, but operator actions are definitely required | Do not carry the screen/auth list forward until PB-OD-007 and PB-OD-011 are decided |
| PB-CF-005 | `PRD.md`, `TRD.md`, and prototype labels | Broaden scope to goods/services while the approved MVP is physical goods only | Service support is outside current MVP | Revise labels during downstream reconciliation or implementation |
| PB-CF-006 | Prototype admin banner | Says all admin-page processes happen outside the main system | Link generation, OTP verification, expiry, and trusted records are system-supported even when bank/WA/payout actions are manual | Revise prototype wording later to distinguish manual action from system record |
| PB-CF-007 | Prototype hardcoded bank account, fee, and OTP | Demo values can look like approved operating configuration | They remain static demo data only | Do not reuse in production requirements; resolve related open decisions |
| PB-CF-008 | Archived pre-brief User Journey | Defines detailed fields, statuses, and alternate paths before Product Brief approval | Useful as candidate material only | Keep archived; create a new User Journey only after this brief is approved |
| PB-CF-009 | `TRD.md` stack, API, state, and job decisions | Technical design appears before approved product artifacts | Product Brief approves no implementation stack or API | Revisit only in the Technical Design phase after PRD approval |
| PB-CF-010 | Historical Midtrans infographic referenced by README | Depicts a payment-gateway direction outside the current manual-payment MVP | No payment gateway in the current MVP | Keep historical only or archive separately; never use as active product source |
| PB-CF-011 | `prototype/index.html` seller-created form | Requires seller to enter buyer name, WhatsApp, and email | Buyer must enter their own contact data after opening the seller's link | Revise when the prototype is next updated; do not copy these fields into the new User Journey |

## 14. Approval Checklist

- [x] Problem and target actors are stated.
- [x] Confirmed owner flow is separated from proposed supporting scope.
- [x] Core manual and system boundaries are visible.
- [x] Latest owner direction has precedence over stale drafts.
- [x] Conflicts and open decisions are explicit.
- [ ] Product owner has reviewed the confirmed decisions and proposed scope.
- [x] Decisions marked `Before User Journey` are resolved.
- [ ] Status is changed from `Draft` to `Approved`.
- [x] The brief now contains sufficient resolved input for a new User Journey, pending final Product Brief approval.
