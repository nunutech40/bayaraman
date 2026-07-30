import { NextResponse } from "next/server";
import { requireAdminAccount } from "@/server/auth/authorization";
import { cancellationHandoffSchema } from "@/server/cancellation/contracts";
import { handoffCancellationToRisk } from "@/server/cancellation/delegation";
import { cancellationHttpStatus } from "@/server/cancellation/http";
import { requireIdempotencyKey } from "@/server/transaction/mutation";
import { hashRequest } from "@/server/validation/mutation";

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const { account } = await requireAdminAccount();
    const key = requireIdempotencyKey(request.headers.get("Idempotency-Key"));
    const body = cancellationHandoffSchema.parse(await request.json());
    return NextResponse.json(await handoffCancellationToRisk(
      account,
      context.params.id,
      body,
      { key, requestHash: hashRequest(body) }
    ));
  } catch (error) {
    return NextResponse.json(
      { message: "Handoff risk belum dapat diproses." },
      { status: cancellationHttpStatus(error) }
    );
  }
}
