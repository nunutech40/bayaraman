import { NextResponse } from "next/server";
import { accountInputSchema } from "@/server/auth/account-schema";
import { recordAuthEvent } from "@/server/auth/audit";
import { registerAccount } from "@/server/auth/account-service";
import { setSessionCookie } from "@/server/auth/cookies";

export async function POST(request: Request) {
  const parsed = accountInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "Data akun belum valid" }, { status: 400 });
  }

  try {
    const account = await registerAccount(parsed.data);
    await setSessionCookie({
      accountId: account.id,
      sessionId: crypto.randomUUID(),
      productRole: null
    });
    await recordAuthEvent("ACCOUNT_REGISTERED", account.id, { outcome: "SUCCESS" });
    return NextResponse.json({ accountId: account.id, whatsappVerified: false }, { status: 201 });
  } catch {
    return NextResponse.json({ message: "Akun tidak dapat dibuat" }, { status: 409 });
  }
}
