# Technical Requirements Document (TRD)

# BayarAman MVP: Manual Payment Review + Manual Payout

## 1. Document Control

- Product: BayarAman
- Version: TRD v4.0
- Status: Draft aligned with PRD v4.0
- Source PRD: `PRD.md`
- Last updated: 2026-07-14

## 2. Technical Summary

BayarAman MVP uses manual payment collection and manual operations for fulfillment coordination and seller payout/pencairan. The backend creates a transaction and expected payment instruction, buyer clicks `Sudah Bayar`, admin manually checks incoming payment, records the transaction as paid, then operator creates a WhatsApp group, sends buyer confirmation link, verifies OTP, and records manual payout to seller.

Transactions that remain unpaid expire after 1x24 hours.

## 3. Technology Stack

- Frontend/backend: Next.js
- Language: TypeScript
- ORM: Prisma or Drizzle
- Database: PostgreSQL
- Auth: Auth.js/NextAuth.js with email/password credentials and Google OAuth
- Password hashing: Argon2id preferred, bcrypt acceptable
- Manual payment collection: BayarAman bank account
- Email OTP: Resend, SendGrid, Postmark, or equivalent
- WhatsApp OTP: WhatsApp Business API provider later; manual/operator fallback acceptable for MVP
- File storage: optional for payout references/proofs; S3/R2/Supabase Storage
- Queue/cron: useful for payment expiry checks, OTP cleanup, reminders, and operational SLA reminders

## 4. System Architecture

```text
Buyer/Seller Browser
        |
        v
BayarAman Web App
        |
        v
BayarAman Backend/API
   |        |          |
   |        |          +--> Email/OTP provider
   |        +-------------> PostgreSQL
   +----------------------> Optional object storage

Manual ops:
- buyer pays to BayarAman bank account
- buyer clicks Sudah Bayar
- admin checks incoming payment manually
- operator creates WhatsApp group
- operator sends confirmation link
- operator manually transfers/pays out seller
```

## 5. Core Technical Flows

### 5.1 Business Model Flow

```mermaid
flowchart LR
  A[Buyer and seller deal outside marketplace] --> B[One party creates BayarAman transaction]
  B --> C[Buyer pays to BayarAman bank account]
  C --> D[Buyer clicks Sudah Bayar]
  D --> E[Admin verifies incoming payment]
  E --> F[Operator creates WA trust room]
  F --> G[Seller fulfills order]
  G --> H[Buyer confirms with OTP]
  H --> I[BayarAman keeps fee]
  I --> J[Operator manually pays out seller]
```

### 5.2 Seller-Created App Flow

```mermaid
flowchart TD
  S[Seller creates transaction] --> A[Seller enters amount, agreement, buyer contact, seller bank]
  A --> B[System creates transaction code/link]
  B --> C[Seller shares link to buyer]
  C --> D[Buyer opens link and logs in/verifies]
  D --> E[System shows BayarAman bank payment instruction]
  E --> F[Buyer pays to BayarAman bank account]
  F --> G[Buyer clicks Sudah Bayar]
  G --> H[Status: PAYMENT_UNDER_REVIEW]
  H --> I[Admin checks incoming payment]
  I --> J{Payment valid?}
  J -->|No| K[Return to WAITING_BUYER_PAYMENT or manual review]
  J -->|Yes| L[Status: PAYMENT_CONFIRMED]
  L --> M[Operator creates WA group and stores link]
  M --> N[Operator announces payment received]
  N --> O[Seller fulfills order]
  O --> P[Buyer and seller report complete in WA group]
  P --> Q[Operator sends confirmation link]
  Q --> R[Buyer OTP confirmation]
  R --> T[PAYOUT_PENDING]
  T --> U[Operator records manual payout]
  E --> V[Unpaid after 1x24 hours]
  V --> W[PAYMENT_EXPIRED]
```

### 5.3 Buyer-Created App Flow

```mermaid
flowchart TD
  B[Buyer creates transaction] --> A[Buyer enters deal detail, seller contact, seller bank]
  A --> F[System shows BayarAman bank payment instruction]
  F --> G[Buyer pays to BayarAman bank account]
  G --> H[Buyer clicks Sudah Bayar]
  H --> I[Admin checks incoming payment]
  I --> J{Payment valid?}
  J -->|No| K[Return to WAITING_BUYER_PAYMENT or manual review]
  J -->|Yes| L[Operator creates WA group]
  L --> M[Operator announces payment received]
  M --> N[Seller fulfills order]
  N --> O[Buyer and seller report complete in WA group]
  O --> P[Operator sends confirmation link]
  P --> Q[Buyer confirms with OTP]
  Q --> R[Operator pays out seller manually]
  F --> S[Unpaid after 1x24 hours]
  S --> T[PAYMENT_EXPIRED]
```

### 5.4 Manual Payment Review Sequence

```mermaid
sequenceDiagram
  autonumber
  actor Buyer
  actor Admin
  participant Web as BayarAman Web
  participant API as BayarAman API
  participant DB as PostgreSQL
  participant Bank as BayarAman Bank Account

  Buyer->>Web: Open payable transaction
  Web->>API: GET /api/transactions/:code
  API->>DB: Load transaction and expected payment amount
  API-->>Web: Payment instruction + expiry time
  Buyer->>Bank: Transfer to BayarAman account
  Buyer->>Web: Click Sudah Bayar
  Web->>API: POST /api/transactions/:id/payment-claim
  API->>DB: Set status PAYMENT_UNDER_REVIEW and store claimed_at
  Admin->>Bank: Check incoming payment manually
  Admin->>Web: Record payment review result
  Web->>API: POST /api/ops/transactions/:id/payment-review
  API->>DB: Validate expected amount and current status
  API->>DB: If valid, set payment status CONFIRMED and transaction PAYMENT_CONFIRMED
```

### 5.5 Payment Expiry Sequence

```mermaid
sequenceDiagram
  autonumber
  participant Cron as Scheduler/Cron
  participant API as BayarAman API
  participant DB as PostgreSQL

  Cron->>API: Run payment expiry job
  API->>DB: Find WAITING_BUYER_PAYMENT transactions past expires_at
  API->>DB: Mark transactions PAYMENT_EXPIRED
  API->>DB: Append audit log
```

### 5.6 WA Group and Fulfillment Sequence

```mermaid
sequenceDiagram
  autonumber
  actor Operator
  actor Buyer
  actor Seller
  participant Web as BayarAman Ops Route
  participant API as BayarAman API
  participant DB as PostgreSQL
  participant WA as WhatsApp

  Operator->>WA: Create group with buyer, seller, operator
  Operator->>Web: Paste group name/link
  Web->>API: POST /api/ops/transactions/:id/wa-group
  API->>DB: Store wa_group_url, wa_group_created_at
  Operator->>WA: Announce payment received
  Web->>API: POST /api/ops/transactions/:id/payment-announcement
  API->>DB: Set status PAYMENT_ANNOUNCED after operator announcement
  Seller->>WA: Send shipping/progress info
  Buyer->>WA: Confirms item/service completion verbally
```

### 5.7 Buyer Confirmation OTP Sequence

```mermaid
sequenceDiagram
  autonumber
  actor Operator
  actor Buyer
  participant Web as BayarAman Web
  participant API as BayarAman API
  participant OTP as Email/WhatsApp OTP Provider
  participant DB as PostgreSQL

  Operator->>Web: Generate buyer confirmation link
  Web->>API: POST /api/ops/transactions/:id/confirmation-link
  API->>DB: Store token_hash, expiry, status WAITING_BUYER_CONFIRMATION
  Operator->>Buyer: Send link in WA group
  Buyer->>Web: Open confirmation link
  Web->>API: POST /api/confirmations/:token/request-otp
  API->>OTP: Send OTP to buyer email or WhatsApp
  API->>DB: Store otp_hash, expires_at, attempts=0
  Buyer->>Web: Submit OTP
  Web->>API: POST /api/confirmations/:token/verify
  API->>DB: Validate token, OTP, expiry, attempts
  API->>DB: Set status BUYER_CONFIRMED and PAYOUT_PENDING
```

### 5.8 Manual Payout/Pencairan Sequence

```mermaid
sequenceDiagram
  autonumber
  actor Operator
  participant Web as BayarAman Ops Route
  participant API as BayarAman API
  participant DB as PostgreSQL
  participant Bank as Operator Bank App

  Operator->>Web: Open payout-eligible transaction
  Web->>API: GET payout detail
  API-->>Web: Seller bank, seller net, fee, buyer confirmation
  Operator->>Bank: Transfer seller payout manually
  Operator->>Web: Record payout result/reference
  Web->>API: POST /api/ops/transactions/:id/payout
  API->>DB: Store payout status, paid_at, reference, audit log
  API->>DB: Set transaction PAID_OUT when payout succeeds
```

## 6. Transaction State Model

```mermaid
stateDiagram-v2
  [*] --> DRAFT
  DRAFT --> WAITING_BUYER_PAYMENT
  WAITING_BUYER_PAYMENT --> PAYMENT_UNDER_REVIEW
  WAITING_BUYER_PAYMENT --> PAYMENT_EXPIRED
  PAYMENT_UNDER_REVIEW --> PAYMENT_CONFIRMED
  PAYMENT_UNDER_REVIEW --> WAITING_BUYER_PAYMENT
  PAYMENT_UNDER_REVIEW --> PAYMENT_INVALID
  PAYMENT_UNDER_REVIEW --> MANUAL_REVIEW
  PAYMENT_CONFIRMED --> WA_GROUP_CREATED
  WA_GROUP_CREATED --> PAYMENT_ANNOUNCED
  PAYMENT_ANNOUNCED --> SELLER_SHIPPED
  SELLER_SHIPPED --> WAITING_BUYER_CONFIRMATION
  SELLER_SHIPPED --> ISSUE_REPORTED
  ISSUE_REPORTED --> MANUAL_REVIEW
  MANUAL_REVIEW --> WAITING_BUYER_CONFIRMATION
  MANUAL_REVIEW --> REFUND_PENDING
  MANUAL_REVIEW --> SPLIT_SETTLEMENT
  MANUAL_REVIEW --> CANCELLED
  WAITING_BUYER_CONFIRMATION --> BUYER_CONFIRMED
  BUYER_CONFIRMED --> PAYOUT_PENDING
  PAYOUT_PENDING --> PAYOUT_PROCESSING
  PAYOUT_PROCESSING --> PAID_OUT
  PAYOUT_PROCESSING --> PAYOUT_FAILED
  REFUND_PENDING --> REFUNDED
  PAID_OUT --> [*]
  REFUNDED --> [*]
```

## 7. Core Modules

### Auth and Identity

- Email/password registration.
- Google OAuth registration/login.
- Email verification.
- Phone verification.
- Buyer confirmation OTP.
- Transaction-level buyer/seller role.
- Admin/finance login reserved for Phase 2.

### Transaction

- Create seller-created transaction.
- Create buyer-created transaction.
- Generate transaction code/link.
- Store seller contact and seller payout bank for buyer-created transaction.
- Store seller payout bank account.
- Set payment expiry to 1x24 hours after transaction becomes payable.
- Enforce state transitions.

### Manual Payment

- Store BayarAman payment destination and expected amount.
- Record buyer `Sudah Bayar` claim.
- Store admin payment review result.
- Track payment status: waiting, under review, confirmed, not found, invalid, expired.
- Append audit log for claim and review actions.

### WhatsApp Operations

- Store WA group name/link.
- Store group-created timestamp and operator note.
- Track that payment announcement has been made.
- MVP group creation happens manually outside system.

### Buyer Confirmation

- Generate short-lived confirmation link.
- Send OTP to buyer email or WhatsApp.
- Verify OTP with attempt limit and expiry.
- Move transaction to payout eligibility.

### Manual Outcome and Issue Recording

- Full in-app dispute is out of MVP.
- Buyer/seller complaint is handled outside system, mainly in WA group.
- System records final outcome: release, refund, split, cancelled.
- Non-normal outcome requires operator note.

### Manual Payout

- Calculate seller net payout.
- Store seller bank account snapshot.
- Record payout status/reference/timestamp.
- Append audit log for payout decisions.

## 8. API Surface Draft

User-facing:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/transactions/:code`
- `POST /api/transactions`
- `POST /api/transactions/:id/payment-claim`
- `POST /api/confirmations/:token/request-otp`
- `POST /api/confirmations/:token/verify`

Operator MVP routes:

- `POST /api/ops/transactions/:id/payment-review`
- `POST /api/ops/transactions/:id/wa-group`
- `POST /api/ops/transactions/:id/payment-announcement`
- `POST /api/ops/transactions/:id/confirmation-link`
- `POST /api/ops/transactions/:id/outcome`
- `POST /api/ops/transactions/:id/payout`

Scheduled jobs:

- `payment-expiry`: mark unpaid payable transactions as expired after 1x24 hours.

## 9. Manual Payment Implementation Rules

- Store the expected amount before showing payment instruction.
- Payment confirmation must be admin-driven, not buyer-claim-driven.
- Buyer clicking `Sudah Bayar` only moves the transaction to `PAYMENT_UNDER_REVIEW`.
- Admin review should compare expected amount, transaction code/reference if available, timestamp, and any operational notes.
- If payment is not found, return to `WAITING_BUYER_PAYMENT` if still within expiry.
- If payment is invalid or anomalous, move to `PAYMENT_INVALID` or `MANUAL_REVIEW`.
- If payment is not completed in 1x24 hours, move to `PAYMENT_EXPIRED`.
- Every payment claim, review, status change, and override must be audit-logged.

## 10. PRD-to-TRD Traceability

| PRD Need | TRD Implementation |
| --- | --- |
| Seller creates transaction | Transaction module, transaction link |
| Buyer creates transaction | Transaction module, seller contact and bank input |
| Buyer pays to BayarAman account | Manual payment instruction |
| Buyer clicks Sudah Bayar | Payment claim endpoint |
| Admin checks incoming payment | Payment review ops endpoint |
| Unpaid transaction expires 1x24 hours | Payment expiry job |
| WA group created manually | WA operations fields/API |
| Buyer confirms via link + OTP | Confirmation token + OTP module |
| Admin transfers money to seller | Manual payout/pencairan module |
| Complaint outside system | Outcome/issue recording only |
