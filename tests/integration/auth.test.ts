import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { requestWhatsappVerification } from "@/server/auth/whatsapp-verification";

const connectionString = process.env.TEST_DATABASE_URL;
const integration = connectionString ? describe : describe.skip;

integration("BAYAR-002 PostgreSQL auth boundaries", () => {
  let client: Client;
  const accountIds: string[] = [];

  beforeAll(async () => {
    client = new Client({ connectionString });
    await client.connect();
  });

  afterAll(async () => {
    for (const accountId of accountIds) {
      await client.query("DELETE FROM account_whatsapp_verifications WHERE account_id = $1", [accountId]);
      await client.query("DELETE FROM accounts WHERE id = $1", [accountId]);
    }
    await client?.end();
  });

  async function createAccount(email = `auth-${randomUUID()}@example.test`): Promise<string> {
    const id = randomUUID();
    accountIds.push(id);
    await client.query(
      `INSERT INTO accounts (id, email, display_name, whatsapp_number)
       VALUES ($1, $2, $3, $4)`,
      [id, email, "Auth Test", `+628${Date.now()}${accountIds.length}`]
    );
    return id;
  }

  it("enforces normalized email uniqueness and active challenge shape", async () => {
    const email = `Case-${randomUUID()}@example.test`;
    const accountId = await createAccount(email);
    await expect(client.query(
      `INSERT INTO accounts (id, email, display_name, whatsapp_number)
       VALUES ($1, $2, 'Duplicate', $3)`,
      [randomUUID(), email.toLowerCase(), `+629${Date.now()}`]
    )).rejects.toThrow();

    const indexes = await client.query(
      `SELECT indexname, indexdef FROM pg_indexes
       WHERE tablename = 'account_whatsapp_verifications'`
    );
    const activeIndex = indexes.rows.find((row) => row.indexname === "account_whatsapp_verifications_one_active_idx");
    expect(activeIndex?.indexdef).toContain("verified_at IS NULL");
    expect(activeIndex?.indexdef).toContain("superseded_at IS NULL");

    await client.query(
      `INSERT INTO account_whatsapp_verifications
       (account_id, destination_snapshot, code_hash, expires_at, delivery_result)
       VALUES ($1, '+628123456789', 'hash', now() + interval '5 minutes', 'PENDING')`,
      [accountId]
    );
    await expect(client.query(
      `INSERT INTO account_whatsapp_verifications
       (account_id, destination_snapshot, code_hash, expires_at, delivery_result)
       VALUES ($1, '+628123456789', 'hash2', now() + interval '5 minutes', 'PENDING')`,
      [accountId]
    )).rejects.toThrow();
  });

  it("serializes concurrent OTP requests and records adapter UNKNOWN", async () => {
    const accountId = await createAccount();
    const adapter = { send: async () => "PENDING" as const };
    const results = await Promise.allSettled([
      requestWhatsappVerification(accountId, "+628123456789", adapter),
      requestWhatsappVerification(accountId, "+628123456789", adapter)
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);

    const unknownAccountId = await createAccount();
    const throwingAdapter = { send: async () => { throw new Error("provider unavailable"); } };
    const result = await requestWhatsappVerification(unknownAccountId, "+628123456780", throwingAdapter);
    expect(result.delivery).toBe("UNKNOWN");
    const delivery = await client.query(
      `SELECT delivery_result FROM account_whatsapp_verifications WHERE id = $1`,
      [result.challengeId]
    );
    expect(delivery.rows[0]?.delivery_result).toBe("UNKNOWN");
  });
});
