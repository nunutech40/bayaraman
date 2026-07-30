import { and, eq, inArray, isNull } from "drizzle-orm";
import { adminTaskAssignments } from "@/server/db/schema";

export type FinancialScope =
  | "FINANCIAL_PREPARE"
  | "FINANCIAL_APPROVE"
  | "FINANCIAL_EXECUTE"
  | "FINANCIAL_RECONCILE";

export async function requireFinancialAssignment(
  database: any,
  admin: { id: string; isAdmin: boolean },
  scope: FinancialScope
): Promise<void> {
  if (!admin.isAdmin) throw new Error("FORBIDDEN");
  const [assignment] = await database.select({ id: adminTaskAssignments.id })
    .from(adminTaskAssignments)
    .where(and(
      eq(adminTaskAssignments.accountId, admin.id),
      eq(adminTaskAssignments.taskScope, scope),
      isNull(adminTaskAssignments.revokedAt)
    )).limit(1);
  if (!assignment) throw new Error("FINANCIAL_ASSIGNMENT_REQUIRED");
}

export async function requireAnyFinancialAssignment(
  database: any,
  admin: { id: string; isAdmin: boolean }
): Promise<void> {
  if (!admin.isAdmin) throw new Error("FORBIDDEN");
  const [assignment] = await database.select({ id: adminTaskAssignments.id })
    .from(adminTaskAssignments)
    .where(and(
      eq(adminTaskAssignments.accountId, admin.id),
      inArray(adminTaskAssignments.taskScope, [
        "FINANCIAL_PREPARE",
        "FINANCIAL_APPROVE",
        "FINANCIAL_EXECUTE",
        "FINANCIAL_RECONCILE"
      ]),
      isNull(adminTaskAssignments.revokedAt)
    )).limit(1);
  if (!assignment) throw new Error("FINANCIAL_ASSIGNMENT_REQUIRED");
}
