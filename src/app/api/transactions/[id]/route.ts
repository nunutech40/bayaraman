import { NextResponse } from "next/server";
import { requireAuthenticatedAccount } from "@/server/auth/authorization";
import { readTransaction } from "@/server/transaction/read";

export async function GET(_request: Request, context: { params: { id: string } }) {
  try {
    const { account } = await requireAuthenticatedAccount();
    return NextResponse.json(await readTransaction(context.params.id, account.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transaksi tidak ditemukan";
    const status = message === "UNAUTHENTICATED" ? 401 : message === "TRANSACTION_FORBIDDEN" ? 403 : 404;
    return NextResponse.json({ message: status === 401 ? "Sesi tidak ditemukan" : "Transaksi tidak ditemukan" }, { status });
  }
}
