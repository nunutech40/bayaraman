import { z } from "zod";

export const idempotencyKeySchema = z.object({
  actorScope: z.string().regex(/^(ACCOUNT:[0-9a-f-]{36}|SYSTEM:[A-Za-z0-9._-]+)$/),
  command: z.string().min(1).max(120),
  key: z.string().min(8).max(200),
  requestHash: z.string().min(1).max(128)
});

export type IdempotencyInput = z.infer<typeof idempotencyKeySchema>;

export function accountActorScope(accountId: string): string {
  return `ACCOUNT:${z.string().uuid().parse(accountId)}`;
}

export function systemActorScope(jobName: string): string {
  return `SYSTEM:${z.string().regex(/^[A-Za-z0-9._-]+$/).parse(jobName)}`;
}

export function normalizeActorScope(value: string): string {
  return value.startsWith("ACCOUNT:") || value.startsWith("SYSTEM:")
    ? idempotencyKeySchema.shape.actorScope.parse(value)
    : accountActorScope(value);
}

export type IdempotencyHit<T> = {
  kind: "hit";
  result: T;
};

export type IdempotencyMiss = {
  kind: "miss";
};

export type IdempotencyLookup<T> = IdempotencyHit<T> | IdempotencyMiss;

export function assertSameRequestHash(
  storedHash: string,
  requestHash: string
): void {
  if (storedHash !== requestHash) {
    throw new IdempotencyConflictError();
  }
}

export class IdempotencyConflictError extends Error {
  constructor() {
    super("Idempotency key was reused with a different request");
    this.name = "IdempotencyConflictError";
  }
}
