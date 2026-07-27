import { NextResponse } from "next/server";
import { requireAuthenticatedAccount } from "@/server/auth/authorization";
import { reissueInvitation } from "@/server/transaction/invitation";
import { requireIdempotencyKey } from "@/server/transaction/mutation";
import { hashRequest } from "@/server/validation/mutation";

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const { account } = await requireAuthenticatedAccount();
    const body = await request.json().catch(() => ({})) as { expectedStateVersion?: unknown };
    const key = requireIdempotencyKey(request.headers.get("Idempotency-Key"));
    const result = await reissueInvitation(account, context.params.id, typeof body.expectedStateVersion === "number" ? body.expectedStateVersion : undefined, { key, requestHash: hashRequest({ transactionId: context.params.id, body }) });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invitation belum dapat diterbitkan ulang";
    const status = message === "UNAUTHENTICATED" ? 401 : message.includes("IDEMPOTENCY") ? 409 : 400;
    return NextResponse.json({ message: status === 401 ? "Sesi tidak ditemukan" : "Invitation belum dapat diterbitkan ulang" }, { status });
  }
}
