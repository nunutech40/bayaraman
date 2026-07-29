"use client";

import { useState } from "react";

type ReviewState = "idle" | "loading" | "ready" | "empty" | "error";

export default function PaymentReview() {
  const [transactionId, setTransactionId] = useState("");
  const [state, setState] = useState<ReviewState>("idle");
  const [data, setData] = useState<{
    state: string;
    stateVersion: number;
    events: Array<{ providerEventId: string; providerStatus: string | null; fraudStatus: string | null; validationOutcome: string }>;
    reconciliations: Array<{ id: string; decisionCode: string | null; result: string }>;
  } | null>(null);

  async function loadReview() {
    if (!transactionId.trim()) return;
    setState("loading");
    try {
      const response = await fetch(`/api/admin/transactions/${encodeURIComponent(transactionId)}/payment-reconciliation`, { cache: "no-store" });
      if (!response.ok) throw new Error("REVIEW_FAILED");
      const result = await response.json();
      setData(result);
      setState(result.events.length || result.reconciliations.length ? "ready" : "empty");
    } catch {
      setData(null);
      setState("error");
    }
  }

  return (
    <main className="app-shell">
      <section className="surface">
        <p className="eyebrow">Admin · Payment review</p>
        <h1>Rekonsiliasi Midtrans</h1>
        <p className="muted">Periksa status provider, validasi event, dan kasus UNKNOWN. Tidak ada aksi payout atau refund di layar ini.</p>
        <div className="stack">
          <label htmlFor="transaction-id">ID transaksi</label>
          <input id="transaction-id" value={transactionId} onChange={(event) => setTransactionId(event.target.value)} placeholder="UUID transaksi" />
          <button type="button" onClick={loadReview} disabled={!transactionId.trim() || state === "loading"}>
            {state === "loading" ? "Memuat..." : "Muat rekonsiliasi"}
          </button>
        </div>

        {state === "error" && <p className="form-error" role="alert">Data tidak dapat dimuat. Pastikan sesi Admin dan ID transaksi benar.</p>}
        {state === "empty" && <p className="muted" role="status">Belum ada event provider atau rekonsiliasi untuk transaksi ini.</p>}
        {data && state === "ready" && (
          <section className="payment-panel" aria-live="polite">
            <h2>Status transaksi: {data.state}</h2>
            <p className="muted">State version {data.stateVersion}. Data rekening dan secret provider tidak ditampilkan.</p>
            <h3>Provider events</h3>
            <ul className="participant-list">
              {data.events.map((event) => (
                <li key={event.providerEventId}>
                  {event.providerStatus ?? "UNKNOWN"} · {event.validationOutcome} · fraud {event.fraudStatus ?? "-"}
                </li>
              ))}
            </ul>
            <h3>Rekonsiliasi</h3>
            <ul className="participant-list">
              {data.reconciliations.map((item) => (
                <li key={item.id}>{item.decisionCode ?? "MANUAL_REVIEW"} · hasil {item.result}</li>
              ))}
            </ul>
          </section>
        )}
      </section>
    </main>
  );
}
