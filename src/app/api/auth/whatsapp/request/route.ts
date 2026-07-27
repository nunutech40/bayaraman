import { NextResponse } from "next/server";
import { otpRequestSchema } from "@/server/auth/account-schema";
import { recordAuthEvent } from "@/server/auth/audit";
import { requireAuthenticatedAccount } from "@/server/auth/authorization";
import { requestWhatsappVerification } from "@/server/auth/whatsapp-verification";

export async function POST(request: Request) {
  try {
    const { account } = await requireAuthenticatedAccount();
    const parsed = otpRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success || parsed.data.whatsappNumber !== account.whatsappNumber) {
      return NextResponse.json({ message: "Nomor WhatsApp tidak valid" }, { status: 400 });
    }

    const result = await requestWhatsappVerification(account.id, account.whatsappNumber);
    await recordAuthEvent("WHATSAPP_OTP_REQUESTED", account.id, {
      deliveryResult: result.delivery
    });
    return NextResponse.json({
      challengeId: result.challengeId,
      delivery: result.delivery
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tidak dapat mengirim OTP";
    const status = message === "UNAUTHENTICATED" ? 401 : message.includes("cooldown") ? 429 : 400;
    return NextResponse.json({ message: status === 429 ? "Tunggu sebelum meminta OTP lagi" : "OTP belum dapat diminta" }, { status });
  }
}
