import { NextResponse } from "next/server";
import { requireAdminAccount } from "@/server/auth/authorization";
import { financialHttpStatus } from "@/server/finance/http";
import { readFinancialOperation } from "@/server/finance/service";

export async function GET(_: Request, context: { params: { id: string } }) {
  try {
    const { account } = await requireAdminAccount();
    return NextResponse.json(await readFinancialOperation(account, context.params.id));
  } catch (error) {
    return NextResponse.json(
      { message: "Detail operasi finansial tidak dapat diakses." },
      { status: financialHttpStatus(error) }
    );
  }
}
