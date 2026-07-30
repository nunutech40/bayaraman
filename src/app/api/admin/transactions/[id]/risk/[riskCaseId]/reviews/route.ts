import { NextResponse } from "next/server";
import { requireAdminAccount } from "@/server/auth/authorization";
import { riskReviewSchema } from "@/server/risk/contracts";
import { riskHttpStatus } from "@/server/risk/http";
import { proposeRiskReview } from "@/server/risk/service";
import { requireIdempotencyKey } from "@/server/transaction/mutation";
import { hashRequest } from "@/server/validation/mutation";

export async function POST(request: Request, context: { params: { id: string; riskCaseId: string } }) {
  try {
    const { account } = await requireAdminAccount();
    const key = requireIdempotencyKey(request.headers.get("Idempotency-Key"));
    const body = riskReviewSchema.parse(await request.json());
    return NextResponse.json(await proposeRiskReview(
      account, context.params.id, context.params.riskCaseId, body,
      { key, requestHash: hashRequest(body) }
    ));
  } catch (error) {
    return NextResponse.json({ message: "Review risk belum dapat diajukan." }, { status: riskHttpStatus(error) });
  }
}
