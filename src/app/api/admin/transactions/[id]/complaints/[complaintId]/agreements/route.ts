import { NextResponse } from "next/server";
import { requireAdminAccount } from "@/server/auth/authorization";
import { complaintAgreementSchema } from "@/server/complaint/contracts";
import { proposeComplaintAgreement } from "@/server/complaint/service";
import { requireIdempotencyKey } from "@/server/transaction/mutation";
import { hashRequest } from "@/server/validation/mutation";

export async function POST(request: Request, context: { params: { id: string; complaintId: string } }) {
  try {
    const { account } = await requireAdminAccount();
    const key = requireIdempotencyKey(request.headers.get("Idempotency-Key"));
    const body = complaintAgreementSchema.parse(await request.json());
    return NextResponse.json(await proposeComplaintAgreement(
      account, context.params.id, context.params.complaintId, body,
      { key, requestHash: hashRequest(body) }
    ));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "UNAUTHENTICATED" ? 401 : message === "FORBIDDEN" || message.includes("ASSIGNMENT") ? 403 : message.includes("VERSION") || message.includes("ACTIVE") ? 409 : 400;
    return NextResponse.json({ message: "Kesepakatan belum dapat diajukan." }, { status });
  }
}

