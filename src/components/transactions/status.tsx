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
  state: string;
  stateVersion: number;
  amount: number;
  destinationBank: string;
  destinationAccount: string;
  deadlineWib: string;
  claim: { id: string; submittedAt: string } | null;
};

function rupiah(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}

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
    if (result.currentRole) setRole(result.currentRole);
    if (["WAITING_BUYER_PAYMENT", "PAYMENT_UNDER_REVIEW", "PAYMENT_EXPIRED"].includes(result.state)) {
      const paymentResponse = await fetch(`/api/transactions/${transactionId}/payment-instructions`);
      if (paymentResponse.ok) setPayment(await paymentResponse.json() as PaymentData);
    }
  }, [transactionId]);

  useEffect(() => { void load(); }, [load]);

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

  async function submitClaim() {
    if (!data || !payment) return;
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/transactions/${transactionId}/payment-claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ expectedStateVersion: payment.stateVersion })
    });
    const result = await response.json() as { message?: string };
    setBusy(false);
    if (!response.ok) {
      setMessage(result.message ?? "Klaim belum dapat dikirim");
      await load();
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

            {payment && <section className="payment-panel" aria-labelledby="payment-title">
              <p className="section-label">Payment instructions</p>
              <h2 id="payment-title">Transfer manual ke rekening BayarAman</h2>
              <dl className="payment-summary">
                <div><dt>Total pembayaran</dt><dd>{rupiah(payment.amount)}</dd></div>
                <div><dt>Bank</dt><dd>{payment.destinationBank}</dd></div>
                <div><dt>Nomor rekening</dt><dd>{payment.destinationAccount}</dd></div>
                <div><dt>Batas pembayaran</dt><dd>{payment.deadlineWib}</dd></div>
              </dl>
              {data.currentRole === "BUYER" && data.state === "WAITING_BUYER_PAYMENT" && !payment.claim && <button type="button" onClick={submitClaim} disabled={busy}>{busy ? "Mengirim..." : "Sudah Bayar"}</button>}
              {payment.claim && <p className="success-message">Klaim sudah dikirim. Admin sedang memeriksa pembayaran.</p>}
              {data.state === "PAYMENT_EXPIRED" && <p className="form-error">Batas pembayaran sudah berakhir.</p>}
              <p className="muted payment-help">Klik Sudah Bayar hanya mengirim klaim untuk diperiksa. Status pembayaran belum dikonfirmasi oleh sistem.</p>
              <button className="secondary-button" type="button" disabled aria-disabled="true">Pembatalan tersedia pada tahap berikutnya</button>
            </section>}

            {data.readyForPaymentInstructions && !payment && <p className="success-message">Data lengkap. Payment instructions sedang disiapkan.</p>}
            {message && <p className="form-error" role="alert">{message}</p>}
          </>
        )}
      </section>
    </main>
  );
}
