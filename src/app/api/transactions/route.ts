import { NextResponse } from "next/server";
import { requireAuthenticatedAccount } from "@/server/auth/authorization";
import { createTransactionSchema } from "@/server/transaction/contracts";
import { createTransaction } from "@/server/transaction/service";
import { hashRequest } from "@/server/validation/mutation";
import { requireIdempotencyKey } from "@/server/transaction/mutation";

export async function POST(request: Request) {
  try {
    const { account } = await requireAuthenticatedAccount();
    const body = await request.json().catch(() => null);
    const parsed = createTransactionSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ message: "Data transaksi belum valid" }, { status: 400 });
    const key = requireIdempotencyKey(request.headers.get("Idempotency-Key"));
    const result = await createTransaction(account, parsed.data, { key, requestHash: hashRequest(parsed.data) });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transaksi belum dapat dibuat";
    const status = message === "UNAUTHENTICATED" ? 401 : message === "IDEMPOTENCY_KEY_REQUIRED" ? 400 : message === "PARTICIPATION_NOT_ALLOWED" ? 403 : message.includes("Idempotency") ? 409 : 400;
    return NextResponse.json({ message: status === 401 ? "Sesi tidak ditemukan" : status === 403 ? "Akun belum memenuhi syarat transaksi" : "Transaksi belum dapat dibuat" }, { status });
  }
}
