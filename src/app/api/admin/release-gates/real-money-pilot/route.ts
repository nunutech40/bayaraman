import { NextResponse } from "next/server";
import { requireAdminAccount } from "@/server/auth/authorization";
import { riskHttpStatus } from "@/server/risk/http";
import { readReleaseGate } from "@/server/release-gate/service";

export async function GET() {
  try {
    const { account } = await requireAdminAccount();
    return NextResponse.json(await readReleaseGate(account));
  } catch (error) {
    return NextResponse.json({ message: "Release gate tidak dapat diakses." }, { status: riskHttpStatus(error) });
  }
}
