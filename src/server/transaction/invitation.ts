import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { invitations, transactionItems, transactionParticipants, transactionTerms, transactions } from "@/server/db/schema";
import { assertExpectedStateVersion } from "@/server/domain/transaction/state";
import { recordTransactionEvent } from "./audit";
import { findIdempotentResult, saveIdempotentResult } from "./mutation";
import { createInvitationToken, hashInvitationToken } from "./token";
import { canParticipate } from "@/server/auth/authorization";
import { recordRejectedMutationEvent } from "./audit";
import { randomUUID } from "node:crypto";

export async function previewInvitation(rawToken: string) {
  const tokenHash = hashInvitationToken(rawToken);
  const [row] = await db
    .select({
      invitation: invitations,
      transaction: transactions,
      terms: transactionTerms,
      item: transactionItems
    })
    .from(invitations)
    .innerJoin(transactions, eq(invitations.transactionId, transactions.id))
    .innerJoin(transactionTerms, eq(transactions.id, transactionTerms.transactionId))
    .innerJoin(transactionItems, eq(transactions.id, transactionItems.transactionId))
    .where(eq(invitations.tokenHash, tokenHash))
    .limit(1);

  if (!row || row.invitation.revokedAt || row.invitation.usedAt || row.invitation.expiresAt.getTime() <= Date.now()) {
    throw new Error("INVITATION_INVALID");
  }

  const participants = await db
    .select({ role: transactionParticipants.role, name: transactionParticipants.nameSnapshot })
    .from(transactionParticipants)
    .where(eq(transactionParticipants.transactionId, row.transaction.id));

  return {
    transactionId: row.transaction.id,
    targetRole: row.invitation.targetRole,
    state: row.transaction.state,
    expiresAt: row.invitation.expiresAt,
    item: { itemName: row.item.itemName, description: row.item.description, category: row.item.category, condition: row.item.condition, quantity: row.item.quantity },
    terms: { itemPrice: row.terms.itemPrice, shippingCost: row.terms.shippingCost, serviceFee: row.terms.serviceFee, totalAmount: row.terms.totalAmount },
    participants
  };
}

export async function reissueInvitation(
  actor: { id: string; isAdmin: boolean; whatsappVerifiedAt: Date | null },
  transactionId: string,
  expectedStateVersion: number | undefined,
  idempotency: { key: string; requestHash: string }
) {
  const correlationId = randomUUID();
  try {
    if (!canParticipate(actor) || actor.isAdmin) throw new Error("PARTICIPATION_NOT_ALLOWED");

    return await db.transaction(async (tx) => {
    const prior = await findIdempotentResult(tx, actor.id, "INVITATION_REISSUE", idempotency.key, idempotency.requestHash);
    if (prior) return prior;
    await tx.execute(sql`SELECT id FROM transactions WHERE id = ${transactionId} FOR UPDATE`);
    const [transaction] = await tx.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
    if (!transaction || transaction.creatorAccountId !== actor.id || transaction.state !== "WAITING_COUNTERPARTY") throw new Error("INVITATION_REISSUE_NOT_ALLOWED");
    if (expectedStateVersion !== undefined) assertExpectedStateVersion(transaction.stateVersion, expectedStateVersion);
    const [counterparty] = await tx.select().from(transactionParticipants).where(and(eq(transactionParticipants.transactionId, transactionId), eq(transactionParticipants.accountId, actor.id))).limit(1);
    if (!counterparty) throw new Error("INVITATION_REISSUE_NOT_ALLOWED");

    const now = new Date();
    await tx.update(invitations).set({ revokedAt: now }).where(and(eq(invitations.transactionId, transactionId), isNull(invitations.usedAt), isNull(invitations.revokedAt)));
    const invitation = createInvitationToken();
    const targetRole = transaction.creatorRole === "BUYER" ? "SELLER" : "BUYER";
    await tx.insert(invitations).values({ transactionId, targetRole, tokenHash: invitation.tokenHash, expiresAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) });
    await recordTransactionEvent(tx, { transactionId, actorAccountId: actor.id, eventType: "INVITATION_REISSUED", stateVersion: transaction.stateVersion, payload: { targetRole } });
    const result = { transactionId, state: transaction.state, stateVersion: transaction.stateVersion, invitationToken: invitation.rawToken, targetRole };
    await saveIdempotentResult(tx, actor.id, "INVITATION_REISSUE", idempotency.key, idempotency.requestHash, result);
    return result;
    });
  } catch (error) {
    await recordRejectedMutationEvent({
      transactionId,
      actorAccountId: actor.id,
      eventType: "TRANSACTION_MUTATION_REJECTED",
      correlationId,
      reason: error instanceof Error ? error.message : "MUTATION_REJECTED"
    }).catch(() => undefined);
    throw error;
  }
}
