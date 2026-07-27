"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function InvitationView({ token }: { token: string }) {
  const router = useRouter();
  const [data, setData] = useState<{ targetRole: string; state: string; expiresAt: string; item: { itemName: string; description: string }; terms: { totalAmount: number } } | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { fetch(`/api/invitations/${token}`).then(async (response) => { if (!response.ok) { setMessage("Invitation tidak valid atau sudah kedaluwarsa"); return; } setData(await response.json()); }); }, [token]);

  async function join() {
    setBusy(true); setMessage("");
    const response = await fetch(`/api/invitations/${token}/join`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({}) });
    const result = await response.json() as { message?: string; transactionId?: string };
    setBusy(false);
    if (response.status === 401) { router.push(`/login?next=/invite/${token}`); return; }
    if (!response.ok || !result.transactionId) { setMessage(result.message ?? "Invitation belum dapat digunakan"); return; }
    router.push(`/transactions/${result.transactionId}`);
  }

  return <main className="app-shell"><section className="surface" aria-labelledby="invite-title"><p className="eyebrow">Invitation transaksi</p><h1 id="invite-title">{data?.item.itemName ?? "Memuat invitation..."}</h1>{data ? <><p className="muted">Kamu diundang sebagai <strong>{data.targetRole}</strong>. Akun harus berbeda dari pembuat transaksi.</p><p className="muted">Total kesepakatan: Rp {data.terms.totalAmount.toLocaleString("id-ID")}</p><p className="muted">Berlaku sampai: {new Date(data.expiresAt).toLocaleString("id-ID")}</p><button type="button" onClick={join} disabled={busy}>{busy ? "Memproses..." : "Gabung transaksi"}</button></> : <p className="form-error" role="alert">{message}</p>}{message && data && <p className="form-error" role="alert">{message}</p>}</section></main>;
}
