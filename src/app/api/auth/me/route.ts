import { NextResponse } from "next/server";
import { requireAuthenticatedAccount } from "@/server/auth/authorization";

export async function GET() {
  try {
    const { account } = await requireAuthenticatedAccount();
    return NextResponse.json({
      accountId: account.id,
      displayName: account.displayName,
      whatsappNumber: account.whatsappNumber,
      whatsappVerified: account.whatsappVerifiedAt !== null,
      isAdmin: account.isAdmin
    });
  } catch {
    return NextResponse.json({ message: "Sesi tidak ditemukan" }, { status: 401 });
  }
}
