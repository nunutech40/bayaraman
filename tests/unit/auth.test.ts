import { describe, expect, it } from "vitest";
import { accountInputSchema } from "@/server/auth/account-schema";
import { sanitizeAuthAuditPayload } from "@/server/auth/audit";
import { authConfig, getSessionSecret } from "@/server/auth/config";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSessionToken, readSessionToken } from "@/server/auth/session";
import { createManualWhatsappDeliveryAdapter } from "@/server/auth/whatsapp-delivery";
import { generateOtp } from "@/server/auth/whatsapp-verification";

describe("BAYAR-002 auth boundaries", () => {
  it("normalizes account email and rejects weak passwords", () => {
    const result = accountInputSchema.safeParse({
      email: "  BUYER@Example.COM ",
      password: "short",
      displayName: "Buyer",
      whatsappNumber: "08123456789"
    });

    expect(result.success).toBe(false);
    expect(accountInputSchema.parse({
      email: "  BUYER@Example.COM ",
      password: "long-enough-password",
      displayName: "Buyer",
      whatsappNumber: "08123456789"
    }).email).toBe("buyer@example.com");
  });

  it("hashes passwords with a verifiable Argon2id hash", async () => {
    const hash = await hashPassword("long-enough-password");
    expect(hash).toContain("$argon2id$");
    await expect(verifyPassword(hash, "long-enough-password")).resolves.toBe(true);
    await expect(verifyPassword(hash, "wrong-password")).resolves.toBe(false);
  });

  it("creates a seven-day HS256 session with no permanent role", async () => {
    const token = await createSessionToken({
      accountId: "account-1",
      sessionId: "session-1",
      productRole: null
    });
    const session = await readSessionToken(token);

    expect(session?.accountId).toBe("account-1");
    expect(session?.productRole).toBeNull();
    expect(session?.expiresAt).toBe(session!.issuedAt + authConfig.sessionMaxAgeSeconds);
    expect(getSessionSecret().byteLength).toBeGreaterThanOrEqual(32);
  });

  it("generates six-digit OTPs and keeps delivery non-authoritative", async () => {
    expect(generateOtp()).toMatch(/^\d{6}$/);
    await expect(createManualWhatsappDeliveryAdapter("PENDING").send({
      destination: "08123456789",
      code: "123456",
      challengeId: "challenge-1"
    })).resolves.toBe("PENDING");
    await expect(createManualWhatsappDeliveryAdapter("UNKNOWN").send({
      destination: "08123456789",
      code: "123456",
      challengeId: "challenge-1"
    })).resolves.toBe("UNKNOWN");
  });

  it("uses an explicit allowlist for sanitized auth audit payloads", () => {
    expect(sanitizeAuthAuditPayload("WHATSAPP_OTP_REQUESTED", {
      deliveryResult: "SENT",
      challengeId: "secret-challenge",
      code: "123456",
      phone: "+628123456789"
    })).toEqual({ deliveryResult: "SENT" });

    expect(sanitizeAuthAuditPayload("AUTHORIZATION_DENIED", {
      resource: "admin_resource",
      reasonCategory: "ADMIN_REQUIRED",
      token: "secret-token"
    })).toEqual({ resource: "admin_resource", reasonCategory: "ADMIN_REQUIRED" });
  });
});
