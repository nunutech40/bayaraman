"use client";

import { useCallback, useEffect, useState } from "react";

type ViewState = "loading" | "ready" | "error" | "expired" | "success";
type ConfirmationData = { confirmationLinkId: string; transactionId: string; buyerWhatsapp: string; expiresAt: string; reminderDueAt: string; state: string; stateVersion: number; otp: { deliveryResult: string; attempts: number; expiresAt: string; cooldownUntil: string | null; lockedUntil: string | null } | null };

export default function BuyerConfirmation({ token }: { token: string }) {
  const [state, setState] = useState<ViewState>("loading");
  const [data, setData] = useState<ConfirmationData | null>(null);
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setState("loading");
    const response = await fetch(`/api/confirmation/${encodeURIComponent(token)}`, { cache: "no-store" });
    if (!response.ok) { setState(response.status === 400 ? "expired" : "error"); return; }
    setData(await response.json() as ConfirmationData);
    setState("ready");
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  async function requestOtp() {
    setBusy(true); setMessage("");
    const response = await fetch(`/api/confirmation/${encodeURIComponent(token)}/otp`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: "{}" });
    const result = await response.json() as { challengeId?: string; delivery?: string; message?: string };
    setBusy(false);
    if (!response.ok) { setMessage(result.message ?? "OTP belum dapat diminta."); return; }
    setChallengeId(result.challengeId ?? "");
    setMessage(result.delivery === "UNKNOWN" ? "Pengiriman belum terverifikasi. Coba lagi sesuai cooldown." : "OTP dicatat untuk dikirim melalui WhatsApp.");
    await load();
  }

  async function verify() {
    if (!data || !challengeId || !/^\d{6}$/.test(code)) return;
    setBusy(true); setMessage("");
    const response = await fetch(`/api/confirmation/${encodeURIComponent(token)}/verify`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ challengeId, code, expectedStateVersion: data.stateVersion }) });
    const result = await response.json() as { message?: string; verified?: boolean };
    setBusy(false);
    if (!response.ok || !result.verified) { setMessage(result.message ?? "Kode OTP belum benar."); return; }
    setState("success");
    setMessage("Penerimaan barang tercatat. Admin akan memproses payout seller secara terpisah.");
  }

  return <main className="app-shell"><section className="surface" aria-labelledby="confirmation-title">
    <p className="eyebrow">Konfirmasi Buyer</p>
    <h1 id="confirmation-title">Konfirmasi penerimaan barang</h1>
    {state === "loading" && <p className="muted" role="status">Memuat link konfirmasi...</p>}
    {state === "error" && <p className="form-error" role="alert">Link tidak dapat dibuka. Pastikan kamu masuk sebagai Buyer terkait.</p>}
    {state === "expired" && <p className="form-error" role="alert">Link konfirmasi sudah tidak tersedia atau sudah digunakan.</p>}
    {state === "success" && <p className="muted" role="status">{message}</p>}
    {state === "ready" && data && <div className="stack">
      <p className="muted">Nomor WhatsApp tujuan: <strong>{data.buyerWhatsapp}</strong></p>
      <p className="muted">Batas konfirmasi: {new Date(data.expiresAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB</p>
      <button type="button" onClick={requestOtp} disabled={busy || Boolean(data.otp?.cooldownUntil && new Date(data.otp.cooldownUntil) > new Date())}>{busy ? "Meminta..." : "Kirim OTP WhatsApp"}</button>
      <label htmlFor="confirmation-otp">Kode OTP 6 digit<input id="confirmation-otp" inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} /></label>
      <button type="button" onClick={verify} disabled={busy || !challengeId || code.length !== 6}>{busy ? "Memverifikasi..." : "Konfirmasi sudah diterima"}</button>
      {message && <p className="muted" role="status">{message}</p>}
    </div>}
  </section></main>;
}
