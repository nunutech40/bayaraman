"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "login" | "register";

export function AccountAccess() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [form, setForm] = useState({ email: "", password: "", displayName: "", whatsappNumber: "" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const result = await response.json() as { message?: string; whatsappVerified?: boolean };
    setBusy(false);

    if (!response.ok) {
      setMessage(result.message ?? "Akses belum berhasil");
      return;
    }

    router.push(result.whatsappVerified ? "/dashboard" : "/verify-whatsapp");
  }

  return (
    <main className="app-shell">
      <section className="surface" aria-labelledby="access-title">
        <p className="eyebrow">BayarAman</p>
        <h1 id="access-title">{mode === "login" ? "Masuk akun" : "Buat akun"}</h1>
        <p className="muted">Satu akun bisa menjadi buyer atau seller di transaksi yang berbeda.</p>
        <form className="stack" onSubmit={submit}>
          {mode === "register" && (
            <label>
              Nama lengkap
              <input required value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} />
            </label>
          )}
          <label>
            Email
            <input type="email" required autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </label>
          <label>
            Password
            <input type="password" required minLength={mode === "register" ? 8 : 1} autoComplete={mode === "login" ? "current-password" : "new-password"} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          </label>
          {mode === "register" && (
            <label>
              Nomor WhatsApp
              <input required inputMode="tel" autoComplete="tel" value={form.whatsappNumber} onChange={(event) => setForm({ ...form, whatsappNumber: event.target.value })} />
            </label>
          )}
          {message && <p className="form-error" role="alert">{message}</p>}
          <button type="submit" disabled={busy}>{busy ? "Memproses..." : mode === "login" ? "Masuk" : "Buat akun"}</button>
        </form>
        <button className="link-button" type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setMessage(""); }}>
          {mode === "login" ? "Belum punya akun? Buat akun" : "Sudah punya akun? Masuk"}
        </button>
      </section>
    </main>
  );
}
