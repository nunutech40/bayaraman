import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import {
  buyerRefundDestinations,
  buyerShippingAddresses,
  invitations,
  sellerPayoutDestinations,
  transactionItems,
  transactionParticipants,
  transactionTerms,
  transactions
} from "@/server/db/schema";
import { assertExpectedStateVersion, type TransactionState } from "@/server/domain/transaction/state";
import { canParticipate } from "@/server/auth/authorization";
import { calculateTransactionAmounts, maskAccountNumber } from "./calculation";
import type { CreateTransactionInput, RoleDataInput } from "./contracts";
import { findIdempotentResult, saveIdempotentResult } from "./mutation";
import { recordTransactionEvent } from "./audit";
import { createInvitationToken } from "./token";
import { issuePaymentInstructions } from "@/server/payment/payment";

const INVITATION_TTL_MS = 3 * 24 * 60 * 60 * 1000;

function oppositeRole(role: "BUYER" | "SELLER"): "BUYER" | "SELLER" {
  return role === "BUYER" ? "SELLER" : "BUYER";
}

function destinationValues(destination: { bankName: string; accountHolderName: string; accountNumber: string }) {
  return {
    bankName: destination.bankName,
    accountHolderName: destination.accountHolderName,
    rawAccountValue: destination.accountNumber,
    maskedAccountValue: maskAccountNumber(destination.accountNumber)
  };
}

export async function createTransaction(
  actor: { id: string; displayName: string; whatsappNumber: string; whatsappVerifiedAt: Date | null; isAdmin: boolean },
  input: CreateTransactionInput,
  idempotency: { key: string; requestHash: string }
) {
  if (!canParticipate(actor) || actor.isAdmin) {
    throw new Error("PARTICIPATION_NOT_ALLOWED");
  }

  const amounts = calculateTransactionAmounts(input.itemPrice, input.shippingCost);
  return db.transaction(async (tx) => {
    const prior = await findIdempotentResult(tx, actor.id, "TRANSACTION_CREATE", idempotency.key, idempotency.requestHash);
    if (prior) return prior;

    const now = new Date();
    const [transaction] = await tx.insert(transactions).values({
      creatorAccountId: actor.id,
      creatorRole: input.role,
      state: "WAITING_COUNTERPARTY",
      stateVersion: 0,
      createdAt: now,
      updatedAt: now
    }).returning();
    if (!transaction) throw new Error("TRANSACTION_CREATE_FAILED");

    await tx.insert(transactionParticipants).values({
      transactionId: transaction.id,
      accountId: actor.id,
      role: input.role,
      nameSnapshot: actor.displayName,
      whatsappSnapshot: actor.whatsappNumber,
      joinedAt: now
    });
    await tx.insert(transactionTerms).values({
      transactionId: transaction.id,
      itemDescription: input.description,
      itemPrice: input.itemPrice,
      shippingCost: input.shippingCost,
      serviceFee: amounts.serviceFee,
      totalAmount: amounts.totalAmount
    });
    await tx.insert(transactionItems).values({
      transactionId: transaction.id,
      itemName: input.itemName,
      description: input.description,
      category: input.category,
      condition: input.condition,
      quantity: input.quantity,
      photoReference: input.photoReference
    });

    if (input.role === "SELLER") {
      await tx.insert(sellerPayoutDestinations).values({
        transactionId: transaction.id,
        participantAccountId: actor.id,
        ...destinationValues(input.payout)
      });
    } else {
      await tx.insert(buyerShippingAddresses).values({
        transactionId: transaction.id,
        participantAccountId: actor.id,
        recipientName: input.shipping.recipientName,
        phoneSnapshot: actor.whatsappNumber,
        addressLine: input.shipping.addressLine,
        district: input.shipping.district,
        city: input.shipping.city,
        province: input.shipping.province,
        postalCode: input.shipping.postalCode
      });
      await tx.insert(buyerRefundDestinations).values({
        transactionId: transaction.id,
        participantAccountId: actor.id,
        ...destinationValues(input.refund)
      });
    }

    const invitation = createInvitationToken();
    await tx.insert(invitations).values({
      transactionId: transaction.id,
      targetRole: oppositeRole(input.role),
      tokenHash: invitation.tokenHash,
      expiresAt: new Date(now.getTime() + INVITATION_TTL_MS)
    });

    await recordTransactionEvent(tx, {
      transactionId: transaction.id,
      actorAccountId: actor.id,
      eventType: "TRANSACTION_CREATED",
      afterState: "WAITING_COUNTERPARTY",
      stateVersion: 0,
      payload: { creatorRole: input.role, targetRole: oppositeRole(input.role) }
    });
    await recordTransactionEvent(tx, {
      transactionId: transaction.id,
      actorAccountId: actor.id,
      eventType: "INVITATION_ISSUED",
      stateVersion: 0,
      payload: { targetRole: oppositeRole(input.role) }
    });

    const result = {
      transactionId: transaction.id,
      state: transaction.state,
      stateVersion: transaction.stateVersion,
      invitationToken: invitation.rawToken,
      targetRole: oppositeRole(input.role),
      readyForPaymentInstructions: false
    };
    await saveIdempotentResult(tx, actor.id, "TRANSACTION_CREATE", idempotency.key, idempotency.requestHash, result);
    return result;
  });
}

export async function joinInvitation(
  actor: { id: string; displayName: string; whatsappNumber: string; whatsappVerifiedAt: Date | null; isAdmin: boolean },
  invitationId: string,
  expectedStateVersion: number | undefined,
  idempotency: { key: string; requestHash: string }
) {
  if (!canParticipate(actor) || actor.isAdmin) throw new Error("PARTICIPATION_NOT_ALLOWED");

  return db.transaction(async (tx) => {
    const prior = await findIdempotentResult(tx, actor.id, "INVITATION_JOIN", idempotency.key, idempotency.requestHash);
    if (prior) return prior;

    const [invitation] = await tx.select().from(invitations).where(eq(invitations.id, invitationId)).limit(1);
    if (!invitation || invitation.revokedAt || invitation.usedAt || invitation.expiresAt.getTime() <= Date.now()) {
      throw new Error("INVITATION_INVALID");
    }
    if (invitation.targetRole === "ADMIN") throw new Error("INVITATION_INVALID");
    if (invitation.targetRole === "BUYER" || invitation.targetRole === "SELLER") {
      const [transaction] = await tx.select().from(transactions).where(eq(transactions.id, invitation.transactionId)).limit(1);
      if (!transaction || transaction.state !== "WAITING_COUNTERPARTY") throw new Error("INVITATION_NOT_JOINABLE");
      if (expectedStateVersion !== undefined) assertExpectedStateVersion(transaction.stateVersion, expectedStateVersion);
      if (transaction.creatorAccountId === actor.id) {
        await recordTransactionEvent(tx, { transactionId: transaction.id, actorAccountId: actor.id, eventType: "SELF_JOIN_DENIED", stateVersion: transaction.stateVersion });
        throw new Error("SELF_JOIN_NOT_ALLOWED");
      }

      const [existingParticipant] = await tx.select().from(transactionParticipants).where(and(
        eq(transactionParticipants.transactionId, transaction.id),
        eq(transactionParticipants.role, invitation.targetRole)
      )).limit(1);
      if (existingParticipant) throw new Error("ROLE_ALREADY_BOUND");

      const now = new Date();
      await tx.insert(transactionParticipants).values({
        transactionId: transaction.id,
        accountId: actor.id,
        role: invitation.targetRole,
        nameSnapshot: actor.displayName,
        whatsappSnapshot: actor.whatsappNumber,
        joinedAt: now
      });
      await tx.update(invitations).set({ usedAt: now }).where(and(eq(invitations.id, invitation.id), isNull(invitations.usedAt), isNull(invitations.revokedAt)));
      await tx.update(transactions).set({ state: "WAITING_COUNTERPARTY_DATA", stateVersion: transaction.stateVersion + 1, updatedAt: now }).where(and(eq(transactions.id, transaction.id), eq(transactions.stateVersion, transaction.stateVersion)));
      await recordTransactionEvent(tx, { transactionId: transaction.id, actorAccountId: actor.id, eventType: "COUNTERPARTY_JOINED", beforeState: "WAITING_COUNTERPARTY", afterState: "WAITING_COUNTERPARTY_DATA", stateVersion: transaction.stateVersion + 1, payload: { role: invitation.targetRole } });

      const result = { transactionId: transaction.id, state: "WAITING_COUNTERPARTY_DATA" as const, stateVersion: transaction.stateVersion + 1, readyForPaymentInstructions: false };
      await saveIdempotentResult(tx, actor.id, "INVITATION_JOIN", idempotency.key, idempotency.requestHash, result);
      return result;
    }
    throw new Error("INVITATION_INVALID");
  });
}

export async function saveRoleData(
  actor: { id: string; displayName: string; whatsappNumber: string; whatsappVerifiedAt: Date | null },
  transactionId: string,
  input: RoleDataInput,
  expectedStateVersion: number | undefined,
  idempotency: { key: string; requestHash: string }
) {
  if (!canParticipate(actor)) throw new Error("PARTICIPATION_NOT_ALLOWED");

  return db.transaction(async (tx) => {
    const prior = await findIdempotentResult(tx, actor.id, "ROLE_DATA_SAVE", idempotency.key, idempotency.requestHash);
    if (prior) return prior;

    const [transaction] = await tx.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
    if (!transaction || transaction.state !== "WAITING_COUNTERPARTY_DATA") throw new Error("ROLE_DATA_NOT_EDITABLE");
    if (expectedStateVersion !== undefined) assertExpectedStateVersion(transaction.stateVersion, expectedStateVersion);

    const [participant] = await tx.select().from(transactionParticipants).where(and(eq(transactionParticipants.transactionId, transactionId), eq(transactionParticipants.accountId, actor.id))).limit(1);
    if (!participant || participant.role !== input.role) throw new Error("ROLE_DATA_NOT_OWNED");

    const locked = input.role === "BUYER"
      ? await tx.select().from(buyerRefundDestinations).where(and(eq(buyerRefundDestinations.transactionId, transactionId), eq(buyerRefundDestinations.participantAccountId, actor.id))).limit(1)
      : await tx.select().from(sellerPayoutDestinations).where(and(eq(sellerPayoutDestinations.transactionId, transactionId), eq(sellerPayoutDestinations.participantAccountId, actor.id))).limit(1);
    if (locked[0]?.lockedAt) throw new Error("ROLE_DATA_LOCKED");

    if (input.role === "BUYER") {
      await tx.insert(buyerShippingAddresses).values({ transactionId, participantAccountId: actor.id, recipientName: input.shipping.recipientName, phoneSnapshot: actor.whatsappNumber, addressLine: input.shipping.addressLine, district: input.shipping.district, city: input.shipping.city, province: input.shipping.province, postalCode: input.shipping.postalCode }).onConflictDoUpdate({ target: [buyerShippingAddresses.transactionId, buyerShippingAddresses.participantAccountId], set: { recipientName: input.shipping.recipientName, phoneSnapshot: actor.whatsappNumber, addressLine: input.shipping.addressLine, district: input.shipping.district, city: input.shipping.city, province: input.shipping.province, postalCode: input.shipping.postalCode } });
      await tx.insert(buyerRefundDestinations).values({ transactionId, participantAccountId: actor.id, ...destinationValues(input.refund) }).onConflictDoUpdate({ target: [buyerRefundDestinations.transactionId, buyerRefundDestinations.participantAccountId], set: destinationValues(input.refund) });
    } else {
      await tx.insert(sellerPayoutDestinations).values({ transactionId, participantAccountId: actor.id, ...destinationValues(input.payout) }).onConflictDoUpdate({ target: [sellerPayoutDestinations.transactionId, sellerPayoutDestinations.participantAccountId], set: destinationValues(input.payout) });
    }

    const [buyer] = await tx.select().from(transactionParticipants).where(and(eq(transactionParticipants.transactionId, transactionId), eq(transactionParticipants.role, "BUYER"))).limit(1);
    const [seller] = await tx.select().from(transactionParticipants).where(and(eq(transactionParticipants.transactionId, transactionId), eq(transactionParticipants.role, "SELLER"))).limit(1);
    const [buyerAddress] = buyer ? await tx.select().from(buyerShippingAddresses).where(and(eq(buyerShippingAddresses.transactionId, transactionId), eq(buyerShippingAddresses.participantAccountId, buyer.accountId))).limit(1) : [];
    const [buyerRefund] = buyer ? await tx.select().from(buyerRefundDestinations).where(and(eq(buyerRefundDestinations.transactionId, transactionId), eq(buyerRefundDestinations.participantAccountId, buyer.accountId))).limit(1) : [];
    const [sellerPayout] = seller ? await tx.select().from(sellerPayoutDestinations).where(and(eq(sellerPayoutDestinations.transactionId, transactionId), eq(sellerPayoutDestinations.participantAccountId, seller.accountId))).limit(1) : [];
    const ready = Boolean(buyer && seller && buyerAddress && buyerRefund && sellerPayout);
    const nextStateVersion = transaction.stateVersion + 1;
    let result: { transactionId: string; state: TransactionState; stateVersion: number; readyForPaymentInstructions: boolean };
    if (ready) {
      const issued = await issuePaymentInstructions(tx, transactionId, actor.id, transaction.stateVersion);
      result = {
        transactionId,
        state: "WAITING_BUYER_PAYMENT",
        stateVersion: issued.stateVersion,
        readyForPaymentInstructions: true
      };
      await recordTransactionEvent(tx, {
        transactionId,
        actorAccountId: actor.id,
        eventType: "ROLE_DATA_COMPLETED",
        beforeState: transaction.state,
        afterState: "WAITING_BUYER_PAYMENT",
        stateVersion: issued.stateVersion,
        payload: { role: input.role, readyForPaymentInstructions: true }
      });
    } else {
      const [updatedTransaction] = await tx.update(transactions)
        .set({ stateVersion: nextStateVersion, updatedAt: new Date() })
        .where(and(eq(transactions.id, transactionId), eq(transactions.stateVersion, transaction.stateVersion)))
        .returning({ id: transactions.id });
      if (!updatedTransaction) throw new Error("STATE_VERSION_CONFLICT");
      result = { transactionId, state: transaction.state, stateVersion: nextStateVersion, readyForPaymentInstructions: false };
      await recordTransactionEvent(tx, { transactionId, actorAccountId: actor.id, eventType: "ROLE_DATA_COMPLETED", stateVersion: nextStateVersion, payload: { role: input.role, readyForPaymentInstructions: false } });
    }
    await saveIdempotentResult(tx, actor.id, "ROLE_DATA_SAVE", idempotency.key, idempotency.requestHash, result);
    return result;
  });
}
