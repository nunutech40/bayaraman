"use client";

import { useState } from "react";

type LoadState = "idle" | "loading" | "ready" | "empty" | "error";
type ComplaintData = {
  transactionId: string;
  state: string;
  stateVersion: number;
  complaints: Array<{
    id: string;
    lifecycle: string;
    active: boolean;
    currentEventId: string;
    currentAgreementId: string | null;
    events: Array<{ id: string; eventType: string; summarySnapshot: string; createdAt: string }>;
    agreements: Array<{ id: string; version: number; status: string; outcome: string }>;
    handoff: { id: string; outcome: string; consumedAt: string | null } | null;
  }>;
};

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default function ComplaintOperations() {
  const [transactionId, setTransactionId] = useState("");
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [data, setData] = useState<ComplaintData | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [summary, setSummary] = useState("");
  const [evidenceReference, setEvidenceReference] = useState("");
  const [sourceAuthorRole, setSourceAuthorRole] = useState("BUYER");
  const [correctionReason, setCorrectionReason] = useState("");
  const [outcome, setOutcome] = useState("SELLER_RELEASE");
  const [buyerAmount, setBuyerAmount] = useState("");
  const [sellerAmount, setSellerAmount] = useState("");

  const activeComplaint = data?.complaints.find((complaint) => complaint.active);
  const currentAgreement = activeComplaint?.agreements.find((agreement) => agreement.id === activeComplaint.currentAgreementId);

  async function load() {
    if (!transactionId.trim()) return;
    setLoadState("loading");
    setMessage("");
    const response = await fetch(`/api/admin/transactions/${encodeURIComponent(transactionId)}/complaints`, { cache: "no-store" });
    if (!response.ok) {
      setData(null);
      setLoadState("error");
      return;
    }
    const result = await response.json() as ComplaintData;
    setData(result);
    setLoadState(result.complaints.length ? "ready" : "empty");
  }

  async function mutate(path: string, body: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify(body)
    });
    setBusy(false);
    if (!response.ok) {
      setMessage((await response.json() as { message?: string }).message ?? "Aksi belum dapat diproses.");
      return;
    }
    setMessage("Perubahan berhasil dicatat.");
    await load();
  }

  async function evidenceHash() {
    return sha256(`${evidenceReference}:${summary}`);
  }

  async function recordIntake() {
    if (!data) return;
    await mutate(`/api/admin/transactions/${encodeURIComponent(transactionId)}/complaints`, {
      summary, evidenceReference, evidenceHash: await evidenceHash(),
      sourceAuthorRole, expectedStateVersion: data.stateVersion
    });
  }

  async function correctEvidence() {
    if (!data || !activeComplaint) return;
    await mutate(`/api/admin/transactions/${transactionId}/complaints/${activeComplaint.id}/events`, {
      correctedEventId: activeComplaint.currentEventId, summary, evidenceReference,
      evidenceHash: await evidenceHash(), correctionReason, sourceAuthorRole,
      expectedStateVersion: data.stateVersion
    });
  }

  async function noAgreement() {
    if (!data || !activeComplaint) return;
    await mutate(`/api/admin/transactions/${transactionId}/complaints/${activeComplaint.id}/no-agreement`, {
      summary, evidenceReference, evidenceHash: await evidenceHash(),
      expectedStateVersion: data.stateVersion
    });
  }

  async function proposeAgreement() {
    if (!data || !activeComplaint) return;
    await mutate(`/api/admin/transactions/${transactionId}/complaints/${activeComplaint.id}/agreements`, {
      outcome, evidenceEventId: activeComplaint.currentEventId,
      evidenceReference, evidenceHash: await evidenceHash(),
      ...(outcome === "SPLIT" ? { buyerAmount: Number(buyerAmount), sellerAmount: Number(sellerAmount) } : {}),
      expectedStateVersion: data.stateVersion
    });
  }

  async function decide(decision: "APPROVED" | "REJECTED") {
    if (!data || !activeComplaint || !currentAgreement) return;
    await mutate(`/api/admin/transactions/${transactionId}/complaints/${activeComplaint.id}/agreements/${currentAgreement.id}/approve`, {
      decision, expectedStateVersion: data.stateVersion
    });
  }

  return (
    <main className="app-shell">
      <section className="surface">
        <p className="eyebrow">Admin · Complaint operations</p>
        <h1>Complaint dan kesepakatan</h1>
        <p className="muted">Penyelesaian Buyer-Seller tetap berlangsung di luar sistem. Layar ini hanya mencatat evidence, hold, kesepakatan tertulis, dan handoff.</p>
        <div className="stack">
          <label htmlFor="complaint-transaction">ID transaksi</label>
          <input id="complaint-transaction" value={transactionId} onChange={(event) => setTransactionId(event.target.value)} placeholder="UUID transaksi" />
          <button type="button" onClick={load} disabled={loadState === "loading" || !transactionId.trim()}>
            {loadState === "loading" ? "Memuat..." : "Muat complaint"}
          </button>
        </div>
        {loadState === "error" && <p className="form-error" role="alert">Data tidak dapat dibuka. Periksa assignment Admin.</p>}
        {data && (loadState === "ready" || loadState === "empty") && (
          <section className="payment-panel" aria-live="polite">
            <h2>{data.state}</h2>
            <p className="muted">State version {data.stateVersion}. Tindakan finansial tidak tersedia di ticket ini.</p>
            <div className="stack">
              <label htmlFor="complaint-summary">Ringkasan complaint</label>
              <textarea id="complaint-summary" value={summary} onChange={(event) => setSummary(event.target.value)} />
              <label htmlFor="complaint-evidence">Referensi evidence</label>
              <input id="complaint-evidence" value={evidenceReference} onChange={(event) => setEvidenceReference(event.target.value)} />
              <label htmlFor="complaint-author">Sumber laporan</label>
              <select id="complaint-author" value={sourceAuthorRole} onChange={(event) => setSourceAuthorRole(event.target.value)}>
                <option value="BUYER">Buyer</option>
                <option value="SELLER">Seller</option>
              </select>
              {!activeComplaint && <button type="button" onClick={recordIntake} disabled={busy || summary.length < 10 || evidenceReference.length < 3}>Catat complaint</button>}
            </div>
            {activeComplaint && (
              <>
                <p className="section-label">Case aktif · {activeComplaint.lifecycle}</p>
                <ul className="participant-list">
                  {activeComplaint.events.map((event) => <li key={event.id}>{event.eventType} · {event.summarySnapshot}</li>)}
                </ul>
                <div className="stack">
                  <label htmlFor="correction-reason">Alasan koreksi</label>
                  <input id="correction-reason" value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} />
                  <button className="secondary-button" type="button" onClick={correctEvidence} disabled={busy || correctionReason.length < 5 || summary.length < 10 || evidenceReference.length < 3}>Koreksi evidence</button>
                  <button className="secondary-button" type="button" onClick={noAgreement} disabled={busy || summary.length < 10 || evidenceReference.length < 3}>Catat belum ada kesepakatan</button>
                </div>
                {!currentAgreement || currentAgreement.status === "REJECTED" ? (
                  <div className="stack">
                    <label htmlFor="agreement-outcome">Hasil kesepakatan tertulis</label>
                    <select id="agreement-outcome" value={outcome} onChange={(event) => setOutcome(event.target.value)}>
                      <option value="SELLER_RELEASE">Dana ke Seller</option>
                      <option value="BUYER_REFUND">Refund ke Buyer</option>
                      <option value="SPLIT">Pembagian dana</option>
                    </select>
                    {outcome === "SPLIT" && <>
                      <label>Bagian Buyer<input inputMode="numeric" value={buyerAmount} onChange={(event) => setBuyerAmount(event.target.value.replace(/\D/g, ""))} /></label>
                      <label>Bagian Seller<input inputMode="numeric" value={sellerAmount} onChange={(event) => setSellerAmount(event.target.value.replace(/\D/g, ""))} /></label>
                    </>}
                    <button type="button" onClick={proposeAgreement} disabled={busy || summary.length < 10 || evidenceReference.length < 3}>Ajukan agreement</button>
                  </div>
                ) : (
                  <div className="stack">
                    <p className="muted">Agreement v{currentAgreement.version}: {currentAgreement.outcome} · {currentAgreement.status}</p>
                    {currentAgreement.status === "PENDING" && <>
                      <button type="button" onClick={() => decide("APPROVED")} disabled={busy}>Setujui sebagai Admin</button>
                      <button className="secondary-button" type="button" onClick={() => decide("REJECTED")} disabled={busy}>Tolak agreement</button>
                    </>}
                  </div>
                )}
              </>
            )}
            {data.complaints.some((complaint) => complaint.handoff) && <p className="success-message">Handoff finansial sudah tersedia. Eksekusi dana tetap berada di BAYAR-008.</p>}
            {message && <p className={message.includes("berhasil") ? "success-message" : "form-error"} role="status">{message}</p>}
          </section>
        )}
      </section>
    </main>
  );
}

