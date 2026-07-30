import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { cancellationRequests } from "@/server/db/schema";
import { recordComplaint } from "@/server/complaint/service";
import { recordRisk } from "@/server/risk/service";
import type { CancellationHandoffInput } from "./contracts";

type Admin = { id: string; isAdmin: boolean };
type Idempotency = { key: string; requestHash: string };

async function requiredRequest(
  transactionId: string,
  requestId: string,
  type: "COMPLAINT" | "RISK"
) {
  const [request] = await db.select().from(cancellationRequests).where(and(
    eq(cancellationRequests.id, requestId),
    eq(cancellationRequests.transactionId, transactionId),
    eq(cancellationRequests.status, "ACTIVE"),
    eq(cancellationRequests.delegationType, type),
    eq(cancellationRequests.delegationStatus, "REQUIRED")
  )).limit(1);
  if (!request) throw new Error("CANCELLATION_DELEGATION_NOT_REQUIRED");
  return request;
}

export async function handoffCancellationToComplaint(
  admin: Admin,
  transactionId: string,
  input: CancellationHandoffInput,
  idempotency: Idempotency
) {
  await requiredRequest(transactionId, input.cancellationRequestId, "COMPLAINT");
  return recordComplaint(admin, transactionId, {
    summary: "Cancellation evidence requires complaint handling.",
    evidenceReference: input.evidenceReference,
    evidenceHash: input.evidenceHash,
    sourceAuthorRole: "SELLER",
    expectedStateVersion: input.expectedStateVersion
  }, idempotency);
}

export async function handoffCancellationToRisk(
  admin: Admin,
  transactionId: string,
  input: CancellationHandoffInput,
  idempotency: Idempotency
) {
  const request = await requiredRequest(transactionId, input.cancellationRequestId, "RISK");
  if (!["PROHIBITED_OR_POLICY", "SUSPECTED_FRAUD"].includes(request.cause)) {
    throw new Error("CANCELLATION_RISK_CAUSE_INVALID");
  }
  return recordRisk(admin, transactionId, {
    category: request.cause as "PROHIBITED_OR_POLICY" | "SUSPECTED_FRAUD",
    reason: "Cancellation cause requires assigned Admin risk review.",
    evidenceReference: input.evidenceReference,
    evidenceHash: input.evidenceHash,
    expectedStateVersion: input.expectedStateVersion
  }, idempotency);
}
