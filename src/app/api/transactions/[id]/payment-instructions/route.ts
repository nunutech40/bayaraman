import { NextResponse } from "next/server";
import { requireAuthenticatedAccount } from "@/server/auth/authorization";
import { readPaymentInstructions } from "@/server/payment/payment";

export async function GET(_request: Request, context: { params: { id: string } }) {
  try {
    const { account } = await requireAuthenticatedAccount();
    return NextResponse.json(await readPaymentInstructions(context.params.id, account.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment instructions tidak tersedia";
    const status = message === "UNAUTHENTICATED" ? 401 : message === "TRANSACTION_FORBIDDEN" ? 403 : 404;
    return NextResponse.json({ message: status === 401 ? "Sesi tidak ditemukan" : status === 403 ? "Akses transaksi ditolak" : "Payment instructions belum tersedia" }, { status });
  }
}
