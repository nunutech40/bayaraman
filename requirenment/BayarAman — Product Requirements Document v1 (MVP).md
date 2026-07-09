# BayarAman — Product Requirements Document v1 (MVP)

<aside>
<img src="https://app.notion.com/icons/document_blue.svg" alt="https://app.notion.com/icons/document_blue.svg" width="40px" />

**Dokumen ini**: PRD v1 untuk MVP BayarAman (manual-first) — scope, goals, roles, status flow, requirements (FR), dan acceptance criteria.

</aside>

## 1) Document overview

- Product name: **BayarAman**
- Product type: Manual-first rekber platform untuk transaksi online di luar marketplace
- Version: **v1 MVP**

Primary goal:

Membangun MVP yang memungkinkan buyer & seller bertransaksi lebih aman menggunakan:

- Seller-created transaction link
- Manual transfer ke rekening BCA BayarAman
- Manual payment verification
- Secured fund status
- Seller delivery proof
- Buyer confirmation
- Auto-release setelah 1x24 jam
- Manual dispute resolution
- Manual payout ke seller
- Audit trail untuk aksi penting

## 2) Product summary

BayarAman adalah rekber platform yang membantu buyer & seller transaksi lebih aman di luar marketplace.

BayarAman bukan marketplace, wallet, atau full payment gateway.

Flow:

- Seller creates transaction link
- Buyer reviews transaction detail
- Buyer transfers to BayarAman BCA
- Buyer clicks “Sudah Bayar”
- Admin verifies payment manually
- Funds are marked as secured
- Seller delivers goods/services
- Buyer confirms or disputes
- Funds are released to seller or refunded based on decision

## 3) Product goals

### MVP goals

1. Enable seller create & share transaction links.
2. Enable buyer review details before paying.
3. Enable buyer confirm transfer via **Sudah Bayar**.
4. Enable admin/finance verify BCA payment manually.
5. Enable seller upload delivery proof.
6. Enable buyer confirm received atau open dispute.
7. Enable auto-release after 1x24 jam if no dispute.
8. Enable admin process dispute manually.
9. Enable admin/finance process seller payout manually.
10. Maintain audit trail for important actions.

### Business goals

1. Validasi trust pada manual-first flow.
2. Validasi fee model: 2%, min 20k, max 100k.
3. Validasi demand Free vs Pro.
4. Validasi workload operasional manual payment/payout.
5. Validasi dispute process & kualitas evidence.

## 4) Non-goals (MVP)

- Payment gateway integration
- Virtual account automation
- QRIS / e-wallet / kartu kredit
- Auto payout
- Wallet/internal balance
- Marketplace listing / storefront
- Mobile native app
- Realtime chat
- AI fraud scoring
- Auto-KYC
- Subscription billing automation
- Multi-currency
- Crypto escrow

## 5) User roles

### Buyer

- Open link, review detail
- Pay manual ke BCA BayarAman
- Click **Sudah Bayar**
- Track payment verification
- Confirm received
- Open dispute
- Receive refund (if approved)

### Seller

- Create & share link
- Track buyer payment status
- Upload delivery proof
- Respond to dispute
- Receive payout manual

### Admin / Finance

- Payment verification queue
- Check mutasi BCA, approve/reject payment
- Review risk
- Review disputes, decide refund/release/split
- Process payout manual, mark paid/failed
- View audit logs

### Super admin

- Manage users & admin roles
- Manage fee settings & limits
- Freeze/unfreeze transaksi
- View audit logs & risk flags

## 6) User tier requirements

### Free user

Requirements:

- No KYC by default
- Email verification required
- Phone verification required

Limits:

- Max per transaction: Rp1.000.000
- Daily limit: Rp1.500.000
- Monthly limit: Rp3.000.000

Fees:

- Transaction fee: 2% (min 20k, max 100k)
- Cancel fee: Rp5.000

### Pro user

Pricing:

- Monthly: Rp100.000
- Annual: Rp1.000.000

Requirements:

- No KYC by default
- Email verification required
- Phone verification required

Limits:

- Unlimited monthly volume
- Transaction above Rp5.000.000 requires manual review

Fees:

- Transaction fee tetap berlaku
- Cancel fee: free

Benefits:

- Unlimited monthly volume
- Priority review
- Trust badge
- Higher flexibility

Guardrail:

Pro user tetap bisa kena manual review/freeze/verification tambahan bila high-risk/suspicious.

## 7) Supported transactions

Supported by default:

- Barang fisik legal, barang second, gadget, elektronik kecil
- Produk digital legal
- Jasa digital / freelance kecil
- Transaksi komunitas / C2C di luar marketplace

Forbidden:

- Barang ilegal/curian/palsu
- Narkotika/obat resep
- Senjata/amunisi
- Produk dewasa
- Judi
- Crypto/investasi/forex
- Pinjaman
- Akun finansial / rekening bank
- Data pribadi / dokumen identitas
- Jasa hacking/spam/bot
- Barang berizin khusus
- Hewan dilindungi

High-risk (manual review / bisa ditolak):

- Barang sangat mahal / branded mahal
- Tiket event
- Pre-order
- Barang custom
- Perhiasan
- Kendaraan
- Properti

## 8) Pricing requirements

### Transaction fee

System must calculate:

- Fee = 2% dari transaction amount
- Minimum fee = Rp20.000
- Maximum fee = Rp100.000
- Minimum transaction amount = Rp100.000

Examples:

- 100k → 20k
- 500k → 20k
- 1jt → 20k
- 5jt → 100k

### Fee payer

System must allow:

- Buyer pays fee (default)
- Seller pays fee
- Split fee

### Cancel fee

- Rp5.000 untuk Free user, free untuk Pro
- Berlaku jika buyer cancel tanpa seller fault
- Tidak berlaku jika seller fault/fraud atau admin decides full refund

## 9) Core transaction flow (status)

Seller-first happy path:

`DRAFT → WAITING_BUYER_PAYMENT → PAYMENT_UNDER_REVIEW → FUNDS_SECURED → DELIVERED → RELEASE_PENDING → COMPLETED → PAYOUT_PENDING → PAYOUT_PROCESSING → PAID_OUT`

Buyer-first happy path:

`DRAFT → WAITING_SELLER_ACCEPTANCE → WAITING_BUYER_PAYMENT → PAYMENT_UNDER_REVIEW → FUNDS_SECURED → DELIVERED → RELEASE_PENDING → COMPLETED → PAYOUT_PENDING → PAYOUT_PROCESSING → PAID_OUT`

Dispute path:

`FUNDS_SECURED/DELIVERED → DISPUTED → UNDER_REVIEW → (REFUND_PENDING/RELEASE_PENDING/SPLIT_SETTLEMENT) → (REFUNDED/COMPLETED)`

Cancel path:

`WAITING_BUYER_PAYMENT → CANCELLED`  

`WAITING_SELLER_ACCEPTANCE → CANCELLED`

Expiry path:

`WAITING_BUYER_PAYMENT → EXPIRED`

## 10) Functional requirements

### 10.1 Authentication

- **FR-AUTH-001 — Registration**: register via email/phone/password.
- **FR-AUTH-002 — Verification**: email + phone verification required sebelum create/participate transaksi.
- **FR-AUTH-003 — Login**: login untuk user terdaftar.
- **FR-AUTH-004 — Role detection**: buyer/seller/admin/finance/super admin per transaksi.

### 10.2 Transaction creation

- **FR-TXN-001 — Seller creates transaction link** dengan field: title, amount (>=100k), category, agreement, delivery deadline, fee payer, buyer contact (optional). Status: WAITING_BUYER_PAYMENT. Generate link `bayaraman.id/t/{code}`.
- **FR-TXN-002 — Buyer opens link**: view title, seller, amount, fee, total, agreement, deadline, auto-release policy, cancel/refund policy, CTA **Setuju & Lanjut Bayar**.
- **FR-TXN-003 — Buyer-created transaction (secondary)**: status WAITING_SELLER_ACCEPTANCE; seller accept/reject/request revision; if accept → WAITING_BUYER_PAYMENT.

### 10.3 Fee calculation

- **FR-FEE-001**: calculate fee rule 2% min 20k max 100k.
- **FR-FEE-002**: total pay & net seller receive sesuai fee payer.
- **FR-FEE-003**: fee breakdown wajib jelas sebelum bayar.

### 10.4 Manual payment

- **FR-PAY-001**: show BCA payment instruction + expiry 24 jam.
- **FR-PAY-002**: buyer click **Sudah Bayar** → status PAYMENT_UNDER_REVIEW + messaging.
- **FR-PAY-003**: admin payment verification queue for PAYMENT_UNDER_REVIEW.
- **FR-PAY-004**: admin approves payment → FUNDS_SECURED.
- **FR-PAY-005**: admin marks payment not found → back to WAITING_BUYER_PAYMENT + note.
- **FR-PAY-006**: unpaid 24 jam → EXPIRED.
- **FR-PAY-007**: wrong amount/anomaly handling via admin notes + risk flag.

### 10.5 Secured fund status

- **FR-SEC-001**: setelah approve payment, tampilkan “Dana sudah diamankan” + seller dapat upload delivery proof.

### 10.6 Delivery proof

- **FR-DEL-001**: seller upload delivery proof (berdasarkan kategori) → status DELIVERED + buyer review window mulai.

### 10.7 Buyer review

- **FR-REV-001**: review window 1x24 jam setelah delivery proof.
- **FR-REV-002**: buyer confirm → RELEASE_PENDING → COMPLETED.
- **FR-REV-003**: buyer dispute → DISPUTED.

### 10.8 Auto-release

- **FR-AUTO-001**: auto-release jika review window expired dan no dispute/freeze/risk flag/suspicious proof.
- **FR-AUTO-002**: copy auto-release wajib ditampilkan sebelum bayar.

### 10.9 Dispute

- **FR-DSP-001**: buyer open dispute (reason, chronology, evidence, requested resolution).
- **FR-DSP-002**: seller response window 2x24 jam.
- **FR-DSP-003**: admin SLA 2x24 jam; keputusan wajib ada reason (refund/release/split/request evidence/extend).

### 10.10 Refund

- **FR-REF-001**: admin decide refund → REFUND_PENDING.
- **FR-REF-002**: refund amount calc termasuk cancel fee rules.
- **FR-REF-003**: manual refund completion → REFUNDED.

### 10.11 Payout

- **FR-POUT-001**: COMPLETED → PAYOUT_PENDING.
- **FR-POUT-002**: seller isi rekening payout.
- **FR-POUT-003**: payout review requirements (completed, no dispute, no freeze, no risk flag).
- **FR-POUT-004**: approval rule <=1jt single admin; >1jt maker-checker.
- **FR-POUT-005**: mark paid/failed.

### 10.12 Admin panel

- **FR-ADM-001**: dashboard menampilkan queues + audit log ringkas.
- **FR-ADM-002**: payment verification queue actions.
- **FR-ADM-003**: dispute queue actions.
- **FR-ADM-004**: payout queue actions.

### 10.13 Risk & freeze

- **FR-RISK-001**: trigger manual review (Pro >5jt, high-risk category, suspicious payment, frequent dispute/refund, mismatch, admin flag).
- **FR-RISK-002**: freeze transaction (block auto-release & payout).
- **FR-RISK-003**: unfreeze with reason.

### 10.14 Audit log

- **FR-AUD-001**: log aksi penting + fields: actor, role, action, target, old/new status, amount, notes, IP, UA, timestamp.

### 10.15 Notifications

- **FR-NOTIF-001** buyer notifications (payment under review, funds secured, proof uploaded, dispute update, refund processed, completed).
- **FR-NOTIF-002** seller notifications (buyer paid marker, funds secured, dispute opened, confirm/auto-release, payout status).
- **FR-NOTIF-003** admin queue updates.

## 11) Main screens

- Public landing page
- Transaction detail page (central)
- Buyer dashboard
- Seller dashboard
- Admin dashboard (queues)

## 12) User-facing status labels

(Refer ke mapping di User Journey Blueprint v2 agar konsisten.)

## 13) Acceptance criteria (ringkas)

- **AC-001** Seller create link → link terbentuk.
- **AC-002** Buyer review & see total → instruksi pembayaran tampil.
- **AC-003** Click Sudah Bayar → PAYMENT_UNDER_REVIEW.
- **AC-004** Admin approve → FUNDS_SECURED.
- **AC-005** Seller upload proof → DELIVERED + review window start.
- **AC-006** Buyer confirm → COMPLETED + payout pending.
- **AC-007** Auto-release after 1x24 jam if eligible.
- **AC-008** Buyer dispute → DISPUTED.
- **AC-009** Admin resolve dispute w/ reason + audit log.
- **AC-010** Manual payout → PAID_OUT.

## 14) MVP build priority (phasing)

- Phase 1: auth + create link + payment instruction + Sudah Bayar + admin verify + FUNDS_SECURED
- Phase 2: delivery proof + buyer confirm + auto-release + completed
- Phase 3: dispute + admin decision + manual refund tracking
- Phase 4: payout + maker-checker + audit log + freeze/unfreeze
- Phase 5: Free/Pro limits + Pro badge + cancel fee exemption

## 15) Open risks

- Regulatory/compliance risk (handle dana user)
- Operational risk (human error/slow verification)
- Fraud risk (fake payment/proof, abuse, collusion)
- Dispute risk (evidence lemah)
- Scale risk (manual-first tidak scalable)

## 16) Future improvements (post-MVP)

- Payment gateway/VA/QRIS
- Bank mutation automation + unique code
- Auto payout
- KYC provider integration
- Reputation/risk scoring
- API/white-label untuk komunitas
- Mobile app

## 17) MVP success metrics

- 
    
    # transaction links created
    
- buyer payment conversion
- avg transaction value
- completion rate
- dispute rate & refund rate
- auto-release rate
- payment verification time
- payout time
- free→pro conversion
- repeat seller/buyer usage

Primary success signal: seller mau share link, buyer trust flow, mayoritas transaksi selesai tanpa dispute.

## 18) Final MVP definition

MVP ready ketika:

- seller create link
- buyer review + pay manual
- buyer click Sudah Bayar
- admin verify payment
- seller upload delivery proof
- buyer confirm/dispute
- auto-release after 1x24 jam
- admin resolve dispute
- admin payout manual
- audit log tercatat
- Free/Pro limits + fees enforced