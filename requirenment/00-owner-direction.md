# BayarAman Current Owner Direction

```text
Status: Current raw product input
Owner: Product Owner BayarAman
Last updated: 2026-07-19
Purpose: Highest-priority baseline for the active Product Brief
```

Dokumen ini mencatat arahan produk terbaru. Dokumen ini belum merupakan Product Brief, User Journey, atau User Requirements yang sudah disetujui.

## Account And Transaction Role Model

- Setiap orang memiliki satu akun BayarAman.
- Akun yang sama dapat menjadi buyer pada satu transaksi dan seller pada transaksi lain.
- Setiap transaksi wajib memiliki tepat dua akun peserta yang berbeda: satu buyer dan satu seller.
- Satu akun tidak boleh menjadi buyer sekaligus seller pada transaksi yang sama dan tidak boleh bertransaksi dengan dirinya sendiri.
- Buyer atau seller dapat memulai transaksi.
- Pembuat transaksi mengisi detail kesepakatan bersama dan data yang menjadi tanggung jawab role-nya.
- Pihak lawan bergabung melalui invitation/link dan mengisi data yang menjadi tanggung jawab role-nya sendiri.
- Data identitas dan kontak umum dimiliki oleh pemilik akun.
- Data payout seller harus diberikan dan dikelola oleh user yang menjadi seller, bukan diketik sebagai data otoritatif oleh buyer.
- Transaksi menjadi siap dibayar setelah data wajib buyer dan seller lengkap.
- Tidak ada tombol atau tahap `Seller Acceptance` terpisah; seller bergabung dengan mengisi data role seller yang diwajibkan.

Detail field untuk akun, role buyer, role seller, dan transaksi ditentukan pada tahap User Requirements.

## Seller As Transaction Creator

1. User masuk atau membuat satu akun BayarAman.
2. User membuat transaksi dengan role seller.
3. Seller mengisi detail kesepakatan dan data seller, termasuk rekening payout.
4. Seller membagikan invitation/link transaksi kepada buyer.
5. Buyer masuk atau membuat akun yang berbeda dari akun seller, bergabung sebagai buyer, dan melengkapi data buyer miliknya sendiri.
6. Setelah data kedua role lengkap, instruksi pembayaran tersedia dan timer pembayaran 1x24 jam dimulai.
7. Buyer membayar ke rekening BayarAman.
8. Buyer mengklik tombol `Sudah Bayar`.
9. Admin memeriksa pembayaran.
10. Admin membuat group WhatsApp.
11. Admin menginformasikan di group bahwa pembayaran sudah masuk.
12. Seller mengirim barang.
13. Seller dan buyer menginformasikan bahwa pesanan selesai.
14. Admin mengirim link konfirmasi buyer di group.
15. Buyer membuka link dan menjalani konfirmasi OTP melalui email atau WhatsApp.
16. Admin mentransfer uang ke seller.

## Buyer As Transaction Creator

1. User masuk atau membuat satu akun BayarAman.
2. User membuat transaksi dengan role buyer.
3. Buyer mengisi detail kesepakatan dan data buyer miliknya sendiri.
4. Buyer membagikan invitation/link transaksi kepada seller.
5. Seller masuk atau membuat akun yang berbeda dari akun buyer, bergabung sebagai seller, dan melengkapi data seller termasuk rekening payout.
6. Setelah data kedua role lengkap, instruksi pembayaran tersedia dan timer pembayaran 1x24 jam dimulai.
7. Buyer membayar ke rekening BayarAman.
8. Buyer mengklik tombol `Sudah Bayar`.
9. Admin memeriksa pembayaran.
10. Admin membuat group WhatsApp.
11. Admin menginformasikan di group bahwa pembayaran sudah masuk.
12. Seller mengirim barang.
13. Seller dan buyer menginformasikan bahwa pesanan selesai.
14. Admin mengirim link konfirmasi buyer di group.
15. Buyer membuka link dan menjalani konfirmasi OTP melalui email atau WhatsApp.
16. Admin mentransfer uang ke seller.

## Additional Business Rules

- Transaksi yang belum dibayar kedaluwarsa dalam 1x24 jam sejak instruksi pembayaran tersedia.
- Sistem menolak invitation/join apabila akun counterparty sama dengan akun pembuat transaksi.
- Klik `Sudah Bayar` sebelum deadline menghentikan expiry sementara selama admin memeriksa pembayaran.
- Jika pembayaran tidak ditemukan, transaksi kembali menunggu dengan deadline awal; jika deadline sudah lewat, transaksi langsung expired.
- Masalah atau komplain antara buyer dan seller diselesaikan di luar sistem.
