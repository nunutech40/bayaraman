# BayarAman — Business Model & Operating Model (Draft)

<aside>
<img src="https://app.notion.comi" alt="https://app.notion.comi" width="40px" />

**Inti model**: manual-first rekber (payment & payout manual), fee per transaksi, cancellation fee, dan subscription Pro untuk limit & benefit operasional.

</aside>

## 1) Business summary

BayarAman adalah layanan rekber modern untuk membantu buyer dan seller bertransaksi di luar marketplace dengan lebih aman.

- Buyer membayar ke rekening BayarAman
- Dana ditahan sementara sampai seller mengirim barang/jasa
- Buyer konfirmasi atau dispute
- Jika selesai, dana diteruskan ke seller
- Jika bermasalah, admin meninjau bukti dan mengambil keputusan

## 2) Business model (revenue streams)

1. **Transaction fee**
2. **Cancel fee**
3. **Pro user subscription**

## 3) Transaction fee

- Fee: **2%**
- Minimum fee: **Rp20.000**
- Maximum fee: **Rp100.000**
- Minimum transaction amount: **Rp100.000**

Contoh:

- Transaksi Rp100.000 → 2% = Rp2.000 → **min fee** Rp20.000 → total buyer bayar Rp120.000
- Transaksi Rp500.000 → 2% = Rp10.000 → **min fee** Rp20.000 → total buyer bayar Rp520.000
- Transaksi Rp1.000.000 → 2% = Rp20.000 → total buyer bayar Rp1.020.000
- Transaksi Rp5.000.000 → 2% = Rp100.000 → total buyer bayar Rp5.100.000

Catatan: transaction fee tetap berlaku untuk Free & Pro.

## 4) Fee payer

Fee payer dipilih saat transaksi dibuat:

- Buyer pays fee (default)
- Seller pays fee
- Split fee

Alasan:

- Buyer biasanya pihak yang butuh proteksi
- Seller bisa menanggung fee sebagai trust signal
- Split untuk kesepakatan bersama

## 5) Cancel fee

- Cancel fee: **Rp5.000**
- Berlaku: **Free User**
- Tidak berlaku: **Pro User**
- Cancel fee dipotong dari dana refund.

Policy ringkas:

- Buyer batal tanpa kesalahan seller → buyer kena cancel fee
- Seller gagal kirim / seller terbukti salah/fraud → refund penuh, **tanpa** cancel fee
- Admin cancel karena prohibited item → tergantung kasus
- Pro User → free cancellation fee

## 6) User tier

1) Free User  

2) Pro User

## 7) Free User (default)

Verification:

- Email verification
- Phone verification

KYC:

- No KYC by default

Limits:

- Max per transaction: **Rp1.000.000**
- Daily limit: **Rp1.500.000**
- Monthly limit: **Rp3.000.000**

Fees:

- Transaction fee: 2% (min Rp20.000, max Rp100.000)
- Cancel fee: Rp5.000

## 8) Pro User

Pricing:

- Monthly: **Rp100.000/bulan**
- Annual: **Rp1.000.000/tahun**

KYC:

- No KYC by default

Limits:

- Unlimited monthly transaction volume
- Transaksi di atas **Rp5.000.000**: manual review

Fees:

- Transaction fee tetap 2% (min Rp20.000, max Rp100.000)
- Cancel fee: free

Benefits:

- Unlimited monthly volume
- Priority review
- Better trust badge
- Higher flexibility

Guardrail:

BayarAman tetap bisa manual review/freeze/minta verifikasi tambahan untuk transaksi high-risk atau mencurigakan.

## 9) Supported transactions

Didukung (default):

- Barang fisik legal, barang second, gadget, elektronik kecil
- Produk digital legal
- Jasa digital / freelance kecil
- Transaksi komunitas

Forbidden categories (ditolak):

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

## 10) Payment collection model (MVP)

Manual transfer dulu.

- Bank: **BCA**
- Payment method: manual transfer
- Payment confirmation: buyer klik **“Sudah Bayar”**
- Verification: admin/finance cek mutasi BCA manual

Buyer tidak wajib upload bukti transfer di MVP.

Status flow:

- WAITING_BUYER_PAYMENT
- PAYMENT_UNDER_REVIEW
- FUNDS_SECURED

Payment expiry:

- 24 jam → jika belum bayar: WAITING_BUYER_PAYMENT → EXPIRED

## 11) Payment validation rules

Payment valid hanya setelah admin/finance menemukan dana masuk.

Rules:

- Nominal harus sesuai
- Dana benar-benar masuk
- Admin/finance melakukan verification action
- Semua verification action masuk audit log

Handling:

- Kurang → belum valid, buyer diminta melengkapi
- Lebih → manual handling (refund selisih atau masuk refund final)
- Transfer dari rekening berbeda → manual review
- Klaim palsu → reject + risk flag

Future improvement: unique code untuk rekonsiliasi.

## 12) Payout model (MVP)

Manual payout oleh admin/finance setelah transaksi selesai.

Status flow:

- COMPLETED
- PAYOUT_PENDING
- PAYOUT_PROCESSING
- PAID_OUT

Jika gagal:

- PAYOUT_FAILED

Requirements:

- Transaksi completed
- Tidak ada dispute aktif
- Tidak ada freeze / risk flag
- Seller sudah isi rekening payout
- Review admin/finance
- Semua payout action tercatat di audit log

## 13) Payout approval rules

- Payment verification: 1 admin/finance cukup
- Payout approval:
    - <= Rp1.000.000: 1 admin/finance
    - 
        
        > Rp1.000.000: maker-checker
        > 

## 14) Buyer review window

- 1x24 jam
- Mulai dihitung **1x24 jam setelah seller upload delivery proof**

Copywriting:

Buyer punya waktu 1x24 jam setelah seller mengirim bukti delivery untuk konfirmasi atau membuka komplain. Jika tidak ada komplain, dana dapat diteruskan otomatis ke seller.

## 15) Auto-release policy

Auto-release aktif untuk transaksi normal jika:

- review window selesai
- tidak ada dispute
- tidak flagged/high-risk
- tidak ada admin freeze
- delivery proof tidak mencurigakan

## 16) Dispute operating model

- Seller response window: **2x24 jam**
- Admin dispute SLA: **2x24 jam**

Jika seller tidak respons dalam 2x24 jam, admin bisa putuskan berdasarkan bukti yang ada.

Possible decisions:

- Refund
- Release
- Split settlement
- Minta bukti tambahan
- Extend review time

## 17) Evidence requirement

Seller:

- Barang fisik: resi (jika ada), foto paket, bukti pengiriman, catatan ekspedisi
- Jasa digital: link hasil, file delivery, screenshot, catatan penyelesaian
- Produk digital: proof delivery, instruksi akses, screenshot/link/file

Buyer (untuk dispute):

- Screenshot chat
- Foto/video barang
- Bukti barang tidak sesuai
- Bukti link/file tidak bisa dipakai
- Kronologi singkat

## 18) Risk & manual review policy

Trigger manual review (contoh):

- Pro user > Rp5.000.000
- kategori high-risk
- nominal tidak wajar
- sering dispute/refund
- transfer sulit dicocokkan / rekening berbeda
- seller sering dilaporkan
- indikasi fraud

Admin actions:

- freeze/unfreeze
- request evidence
- reject/approve payment
- hold/approve payout
- resolve dispute
- flag user

## 19) Audit log requirement

Minimal fields:

- actor, actor_role
- action
- target_type, target_id
- old_status, new_status
- amount
- notes
- ip_address, user_agent
- timestamp

Actions yang wajib di-log (minimum):

- Payment verified/rejected
- Transaction cancelled
- Delivery proof submitted
- Dispute opened/responded
- Admin decision made
- Auto-release executed
- Payout requested/approved/completed/failed
- Refund approved/completed
- User flagged
- Transaction frozen/unfrozen

## 20) Operating model summary (MVP)

- Payment: manual transfer BCA
- Payment confirmation: buyer klik “Sudah Bayar”
- Payment verification: admin/finance cek mutasi
- Payout: manual transfer
- Payout approval: <=1jt 1 admin, >1jt maker-checker
- Dispute: manual admin review
- Auto-release: aktif untuk transaksi normal setelah 1x24 jam
- KYC: no KYC by default (manual verification untuk kasus risky)

## 21) Unit economics direction (arah)

Revenue per transaksi selesai:

- transaction fee - operational cost

Cost utama (MVP manual-first):

- waktu admin + finance
- biaya transfer bank
- dispute/refund/support
- fraud loss
- infra

## 22) MVP business policy summary (ringkas)

- Supported: legal goods/services, kecuali forbidden/high-risk
- Payment: manual transfer BCA + verifikasi manual
- Payout: manual
- Fee: 2% (min 20k, max 100k), min transaksi 100k
- Cancel fee: 5k untuk Free (tidak jika seller fault), Pro free
- Fee payer: default buyer, seller/split tersedia
- Free limits: max trx 1jt, daily 1.5jt, monthly 3jt
- Pro: 100k/bulan atau 1jt/tahun, unlimited volume, >5jt manual review
- Review window: 1x24 jam setelah delivery proof
- Auto-release: setelah 1x24 jam jika no dispute dan tidak flagged
- Seller dispute response: 2x24 jam
- Admin dispute SLA: 2x24 jam
- Payout approval: <=1jt single admin; >1jt maker-checker

## 23) Future options (bukan MVP)

- Payment gateway integration
- Virtual account per transaksi
- QRIS
- Auto payout
- KYC-based higher tier
- Seller reputation
- Insurance add-on
- API/white-label untuk komunitas

## 24) Business direction v1

Manual-first rekber untuk transaksi legal C2C & digital dengan BCA manual transfer + manual payout, structured status, fee 2%, Free/Pro tier, cancellation policy, dispute handling, auto-release, dan audit trail.

Goal MVP: validasi bahwa user paham flow, buyer merasa aman, seller mau share link, operasi manual manageable, fee model masuk, dispute jelas, dan fraud risk terkendali.