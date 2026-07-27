# BayarAman Baseline Requirements

Folder ini berisi bahan dasar produk yang dibuat sebelum workflow artifact bertahap diterapkan. Nama folder `requirenment` dipertahankan agar tidak menimbulkan perubahan path yang tidak perlu.

## Fungsi Folder

- Dipakai ketika membuat atau merevisi `docs/product/00-product-brief.md`.
- Bukan source of truth langsung untuk User Journey, User Requirements, QA, PRD, atau engineering.
- `00-owner-direction.md` adalah raw input terbaru dan mengalahkan draft lama di folder ini bila terjadi konflik.
- Artifact aktif yang sudah disetujui mengalahkan seluruh raw input dan draft untuk tahap setelah Product Brief.
- Setelah Product Brief disetujui, tahap berikutnya cukup membaca artifact upstream yang disetujui dan templatenya.

## Isi

| File | Kegunaan |
| --- | --- |
| `00-owner-direction.md` | Arahan terbaru product owner; prioritas tertinggi untuk Product Brief berikutnya |
| `BayarAman — Product Concept (Draft).md` | Konsep dasar, masalah, positioning, dan prinsip produk |
| `BayarAman — User Journey Blueprint v2 (Draft).md` | Kandidat langkah dan edge case lama; sebagian sudah digantikan |
| `BayarAman — Product Requirements Document v1 (MVP).md` | Kandidat requirement lama; bukan PRD aktif |
| `BayarAman — Business Model & Operating Model (Draft).md` | Kandidat fee dan operasi; belum dianggap keputusan aktif |

Dokumen lama yang dipindahkan dari root repo berada di `docs/archive/pre-workflow/` dan tidak dibaca otomatis.
