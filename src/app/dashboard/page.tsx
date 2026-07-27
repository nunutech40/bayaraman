import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuthenticatedAccount } from "@/server/auth/authorization";

export default async function DashboardPage() {
  let account;
  try {
    account = (await requireAuthenticatedAccount()).account;
  } catch {
    redirect("/login");
  }

  if (!account.whatsappVerifiedAt) {
    return <main className="app-shell"><section className="surface"><h1>Verifikasi WhatsApp dulu</h1><Link className="button-link" href="/verify-whatsapp">Buka verifikasi</Link></section></main>;
  }

  return (
    <main className="app-shell">
      <section className="surface" aria-labelledby="role-title">
        <p className="eyebrow">Akun siap</p>
        <h1 id="role-title">Halo, {account.displayName}</h1>
        <p className="muted">Pilih peran untuk transaksi ini. Peran tidak melekat permanen pada akun.</p>
        <div className="role-actions">
          <Link className="button-link" href="/transactions/new?role=SELLER">Mulai sebagai seller</Link>
          <Link className="button-link secondary-button" href="/transactions/new?role=BUYER">Mulai sebagai buyer</Link>
        </div>
      </section>
    </main>
  );
}
