import { NextResponse } from "next/server";
import { previewInvitation } from "@/server/transaction/invitation";

export async function GET(_request: Request, context: { params: { token: string } }) {
  try {
    return NextResponse.json(await previewInvitation(context.params.token));
  } catch {
    return NextResponse.json({ message: "Invitation tidak valid atau sudah kedaluwarsa" }, { status: 404 });
  }
}
