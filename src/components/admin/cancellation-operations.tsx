"use client";

import { useState } from "react";

type CancellationAdminData = {
  transaction: { id: string; state: string; stateVersion: number };
  requests: Array<{
    id: string;
    cause: string;
    status: string;
    lifecycle: string;
    delegationType: string;
    delegationStatus: string;
    manualReviewReason: string | null;
  }>;
};

export default function CancellationOperations() {
  const [transactionId, setTransactionId] = useState("");
  const [data, setData] = useState<CancellationAdminData | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/admin/transactions/${transactionId}/cancellation`, { cache: "no-store" });
    setBusy(false);
    if (!response.ok) {
      setData(null);
      setMessage("Case tidak dapat diakses atau assignment belum sesuai.");
      return;
    }
    setData(await response.json() as CancellationAdminData);
  }

  async function reconcile() {
    if (!data) return;
    setBusy(true);
    const response = await fetch(`/api/admin/transactions/${transactionId}/cancellation/reconcile`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ expectedStateVersion: data.transaction.stateVersion })
    });
    setBusy(false);
    setMessage(response.ok ? "Status provider berhasil direkonsiliasi." : "Rekonsiliasi belum berhasil.");
    if (response.ok) await load();
  }

  return (
    <main className="app-shell">
      <section className="surface" aria-labelledby="cancellation-admin-title">
        <p className="eyebrow">Admin operation</p>
        <h1 id="cancellation-admin-title">Cancellation review</h1>
        <label>ID transaksi
          <input value={transactionId} onChange={(event) => setTransactionId(event.target.value)} />
        </label>
        <button type="button" onClick={load} disabled={busy || !transactionId}>
          {busy ? "Memuat..." : "Buka case"}
        </button>
        {data && (
          <div className="role-data-panel">
            <p className="status-line">Status: <strong>{data.transaction.state}</strong></p>
            {data.requests.map((request) => (
              <div key={request.id} className="complaint-summary">
                <p className="section-label">{request.cause} · {request.status}</p>
                <p>{request.lifecycle}</p>
                <p className="muted">
                  Delegasi: {request.delegationType}/{request.delegationStatus}
                </p>
                {request.manualReviewReason && <p className="form-error">{request.manualReviewReason}</p>}
              </div>
            ))}
            <button type="button" className="secondary-button" onClick={reconcile} disabled={busy}>
              Cek status Midtrans
            </button>
            <p className="muted">Evidence, approval refund, complaint, dan risk memakai endpoint assigned Admin masing-masing.</p>
          </div>
        )}
        {message && <p className="form-error" role="status">{message}</p>}
      </section>
    </main>
  );
}
