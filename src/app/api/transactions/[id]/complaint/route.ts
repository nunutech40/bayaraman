import { NextResponse } from "next/server";
import { requireAuthenticatedAccount } from "@/server/auth/authorization";
import { readParticipantComplaint } from "@/server/complaint/service";

export async function GET(_: Request, context: { params: { id: string } }) {
  try {
    const { account } = await requireAuthenticatedAccount();
    return NextResponse.json(await readParticipantComplaint(context.params.id, account.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "UNAUTHENTICATED" ? 401 : message === "TRANSACTION_FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ message: "Status complaint tidak dapat diakses." }, { status });
  }
}

