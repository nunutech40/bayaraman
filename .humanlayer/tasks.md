# BayarAman HumanLayer Task Roadmap

This roadmap turns `TRD.md` into implementation-sized HumanLayer tasks.

## HL-001 Scaffold Next.js App

Goal:

- Create a Next.js + TypeScript app in this repo.
- Keep the existing docs and `prototype/` intact.
- Add basic app layout, route structure, lint/typecheck/test scripts.

Expected result:

- `package.json`
- Next.js app files
- `npm run dev`, `npm run lint`, and `npm run typecheck` or equivalent
- README updated with local dev instructions

## HL-002 Port Prototype to App Routes

Goal:

- Convert `prototype/` flow into app routes/components.
- Keep static data only.
- Preserve the five workspace pages:
  - Halaman Penjual
  - Halaman Pembeli
  - Halaman Bayar
  - Operasional Manual
  - Konfirmasi OTP

Expected result:

- Real frontend routes/components
- Help/Tutorial modal
- Status progression matching `TRD.md`

## HL-003 Data Model and Database Setup

Goal:

- Choose Prisma or Drizzle.
- Implement schema based on `DATABASE.md`.
- Include users, transaction parties, transactions, manual payment claims, payment reviews, WA groups, confirmation links/OTPs, issues/outcomes, payouts, audit logs.

Expected result:

- Database schema/migrations
- Seed data for prototype-like sample transaction
- Basic model tests if test framework exists

## HL-004 Transaction Creation

Goal:

- Implement seller-created and buyer-created transaction creation.
- Seller-created: seller enters deal detail, buyer contact, seller bank.
- Buyer-created: buyer enters deal detail, seller contact, seller bank.
- Create transaction code/link.
- Set `payment_expires_at` to 1x24 hours after transaction becomes payable.

Expected result:

- Transaction create UI/API
- Validation for minimum amount and required seller bank
- Audit log for transaction creation

## HL-005 Manual Buyer Payment Claim

Goal:

- Implement buyer payment instruction page.
- Buyer can click `Sudah Bayar`.
- Clicking `Sudah Bayar` creates a manual payment claim and moves status to `PAYMENT_UNDER_REVIEW`.

Expected result:

- Payment instruction route
- Payment claim API/action
- Audit log for `PAYMENT_CLAIMED`

## HL-006 Admin Manual Payment Review

Goal:

- Implement manual ops page for admin/operator.
- Admin can mark payment as confirmed, not found, invalid, or manual review.
- Confirmed payment moves transaction to `PAYMENT_CONFIRMED`.
- Not found returns to `WAITING_BUYER_PAYMENT` if not expired.

Expected result:

- Admin payment review UI/API
- Payment review records
- Audit logs

## HL-007 WhatsApp Ops Tracking

Goal:

- Implement WA group tracking.
- Admin records group name/link.
- Admin marks payment announcement sent.
- Status moves `PAYMENT_CONFIRMED -> WA_GROUP_CREATED -> PAYMENT_ANNOUNCED`.

Expected result:

- WA group records
- Payment announcement action
- Audit logs

## HL-008 Fulfillment and Buyer Confirmation Link

Goal:

- Record seller shipped / order complete signal.
- Admin generates buyer confirmation link.
- Buyer opens link and requests OTP.
- OTP may be mocked first.

Expected result:

- Status moves `PAYMENT_ANNOUNCED -> SELLER_SHIPPED -> WAITING_BUYER_CONFIRMATION`.
- Confirmation link token hashing.
- OTP request record with expiry/attempts.

## HL-009 Buyer OTP Verify and Manual Payout

Goal:

- Verify buyer OTP.
- Move transaction to `BUYER_CONFIRMED -> PAYOUT_PENDING`.
- Admin records manual payout result.
- Successful payout moves to `PAID_OUT`.

Expected result:

- OTP verification flow
- Payout record UI/API
- Seller bank snapshot preserved
- Audit logs

## HL-010 Payment Expiry Job

Goal:

- Implement scheduled job or script for unpaid transaction expiry.
- Find `WAITING_BUYER_PAYMENT` transactions past `payment_expires_at`.
- Move them to `PAYMENT_EXPIRED`.

Expected result:

- Expiry job/script
- Tests for expiry behavior
- Audit logs for system-driven expiry
