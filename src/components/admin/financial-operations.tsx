"use client";

import { useState } from "react";
import SlaTaskSummary from "./sla-task-summary";

type Operation = {
  id: string;
  transactionId: string;
  type: string;
  lifecycle: string;
  result: string | null;
  amount: number;
  destination: string;
  route: string | null;
  attempt: number;
  stateVersion: number;
  approvals: number;
  externalReference: string | null;
};

async function post(path: string, body: Record<string, unknown>) {
  return fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID()
    },
    body: JSON.stringify(body)
  });
}

export default function FinancialOperations() {
  const [transactionId, setTransactionId] = useState("");
  const [operations, setOperations] = useState<Operation[]>([]);
  const [operationType, setOperationType] = useState("PAYOUT");
  const [sourceType, setSourceType] = useState("COMPLAINT");
  const [handoffId, setHandoffId] = useState("");
  const [stateVersion, setStateVersion] = useState(0);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    if (!transactionId.trim()) return;
    setBusy(true);
    setMessage("");
    const response = await fetch(
      `/api/admin/financial-operations?transactionId=${encodeURIComponent(transactionId)}`,
      { cache: "no-store" }
    );
    setBusy(false);
    if (!response.ok) {
      setOperations([]);
      setMessage("Operasi tidak dapat dibuka. Periksa assignment Admin.");
      return;
    }
    setOperations(await response.json() as Operation[]);
  }

  async function mutate(path: string, body: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    const response = await post(path, body);
    setBusy(false);
    if (!response.ok) {
      const result = await response.json() as { message?: string };
      setMessage(result.message ?? "Aksi belum dapat diproses.");
      return;
    }
    setMessage("Aksi finansial berhasil dicatat.");
    setPassword("");
    await load();
  }

  async function prepare() {
    await mutate("/api/admin/financial-operations", {
      transactionId,
      operation: operationType,
      expectedStateVersion: stateVersion,
      ...(operationType !== "PAYOUT" || handoffId
        ? { sourceType, handoffId }
        : {})
    });
  }

  return (
    <main className="app-shell">
      <section className="surface">
        <p className="eyebrow">Admin · Financial operations</p>
        <h1>Payout, refund, dan split</h1>
        <SlaTaskSummary domain="FINANCIAL" />
        <p className="muted">
          Persiapkan dan jalankan operasi terhadap destination yang sudah
          dibekukan. Status Midtrans tidak pernah otomatis menjadi payout.
        </p>

        <div className="stack">
          <label htmlFor="finance-transaction">ID transaksi</label>
          <input id="finance-transaction" value={transactionId}
            onChange={(event) => setTransactionId(event.target.value)}
            placeholder="UUID transaksi" />
          <label htmlFor="finance-state-version">State version transaksi</label>
          <input id="finance-state-version" type="number" min="0"
            value={stateVersion}
            onChange={(event) => setStateVersion(Number(event.target.value))} />
          <button type="button" onClick={load}
            disabled={busy || !transactionId.trim()}>
            {busy ? "Memproses..." : "Muat operasi"}
          </button>
        </div>

        <section className="payment-panel">
          <h2>Siapkan operasi</h2>
          <div className="stack">
            <label htmlFor="finance-type">Jenis operasi</label>
            <select id="finance-type" value={operationType}
              onChange={(event) => setOperationType(event.target.value)}>
              <option value="PAYOUT">Payout Seller</option>
              <option value="REFUND">Refund Buyer</option>
              <option value="SPLIT">Split settlement</option>
            </select>
            {(operationType !== "PAYOUT" || handoffId) && <>
              <label htmlFor="finance-source">Sumber keputusan</label>
              <select id="finance-source" value={sourceType}
                onChange={(event) => setSourceType(event.target.value)}>
                <option value="COMPLAINT">Complaint</option>
                <option value="RISK">Risk</option>
                <option value="FUNDED_CANCELLATION">Funded cancellation</option>
                <option value="LATE_FUND">Late fund</option>
              </select>
              <label htmlFor="finance-handoff">Handoff ID</label>
              <input id="finance-handoff" value={handoffId}
                onChange={(event) => setHandoffId(event.target.value)} />
            </>}
            <button type="button" onClick={prepare}
              disabled={busy || !transactionId.trim() ||
                (operationType !== "PAYOUT" && !handoffId)}>
              Siapkan operasi
            </button>
          </div>
        </section>

        {operations.map((operation) => (
          <article className="payment-panel" key={operation.id}>
            <p className="section-label">
              {operation.type} · {operation.lifecycle} · attempt {operation.attempt}
            </p>
            <h2>Rp{operation.amount.toLocaleString("id-ID")}</h2>
            <p className="muted">{operation.destination}</p>
            <p className="muted">
              Route {operation.route ?? "belum dipilih"} · approval {operation.approvals}/2
            </p>
            {operation.externalReference &&
              <p className="success-message">Reference tercatat.</p>}
            <div className="stack">
              {operation.result === null && <>
                <button type="button" disabled={busy}
                  onClick={() => mutate(
                    `/api/admin/financial-operations/${operation.id}/approve`,
                    { decision: "APPROVED", expectedOperationVersion: operation.stateVersion }
                  )}>
                  Setujui
                </button>
                {operation.type === "PAYOUT" && <>
                  <label htmlFor={`password-${operation.id}`}>Password Admin</label>
                  <input id={`password-${operation.id}`} type="password"
                    autoComplete="current-password" value={password}
                    onChange={(event) => setPassword(event.target.value)} />
                  <button type="button" disabled={busy || password.length < 8}
                    onClick={() => mutate(
                      `/api/admin/financial-operations/${operation.id}/reauth`,
                      { password, expectedOperationVersion: operation.stateVersion }
                    )}>
                    Re-authenticate
                  </button>
                </>}
                <button type="button" disabled={busy}
                  onClick={() => mutate(
                    `/api/admin/financial-operations/${operation.id}/${
                      operation.type === "PAYOUT" ? "payout" :
                      operation.type === "REFUND" ? "refund" : "split"
                    }`,
                    { expectedOperationVersion: operation.stateVersion }
                  )}>
                  Jalankan operasi
                </button>
              </>}
              {operation.result === "FAILED" &&
                <button type="button" disabled={busy}
                  onClick={() => mutate(
                    `/api/admin/financial-operations/${operation.id}/retry`,
                    { expectedOperationVersion: operation.stateVersion }
                  )}>
                  Buat retry
                </button>}
              {operation.result === "UNKNOWN" &&
                <p className="form-error" role="status">
                  Hasil UNKNOWN wajib direkonsiliasi sebelum retry.
                </p>}
            </div>
          </article>
        ))}
        {message &&
          <p className={message.includes("berhasil") ? "success-message" : "form-error"}
            role="status">{message}</p>}
      </section>
    </main>
  );
}
