import { NextResponse } from "next/server";
import { requireAuthenticatedAccount } from "@/server/auth/authorization";
import { requireIdempotencyKey } from "@/server/transaction/mutation";
import { hashRequest } from "@/server/validation/mutation";
import { ensurePaymentLink } from "@/server/payment/invoice";
import { z } from "zod";

const bodySchema = z.object({
  expectedStateVersion: z.number().int().nonnegative().optional()
});

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const { account } = await requireAuthenticatedAccount();
    const body = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ message: "Permintaan payment link belum valid" }, { status: 400 });
    const key = requireIdempotencyKey(request.headers.get("Idempotency-Key"));
    const result = await ensurePaymentLink(account, context.params.id, parsed.data.expectedStateVersion, {
      key,
      requestHash: hashRequest({ transactionId: context.params.id, body: parsed.data })
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment link belum dapat dibuat";
    const status = message === "UNAUTHENTICATED" ? 401
      : message === "TRANSACTION_FORBIDDEN" || message.includes("PARTICIPATION") ? 403
      : message.includes("CONFLICT") || message.includes("Idempotency") ? 409
      : message.includes("configuration") || message.includes("PROVIDER") || message.includes("TIMEOUT") || message.includes("UNAVAILABLE") ? 502
      : 400;
    return NextResponse.json({
      message: status === 401 ? "Sesi tidak ditemukan" : status === 403 ? "Akses transaksi ditolak" : status === 502 ? "Payment link sedang tidak tersedia" : "Payment link belum dapat dibuat"
    }, { status });
  }
}
