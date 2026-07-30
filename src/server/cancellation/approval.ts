import { randomUUID } from "node:crypto";
import { and, count, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  cancellationEvents,
  cancellationFinancialHandoffs,
  cancellationRefundApprovals,
  cancellationRefundCalculations,
  cancellationRequests,
  paymentInvoices,
  paymentProviderEvents,
  transactionParticipants,
  transactions
} from "@/server/db/schema";
import { findIdempotentResult, saveIdempotentResult } from "@/server/transaction/mutation";
import { recordTransactionEvent } from "@/server/transaction/audit";
import { requireCancellationAssignment } from "./authorization";
import type { CancellationCalculationDecisionInput } from "./contracts";

type Admin = { id: string; isAdmin: boolean };
type Idempotency = { key: string; requestHash: string };

export async function decideCancellationCalculation(
  admin: Admin,
  transactionId: string,
  calculationId: string,
  input: CancellationCalculationDecisionInput,
  idempotency: Idempotency
) {
  return db.transaction(async (tx) => {
    await requireCancellationAssignment(tx, admin, "CANCELLATION_APPROVAL");
    const command = "CANCELLATION_CALCULATION_DECIDE";
    const prior = await findIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash);
    if (prior) return prior;
    await tx.execute(sql`SELECT id FROM transactions WHERE id = ${transactionId} FOR UPDATE`);
    await tx.execute(sql`
      SELECT id FROM cancellation_refund_calculations
      WHERE id = ${calculationId} FOR UPDATE
    `);
    const [transaction] = await tx.select().from(transactions)
      .where(eq(transactions.id, transactionId)).limit(1);
    const [calculation] = await tx.select().from(cancellationRefundCalculations)
      .where(eq(cancellationRefundCalculations.id, calculationId)).limit(1);
    if (!transaction || !calculation) throw new Error("CANCELLATION_CALCULATION_NOT_FOUND");
    const [request] = await tx.select().from(cancellationRequests).where(and(
      eq(cancellationRequests.id, calculation.cancellationRequestId),
      eq(cancellationRequests.transactionId, transactionId)
    )).limit(1);
    if (!request) throw new Error("CANCELLATION_NOT_FOUND");
    if (transaction.stateVersion !== input.expectedStateVersion) throw new Error("STATE_VERSION_CONFLICT");
    if (calculation.status !== "PENDING") throw new Error("CANCELLATION_CALCULATION_FINAL");

    const correlationId = randomUUID();
    await tx.insert(cancellationRefundApprovals).values({
      calculationId,
      adminAccountId: admin.id,
      decision: input.decision,
      correlationId,
      idempotencyKey: idempotency.key
    });
    if (input.decision === "REJECTED") {
      await tx.update(cancellationRefundCalculations).set({
        status: "REJECTED",
        decidedAt: new Date()
      }).where(eq(cancellationRefundCalculations.id, calculationId));
      await tx.insert(cancellationEvents).values({
        cancellationRequestId: request.id,
        eventType: "REFUND_CALCULATION_REJECTED",
        actorAccountId: admin.id,
        summary: "Refund calculation rejected",
        evidenceReference: calculationId,
        correlationId,
        idempotencyKey: `${idempotency.key}:event`
      });
      const result = { calculationId, status: "REJECTED", approvals: 1 };
      await saveIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash, result);
      return result;
    }

    const [approvalCount] = await tx.select({ value: count() })
      .from(cancellationRefundApprovals)
      .where(and(
        eq(cancellationRefundApprovals.calculationId, calculationId),
        eq(cancellationRefundApprovals.decision, "APPROVED")
      ));
    const approvals = Number(approvalCount?.value ?? 0);
    if (approvals < 2) {
      const result = { calculationId, status: "PENDING", approvals };
      await saveIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash, result);
      return result;
    }

    const [invoice] = await tx.select().from(paymentInvoices)
      .where(eq(paymentInvoices.transactionId, transactionId)).limit(1);
    if (!invoice?.authoritativeProviderEventId) throw new Error("AUTHORITATIVE_PAYMENT_REQUIRED");
    const [providerEvent] = await tx.select().from(paymentProviderEvents).where(and(
      eq(paymentProviderEvents.id, invoice.authoritativeProviderEventId),
      eq(paymentProviderEvents.invoiceId, invoice.id),
      eq(paymentProviderEvents.validationOutcome, "ACCEPTED"),
      eq(paymentProviderEvents.providerStatus, "settlement"),
      eq(paymentProviderEvents.fraudStatus, "accept")
    )).limit(1);
    if (!providerEvent) throw new Error("AUTHORITATIVE_PAYMENT_REQUIRED");
    const [buyer] = await tx.select().from(transactionParticipants).where(and(
      eq(transactionParticipants.transactionId, transactionId),
      eq(transactionParticipants.role, "BUYER"),
      eq(transactionParticipants.accountId, calculation.buyerDestinationBindingId)
    )).limit(1);
    if (!buyer) throw new Error("BUYER_DESTINATION_BINDING_INVALID");
    const finalizedAt = new Date();
    const nextVersion = transaction.stateVersion + 1;
    const [updated] = await tx.update(transactions).set({
      state: "REFUND_READY",
      stateVersion: nextVersion,
      updatedAt: finalizedAt
    }).where(and(
      eq(transactions.id, transactionId),
      eq(transactions.state, "FUNDED_CANCELLATION_REVIEW"),
      eq(transactions.stateVersion, transaction.stateVersion)
    )).returning({ id: transactions.id });
    if (!updated) throw new Error("STATE_VERSION_CONFLICT");
    await tx.update(cancellationRefundCalculations).set({
      status: "APPROVED",
      decidedAt: finalizedAt
    }).where(eq(cancellationRefundCalculations.id, calculationId));
    const [handoff] = await tx.insert(cancellationFinancialHandoffs).values({
      transactionId,
      cancellationRequestId: request.id,
      providerEventId: providerEvent.id,
      sourceType: "FUNDED_CANCELLATION",
      buyerAmount: calculation.buyerAmount,
      buyerAccountId: buyer.accountId,
      calculationId,
      sourceHash: calculation.calculationHash,
      evidenceReference: calculation.id,
      evidenceHash: calculation.evidenceSnapshotHash,
      providerOrderId: invoice.providerOrderId,
      sourceState: "REFUND_READY",
      sourceStateVersion: nextVersion,
      sourceFinalizedAt: finalizedAt
    }).returning();
    if (!handoff) throw new Error("CANCELLATION_HANDOFF_CREATE_FAILED");
    await tx.update(cancellationRequests).set({
      status: "CLOSED",
      lifecycle: "RESOLVED",
      decision: "REFUND_APPROVED",
      resolvedAt: finalizedAt,
      stateVersion: request.stateVersion + 1
    }).where(and(
      eq(cancellationRequests.id, request.id),
      eq(cancellationRequests.status, "ACTIVE"),
      eq(cancellationRequests.stateVersion, request.stateVersion)
    ));
    await tx.insert(cancellationEvents).values([
      {
        cancellationRequestId: request.id,
        eventType: "REFUND_CALCULATION_APPROVED",
        actorAccountId: admin.id,
        summary: "Refund calculation approved by two Admins",
        evidenceReference: calculationId,
        correlationId,
        idempotencyKey: `${idempotency.key}:approved`
      },
      {
        cancellationRequestId: request.id,
        eventType: "FINANCIAL_HANDOFF_CREATED",
        actorAccountId: admin.id,
        summary: "Immutable refund handoff created",
        evidenceReference: handoff.id,
        correlationId,
        idempotencyKey: `${idempotency.key}:handoff`
      }
    ]);
    await recordTransactionEvent(tx, {
      transactionId,
      actorAccountId: admin.id,
      eventType: "CANCELLATION_REFUND_READY",
      beforeState: transaction.state,
      afterState: "REFUND_READY",
      stateVersion: nextVersion,
      correlationId,
      evidenceReference: handoff.id
    });
    const result = {
      calculationId,
      status: "APPROVED",
      approvals,
      handoffId: handoff.id,
      state: "REFUND_READY",
      stateVersion: nextVersion
    };
    await saveIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash, result);
    return result;
  });
}
