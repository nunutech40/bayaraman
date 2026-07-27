import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { authConfig, getSessionSecret } from "./config";

export type ProductRole = "BUYER" | "SELLER" | "ADMIN";

export type SessionClaims = {
  accountId: string;
  sessionId: string;
  productRole: ProductRole | null;
  issuedAt: number;
  expiresAt: number;
};

type SessionPayload = JWTPayload & SessionClaims;

export async function createSessionToken(
  claims: Omit<SessionClaims, "issuedAt" | "expiresAt">
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + authConfig.sessionMaxAgeSeconds;

  return new SignJWT({
    accountId: claims.accountId,
    sessionId: claims.sessionId,
    productRole: claims.productRole,
    issuedAt: now,
    expiresAt
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .sign(getSessionSecret());
}

export async function readSessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), {
      algorithms: ["HS256"]
    });

    if (!isSessionPayload(payload)) {
      return null;
    }

    return {
      accountId: payload.accountId,
      sessionId: payload.sessionId,
      productRole: payload.productRole,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt
    };
  } catch {
    return null;
  }
}

function isSessionPayload(payload: JWTPayload): payload is SessionPayload {
  return (
    typeof payload.accountId === "string" &&
    typeof payload.sessionId === "string" &&
    (payload.productRole === null ||
      payload.productRole === "BUYER" ||
      payload.productRole === "SELLER" ||
      payload.productRole === "ADMIN") &&
    typeof payload.issuedAt === "number" &&
    typeof payload.expiresAt === "number"
  );
}
