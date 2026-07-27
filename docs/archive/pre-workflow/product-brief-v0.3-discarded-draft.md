# BayarAman Product Brief

> Discarded and archived on 2026-07-17 so the product workflow can restart cleanly from `requirenment/`. Do not use this draft as product context.

## 1. Document Control

```text
Product: BayarAman
Version: 0.3
Status: Draft for owner approval
Owner: Product Owner BayarAman
Last updated: 2026-07-16
```

## 2. Source And Precedence

1. Arahan dan keputusan terbaru product owner.
2. Product Brief ini setelah berstatus `Approved`.
3. `requirenment/BayarAman — Product Concept (Draft).md` sebagai konsep dasar.
4. Dokumen lain di `requirenment/` sebagai referensi terarah bila informasi tertentu dibutuhkan.

Dokumen di `docs/archive/` dan perilaku prototype tidak menjadi sumber produk aktif. Audit konflik migrasi tersimpan di `docs/archive/pre-workflow/product-brief-v0.2-migration-draft.md`.

## 3. Problem

Buyer dan seller yang bertransaksi di luar marketplace membutuhkan pihak penengah agar buyer tidak melepas uang langsung sebelum barang selesai diterima, sementara seller membutuhkan kepastian bahwa pembayaran sudah masuk sebelum mengirim barang.

BayarAman menyediakan satu alur transaksi yang mencatat siapa harus melakukan tindakan berikutnya, tetapi mempertahankan operasi pembayaran, WhatsApp, dan payout secara manual pada MVP.

## 4. Product Proposition

BayarAman membantu buyer dan seller menyelesaikan transaksi barang fisik dengan lebih aman melalui penahanan dana, verifikasi admin, konfirmasi buyer dengan OTP, dan payout seller yang tercatat, tanpa menjadi marketplace atau payment gateway.

## 5. Actors

| Actor | Goal | Main responsibility |
| --- | --- | --- |
| Seller | Mendapat kepastian pembayaran sebelum mengirim dan menerima payout setelah transaksi selesai | Memberikan data seller dan rekening payout, mengirim barang, serta memberi kabar selesai |
| Buyer | Membayar melalui penengah dan mengendalikan konfirmasi akhir | Memberikan kontak sendiri, membayar BayarAman, membuat klaim `Sudah Bayar`, dan mengonfirmasi dengan OTP |
| Admin | Menjalankan serta mencatat operasi rekber manual | Memeriksa pembayaran, mengelola koordinasi WA, mengirim link konfirmasi, dan mentransfer payout |
| System | Menjaga urutan, akses, masa berlaku, dan riwayat transaksi | Menampilkan tindakan yang valid, mencatat checkpoint, mengirim/verifikasi OTP, dan melakukan expiry |

Buyer dan seller adalah peran di dalam transaksi, bukan tipe akun permanen.

## 6. Confirmed MVP Scope

### Included

- Transaksi barang fisik saja.
- Transaksi dapat dibuat oleh seller atau buyer.
- Pada seller-created flow, seller mengisi data transaksi, nama/WhatsApp seller, serta rekening payout; seller lalu membagikan link transaksi.
- Buyer yang membuka link seller mengisi sendiri nama, WhatsApp, dan email sebelum membayar.
- Pada buyer-created flow, buyer mengisi data transaksi, data buyer, serta nama/WhatsApp/rekening payout seller.
- Buyer membayar ke rekening BayarAman lalu mengklik `Sudah Bayar`.
- Admin memeriksa pembayaran secara manual; klik buyer hanya merupakan klaim.
- Setelah dana ditemukan, admin membuat group WhatsApp dan memberi info bahwa pembayaran telah masuk.
- Seller mengirim barang setelah pengumuman pembayaran masuk.
- Seller dan buyer memberi info ketika pesanan selesai.
- Admin mengirim link konfirmasi; buyer mengonfirmasi memakai OTP melalui email atau WhatsApp.
- Admin mentransfer payout ke seller secara manual setelah konfirmasi buyer valid.
- Transaksi yang belum dibayar kedaluwarsa dalam 1x24 jam.
- Masalah buyer-seller diselesaikan di luar sistem.

### Explicitly Not Included

- Seller acceptance sebelum buyer membayar pada buyer-created flow.
- Transaksi jasa atau produk digital.
- Marketplace, katalog, wallet, dan storefront.
- Payment gateway, rekonsiliasi bank otomatis, pembuatan group WA otomatis, atau payout otomatis.
- Negosiasi dan penyelesaian komplain di dalam aplikasi.
- Upload bukti pengiriman, auto-release, dan aturan Free/Pro dari draft lama sampai diputuskan kembali.

## 7. Core Business Rules

| ID | Rule | Status |
| --- | --- | --- |
| PB-BR-001 | Seller atau buyer dapat membuat transaksi | Confirmed |
| PB-BR-002 | Buyer selalu membayar rekening BayarAman, bukan seller | Confirmed |
| PB-BR-003 | `Sudah Bayar` adalah klaim buyer; pembayaran valid hanya setelah pemeriksaan admin | Confirmed |
| PB-BR-004 | Seller mengirim barang hanya setelah admin mengumumkan pembayaran masuk | Confirmed |
| PB-BR-005 | Seller dan buyer memberi info selesai sebelum admin mengirim link konfirmasi | Confirmed |
| PB-BR-006 | Buyer harus lolos OTP email atau WhatsApp sebelum payout normal | Confirmed |
| PB-BR-007 | Payout seller dilakukan manual oleh admin | Confirmed |
| PB-BR-008 | Transaksi belum dibayar kedaluwarsa dalam 1x24 jam | Confirmed; detail awal timer ditentukan di User Requirements |
| PB-BR-009 | Komplain diselesaikan di luar sistem | Confirmed |
| PB-BR-010 | Tindakan status dan finansial penting harus tercatat dan tidak dihapus permanen | Confirmed guardrail |

## 8. Manual And System Boundary

| Activity | Owner | Boundary | Minimum system record |
| --- | --- | --- | --- |
| Membuat transaksi dan mengisi data pihak | Seller atau buyer | System | Creator role, data transaksi, data para pihak, rekening payout snapshot, waktu dibuat, expiry |
| Transfer ke BayarAman | Buyer | Manual bank transfer | Nominal yang diharapkan dan status menunggu klaim |
| Klik `Sudah Bayar` | Buyer | System | Waktu klaim dan status menunggu pemeriksaan |
| Memeriksa dana | Admin | Manual bank check, result recorded in system | Hasil, operator, waktu, dan referensi/catatan |
| Membuat group dan mengumumkan pembayaran | Admin | Manual WhatsApp, checkpoint recorded in system | Waktu dan operator setiap checkpoint |
| Mengirim barang dan memberi info selesai | Seller dan buyer | Di luar sistem/WhatsApp | Checkpoint operasional bila dibutuhkan oleh alur admin |
| Mengirim link dan verifikasi OTP | Admin dan system | Admin-triggered system flow | Link lifecycle, channel tujuan, hasil OTP, waktu |
| Menyelesaikan komplain | Buyer, seller, admin | Di luar sistem | Hanya hasil akhir finansial dan catatan otorisasi bila terjadi |
| Transfer payout | Admin | Manual bank transfer, result recorded in system | Rekening snapshot, nominal, operator, status, waktu, referensi |
| Expiry pembayaran | System | Automated policy | Waktu expiry dan status akhir |

## 9. Journey Seeds

| Journey | Starts when | Ends when |
| --- | --- | --- |
| Seller-created transaction | Seller membuat transaksi dan membagikan link | Seller menerima payout, hasil alternatif dicatat, atau transaksi kedaluwarsa sebelum pembayaran |
| Buyer-created transaction | Buyer membuat transaksi beserta data seller | Seller menerima payout, hasil alternatif dicatat, atau transaksi kedaluwarsa sebelum pembayaran |
| Buyer confirmation | Admin mengirim link setelah kedua pihak memberi info selesai | OTP valid atau transaksi membutuhkan tindak lanjut manual |
| Unpaid expiry | Transaksi menjadi siap dibayar | Buyer membuat klaim pembayaran tepat waktu atau batas 1x24 jam tercapai |

## 10. Deferred Decisions

Keputusan berikut tidak menghalangi penulisan User Journey, tetapi harus diselesaikan pada tahap yang disebutkan.

| Needed by | Decisions |
| --- | --- |
| User Requirements | Fee dan pihak pembayar fee; batas transaksi; kebutuhan akun/login; validasi rekening seller; data pencocokan pembayaran; awal timer 1x24 jam; detail peran admin; checkpoint operasional yang disimpan |
| QA Scenarios | Salah/kurang/lebih/terlambat bayar; aturan OTP dan fallback; salah satu pihak tidak merespons; kewenangan hasil komplain eksternal; payout gagal atau perlu retry |
| PRD approval | Target keberhasilan MVP dan kebijakan operasional final |
| Before live-money pilot | Legal, kepatuhan, perbankan, privasi, fraud control, dan retensi data |

## 11. Approval

- [x] Arah produk terbaru sudah menggantikan alur lama yang bertentangan.
- [x] Tiga keputusan owner tentang barang fisik, pembagian data, dan input kontak buyer sudah tercatat.
- [x] Scope manual dan system sudah dibedakan.
- [x] Pertanyaan tersisa sudah ditempatkan pada tahap yang tepat.
- [ ] Product owner menyetujui Product Brief ini.
- [ ] Status diubah menjadi `Approved` sebelum User Journey dibuat.
