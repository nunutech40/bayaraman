import { NextResponse } from "next/server";
import { requireAdminAccount } from "@/server/auth/authorization";
import { riskCorrectionSchema } from "@/server/risk/contracts";
import { riskHttpStatus } from "@/server/risk/http";
import { correctRiskEvidence } from "@/server/risk/service";
import { requireIdempotencyKey } from "@/server/transaction/mutation";
import { hashRequest } from "@/server/validation/mutation";

export async function POST(request: Request, context: { params: { id: string; riskCaseId: string } }) {
  try {
    const { account } = await requireAdminAccount();
    const key = requireIdempotencyKey(request.headers.get("Idempotency-Key"));
    const body = riskCorrectionSchema.parse(await request.json());
    return NextResponse.json(await correctRiskEvidence(
      account, context.params.id, context.params.riskCaseId, body,
      { key, requestHash: hashRequest(body) }
    ));
  } catch (error) {
    return NextResponse.json({ message: "Evidence risk belum dapat dikoreksi." }, { status: riskHttpStatus(error) });
  }
}
