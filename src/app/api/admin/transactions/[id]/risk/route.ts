import { NextResponse } from "next/server";
import { requireAdminAccount } from "@/server/auth/authorization";
import { riskIntakeSchema } from "@/server/risk/contracts";
import { riskHttpStatus } from "@/server/risk/http";
import { readAdminRisks, recordRisk } from "@/server/risk/service";
import { requireIdempotencyKey } from "@/server/transaction/mutation";
import { hashRequest } from "@/server/validation/mutation";

export async function GET(_: Request, context: { params: { id: string } }) {
  try {
    const { account } = await requireAdminAccount();
    return NextResponse.json(await readAdminRisks(account, context.params.id));
  } catch (error) {
    return NextResponse.json({ message: "Data risk hold tidak dapat diakses." }, { status: riskHttpStatus(error) });
  }
}

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const { account } = await requireAdminAccount();
    const key = requireIdempotencyKey(request.headers.get("Idempotency-Key"));
    const body = riskIntakeSchema.parse(await request.json());
    return NextResponse.json(await recordRisk(account, context.params.id, body, {
      key, requestHash: hashRequest(body)
    }));
  } catch (error) {
    return NextResponse.json({ message: "Risk hold belum dapat dicatat." }, { status: riskHttpStatus(error) });
  }
}
