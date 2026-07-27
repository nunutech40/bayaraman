import type { TransactionState } from "@/server/domain/transaction/state";

export type AuditEventInput = {
  transactionId?: string;
  actorAccountId?: string;
  eventType: string;
  beforeState?: TransactionState;
  afterState?: TransactionState;
  stateVersion?: number;
  correlationId: string;
  evidenceReference?: string;
  payload?: Record<string, unknown>;
};

export type AuditWriter = {
  append: (event: AuditEventInput) => Promise<void>;
};

export function buildAuditEvent(input: AuditEventInput): AuditEventInput {
  return {
    ...input,
    payload: input.payload ? structuredClone(input.payload) : undefined
  };
}
