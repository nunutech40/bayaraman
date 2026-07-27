import { NextResponse } from "next/server";
import { otpVerifySchema } from "@/server/auth/account-schema";
import { recordAuthEvent } from "@/server/auth/audit";
import { requireAuthenticatedAccount } from "@/server/auth/authorization";
import { verifyWhatsappCode } from "@/server/auth/whatsapp-verification";

export async function POST(request: Request) {
  try {
    const { account } = await requireAuthenticatedAccount();
    const body = await request.json().catch(() => null) as { challengeId?: unknown; code?: unknown } | null;
    const parsed = otpVerifySchema.safeParse({ code: body?.code });
    if (!parsed.success || typeof body?.challengeId !== "string") {
      return NextResponse.json({ message: "Kode OTP tidak valid" }, { status: 400 });
    }

    await verifyWhatsappCode(account.id, body.challengeId, parsed.data.code);
    await recordAuthEvent("WHATSAPP_OTP_VERIFIED", account.id, { outcome: "SUCCESS" });
    return NextResponse.json({ verified: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verifikasi gagal";
    const status = message === "UNAUTHENTICATED" ? 401 : 400;
    return NextResponse.json({ message: status === 401 ? "Sesi tidak ditemukan" : "Kode OTP tidak valid atau sudah kedaluwarsa" }, { status });
  }
}
