import { NextResponse } from "next/server";
import { requireAdminAccount } from "@/server/auth/authorization";
import { proposeCancellationCalculation } from "@/server/cancellation/calculation";
import { cancellationCalculationSchema } from "@/server/cancellation/contracts";
import { cancellationHttpStatus } from "@/server/cancellation/http";
import { requireIdempotencyKey } from "@/server/transaction/mutation";
import { hashRequest } from "@/server/validation/mutation";

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const { account } = await requireAdminAccount();
    const key = requireIdempotencyKey(request.headers.get("Idempotency-Key"));
    const body = cancellationCalculationSchema.parse(await request.json());
    return NextResponse.json(await proposeCancellationCalculation(account, context.params.id, body, {
      key,
      requestHash: hashRequest(body)
    }));
  } catch (error) {
    return NextResponse.json(
      { message: "Perhitungan refund belum dapat dibuat." },
      { status: cancellationHttpStatus(error) }
    );
  }
}
