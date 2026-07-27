"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const initial = {
  itemName: "", description: "", category: "", condition: "Baru", quantity: "1",
  photoReference: "", itemPrice: "", shippingCost: "", bankName: "",
  accountHolderName: "", accountNumber: "", recipientName: "", addressLine: "",
  district: "", city: "", province: "", postalCode: ""
};

export function CreateTransaction({ role }: { role: "BUYER" | "SELLER" }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ transactionId: string; invitationToken: string } | null>(null);

  const update = (key: keyof typeof initial, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const body = {
      role,
      itemName: form.itemName,
      description: form.description,
      category: form.category,
      condition: form.condition,
      quantity: Number(form.quantity),
      photoReference: form.photoReference || undefined,
      itemPrice: Number(form.itemPrice),
      shippingCost: Number(form.shippingCost),
      ...(role === "SELLER" ? { payout: { bankName: form.bankName, accountHolderName: form.accountHolderName, accountNumber: form.accountNumber } } : {
        shipping: { recipientName: form.recipientName, addressLine: form.addressLine, district: form.district, city: form.city, province: form.province, postalCode: form.postalCode },
        refund: { bankName: form.bankName, accountHolderName: form.accountHolderName, accountNumber: form.accountNumber }
      })
    };
    const response = await fetch("/api/transactions", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify(body) });
    const result = await response.json() as { message?: string; transactionId?: string; invitationToken?: string };
    setBusy(false);
    if (!response.ok || !result.transactionId || !result.invitationToken) {
      setMessage(result.message ?? "Transaksi belum dapat dibuat");
      return;
    }
    setCreated({ transactionId: result.transactionId, invitationToken: result.invitationToken });
  }

  if (created) {
    const inviteUrl = `${window.location.origin}/invite/${created.invitationToken}`;
    return <main className="app-shell"><section className="surface" aria-labelledby="created-title"><p className="eyebrow">Transaksi dibuat</p><h1 id="created-title">Bagikan invitation</h1><p className="muted">Payment belum tersedia. Counterparty harus bergabung dengan akun berbeda.</p><label>Link invitation<input readOnly value={inviteUrl} /></label><div className="role-actions"><button type="button" onClick={() => navigator.clipboard?.writeText(inviteUrl)}>Salin link</button><button className="secondary-button" type="button" onClick={() => router.push(`/transactions/${created.transactionId}`)}>Lihat status</button></div></section></main>;
  }

  return <main className="app-shell"><section className="surface" aria-labelledby="create-title"><p className="eyebrow">{role === "SELLER" ? "Seller input" : "Buyer input"}</p><h1 id="create-title">Buat transaksi</h1><p className="muted">Isi data yang menjadi tanggung jawab {role === "SELLER" ? "seller" : "buyer"}. Payment belum dibuat pada tahap ini.</p><form className="stack" onSubmit={submit}>
    <label>Nama barang<input required value={form.itemName} onChange={(e) => update("itemName", e.target.value)} /></label>
    <label>Deskripsi<textarea required value={form.description} onChange={(e) => update("description", e.target.value)} /></label>
    <label>Kategori<input required value={form.category} onChange={(e) => update("category", e.target.value)} /></label>
    <label>Kondisi<input required value={form.condition} onChange={(e) => update("condition", e.target.value)} /></label>
    <label>Jumlah<input required type="number" min="1" value={form.quantity} onChange={(e) => update("quantity", e.target.value)} /></label>
    <label>Harga barang<input required type="number" min="100000" max="5000000" value={form.itemPrice} onChange={(e) => update("itemPrice", e.target.value)} /></label>
    <label>Biaya kirim<input required type="number" min="0" value={form.shippingCost} onChange={(e) => update("shippingCost", e.target.value)} /></label>
    {role === "BUYER" && <><label>Nama penerima<input required value={form.recipientName} onChange={(e) => update("recipientName", e.target.value)} /></label><label>Alamat<input required value={form.addressLine} onChange={(e) => update("addressLine", e.target.value)} /></label><label>Kecamatan<input required value={form.district} onChange={(e) => update("district", e.target.value)} /></label><label>Kota<input required value={form.city} onChange={(e) => update("city", e.target.value)} /></label><label>Provinsi<input required value={form.province} onChange={(e) => update("province", e.target.value)} /></label><label>Kode pos<input required inputMode="numeric" pattern="[0-9]{5}" value={form.postalCode} onChange={(e) => update("postalCode", e.target.value)} /></label></>}
    <p className="section-label">{role === "SELLER" ? "Rekening payout seller" : "Rekening refund buyer"}</p><label>Bank<input required value={form.bankName} onChange={(e) => update("bankName", e.target.value)} /></label><label>Nama pemilik rekening<input required value={form.accountHolderName} onChange={(e) => update("accountHolderName", e.target.value)} /></label><label>Nomor rekening<input required inputMode="numeric" value={form.accountNumber} onChange={(e) => update("accountNumber", e.target.value)} /></label>
    {message && <p className="form-error" role="alert">{message}</p>}<button type="submit" disabled={busy}>{busy ? "Menyimpan..." : "Buat transaksi"}</button>
  </form></section></main>;
}
