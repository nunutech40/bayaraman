# BayarAman

BayarAman is a rekber-style trust layer for online transactions outside marketplaces. The current MVP uses manual payment collection to a BayarAman-owned bank account, manual admin payment checking, WhatsApp coordination, buyer OTP confirmation, and manual seller payout/pencairan.

## What This Repo Contains

- `PRD.md`: Product Requirements Document for the manual-payment rekber MVP.
- `TRD.md`: Technical Requirements Document with flowcharts and sequence diagrams.
- `AUTH.md`: Auth, role, tier, Google OAuth, and verification design.
- `DATABASE.md`: PostgreSQL database design for auth, transactions, manual payments, WA group tracking, confirmation OTP, payout, and audit.
- `BayarAman-bisnis-flow-infographic.html/png`: Business-flow infographic.
- `BayarAman-midtrans-tech-flow-infographic.html/png`: Older Midtrans technology infographic; kept as historical reference until replaced.
- `requirenment/`: Original exported product, journey, PRD, and business model drafts.

## Product Summary

BayarAman is not a marketplace, wallet, or payment gateway. BayarAman is a trust layer:

1. Seller or buyer creates a BayarAman transaction.
2. Buyer pays to BayarAman's bank account.
3. Buyer clicks `Sudah Bayar`.
4. Admin checks whether the payment has arrived.
5. If payment is valid, admin creates a WhatsApp group for buyer, seller, and BayarAman.
6. Admin announces in the WhatsApp group that payment has been received.
7. Seller ships goods/services.
8. Seller and buyer report in the group when the order is complete.
9. Admin sends a buyer confirmation link in the group.
10. Buyer confirms with OTP through email or WhatsApp.
11. Admin manually transfers payout/pencairan to seller.

Buyer-seller complaints are handled outside the system during MVP, mainly in the WhatsApp group. BayarAman records the final outcome: release, refund, split settlement, or cancelled.

Transactions that have not been paid expire in 1x24 hours.

## MVP Direction

Included in MVP:

- Seller-created transaction.
- Buyer-created transaction with seller contact and seller bank account input.
- Manual buyer payment to BayarAman bank account.
- `Sudah Bayar` action by buyer.
- Admin manual payment checking.
- 1x24 hour payment expiry for unpaid transactions.
- WhatsApp group link/name tracking.
- Buyer confirmation link.
- OTP confirmation by email or WhatsApp.
- Manual seller payout/pencairan recording.
- Minimal issue/outcome recording.

Not MVP:

- Midtrans/payment gateway integration.
- Full automated bank mutation reconciliation.
- Full admin dashboard/login.
- In-app dispute resolution.
- Automated seller payout/disbursement.
- Wallet/balance.
- Marketplace/storefront.

## Manual Payment Usage

BayarAman uses a manual payment flow for MVP:

- Buyer pays to BayarAman's bank account.
- Buyer clicks `Sudah Bayar`.
- Admin checks incoming payment manually.
- Payment is considered confirmed only after admin verification.
- If payment is not received within 1x24 hours, the transaction expires.

Important boundary:

BayarAman remains the trust workflow owner: transaction state, payment checking, WhatsApp coordination, confirmation, issue outcome, release/refund decision, payout/pencairan, and audit trail stay inside BayarAman.

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

## Frontend Prototype

The static flow prototype lives in `prototype/`.

Local URL while running a static server:

- `http://127.0.0.1:8081/`

Public GitHub Pages URL after Pages is enabled:

- `https://nunutech40.github.io/bayaraman/prototype/`

GitHub Pages setup:

1. Open the GitHub repository settings.
2. Go to `Pages`.
3. Set source to `Deploy from a branch`.
4. Select branch `main`.
5. Select folder `/root`.
6. Save.

After GitHub finishes publishing, share the prototype URL above.

## Current Status

This repo is still in product definition stage. There is no application code yet.

Recommended next step:

- Turn `PRD.md` and `TRD.md` into implementation tickets.
- Confirm the exact operational bank account and payment-checking SOP.
- Build transaction creation, manual payment marker, admin payment review, WA ops record, buyer confirmation, and manual payout recording.
