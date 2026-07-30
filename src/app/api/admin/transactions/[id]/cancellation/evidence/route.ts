import { NextResponse } from "next/server";
import { requireAdminAccount } from "@/server/auth/authorization";
import { cancellationEvidenceSchema } from "@/server/cancellation/contracts";
import { recordCancellationEvidence } from "@/server/cancellation/evidence";
import { cancellationHttpStatus } from "@/server/cancellation/http";
import { requireIdempotencyKey } from "@/server/transaction/mutation";
import { hashRequest } from "@/server/validation/mutation";

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const { account } = await requireAdminAccount();
    const key = requireIdempotencyKey(request.headers.get("Idempotency-Key"));
    const body = cancellationEvidenceSchema.parse(await request.json());
    return NextResponse.json(await recordCancellationEvidence(account, context.params.id, body, {
      key,
      requestHash: hashRequest(body)
    }));
  } catch (error) {
    return NextResponse.json(
      { message: "Bukti pembatalan belum dapat dicatat." },
      { status: cancellationHttpStatus(error) }
    );
  }
}
