# BayarAman — User Journey Blueprint v2 (Draft)

<aside>
<img src="https://app.notion.com/icons/compass_blue.svg" alt="https://app.notion.com/icons/compass_blue.svg" width="40px" />

**Tujuan dokumen**: memetakan journey end-to-end (seller-first + buyer-first), status, layar, notifikasi, dan aturan operasional untuk MVP manual-first.

</aside>

## 1) Product promise

BayarAman membantu buyer dan seller transaksi online di luar marketplace dengan lebih aman.

Core promise:

Buyer bayar ke BayarAman → dana diamankan → seller kirim barang/jasa → buyer konfirmasi → dana diteruskan ke seller.

Flow sederhana:

- Seller buat link transaksi
- Buyer cek detail transaksi
- Buyer transfer ke rekening BayarAman
- Buyer klik **“Sudah Bayar”**
- Admin verifikasi pembayaran
- Dana diamankan
- Seller kirim barang/jasa
- Buyer konfirmasi
- Dana diteruskan ke seller

Jika terjadi masalah:

- Buyer buka komplain
- Seller memberi tanggapan dan bukti
- Admin meninjau dispute
- Admin memutuskan refund / release / split settlement / minta bukti tambahan

## 2) Product assumptions (MVP)

MVP menggunakan model **manual-first**.

- Payment collection: buyer transfer manual ke rekening BCA BayarAman + klik “Sudah Bayar” + admin/finance cek mutasi manual
- Payout: admin/finance transfer manual ke rekening seller

Fokus MVP:

- Link transaksi
- Manual payment verification
- Status tracking
- Dana diamankan
- Delivery proof
- Buyer confirmation
- Auto-release
- Dispute handling
- Manual payout
- Audit trail

## 3) User roles

### Buyer

- Buka link transaksi
- Buat transaksi (opsional)
- Cek detail transaksi
- Bayar ke rekening BayarAman
- Klik **Sudah Bayar**
- Lihat status verifikasi
- Konfirmasi diterima
- Buka dispute
- Menerima refund jika disetujui

### Seller

- Buat link transaksi
- Share link ke buyer
- Terima invitation dari buyer (opsional)
- Lihat status pembayaran
- Upload bukti delivery
- Menanggapi dispute
- Menerima payout

### Admin / Finance

- Cek mutasi BCA
- Verifikasi pembayaran / tolak payment confirmation
- Review transaksi berisiko
- Selesaikan dispute
- Payout manual + catat payout
- Pastikan audit trail tercatat

### Super Admin

- Manage user & role admin
- Manage fee & limit
- Lihat audit log + risk flag
- Freeze/unfreeze transaksi

## 4) Entry points

- Landing page
- Link transaksi dari seller
- Link transaksi dari buyer
- WhatsApp / Telegram / Instagram DM
- Forum / komunitas

CTA utama landing page:

- Buat Transaksi Aman
- Cek Status Transaksi
- Lihat Cara Kerja
- Hitung Biaya

---

## 5) Journey A — Seller membuat link transaksi (primary MVP)

**Konteks**: seller biasanya menawarkan rekber.

### Step A1 — Seller klik “Buat Link Transaksi”

Seller mengisi form.

Field (MVP):

- Judul transaksi
- Nominal transaksi
- Kategori (barang fisik / produk digital / jasa digital)
- Deskripsi kesepakatan
- Buyer contact (optional)
- Deadline delivery
- Fee payer (buyer/seller/split)

Contoh:

- Judul: Jual iPhone 13 128GB
- Nominal: Rp6.500.000
- Kategori: Gadget
- Kesepakatan: Fullset, baterai 86%, no minus, dikirim via JNE.
- Deadline: 2 hari
- Fee: Buyer pays fee

Status:

- DRAFT → WAITING_BUYER_PAYMENT

Output:

- Link transaksi: `bayaraman.id/t/BA-8H2K91`

### Step A2 — Buyer membuka link

Buyer melihat:

- Judul transaksi, nama seller
- Nominal
- Fee BayarAman
- Total bayar
- Deskripsi kesepakatan
- Deadline delivery
- Policy review 1x24 jam
- Policy auto-release
- CTA: **Setuju & Lanjut Bayar**

Contoh pricing:

- Harga: Rp500.000
- Biaya: Rp20.000
- Total bayar: Rp520.000

Copy penting:

“Pastikan detail transaksi sudah sesuai sebelum melanjutkan pembayaran.”

### Step A3 — Buyer melihat instruksi pembayaran

Metode (MVP):

- Bank: BCA
- Transfer manual
- Nominal: exact amount

UI contoh:

Transfer ke:

- BCA 1234567890
- a.n. BayarAman

Nominal:

- Rp520.000

CTA:

- **Sudah Bayar**

Catatan: buyer **tidak wajib** upload bukti transfer di MVP.

### Step A4 — Buyer klik “Sudah Bayar”

Status:

- WAITING_BUYER_PAYMENT → PAYMENT_UNDER_REVIEW

Buyer message:

“Pembayaran sedang dicek oleh tim BayarAman. Kami memverifikasi dana masuk berdasarkan mutasi rekening BCA.”

Seller message:

“Buyer sudah menandai pembayaran. Tim BayarAman sedang mengecek pembayaran.”

### Step A5 — Admin verifikasi pembayaran

Admin/finance membuka **payment verification queue**.

Admin melihat:

- Kode transaksi
- Buyer, seller
- Expected amount
- Timestamp buyer klik “Sudah Bayar”
- Rekening tujuan
- Status

Hasil:

- Jika valid: PAYMENT_UNDER_REVIEW → FUNDS_SECURED
- Jika tidak ditemukan: PAYMENT_UNDER_REVIEW → WAITING_BUYER_PAYMENT (dengan catatan)

Admin note (contoh):

“Pembayaran belum ditemukan. Pastikan nominal dan rekening tujuan sudah sesuai.”

### Step A6 — Dana diamankan

Status: FUNDS_SECURED

Buyer message:

“Dana kamu sudah diamankan. Seller bisa mulai mengirim barang/jasa.”

Seller message:

“Dana sudah diamankan oleh BayarAman. Silakan kirim barang/jasa sesuai kesepakatan.”

Seller primary action:

- **Upload Bukti Delivery**

### Step A7 — Seller mengirim barang/jasa + upload delivery proof

Evidence seller:

- Barang fisik: resi (jika ada), foto paket, bukti pengiriman, catatan ekspedisi
- Jasa digital: link hasil, file delivery, screenshot, catatan penyelesaian
- Produk digital: proof delivery, instruksi akses, screenshot/link/file

Status:

- FUNDS_SECURED → DELIVERED

### Step A8 — Buyer review window 1x24 jam

Buyer mendapat notifikasi:

“Seller sudah mengirim bukti delivery. Kamu punya waktu 1x24 jam untuk konfirmasi atau membuka komplain.”

Buyer actions:

- Konfirmasi Diterima
- Ajukan Komplain

Transisi:

- Konfirmasi: DELIVERED → RELEASE_PENDING → COMPLETED
- Dispute: DELIVERED → DISPUTED
- Diam 1x24 jam: DELIVERED → RELEASE_PENDING → COMPLETED (auto-release)

Auto-release hanya jika:

- tidak ada dispute
- tidak ada risk flag
- tidak ada admin freeze
- delivery proof tidak mencurigakan

### Step A9 — Manual payout ke seller

Setelah COMPLETED:

- COMPLETED → PAYOUT_PENDING

Approval rule:

- <= Rp1.000.000: 1 admin/finance
- 
    
    > Rp1.000.000: maker-checker
    > 

Flow:

- PAYOUT_PENDING → PAYOUT_PROCESSING → PAID_OUT

Seller messages:

- “Dana sedang diproses ke rekening kamu.”
- “Dana berhasil diteruskan ke rekening kamu.”

---

## 6) Journey B — Buyer membuat transaksi (secondary MVP)

### Step B1 — Buyer klik “Buat Transaksi Aman”

Field:

- Judul transaksi
- Nominal
- Seller contact (email/HP)
- Kategori
- Deskripsi kesepakatan
- Fee payer
- Deadline delivery

Status:

- DRAFT → WAITING_SELLER_ACCEPTANCE

### Step B2 — Seller menerima invitation

Seller actions:

- Terima
- Tolak
- Minta revisi

Jika terima:

- WAITING_SELLER_ACCEPTANCE → WAITING_BUYER_PAYMENT

Lanjut ke flow pembayaran (Journey A).

---

## 7) Journey C — Payment expired

Expiry: 24 jam

- WAITING_BUYER_PAYMENT → EXPIRED

Jika buyer klik “Sudah Bayar” tapi tidak ditemukan:

- PAYMENT_UNDER_REVIEW → WAITING_BUYER_PAYMENT

---

## 8) Journey D — Salah nominal / anomali payment

Payment valid hanya jika dana masuk & nominal sesuai.

- Nominal kurang → belum valid, buyer diminta melengkapi
- Nominal lebih → manual handling (refund selisih / ikut refund final)
- Transfer rekening berbeda → manual review
- Klaim palsu → reject + risk flag

---

## 9) Journey E — Cancel before payment

Allowed status:

- WAITING_SELLER_ACCEPTANCE
- WAITING_BUYER_PAYMENT

Status:

- WAITING_BUYER_PAYMENT → CANCELLED

Cancel fee tidak berlaku jika belum ada pembayaran.

---

## 10) Journey F — Cancel/refund after payment

Setelah FUNDS_SECURED, pembatalan tidak bebas (harus refund request/dispute + admin review).

Status contoh:

- FUNDS_SECURED → REFUND_PENDING
- FUNDS_SECURED → DISPUTED

Cancel fee rule (ringkas):

- Buyer batal tanpa kesalahan seller (Free) → cancel fee Rp5.000
- Seller fault/fraud → refund penuh, tanpa cancel fee
- Pro → free cancel fee

---

## 11) Journey G — Dispute/komplain

Allowed after:

- FUNDS_SECURED / DELIVERED / BUYER_REVIEW

Buyer dispute reasons (opsi):

- Barang belum dikirim
- Barang tidak sesuai deskripsi
- Nomor resi tidak valid
- Jasa belum selesai
- File/link/akun tidak bisa digunakan
- Seller tidak merespons
- Lainnya

Buyer wajib isi:

- alasan
- kronologi singkat
- bukti
- solusi diminta (refund penuh/sebagian/perbaiki/kirim ulang)

Seller response window: 2x24 jam

Admin SLA: 2x24 jam

Admin decision:

- Refund
- Release
- Split settlement
- Request more evidence
- Extend review time

Semua keputusan wajib ada reason.

---

## 12) Journey H — Auto-release

Start time:

- 1x24 jam setelah seller upload delivery proof

Status:

- DELIVERED → RELEASE_PENDING → COMPLETED

Auto-release tidak berjalan jika:

- dispute
- freeze
- risk flag
- delivery proof mencurigakan
- transaksi high-risk

Copywriting wajib sebelum buyer bayar:

“Jika tidak ada komplain dalam 1x24 jam setelah seller mengirim bukti delivery, dana dapat diteruskan otomatis ke seller.”

---

## 13) Journey I — Free user

- No KYC by default
- Email + phone verification
- Limits: max per trx 1jt, daily 1.5jt, monthly 3jt
- Fees: 2% (min 20k, max 100k), cancel fee 5k

Jika exceed limit:

- upgrade prompt ke Pro, atau manual exception (opsional)

---

## 14) Journey J — Pro user

- Pricing: 100k/bulan atau 1jt/tahun
- Unlimited volume (guardrail: manual review/freeze tetap bisa)
- Cancel fee free
- Transaction fee tetap berlaku
- Manual review threshold: > 5jt

---

## 15) Main screens (MVP)

### Landing page

- Hero
- How it works
- Fee calculator
- Supported transactions
- Free vs Pro
- FAQ
- CTA

### Transaction detail page (core)

Satu halaman pusat; action berbeda tergantung role & status.

Struktur:

- Status badge
- Timeline transaksi
- Primary action
- Payment info
- Transaction detail + agreement
- Delivery proof
- Dispute section
- Activity log
- Admin notes

### Buyer dashboard

Sections:

- Menunggu pembayaran
- Pembayaran dicek
- Dana diamankan
- Menunggu review
- Dalam komplain
- Selesai
- Expired/Cancelled

### Seller dashboard

Sections:

- Link transaksi dibuat
- Menunggu buyer bayar
- Dana diamankan
- Perlu dikirim
- Dalam review buyer
- Dalam komplain
- Siap dicairkan
- Selesai

### Admin queues

- Payment verification queue
- Payout queue
- Dispute queue
- Manual review queue (high-risk)

---

## 16) Status mapping

| Technical status | User-facing label |
| --- | --- |
| DRAFT | Draft |
| WAITING_SELLER_ACCEPTANCE | Menunggu seller menyetujui |
| WAITING_BUYER_PAYMENT | Menunggu pembayaran buyer |
| PAYMENT_UNDER_REVIEW | Pembayaran sedang dicek |
| FUNDS_SECURED | Dana sudah diamankan |
| DELIVERED | Menunggu buyer review |
| DISPUTED | Dalam komplain |
| UNDER_REVIEW | Sedang ditinjau admin |
| REFUND_PENDING | Refund sedang diproses |
| REFUNDED | Dana dikembalikan |
| RELEASE_PENDING | Dana sedang diteruskan |
| COMPLETED | Transaksi selesai |
| PAYOUT_PENDING | Menunggu pencairan |
| PAYOUT_PROCESSING | Pencairan diproses |
| PAID_OUT | Dana sudah diteruskan |
| PAYOUT_FAILED | Pencairan gagal |
| CANCELLED | Dibatalkan |
| EXPIRED | Kedaluwarsa |
| FROZEN | Transaksi ditahan untuk review |

---

## 17) State machine (ringkas)

Seller-first happy path:

- DRAFT → WAITING_BUYER_PAYMENT → PAYMENT_UNDER_REVIEW → FUNDS_SECURED → DELIVERED → RELEASE_PENDING → COMPLETED → PAYOUT_PENDING → PAYOUT_PROCESSING → PAID_OUT

Buyer-first happy path:

- DRAFT → WAITING_SELLER_ACCEPTANCE → WAITING_BUYER_PAYMENT → PAYMENT_UNDER_REVIEW → FUNDS_SECURED → DELIVERED → RELEASE_PENDING → COMPLETED → PAYOUT_PENDING → PAYOUT_PROCESSING → PAID_OUT

Dispute path:

- FUNDS_SECURED/DELIVERED → DISPUTED → UNDER_REVIEW → (REFUND_PENDING atau RELEASE_PENDING atau SPLIT_SETTLEMENT) → (REFUNDED atau COMPLETED)

Cancel path:

- WAITING_BUYER_PAYMENT → CANCELLED
- WAITING_SELLER_ACCEPTANCE → CANCELLED

Expiry path:

- WAITING_BUYER_PAYMENT → EXPIRED

---

## 18) Notification journey (MVP)

### Buyer notifications

- Pembayaran sedang dicek
- Dana sudah diamankan
- Seller upload bukti delivery (review window start)
- Warning review hampir selesai (opsional)
- Update komplain
- Refund diproses
- Transaksi selesai

### Seller notifications

- Buyer klik “Sudah Bayar”
- Dana diamankan
- Buyer buka komplain
- Buyer konfirmasi / auto-release
- Payout processing / payout completed

### Admin queues

- Payment verification queue
- Dispute queue
- Payout queue
- Manual review queue

---

## 19) UX principles (MVP)

1. Satu transaksi = satu halaman pusat
2. Setiap status punya satu primary action
3. Buyer tahu dana berada di tahap mana
4. Seller tahu kapan harus kirim & kapan dana cair
5. Admin punya queue yang jelas
6. Manual payment tetap terasa rapi & terpercaya
7. Dispute berbasis bukti, bukan debat bebas
8. Auto-release dijelaskan sebelum buyer bayar
9. Hindari istilah wallet/saldo
10. Semua action penting masuk audit log

## 20) MVP journey priority

Build priority:

1. Seller create link
2. Buyer open link
3. Fee + total bayar jelas
4. Buyer transfer
5. Buyer klik “Sudah Bayar”
6. Admin verify payment
7. FUNDS_SECURED
8. Seller upload delivery proof
9. Buyer confirm / dispute
10. Auto-release 1x24 jam
11. Admin payout manual
12. Admin resolve dispute manual

Do not build yet:

- payment gateway
- auto payout
- wallet internal
- marketplace listing
- chat realtime kompleks
- AI fraud scoring
- mobile app native
- auto-KYC
- subscription automation complex

## 21) Final direction

Seller creates a transaction link → buyer reviews → buyer transfers to BCA → buyer clicks “Sudah Bayar” → admin verifies → seller delivers → buyer confirms/disputes → auto-release after 1x24 jam if no dispute → admin processes payout manually.

Journey ini sengaja manual-first untuk validasi trust, pricing, workload operasional, dispute flow, dan willingness user sebelum gateway/payout automation.