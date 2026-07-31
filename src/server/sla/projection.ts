import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  adminTaskAssignments,
  notifications,
  slaTrackers,
  transactions
} from "@/server/db/schema";
import { formatWib } from "@/server/domain/time/wib";
import { slaQuerySchema } from "./contracts";

type Admin = { id: string; isAdmin: boolean };

export async function requireSlaNotificationAssignment(
  database: any,
  admin: Admin
): Promise<void> {
  if (!admin.isAdmin) throw new Error("FORBIDDEN");
  const [assignment] = await database.select({ id: adminTaskAssignments.id })
    .from(adminTaskAssignments)
    .where(and(
      eq(adminTaskAssignments.accountId, admin.id),
      eq(adminTaskAssignments.taskScope, "SLA_NOTIFICATION_REVIEW"),
      isNull(adminTaskAssignments.revokedAt)
    )).limit(1);
  if (!assignment) throw new Error("SLA_NOTIFICATION_ASSIGNMENT_REQUIRED");
}

function domainTypes(domain?: string) {
  if (domain === "PAYMENT") return ["PAYMENT_RECONCILIATION"];
  if (domain === "CONFIRMATION") return ["CONFIRMATION_REMINDER", "CONFIRMATION_OVERDUE"];
  if (domain === "CANCELLATION") return ["CANCELLATION_RECONCILIATION", "CANCELLATION_RESPONSE"];
  if (domain === "FINANCIAL") return ["PAYOUT", "REFUND", "SPLIT"];
  return undefined;
}

export async function readSlaTasks(
  admin: Admin,
  unsafeQuery: Record<string, unknown>,
  now = new Date()
) {
  await requireSlaNotificationAssignment(db, admin);
  const query = slaQuerySchema.parse(unsafeQuery);
  const types = domainTypes(query.domain);
  const conditions = [
    types ? inArray(slaTrackers.slaType, types) : undefined,
    query.cursor ? lt(slaTrackers.id, query.cursor) : undefined,
    query.status === "OPEN" ? isNull(slaTrackers.handledAt) : undefined,
    query.status === "OVERDUE" ? and(
      isNull(slaTrackers.handledAt),
      sql`${slaTrackers.targetAt} <= ${now}`
    ) : undefined
  ];
  const rows = await db.select({
    tracker: slaTrackers,
    transactionState: transactions.state
  }).from(slaTrackers)
    .innerJoin(transactions, eq(transactions.id, slaTrackers.transactionId))
    .where(and(...conditions))
    .orderBy(sql`${slaTrackers.targetAt} ASC`, sql`${slaTrackers.id} ASC`)
    .limit(query.limit);

  const items = [];
  for (const row of rows) {
    const [failure] = await db.select({
      finalFailureAt: notifications.finalFailureAt,
      attemptCount: notifications.attemptCount
    }).from(notifications).where(and(
      eq(notifications.transactionId, row.tracker.transactionId),
      sql`${notifications.finalFailureAt} IS NOT NULL`
    )).limit(1);
    if (query.status === "FINAL_NOTIFICATION_FAILURE" && !failure) continue;
    items.push({
      trackerId: row.tracker.id,
      transactionId: row.tracker.transactionId,
      domain: row.tracker.slaType,
      sourceType: row.tracker.sourceType,
      targetAt: row.tracker.targetAt.toISOString(),
      targetAtWib: formatWib(row.tracker.targetAt),
      nextEscalationAt: row.tracker.nextEscalationAt.toISOString(),
      nextEscalationAtWib: formatWib(row.tracker.nextEscalationAt),
      escalationCount: row.tracker.escalationCount,
      handledAt: row.tracker.handledAt?.toISOString() ?? null,
      transactionState: row.transactionState,
      finalNotificationFailure: failure ? {
        at: failure.finalFailureAt?.toISOString() ?? null,
        attempts: failure.attemptCount
      } : null,
      recoveryRoute: `/api/admin/transactions/${row.tracker.transactionId}`
    });
  }
  return {
    items,
    nextCursor: items.length === query.limit ? items.at(-1)?.trackerId ?? null : null,
    evaluatedAt: now.toISOString()
  };
}
