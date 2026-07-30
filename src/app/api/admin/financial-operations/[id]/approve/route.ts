import { NextResponse } from "next/server";
import { requireAdminAccount } from "@/server/auth/authorization";
import { financialApprovalSchema } from "@/server/finance/contracts";
import { financialHttpStatus } from "@/server/finance/http";
import { approveFinancialOperation } from "@/server/finance/service";
import { requireIdempotencyKey } from "@/server/transaction/mutation";
import { hashRequest } from "@/server/validation/mutation";

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const { account } = await requireAdminAccount();
    const key = requireIdempotencyKey(request.headers.get("Idempotency-Key"));
    const body = financialApprovalSchema.parse(await request.json());
    return NextResponse.json(await approveFinancialOperation(account, context.params.id, body, {
      key,
      requestHash: hashRequest(body)
    }));
  } catch (error) {
    return NextResponse.json(
      { message: "Approval finansial belum dapat dicatat." },
      { status: financialHttpStatus(error) }
    );
  }
}
