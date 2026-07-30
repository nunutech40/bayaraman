import { createHash, randomUUID } from "node:crypto";
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  accounts,
  buyerRefundDestinations,
  complaintHolds,
  confirmationExceptions,
  confirmationLinks,
  financialOperationApprovals,
  financialOperationReauthGrants,
  financialOperations,
  financialSplitCalculations,
  paymentInvoices,
  paymentProviderEvents,
  refundCapabilityAssessments,
  riskHolds,
  sellerPayoutDestinations,
  transactionParticipants,
  transactions,
  transactionTerms
} from "@/server/db/schema";
import { verifyPassword } from "@/server/auth/password";
import { findIdempotentResult, saveIdempotentResult } from "@/server/transaction/mutation";
import { recordTransactionEvent } from "@/server/transaction/audit";
import { assertExpectedStateVersion } from "@/server/domain/transaction/state";
import {
  claimFinancialHandoff,
  readFinancialHandoff,
  assertSourceOutcome,
  type FinancialHandoffSource,
  type NormalizedFinancialHandoff
} from "./handoff-adapter";
import {
  requireAnyFinancialAssignment,
  requireFinancialAssignment
} from "./authorization";
import type {
  FinancialApprovalInput,
  FinancialPrepareInput,
  FinancialReconcileInput
} from "./contracts";
import {
  createFakeFinancialTransferAdapter,
  createFakeRefundProviderAdapter,
  type FinancialTransferAdapter,
  type RefundProviderAdapter
} from "@/server/providers/finance";

type Admin = { id: string; isAdmin: boolean; passwordHash?: string | null };
type Idempotency = { key: string; requestHash: string };

const REAUTH_TTL_MS = 5 * 60 * 1000;
const TWO_ADMIN_THRESHOLD = 1_000_000;

function sha256(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function maskedDestination(row: {
  bankName: string;
  accountHolderName: string;
  maskedAccountValue: string;
}): string {
  return `${row.bankName} ${row.maskedAccountValue} a.n. ${row.accountHolderName}`;
}

async function lockTransaction(tx: any, transactionId: string) {
  await tx.execute(sql`SELECT id FROM transactions WHERE id = ${transactionId} FOR UPDATE`);
  const [transaction] = await tx.select().from(transactions)
    .where(eq(transactions.id, transactionId)).limit(1);
  if (!transaction) throw new Error("TRANSACTION_NOT_FOUND");
  return transaction;
}

async function assertNoActiveHold(tx: any, transactionId: string) {
  const [complaint] = await tx.select({ id: complaintHolds.id })
    .from(complaintHolds).where(and(
      eq(complaintHolds.transactionId, transactionId),
      eq(complaintHolds.active, true)
    )).limit(1);
  const [risk] = await tx.select({ id: riskHolds.id })
    .from(riskHolds).where(and(
      eq(riskHolds.transactionId, transactionId),
      eq(riskHolds.active, true)
    )).limit(1);
  if (complaint || risk) throw new Error("FINANCIAL_HOLD_ACTIVE");
}

async function destinationForRole(tx: any, transactionId: string, role: "BUYER" | "SELLER") {
  const [participant] = await tx.select().from(transactionParticipants).where(and(
    eq(transactionParticipants.transactionId, transactionId),
    eq(transactionParticipants.role, role)
  )).limit(1);
  if (!participant) throw new Error(`${role}_PARTICIPANT_REQUIRED`);
  if (role === "BUYER") {
    const [destination] = await tx.select().from(buyerRefundDestinations).where(and(
      eq(buyerRefundDestinations.transactionId, transactionId),
      eq(buyerRefundDestinations.participantAccountId, participant.accountId)
    )).limit(1);
    if (!destination?.lockedAt) throw new Error("BUYER_DESTINATION_NOT_LOCKED");
    return { participant, destination };
  }
  const [destination] = await tx.select().from(sellerPayoutDestinations).where(and(
    eq(sellerPayoutDestinations.transactionId, transactionId),
    eq(sellerPayoutDestinations.participantAccountId, participant.accountId)
  )).limit(1);
  if (!destination?.lockedAt) throw new Error("SELLER_DESTINATION_NOT_LOCKED");
  return { participant, destination };
}

async function assertNormalPayoutEvidence(tx: any, transactionId: string) {
  const [link] = await tx.select({ usedAt: confirmationLinks.usedAt })
    .from(confirmationLinks).where(eq(confirmationLinks.transactionId, transactionId)).limit(1);
  const [exception] = await tx.select({ id: confirmationExceptions.id })
    .from(confirmationExceptions).where(and(
      eq(confirmationExceptions.transactionId, transactionId),
      eq(confirmationExceptions.decision, "APPROVED")
    )).limit(1);
  if (!link?.usedAt && !exception) throw new Error("PAYOUT_CONFIRMATION_REQUIRED");
}

function operationRequiresTwoApprovals(operation: typeof financialOperations.$inferSelect): boolean {
  return operation.type !== "PAYOUT" ||
    operation.amount > TWO_ADMIN_THRESHOLD ||
    operation.sourceType !== null;
}

async function approvalCount(tx: any, rootOperationId: string): Promise<number> {
  const [row] = await tx.select({ value: count() }).from(financialOperationApprovals)
    .where(and(
      eq(financialOperationApprovals.operationId, rootOperationId),
      eq(financialOperationApprovals.decision, "APPROVED")
    ));
  return Number(row?.value ?? 0);
}

function assertSourceMatchesOperation(
  input: FinancialPrepareInput,
  source: NormalizedFinancialHandoff
) {
  assertSourceOutcome(source.sourceType, source.outcome);
  if (input.operation === "REFUND" && source.outcome !== "BUYER_REFUND") {
    throw new Error("HANDOFF_OUTCOME_MISMATCH");
  }
  if (input.operation === "SPLIT" && source.outcome !== "SPLIT") {
    throw new Error("HANDOFF_OUTCOME_MISMATCH");
  }
  if (input.operation === "PAYOUT" && source.outcome !== "SELLER_RELEASE") {
    throw new Error("HANDOFF_OUTCOME_MISMATCH");
  }
  if (source.transactionId !== input.transactionId) throw new Error("HANDOFF_TRANSACTION_MISMATCH");
  if (source.sourceStateVersion !== input.expectedStateVersion) throw new Error("STATE_VERSION_CONFLICT");
}

async function authoritativeRefundSnapshot(
  database: any,
  transactionId: string,
  source: NormalizedFinancialHandoff
) {
  const [invoice] = await database.select().from(paymentInvoices)
    .where(eq(paymentInvoices.transactionId, transactionId))
    .orderBy(desc(paymentInvoices.createdAt)).limit(1);
  if (!invoice) throw new Error("PAYMENT_INVOICE_NOT_FOUND");
  const eventCondition = invoice.authoritativeProviderEventId
    ? eq(paymentProviderEvents.id, invoice.authoritativeProviderEventId)
    : and(
      eq(paymentProviderEvents.invoiceId, invoice.id),
      eq(paymentProviderEvents.validationOutcome, "ACCEPTED"),
      eq(paymentProviderEvents.providerStatus, "settlement"),
      eq(paymentProviderEvents.fraudStatus, "accept")
    );
  const [event] = await database.select().from(paymentProviderEvents)
    .where(eventCondition).orderBy(desc(paymentProviderEvents.receivedAt)).limit(1);
  if (!event || event.invoiceId !== invoice.id ||
      event.providerOrderId !== invoice.providerOrderId ||
      event.amount !== invoice.amount || event.currency !== invoice.currency ||
      event.validationOutcome !== "ACCEPTED" ||
      event.providerStatus !== "settlement" || event.fraudStatus !== "accept") {
    throw new Error("AUTHORITATIVE_PAYMENT_REQUIRED");
  }
  const capabilitySnapshotHash = sha256({
    transactionId,
    handoffId: source.handoffId,
    sourceHash: source.sourceHash,
    sourceStateVersion: source.sourceStateVersion,
    invoiceId: invoice.id,
    eventId: event.id,
    providerOrderId: invoice.providerOrderId,
    amount: source.buyerAmount,
    currency: source.currency
  });
  return { invoice, event, capabilitySnapshotHash };
}

export async function prepareFinancialOperation(
  admin: Admin,
  input: FinancialPrepareInput,
  idempotency: Idempotency,
  refundProvider: RefundProviderAdapter = createFakeRefundProviderAdapter()
) {
  await requireFinancialAssignment(db, admin, "FINANCIAL_PREPARE");
  let source: NormalizedFinancialHandoff | null = null;
  let capabilityResult: Awaited<ReturnType<RefundProviderAdapter["getRefundCapability"]>> | null = null;
  let providerSnapshot: Awaited<ReturnType<typeof authoritativeRefundSnapshot>> | null = null;
  if (input.sourceType && input.handoffId) {
    source = await readFinancialHandoff(
      db, input.sourceType, input.handoffId, input.transactionId
    );
    assertSourceMatchesOperation(input, source);
  }
  if (input.operation === "REFUND") {
    if (!source) throw new Error("FINANCIAL_HANDOFF_REQUIRED");
    providerSnapshot = await authoritativeRefundSnapshot(db, input.transactionId, source);
    capabilityResult = await refundProvider.getRefundCapability({
      providerOrderId: providerSnapshot.invoice.providerOrderId,
      authoritativeProviderEventId: providerSnapshot.event.id,
      amount: source.buyerAmount,
      currency: "IDR"
    }).catch(() => ({
      capability: "UNKNOWN" as const,
      evidenceReference: null,
      checkedAt: new Date()
    }));
  }

  return db.transaction(async (tx) => {
    await requireFinancialAssignment(tx, admin, "FINANCIAL_PREPARE");
    const command = "FINANCIAL_OPERATION_PREPARE";
    const prior = await findIdempotentResult(
      tx, admin.id, command, idempotency.key, idempotency.requestHash
    );
    if (prior) return prior;
    const transaction = await lockTransaction(tx, input.transactionId);
    assertExpectedStateVersion(transaction.stateVersion, input.expectedStateVersion);

    let lockedSource: NormalizedFinancialHandoff | null = null;
    if (input.sourceType && input.handoffId) {
      lockedSource = await readFinancialHandoff(
        tx, input.sourceType, input.handoffId, input.transactionId, true
      );
      assertSourceMatchesOperation(input, lockedSource);
      if (source && sha256(lockedSource) !== sha256(source)) {
        throw new Error("HANDOFF_CHANGED_DURING_PREPARATION");
      }
      if (lockedSource.consumedByOperationId) throw new Error("HANDOFF_ALREADY_CLAIMED");
    }

    let capabilityAssessmentId: string | null = null;
    let route = input.operation === "PAYOUT" ? "MANUAL_PAYOUT" : "MANUAL_SPLIT";
    if (input.operation === "REFUND") {
      if (!providerSnapshot || !capabilityResult || !lockedSource) {
        throw new Error("REFUND_CAPABILITY_REQUIRED");
      }
      await tx.execute(sql`
        SELECT id FROM payment_invoices
        WHERE id = ${providerSnapshot.invoice.id}
        FOR UPDATE
      `);
      await tx.execute(sql`
        SELECT id FROM payment_provider_events
        WHERE id = ${providerSnapshot.event.id}
        FOR UPDATE
      `);
      const current = await authoritativeRefundSnapshot(tx, input.transactionId, lockedSource);
      if (current.capabilitySnapshotHash !== providerSnapshot.capabilitySnapshotHash) {
        throw new Error("REFUND_AUTHORITY_CHANGED");
      }
      const [assessment] = await tx.insert(refundCapabilityAssessments).values({
        transactionId: input.transactionId,
        sourceType: lockedSource.sourceType,
        sourceHandoffId: lockedSource.handoffId,
        sourceHash: lockedSource.sourceHash,
        sourceStateVersion: lockedSource.sourceStateVersion,
        invoiceId: current.invoice.id,
        authoritativeProviderEventId: current.event.id,
        providerOrderId: current.invoice.providerOrderId,
        amount: lockedSource.buyerAmount,
        currency: "IDR",
        capabilitySnapshotHash: current.capabilitySnapshotHash,
        capability: capabilityResult.capability,
        evidenceReference: capabilityResult.evidenceReference,
        evidenceHash: capabilityResult.evidenceReference
          ? sha256(capabilityResult.evidenceReference)
          : null,
        checkedAt: capabilityResult.checkedAt,
        actorAccountId: admin.id,
        correlationId: randomUUID(),
        idempotencyKey: idempotency.key
      }).returning({ id: refundCapabilityAssessments.id });
      capabilityAssessmentId = assessment!.id;
      if (capabilityResult.capability === "UNKNOWN") {
        const result = {
          assessmentId: capabilityAssessmentId,
          capability: "UNKNOWN",
          prepared: false
        };
        await saveIdempotentResult(
          tx, admin.id, command, idempotency.key, idempotency.requestHash, result
        );
        return result;
      }
      route = capabilityResult.capability === "SUPPORTED"
        ? "MIDTRANS_REFUND"
        : "MANUAL_REFUND";
    }

    const operationId = randomUUID();
    let type: "PAYOUT" | "REFUND" | "SPLIT_BUYER" = input.operation === "SPLIT"
      ? "SPLIT_BUYER"
      : input.operation;
    let amount = 0;
    let destinationSnapshot = "";
    if (type === "PAYOUT") {
      if (transaction.state !== "READY_FOR_PAYOUT") throw new Error("PAYOUT_NOT_READY");
      if (!lockedSource) {
        await assertNoActiveHold(tx, transaction.id);
        await assertNormalPayoutEvidence(tx, transaction.id);
      }
      const { destination } = await destinationForRole(tx, transaction.id, "SELLER");
      const [terms] = await tx.select().from(transactionTerms)
        .where(eq(transactionTerms.transactionId, transaction.id)).limit(1);
      if (!terms?.frozenAt) throw new Error("TRANSACTION_TERMS_NOT_FROZEN");
      amount = lockedSource?.sellerAmount ?? terms.itemPrice + terms.shippingCost;
      destinationSnapshot = maskedDestination(destination);
    } else {
      if (type === "REFUND" && transaction.state !== "REFUND_READY") {
        throw new Error("REFUND_NOT_READY");
      }
      if (type === "SPLIT_BUYER" && transaction.state !== "PAYOUT_ON_HOLD") {
        throw new Error("SPLIT_NOT_READY");
      }
      const { destination } = await destinationForRole(tx, transaction.id, "BUYER");
      amount = type === "REFUND"
        ? lockedSource!.buyerAmount
        : input.buyerAmount!;
      destinationSnapshot = maskedDestination(destination);
    }
    if (amount <= 0) throw new Error("FINANCIAL_AMOUNT_INVALID");
    const [operation] = await tx.insert(financialOperations).values({
      id: operationId,
      transactionId: transaction.id,
      type,
      result: null,
      amount,
      destinationSnapshot,
      route,
      attempt: 1,
      rootOperationId: operationId,
      sourceType: lockedSource?.sourceType,
      sourceHandoffId: lockedSource?.handoffId,
      sourceHash: lockedSource?.sourceHash,
      sourceFinalizedAt: lockedSource?.sourceFinalizedAt,
      sourceState: lockedSource?.sourceState as any,
      sourceStateVersion: lockedSource?.sourceStateVersion,
      selectedCapabilityAssessmentId: capabilityAssessmentId,
      startedByAccountId: admin.id
    }).returning();
    if (!operation) throw new Error("FINANCIAL_OPERATION_CREATE_FAILED");
    if (lockedSource) {
      await claimFinancialHandoff(tx, lockedSource.sourceType, {
        handoffId: lockedSource.handoffId,
        transactionId: transaction.id,
        expectedSourceStateVersion: lockedSource.sourceStateVersion,
        parentOperationId: operation.id,
        actorAccountId: admin.id,
        correlationId: randomUUID()
      });
    }
    if (type === "SPLIT_BUYER") {
      const [terms] = await tx.select().from(transactionTerms)
        .where(eq(transactionTerms.transactionId, transaction.id)).limit(1);
      const poolAmount = (terms?.itemPrice ?? 0) + (terms?.shippingCost ?? 0);
      if (input.buyerAmount! + input.sellerAmount! !== poolAmount ||
          lockedSource?.buyerAmount !== input.buyerAmount ||
          lockedSource?.sellerAmount !== input.sellerAmount) {
        throw new Error("SPLIT_AMOUNT_INVALID");
      }
      await tx.insert(financialSplitCalculations).values({
        rootOperationId: operation.id,
        transactionId: transaction.id,
        buyerAmount: input.buyerAmount!,
        sellerAmount: input.sellerAmount!,
        poolAmount,
        calculationHash: sha256({
          transactionId: transaction.id,
          buyerAmount: input.buyerAmount,
          sellerAmount: input.sellerAmount,
          sourceHash: lockedSource!.sourceHash
        })
      });
    }
    await recordTransactionEvent(tx, {
      transactionId: transaction.id,
      actorAccountId: admin.id,
      eventType: "FINANCIAL_OPERATION_PREPARED",
      stateVersion: transaction.stateVersion,
      correlationId: randomUUID(),
      evidenceReference: operation.id,
      payload: { type, route, amount, sourceType: lockedSource?.sourceType ?? null }
    });
    const result = operationProjection(operation, 0);
    await saveIdempotentResult(
      tx, admin.id, command, idempotency.key, idempotency.requestHash, result
    );
    return result;
  });
}

export async function approveFinancialOperation(
  admin: Admin,
  operationId: string,
  input: FinancialApprovalInput,
  idempotency: Idempotency
) {
  return db.transaction(async (tx) => {
    await requireFinancialAssignment(tx, admin, "FINANCIAL_APPROVE");
    const command = "FINANCIAL_OPERATION_APPROVE";
    const prior = await findIdempotentResult(
      tx, admin.id, command, idempotency.key, idempotency.requestHash
    );
    if (prior) return prior;
    await tx.execute(sql`SELECT id FROM financial_operations WHERE id = ${operationId} FOR UPDATE`);
    const [operation] = await tx.select().from(financialOperations)
      .where(eq(financialOperations.id, operationId)).limit(1);
    if (!operation) throw new Error("FINANCIAL_OPERATION_NOT_FOUND");
    assertExpectedStateVersion(operation.stateVersion, input.expectedOperationVersion);
    if (operation.result !== null) throw new Error("FINANCIAL_OPERATION_NOT_PREPARED");
    const rootId = operation.rootOperationId ?? operation.id;
    await tx.insert(financialOperationApprovals).values({
      operationId: rootId,
      adminAccountId: admin.id,
      decision: input.decision,
      note: input.note,
      operationStateVersion: operation.stateVersion,
      correlationId: randomUUID(),
      idempotencyKey: idempotency.key
    });
    const approvals = await approvalCount(tx, rootId);
    const result = { operationId, decision: input.decision, approvals };
    await recordTransactionEvent(tx, {
      transactionId: operation.transactionId,
      actorAccountId: admin.id,
      eventType: `FINANCIAL_OPERATION_${input.decision}`,
      stateVersion: operation.sourceStateVersion ?? undefined,
      correlationId: randomUUID(),
      evidenceReference: operationId,
      payload: { approvals }
    });
    await saveIdempotentResult(
      tx, admin.id, command, idempotency.key, idempotency.requestHash, result
    );
    return result;
  });
}

export async function reauthenticateFinancialOperation(
  admin: Admin,
  sessionId: string,
  operationId: string,
  password: string,
  expectedOperationVersion: number,
  idempotency: Idempotency
) {
  await requireFinancialAssignment(db, admin, "FINANCIAL_EXECUTE");
  const [account] = await db.select({ passwordHash: accounts.passwordHash })
    .from(accounts).where(eq(accounts.id, admin.id)).limit(1);
  if (!account?.passwordHash || !(await verifyPassword(account.passwordHash, password))) {
    throw new Error("REAUTH_FAILED");
  }
  return db.transaction(async (tx) => {
    const command = "FINANCIAL_OPERATION_REAUTH";
    const prior = await findIdempotentResult(
      tx, admin.id, command, idempotency.key, idempotency.requestHash
    );
    if (prior) return prior;
    await tx.execute(sql`SELECT id FROM financial_operations WHERE id = ${operationId} FOR UPDATE`);
    const [operation] = await tx.select().from(financialOperations)
      .where(eq(financialOperations.id, operationId)).limit(1);
    if (!operation) throw new Error("FINANCIAL_OPERATION_NOT_FOUND");
    assertExpectedStateVersion(operation.stateVersion, expectedOperationVersion);
    if (operation.result !== null || operation.type !== "PAYOUT") {
      throw new Error("REAUTH_NOT_AVAILABLE");
    }
    await tx.update(financialOperationReauthGrants).set({ invalidatedAt: new Date() })
      .where(and(
        eq(financialOperationReauthGrants.operationId, operationId),
        eq(financialOperationReauthGrants.adminAccountId, admin.id),
        isNull(financialOperationReauthGrants.consumedAt),
        isNull(financialOperationReauthGrants.invalidatedAt)
      ));
    const expiresAt = new Date(Date.now() + REAUTH_TTL_MS);
    await tx.insert(financialOperationReauthGrants).values({
      operationId,
      adminAccountId: admin.id,
      sessionIdHash: sha256(sessionId),
      expiresAt,
      stateVersion: operation.stateVersion,
      idempotencyKey: idempotency.key
    });
    const result = { reauthenticated: true, expiresAt: expiresAt.toISOString() };
    await saveIdempotentResult(
      tx, admin.id, command, idempotency.key, idempotency.requestHash, result
    );
    return result;
  });
}

function processingState(type: typeof financialOperations.$inferSelect["type"]) {
  if (type === "PAYOUT") return "PAYOUT_PROCESSING" as const;
  if (type === "REFUND") return "REFUND_PROCESSING" as const;
  return "SPLIT_PROCESSING" as const;
}

function allowedStartStates(type: typeof financialOperations.$inferSelect["type"]) {
  if (type === "PAYOUT") return ["READY_FOR_PAYOUT", "PAYOUT_PROCESSING"];
  if (type === "REFUND") return ["REFUND_READY", "REFUND_PROCESSING"];
  return ["PAYOUT_ON_HOLD", "SPLIT_PROCESSING"];
}

async function recordFinancialResult(
  operationId: string,
  result: "SUCCESS" | "FAILED" | "UNKNOWN",
  externalReference: string | null,
  evidenceHash: string | null,
  actorAccountId: string
) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM financial_operations WHERE id = ${operationId} FOR UPDATE`);
    const [operation] = await tx.select().from(financialOperations)
      .where(eq(financialOperations.id, operationId)).limit(1);
    if (!operation) throw new Error("FINANCIAL_OPERATION_NOT_FOUND");
    if (operation.result !== "PROCESSING" && operation.result !== "UNKNOWN") {
      if (operation.result === result) return operationProjection(operation, 0);
      throw new Error("FINANCIAL_OPERATION_NOT_PROCESSING");
    }
    if (result === "SUCCESS" && (!externalReference || !evidenceHash)) {
      throw new Error("FINANCIAL_SUCCESS_EVIDENCE_REQUIRED");
    }
    const completedAt = new Date();
    const [updatedOperation] = await tx.update(financialOperations).set({
      result,
      bankReference: externalReference,
      evidenceHash,
      completedAt,
      stateVersion: operation.stateVersion + 1
    }).where(and(
      eq(financialOperations.id, operation.id),
      sql`${financialOperations.result} IN ('PROCESSING', 'UNKNOWN')`,
      eq(financialOperations.stateVersion, operation.stateVersion)
    )).returning();
    if (!updatedOperation) throw new Error("STATE_VERSION_CONFLICT");
    const transaction = await lockTransaction(tx, operation.transactionId);
    let targetState = transaction.state;
    if (result === "SUCCESS") {
      if (operation.type === "PAYOUT") targetState = "PAID_OUT";
      if (operation.type === "REFUND") targetState = "REFUNDED";
      if (operation.type === "SPLIT_SELLER") targetState = "SPLIT_SETTLED";
      if (operation.type === "SPLIT_BUYER") {
        const rootId = operation.rootOperationId ?? operation.id;
        const [calculation] = await tx.select().from(financialSplitCalculations)
          .where(eq(financialSplitCalculations.rootOperationId, rootId)).limit(1);
        if (!calculation) throw new Error("SPLIT_CALCULATION_NOT_FOUND");
        const { destination } = await destinationForRole(tx, operation.transactionId, "SELLER");
        await tx.insert(financialOperations).values({
          transactionId: operation.transactionId,
          type: "SPLIT_SELLER",
          result: null,
          amount: calculation.sellerAmount,
          destinationSnapshot: maskedDestination(destination),
          route: "MANUAL_SPLIT",
          attempt: 1,
          rootOperationId: rootId,
          sourceType: operation.sourceType,
          sourceHandoffId: operation.sourceHandoffId,
          sourceHash: operation.sourceHash,
          sourceFinalizedAt: operation.sourceFinalizedAt,
          sourceState: operation.sourceState,
          sourceStateVersion: operation.sourceStateVersion,
          startedByAccountId: actorAccountId
        });
      }
    }
    if (targetState !== transaction.state) {
      await tx.update(transactions).set({
        state: targetState,
        stateVersion: transaction.stateVersion + 1,
        updatedAt: completedAt
      }).where(and(
        eq(transactions.id, transaction.id),
        eq(transactions.stateVersion, transaction.stateVersion)
      ));
    }
    await recordTransactionEvent(tx, {
      transactionId: transaction.id,
      actorAccountId,
      eventType: `FINANCIAL_OPERATION_${result}`,
      beforeState: transaction.state,
      afterState: targetState,
      stateVersion: targetState === transaction.state
        ? transaction.stateVersion
        : transaction.stateVersion + 1,
      correlationId: randomUUID(),
      evidenceReference: externalReference ?? operation.id,
      payload: { operationId, type: operation.type }
    });
    return operationProjection(updatedOperation, 0);
  });
}

export async function executeFinancialOperation(
  admin: Admin,
  sessionId: string,
  operationId: string,
  expectedOperationVersion: number,
  idempotency: Idempotency,
  adapter: FinancialTransferAdapter = createFakeFinancialTransferAdapter()
) {
  const started = await db.transaction(async (tx) => {
    await requireFinancialAssignment(tx, admin, "FINANCIAL_EXECUTE");
    const command = "FINANCIAL_OPERATION_EXECUTE";
    const prior = await findIdempotentResult(
      tx, admin.id, command, idempotency.key, idempotency.requestHash
    );
    if (prior) return { prior, operation: null };
    await tx.execute(sql`SELECT id FROM financial_operations WHERE id = ${operationId} FOR UPDATE`);
    const [operation] = await tx.select().from(financialOperations)
      .where(eq(financialOperations.id, operationId)).limit(1);
    if (!operation) throw new Error("FINANCIAL_OPERATION_NOT_FOUND");
    assertExpectedStateVersion(operation.stateVersion, expectedOperationVersion);
    if (operation.result !== null) throw new Error("FINANCIAL_OPERATION_NOT_PREPARED");
    const rootId = operation.rootOperationId ?? operation.id;
    if (operationRequiresTwoApprovals(operation) &&
        await approvalCount(tx, rootId) < 2) {
      throw new Error("TWO_ADMIN_APPROVAL_REQUIRED");
    }
    if (operation.type === "PAYOUT") {
      const [grant] = await tx.select().from(financialOperationReauthGrants).where(and(
        eq(financialOperationReauthGrants.operationId, operation.id),
        eq(financialOperationReauthGrants.adminAccountId, admin.id),
        eq(financialOperationReauthGrants.sessionIdHash, sha256(sessionId)),
        isNull(financialOperationReauthGrants.consumedAt),
        isNull(financialOperationReauthGrants.invalidatedAt)
      )).limit(1);
      if (!grant || grant.expiresAt <= new Date()) throw new Error("REAUTH_REQUIRED");
      const [consumed] = await tx.update(financialOperationReauthGrants).set({
        consumedAt: new Date(),
        stateVersion: grant.stateVersion + 1
      }).where(and(
        eq(financialOperationReauthGrants.id, grant.id),
        isNull(financialOperationReauthGrants.consumedAt),
        isNull(financialOperationReauthGrants.invalidatedAt)
      )).returning({ id: financialOperationReauthGrants.id });
      if (!consumed) throw new Error("REAUTH_ALREADY_USED");
    }
    const transaction = await lockTransaction(tx, operation.transactionId);
    if (!allowedStartStates(operation.type).includes(transaction.state as never)) {
      throw new Error("FINANCIAL_STATE_NOT_ELIGIBLE");
    }
    if (operation.type === "SPLIT_SELLER") {
      const [buyerLeg] = await tx.select().from(financialOperations).where(and(
        eq(financialOperations.rootOperationId, rootId),
        eq(financialOperations.type, "SPLIT_BUYER"),
        eq(financialOperations.result, "SUCCESS")
      )).limit(1);
      if (!buyerLeg) throw new Error("SPLIT_BUYER_SUCCESS_REQUIRED");
    }
    const externalIdempotencyKey = `BAYAR-008:${operation.id}:${operation.attempt}`;
    const now = new Date();
    const [updated] = await tx.update(financialOperations).set({
      result: "PROCESSING",
      startedAt: now,
      externalIdempotencyKey,
      stateVersion: operation.stateVersion + 1
    }).where(and(
      eq(financialOperations.id, operation.id),
      isNull(financialOperations.result),
      eq(financialOperations.stateVersion, operation.stateVersion)
    )).returning();
    if (!updated) throw new Error("STATE_VERSION_CONFLICT");
    const targetState = processingState(operation.type);
    if (transaction.state !== targetState) {
      await tx.update(transactions).set({
        state: targetState,
        stateVersion: transaction.stateVersion + 1,
        updatedAt: now
      }).where(and(
        eq(transactions.id, transaction.id),
        eq(transactions.stateVersion, transaction.stateVersion)
      ));
    }
    const prepared = {
      operationId: operation.id,
      externalIdempotencyKey,
      type: operation.type,
      route: operation.route ?? "MANUAL_PAYOUT",
      amount: operation.amount
    };
    await saveIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash, {
      operationId: operation.id,
      result: "PROCESSING",
      state: targetState
    });
    return { prior: null, operation: prepared };
  });
  if (started.prior) return started.prior;
  const transferResult = await adapter.execute(started.operation!).catch(() => ({
    result: "UNKNOWN" as const,
    externalReference: null,
    evidenceHash: null
  }));
  return recordFinancialResult(
    operationId,
    transferResult.result === "PROCESSING" ? "UNKNOWN" : transferResult.result,
    transferResult.externalReference,
    transferResult.evidenceHash,
    admin.id
  );
}

export async function retryFinancialOperation(
  admin: Admin,
  operationId: string,
  expectedOperationVersion: number,
  idempotency: Idempotency
) {
  return db.transaction(async (tx) => {
    await requireFinancialAssignment(tx, admin, "FINANCIAL_EXECUTE");
    const command = "FINANCIAL_OPERATION_RETRY";
    const prior = await findIdempotentResult(
      tx, admin.id, command, idempotency.key, idempotency.requestHash
    );
    if (prior) return prior;
    await tx.execute(sql`SELECT id FROM financial_operations WHERE id = ${operationId} FOR UPDATE`);
    const [operation] = await tx.select().from(financialOperations)
      .where(eq(financialOperations.id, operationId)).limit(1);
    if (!operation) throw new Error("FINANCIAL_OPERATION_NOT_FOUND");
    assertExpectedStateVersion(operation.stateVersion, expectedOperationVersion);
    if (operation.result !== "FAILED") throw new Error("FINANCIAL_RETRY_NOT_ALLOWED");
    const [retry] = await tx.insert(financialOperations).values({
      transactionId: operation.transactionId,
      type: operation.type,
      result: null,
      amount: operation.amount,
      destinationSnapshot: operation.destinationSnapshot,
      route: operation.route,
      attempt: operation.attempt + 1,
      retryOfOperationId: operation.id,
      rootOperationId: operation.rootOperationId ?? operation.id,
      sourceType: operation.sourceType,
      sourceHandoffId: operation.sourceHandoffId,
      sourceHash: operation.sourceHash,
      sourceFinalizedAt: operation.sourceFinalizedAt,
      sourceState: operation.sourceState,
      sourceStateVersion: operation.sourceStateVersion,
      selectedCapabilityAssessmentId: operation.selectedCapabilityAssessmentId,
      startedByAccountId: admin.id
    }).returning();
    if (!retry) throw new Error("FINANCIAL_RETRY_CREATE_FAILED");
    const result = operationProjection(retry, 0);
    await saveIdempotentResult(
      tx, admin.id, command, idempotency.key, idempotency.requestHash, result
    );
    return result;
  });
}

export async function reconcileFinancialOperation(
  admin: Admin,
  operationId: string,
  input: FinancialReconcileInput,
  idempotency: Idempotency
) {
  await requireFinancialAssignment(db, admin, "FINANCIAL_RECONCILE");
  const [operation] = await db.select().from(financialOperations)
    .where(eq(financialOperations.id, operationId)).limit(1);
  if (!operation) throw new Error("FINANCIAL_OPERATION_NOT_FOUND");
  assertExpectedStateVersion(operation.stateVersion, input.expectedOperationVersion);
  if (operation.result !== "UNKNOWN") throw new Error("FINANCIAL_RECONCILIATION_NOT_REQUIRED");
  const result = await recordFinancialResult(
    operationId,
    input.result,
    input.externalReference ?? null,
    input.evidenceHash ?? null,
    admin.id
  );
  await db.transaction(async (tx) => {
    await saveIdempotentResult(
      tx, admin.id, "FINANCIAL_OPERATION_RECONCILE",
      idempotency.key, idempotency.requestHash, result
    );
  });
  return result;
}

function operationProjection(
  operation: typeof financialOperations.$inferSelect,
  approvals: number
) {
  return {
    id: operation.id,
    transactionId: operation.transactionId,
    type: operation.type,
    lifecycle: operation.result === null ? "PREPARED" : operation.result,
    result: operation.result,
    amount: operation.amount,
    destination: operation.destinationSnapshot,
    route: operation.route,
    attempt: operation.attempt,
    rootOperationId: operation.rootOperationId ?? operation.id,
    sourceType: operation.sourceType,
    stateVersion: operation.stateVersion,
    approvals,
    preparedAt: operation.preparedAt.toISOString(),
    startedAt: operation.startedAt?.toISOString() ?? null,
    completedAt: operation.completedAt?.toISOString() ?? null,
    externalReference: operation.bankReference
  };
}

export async function readFinancialOperation(admin: Admin, operationId: string) {
  await requireAnyFinancialAssignment(db, admin);
  const [operation] = await db.select().from(financialOperations)
    .where(eq(financialOperations.id, operationId)).limit(1);
  if (!operation) throw new Error("FINANCIAL_OPERATION_NOT_FOUND");
  const approvals = await approvalCount(db, operation.rootOperationId ?? operation.id);
  return operationProjection(operation, approvals);
}

export async function readTransactionFinancialOperations(admin: Admin, transactionId: string) {
  await requireAnyFinancialAssignment(db, admin);
  const rows = await db.select().from(financialOperations)
    .where(eq(financialOperations.transactionId, transactionId))
    .orderBy(desc(financialOperations.createdAt));
  return Promise.all(rows.map(async (row) =>
    operationProjection(row, await approvalCount(db, row.rootOperationId ?? row.id))
  ));
}

export async function readFinancialSla(admin: Admin, operationId: string) {
  const operation = await readFinancialOperation(admin, operationId);
  const eligibleAt = operation.preparedAt;
  const targetHours = operation.type === "PAYOUT" ? 24 : 48;
  return {
    operationId,
    eligibleAt,
    approvalAt: operation.approvals >= 2 ? operation.preparedAt : null,
    targetAt: new Date(new Date(eligibleAt).getTime() + targetHours * 60 * 60 * 1000).toISOString(),
    result: operation.result,
    handledAt: operation.completedAt
  };
}
