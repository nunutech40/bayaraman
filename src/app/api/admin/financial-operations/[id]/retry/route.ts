import { NextResponse } from "next/server";
import { requireAdminAccount } from "@/server/auth/authorization";
import { financialRetrySchema } from "@/server/finance/contracts";
import { financialHttpStatus } from "@/server/finance/http";
import { retryFinancialOperation } from "@/server/finance/service";
import { requireIdempotencyKey } from "@/server/transaction/mutation";
import { hashRequest } from "@/server/validation/mutation";

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const { account } = await requireAdminAccount();
    const key = requireIdempotencyKey(request.headers.get("Idempotency-Key"));
    const body = financialRetrySchema.parse(await request.json());
    return NextResponse.json(await retryFinancialOperation(
      account,
      context.params.id,
      body.expectedOperationVersion,
      { key, requestHash: hashRequest(body) }
    ));
  } catch (error) {
    return NextResponse.json(
      { message: "Retry belum dapat dibuat." },
      { status: financialHttpStatus(error) }
    );
  }
}
