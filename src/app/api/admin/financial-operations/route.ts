import { NextResponse } from "next/server";
import { requireAdminAccount } from "@/server/auth/authorization";
import { financialPrepareSchema } from "@/server/finance/contracts";
import { financialHttpStatus } from "@/server/finance/http";
import {
  prepareFinancialOperation,
  readTransactionFinancialOperations
} from "@/server/finance/service";
import { requireIdempotencyKey } from "@/server/transaction/mutation";
import { hashRequest } from "@/server/validation/mutation";

export async function GET(request: Request) {
  try {
    const { account } = await requireAdminAccount();
    const transactionId = new URL(request.url).searchParams.get("transactionId");
    if (!transactionId) throw new Error("TRANSACTION_ID_REQUIRED");
    return NextResponse.json(await readTransactionFinancialOperations(account, transactionId));
  } catch (error) {
    return NextResponse.json(
      { message: "Operasi finansial tidak dapat diakses." },
      { status: financialHttpStatus(error) }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { account } = await requireAdminAccount();
    const key = requireIdempotencyKey(request.headers.get("Idempotency-Key"));
    const body = financialPrepareSchema.parse(await request.json());
    return NextResponse.json(await prepareFinancialOperation(account, body, {
      key,
      requestHash: hashRequest(body)
    }));
  } catch (error) {
    return NextResponse.json(
      { message: "Operasi finansial belum dapat disiapkan." },
      { status: financialHttpStatus(error) }
    );
  }
}
