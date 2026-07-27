import { NextResponse } from "next/server";
import { recordAuthEvent } from "@/server/auth/audit";
import { getCurrentSession, clearSessionCookie } from "@/server/auth/cookies";

export async function POST() {
  const session = await getCurrentSession();
  clearSessionCookie();
  if (session) {
    await recordAuthEvent("ACCOUNT_LOGGED_OUT", session.accountId, { outcome: "SUCCESS" });
  }
  return NextResponse.json({ ok: true });
}
