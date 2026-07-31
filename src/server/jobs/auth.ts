import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const JOB_TIMESTAMP_HEADER = "X-BayarAman-Job-Timestamp";
export const JOB_IDEMPOTENCY_HEADER = "X-BayarAman-Job-Idempotency-Key";
export const JOB_SIGNATURE_HEADER = "X-BayarAman-Job-Signature";
const MAX_SKEW_MS = 300_000;

function schedulerSecret(): string {
  const secret = process.env.JOB_SCHEDULER_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error("JOB_SCHEDULER_SECRET_INVALID");
  }
  return secret;
}

export function hashJobBody(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

export function canonicalJobSignatureInput(input: {
  method: string;
  path: string;
  timestamp: string;
  idempotencyKey: string;
  body: string;
}): string {
  return [
    input.method.toUpperCase(),
    input.path,
    input.timestamp,
    input.idempotencyKey,
    hashJobBody(input.body)
  ].join("\n");
}

export function signJobInvocation(input: {
  method: string;
  path: string;
  timestamp: string;
  idempotencyKey: string;
  body: string;
}): string {
  return createHmac("sha256", schedulerSecret())
    .update(canonicalJobSignatureInput(input))
    .digest("hex");
}

export function verifyJobInvocation(input: {
  method: string;
  path: string;
  timestamp: string | null;
  idempotencyKey: string | null;
  signature: string | null;
  body: string;
  now?: Date;
}): { idempotencyKey: string; timestamp: Date } {
  if (!input.timestamp || !input.idempotencyKey || !input.signature) {
    throw new Error("JOB_AUTH_REQUIRED");
  }
  const timestamp = new Date(input.timestamp);
  if (Number.isNaN(timestamp.getTime())) throw new Error("JOB_TIMESTAMP_INVALID");
  if (Math.abs((input.now ?? new Date()).getTime() - timestamp.getTime()) > MAX_SKEW_MS) {
    throw new Error("JOB_TIMESTAMP_STALE");
  }
  if (!/^[A-Za-z0-9:_-]{8,200}$/.test(input.idempotencyKey)) {
    throw new Error("JOB_IDEMPOTENCY_KEY_INVALID");
  }
  if (!/^[a-f0-9]{64}$/.test(input.signature)) throw new Error("JOB_SIGNATURE_INVALID");
  const expected = signJobInvocation({
    method: input.method,
    path: input.path,
    timestamp: input.timestamp,
    idempotencyKey: input.idempotencyKey,
    body: input.body
  });
  const suppliedBuffer = Buffer.from(input.signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (suppliedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(suppliedBuffer, expectedBuffer)) {
    throw new Error("JOB_SIGNATURE_INVALID");
  }
  return { idempotencyKey: input.idempotencyKey, timestamp };
}
