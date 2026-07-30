import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAccount } from "@/server/auth/authorization";
import { requireCancellationAssignment } from "@/server/cancellation/authorization";
import { cancellationHttpStatus } from "@/server/cancellation/http";
import { db } from "@/server/db";
import { reconcileMidtransStatus } from "@/server/payment/reconciliation";
import { requireIdempotencyKey } from "@/server/transaction/mutation";
import { hashRequest } from "@/server/validation/mutation";

const schema = z.object({ expectedStateVersion: z.number().int().nonnegative() });

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const { account } = await requireAdminAccount();
    await db.transaction((tx) =>
      requireCancellationAssignment(tx, account, "CANCELLATION_RECONCILIATION")
    );
    const key = requireIdempotencyKey(request.headers.get("Idempotency-Key"));
    const body = schema.parse(await request.json());
    return NextResponse.json(await reconcileMidtransStatus(
      account.id,
      context.params.id,
      body.expectedStateVersion,
      { key, requestHash: hashRequest(body) },
      undefined,
      "ADMIN_RECOVERY"
    ));
  } catch (error) {
    return NextResponse.json(
      { message: "Rekonsiliasi pembatalan belum dapat diproses." },
      { status: cancellationHttpStatus(error) }
    );
  }
}
