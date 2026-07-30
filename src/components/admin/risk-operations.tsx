"use client";

import { useState } from "react";

type RiskData = {
  transactionId: string;
  state: string;
  stateVersion: number;
  risks: Array<{
    id: string;
    category: string;
    lifecycle: string;
    mode: string;
    active: boolean;
    currentEventId: string;
    currentReviewId: string | null;
    events: Array<{ id: string; eventType: string; summarySnapshot: string; createdAt: string }>;
    reviews: Array<{ id: string; version: number; status: string; outcome: string }>;
    handoff: { id: string; outcome: string; consumedAt: string | null } | null;
  }>;
};

type GateData = {
  status: string;
  stateVersion: number;
  items: Array<{ id: string; itemKey: string; status: string; currentEventId: string | null }>;
};

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function post(path: string, body: Record<string, unknown>) {
  return fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(body)
  });
}

export default function RiskOperations() {
  const [transactionId, setTransactionId] = useState("");
  const [data, setData] = useState<RiskData | null>(null);
  const [gate, setGate] = useState<GateData | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("PROHIBITED_OR_POLICY");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [evidenceReference, setEvidenceReference] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [outcome, setOutcome] = useState("KEEP_HOLD");
  const [decisionNote, setDecisionNote] = useState("");
  const [gateItem, setGateItem] = useState("MIDTRANS_SETTLEMENT");
  const [gateItemStatus, setGateItemStatus] = useState("OPEN");
  const [externalReference, setExternalReference] = useState("");

  const activeRisk = data?.risks.find((risk) => risk.active);
  const selectedRisk = activeRisk ?? data?.risks[0];
  const currentReview = selectedRisk?.reviews.find((review) => review.id === selectedRisk.currentReviewId);

  async function loadRisk() {
    if (!transactionId.trim()) return;
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/admin/transactions/${encodeURIComponent(transactionId)}/risk`, { cache: "no-store" });
    setBusy(false);
    if (!response.ok) {
      setData(null);
      setMessage("Data risk tidak dapat dibuka. Periksa assignment Admin.");
      return;
    }
    setData(await response.json() as RiskData);
  }

  async function loadGate() {
    setBusy(true);
    const response = await fetch("/api/admin/release-gates/real-money-pilot", { cache: "no-store" });
    setBusy(false);
    if (!response.ok) {
      setMessage("Release gate tidak dapat dibuka.");
      return;
    }
    setGate(await response.json() as GateData);
  }

  async function mutate(path: string, body: Record<string, unknown>, reload: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    const response = await post(path, body);
    setBusy(false);
    if (!response.ok) {
      setMessage((await response.json() as { message?: string }).message ?? "Aksi belum dapat diproses.");
      return;
    }
    setMessage("Perubahan berhasil dicatat.");
    await reload();
  }

  async function createRisk() {
    if (!data) return;
    await mutate(`/api/admin/transactions/${transactionId}/risk`, {
      category, reason, ...(note ? { note } : {}),
      evidenceReference,
      evidenceHash: await sha256(`${evidenceReference}:${reason}`),
      expectedStateVersion: data.stateVersion
    }, loadRisk);
  }

  async function correctEvidence() {
    if (!data || !selectedRisk) return;
    await mutate(`/api/admin/transactions/${transactionId}/risk/${selectedRisk.id}/events`, {
      correctedEventId: selectedRisk.currentEventId,
      summary: reason,
      evidenceReference,
      evidenceHash: await sha256(`${evidenceReference}:${reason}`),
      correctionReason,
      expectedStateVersion: data.stateVersion
    }, loadRisk);
  }

  async function proposeReview() {
    if (!data || !activeRisk) return;
    await mutate(`/api/admin/transactions/${transactionId}/risk/${activeRisk.id}/reviews`, {
      outcome,
      evidenceEventId: activeRisk.currentEventId,
      decisionNote,
      expectedStateVersion: data.stateVersion
    }, loadRisk);
  }

  async function decide(decision: "APPROVED" | "REJECTED") {
    if (!data || !activeRisk || !currentReview) return;
    await mutate(`/api/admin/transactions/${transactionId}/risk/${activeRisk.id}/reviews/${currentReview.id}/decide`, {
      decision, expectedStateVersion: data.stateVersion
    }, loadRisk);
  }

  async function recordGateItem() {
    if (!gate) return;
    await mutate(`/api/admin/release-gates/real-money-pilot/items/${gateItem}/events`, {
      status: gateItemStatus,
      evidenceReference,
      ...(externalReference ? { externalApproverReference: externalReference } : {}),
      expectedGateVersion: gate.stateVersion
    }, loadGate);
  }

  async function evaluateGate() {
    if (!gate) return;
    await mutate("/api/admin/release-gates/real-money-pilot/evaluate", {
      expectedGateVersion: gate.stateVersion,
      ...(externalReference ? { externalDecisionReference: externalReference } : {})
    }, loadGate);
  }

  return (
    <main className="app-shell">
      <section className="surface">
        <p className="eyebrow">Admin · Risk review</p>
        <h1>Risk hold dan release gate</h1>
        <p className="muted">Catat evidence dan keputusan yang sudah dibuat secara manual. Layar ini tidak memindahkan dana atau menentukan kelayakan legal.</p>

        <div className="stack">
          <label htmlFor="risk-transaction">ID transaksi</label>
          <input id="risk-transaction" value={transactionId} onChange={(event) => setTransactionId(event.target.value)} placeholder="UUID transaksi" />
          <button type="button" onClick={loadRisk} disabled={busy || !transactionId.trim()}>
            {busy ? "Memproses..." : "Muat risk case"}
          </button>
        </div>

        {data && (
          <section className="payment-panel" aria-live="polite">
            <h2>{data.state}</h2>
            <p className="muted">State version {data.stateVersion}. Financial action tetap disabled.</p>
            <div className="stack">
              <label htmlFor="risk-category">Kategori internal</label>
              <select id="risk-category" value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="PROHIBITED_OR_POLICY">Barang/kebijakan terlarang</option>
                <option value="SUSPECTED_FRAUD">Dugaan fraud</option>
                <option value="OTHER_MANUAL_REVIEW">Review manual lain</option>
              </select>
              <label htmlFor="risk-reason">Ringkasan evidence</label>
              <textarea id="risk-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
              {category === "OTHER_MANUAL_REVIEW" && <>
                <label htmlFor="risk-note">Catatan</label>
                <input id="risk-note" value={note} onChange={(event) => setNote(event.target.value)} />
              </>}
              <label htmlFor="risk-evidence">Referensi evidence</label>
              <input id="risk-evidence" value={evidenceReference} onChange={(event) => setEvidenceReference(event.target.value)} />
              {!selectedRisk && <button type="button" onClick={createRisk} disabled={busy || reason.length < 10 || evidenceReference.length < 3}>Catat risk</button>}
            </div>

            {selectedRisk && <>
              <p className="section-label">{selectedRisk.mode} · {selectedRisk.lifecycle}</p>
              <ul className="participant-list">
                {selectedRisk.events.map((event) => <li key={event.id}>{event.eventType} · {event.summarySnapshot}</li>)}
              </ul>
              <div className="stack">
                <label htmlFor="risk-correction">Alasan koreksi evidence</label>
                <input id="risk-correction" value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} />
                <button className="secondary-button" type="button" onClick={correctEvidence} disabled={busy || correctionReason.length < 5 || reason.length < 10 || evidenceReference.length < 3}>Koreksi evidence</button>
              </div>
            </>}

            {activeRisk && (!currentReview || currentReview.status !== "PENDING") && (
              <div className="stack">
                <label htmlFor="risk-outcome">Hasil review</label>
                <select id="risk-outcome" value={outcome} onChange={(event) => setOutcome(event.target.value)}>
                  <option value="KEEP_HOLD">Pertahankan hold</option>
                  <option value="CLEAR_TO_MANUAL_REVIEW">Lanjut review manual</option>
                  <option value="BUYER_REFUND">Otorisasi refund Buyer</option>
                </select>
                <label htmlFor="risk-decision-note">Catatan keputusan</label>
                <textarea id="risk-decision-note" value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} />
                <button type="button" onClick={proposeReview} disabled={busy || decisionNote.length < 5}>Ajukan review</button>
              </div>
            )}
            {activeRisk && currentReview?.status === "PENDING" && (
              <div className="stack">
                <p className="muted">Review v{currentReview.version}: {currentReview.outcome}. Refund memerlukan dua Admin berbeda.</p>
                <button type="button" onClick={() => decide("APPROVED")} disabled={busy}>Setujui</button>
                <button className="secondary-button" type="button" onClick={() => decide("REJECTED")} disabled={busy}>Tolak</button>
              </div>
            )}
            {selectedRisk?.handoff && <p className="success-message">Handoff refund tersedia. Eksekusi tetap berada di BAYAR-008.</p>}
          </section>
        )}

        <section className="payment-panel">
          <h2>Real-money pilot gate</h2>
          <p className="muted">Gate ini hanya merekam keputusan eksternal dan tidak mengubah transaksi.</p>
          {!gate ? (
            <button type="button" onClick={loadGate} disabled={busy}>Muat release gate</button>
          ) : (
            <div className="stack" aria-live="polite">
              <p className="section-label">{gate.status} · version {gate.stateVersion}</p>
              <label htmlFor="gate-item">Gate item</label>
              <select id="gate-item" value={gateItem} onChange={(event) => setGateItem(event.target.value)}>
                {gate.items.map((item) => <option key={item.id} value={item.itemKey}>{item.itemKey} · {item.status}</option>)}
              </select>
              <label htmlFor="gate-status">Status evidence</label>
              <select id="gate-status" value={gateItemStatus} onChange={(event) => setGateItemStatus(event.target.value)}>
                <option value="OPEN">Open</option>
                <option value="BLOCKED">Blocked</option>
                <option value="APPROVED">Approved</option>
              </select>
              <label htmlFor="external-reference">Referensi keputusan eksternal</label>
              <input id="external-reference" value={externalReference} onChange={(event) => setExternalReference(event.target.value)} />
              <button type="button" onClick={recordGateItem} disabled={busy || evidenceReference.length < 3}>Catat item</button>
              <button className="secondary-button" type="button" onClick={evaluateGate} disabled={busy}>Evaluasi gate</button>
            </div>
          )}
        </section>
        {message && <p className={message.includes("berhasil") ? "success-message" : "form-error"} role="status">{message}</p>}
      </section>
    </main>
  );
}
