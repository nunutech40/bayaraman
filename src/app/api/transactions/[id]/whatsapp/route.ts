import { NextResponse } from "next/server";
import { requireAuthenticatedAccount } from "@/server/auth/authorization";
import { readWhatsAppSummary } from "@/server/operations/whatsapp";

export async function GET(_request: Request, context: { params: { id: string } }) {
  try {
    const { account } = await requireAuthenticatedAccount();
    return NextResponse.json(await readWhatsAppSummary(context.params.id, account.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "UNAUTHENTICATED" ? 401 : message === "TRANSACTION_FORBIDDEN" ? 403 : 404;
    return NextResponse.json({ message: status === 401 ? "Sesi tidak ditemukan" : "Ringkasan transaksi tidak ditemukan" }, { status });
  }
}
