import { cookies } from "next/headers";
import { authConfig } from "./config";
import { createSessionToken, readSessionToken, type SessionClaims } from "./session";

export async function getCurrentSession(): Promise<SessionClaims | null> {
  const token = cookies().get(authConfig.sessionCookieName)?.value;
  return token ? readSessionToken(token) : null;
}

export async function setSessionCookie(
  claims: Parameters<typeof createSessionToken>[0]
): Promise<void> {
  const token = await createSessionToken(claims);
  cookies().set(authConfig.sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: authConfig.sessionMaxAgeSeconds
  });
}

export function clearSessionCookie(): void {
  cookies().set(authConfig.sessionCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}
