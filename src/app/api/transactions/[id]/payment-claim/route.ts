import { NextResponse } from "next/server";
export async function POST(request: Request, context: { params: { id: string } }) {
  return NextResponse.json({ message: "Klaim pembayaran manual sudah tidak digunakan. Gunakan payment link." }, { status: 410 });
}
