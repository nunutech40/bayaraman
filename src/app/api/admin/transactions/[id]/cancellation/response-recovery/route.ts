import { NextResponse } from "next/server";
import { requireAdminAccount } from "@/server/auth/authorization";
import { cancellationResponseRecoverySchema } from "@/server/cancellation/contracts";
import { cancellationHttpStatus } from "@/server/cancellation/http";
import { recoverCancellationResponse } from "@/server/cancellation/response-recovery";
import { requireIdempotencyKey } from "@/server/transaction/mutation";
import { hashRequest } from "@/server/validation/mutation";

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const { account } = await requireAdminAccount();
    const key = requireIdempotencyKey(request.headers.get("Idempotency-Key"));
    const body = cancellationResponseRecoverySchema.parse(await request.json());
    return NextResponse.json(await recoverCancellationResponse(
      account,
      context.params.id,
      body,
      { key, requestHash: hashRequest(body) }
    ));
  } catch (error) {
    return NextResponse.json(
      { message: "Recovery respons pembatalan belum dapat diproses." },
      { status: cancellationHttpStatus(error) }
    );
  }
}
