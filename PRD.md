# Product Requirements Document (PRD)

# BayarAman MVP

## 1. Document Control

- Product: BayarAman
- Version: PRD v1.1
- Status: Draft for MVP build
- Owner: BayarAman product team
- Last updated: 2026-07-09

## 2. Executive Summary

BayarAman is a rekber-style trust layer for online transactions outside marketplaces. It helps buyers and sellers transact through WhatsApp, Instagram, Telegram, forums, and communities by using one central transaction page for agreement, payment status, delivery proof, buyer confirmation, dispute, admin decision, and payout status.

The MVP uses a payment gateway for buyer payment collection and keeps BayarAman responsible for the trust workflow: funds secured status, delivery proof, review window, dispute decision, refund/release decision, audit trail, and manual seller payout.

## 3. Problem Statement

Transactions outside marketplaces are risky because:

- Buyer is afraid seller will disappear after payment.
- Seller is afraid buyer can delay confirmation after receiving goods/services.
- Evidence is scattered across chat apps.
- Manual rekber depends on individual admins.
- Dispute resolution often has unclear evidence, SLA, and decision ownership.

## 4. Product Goals

### 4.1 MVP Goals

- Seller can create and share a secure transaction link.
- Buyer can review deal details, fees, and policies before paying.
- Buyer can pay through the configured payment gateway.
- Payment success can mark funds as secured.
- Seller can upload delivery proof.
- Buyer can confirm completion or open dispute.
- System can auto-release after the review window if eligible.
- Admin can resolve disputes with evidence and reason.
- Finance/admin can process seller payout manually.
- Important actions are recorded in audit log.

### 4.2 Business Goals

- Validate whether sellers are willing to share BayarAman links.
- Validate whether buyers trust the BayarAman payment and protection flow.
- Validate transaction fee economics.
- Validate dispute workload and evidence quality.
- Validate manual payout workload.

## 5. Non-Goals

Out of MVP scope:

- Marketplace listing/storefront.
- Native mobile app.
- Internal wallet/balance/top-up/withdrawal.
- Fully automated seller payout.
- Automated KYC.
- AI fraud scoring.
- Realtime chat.
- Multi-currency.
- Crypto escrow.
- Automated Pro subscription billing.
- Buyer-created transaction flow.

## 6. MVP Scope

### 6.1 Included in MVP

| Area | MVP Decision |
| --- | --- |
| Seller-created transaction link | Included |
| Buyer review before payment | Included |
| Payment gateway checkout | Included |
| Payment status update | Included |
| Funds secured status | Included |
| Seller delivery proof | Included |
| Buyer confirmation | Included |
| Buyer dispute | Included |
| Seller dispute response | Included |
| Admin dispute resolution | Included |
| Auto-release after 1x24 hours | Included, only when eligible |
| Manual seller payout | Included |
| Refund tracking | Included |
| Free user limits | Included |
| Manual Pro assignment | Included |
| Audit log | Included |

### 6.2 Post-MVP

| Area | Decision |
| --- | --- |
| Buyer-created transaction | Post-MVP |
| Automated seller payout | Post-MVP |
| Automated subscription billing | Post-MVP |
| Automated KYC | Post-MVP |
| Reputation scoring | Post-MVP |
| AI fraud scoring | Post-MVP |
| Marketplace/storefront | Post-MVP |
| Native mobile app | Post-MVP |
| API/white-label for communities | Post-MVP |

## 7. User Roles

### 7.1 Buyer

- Opens shared transaction link.
- Reviews transaction detail, fee, total payment, and policies.
- Pays through payment gateway.
- Tracks payment and transaction status.
- Confirms completion.
- Opens dispute if there is a problem.
- Receives refund if approved.

### 7.2 Seller

- Creates transaction link.
- Shares transaction link to buyer.
- Tracks buyer payment status.
- Delivers goods/services after funds are secured.
- Uploads delivery proof.
- Responds to dispute.
- Receives payout after transaction is completed.

### 7.3 Admin

- Reviews transaction, dispute, and risk queues.
- Freezes/unfreezes transactions.
- Reviews dispute evidence.
- Decides refund, release, split settlement, request more evidence, or extend review.
- Provides reason for every decision.

### 7.4 Finance

- Reviews payout queue.
- Processes manual payout to seller.
- Marks payout as processing, paid, or failed.
- Processes manual refund fallback when needed.

### 7.5 Super Admin

- Manages admin roles.
- Manages fee, limit, and policy settings.
- Views audit logs and risk flags.
- Overrides/freeze/unfreeze transactions with reason.

## 8. User Flow App

### 8.1 Seller-First Transaction Flow

1. Seller registers/logs in.
2. Seller creates transaction with title, amount, category, agreement, delivery deadline, and fee payer.
3. System creates a shareable transaction link.
4. Seller shares link to buyer.
5. Buyer opens transaction link.
6. Buyer reviews detail, agreement, fee breakdown, total payment, delivery deadline, review window, refund/cancel policy, and auto-release policy.
7. Buyer continues to payment.
8. Buyer completes payment through payment gateway.
9. System marks funds as secured after successful payment confirmation.
10. Seller receives instruction to deliver goods/services.
11. Seller uploads delivery proof.
12. Buyer receives delivery proof notification.
13. Buyer confirms completion or opens dispute.
14. If buyer confirms, transaction moves to completion and payout queue.
15. If buyer does nothing, system may auto-release after review window if eligible.
16. If buyer disputes, transaction moves to dispute flow.

### 8.2 Dispute Flow

1. Buyer opens dispute from transaction page.
2. Buyer selects reason, adds chronology, uploads evidence, and chooses requested resolution.
3. Seller receives dispute notification.
4. Seller responds with explanation and evidence.
5. Admin reviews buyer evidence, seller response, transaction history, and risk flags.
6. Admin decides refund, release, split settlement, request more evidence, extend review, or freeze.
7. System records admin decision and reason.
8. Buyer and seller receive decision notification.
9. Transaction proceeds to refund, release/completion, split settlement, or further evidence collection.

### 8.3 Payout Flow

1. Transaction reaches completed status.
2. Seller payout request enters payout queue.
3. Finance/admin reviews payout eligibility.
4. Seller bank account is checked.
5. Finance/admin processes payout manually.
6. System marks payout as processing, paid, or failed.
7. Seller receives payout status notification.

## 9. Business Model Flow

1. User acquisition happens from communities, social commerce, freelance channels, and C2C conversations.
2. Seller uses BayarAman as a trust signal by sharing a secure transaction link.
3. Buyer accepts protection because payment goes to BayarAman first, not directly to seller.
4. BayarAman earns transaction fee when payment is collected.
5. Transaction fee payer can be buyer, seller, or split.
6. If transaction completes, BayarAman keeps transaction fee and seller receives payout.
7. If buyer cancels without seller fault, cancel fee may apply for Free user.
8. If seller is wrong/fraudulent, buyer receives refund without cancel fee.
9. Free users are limited by transaction value and volume.
10. Pro users get higher flexibility, priority review, trust badge, and cancel fee waiver.
11. High-risk transactions create operational review cost and may be frozen/rejected.
12. Success is measured by link creation, buyer payment conversion, completion rate, dispute rate, refund rate, payout time, and repeat usage.

## 10. Business Rules

### 10.1 Supported Transactions

Supported:

- Legal physical goods, secondhand goods, gadgets, small electronics.
- Legal digital products.
- Small freelance/digital services.
- Community/C2C transactions outside marketplaces.

Forbidden:

- Illegal/stolen/counterfeit goods.
- Narcotics/prescription drugs.
- Weapons/ammunition.
- Adult products.
- Gambling.
- Crypto/investment/forex.
- Loans.
- Financial accounts/bank accounts.
- Personal data/identity documents.
- Hacking/spam/bot services.
- Special-license goods.
- Protected wildlife.

High-risk, requiring manual review or rejection:

- Expensive luxury goods.
- Event tickets.
- Pre-orders.
- Custom goods.
- Jewelry.
- Vehicles.
- Property.

### 10.2 Pricing

- Minimum transaction amount: Rp100.000.
- Transaction fee: 2%.
- Minimum fee: Rp20.000.
- Maximum fee: Rp100.000.
- Fee payer options:
  - Buyer pays fee.
  - Seller pays fee.
  - Split fee.

### 10.3 User Tier

Free user:

- Email verification required.
- Phone verification required.
- No KYC by default.
- Max per transaction: Rp1.000.000.
- Daily limit: Rp1.500.000.
- Monthly limit: Rp3.000.000.
- Cancel fee: Rp5.000 where applicable.

Pro user:

- Manually assigned by admin in MVP.
- Monthly target price: Rp100.000.
- Annual target price: Rp1.000.000.
- Unlimited monthly transaction volume.
- Transaction above Rp5.000.000 requires manual review.
- Cancel fee waived.
- Transaction fee still applies.

### 10.4 Cancel Fee

- Applies to Free users if buyer cancels after payment without seller fault.
- Does not apply if seller fails to deliver, seller is proven wrong/fraudulent, or admin decides full refund.
- Does not apply to Pro users.
- Cancel fee is deducted from refund amount.

### 10.5 Buyer Review Window

- Starts after seller uploads delivery proof.
- Duration: 1x24 hours.
- Buyer can confirm or open dispute.
- If buyer does nothing, transaction can auto-release only if eligible.

### 10.6 Auto-Release Eligibility

Auto-release may run only if:

- Review window has expired.
- No active dispute.
- No admin freeze.
- No risk flag.
- Delivery proof is not suspicious.
- Transaction is not high-risk.

### 10.7 Dispute SLA

- Seller response window: 2x24 hours.
- Admin dispute SLA target: 2x24 hours after sufficient evidence is available.
- Admin decision must include reason.

## 11. Payment Gateway Product Scope

BayarAman uses Midtrans as payment gateway for MVP payment collection.

Product requirements:

- Buyer can pay from transaction page using enabled payment methods.
- Buyer can see payment status after returning from payment flow.
- Successful payment updates transaction to funds secured.
- Failed, expired, denied, or cancelled payment does not secure funds.
- Payment success must not depend only on buyer browser redirect.
- Admin/finance can reconcile payment status if confirmation is delayed or unclear.
- Refund handling supports payment-method capability and manual fallback.

Product boundary:

- Payment gateway handles payment collection.
- BayarAman owns transaction agreement, funds secured status, delivery proof, review window, dispute workflow, release/refund decision, seller payout workflow, and audit trail.

Technical Midtrans details are documented in `TRD.md`.

## 12. Core Status Model

### 12.1 Happy Path

```text
DRAFT
-> WAITING_BUYER_PAYMENT
-> PAYMENT_PENDING
-> FUNDS_SECURED
-> DELIVERED
-> RELEASE_PENDING
-> COMPLETED
-> PAYOUT_PENDING
-> PAYOUT_PROCESSING
-> PAID_OUT
```

### 12.2 Dispute Path

```text
FUNDS_SECURED / DELIVERED
-> DISPUTED
-> UNDER_REVIEW
-> REFUND_PENDING / RELEASE_PENDING / SPLIT_SETTLEMENT / EVIDENCE_REQUESTED
-> REFUNDED / COMPLETED
```

### 12.3 Cancel/Expiry Path

```text
WAITING_BUYER_PAYMENT -> CANCELLED
WAITING_BUYER_PAYMENT -> EXPIRED
PAYMENT_PENDING -> EXPIRED / PAYMENT_FAILED
```

### 12.4 Payout Path

```text
COMPLETED
-> PAYOUT_PENDING
-> PAYOUT_PROCESSING
-> PAID_OUT / PAYOUT_FAILED
```

## 13. Functional Requirements

### 13.1 Authentication and User Management

- FR-AUTH-001: Users can register using email, phone, and password.
- FR-AUTH-002: Users must verify email and phone before creating or joining transactions.
- FR-AUTH-003: Users can log in and log out.
- FR-AUTH-004: System detects role per transaction: buyer, seller, admin, finance, super admin.
- FR-AUTH-005: Admin can manually mark user as Pro for MVP.

### 13.2 Transaction Creation

- FR-TXN-001: Seller can create transaction with title, amount, category, agreement, delivery deadline, fee payer, and optional buyer contact.
- FR-TXN-002: System validates minimum transaction amount Rp100.000.
- FR-TXN-003: System generates unique transaction code and shareable link.
- FR-TXN-004: Seller-created transaction enters `WAITING_BUYER_PAYMENT`.
- FR-TXN-005: Transaction page displays agreement, amount, fee, total, deadline, auto-release policy, refund/cancel policy, and primary CTA.

### 13.3 Fee and Limit Calculation

- FR-FEE-001: System calculates transaction fee as 2%, min Rp20.000, max Rp100.000.
- FR-FEE-002: System supports buyer pays fee, seller pays fee, and split fee.
- FR-FEE-003: System displays fee breakdown before payment.
- FR-FEE-004: System enforces Free user transaction, daily, and monthly limits.
- FR-FEE-005: System flags Pro transaction above Rp5.000.000 for manual review.

### 13.4 Payment

- FR-PAY-001: Buyer can start payment from transaction page.
- FR-PAY-002: System creates payment session with correct transaction amount, fee, and buyer details.
- FR-PAY-003: System stores payment reference, expected amount, provider reference, and payment status.
- FR-PAY-004: Buyer can open payment page from transaction page.
- FR-PAY-005: System displays waiting payment/payment pending state after payment session is created.
- FR-PAY-006: System receives provider payment notification and updates payment status.
- FR-PAY-007: System verifies payment notification before marking payment successful.
- FR-PAY-008: Successful payment marks transaction as `FUNDS_SECURED`.
- FR-PAY-009: Failed, expired, denied, or cancelled payment maps to appropriate state.
- FR-PAY-010: Admin can sync payment status manually when payment confirmation is unclear.
- FR-PAY-011: Duplicate payment notifications must not duplicate status changes.

### 13.5 Funds Secured

- FR-SEC-001: After payment success, buyer and seller see "Dana sudah diamankan".
- FR-SEC-002: Seller can upload delivery proof only after funds are secured.
- FR-SEC-003: System logs all secured-fund status changes.

### 13.6 Delivery Proof

- FR-DEL-001: Seller can upload delivery proof.
- FR-DEL-002: Required proof guidance depends on category.
- FR-DEL-003: Uploading delivery proof changes status to `DELIVERED`.
- FR-DEL-004: Uploading delivery proof starts buyer review window.

### 13.7 Buyer Review

- FR-REV-001: Buyer can confirm received/completed.
- FR-REV-002: Buyer confirmation moves transaction to `RELEASE_PENDING` then `COMPLETED`.
- FR-REV-003: Buyer can open dispute during eligible states.
- FR-REV-004: System can auto-release after 1x24 hours if eligible.
- FR-REV-005: System blocks auto-release if there is dispute, freeze, risk flag, suspicious proof, or high-risk category.

### 13.8 Dispute

- FR-DSP-001: Buyer can open dispute with reason, chronology, evidence, and requested resolution.
- FR-DSP-002: Seller can respond to dispute with notes and evidence.
- FR-DSP-003: Admin can request more evidence, extend review time, refund, release, split settlement, or freeze transaction.
- FR-DSP-004: Admin decision requires reason.
- FR-DSP-005: All dispute actions are logged.

### 13.9 Refund

- FR-REF-001: Admin can approve refund.
- FR-REF-002: System calculates refund amount based on cancel fee and policy.
- FR-REF-003: System supports provider refund where available.
- FR-REF-004: System supports manual refund fallback.
- FR-REF-005: Refund completion changes status to `REFUNDED` or `PARTIALLY_REFUNDED`.

### 13.10 Payout

- FR-POUT-001: Completed transaction enters `PAYOUT_PENDING`.
- FR-POUT-002: Seller must provide payout bank account.
- FR-POUT-003: Payout requires no active dispute, no freeze, no blocking risk flag, and completed transaction status.
- FR-POUT-004: Payout <= Rp1.000.000 can be approved by one admin/finance.
- FR-POUT-005: Payout > Rp1.000.000 requires maker-checker approval.
- FR-POUT-006: Finance can mark payout as processing, paid, or failed.
- FR-POUT-007: All payout actions are logged.

### 13.11 Admin Panel

- FR-ADM-001: Admin dashboard shows payment, dispute, risk, refund, and payout queues.
- FR-ADM-002: Admin can view transaction details and audit trail.
- FR-ADM-003: Admin can freeze/unfreeze transaction with reason.
- FR-ADM-004: Admin can flag user or transaction.
- FR-ADM-005: Super admin can manage fee, limit, and admin role settings.

### 13.12 Notifications

- FR-NOTIF-001: Buyer receives notification for payment pending, funds secured, proof uploaded, dispute update, refund processed, and completed transaction.
- FR-NOTIF-002: Seller receives notification for buyer payment status, funds secured, dispute opened, release/auto-release, and payout status.
- FR-NOTIF-003: Admin/finance receives queue notifications for payment anomaly, dispute, refund, freeze, and payout.

### 13.13 Audit Log

- FR-AUD-001: System logs important actions.
- FR-AUD-002: Audit log fields include actor, role, action, target, old/new status, amount, notes, IP, user agent, and timestamp.
- FR-AUD-003: Provider-notification-driven actions use provider actor.
- FR-AUD-004: Audit logs must not be editable from normal admin UI.

## 14. Main Screens

- Public landing page.
- Fee calculator.
- Seller transaction create page.
- Transaction detail page.
- Payment redirect/return handling page.
- Buyer dashboard.
- Seller dashboard.
- Admin dashboard.
- Admin transaction detail.
- Admin dispute queue.
- Admin payout queue.

## 15. Non-Functional Requirements

Security:

- Payment provider secrets must never be exposed to frontend.
- Payment provider notifications must be verified.
- Uploaded evidence must use protected access where possible.
- Admin actions require authentication and role authorization.

Reliability:

- Payment notification processing must be idempotent.
- Payment status sync must be recoverable.
- Auto-release must be safe against duplicate execution.
- Payout marking must prevent double payout.

Compliance and operations:

- Forbidden/high-risk category policies must be visible before payment.
- Money-moving decisions must have audit trail.
- Admin decision reasons must be retained.

## 16. Analytics and Success Metrics

- Transaction links created.
- Buyer payment conversion rate.
- Payment success rate.
- Average transaction value.
- Completion rate.
- Dispute rate.
- Refund rate.
- Auto-release rate.
- Average dispute resolution time.
- Average payout processing time.
- Repeat seller/buyer usage.

MVP success signal:

- Sellers are willing to share links.
- Buyers trust the payment flow.
- Most transactions complete without dispute.
- Manual payout and dispute operations remain manageable.

## 17. Release Plan

### Phase 1: Seller Link + Payment

- Auth and verification.
- Seller creates transaction link.
- Buyer reviews transaction detail.
- Fee calculation.
- Payment session creation.
- Payment provider notification handling.
- FUNDS_SECURED status.

### Phase 2: Delivery + Completion

- Seller delivery proof upload.
- Buyer review window.
- Buyer confirmation.
- Auto-release eligibility logic.
- Completed status.

### Phase 3: Dispute + Refund

- Buyer dispute.
- Seller response.
- Admin dispute queue.
- Admin decision.
- Refund calculation.
- Provider refund/manual refund tracking.

### Phase 4: Payout + Risk Control

- Seller payout details.
- Payout queue.
- Maker-checker approval.
- Freeze/unfreeze.
- Risk flags.
- Audit log hardening.

### Phase 5: Tiers and Operations Polish

- Free/Pro limits.
- Manual Pro assignment.
- Trust badge.
- Admin settings.
- Notification coverage.

## 18. Acceptance Criteria

- AC-001: Seller can create transaction and receive shareable link.
- AC-002: Buyer can open link and see amount, fee, total, agreement, and policy.
- AC-003: Buyer can start payment through configured payment gateway.
- AC-004: System stores payment session reference and payment record.
- AC-005: Payment provider notification can mark successful payment as FUNDS_SECURED.
- AC-006: Failed/expired/cancelled payment maps to correct failed state.
- AC-007: Seller can upload delivery proof only after funds are secured.
- AC-008: Buyer can confirm completion.
- AC-009: Auto-release runs after 1x24 hours only if eligible.
- AC-010: Buyer can open dispute with required evidence.
- AC-011: Seller can respond to dispute.
- AC-012: Admin can resolve dispute with reason.
- AC-013: Refund decision can be tracked to completion.
- AC-014: Completed transaction enters payout queue.
- AC-015: Payout can be marked paid or failed by finance/admin.
- AC-016: Every important action creates audit log.
- AC-017: Free user limits and fee calculation are enforced.
- AC-018: Admin can freeze transaction and block auto-release/payout.

## 19. Open Questions

- Which Midtrans payment methods will be enabled for first production release: VA, QRIS, e-wallet, card?
- Will seller payout remain fully manual for MVP launch, or use a payout partner later?
- Should Pro be manually assigned only, or sold from day one?
- What legal/compliance review is required before holding customer funds?
- What exact refund path is supported per enabled payment method?
- What evidence is mandatory per category before seller can submit delivery proof?
- What transaction categories should be disabled entirely on launch?

## 20. References

- BayarAman Product Concept draft.
- BayarAman User Journey Blueprint draft.
- BayarAman Business Model and Operating Model draft.
- BayarAman bisnis flow infographic.
- BayarAman Midtrans technology flow infographic.
- Technical Requirements Document: `TRD.md`.
