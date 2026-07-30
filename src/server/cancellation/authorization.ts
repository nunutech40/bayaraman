import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  accounts,
  adminTaskAssignments,
  transactionParticipants
} from "@/server/db/schema";

export type CancellationAssignment =
  | "CANCELLATION_RECONCILIATION"
  | "CANCELLATION_EVIDENCE"
  | "CANCELLATION_APPROVAL"
  | "COMPLAINT_INTAKE"
  | "RISK_INTAKE";

export async function requireCancellationAssignment(
  tx: any,
  admin: { id: string; isAdmin: boolean },
  scope: CancellationAssignment
) {
  if (!admin.isAdmin) throw new Error("FORBIDDEN");
  const [assignment] = await tx.select({ id: adminTaskAssignments.id })
    .from(adminTaskAssignments)
    .innerJoin(accounts, eq(adminTaskAssignments.accountId, accounts.id))
    .where(and(
      eq(adminTaskAssignments.accountId, admin.id),
      eq(adminTaskAssignments.taskScope, scope),
      isNull(adminTaskAssignments.revokedAt),
      eq(accounts.isAdmin, true)
    )).limit(1);
  if (!assignment) throw new Error("CANCELLATION_ASSIGNMENT_REQUIRED");
}

export async function requireAnyCancellationAssignment(
  tx: any,
  admin: { id: string; isAdmin: boolean }
) {
  if (!admin.isAdmin) throw new Error("FORBIDDEN");
  const [assignment] = await tx.select({ id: adminTaskAssignments.id })
    .from(adminTaskAssignments)
    .innerJoin(accounts, eq(adminTaskAssignments.accountId, accounts.id))
    .where(and(
      eq(adminTaskAssignments.accountId, admin.id),
      inArray(adminTaskAssignments.taskScope, [
        "CANCELLATION_RECONCILIATION",
        "CANCELLATION_EVIDENCE",
        "CANCELLATION_APPROVAL",
        "COMPLAINT_INTAKE",
        "RISK_INTAKE"
      ]),
      isNull(adminTaskAssignments.revokedAt),
      eq(accounts.isAdmin, true)
    )).limit(1);
  if (!assignment) throw new Error("CANCELLATION_ASSIGNMENT_REQUIRED");
}

export async function requireParticipant(
  tx: any,
  transactionId: string,
  account: { id: string; whatsappVerifiedAt: Date | null }
) {
  if (!account.whatsappVerifiedAt) throw new Error("WHATSAPP_VERIFICATION_REQUIRED");
  const [participant] = await tx.select().from(transactionParticipants).where(and(
    eq(transactionParticipants.transactionId, transactionId),
    eq(transactionParticipants.accountId, account.id)
  )).limit(1);
  if (!participant) throw new Error("TRANSACTION_FORBIDDEN");
  return participant;
}
