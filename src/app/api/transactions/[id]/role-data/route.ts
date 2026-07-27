import { NextResponse } from "next/server";
import { requireAuthenticatedAccount } from "@/server/auth/authorization";
import { roleDataSchema } from "@/server/transaction/contracts";
import { requireIdempotencyKey } from "@/server/transaction/mutation";
import { saveRoleData } from "@/server/transaction/service";
import { hashRequest } from "@/server/validation/mutation";

export async function GET(_request: Request, context: { params: { id: string } }) {
  try {
    const { account } = await requireAuthenticatedAccount();
    const { readTransaction } = await import("@/server/transaction/read");
    return NextResponse.json(await readTransaction(context.params.id, account.id));
  } catch {
    return NextResponse.json({ message: "Data transaksi tidak dapat dibaca" }, { status: 404 });
  }
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    const { account } = await requireAuthenticatedAccount();
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const parsed = roleDataSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ message: "Data role belum valid" }, { status: 400 });
    const key = requireIdempotencyKey(request.headers.get("Idempotency-Key"));
    const result = await saveRoleData(account, context.params.id, parsed.data, typeof body?.expectedStateVersion === "number" ? body.expectedStateVersion : undefined, { key, requestHash: hashRequest({ transactionId: context.params.id, body }) });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Data role belum dapat disimpan";
    const status = message === "UNAUTHENTICATED" ? 401 : message.includes("OWNED") || message.includes("PARTICIPATION") ? 403 : message.includes("Idempotency") ? 409 : 400;
    return NextResponse.json({ message: status === 401 ? "Sesi tidak ditemukan" : status === 403 ? "Data ini bukan milik role kamu" : "Data role belum dapat disimpan" }, { status });
  }
}
