import { NextResponse } from "next/server";
import { requireAdminAccount } from "@/server/auth/authorization";
import { riskDecisionSchema } from "@/server/risk/contracts";
import { riskHttpStatus } from "@/server/risk/http";
import { decideRiskReview } from "@/server/risk/service";
import { requireIdempotencyKey } from "@/server/transaction/mutation";
import { hashRequest } from "@/server/validation/mutation";

export async function POST(request: Request, context: { params: { id: string; riskCaseId: string; reviewId: string } }) {
  try {
    const { account } = await requireAdminAccount();
    const key = requireIdempotencyKey(request.headers.get("Idempotency-Key"));
    const body = riskDecisionSchema.parse(await request.json());
    return NextResponse.json(await decideRiskReview(
      account, context.params.id, context.params.riskCaseId,
      context.params.reviewId, body,
      { key, requestHash: hashRequest(body) }
    ));
  } catch (error) {
    return NextResponse.json({ message: "Keputusan risk belum dapat dicatat." }, { status: riskHttpStatus(error) });
  }
}
