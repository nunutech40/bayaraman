import { NextResponse } from "next/server";
import { requireAdminAccount } from "@/server/auth/authorization";
import { decideCancellationCalculation } from "@/server/cancellation/approval";
import { cancellationCalculationDecisionSchema } from "@/server/cancellation/contracts";
import { cancellationHttpStatus } from "@/server/cancellation/http";
import { requireIdempotencyKey } from "@/server/transaction/mutation";
import { hashRequest } from "@/server/validation/mutation";

export async function POST(
  request: Request,
  context: { params: { id: string; calculationId: string } }
) {
  try {
    const { account } = await requireAdminAccount();
    const key = requireIdempotencyKey(request.headers.get("Idempotency-Key"));
    const body = cancellationCalculationDecisionSchema.parse(await request.json());
    return NextResponse.json(await decideCancellationCalculation(
      account,
      context.params.id,
      context.params.calculationId,
      body,
      { key, requestHash: hashRequest(body) }
    ));
  } catch (error) {
    return NextResponse.json(
      { message: "Keputusan refund belum dapat diproses." },
      { status: cancellationHttpStatus(error) }
    );
  }
}
