import { NextResponse } from "next/server";
import { requireAdminAccount } from "@/server/auth/authorization";
import { requireIdempotencyKey } from "@/server/transaction/mutation";
import { hashRequest } from "@/server/validation/mutation";
import { confirmationLinkCreateSchema } from "@/server/confirmation/contracts";
import { createConfirmationLink } from "@/server/confirmation/service";

function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "UNAUTHENTICATED") return 401;
  if (message === "FORBIDDEN") return 403;
  if (message === "TRANSACTION_NOT_FOUND") return 404;
  if (message.includes("STATE_VERSION") || message.includes("IDEMPOTENCY") || message.includes("UNIQUE")) return 409;
  return 400;
}

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const { account } = await requireAdminAccount();
    const body = confirmationLinkCreateSchema.parse(await request.json());
    const key = requireIdempotencyKey(request.headers.get("Idempotency-Key"));
    const result = await createConfirmationLink(account, context.params.id, body.expectedStateVersion, { key, requestHash: hashRequest(body) });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = statusFor(error);
    return NextResponse.json({ message: status === 401 ? "Sesi tidak ditemukan" : status === 403 ? "Akses Admin diperlukan" : "Link konfirmasi belum dapat dibuat" }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
