import { NextResponse } from "next/server";
import { loginInputSchema } from "@/server/auth/account-schema";
import { recordAuthEvent } from "@/server/auth/audit";
import { authenticateAccount } from "@/server/auth/account-service";
import { setSessionCookie } from "@/server/auth/cookies";

export async function POST(request: Request) {
  const parsed = loginInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "Email atau password tidak valid" }, { status: 401 });
  }

  const account = await authenticateAccount(parsed.data.email, parsed.data.password);
  if (!account) {
    await recordAuthEvent("ACCOUNT_LOGIN_FAILED", undefined, { outcome: "DENIED" });
    return NextResponse.json({ message: "Email atau password tidak valid" }, { status: 401 });
  }

  await setSessionCookie({
    accountId: account.id,
    sessionId: crypto.randomUUID(),
    productRole: null
  });
  await recordAuthEvent("ACCOUNT_LOGIN_SUCCEEDED", account.id, { outcome: "SUCCESS" });
  return NextResponse.json({
    accountId: account.id,
    whatsappVerified: account.whatsappVerifiedAt !== null
  });
}
