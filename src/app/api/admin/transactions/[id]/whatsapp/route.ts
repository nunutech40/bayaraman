import { NextResponse } from "next/server";
import { requireAdminAccount } from "@/server/auth/authorization";
import { requireIdempotencyKey } from "@/server/transaction/mutation";
import { hashRequest } from "@/server/validation/mutation";
import { whatsappGroupInputSchema } from "@/server/operations/contracts";
import { readWhatsAppSummary, recordWhatsAppGroup } from "@/server/operations/whatsapp";

function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "UNAUTHENTICATED") return 401;
  if (message === "FORBIDDEN") return 403;
  if (message === "TRANSACTION_NOT_FOUND") return 404;
  if (message.includes("STATE_VERSION") || message.includes("IDEMPOTENCY") || message.includes("ALREADY")) return 409;
  return 400;
}

export async function GET(_request: Request, context: { params: { id: string } }) {
  try {
    const { account } = await requireAdminAccount();
    return NextResponse.json(await readWhatsAppSummary(context.params.id, account.id, true));
  } catch (error) {
    return NextResponse.json({ message: "Data WhatsApp belum dapat dibaca" }, { status: statusFor(error) });
  }
}

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const { account } = await requireAdminAccount();
    const key = requireIdempotencyKey(request.headers.get("Idempotency-Key"));
    const body = whatsappGroupInputSchema.parse(await request.json());
    return NextResponse.json(await recordWhatsAppGroup(account.id, context.params.id, body, { key, requestHash: hashRequest(body) }));
  } catch (error) {
    const status = statusFor(error);
    return NextResponse.json({ message: status === 401 ? "Sesi tidak ditemukan" : status === 403 ? "Akses Admin diperlukan" : "Group WhatsApp belum dapat dicatat" }, { status });
  }
}
