import { NextResponse } from "next/server";
import { requireAdminAccount } from "@/server/auth/authorization";
import { requireIdempotencyKey } from "@/server/transaction/mutation";
import { hashRequest } from "@/server/validation/mutation";
import { confirmationExceptionSchema } from "@/server/confirmation/contracts";
import { recordConfirmationException } from "@/server/confirmation/service";

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const { account } = await requireAdminAccount();
    const body = confirmationExceptionSchema.parse(await request.json());
    const key = requireIdempotencyKey(request.headers.get("Idempotency-Key"));
    return NextResponse.json(await recordConfirmationException(account, context.params.id, body, { key, requestHash: hashRequest(body) }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "UNAUTHENTICATED" ? 401 : message === "FORBIDDEN" ? 403 : message.includes("STATE_VERSION") || message.includes("EXCEPTION") ? 409 : 400;
    return NextResponse.json({ message: status === 401 ? "Sesi tidak ditemukan" : status === 403 ? "Akses Admin diperlukan" : "Exception belum dapat dicatat" }, { status });
  }
}
