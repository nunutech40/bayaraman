import { createHash, randomInt } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { accountWhatsappVerifications, accounts } from "@/server/db/schema";
import { authConfig } from "./config";
import { configuredWhatsappOtp, createConfiguredWhatsappDeliveryAdapter, type WhatsappDeliveryAdapter } from "./whatsapp-delivery";

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function generateOtp(): string {
  return randomInt(100000, 1000000).toString();
}

export async function requestWhatsappVerification(
  accountId: string,
  whatsappNumber: string,
  adapter: WhatsappDeliveryAdapter = createConfiguredWhatsappDeliveryAdapter()
): Promise<{ challengeId: string; delivery: Awaited<ReturnType<WhatsappDeliveryAdapter["send"]>> }> {
  const now = new Date();
  const code = configuredWhatsappOtp(generateOtp);
  const challenge = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${accountId}, 0))`);

    const [latest] = await tx
      .select()
      .from(accountWhatsappVerifications)
      .where(eq(accountWhatsappVerifications.accountId, accountId))
      .orderBy(desc(accountWhatsappVerifications.createdAt))
      .limit(1);

    if (latest && now.getTime() - latest.createdAt.getTime() < authConfig.otpRequestCooldownMs) {
      throw new Error("OTP request cooldown is active");
    }

    await tx
      .update(accountWhatsappVerifications)
      .set({ supersededAt: now })
      .where(and(
        eq(accountWhatsappVerifications.accountId, accountId),
        isNull(accountWhatsappVerifications.verifiedAt),
        isNull(accountWhatsappVerifications.supersededAt)
      ));

    const [created] = await tx
      .insert(accountWhatsappVerifications)
      .values({
        accountId,
        destinationSnapshot: whatsappNumber,
        codeHash: hashCode(code),
        expiresAt: new Date(now.getTime() + authConfig.otpTtlMs),
        deliveryResult: "PENDING"
      })
      .returning({ id: accountWhatsappVerifications.id });

    if (!created) throw new Error("Unable to create verification challenge");
    return created;
  });

  let delivery: Awaited<ReturnType<WhatsappDeliveryAdapter["send"]>> = "UNKNOWN";
  try {
    delivery = await adapter.send({ destination: whatsappNumber, code, challengeId: challenge.id });
  } catch {
    delivery = "UNKNOWN";
  }

  await db
    .update(accountWhatsappVerifications)
    .set({ deliveryResult: delivery, deliveryAttemptedAt: new Date() })
    .where(eq(accountWhatsappVerifications.id, challenge.id));

  return { challengeId: challenge.id, delivery };
}

export async function verifyWhatsappCode(
  accountId: string,
  challengeId: string,
  code: string
): Promise<void> {
  const verified = await db.transaction(async (tx) => {
    const [challenge] = await tx
      .select()
      .from(accountWhatsappVerifications)
      .where(and(
        eq(accountWhatsappVerifications.id, challengeId),
        eq(accountWhatsappVerifications.accountId, accountId),
        isNull(accountWhatsappVerifications.verifiedAt),
        isNull(accountWhatsappVerifications.supersededAt)
      ))
      .for("update")
      .limit(1);

    if (!challenge) throw new Error("Invalid verification challenge");
    if (challenge.expiresAt.getTime() <= Date.now()) throw new Error("Verification code expired");
    if (challenge.attempts >= authConfig.otpMaxAttempts) throw new Error("Verification attempt limit reached");

    const valid = hashCode(code) === challenge.codeHash;
    await tx
      .update(accountWhatsappVerifications)
      .set({ attempts: challenge.attempts + 1 })
      .where(eq(accountWhatsappVerifications.id, challenge.id));

    if (!valid) return false;

    const verifiedAt = new Date();
    await tx
      .update(accountWhatsappVerifications)
      .set({ verifiedAt })
      .where(and(eq(accountWhatsappVerifications.id, challenge.id), isNull(accountWhatsappVerifications.verifiedAt)));
    await tx
      .update(accounts)
      .set({ whatsappVerifiedAt: verifiedAt, updatedAt: verifiedAt })
      .where(eq(accounts.id, accountId));
    return true;
  });

  if (!verified) throw new Error("Invalid verification code");
}
