import { NextResponse } from "next/server";
import { requireAdminAccount } from "@/server/auth/authorization";
import { financialExecuteSchema } from "@/server/finance/contracts";
import { financialHttpStatus } from "@/server/finance/http";
import { executeFinancialOperation } from "@/server/finance/service";
import { requireIdempotencyKey } from "@/server/transaction/mutation";
import { hashRequest } from "@/server/validation/mutation";

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const { account, session } = await requireAdminAccount();
    const key = requireIdempotencyKey(request.headers.get("Idempotency-Key"));
    const body = financialExecuteSchema.parse(await request.json());
    return NextResponse.json(await executeFinancialOperation(
      account,
      session.sessionId,
      context.params.id,
      body.expectedOperationVersion,
      { key, requestHash: hashRequest(body) }
    ));
  } catch (error) {
    return NextResponse.json(
      { message: "Payout belum dapat dijalankan." },
      { status: financialHttpStatus(error) }
    );
  }
}
