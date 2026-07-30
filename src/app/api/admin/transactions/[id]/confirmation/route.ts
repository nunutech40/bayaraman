import { NextResponse } from "next/server";
import { requireAdminAccount } from "@/server/auth/authorization";
import { readAdminConfirmation } from "@/server/confirmation/service";

export async function GET(_request: Request, context: { params: { id: string } }) {
  try {
    const { account } = await requireAdminAccount();
    return NextResponse.json(await readAdminConfirmation(context.params.id, account), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "UNAUTHENTICATED" ? 401 : message === "FORBIDDEN" ? 403 : message === "TRANSACTION_NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ message: "Status konfirmasi belum dapat dimuat" }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
