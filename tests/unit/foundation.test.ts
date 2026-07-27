import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildAuditEvent } from "@/server/audit";
import { accountActorScope, assertSameRequestHash, systemActorScope } from "@/server/domain/idempotency";
import { assertMutationVersion, createMutationContext } from "@/server/domain/mutation";
import {
  assertExpectedStateVersion,
  assertKnownTransactionState,
  StateVersionConflictError
} from "@/server/domain/transaction/state";
import { hashRequest, parseMutationInput } from "@/server/validation/mutation";

describe("foundation state boundary", () => {
  it("accepts approved states and rejects unknown states", () => {
    expect(() => assertKnownTransactionState("WAITING_COUNTERPARTY")).not.toThrow();
    expect(() => assertKnownTransactionState("UNAPPROVED_STATE")).toThrow(
      "Unknown transaction state"
    );
  });

  it("rejects stale state versions", () => {
    expect(() => assertExpectedStateVersion(2, 1)).toThrow(
      StateVersionConflictError
    );
  });
});

describe("mutation boundary", () => {
  it("validates input and creates a correlation context", () => {
    const actorAccountId = randomUUID();
    const context = createMutationContext(
      {
        actorScope: accountActorScope(actorAccountId),
        command: "foundation.test",
        idempotencyKey: "foundation-key-1",
        requestHash: hashRequest({ ok: true }),
        expectedStateVersion: 0
      },
      randomUUID()
    );

    expect(context.actorScope).toBe(`ACCOUNT:${actorAccountId}`);
    expect(() => assertMutationVersion(0, context)).not.toThrow();
  });

  it("rejects a reused idempotency key with a different request hash", () => {
    expect(() => assertSameRequestHash("stored", "different")).toThrow(
      "Idempotency key was reused"
    );
  });

  it("creates an audit event without mutating the input payload", () => {
    const payload = { source: "test" };
    const event = buildAuditEvent({
      eventType: "FOUNDATION_TEST",
      correlationId: randomUUID(),
      payload
    });

    expect(event.payload).toEqual(payload);
    expect(event.payload).not.toBe(payload);
  });

  it("parses valid mutation input", () => {
    const input = parseMutationInput({
      actorScope: systemActorScope("payment-expiry"),
      command: "foundation.test",
      idempotencyKey: "foundation-key-2",
      requestHash: "hash"
    });

    expect(input.command).toBe("foundation.test");
  });

  it("uses explicit account and system idempotency scopes", () => {
    const accountId = randomUUID();
    expect(accountActorScope(accountId)).toBe(`ACCOUNT:${accountId}`);
    expect(systemActorScope("payment-expiry")).toBe("SYSTEM:payment-expiry");
  });
});
