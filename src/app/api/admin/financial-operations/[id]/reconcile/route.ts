import { NextResponse } from "next/server";
import { requireAdminAccount } from "@/server/auth/authorization";
import { financialReconcileSchema } from "@/server/finance/contracts";
import { financialHttpStatus } from "@/server/finance/http";
import { reconcileFinancialOperation } from "@/server/finance/service";
import { requireIdempotencyKey } from "@/server/transaction/mutation";
import { hashRequest } from "@/server/validation/mutation";

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const { account } = await requireAdminAccount();
    const key = requireIdempotencyKey(request.headers.get("Idempotency-Key"));
    const body = financialReconcileSchema.parse(await request.json());
    return NextResponse.json(await reconcileFinancialOperation(
      account,
      context.params.id,
      body,
      { key, requestHash: hashRequest(body) }
    ));
  } catch (error) {
    return NextResponse.json(
      { message: "Rekonsiliasi belum dapat diselesaikan." },
      { status: financialHttpStatus(error) }
    );
  }
}
