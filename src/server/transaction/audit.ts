import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { auditEvents } from "@/server/db/schema";
import type { TransactionState } from "@/server/domain/transaction/state";

type AuditDatabase = {
  insert: typeof import("@/server/db").db.insert;
};

export async function recordTransactionEvent(
  database: AuditDatabase,
  input: {
    transactionId?: string;
    actorAccountId?: string;
    eventType: string;
    beforeState?: TransactionState;
    afterState?: TransactionState;
    stateVersion?: number;
    correlationId?: string;
    evidenceReference?: string;
    payload?: Record<string, unknown>;
  }
): Promise<void> {
  await database.insert(auditEvents).values({
    transactionId: input.transactionId,
    actorAccountId: input.actorAccountId,
    eventType: input.eventType,
    beforeState: input.beforeState,
    afterState: input.afterState,
    stateVersion: input.stateVersion,
    correlationId: input.correlationId ?? randomUUID(),
    evidenceReference: input.evidenceReference,
    payload: input.payload
  });
}

const sanitizedRejectionPayload = (input: Record<string, unknown> = {}) => ({
  reason: typeof input.reason === "string" ? input.reason : "MUTATION_REJECTED"
});

export async function recordRejectedMutationEvent(input: {
  transactionId?: string;
  actorAccountId?: string;
  eventType: string;
  correlationId: string;
  reason?: string;
}): Promise<void> {
  await recordTransactionEvent(db, {
    transactionId: input.transactionId,
    actorAccountId: input.actorAccountId,
    eventType: input.eventType,
    correlationId: input.correlationId,
    payload: sanitizedRejectionPayload({ reason: input.reason })
  });
}
