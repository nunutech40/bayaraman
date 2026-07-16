# BayarAman User Journey

Version: v1
Status: Draft
Source: Latest manual-payment rekber flow

## 1. Overview

BayarAman MVP has two transaction creation journeys:

1. Seller creates transaction.
2. Buyer creates transaction and inputs seller bank account.

After transaction creation, both journeys share the same operational flow:

```text
buyer pays to BayarAman account
buyer clicks Sudah Bayar
admin checks payment
admin creates WhatsApp group
admin announces payment received
seller ships goods/service
seller and buyer report completion in WhatsApp group
admin sends buyer confirmation link
buyer confirms with OTP
admin manually transfers payout to seller
```

Buyer-seller complaints are handled outside the system during MVP, primarily in the WhatsApp group. BayarAman only records the final outcome.

Unpaid transactions expire after 1x24 hours.

## 2. Actors

### Seller

Role:

- Creates transaction in seller-input journey.
- Provides seller payout bank account.
- Ships goods/service after admin announces payment received.
- Reports completion in WhatsApp group.
- Receives manual payout from admin.

Inputs:

- Seller name.
- Seller WhatsApp/phone.
- Seller bank name.
- Seller bank account number.
- Seller bank account holder.
- Deal details when seller creates transaction.

### Buyer

Role:

- Creates transaction in buyer-input journey.
- Pays to BayarAman bank account.
- Clicks `Sudah Bayar`.
- Joins WhatsApp group.
- Reports completion in WhatsApp group.
- Opens confirmation link and verifies OTP.

Inputs:

- Buyer name.
- Buyer WhatsApp/phone.
- Buyer email.
- Deal details when buyer creates transaction.
- Seller contact and bank account when buyer creates transaction.
- OTP during confirmation.

### Admin / Operator

Role:

- Checks incoming payment manually.
- Creates WhatsApp group.
- Announces payment received in group.
- Sends buyer confirmation link.
- Records final outcome if there is an issue.
- Manually transfers payout to seller.

Inputs:

- Payment review result.
- WhatsApp group name/link.
- Payment announcement status.
- Confirmation link generation.
- Payout reference.
- Final outcome note if issue/refund/split/cancel happens.

## 3. Journey A: Seller Creates Transaction

Journey metadata:

```text
Journey name: Seller-created transaction
Primary actor: Seller
Supporting actors: Buyer, Admin/Operator
Entry point: Seller opens BayarAman and creates transaction
End state: Seller receives payout or transaction gets final non-release outcome
```

| Step | Actor | User action | System action | Manual operation? | Data involved | Status after step | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Seller | Opens seller transaction form | Shows transaction form | No | - | DRAFT | Seller is input user |
| 2 | Seller | Enters deal detail and seller bank account | Validates required fields | No | title, amount, agreement, buyer contact, seller bank | DRAFT | Fee can be calculated here |
| 3 | Seller | Submits transaction | Creates transaction code/link | No | transaction data | WAITING_BUYER_PAYMENT | Payment expiry starts, 1x24 hours |
| 4 | Seller | Shares transaction link to buyer | Public/limited transaction page available | Manual | transaction link | WAITING_BUYER_PAYMENT | Sharing happens outside system |
| 5 | Buyer | Opens link and reviews detail | Shows amount, fee, total, payment instruction | No | transaction code | WAITING_BUYER_PAYMENT | Buyer must verify detail before paying |
| 6 | Buyer | Transfers money to BayarAman account | No automatic confirmation | Manual | total buyer pay, BayarAman bank account | WAITING_BUYER_PAYMENT | Buyer pays outside system |
| 7 | Buyer | Clicks `Sudah Bayar` | Creates payment claim | No | payment claim timestamp/note | PAYMENT_UNDER_REVIEW | This is not payment confirmation |
| 8 | Admin | Checks BayarAman bank account | Records payment review result | Manual | expected amount, received amount, review note | PAYMENT_CONFIRMED or WAITING_BUYER_PAYMENT or PAYMENT_INVALID | Admin is source of truth |
| 9 | Admin | Creates WhatsApp group | Stores group name/link | Manual | group name/link | WA_GROUP_CREATED | Group includes buyer, seller, admin |
| 10 | Admin | Announces payment received in group | Marks announcement sent | Manual | announcement timestamp | PAYMENT_ANNOUNCED | Seller should ship only after this |
| 11 | Seller | Ships goods/service | System may record note/status if admin updates | Manual | shipping/progress note | SELLER_SHIPPED | Delivery proof upload is not MVP requirement |
| 12 | Seller and Buyer | Report order completed in WA group | No automatic detection | Manual | completion message in WA | SELLER_SHIPPED | Admin acts after seeing completion |
| 13 | Admin | Sends buyer confirmation link in group | Generates confirmation token/link | Manual + system | token hash, expiry, buyer contact | WAITING_BUYER_CONFIRMATION | Link sent in WA group |
| 14 | Buyer | Opens confirmation link | Shows confirmation page | No | confirmation token | WAITING_BUYER_CONFIRMATION | Buyer identity/contact checked |
| 15 | Buyer | Requests/receives OTP via email or WhatsApp | Sends/stores OTP hash | No/system provider | OTP channel, OTP hash, expiry | WAITING_BUYER_CONFIRMATION | Raw OTP never stored |
| 16 | Buyer | Enters OTP | Verifies OTP | No | OTP attempt | BUYER_CONFIRMED | Transaction becomes payout eligible |
| 17 | Admin | Transfers payout to seller | Records payout result | Manual | seller bank snapshot, payout amount, reference | PAID_OUT | Money transfer happens outside system |

## 4. Journey B: Buyer Creates Transaction

Journey metadata:

```text
Journey name: Buyer-created transaction
Primary actor: Buyer
Supporting actors: Seller, Admin/Operator
Entry point: Buyer opens BayarAman and creates transaction
End state: Seller receives payout or transaction gets final non-release outcome
```

| Step | Actor | User action | System action | Manual operation? | Data involved | Status after step | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Buyer | Opens buyer transaction form | Shows transaction form | No | - | DRAFT | Buyer is input user |
| 2 | Buyer | Enters deal detail | Validates required fields | No | title, amount, agreement | DRAFT | Buyer defines deal context |
| 3 | Buyer | Enters seller contact and seller bank account | Stores seller data snapshot | No | seller name, seller phone, bank name, account number, holder | DRAFT | Seller bank is required before buyer pays |
| 4 | Buyer | Submits transaction | Creates transaction code | No | transaction data | WAITING_BUYER_PAYMENT | Payment expiry starts, 1x24 hours |
| 5 | Buyer | Reviews payment instruction | Shows BayarAman bank account and total | No | total buyer pay | WAITING_BUYER_PAYMENT | Buyer pays BayarAman, not seller |
| 6 | Buyer | Transfers money to BayarAman account | No automatic confirmation | Manual | total buyer pay, BayarAman bank account | WAITING_BUYER_PAYMENT | Buyer pays outside system |
| 7 | Buyer | Clicks `Sudah Bayar` | Creates payment claim | No | payment claim timestamp/note | PAYMENT_UNDER_REVIEW | Claim only |
| 8 | Admin | Checks BayarAman bank account | Records payment review result | Manual | expected amount, received amount, review note | PAYMENT_CONFIRMED or WAITING_BUYER_PAYMENT or PAYMENT_INVALID | Admin confirms payment |
| 9 | Admin | Creates WhatsApp group | Stores group name/link | Manual | buyer, seller, admin, group link | WA_GROUP_CREATED | Seller joins group here |
| 10 | Admin | Announces payment received in group | Marks announcement sent | Manual | announcement timestamp | PAYMENT_ANNOUNCED | Seller should ship only after this |
| 11 | Seller | Ships goods/service | System may record note/status if admin updates | Manual | shipping/progress note | SELLER_SHIPPED | Seller fulfills outside system |
| 12 | Seller and Buyer | Report order completed in WA group | No automatic detection | Manual | completion message in WA | SELLER_SHIPPED | Admin acts after seeing completion |
| 13 | Admin | Sends buyer confirmation link in group | Generates confirmation token/link | Manual + system | token hash, expiry, buyer contact | WAITING_BUYER_CONFIRMATION | Same confirmation flow as seller-created |
| 14 | Buyer | Opens confirmation link and verifies OTP | Verifies completion | No | OTP channel, OTP attempt | BUYER_CONFIRMED | Payout eligible |
| 15 | Admin | Transfers payout to seller | Records payout result | Manual | seller bank snapshot, payout amount, reference | PAID_OUT | Final happy path |

## 5. Shared Confirmation Journey

| Step | Actor | User action | System action | Manual operation? | Data involved | Status after step | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Admin | Generates confirmation link | Creates token hash and expiry | Manual + system | buyer contact, token hash | WAITING_BUYER_CONFIRMATION | Admin sends link in WA group |
| 2 | Buyer | Opens link | Shows confirmation page | No | token | WAITING_BUYER_CONFIRMATION | Link must be valid |
| 3 | Buyer | Chooses/uses OTP channel | Sends OTP to email or WhatsApp | No/system provider | email/phone, otp hash | WAITING_BUYER_CONFIRMATION | Raw OTP never stored |
| 4 | Buyer | Enters OTP | Validates OTP, expiry, attempts | No | OTP attempt | BUYER_CONFIRMED | Payout eligible |
| 5 | Admin | Transfers seller payout | Records payout | Manual | payout reference | PAID_OUT | Payout is outside system |

## 6. Shared Manual Operations

These steps are intentionally manual in MVP:

| Manual operation | Owner | System records |
| --- | --- | --- |
| Buyer bank transfer to BayarAman | Buyer | Payment claim after `Sudah Bayar` |
| Payment checking | Admin | Payment review result |
| WhatsApp group creation | Admin | Group name/link |
| Payment announcement in group | Admin | Announcement timestamp |
| Seller shipping/fulfillment | Seller | Optional operational note/status |
| Completion discussion | Buyer + Seller + Admin | Confirmation link generation after completion |
| Complaint handling | Buyer + Seller + Admin | Final outcome only |
| Seller payout transfer | Admin/Finance | Payout record/reference |

## 7. Data Inputs By Actor

### Seller Inputs

Seller-created flow:

- Transaction title.
- Transaction amount.
- Category.
- Agreement/description.
- Buyer name/contact, if known.
- Seller payout bank name.
- Seller payout account number.
- Seller payout account holder.

Shared/manual:

- Shipping/progress information in WhatsApp group.
- Completion confirmation in WhatsApp group.

### Buyer Inputs

Buyer-created flow:

- Transaction title.
- Transaction amount.
- Category.
- Agreement/description.
- Seller name/contact.
- Seller payout bank name.
- Seller payout account number.
- Seller payout account holder.

Shared:

- Buyer name.
- Buyer WhatsApp/phone.
- Buyer email.
- `Sudah Bayar` payment claim.
- OTP confirmation.

### Admin Inputs

- Payment review result.
- Received amount, if found.
- Payment review note for non-confirmed result.
- WhatsApp group name/link.
- Payment announcement marker.
- Confirmation link generation.
- Final outcome note if release/refund/split/cancel.
- Payout amount/reference/status.

## 8. Status Timeline

Happy path:

```text
DRAFT
-> WAITING_BUYER_PAYMENT
-> PAYMENT_UNDER_REVIEW
-> PAYMENT_CONFIRMED
-> WA_GROUP_CREATED
-> PAYMENT_ANNOUNCED
-> SELLER_SHIPPED
-> WAITING_BUYER_CONFIRMATION
-> BUYER_CONFIRMED
-> PAYOUT_PENDING
-> PAYOUT_PROCESSING
-> PAID_OUT
```

Important alternate paths:

```text
WAITING_BUYER_PAYMENT -> PAYMENT_EXPIRED
PAYMENT_UNDER_REVIEW -> WAITING_BUYER_PAYMENT
PAYMENT_UNDER_REVIEW -> PAYMENT_INVALID
PAYMENT_UNDER_REVIEW -> MANUAL_REVIEW
SELLER_SHIPPED -> ISSUE_REPORTED -> MANUAL_REVIEW
MANUAL_REVIEW -> REFUND_PENDING -> REFUNDED
MANUAL_REVIEW -> SPLIT_SETTLEMENT
MANUAL_REVIEW -> CANCELLED
PAYOUT_PROCESSING -> PAYOUT_FAILED
```

## 9. QA Scenario Seeds

These should become detailed QA cases in `02-user-requirements.md` and `03-qa-scenarios.md`.

1. Seller-created happy path.
2. Buyer-created happy path.
3. Buyer clicks `Sudah Bayar`, admin finds payment.
4. Buyer clicks `Sudah Bayar`, admin does not find payment.
5. Buyer does not pay within 1x24 hours.
6. Admin creates WA group but has not announced payment yet.
7. Seller tries to ship before admin announcement.
8. Buyer OTP succeeds.
9. Buyer OTP fails or expires.
10. Admin records final non-release outcome after external complaint handling.
11. Manual payout succeeds.
12. Manual payout fails.

## 10. Open Questions

- What exact BayarAman bank account will be shown in MVP?
- Should buyer enter optional transfer source bank/account holder when clicking `Sudah Bayar`?
- How long should buyer confirmation link stay valid?
- What is the OTP expiry duration?
- Who is allowed to record manual payout during MVP: admin, finance, or both?
- How should admin record external complaint outcome notes?
- Should seller shipping be a real system status or only an admin operational marker?

