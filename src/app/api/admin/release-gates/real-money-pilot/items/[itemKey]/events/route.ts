import { NextResponse } from "next/server";
import { requireAdminAccount } from "@/server/auth/authorization";
import { releaseGateEvidenceSchema, releaseGateItemKeySchema } from "@/server/release-gate/contracts";
import { recordReleaseGateEvidence } from "@/server/release-gate/service";
import { riskHttpStatus } from "@/server/risk/http";
import { requireIdempotencyKey } from "@/server/transaction/mutation";
import { hashRequest } from "@/server/validation/mutation";

export async function POST(request: Request, context: { params: { itemKey: string } }) {
  try {
    const { account } = await requireAdminAccount();
    const key = requireIdempotencyKey(request.headers.get("Idempotency-Key"));
    const itemKey = releaseGateItemKeySchema.parse(context.params.itemKey);
    const body = releaseGateEvidenceSchema.parse(await request.json());
    return NextResponse.json(await recordReleaseGateEvidence(account, itemKey, body, {
      key, requestHash: hashRequest(body)
    }));
  } catch (error) {
    return NextResponse.json({ message: "Evidence release gate belum dapat dicatat." }, { status: riskHttpStatus(error) });
  }
}
