import { NextResponse } from "next/server";
import { requireAuthenticatedAccount } from "@/server/auth/authorization";
import { cancellationRequestSchema } from "@/server/cancellation/contracts";
import { cancellationHttpStatus } from "@/server/cancellation/http";
import {
  readParticipantCancellation,
  requestCancellation
} from "@/server/cancellation/service";
import { requireIdempotencyKey } from "@/server/transaction/mutation";
import { hashRequest } from "@/server/validation/mutation";

export async function GET(_: Request, context: { params: { id: string } }) {
  try {
    const { account } = await requireAuthenticatedAccount();
    return NextResponse.json(await readParticipantCancellation(context.params.id, account.id));
  } catch (error) {
    return NextResponse.json(
      { message: "Status pembatalan tidak dapat diakses." },
      { status: cancellationHttpStatus(error) }
    );
  }
}

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const { account } = await requireAuthenticatedAccount();
    const key = requireIdempotencyKey(request.headers.get("Idempotency-Key"));
    const body = cancellationRequestSchema.parse(await request.json());
    return NextResponse.json(await requestCancellation(account, context.params.id, body, {
      key,
      requestHash: hashRequest(body)
    }));
  } catch (error) {
    return NextResponse.json(
      { message: "Permintaan pembatalan belum dapat diproses." },
      { status: cancellationHttpStatus(error) }
    );
  }
}
