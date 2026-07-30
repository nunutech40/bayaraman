import { NextResponse } from "next/server";
import { requireAdminAccount } from "@/server/auth/authorization";
import { releaseGateEvaluationSchema } from "@/server/release-gate/contracts";
import { evaluateReleaseGate } from "@/server/release-gate/service";
import { riskHttpStatus } from "@/server/risk/http";
import { requireIdempotencyKey } from "@/server/transaction/mutation";
import { hashRequest } from "@/server/validation/mutation";

export async function POST(request: Request) {
  try {
    const { account } = await requireAdminAccount();
    const key = requireIdempotencyKey(request.headers.get("Idempotency-Key"));
    const body = releaseGateEvaluationSchema.parse(await request.json());
    return NextResponse.json(await evaluateReleaseGate(account, body, {
      key, requestHash: hashRequest(body)
    }));
  } catch (error) {
    return NextResponse.json({ message: "Release gate belum dapat dievaluasi." }, { status: riskHttpStatus(error) });
  }
}
