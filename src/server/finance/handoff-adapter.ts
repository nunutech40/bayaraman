import { and, eq } from "drizzle-orm";
import {
  cancellationFinancialHandoffs,
  complaintFinancialHandoffs,
  riskFinancialHandoffs
} from "@/server/db/schema";
import {
  claimComplaintHandoff,
  readComplaintHandoffForUpdate
} from "@/server/complaint/handoff";
import {
  claimRiskRefundHandoff,
  readRiskRefundHandoffForUpdate
} from "@/server/risk/handoff";
import {
  claimCancellationFinancialHandoff,
  readCancellationFinancialHandoffForUpdate
} from "@/server/cancellation/handoff";

export type FinancialHandoffSource =
  | "COMPLAINT"
  | "RISK"
  | "FUNDED_CANCELLATION"
  | "LATE_FUND";

export type NormalizedFinancialHandoff = {
  handoffId: string;
  transactionId: string;
  sourceType: FinancialHandoffSource;
  outcome: "SELLER_RELEASE" | "BUYER_REFUND" | "SPLIT";
  buyerAmount: number;
  sellerAmount: number;
  currency: "IDR";
  sourceHash: string;
  sourceFinalizedAt: Date;
  sourceState: string;
  sourceStateVersion: number;
  evidenceReference: string;
  evidenceHash: string;
  buyerDestinationBindingId: string | null;
  sellerDestinationBindingId: string | null;
  consumedByOperationId: string | null;
  consumedAt: Date | null;
};

function normalizeComplaint(row: typeof complaintFinancialHandoffs.$inferSelect):
NormalizedFinancialHandoff {
  return {
    handoffId: row.id,
    transactionId: row.transactionId,
    sourceType: "COMPLAINT",
    outcome: row.outcome as NormalizedFinancialHandoff["outcome"],
    buyerAmount: row.buyerAmount,
    sellerAmount: row.sellerAmount,
    currency: "IDR",
    sourceHash: row.calculationHash,
    sourceFinalizedAt: row.approvedAt,
    sourceState: row.sourceState,
    sourceStateVersion: row.sourceStateVersion,
    evidenceReference: row.evidenceReference,
    evidenceHash: row.evidenceHash,
    buyerDestinationBindingId: row.buyerDestinationBindingId,
    sellerDestinationBindingId: row.sellerDestinationBindingId,
    consumedByOperationId: row.consumedByOperationId,
    consumedAt: row.consumedAt
  };
}

function normalizeRisk(row: typeof riskFinancialHandoffs.$inferSelect):
NormalizedFinancialHandoff {
  return {
    handoffId: row.id,
    transactionId: row.transactionId,
    sourceType: "RISK",
    outcome: "BUYER_REFUND",
    buyerAmount: row.buyerAmount,
    sellerAmount: 0,
    currency: "IDR",
    sourceHash: row.calculationHash,
    sourceFinalizedAt: row.approvedAt,
    sourceState: row.sourceState,
    sourceStateVersion: row.sourceStateVersion,
    evidenceReference: row.evidenceReference,
    evidenceHash: row.evidenceHash,
    buyerDestinationBindingId: row.buyerDestinationBindingId,
    sellerDestinationBindingId: null,
    consumedByOperationId: row.consumedByOperationId,
    consumedAt: row.consumedAt
  };
}

function normalizeCancellation(row: typeof cancellationFinancialHandoffs.$inferSelect):
NormalizedFinancialHandoff {
  return {
    handoffId: row.id,
    transactionId: row.transactionId,
    sourceType: row.sourceType as "FUNDED_CANCELLATION" | "LATE_FUND",
    outcome: "BUYER_REFUND",
    buyerAmount: row.buyerAmount,
    sellerAmount: 0,
    currency: "IDR",
    sourceHash: row.sourceHash,
    sourceFinalizedAt: row.sourceFinalizedAt,
    sourceState: row.sourceState,
    sourceStateVersion: row.sourceStateVersion,
    evidenceReference: row.evidenceReference,
    evidenceHash: row.evidenceHash,
    buyerDestinationBindingId: row.buyerAccountId,
    sellerDestinationBindingId: null,
    consumedByOperationId: row.consumedByOperationId,
    consumedAt: row.consumedAt
  };
}

export async function readFinancialHandoff(
  database: any,
  sourceType: FinancialHandoffSource,
  handoffId: string,
  transactionId: string,
  forUpdate = false
): Promise<NormalizedFinancialHandoff> {
  if (sourceType === "COMPLAINT") {
    const row = forUpdate
      ? await readComplaintHandoffForUpdate(database, handoffId, transactionId)
      : (await database.select().from(complaintFinancialHandoffs).where(and(
        eq(complaintFinancialHandoffs.id, handoffId),
        eq(complaintFinancialHandoffs.transactionId, transactionId)
      )).limit(1))[0];
    if (!row) throw new Error("COMPLAINT_HANDOFF_NOT_FOUND");
    return normalizeComplaint(row);
  }
  if (sourceType === "RISK") {
    const row = forUpdate
      ? await readRiskRefundHandoffForUpdate(database, handoffId, transactionId)
      : (await database.select().from(riskFinancialHandoffs).where(and(
        eq(riskFinancialHandoffs.id, handoffId),
        eq(riskFinancialHandoffs.transactionId, transactionId)
      )).limit(1))[0];
    if (!row) throw new Error("RISK_HANDOFF_NOT_FOUND");
    return normalizeRisk(row);
  }
  const row = forUpdate
    ? await readCancellationFinancialHandoffForUpdate(database, handoffId, transactionId)
    : (await database.select().from(cancellationFinancialHandoffs).where(and(
      eq(cancellationFinancialHandoffs.id, handoffId),
      eq(cancellationFinancialHandoffs.transactionId, transactionId),
      eq(cancellationFinancialHandoffs.sourceType, sourceType)
    )).limit(1))[0];
  if (!row || row.sourceType !== sourceType) throw new Error("CANCELLATION_HANDOFF_NOT_FOUND");
  return normalizeCancellation(row);
}

export async function claimFinancialHandoff(
  tx: any,
  sourceType: FinancialHandoffSource,
  input: {
    handoffId: string;
    transactionId: string;
    expectedSourceStateVersion: number;
    parentOperationId: string;
    actorAccountId: string;
    correlationId: string;
  }
): Promise<NormalizedFinancialHandoff> {
  if (sourceType === "COMPLAINT") {
    return normalizeComplaint(await claimComplaintHandoff(tx, input));
  }
  if (sourceType === "RISK") {
    return normalizeRisk(await claimRiskRefundHandoff(tx, input));
  }
  const row = await claimCancellationFinancialHandoff(tx, input);
  if (row.sourceType !== sourceType) throw new Error("HANDOFF_SOURCE_MISMATCH");
  return normalizeCancellation(row);
}

export function assertSourceOutcome(
  sourceType: FinancialHandoffSource,
  outcome: NormalizedFinancialHandoff["outcome"]
): void {
  const allowed = sourceType === "COMPLAINT"
    ? ["SELLER_RELEASE", "BUYER_REFUND", "SPLIT"]
    : ["BUYER_REFUND"];
  if (!allowed.includes(outcome)) throw new Error("HANDOFF_OUTCOME_NOT_ALLOWED");
}
