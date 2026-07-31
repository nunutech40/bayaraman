import { NextResponse } from "next/server";
import { requireAdminAccount } from "@/server/auth/authorization";
import { readSlaTasks } from "@/server/sla/projection";

function statusFor(error: unknown): number {
  const code = error instanceof Error ? error.message : "";
  if (code === "UNAUTHENTICATED") return 401;
  if (code === "FORBIDDEN" || code === "SLA_NOTIFICATION_ASSIGNMENT_REQUIRED") return 403;
  return 400;
}

export async function GET(request: Request) {
  try {
    const { account } = await requireAdminAccount();
    const url = new URL(request.url);
    return NextResponse.json(await readSlaTasks(account, {
      domain: url.searchParams.get("domain") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined
    }));
  } catch (error) {
    const status = statusFor(error);
    return NextResponse.json({
      message: status === 403
        ? "Assignment review SLA diperlukan."
        : "Tugas SLA belum dapat dimuat."
    }, { status });
  }
}
