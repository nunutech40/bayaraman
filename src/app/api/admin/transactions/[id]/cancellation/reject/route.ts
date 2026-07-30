import { NextResponse } from "next/server";
import { requireAdminAccount } from "@/server/auth/authorization";
import { cancellationDecisionSchema } from "@/server/cancellation/contracts";
import { cancellationHttpStatus } from "@/server/cancellation/http";
import { rejectCancellation } from "@/server/cancellation/service";
import { requireIdempotencyKey } from "@/server/transaction/mutation";
import { hashRequest } from "@/server/validation/mutation";

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const { account } = await requireAdminAccount();
    const key = requireIdempotencyKey(request.headers.get("Idempotency-Key"));
    const body = cancellationDecisionSchema.parse(await request.json());
    return NextResponse.json(await rejectCancellation(account, context.params.id, body, {
      key,
      requestHash: hashRequest(body)
    }));
  } catch (error) {
    return NextResponse.json(
      { message: "Permintaan pembatalan tidak dapat ditolak." },
      { status: cancellationHttpStatus(error) }
    );
  }
}
