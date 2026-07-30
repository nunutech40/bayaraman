import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  accounts,
  complaintHolds,
  confirmationExceptions,
  confirmationLinks,
  confirmationOtps,
  riskHolds,
  transactionParticipants,
  transactions,
  whatsappCheckpointHeads,
  whatsappCheckpoints
} from "@/server/db/schema";
import { createManualWhatsappDeliveryAdapter, type WhatsappDeliveryAdapter } from "@/server/auth/whatsapp-delivery";
import { findIdempotentResult, saveIdempotentResult } from "@/server/transaction/mutation";
import { recordTransactionEvent } from "@/server/transaction/audit";
import { assertExpectedStateVersion } from "@/server/domain/transaction/state";

const LINK_TTL_MS = 2 * 24 * 60 * 60 * 1000;
const REMINDER_MS = 24 * 60 * 60 * 1000;
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_COOLDOWN_MS = 60 * 1000;
const OTP_WINDOW_MS = 30 * 60 * 1000;
const OTP_LOCK_MS = 30 * 60 * 1000;

type Idempotency = { key: string; requestHash: string };

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function maskWhatsapp(value: string): string {
  const digits = value.replace(/\D/g, "");
  return `••••${digits.slice(-4)}`;
}

function newToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("hex");
  return { raw, hash: hashValue(raw) };
}

function assertAdmin(account: { id: string; isAdmin: boolean }): void {
  if (!account.isAdmin) throw new Error("FORBIDDEN");
}

async function lockTransaction(tx: any, transactionId: string) {
  await tx.execute(sql`SELECT id FROM transactions WHERE id = ${transactionId} FOR UPDATE`);
  const [transaction] = await tx.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
  if (!transaction) throw new Error("TRANSACTION_NOT_FOUND");
  return transaction;
}

async function assertNoHold(tx: any, transactionId: string): Promise<void> {
  const [complaint] = await tx.select({ id: complaintHolds.id }).from(complaintHolds).where(and(
    eq(complaintHolds.transactionId, transactionId),
    eq(complaintHolds.active, true)
  )).limit(1);
  const [risk] = await tx.select({ id: riskHolds.id }).from(riskHolds).where(and(
    eq(riskHolds.transactionId, transactionId),
    eq(riskHolds.active, true)
  )).limit(1);
  if (complaint || risk) throw new Error("CONFIRMATION_HOLD");
}

async function buyerForTransaction(tx: any, transactionId: string) {
  const [buyer] = await tx.select().from(transactionParticipants).where(and(
    eq(transactionParticipants.transactionId, transactionId),
    eq(transactionParticipants.role, "BUYER")
  )).limit(1);
  if (!buyer) throw new Error("BUYER_NOT_FOUND");
  return buyer;
}

async function assertVerifiedBuyer(tx: any, accountId: string): Promise<void> {
  const [account] = await tx.select({ whatsappVerifiedAt: accounts.whatsappVerifiedAt }).from(accounts).where(eq(accounts.id, accountId)).limit(1);
  if (!account?.whatsappVerifiedAt) throw new Error("WHATSAPP_NOT_VERIFIED");
}

async function linkByToken(tx: any, token: string) {
  const [link] = await tx.select().from(confirmationLinks).where(eq(confirmationLinks.tokenHash, hashValue(token))).limit(1);
  if (!link) throw new Error("CONFIRMATION_LINK_INVALID");
  return link;
}

function linkProjection(link: typeof confirmationLinks.$inferSelect, state: string, stateVersion: number, rawToken?: string) {
  return {
    confirmationLinkId: link.id,
    transactionId: link.transactionId,
    buyerWhatsapp: maskWhatsapp(link.buyerWhatsappSnapshot),
    expiresAt: link.expiresAt.toISOString(),
    reminderDueAt: link.reminderDueAt.toISOString(),
    state,
    stateVersion,
    ...(rawToken ? { postingUrl: `/confirm/${rawToken}` } : {})
  };
}

export async function createConfirmationLink(admin: { id: string; isAdmin: boolean }, transactionId: string, expectedStateVersion: number, idempotency: Idempotency) {
  assertAdmin(admin);
  return db.transaction(async (tx) => {
    const command = "CONFIRMATION_LINK_CREATE";
    const prior = await findIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash);
    if (prior) return prior;
    const transaction = await lockTransaction(tx, transactionId);
    assertExpectedStateVersion(transaction.stateVersion, expectedStateVersion);
    if (transaction.state !== "READY_FOR_BUYER_CONFIRMATION") throw new Error("CONFIRMATION_LINK_NOT_READY");
    await assertNoHold(tx, transactionId);
    const buyer = await buyerForTransaction(tx, transactionId);
    const completionTypes = await tx.select({ type: whatsappCheckpointHeads.checkpointType })
      .from(whatsappCheckpointHeads)
      .innerJoin(whatsappCheckpoints, eq(whatsappCheckpointHeads.currentCheckpointId, whatsappCheckpoints.id))
      .where(and(eq(whatsappCheckpointHeads.transactionId, transactionId), sql`${whatsappCheckpointHeads.checkpointType} IN ('SELLER_COMPLETION', 'BUYER_COMPLETION')`));
    if (new Set(completionTypes.map((row: { type: string }) => row.type)).size !== 2) throw new Error("COMPLETION_CHECKPOINTS_REQUIRED");
    const { raw, hash } = newToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + LINK_TTL_MS);
    const [link] = await tx.insert(confirmationLinks).values({
      transactionId,
      buyerAccountId: buyer.accountId,
      tokenHash: hash,
      buyerWhatsappSnapshot: buyer.whatsappSnapshot,
      expiresAt,
      reminderDueAt: new Date(now.getTime() + REMINDER_MS),
      idempotencyKey: idempotency.key,
      createdAt: now
    }).returning();
    if (!link) throw new Error("CONFIRMATION_LINK_CREATE_FAILED");
    const [updated] = await tx.update(transactions).set({
      state: "WAITING_BUYER_CONFIRMATION",
      stateVersion: transaction.stateVersion + 1,
      updatedAt: now
    }).where(and(eq(transactions.id, transactionId), eq(transactions.state, "READY_FOR_BUYER_CONFIRMATION"), eq(transactions.stateVersion, transaction.stateVersion))).returning({ id: transactions.id });
    if (!updated) throw new Error("STATE_VERSION_CONFLICT");
    await recordTransactionEvent(tx, {
      transactionId,
      actorAccountId: admin.id,
      eventType: "CONFIRMATION_LINK_CREATED",
      beforeState: "READY_FOR_BUYER_CONFIRMATION",
      afterState: "WAITING_BUYER_CONFIRMATION",
      stateVersion: transaction.stateVersion + 1,
      correlationId: randomUUID(),
      payload: { confirmationLinkId: link.id, expiresAt: expiresAt.toISOString() }
    });
    const result = linkProjection(link, "WAITING_BUYER_CONFIRMATION", transaction.stateVersion + 1, raw);
    await saveIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash, result);
    return result;
  });
}

export async function readBuyerConfirmation(accountId: string, token: string) {
  const link = await linkByToken(db, token);
  if (link.buyerAccountId !== accountId) throw new Error("CONFIRMATION_FORBIDDEN");
  const [account] = await db.select({ whatsappVerifiedAt: accounts.whatsappVerifiedAt }).from(accounts).where(eq(accounts.id, accountId)).limit(1);
  if (!account?.whatsappVerifiedAt) throw new Error("WHATSAPP_NOT_VERIFIED");
  const [transaction] = await db.select().from(transactions).where(eq(transactions.id, link.transactionId)).limit(1);
  if (!transaction) throw new Error("TRANSACTION_NOT_FOUND");
  if (new Date() >= link.expiresAt || link.usedAt) throw new Error("CONFIRMATION_LINK_EXPIRED");
  if (transaction.state !== "WAITING_BUYER_CONFIRMATION") throw new Error("CONFIRMATION_NOT_AVAILABLE");
  const [latest] = await db.select().from(confirmationOtps).where(eq(confirmationOtps.confirmationLinkId, link.id)).orderBy(desc(confirmationOtps.createdAt)).limit(1);
  return { ...linkProjection(link, transaction.state, transaction.stateVersion), otp: latest ? { deliveryResult: latest.deliveryResult, attempts: latest.attempts, expiresAt: latest.expiresAt.toISOString(), cooldownUntil: latest.cooldownUntil?.toISOString() ?? null, lockedUntil: latest.lockedUntil?.toISOString() ?? null } : null };
}

export async function requestConfirmationOtp(accountId: string, token: string, idempotency: Idempotency, adapter: WhatsappDeliveryAdapter = createManualWhatsappDeliveryAdapter()) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const created = await db.transaction(async (tx) => {
    const command = "CONFIRMATION_OTP_REQUEST";
    const prior = await findIdempotentResult(tx, accountId, command, idempotency.key, idempotency.requestHash);
    if (prior) return { prior, challenge: null };
    const link = await linkByToken(tx, token);
    if (link.buyerAccountId !== accountId) throw new Error("CONFIRMATION_FORBIDDEN");
    await assertVerifiedBuyer(tx, accountId);
    const transaction = await lockTransaction(tx, link.transactionId);
    const buyer = await buyerForTransaction(tx, link.transactionId);
    if (buyer.whatsappSnapshot !== link.buyerWhatsappSnapshot) throw new Error("BUYER_SNAPSHOT_MISMATCH");
    if (transaction.state !== "WAITING_BUYER_CONFIRMATION" || link.usedAt || new Date() >= link.expiresAt) throw new Error("CONFIRMATION_NOT_AVAILABLE");
    await assertNoHold(tx, link.transactionId);
    const now = new Date();
    const [latest] = await tx.select().from(confirmationOtps).where(eq(confirmationOtps.confirmationLinkId, link.id)).orderBy(desc(confirmationOtps.createdAt)).limit(1);
    if (latest?.cooldownUntil && latest.cooldownUntil > now) throw new Error("OTP_COOLDOWN");
    const windowStart = latest?.sendWindowStartedAt && now.getTime() - latest.sendWindowStartedAt.getTime() < OTP_WINDOW_MS ? latest.sendWindowStartedAt : now;
    const sendCount = latest?.sendWindowStartedAt && windowStart === latest.sendWindowStartedAt ? latest.sendCount : 0;
    if (sendCount >= 3) throw new Error("OTP_SEND_LIMIT");
    await tx.update(confirmationOtps).set({ supersededAt: now }).where(and(eq(confirmationOtps.confirmationLinkId, link.id), isNull(confirmationOtps.supersededAt), isNull(confirmationOtps.verifiedAt)));
    const [challenge] = await tx.insert(confirmationOtps).values({
      confirmationLinkId: link.id,
      codeHash: hashValue(code),
      attempts: 0,
      expiresAt: new Date(now.getTime() + OTP_TTL_MS),
      lastRequestedAt: now,
      sendWindowStartedAt: windowStart,
      sendCount: sendCount + 1,
      cooldownUntil: new Date(now.getTime() + OTP_COOLDOWN_MS),
      idempotencyKey: idempotency.key,
      deliveryResult: "PENDING"
    }).returning();
    if (!challenge) throw new Error("OTP_CREATE_FAILED");
    return { prior: null, challenge };
  });
  if (created.prior) return created.prior;
  const [deliveryAccount] = await db.select({ whatsappNumber: accounts.whatsappNumber }).from(accounts).where(eq(accounts.id, accountId)).limit(1);
  const delivery = await adapter.send({ destination: deliveryAccount?.whatsappNumber ?? "", code, challengeId: created.challenge!.id }).catch(() => "UNKNOWN" as const);
  const result = { challengeId: created.challenge!.id, delivery, expiresAt: created.challenge!.expiresAt.toISOString(), cooldownUntil: created.challenge!.cooldownUntil?.toISOString() ?? null };
  await db.transaction(async (tx) => {
    await tx.update(confirmationOtps).set({ deliveryResult: delivery }).where(eq(confirmationOtps.id, created.challenge!.id));
    await saveIdempotentResult(tx, accountId, "CONFIRMATION_OTP_REQUEST", idempotency.key, idempotency.requestHash, result);
  });
  return result;
}

export async function verifyConfirmationOtp(accountId: string, token: string, input: { challengeId: string; code: string; expectedStateVersion: number }, idempotency: Idempotency) {
  return db.transaction(async (tx) => {
    const command = "CONFIRMATION_OTP_VERIFY";
    const prior = await findIdempotentResult(tx, accountId, command, idempotency.key, idempotency.requestHash);
    if (prior) return prior;
    const link = await linkByToken(tx, token);
    if (link.buyerAccountId !== accountId) throw new Error("CONFIRMATION_FORBIDDEN");
    await assertVerifiedBuyer(tx, accountId);
    const transaction = await lockTransaction(tx, link.transactionId);
    assertExpectedStateVersion(transaction.stateVersion, input.expectedStateVersion);
    const [challenge] = await tx.select().from(confirmationOtps).where(and(eq(confirmationOtps.id, input.challengeId), eq(confirmationOtps.confirmationLinkId, link.id))).for("update").limit(1);
    if (!challenge || challenge.supersededAt || challenge.verifiedAt) throw new Error("OTP_INVALID");
    const now = new Date();
    if (link.usedAt || link.expiresAt <= now || challenge.expiresAt <= now) throw new Error("OTP_EXPIRED");
    if (challenge.lockedUntil && challenge.lockedUntil > now) throw new Error("OTP_LOCKED");
    if (challenge.attempts >= 5) throw new Error("OTP_LOCKED");
    const valid = hashValue(input.code) === challenge.codeHash;
    const attempts = challenge.attempts + 1;
    if (!valid) {
      await tx.update(confirmationOtps).set({ attempts, lockedUntil: attempts >= 5 ? new Date(now.getTime() + OTP_LOCK_MS) : null }).where(eq(confirmationOtps.id, challenge.id));
      const result = { verified: false, state: transaction.state, stateVersion: transaction.stateVersion, attempts };
      await saveIdempotentResult(tx, accountId, command, idempotency.key, idempotency.requestHash, result);
      await recordTransactionEvent(tx, { transactionId: transaction.id, actorAccountId: accountId, eventType: "CONFIRMATION_OTP_FAILED", stateVersion: transaction.stateVersion, correlationId: randomUUID(), payload: { attempts } });
      return result;
    }
    await tx.update(confirmationOtps).set({ attempts, verifiedAt: now }).where(and(eq(confirmationOtps.id, challenge.id), isNull(confirmationOtps.verifiedAt), isNull(confirmationOtps.supersededAt)));
    const [updatedLink] = await tx.update(confirmationLinks).set({ usedAt: now }).where(and(eq(confirmationLinks.id, link.id), isNull(confirmationLinks.usedAt))).returning({ id: confirmationLinks.id });
    if (!updatedLink) throw new Error("CONFIRMATION_ALREADY_USED");
    const [updated] = await tx.update(transactions).set({ state: "READY_FOR_PAYOUT", stateVersion: transaction.stateVersion + 1, updatedAt: now }).where(and(eq(transactions.id, transaction.id), eq(transactions.state, "WAITING_BUYER_CONFIRMATION"), eq(transactions.stateVersion, transaction.stateVersion))).returning({ id: transactions.id });
    if (!updated) throw new Error("STATE_VERSION_CONFLICT");
    await recordTransactionEvent(tx, { transactionId: transaction.id, actorAccountId: accountId, eventType: "BUYER_CONFIRMATION_RECORDED", beforeState: "WAITING_BUYER_CONFIRMATION", afterState: "READY_FOR_PAYOUT", stateVersion: transaction.stateVersion + 1, correlationId: randomUUID(), payload: { confirmationLinkId: link.id, challengeId: challenge.id } });
    const result = { verified: true, state: "READY_FOR_PAYOUT", stateVersion: transaction.stateVersion + 1 };
    await saveIdempotentResult(tx, accountId, command, idempotency.key, idempotency.requestHash, result);
    return result;
  });
}

export async function readAdminConfirmation(transactionId: string, admin: { id: string; isAdmin: boolean }) {
  assertAdmin(admin);
  const [transaction] = await db.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
  if (!transaction) throw new Error("TRANSACTION_NOT_FOUND");
  const [link] = await db.select().from(confirmationLinks).where(eq(confirmationLinks.transactionId, transactionId)).limit(1);
  const otps = link ? await db.select({ id: confirmationOtps.id, deliveryResult: confirmationOtps.deliveryResult, attempts: confirmationOtps.attempts, expiresAt: confirmationOtps.expiresAt, lockedUntil: confirmationOtps.lockedUntil }).from(confirmationOtps).where(eq(confirmationOtps.confirmationLinkId, link.id)).orderBy(desc(confirmationOtps.createdAt)) : [];
  const exceptions = await db.select().from(confirmationExceptions).where(eq(confirmationExceptions.transactionId, transactionId)).orderBy(desc(confirmationExceptions.createdAt));
  return { transactionId, state: transaction.state, stateVersion: transaction.stateVersion, link: link ? { id: link.id, expiresAt: link.expiresAt.toISOString(), reminderDueAt: link.reminderDueAt.toISOString(), reminderRecordedAt: link.reminderRecordedAt?.toISOString() ?? null, overdueAt: link.overdueAt?.toISOString() ?? null } : null, otps, exceptions: exceptions.map((item) => ({ id: item.id, decision: item.decision, reason: item.reason, evidenceReference: item.evidenceReference, firstApprovedAt: item.firstApprovedAt.toISOString(), secondApprovedAt: item.secondApprovedAt?.toISOString() ?? null })) };
}

export async function recordReminder(admin: { id: string; isAdmin: boolean }, transactionId: string, input: { evidenceReference: string; recordedAt?: Date; expectedStateVersion: number }, idempotency: Idempotency) {
  assertAdmin(admin);
  return db.transaction(async (tx) => {
    const command = "CONFIRMATION_REMINDER_RECORD";
    const prior = await findIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash);
    if (prior) return prior;
    const transaction = await lockTransaction(tx, transactionId);
    assertExpectedStateVersion(transaction.stateVersion, input.expectedStateVersion);
    const [link] = await tx.select().from(confirmationLinks).where(eq(confirmationLinks.transactionId, transactionId)).limit(1);
    if (!link) throw new Error("CONFIRMATION_LINK_NOT_FOUND");
    const at = input.recordedAt ?? new Date();
    const [updated] = await tx.update(confirmationLinks).set({ reminderRecordedAt: at, reminderRecordedByAccountId: admin.id, reminderEvidenceReference: input.evidenceReference }).where(and(eq(confirmationLinks.id, link.id), isNull(confirmationLinks.reminderRecordedAt))).returning({ id: confirmationLinks.id });
    if (!updated) throw new Error("REMINDER_ALREADY_RECORDED");
    const result = { transactionId, reminderRecordedAt: at.toISOString(), state: transaction.state, stateVersion: transaction.stateVersion };
    await recordTransactionEvent(tx, { transactionId, actorAccountId: admin.id, eventType: "BUYER_CONFIRMATION_REMINDER_RECORDED", stateVersion: transaction.stateVersion, correlationId: randomUUID(), evidenceReference: input.evidenceReference });
    await saveIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash, result);
    return result;
  });
}

export async function recordConfirmationException(admin: { id: string; isAdmin: boolean }, transactionId: string, input: any, idempotency: Idempotency) {
  assertAdmin(admin);
  return db.transaction(async (tx) => {
    const command = "CONFIRMATION_EXCEPTION_RECORD";
    const prior = await findIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash);
    if (prior) return prior;
    const transaction = await lockTransaction(tx, transactionId);
    assertExpectedStateVersion(transaction.stateVersion, input.expectedStateVersion);
    await assertNoHold(tx, transactionId);
    if (input.approvalAction === "REQUEST") {
      if (transaction.state !== "BUYER_CONFIRMATION_OVERDUE") throw new Error("EXCEPTION_NOT_ELIGIBLE");
      const [checkpoint] = await tx.select().from(whatsappCheckpoints).innerJoin(whatsappCheckpointHeads, eq(whatsappCheckpointHeads.currentCheckpointId, whatsappCheckpoints.id)).where(and(eq(whatsappCheckpoints.id, input.buyerCompletionCheckpointId), eq(whatsappCheckpoints.transactionId, transactionId), eq(whatsappCheckpoints.checkpointType, "BUYER_COMPLETION"), eq(whatsappCheckpointHeads.transactionId, transactionId), eq(whatsappCheckpointHeads.checkpointType, "BUYER_COMPLETION"))).limit(1);
      if (!checkpoint || checkpoint.whatsapp_checkpoints.deliveryResult !== "SENT") throw new Error("BUYER_COMPLETION_EVIDENCE_REQUIRED");
      const [created] = await tx.insert(confirmationExceptions).values({ transactionId, buyerCompletionCheckpointId: checkpoint.whatsapp_checkpoints.id, reason: input.reason, evidenceReference: input.evidenceReference, firstApprovedByAdminId: admin.id, expectedStateVersion: transaction.stateVersion, idempotencyKey: idempotency.key }).returning();
      if (!created) throw new Error("EXCEPTION_CREATE_FAILED");
      const result = { exceptionId: created.id, decision: created.decision, state: transaction.state, stateVersion: transaction.stateVersion };
      await recordTransactionEvent(tx, { transactionId, actorAccountId: admin.id, eventType: "BUYER_CONFIRMATION_EXCEPTION_REQUESTED", stateVersion: transaction.stateVersion, correlationId: randomUUID(), evidenceReference: input.evidenceReference, payload: { exceptionId: created.id, reason: input.reason } });
      await saveIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash, result);
      return result;
    }
    const [exception] = await tx.select().from(confirmationExceptions).where(and(eq(confirmationExceptions.id, input.exceptionId), eq(confirmationExceptions.transactionId, transactionId))).for("update").limit(1);
    if (!exception || exception.decision !== "PENDING_APPROVAL") throw new Error("EXCEPTION_NOT_PENDING");
    if (exception.firstApprovedByAdminId === admin.id) throw new Error("SECOND_ADMIN_REQUIRED");
    const now = new Date();
    const [updatedException] = await tx.update(confirmationExceptions).set({ secondApprovedByAdminId: admin.id, secondApprovedAt: now, decision: "APPROVED" }).where(and(eq(confirmationExceptions.id, exception.id), eq(confirmationExceptions.decision, "PENDING_APPROVAL"))).returning({ id: confirmationExceptions.id });
    if (!updatedException) throw new Error("EXCEPTION_ALREADY_RESOLVED");
    const [updated] = await tx.update(transactions).set({ state: "READY_FOR_PAYOUT", stateVersion: transaction.stateVersion + 1, updatedAt: now }).where(and(eq(transactions.id, transactionId), eq(transactions.state, "BUYER_CONFIRMATION_OVERDUE"), eq(transactions.stateVersion, transaction.stateVersion))).returning({ id: transactions.id });
    if (!updated) throw new Error("STATE_VERSION_CONFLICT");
    const result = { exceptionId: exception.id, decision: "APPROVED", state: "READY_FOR_PAYOUT", stateVersion: transaction.stateVersion + 1 };
    await recordTransactionEvent(tx, { transactionId, actorAccountId: admin.id, eventType: "BUYER_CONFIRMATION_EXCEPTION_APPROVED", beforeState: "BUYER_CONFIRMATION_OVERDUE", afterState: "READY_FOR_PAYOUT", stateVersion: transaction.stateVersion + 1, correlationId: randomUUID(), evidenceReference: exception.evidenceReference, payload: { exceptionId: exception.id } });
    await saveIdempotentResult(tx, admin.id, command, idempotency.key, idempotency.requestHash, result);
    return result;
  });
}
