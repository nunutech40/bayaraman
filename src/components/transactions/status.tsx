"use client";

import { useCallback, useEffect, useState } from "react";

type Role = "BUYER" | "SELLER";
type TransactionData = {
  state: string;
  stateVersion: number;
  readyForPaymentInstructions: boolean;
  creatorRole: string;
  currentRole?: Role;
  participants: Array<{ role: string; name: string; whatsapp: string; joined: boolean }>;
  item: { itemName: string; description: string } | null;
  terms: { itemPrice: number; shippingCost: number; serviceFee: number; totalAmount: number } | null;
};
type PaymentData = {
  invoiceId: string;
  provider: string;
  providerInvoiceId: string | null;
  hostedPaymentUrl: string | null;
  providerStatus: string | null;
  amount: number;
  currency: string;
  issuedAt: string;
  deadlineAt: string;
  deadlineWib: string;
  state: "WAITING_BUYER_PAYMENT";
  stateVersion: number;
};

export function TransactionStatus({ transactionId }: { transactionId: string }) {
  const [data, setData] = useState<TransactionData | null>(null);
  const [payment, setPayment] = useState<PaymentData | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<Role>("BUYER");
  const [form, setForm] = useState({ recipientName: "", addressLine: "", district: "", city: "", province: "", postalCode: "", bankName: "", accountHolderName: "", accountNumber: "" });

  const load = useCallback(async () => {
    const response = await fetch(`/api/transactions/${transactionId}`);
    if (!response.ok) {
      setMessage("Transaksi tidak dapat dibaca");
      return;
    }
    const result = await response.json() as TransactionData;
    setData(result);
    if (result.state === "WAITING_BUYER_PAYMENT") {
      const paymentResponse = await fetch(`/api/transactions/${transactionId}/payment-status`);
      setPayment(paymentResponse.ok ? await paymentResponse.json() as PaymentData : null);
    } else {
      setPayment(null);
    }
    if (result.currentRole) setRole(result.currentRole);
  }, [transactionId]);

  useEffect(() => { void load(); }, [load]);

  async function createPaymentLink() {
    if (!data) return;
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/transactions/${transactionId}/payment-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ expectedStateVersion: data.stateVersion })
    });
    const result = await response.json() as PaymentData & { message?: string };
    setBusy(false);
    if (!response.ok) {
      setMessage(result.message ?? "Payment link belum tersedia. Coba lagi.");
      return;
    }
    setPayment(result);
    await load();
  }

  async function refreshPaymentStatus() {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/transactions/${transactionId}/payment-status`, { cache: "no-store" });
    setBusy(false);
    if (!response.ok) {
      setMessage("Status pembayaran belum tersedia. Coba lagi.");
      return;
    }
    setPayment(await response.json() as PaymentData);
  }

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function saveRoleData() {
    if (!data) return;
    setBusy(true);
    setMessage("");
    const body = role === "BUYER"
      ? { role, shipping: { recipientName: form.recipientName, addressLine: form.addressLine, district: form.district, city: form.city, province: form.province, postalCode: form.postalCode }, refund: { bankName: form.bankName, accountHolderName: form.accountHolderName, accountNumber: form.accountNumber } }
      : { role, payout: { bankName: form.bankName, accountHolderName: form.accountHolderName, accountNumber: form.accountNumber } };
    const response = await fetch(`/api/transactions/${transactionId}/role-data`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ ...body, expectedStateVersion: data.stateVersion })
    });
    const result = await response.json() as { message?: string };
    setBusy(false);
    if (!response.ok) {
      setMessage(result.message ?? "Data belum tersimpan");
      return;
    }
    await load();
  }

  return (
    <main className="app-shell">
      <section className="surface" aria-labelledby="status-title">
        <p className="eyebrow">Status transaksi</p>
        <h1 id="status-title">{data?.item?.itemName ?? "Memuat..."}</h1>
        {data && (
          <>
            <p className="status-line">Status: <strong>{data.state}</strong></p>
            <p className="muted">{data.participants.length}/2 participant sudah terikat.</p>
            <ul className="participant-list">
              {data.participants.map((participant) => <li key={participant.role}><strong>{participant.role}</strong> · {participant.name} · {participant.joined ? "sudah bergabung" : "menunggu"}</li>)}
            </ul>

            {data.currentRole && data.state === "WAITING_COUNTERPARTY_DATA" && (
              <div className="role-data-panel">
                <p className="section-label">Lengkapi data {role}</p>
                {role === "BUYER" && <>
                  <label>Nama penerima<input value={form.recipientName} onChange={(event) => update("recipientName", event.target.value)} /></label>
                  <label>Alamat<input value={form.addressLine} onChange={(event) => update("addressLine", event.target.value)} /></label>
                  <label>Kecamatan<input value={form.district} onChange={(event) => update("district", event.target.value)} /></label>
                  <label>Kota<input value={form.city} onChange={(event) => update("city", event.target.value)} /></label>
                  <label>Provinsi<input value={form.province} onChange={(event) => update("province", event.target.value)} /></label>
                  <label>Kode pos<input inputMode="numeric" value={form.postalCode} onChange={(event) => update("postalCode", event.target.value)} /></label>
                </>}
                <label>Bank<input value={form.bankName} onChange={(event) => update("bankName", event.target.value)} /></label>
                <label>Nama pemilik rekening<input value={form.accountHolderName} onChange={(event) => update("accountHolderName", event.target.value)} /></label>
                <label>Nomor rekening<input inputMode="numeric" value={form.accountNumber} onChange={(event) => update("accountNumber", event.target.value)} /></label>
                <button type="button" onClick={saveRoleData} disabled={busy}>{busy ? "Menyimpan..." : "Simpan data"}</button>
              </div>
            )}

            {data.readyForPaymentInstructions && data.state === "WAITING_COUNTERPARTY_DATA" && (
              <div className="payment-panel" aria-labelledby="payment-title">
                <p className="section-label" id="payment-title">Invoice pembayaran</p>
                <p className="muted">Data transaksi sudah dibekukan. Buat payment link Midtrans untuk membuka halaman pembayaran hosted.</p>
                <button type="button" onClick={createPaymentLink} disabled={busy}>
                  {busy ? "Menyiapkan invoice..." : "Buat payment link"}
                </button>
              </div>
            )}
            {data.state === "WAITING_BUYER_PAYMENT" && payment && (
              <div className="payment-panel" aria-labelledby="payment-status-title">
                <p className="section-label" id="payment-status-title">Pembayaran Midtrans</p>
                <p className="status-line">Status provider: <strong>{payment.providerStatus ?? "PENDING"}</strong></p>
                <p className="muted">Total: {new Intl.NumberFormat("id-ID", { style: "currency", currency: payment.currency }).format(payment.amount)}</p>
                <p className="muted">Batas pembayaran: {payment.deadlineWib}</p>
                <div className="payment-actions">
                  {payment.hostedPaymentUrl && <a className="button-link" href={payment.hostedPaymentUrl} target="_blank" rel="noreferrer">Buka halaman pembayaran</a>}
                  <button type="button" className="secondary-button" onClick={refreshPaymentStatus} disabled={busy}>{busy ? "Memuat..." : "Cek status pembayaran"}</button>
                </div>
                <p className="muted">Status pembayaran menjadi authoritative setelah rekonsiliasi Midtrans pada tahap berikutnya.</p>
              </div>
            )}
            {message && <p className="form-error" role="alert">{message}</p>}
          </>
        )}
      </section>
    </main>
  );
}
