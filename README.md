# BayarAman

BayarAman is a rekber-style trust layer for online transactions outside marketplaces. It helps buyers and sellers make safer deals through one central transaction page where the agreement, payment status, delivery proof, dispute, admin decision, and payout status are tracked clearly.

## What This Repo Contains

This repo currently contains product planning artifacts:

- `PRD.md`: Product Requirements Document for BayarAman MVP.
- `TRD.md`: Technical Requirements Document based on the PRD and Midtrans integration plan, including Mermaid flowcharts and sequence diagrams.
- `AUTH.md`: Auth, role, tier, verification, and permission design.
- `DATABASE.md`: PostgreSQL database design for auth, transactions, Midtrans, disputes, refunds, payouts, audit, and notifications.
- `requirenment/`: Original exported product, journey, PRD, and business model drafts.
- `BayarAman-bisnis-flow-infographic.html`: Business-flow infographic source.
- `BayarAman-bisnis-flow-infographic.png`: Business-flow infographic image.
- `BayarAman-midtrans-tech-flow-infographic.html`: Midtrans and technology-flow infographic source.
- `BayarAman-midtrans-tech-flow-infographic.png`: Midtrans and technology-flow infographic image.

## Product Summary

BayarAman is not a marketplace and not a wallet. It is a transaction trust layer:

1. Seller creates a transaction link.
2. Buyer reviews the agreement and total payment.
3. Buyer pays through Midtrans Snap.
4. BayarAman receives payment status from Midtrans webhook.
5. Funds are marked as secured.
6. Seller delivers goods/services and uploads proof.
7. Buyer confirms or opens a dispute.
8. BayarAman releases funds, refunds buyer, or handles split settlement based on policy and evidence.

## MVP Direction

The MVP uses:

- Seller-created transaction links.
- Midtrans Snap for buyer payment collection.
- Midtrans webhook for payment status update.
- BayarAman-owned escrow/status logic.
- Seller delivery proof.
- Buyer confirmation or dispute.
- Auto-release after 1x24 hours when eligible.
- Manual admin dispute resolution.
- Manual seller payout.
- Audit log for important actions.

Payment collection is automated through Midtrans. Seller payout remains manual in MVP.

## Midtrans Usage

BayarAman uses these Midtrans capabilities:

- Snap API: create payment session.
- Snap token/redirect_url: send buyer to payment page.
- HTTP(S) Notification/Webhook: receive payment status changes.
- Transaction Status API: fallback/manual reconciliation.
- Refund API: where supported by payment method and business policy.

Important boundary:

Midtrans is the payment gateway. BayarAman is the trust/escrow workflow owner. Dispute, release, refund decision, payout, and audit trail remain inside BayarAman.

## Business Model

- Transaction fee: 2%.
- Minimum fee: Rp20.000.
- Maximum fee: Rp100.000.
- Minimum transaction amount: Rp100.000.
- Fee payer options: buyer, seller, or split.
- Free user limits:
  - Max per transaction: Rp1.000.000.
  - Daily limit: Rp1.500.000.
  - Monthly limit: Rp3.000.000.
- Pro target pricing:
  - Rp100.000/month.
  - Rp1.000.000/year.

## Key Documents

Start here:

1. `PRD.md`
2. `TRD.md`
3. `AUTH.md`
4. `DATABASE.md`
5. `BayarAman-bisnis-flow-infographic.png`
6. `BayarAman-midtrans-tech-flow-infographic.png`
7. `requirenment/BayarAman — Product Concept (Draft).md`
8. `requirenment/BayarAman — User Journey Blueprint v2 (Draft).md`

Note: Some source files use long Notion-exported filenames.

## Converting Infographic HTML to PNG

The PNG files were generated from HTML using Chrome headless.

Example:

```bash
'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  --headless=new \
  --disable-gpu \
  --hide-scrollbars \
  --window-size=1200,2400 \
  --screenshot=BayarAman-bisnis-flow-infographic.png \
  'file:///Users/nununugraha/Documents/Programming/OtherPorject/bayarman/BayarAman-bisnis-flow-infographic.html'
```

## Current Status

This repo is still in product definition stage. There is no application code yet.

Recommended next step:

- Turn `PRD.md` into implementation tickets.
- Decide first enabled Midtrans payment methods.
- Define data model and status transition rules.
- Start MVP build with transaction link + Midtrans Snap payment + webhook handling.
