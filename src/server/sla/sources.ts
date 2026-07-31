import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  auditEvents,
  cancellationReconciliations,
  cancellationRequests,
  confirmationLinks,
  financialOperationApprovals,
  financialOperations,
  paymentReconciliations
} from "@/server/db/schema";
import { addOperatingMinutesWib } from "@/server/domain/time/operating-hours";
import { upsertSlaSource, type SlaSource } from "./repository";

const HOUR_MS = 60 * 60 * 1000;

async function paymentSources(): Promise<SlaSource[]> {
  const rows = await db.select().from(paymentReconciliations);
  return rows.map((row) => ({
    transactionId: row.transactionId,
    slaType: "PAYMENT_RECONCILIATION",
    sourceType: "PAYMENT_RECONCILIATION",
    sourceId: row.id,
    sourceTimestampKind: "CANONICAL",
    startedAt: row.createdAt,
    targetAt: addOperatingMinutesWib(row.createdAt, 120),
    handledAt: row.completedAt
  }));
}

async function confirmationSources(): Promise<SlaSource[]> {
  const rows = await db.select().from(confirmationLinks);
  return rows.flatMap((row): SlaSource[] => [
    {
      transactionId: row.transactionId,
      slaType: "CONFIRMATION_REMINDER",
      sourceType: "CONFIRMATION_LINK",
      sourceId: row.id,
      sourceTimestampKind: "CANONICAL",
      startedAt: row.createdAt,
      targetAt: row.reminderDueAt,
      handledAt: row.reminderRecordedAt
    },
    {
      transactionId: row.transactionId,
      slaType: "CONFIRMATION_OVERDUE",
      sourceType: "CONFIRMATION_LINK",
      sourceId: row.id,
      sourceTimestampKind: "CANONICAL",
      startedAt: row.createdAt,
      targetAt: row.expiresAt,
      handledAt: row.usedAt ?? row.overdueAt
    }
  ]);
}

async function cancellationSources(): Promise<SlaSource[]> {
  const reconciliations = await db.select({
    id: cancellationReconciliations.id,
    transactionId: cancellationRequests.transactionId,
    startedAt: cancellationReconciliations.createdAt,
    targetAt: cancellationReconciliations.deadlineAt,
    handledAt: cancellationReconciliations.completedAt
  }).from(cancellationReconciliations).innerJoin(
    cancellationRequests,
    eq(cancellationRequests.id, cancellationReconciliations.cancellationRequestId)
  );
  const requests = await db.select().from(cancellationRequests);
  return [
    ...reconciliations.map((row): SlaSource => ({
      transactionId: row.transactionId,
      slaType: "CANCELLATION_RECONCILIATION",
      sourceType: "CANCELLATION_RECONCILIATION",
      sourceId: row.id,
      sourceTimestampKind: "CANONICAL",
      startedAt: row.startedAt,
      targetAt: row.targetAt,
      handledAt: row.handledAt
    })),
    ...requests.flatMap((row): SlaSource[] => row.responseDeadlineAt ? [{
      transactionId: row.transactionId,
      slaType: "CANCELLATION_RESPONSE",
      sourceType: "CANCELLATION_REQUEST",
      sourceId: row.id,
      sourceTimestampKind: "CANONICAL",
      startedAt: row.createdAt,
      targetAt: row.responseDeadlineAt,
      handledAt: row.resolvedAt
    }] : [])
  ];
}

async function financialSources(): Promise<SlaSource[]> {
  const operations = await db.select().from(financialOperations)
    .orderBy(asc(financialOperations.createdAt));
  const byRoot = new Map<string, typeof operations>();
  for (const operation of operations) {
    const rootId = operation.rootOperationId ?? operation.id;
    const group = byRoot.get(rootId) ?? [];
    group.push(operation);
    byRoot.set(rootId, group);
  }

  const sources: SlaSource[] = [];
  for (const [rootId, group] of byRoot) {
    const root = group.find((item) => item.id === rootId) ?? group[0];
    if (!root) continue;
    let startedAt: Date | undefined;
    let timestampKind: "CANONICAL" | "LEGACY_FALLBACK" = "CANONICAL";
    if (root.type === "PAYOUT") {
      const [eligibleAudit] = await db.select({ createdAt: auditEvents.createdAt })
        .from(auditEvents)
        .where(sql`${auditEvents.transactionId} = ${root.transactionId}
          AND ${auditEvents.afterState} = 'READY_FOR_PAYOUT'`)
        .orderBy(asc(auditEvents.createdAt), asc(auditEvents.id)).limit(1);
      startedAt = eligibleAudit?.createdAt;
    } else {
      const approvals = await db.select({
        adminAccountId: financialOperationApprovals.adminAccountId,
        createdAt: financialOperationApprovals.createdAt
      }).from(financialOperationApprovals)
        .where(sql`${financialOperationApprovals.operationId} = ${rootId}
          AND ${financialOperationApprovals.decision} = 'APPROVED'`)
        .orderBy(asc(financialOperationApprovals.createdAt), asc(financialOperationApprovals.id));
      const distinct = approvals.filter((approval, index, all) =>
        all.findIndex((item) => item.adminAccountId === approval.adminAccountId) === index
      );
      startedAt = distinct[1]?.createdAt;
    }
    if (!startedAt) {
      startedAt = root.preparedAt;
      timestampKind = "LEGACY_FALLBACK";
    }
    const success = (type: typeof root.type) => group.some((item) =>
      item.type === type &&
      item.result === "SUCCESS" &&
      Boolean(item.bankReference?.trim()) &&
      Boolean(item.evidenceHash?.trim())
    );
    const isSplit = root.type === "SPLIT_BUYER" || root.type === "SPLIT_SELLER";
    const handled = isSplit
      ? success("SPLIT_BUYER") && success("SPLIT_SELLER")
      : success(root.type);
    const completedCandidates = group
      .filter((item) => item.result === "SUCCESS" && item.completedAt)
      .map((item) => item.completedAt as Date);
    const handledAt = handled && completedCandidates.length
      ? new Date(Math.max(...completedCandidates.map((value) => value.getTime())))
      : null;
    const slaType = root.type === "PAYOUT" ? "PAYOUT" : isSplit ? "SPLIT" : "REFUND";
    sources.push({
      transactionId: root.transactionId,
      slaType,
      sourceType: "FINANCIAL_OPERATION_ROOT",
      sourceId: rootId,
      sourceTimestampKind: timestampKind,
      startedAt,
      targetAt: new Date(startedAt.getTime() + (slaType === "PAYOUT" ? 24 : 48) * HOUR_MS),
      handledAt
    });
  }
  return sources;
}

export async function synchronizeSlaSources(now = new Date()) {
  const all = [
    ...await paymentSources(),
    ...await confirmationSources(),
    ...await cancellationSources(),
    ...await financialSources()
  ];
  let createdOrUpdated = 0;
  for (const source of all) {
    await db.transaction((tx) => upsertSlaSource(tx, source, now));
    createdOrUpdated += 1;
  }
  return { evaluated: all.length, createdOrUpdated };
}
