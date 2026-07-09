# BayarAman — Product Concept (Draft)

<aside>
<img src="https://app.notion.com/icons/target_blue.svg" alt="https://app.notion.com/icons/target_blue.svg" width="40px" />

**One-liner**: BayarAman adalah platform rekber modern untuk transaksi online di luar marketplace — dana diamankan, bukti tersimpan rapi, dan komplain/dispute punya alur yang jelas.

</aside>

## Problem yang diselesaikan

- Transaksi di luar marketplace rawan penipuan & konflik (barang/jasa tidak dikirim, buyer menahan konfirmasi, bukti tercecer di chat).
- Rekber manual tidak scalable: bergantung admin personal, status tidak transparan, dispute tidak terstruktur.

## Target user (awal)

- C2C: jual-beli barang second (gadget/kamera, dll.)
- Jasa & produk digital: freelancer kecil (desain, coding kecil, konten) + pembeli jasa/produk digital
- Channel: WhatsApp, Telegram, Instagram, forum, komunitas

## Positioning

BayarAman **bukan marketplace**.  

BayarAman adalah **lapisan keamanan** untuk transaksi yang terjadi di luar marketplace dengan format: **1 transaksi = 1 halaman pusat**.

## Core solution: “Transaction Page”

Satu halaman transaksi sebagai source of truth yang memuat:

- Detail kesepakatan
- Nominal + biaya layanan
- Status dana
- Instruksi pembayaran
- Bukti pengiriman/delivery
- Konfirmasi buyer
- Komplain/dispute + bukti
- Riwayat aktivitas (audit trail)
- Catatan admin (saat review)

## Core flow

### Happy path

1. Seller membuat transaksi (generate link)
2. Buyer membuka link → cek detail → setuju
3. Buyer bayar
4. Dana **diamankan**
5. Seller kirim barang/jasa + upload bukti
6. Buyer konfirmasi selesai
7. Dana **diteruskan ke seller**

### Dispute path

1. Buyer buka komplain
2. Seller memberi tanggapan + bukti
3. Admin review
4. Putusan: refund / release / split / minta bukti tambahan

## Key differentiators

- Transaction link mudah dibagikan
- Status transaksi & status dana jelas
- Bukti transaksi terpusat
- Dispute flow structured + admin panel
- Auto-release (agar seller tidak “disandera” buyer yang diam) — timing TBD
- Audit trail untuk aksi penting

## MVP focus

**Seller-created transaction link** (seller-first).

### MVP scope (fitur wajib)

- Register/login buyer & seller
- Seller membuat transaksi + link shareable
- Buyer buka link, review, approve transaksi
- Pembayaran (via payment partner) → status dana “diamankan”
- Seller upload bukti pengiriman/delivery
- Buyer konfirmasi transaksi selesai
- Dispute: buyer buka, seller respons, admin resolve (manual)
- Payout seller **manual** (MVP)
- Admin panel: daftar transaksi + detail + aksi resolve
- Audit log untuk aksi penting

### Non-goals (MVP)

- Marketplace listing / storefront
- Wallet internal (“saldo”, “top up”, “tarik saldo”)
- Multi-currency
- Native mobile app
- Chat realtime kompleks
- AI fraud scoring
- Subscription/affiliate/referral
- Crypto escrow
- Full automated payout tanpa review

## Product principles (UX)

- Aman, simple, jelas, transparan
- “Satu transaksi = satu halaman pusat”
- Setiap status punya aksi yang jelas
- Buyer tahu dana di tahap mana
- Seller tahu kapan dana cair
- Admin bisa mengambil keputusan berbasis bukti + audit trail

## Trust principles (wording)

Gunakan istilah:

- Dana diamankan
- Dana diteruskan ke seller
- Dana dikembalikan ke buyer
- Transaksi dalam review
- Komplain sedang ditinjau

Hindari (untuk MVP):

- Saldo, wallet, top up, tarik saldo, tabungan, “rekening BayarAman”

## North star

Buyer berani bayar pertama kali, seller merasa fair (tidak bisa ditahan sepihak), dan dispute dapat diselesaikan berbasis bukti.

## Open questions (untuk diputuskan)

1. Fokus kategori MVP: barang fisik / jasa digital / keduanya?
2. Fee: % + minimum fee? Ditanggung buyer/seller/split?
3. Limit transaksi akun baru (nominal & frekuensi)?
4. KYC: buyer wajib? seller wajib sebelum payout?
5. Masa inspeksi/review buyer (mis. 1x24 jam, 2x24 jam)?
6. Auto-release: aktif di MVP? timing & pengecualian?
7. SLA respons seller saat dispute (mis. 2x24 jam)?
8. Payout: selalu manual review di MVP? kriteria auto-approve?
9. Payment partner & payout partner yang dipilih
10. Kategori transaksi terlarang (policy awal)

---

## Next doc yang disarankan (lanjutan)

- PRD v1 (requirements + acceptance criteria)
- State machine status transaksi + aturan transisi
- Data model (ERD sederhana)
- Wireframe halaman inti (Seller create, Buyer approve/pay, Transaction detail, Admin dispute)
- Checklist operasional & policy (SOP dispute, evidence, SLA)