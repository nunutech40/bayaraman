import { NextResponse } from "next/server";
import { requireAuthenticatedAccount } from "@/server/auth/authorization";
import { readBuyerConfirmation } from "@/server/confirmation/service";

export async function GET(_request: Request, context: { params: { token: string } }) {
  try {
    const { account } = await requireAuthenticatedAccount();
    return NextResponse.json(await readBuyerConfirmation(account.id, context.params.token), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "UNAUTHENTICATED" ? 401 : message === "CONFIRMATION_FORBIDDEN" ? 403 : message === "TRANSACTION_NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ message: "Link konfirmasi tidak tersedia" }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
