import { NextResponse } from "next/server";
import { requireAuthenticatedAccount } from "@/server/auth/authorization";
import { riskHttpStatus } from "@/server/risk/http";
import { readParticipantRisk } from "@/server/risk/service";

export async function GET(_: Request, context: { params: { id: string } }) {
  try {
    const { account } = await requireAuthenticatedAccount();
    return NextResponse.json(await readParticipantRisk(context.params.id, account.id));
  } catch (error) {
    return NextResponse.json({ message: "Status review tidak dapat diakses." }, { status: riskHttpStatus(error) });
  }
}
