const MIN_SECRET_LENGTH = 32;

function hasValidConfiguredSecret(value: string | undefined): value is string {
  return Boolean(value && new TextEncoder().encode(value).byteLength >= MIN_SECRET_LENGTH);
}

export function getSessionSecret(): Uint8Array {
  const value = process.env.AUTH_SESSION_SECRET;

  if (!hasValidConfiguredSecret(value)) {
    if (process.env.NODE_ENV === "test") {
      return new TextEncoder().encode("test-only-bayaraman-session-secret-32");
    }

    throw new Error("AUTH_SESSION_SECRET must contain at least 32 characters");
  }

  return new TextEncoder().encode(value);
}

if (process.env.NODE_ENV !== "test" && !hasValidConfiguredSecret(process.env.AUTH_SESSION_SECRET)) {
  throw new Error("AUTH_SESSION_SECRET must contain at least 32 bytes outside tests");
}

export const authConfig = {
  sessionCookieName: "bayaraman_session",
  sessionMaxAgeSeconds: 7 * 24 * 60 * 60,
  otpTtlMs: 5 * 60 * 1000,
  otpMaxAttempts: 5,
  otpRequestCooldownMs: 60 * 1000
} as const;
