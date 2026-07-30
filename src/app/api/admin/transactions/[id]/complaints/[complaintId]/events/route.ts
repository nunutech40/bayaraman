import { NextResponse } from "next/server";
import { requireAdminAccount } from "@/server/auth/authorization";
import { complaintCorrectionSchema } from "@/server/complaint/contracts";
import { correctComplaintEvidence } from "@/server/complaint/service";
import { requireIdempotencyKey } from "@/server/transaction/mutation";
import { hashRequest } from "@/server/validation/mutation";

export async function POST(request: Request, context: { params: { id: string; complaintId: string } }) {
  try {
    const { account } = await requireAdminAccount();
    const key = requireIdempotencyKey(request.headers.get("Idempotency-Key"));
    const body = complaintCorrectionSchema.parse(await request.json());
    return NextResponse.json(await correctComplaintEvidence(
      account, context.params.id, context.params.complaintId, body,
      { key, requestHash: hashRequest(body) }
    ));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "UNAUTHENTICATED" ? 401 : message === "FORBIDDEN" || message.includes("ASSIGNMENT") ? 403 : message.includes("CONFLICT") || message.includes("TARGET") ? 409 : 400;
    return NextResponse.json({ message: "Koreksi evidence belum dapat dicatat." }, { status });
  }
}

