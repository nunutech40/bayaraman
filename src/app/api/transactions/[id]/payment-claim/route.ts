import { NextResponse } from "next/server";
import { requireAuthenticatedAccount } from "@/server/auth/authorization";
import { requireIdempotencyKey } from "@/server/transaction/mutation";
import { hashRequest } from "@/server/validation/mutation";
import { submitPaymentClaim } from "@/server/payment/payment";
import { z } from "zod";

const claimSchema = z.object({
  expectedStateVersion: z.number().int().nonnegative().optional(),
  note: z.string().trim().max(500).optional()
});

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const { account } = await requireAuthenticatedAccount();
    const body = await request.json().catch(() => ({}));
    const parsed = claimSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ message: "Data klaim belum valid" }, { status: 400 });
    const key = requireIdempotencyKey(request.headers.get("Idempotency-Key"));
    const result = await submitPaymentClaim(account, context.params.id, parsed.data.expectedStateVersion, parsed.data.note, {
      key,
      requestHash: hashRequest({ transactionId: context.params.id, body: parsed.data })
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Klaim pembayaran belum dapat dikirim";
    const status = message === "UNAUTHENTICATED" ? 401 : message.includes("BUYER_ONLY") || message.includes("PARTICIPATION") ? 403 : message.includes("DEADLINE") || message.includes("CONFLICT") || message.includes("Idempotency") ? 409 : 400;
    return NextResponse.json({ message: status === 401 ? "Sesi tidak ditemukan" : status === 403 ? "Hanya buyer yang dapat mengirim klaim" : status === 409 ? "Klaim tidak dapat diproses pada status saat ini" : "Klaim pembayaran belum dapat dikirim" }, { status });
  }
}
