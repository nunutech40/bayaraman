import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { auditEvents } from "@/server/db/schema";

type AuthAuditEvent =
  | "ACCOUNT_REGISTERED"
  | "ACCOUNT_LOGIN_SUCCEEDED"
  | "ACCOUNT_LOGIN_FAILED"
  | "ACCOUNT_LOGGED_OUT"
  | "WHATSAPP_OTP_REQUESTED"
  | "WHATSAPP_OTP_VERIFIED"
  | "AUTHORIZATION_DENIED";

const allowedPayloadKeys: Record<AuthAuditEvent, readonly string[]> = {
  ACCOUNT_REGISTERED: ["outcome"],
  ACCOUNT_LOGIN_SUCCEEDED: ["outcome"],
  ACCOUNT_LOGIN_FAILED: ["outcome"],
  ACCOUNT_LOGGED_OUT: ["outcome"],
  WHATSAPP_OTP_REQUESTED: ["deliveryResult"],
  WHATSAPP_OTP_VERIFIED: ["outcome"],
  AUTHORIZATION_DENIED: ["resource", "reasonCategory"]
};

export function sanitizeAuthAuditPayload(eventType: AuthAuditEvent, payload: Record<string, unknown>): Record<string, unknown> {
  const allowed = allowedPayloadKeys[eventType];
  return Object.fromEntries(
    Object.entries(payload).filter(([key, value]) => allowed.includes(key) && (
      typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ))
  );
}

export async function recordAuthEvent(
  eventType: AuthAuditEvent,
  actorAccountId: string | undefined,
  payload: Record<string, unknown> = {}
): Promise<void> {
  await db.insert(auditEvents).values({
    actorAccountId,
    eventType,
    correlationId: randomUUID(),
    payload: sanitizeAuthAuditPayload(eventType, payload)
  });
}
