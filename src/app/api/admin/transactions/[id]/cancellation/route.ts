import { NextResponse } from "next/server";
import { requireAdminAccount } from "@/server/auth/authorization";
import { cancellationHttpStatus } from "@/server/cancellation/http";
import { readAdminCancellation } from "@/server/cancellation/service";

export async function GET(_: Request, context: { params: { id: string } }) {
  try {
    const { account } = await requireAdminAccount();
    return NextResponse.json(await readAdminCancellation(account, context.params.id));
  } catch (error) {
    return NextResponse.json(
      { message: "Data pembatalan tidak dapat diakses." },
      { status: cancellationHttpStatus(error) }
    );
  }
}
