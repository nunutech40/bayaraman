import { and, eq } from "drizzle-orm";
import { idempotencyKeys } from "@/server/db/schema";
import { assertSameRequestHash, normalizeActorScope } from "@/server/domain/idempotency";

export function requireIdempotencyKey(value: string | null): string {
  if (!value || value.length < 8 || value.length > 200) {
    throw new Error("IDEMPOTENCY_KEY_REQUIRED");
  }
  return value;
}

export async function findIdempotentResult(
  tx: { select: typeof import("@/server/db").db.select },
  actorScopeOrAccountId: string,
  command: string,
  key: string,
  requestHash: string
) {
  const actorScope = normalizeActorScope(actorScopeOrAccountId);
  const [existing] = await tx
    .select()
    .from(idempotencyKeys)
    .where(and(
      eq(idempotencyKeys.actorScope, actorScope),
      eq(idempotencyKeys.command, command),
      eq(idempotencyKeys.key, key)
    ))
    .limit(1);

  if (!existing) {
    return null;
  }

  assertSameRequestHash(existing.requestHash, requestHash);
  return existing.result;
}

export async function saveIdempotentResult(
  tx: { insert: typeof import("@/server/db").db.insert },
  actorScopeOrAccountId: string,
  command: string,
  key: string,
  requestHash: string,
  result: Record<string, unknown>
): Promise<void> {
  const actorScope = normalizeActorScope(actorScopeOrAccountId);
  await tx.insert(idempotencyKeys).values({
    actorAccountId: actorScope.startsWith("ACCOUNT:") ? actorScope.slice("ACCOUNT:".length) : null,
    actorScope,
    command,
    key,
    requestHash,
    result
  });
}
