import { NextResponse } from "next/server";
import { requireAuthenticatedAccount } from "@/server/auth/authorization";
import { requireIdempotencyKey } from "@/server/transaction/mutation";
import { hashRequest } from "@/server/validation/mutation";
import { confirmationOtpVerifySchema } from "@/server/confirmation/contracts";
import { verifyConfirmationOtp } from "@/server/confirmation/service";

export async function POST(request: Request, context: { params: { token: string } }) {
  try {
    const { account } = await requireAuthenticatedAccount();
    const body = confirmationOtpVerifySchema.parse(await request.json());
    const key = requireIdempotencyKey(request.headers.get("Idempotency-Key"));
    return NextResponse.json(await verifyConfirmationOtp(account.id, context.params.token, body, { key, requestHash: hashRequest(body) }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "UNAUTHENTICATED" ? 401 : message === "CONFIRMATION_FORBIDDEN" ? 403 : message.includes("STATE_VERSION") ? 409 : 400;
    return NextResponse.json({ message: status === 401 ? "Sesi tidak ditemukan" : "Kode OTP tidak valid atau sudah kedaluwarsa" }, { status });
  }
}
