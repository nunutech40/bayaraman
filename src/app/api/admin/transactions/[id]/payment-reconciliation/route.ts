import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAccount } from "@/server/auth/authorization";
import { requireIdempotencyKey } from "@/server/transaction/mutation";
import { hashRequest } from "@/server/validation/mutation";
import {
  readPaymentReconciliation,
  reconcileMidtransStatus
} from "@/server/payment/reconciliation";

const bodySchema = z.object({
  expectedStateVersion: z.number().int().nonnegative().optional()
}).default({});

function statusFor(error: unknown): number {
  const code = error instanceof Error ? error.message : "";
  if (code === "UNAUTHENTICATED") return 401;
  if (code === "FORBIDDEN") return 403;
  if (code === "TRANSACTION_NOT_FOUND") return 404;
  if (code === "STATE_VERSION_CONFLICT" || code === "IDEMPOTENCY_CONFLICT" || error instanceof Error && error.name === "IdempotencyConflictError") return 409;
  if (code === "PROVIDER_STATUS_UNKNOWN" || code === "PAYMENT_PROVIDER_UNAVAILABLE") return 502;
  return 400;
}

export async function GET(
  _request: Request,
  context: { params: { id: string } }
) {
  try {
    await requireAdminAccount();
    return NextResponse.json(await readPaymentReconciliation(context.params.id));
  } catch (error) {
    return NextResponse.json({ message: "Data rekonsiliasi belum dapat dibaca" }, { status: statusFor(error) });
  }
}

export async function POST(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const { account } = await requireAdminAccount();
    const key = requireIdempotencyKey(request.headers.get("Idempotency-Key"));
    const body = bodySchema.parse(await request.json().catch(() => ({})));
    const result = await reconcileMidtransStatus(
      account.id,
      context.params.id,
      body.expectedStateVersion,
      { key, requestHash: hashRequest(body) }
    );
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const status = statusFor(error);
    return NextResponse.json({ message: status === 401 ? "Sesi tidak ditemukan" : status === 403 ? "Akses Admin diperlukan" : "Rekonsiliasi belum dapat diproses" }, { status });
  }
}
