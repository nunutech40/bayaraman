import { NextResponse } from "next/server";
import { requireAuthenticatedAccount } from "@/server/auth/authorization";
import { requireIdempotencyKey } from "@/server/transaction/mutation";
import { hashRequest } from "@/server/validation/mutation";
import { confirmationOtpRequestSchema } from "@/server/confirmation/contracts";
import { requestConfirmationOtp } from "@/server/confirmation/service";

export async function POST(request: Request, context: { params: { token: string } }) {
  try {
    const { account } = await requireAuthenticatedAccount();
    const body = confirmationOtpRequestSchema.parse(await request.json().catch(() => ({})));
    const key = requireIdempotencyKey(request.headers.get("Idempotency-Key"));
    return NextResponse.json(await requestConfirmationOtp(account.id, context.params.token, { key, requestHash: hashRequest(body) }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "UNAUTHENTICATED" ? 401 : message === "CONFIRMATION_FORBIDDEN" ? 403 : message.includes("COOLDOWN") || message.includes("SEND_LIMIT") ? 429 : 400;
    return NextResponse.json({ message: status === 429 ? "Tunggu sebelum meminta OTP lagi" : "OTP belum dapat diminta" }, { status });
  }
}
