import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAuthenticatedAccount } from "@/server/auth/authorization";
import { db } from "@/server/db";
import { invitations } from "@/server/db/schema";
import { joinInvitation } from "@/server/transaction/service";
import { requireIdempotencyKey } from "@/server/transaction/mutation";
import { hashInvitationToken } from "@/server/transaction/token";
import { hashRequest } from "@/server/validation/mutation";

export async function POST(request: Request, context: { params: { token: string } }) {
  try {
    const { account } = await requireAuthenticatedAccount();
    const body = await request.json().catch(() => ({})) as { expectedStateVersion?: unknown };
    const [invitation] = await db.select({ id: invitations.id }).from(invitations).where(eq(invitations.tokenHash, hashInvitationToken(context.params.token))).limit(1);
    if (!invitation) return NextResponse.json({ message: "Invitation tidak valid atau sudah kedaluwarsa" }, { status: 404 });
    const key = requireIdempotencyKey(request.headers.get("Idempotency-Key"));
    const result = await joinInvitation(account, invitation.id, typeof body.expectedStateVersion === "number" ? body.expectedStateVersion : undefined, { key, requestHash: hashRequest({ token: context.params.token, body }) });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Join belum dapat dilakukan";
    const status = message === "UNAUTHENTICATED" ? 401 : message.includes("SELF_JOIN") || message.includes("PARTICIPATION") ? 403 : message.includes("IDEMPOTENCY") ? 409 : 400;
    return NextResponse.json({ message: status === 401 ? "Sesi tidak ditemukan" : status === 403 ? "Akun ini tidak dapat bergabung" : "Invitation tidak dapat digunakan" }, { status });
  }
}
