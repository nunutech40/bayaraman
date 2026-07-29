import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ingestMidtransWebhook } from "@/server/payment/provider-webhook";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Webhook tidak valid" }, { status: 400 });
  }

  try {
    const result = await ingestMidtransWebhook(body);
    return NextResponse.json({
      accepted: true,
      eventId: result.eventId,
      result: result.kind
    }, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: "Webhook tidak valid" }, { status: 400 });
    }
    return NextResponse.json({ message: "Webhook akan diproses ulang" }, { status: 503 });
  }
}
