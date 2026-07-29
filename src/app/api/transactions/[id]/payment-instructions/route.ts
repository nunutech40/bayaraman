import { NextResponse } from "next/server";
export async function GET(_request: Request, context: { params: { id: string } }) {
  return NextResponse.json({ message: "Jalur rekening manual sudah tidak digunakan. Gunakan payment link." }, { status: 410 });
}
