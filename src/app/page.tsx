export default function HomePage() {
  return (
    <main className="app-shell">
      <section aria-labelledby="page-title" className="surface">
        <p className="eyebrow">BayarAman</p>
        <h1 id="page-title">Transaksi aman dimulai dari akun.</h1>
        <p className="muted">
          Verifikasi WhatsApp sebelum memilih peran buyer atau seller.
        </p>
        <a className="button-link" href="/login">Masuk atau buat akun</a>
      </section>
    </main>
  );
}
