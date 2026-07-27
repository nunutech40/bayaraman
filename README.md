# BayarAman

Repository ini sedang mendefinisikan ulang produk BayarAman dengan workflow artifact bertahap. Product Brief v0.7, User Journey v0.4, dan UX Flow v0.1 sudah disetujui; User Requirements v0.2 sedang direview dan menunggu perubahan upstream untuk cancellation.

## Tahap Saat Ini

- Tahap aktif: review User Requirements dengan change request cancellation.
- Source aktif: Product Brief v0.7, User Journey v0.4, dan UX Flow v0.1 (`Approved`).
- Draft aktif: `docs/product/03-user-requirements.md` v0.2; seluruh open decision sebelumnya sudah dikonfirmasi.
- Sebelum User Requirements disetujui, cancellation harus direvisi dan disetujui berurutan di Product Brief, User Journey, dan UX Flow.
- Dokumen lama berada di `docs/archive/` dan tidak menjadi konteks aktif.
- Jangan lanjut ke UI/UX Design atau QA Scenarios sebelum User Requirements disetujui secara eksplisit.

## Urutan Sumber

Saat membuat Product Brief:

1. Arahan product owner yang diberikan untuk tahap tersebut.
2. Baseline di `requirenment/`.
3. Template Product Brief.

Setelah sebuah artifact disetujui, artifact tersebut menjadi sumber utama tahap berikutnya. Prototype dan arsip tidak menjadi sumber keputusan produk kecuali diminta secara khusus.

## Perubahan Cancellation

Cancellation dimulai dari revisi Product Brief, bukan langsung dari UX Flow. Gunakan prompt berikut untuk membuka satu tahap pertama saja:

```text
Use $bayaraman-workflow.
Revisi docs/product/00-product-brief.md menggunakan
docs/product/templates/product-brief-template.md untuk menambahkan cancellation.
Gunakan rekomendasi cancellation terakhir sebagai proposal dan tandai kebijakan
yang masih membutuhkan konfirmasi saya.
Naikkan versi dan pertahankan status Draft.
Jangan ubah User Journey, UX Flow, atau User Requirements dulu.
```

## Workflow Lokal

Workflow berjalan tanpa akun atau login HumanLayer.

```text
Product Brief
-> User Journey
-> UX Flow
-> User Requirements
-> UI/UX Design
-> QA Scenarios
-> PRD
-> Technical Design
-> Tickets
-> Research -> Plan -> Review -> Implement -> Validate
```

- **UX Flow** memetakan Journey menjadi layar/experience node, keputusan, perpindahan channel, jalur gagal, dan pekerjaan manual. Tahap ini belum menentukan visual final.
- **UI/UX Design** memetakan UX Flow dan User Requirements menjadi spesifikasi layar, field, action, permission, seluruh state penting, responsive/accessibility, serta wireframe atau prototype yang direview.
- Wireframe/prototype baru dibuat di tahap UI/UX Design. Prototype lama tidak otomatis menjadi requirement.

- Aturan konteks agent: `AGENTS.md`
- Urutan dan gate tahap: `WORKFLOW.md`
- Skill Codex: `.agents/skills/bayaraman-workflow/SKILL.md`
- Template: `docs/product/templates/`, `docs/engineering/templates/`, dan `docs/execution/templates/`

Prompt setelah User Requirements selesai direview:

```text
Use $bayaraman-workflow.
Saya approve versi terbaru docs/product/03-user-requirements.md.
Ubah statusnya menjadi Approved, lalu buat UI/UX Design Spec dan wireframe/prototype saja.
```

## Prototype

Prototype statis berada di `prototype/` dan hanya menjadi demo UI/implementasi historis sampai ada artifact produk baru yang disetujui.

- Lokal: buka `prototype/index.html`
- Publik: `https://nunutech40.github.io/bayaraman/prototype/`

GitHub Pages menggunakan branch `main` dan folder `/(root)`.

## Struktur

```text
requirenment/              baseline produk untuk Product Brief baru
docs/product/templates/    template artifact produk
docs/engineering/          template desain teknis dan ticket
docs/execution/            template research, plan, review, validation
docs/archive/              dokumen lama; tidak dibaca otomatis
prototype/                 prototype UI historis
```
