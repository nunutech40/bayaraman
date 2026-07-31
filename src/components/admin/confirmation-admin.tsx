"use client";

import { useState } from "react";
import SlaTaskSummary from "./sla-task-summary";

export default function ConfirmationAdmin() {
  const [transactionId, setTransactionId] = useState("");
  const [data, setData] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [evidenceReference, setEvidenceReference] = useState("");
  const [checkpointId, setCheckpointId] = useState("");
  const [exceptionId, setExceptionId] = useState("");

  async function load() {
    setBusy(true); setMessage("");
    const response = await fetch(`/api/admin/transactions/${encodeURIComponent(transactionId)}/confirmation`, { cache: "no-store" });
    setBusy(false);
    if (!response.ok) { setMessage("Status konfirmasi belum dapat dimuat."); return; }
    setData(await response.json());
  }

  async function createLink() {
    if (!data) return;
    setBusy(true);
    const response = await fetch(`/api/admin/transactions/${encodeURIComponent(transactionId)}/confirmation-link`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ expectedStateVersion: data.stateVersion }) });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) { setMessage(result.message ?? "Link belum dapat dibuat."); return; }
    setMessage(`Link siap diposting manual di group WhatsApp: ${result.postingUrl}`);
    await load();
  }

  async function requestException() {
    if (!data) return;
    setBusy(true);
    const response = await fetch(`/api/admin/transactions/${encodeURIComponent(transactionId)}/confirmation/exception`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ approvalAction: "REQUEST", buyerCompletionCheckpointId: checkpointId, reason, evidenceReference, expectedStateVersion: data.stateVersion }) });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) { setMessage(result.message ?? "Exception belum dapat dicatat."); return; }
    setExceptionId(result.exceptionId); setMessage("Approval pertama tercatat. Admin berbeda harus menyetujui."); await load();
  }

  async function approveException() {
    if (!data || !exceptionId) return;
    setBusy(true);
    const response = await fetch(`/api/admin/transactions/${encodeURIComponent(transactionId)}/confirmation/exception`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ approvalAction: "APPROVE", exceptionId, expectedStateVersion: data.stateVersion }) });
    const result = await response.json();
    setBusy(false);
    setMessage(response.ok ? "Exception disetujui; payout tetap diproses di BAYAR-008." : result.message ?? "Approval kedua gagal."); await load();
  }

  return <main className="app-shell"><section className="surface" aria-labelledby="admin-confirmation-title">
    <p className="eyebrow">Admin · Confirmation recovery</p><h1 id="admin-confirmation-title">Status konfirmasi Buyer</h1>
    <SlaTaskSummary domain="CONFIRMATION" />
    <div className="stack"><label htmlFor="confirmation-transaction">ID transaksi<input id="confirmation-transaction" value={transactionId} onChange={(event) => setTransactionId(event.target.value)} /></label><button type="button" onClick={load} disabled={busy || !transactionId}>{busy ? "Memuat..." : "Muat status"}</button></div>
    {data && <section className="payment-panel" aria-live="polite"><p className="status-line">State: <strong>{data.state}</strong></p><p className="muted">State version {data.stateVersion}. Token, OTP, dan raw evidence tidak ditampilkan.</p>
      {!data.link && <button type="button" onClick={createLink} disabled={busy}>Buat link konfirmasi</button>}
      {data.link && <p className="muted">Link tersedia sampai {new Date(data.link.expiresAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB. Posting dilakukan manual di group WhatsApp.</p>}
      <h2>OTP dan exception</h2><ul className="participant-list">{data.otps.map((otp: any) => <li key={otp.id}>{otp.deliveryResult} · percobaan {otp.attempts}</li>)}</ul>
      {data.state === "BUYER_CONFIRMATION_OVERDUE" && <div className="stack"><label htmlFor="buyer-checkpoint">ID checkpoint BUYER_COMPLETION<input id="buyer-checkpoint" value={checkpointId} onChange={(event) => setCheckpointId(event.target.value)} /></label><label htmlFor="exception-reason">Alasan exception<textarea id="exception-reason" value={reason} onChange={(event) => setReason(event.target.value)} /></label><label htmlFor="exception-evidence">Referensi evidence<input id="exception-evidence" value={evidenceReference} onChange={(event) => setEvidenceReference(event.target.value)} /></label><button type="button" onClick={requestException} disabled={busy || !checkpointId || !reason || !evidenceReference}>Catat approval pertama</button>{exceptionId && <button type="button" className="secondary-button" onClick={approveException} disabled={busy}>Approval Admin kedua</button>}</div>}
      {message && <p className="muted" role="status">{message}</p>}
    </section>}
  </section></main>;
}
