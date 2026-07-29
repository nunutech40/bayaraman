"use client";

import { useState } from "react";

type OperationState = "idle" | "loading" | "ready" | "empty" | "error";

export default function WhatsAppOperations() {
  const [transactionId, setTransactionId] = useState("");
  const [state, setState] = useState<OperationState>("idle");
  const [data, setData] = useState<any>(null);
  const [groupReference, setGroupReference] = useState("");
  const [lastFourBuyer, setLastFourBuyer] = useState("");
  const [lastFourSeller, setLastFourSeller] = useState("");
  const [checkpointType, setCheckpointType] = useState("PAYMENT_ANNOUNCED");
  const [sourceAuthorRole, setSourceAuthorRole] = useState("ADMIN");
  const [evidenceReference, setEvidenceReference] = useState("");
  const [messageReference, setMessageReference] = useState("");
  const [snapshotHash, setSnapshotHash] = useState("");
  const [deliveryResult, setDeliveryResult] = useState("SENT");
  const [checkpointBusy, setCheckpointBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  async function load() {
    if (!transactionId.trim()) return;
    setState("loading");
    try {
      const response = await fetch(`/api/admin/transactions/${encodeURIComponent(transactionId)}/whatsapp`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const result = await response.json();
      setData(result);
      setState(result.group || result.checkpoints.length ? "ready" : "empty");
    } catch { setData(null); setState("error"); }
  }

  async function createGroup() {
    const body = { groupReference, buyerSnapshotConfirmation: { lastFour: lastFourBuyer }, sellerSnapshotConfirmation: { lastFour: lastFourSeller }, evidenceReference: "manual-admin-reference", expectedStateVersion: data.stateVersion };
    const response = await fetch(`/api/admin/transactions/${encodeURIComponent(transactionId)}/whatsapp`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify(body) });
    if (!response.ok) { setState("error"); setActionMessage("Group belum dapat dicatat."); return; }
    setActionMessage("Group berhasil dicatat.");
    await load();
  }

  async function createCheckpoint() {
    if (!data || !evidenceReference || !messageReference || !/^[a-f0-9]{64}$/.test(snapshotHash)) return;
    setCheckpointBusy(true);
    setActionMessage("");
    const response = await fetch(`/api/admin/transactions/${encodeURIComponent(transactionId)}/whatsapp/checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ checkpointType, sourceAuthorRole, evidenceReference, messageReference, snapshotHash, deliveryResult, expectedStateVersion: data.stateVersion })
    });
    setCheckpointBusy(false);
    if (!response.ok) { setState("error"); setActionMessage("Checkpoint belum dapat dicatat. Periksa state version dan data evidence."); return; }
    setActionMessage("Checkpoint berhasil dicatat.");
    setEvidenceReference("");
    setMessageReference("");
    setSnapshotHash("");
    await load();
  }

  return (
    <main className="app-shell">
      <section className="surface">
        <p className="eyebrow">Admin · WhatsApp operations</p>
        <h1>Checkpoint WhatsApp</h1>
        <p className="muted">Pencatatan manual setelah pembayaran Midtrans authoritative. Tidak ada API WhatsApp, OTP, payout, atau refund di layar ini.</p>
        <div className="stack">
          <label htmlFor="wa-transaction-id">ID transaksi</label>
          <input id="wa-transaction-id" value={transactionId} onChange={(event) => setTransactionId(event.target.value)} placeholder="UUID transaksi" />
          <button type="button" onClick={load} disabled={!transactionId.trim() || state === "loading"}>{state === "loading" ? "Memuat..." : "Muat checkpoint"}</button>
        </div>
        {state === "error" && <p className="form-error" role="alert">Data belum dapat dimuat atau aksi Admin tidak valid.</p>}
        {state === "empty" && <p className="muted" role="status">Belum ada group atau checkpoint yang tercatat.</p>}
        {data && (state === "ready" || state === "empty") && <section className="payment-panel" aria-live="polite">
          <h2>{data.state}</h2>
          <p className="muted">State version {data.stateVersion}. Data evidence mentah tidak ditampilkan.</p>
          {!data.group && <div className="stack">
            <label htmlFor="group-reference">Referensi group</label><input id="group-reference" value={groupReference} onChange={(event) => setGroupReference(event.target.value)} />
            <label htmlFor="buyer-last-four">Empat digit WhatsApp Buyer</label><input id="buyer-last-four" inputMode="numeric" maxLength={4} value={lastFourBuyer} onChange={(event) => setLastFourBuyer(event.target.value.replace(/\D/g, ""))} />
            <label htmlFor="seller-last-four">Empat digit WhatsApp Seller</label><input id="seller-last-four" inputMode="numeric" maxLength={4} value={lastFourSeller} onChange={(event) => setLastFourSeller(event.target.value.replace(/\D/g, ""))} />
            <button type="button" onClick={createGroup} disabled={!groupReference || lastFourBuyer.length !== 4 || lastFourSeller.length !== 4}>Catat group dibuat</button>
          </div>}
          {data.group && <div className="stack">
            <h3>Catat checkpoint</h3>
            <label htmlFor="checkpoint-type">Jenis checkpoint</label>
            <select id="checkpoint-type" value={checkpointType} onChange={(event) => {
              const value = event.target.value;
              setCheckpointType(value);
              setSourceAuthorRole(value === "BUYER_COMPLETION" ? "BUYER" : value === "SELLER_COMPLETION" || value === "SELLER_SHIPMENT" ? "SELLER" : "ADMIN");
            }}>
              <option value="PAYMENT_ANNOUNCED">Payment announced</option>
              <option value="SELLER_SHIPMENT">Seller shipment</option>
              <option value="SELLER_COMPLETION">Seller completion</option>
              <option value="BUYER_COMPLETION">Buyer completion</option>
            </select>
            <label htmlFor="checkpoint-author">Source author role</label>
            <select id="checkpoint-author" value={sourceAuthorRole} onChange={(event) => setSourceAuthorRole(event.target.value)}>
              <option value="ADMIN">Admin</option><option value="SELLER">Seller</option><option value="BUYER">Buyer</option>
            </select>
            <label htmlFor="evidence-reference">Evidence reference</label><input id="evidence-reference" value={evidenceReference} onChange={(event) => setEvidenceReference(event.target.value)} />
            <label htmlFor="message-reference">Message reference</label><input id="message-reference" value={messageReference} onChange={(event) => setMessageReference(event.target.value)} />
            <label htmlFor="snapshot-hash">Snapshot hash</label><input id="snapshot-hash" value={snapshotHash} onChange={(event) => setSnapshotHash(event.target.value.toLowerCase())} placeholder="64 karakter SHA-256" />
            <label htmlFor="delivery-result">Delivery result</label>
            <select id="delivery-result" value={deliveryResult} onChange={(event) => setDeliveryResult(event.target.value)}>
              <option value="PENDING">PENDING</option><option value="SENT">SENT</option><option value="FAILED">FAILED</option><option value="UNKNOWN">UNKNOWN</option>
            </select>
            <button type="button" onClick={createCheckpoint} disabled={checkpointBusy || !evidenceReference || !messageReference || !/^[a-f0-9]{64}$/.test(snapshotHash)}>{checkpointBusy ? "Mencatat..." : "Catat checkpoint"}</button>
          </div>}
          {actionMessage && <p role="status" className="muted">{actionMessage}</p>}
          <h3>Checkpoint tercatat</h3>
          <ul className="participant-list">{data.checkpoints.map((item: any) => <li key={item.id ?? item.checkpointType}>{item.checkpointType ?? item.type} · {item.deliveryResult}</li>)}</ul>
        </section>}
      </section>
    </main>
  );
}
