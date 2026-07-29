import { NextResponse } from "next/server";
import { requireAdminAccount } from "@/server/auth/authorization";
import { requireIdempotencyKey } from "@/server/transaction/mutation";
import { hashRequest } from "@/server/validation/mutation";
import { whatsappCheckpointInputSchema } from "@/server/operations/contracts";
import { recordWhatsAppCheckpoint } from "@/server/operations/whatsapp";

function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "UNAUTHENTICATED") return 401;
  if (message === "FORBIDDEN") return 403;
  if (message === "TRANSACTION_NOT_FOUND") return 404;
  if (message.includes("STATE_VERSION") || message.includes("IDEMPOTENCY") || message.includes("ALREADY") || message.includes("CORRECTION")) return 409;
  return 400;
}

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const { account } = await requireAdminAccount();
    const key = requireIdempotencyKey(request.headers.get("Idempotency-Key"));
    const body = whatsappCheckpointInputSchema.parse(await request.json());
    return NextResponse.json(await recordWhatsAppCheckpoint(account.id, context.params.id, body, { key, requestHash: hashRequest(body) }));
  } catch (error) {
    const status = statusFor(error);
    return NextResponse.json({ message: status === 401 ? "Sesi tidak ditemukan" : status === 403 ? "Akses Admin diperlukan" : "Checkpoint WhatsApp belum dapat dicatat" }, { status });
  }
}
