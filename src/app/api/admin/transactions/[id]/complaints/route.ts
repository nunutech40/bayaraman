import { NextResponse } from "next/server";
import { requireAdminAccount } from "@/server/auth/authorization";
import { complaintIntakeSchema } from "@/server/complaint/contracts";
import { readAdminComplaints, recordComplaint } from "@/server/complaint/service";
import { requireIdempotencyKey } from "@/server/transaction/mutation";
import { hashRequest } from "@/server/validation/mutation";

function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "UNAUTHENTICATED") return 401;
  if (message === "FORBIDDEN" || message.includes("ASSIGNMENT")) return 403;
  if (message === "TRANSACTION_NOT_FOUND") return 404;
  if (message.includes("VERSION") || message.includes("ACTIVE") || message.includes("IDEMPOTENCY")) return 409;
  return 400;
}

export async function GET(_: Request, context: { params: { id: string } }) {
  try {
    const { account } = await requireAdminAccount();
    return NextResponse.json(await readAdminComplaints(account, context.params.id));
  } catch (error) {
    return NextResponse.json({ message: "Data complaint tidak dapat diakses." }, { status: statusFor(error) });
  }
}

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const { account } = await requireAdminAccount();
    const key = requireIdempotencyKey(request.headers.get("Idempotency-Key"));
    const body = complaintIntakeSchema.parse(await request.json());
    return NextResponse.json(await recordComplaint(account, context.params.id, body, {
      key, requestHash: hashRequest(body)
    }));
  } catch (error) {
    return NextResponse.json({ message: "Complaint belum dapat dicatat." }, { status: statusFor(error) });
  }
}

