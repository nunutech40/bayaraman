"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function VerifyWhatsapp() {
  const router = useRouter();
  const [number, setNumber] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then(async (response) => {
      if (!response.ok) {
        router.replace("/login");
        return;
      }
      const result = await response.json() as { whatsappNumber: string; whatsappVerified: boolean };
      setNumber(result.whatsappNumber);
      if (result.whatsappVerified) router.replace("/dashboard");
    });
  }, [router]);

  async function requestCode() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/auth/whatsapp/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ whatsappNumber: number })
    });
    const result = await response.json() as { challengeId?: string; message?: string; delivery?: string };
    setBusy(false);
    if (!response.ok || !result.challengeId) {
      setMessage(result.message ?? "OTP belum dapat diminta");
      return;
    }
    setChallengeId(result.challengeId);
    setRequested(true);
    setMessage(result.delivery === "PENDING"
      ? "Permintaan OTP dicatat untuk pengiriman WhatsApp."
      : result.delivery === "UNKNOWN"
        ? "Status pengiriman belum dapat dipastikan. Coba lagi setelah cooldown."
        : result.delivery === "FAILED"
          ? "Pengiriman OTP gagal. Coba lagi setelah cooldown."
          : "OTP sudah diminta.");
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/auth/whatsapp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeId, code })
    });
    const result = await response.json() as { message?: string };
    setBusy(false);
    if (!response.ok) {
      setMessage(result.message ?? "Kode OTP belum valid");
      return;
    }
    router.push("/dashboard");
  }

  return (
    <main className="app-shell">
      <section className="surface" aria-labelledby="verify-title">
        <p className="eyebrow">Verifikasi akun</p>
        <h1 id="verify-title">Verifikasi WhatsApp</h1>
        <p className="muted">Nomor yang terdaftar: <strong>{number || "memuat..."}</strong></p>
        {!requested ? (
          <button type="button" onClick={requestCode} disabled={busy || !number}>{busy ? "Memproses..." : "Minta OTP WhatsApp"}</button>
        ) : (
          <form className="stack" onSubmit={verify}>
            <label>
              Kode OTP 6 digit
              <input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} />
            </label>
            {message && <p className="form-error" role="alert">{message}</p>}
            <button type="submit" disabled={busy || code.length !== 6}>{busy ? "Memverifikasi..." : "Verifikasi"}</button>
            <button className="secondary-button" type="button" onClick={requestCode} disabled={busy}>Minta ulang</button>
          </form>
        )}
        {message && !requested && <p className="form-error" role="alert">{message}</p>}
      </section>
    </main>
  );
}
