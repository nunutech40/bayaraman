import { NextResponse } from "next/server";
import { requireAdminAccount } from "@/server/auth/authorization";
import { financialReauthSchema } from "@/server/finance/contracts";
import { financialHttpStatus } from "@/server/finance/http";
import { reauthenticateFinancialOperation } from "@/server/finance/service";
import { requireIdempotencyKey } from "@/server/transaction/mutation";
import { hashRequest } from "@/server/validation/mutation";

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const { account, session } = await requireAdminAccount();
    const key = requireIdempotencyKey(request.headers.get("Idempotency-Key"));
    const body = financialReauthSchema.parse(await request.json());
    const result = await reauthenticateFinancialOperation(
      account,
      session.sessionId,
      context.params.id,
      body.password,
      body.expectedOperationVersion,
      { key, requestHash: hashRequest(body) }
    );
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return NextResponse.json(
      { message: "Re-authentication gagal." },
      { status: financialHttpStatus(error) }
    );
  }
}
