import { NextResponse } from "next/server";
import { requireAdminAccount } from "@/server/auth/authorization";
import { readAdminComplaint } from "@/server/complaint/service";

export async function GET(_: Request, context: { params: { id: string; complaintId: string } }) {
  try {
    const { account } = await requireAdminAccount();
    return NextResponse.json(await readAdminComplaint(account, context.params.id, context.params.complaintId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "UNAUTHENTICATED"
      ? 401
      : message === "FORBIDDEN" || message.includes("ASSIGNMENT")
        ? 403
        : message.includes("NOT_FOUND")
          ? 404
          : 400;
    return NextResponse.json({ message: "Detail complaint tidak dapat diakses." }, { status });
  }
}
