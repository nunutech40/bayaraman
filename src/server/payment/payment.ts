import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import {
  buyerRefundDestinations,
  buyerShippingAddresses,
  paymentClaims,
  paymentInstructions,
  sellerPayoutDestinations,
  transactionItems,
  transactionParticipants,
  transactionTerms,
  transactions
} from "@/server/db/schema";
import { assertExpectedStateVersion } from "@/server/domain/transaction/state";
import { canParticipate } from "@/server/auth/authorization";
import { findIdempotentResult, saveIdempotentResult } from "@/server/transaction/mutation";
import { recordTransactionEvent } from "@/server/transaction/audit";
import { getReceivingAccount } from "./config";
import { formatWib, maskReceivingAccount } from "./projection";

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const PAYMENT_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function issuePaymentInstructions(
  tx: DatabaseTransaction,
  transactionId: string,
  actorAccountId: string,
  currentStateVersion: number,
  now = new Date()
) {
  const [existing] = await tx.select().from(paymentInstructions)
    .where(eq(paymentInstructions.transactionId, transactionId)).limit(1);
  if (existing) return { instruction: existing, stateVersion: currentStateVersion };

  const [terms] = await tx.select().from(transactionTerms)
    .where(eq(transactionTerms.transactionId, transactionId)).limit(1);
  const [item] = await tx.select().from(transactionItems)
    .where(eq(transactionItems.transactionId, transactionId)).limit(1);
  const [shipping] = await tx.select().from(buyerShippingAddresses)
    .where(eq(buyerShippingAddresses.transactionId, transactionId)).limit(1);
  const [refund] = await tx.select().from(buyerRefundDestinations)
    .where(eq(buyerRefundDestinations.transactionId, transactionId)).limit(1);
  const [payout] = await tx.select().from(sellerPayoutDestinations)
    .where(eq(sellerPayoutDestinations.transactionId, transactionId)).limit(1);
  if (!terms || !item || !shipping || !refund || !payout) {
    throw new Error("PAYMENT_DATA_INCOMPLETE");
  }

  const receivingAccount = getReceivingAccount();
  const deadlineAt = new Date(now.getTime() + PAYMENT_WINDOW_MS);
  await tx.insert(paymentInstructions).values({
    transactionId,
    destinationBank: receivingAccount.bankName,
    destinationAccountValue: receivingAccount.accountNumber,
    destinationAccountMask: maskReceivingAccount(receivingAccount.accountNumber),
    amount: terms.totalAmount,
    issuedAt: now,
    deadlineAt
  });

  await tx.update(transactionItems).set({ lockedAt: now }).where(and(
    eq(transactionItems.transactionId, transactionId),
    isNull(transactionItems.lockedAt)
  ));
  await tx.update(transactionTerms).set({ frozenAt: now }).where(and(
    eq(transactionTerms.transactionId, transactionId),
    isNull(transactionTerms.frozenAt)
  ));
  await tx.update(buyerShippingAddresses).set({ lockedAt: now }).where(and(
    eq(buyerShippingAddresses.transactionId, transactionId),
    isNull(buyerShippingAddresses.lockedAt)
  ));
  await tx.update(buyerRefundDestinations).set({ lockedAt: now }).where(and(
    eq(buyerRefundDestinations.transactionId, transactionId),
    isNull(buyerRefundDestinations.lockedAt)
  ));
  await tx.update(sellerPayoutDestinations).set({ lockedAt: now }).where(and(
    eq(sellerPayoutDestinations.transactionId, transactionId),
    isNull(sellerPayoutDestinations.lockedAt)
  ));

  const nextStateVersion = currentStateVersion + 1;
  const [updated] = await tx.update(transactions).set({
    state: "WAITING_BUYER_PAYMENT",
    stateVersion: nextStateVersion,
    updatedAt: now
  }).where(and(
    eq(transactions.id, transactionId),
    eq(transactions.state, "WAITING_COUNTERPARTY_DATA"),
    eq(transactions.stateVersion, currentStateVersion)
  )).returning({ id: transactions.id });
  if (!updated) throw new Error("STATE_VERSION_CONFLICT");

  await recordTransactionEvent(tx, {
    transactionId,
    actorAccountId,
    eventType: "PAYMENT_INSTRUCTIONS_ISSUED",
    beforeState: "WAITING_COUNTERPARTY_DATA",
    afterState: "WAITING_BUYER_PAYMENT",
    stateVersion: nextStateVersion,
    payload: { amount: terms.totalAmount, issuedAt: now.toISOString(), deadlineAt: deadlineAt.toISOString() }
  });

  return {
    instruction: {
      transactionId,
      destinationBank: receivingAccount.bankName,
      destinationAccountMask: maskReceivingAccount(receivingAccount.accountNumber),
      amount: terms.totalAmount,
      issuedAt: now,
      deadlineAt
    },
    stateVersion: nextStateVersion
  };
}

export async function readPaymentInstructions(transactionId: string, actorAccountId: string) {
  const [participant] = await db.select().from(transactionParticipants).where(and(
    eq(transactionParticipants.transactionId, transactionId),
    eq(transactionParticipants.accountId, actorAccountId)
  )).limit(1);
  if (!participant) throw new Error("TRANSACTION_FORBIDDEN");

  const [transaction] = await db.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
  const [instruction] = await db.select().from(paymentInstructions).where(eq(paymentInstructions.transactionId, transactionId)).limit(1);
  if (!transaction || !instruction) throw new Error("PAYMENT_INSTRUCTIONS_NOT_READY");
  const [claim] = await db.select().from(paymentClaims).where(and(
    eq(paymentClaims.transactionId, transactionId),
    eq(paymentClaims.active, true)
  )).orderBy(desc(paymentClaims.submittedAt)).limit(1);

  return {
    transactionId,
    state: transaction.state,
    stateVersion: transaction.stateVersion,
    amount: instruction.amount,
    destinationBank: instruction.destinationBank,
    destinationAccount: participant.role === "BUYER" ? instruction.destinationAccountValue : instruction.destinationAccountMask,
    destinationAccountMasked: instruction.destinationAccountMask,
    issuedAt: instruction.issuedAt,
    deadlineAt: instruction.deadlineAt,
    deadlineWib: formatWib(instruction.deadlineAt),
    claim: claim ? { id: claim.id, submittedAt: claim.submittedAt } : null
  };
}

export async function submitPaymentClaim(
  actor: { id: string; whatsappVerifiedAt: Date | null; isAdmin: boolean },
  transactionId: string,
  expectedStateVersion: number | undefined,
  note: string | undefined,
  idempotency: { key: string; requestHash: string }
) {
  if (!canParticipate(actor) || actor.isAdmin) throw new Error("PARTICIPATION_NOT_ALLOWED");

  return db.transaction(async (tx) => {
    const prior = await findIdempotentResult(tx, actor.id, "PAYMENT_CLAIM_SUBMIT", idempotency.key, idempotency.requestHash);
    if (prior) return prior;

    const [transaction] = await tx.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
    const [participant] = await tx.select().from(transactionParticipants).where(and(
      eq(transactionParticipants.transactionId, transactionId),
      eq(transactionParticipants.accountId, actor.id)
    )).limit(1);
    const [instruction] = await tx.select().from(paymentInstructions).where(eq(paymentInstructions.transactionId, transactionId)).limit(1);
    if (!transaction || !instruction || !participant) throw new Error("PAYMENT_CLAIM_NOT_ALLOWED");
    if (participant.role !== "BUYER") throw new Error("PAYMENT_CLAIM_BUYER_ONLY");
    if (transaction.state !== "WAITING_BUYER_PAYMENT") throw new Error("PAYMENT_CLAIM_NOT_ALLOWED");
    if (expectedStateVersion !== undefined) assertExpectedStateVersion(transaction.stateVersion, expectedStateVersion);

    const now = new Date();
    if (now.getTime() >= instruction.deadlineAt.getTime()) throw new Error("PAYMENT_DEADLINE_PASSED");

    const [claim] = await tx.insert(paymentClaims).values({
      transactionId,
      submittedByAccountId: actor.id,
      submittedAt: now,
      metadata: note ? { note } : null
    }).returning({ id: paymentClaims.id, submittedAt: paymentClaims.submittedAt });
    if (!claim) throw new Error("PAYMENT_CLAIM_FAILED");

    const nextStateVersion = transaction.stateVersion + 1;
    const [updated] = await tx.update(transactions).set({
      state: "PAYMENT_UNDER_REVIEW",
      stateVersion: nextStateVersion,
      updatedAt: now
    }).where(and(
      eq(transactions.id, transactionId),
      eq(transactions.state, "WAITING_BUYER_PAYMENT"),
      eq(transactions.stateVersion, transaction.stateVersion)
    )).returning({ id: transactions.id });
    if (!updated) throw new Error("STATE_VERSION_CONFLICT");

    await recordTransactionEvent(tx, {
      transactionId,
      actorAccountId: actor.id,
      eventType: "PAYMENT_CLAIM_SUBMITTED",
      beforeState: "WAITING_BUYER_PAYMENT",
      afterState: "PAYMENT_UNDER_REVIEW",
      stateVersion: nextStateVersion,
      payload: { claimId: claim.id, submittedAt: now.toISOString() }
    });
    const result = { transactionId, claimId: claim.id, submittedAt: claim.submittedAt, state: "PAYMENT_UNDER_REVIEW" as const, stateVersion: nextStateVersion };
    await saveIdempotentResult(tx, actor.id, "PAYMENT_CLAIM_SUBMIT", idempotency.key, idempotency.requestHash, result);
    return result;
  });
}
