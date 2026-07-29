import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";

const connectionString = process.env.TEST_DATABASE_URL;
const integration = connectionString ? describe : describe.skip;

integration("BAYAR-003 PostgreSQL boundaries", () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString });
    await client.connect();
  });

  afterAll(async () => {
    await client?.end();
  });

  it("enforces active invitation uniqueness while preserving revoked links", async () => {
    const accountId = randomUUID();
    const transactionId = randomUUID();
    const invitationId = randomUUID();
    const revokedInvitationId = randomUUID();

    await client.query("BEGIN");
    try {
      await client.query(
        `INSERT INTO accounts (id, email, display_name, whatsapp_number)
         VALUES ($1, $2, 'BAYAR-003 Test', $3)`,
        [accountId, `bayar003-${accountId}@example.test`, `+628${Date.now()}`]
      );
      await client.query(
        `INSERT INTO transactions (id, creator_account_id, creator_role, state)
         VALUES ($1, $2, 'BUYER', 'WAITING_COUNTERPARTY')`,
        [transactionId, accountId]
      );
      await client.query(
        `INSERT INTO invitations (id, transaction_id, target_role, token_hash, expires_at)
         VALUES ($1, $2, 'SELLER', $3, now() + interval '3 days')`,
        [invitationId, transactionId, `hash-${invitationId}`]
      );

      const index = await client.query(
        `SELECT indexname FROM pg_indexes
         WHERE tablename = 'invitations' AND indexname = 'invitations_one_active_target_idx'`
      );
      expect(index.rowCount).toBe(1);

      await client.query("SAVEPOINT duplicate_active_invitation");
      await expect(client.query(
        `INSERT INTO invitations (id, transaction_id, target_role, token_hash, expires_at)
         VALUES ($1, $2, 'SELLER', $3, now() + interval '3 days')`,
        [randomUUID(), transactionId, `hash-${randomUUID()}`]
      )).rejects.toThrow();
      await client.query("ROLLBACK TO SAVEPOINT duplicate_active_invitation");

      await client.query(
        `INSERT INTO invitations (id, transaction_id, target_role, token_hash, expires_at, revoked_at)
         VALUES ($1, $2, 'SELLER', $3, now() + interval '3 days', now())`,
        [revokedInvitationId, transactionId, `hash-${revokedInvitationId}`]
      );
    } finally {
      await client.query("ROLLBACK");
    }
  });

  it("rejects Admin transaction creator and participant roles", async () => {
    const accountId = randomUUID();
    const transactionId = randomUUID();

    await client.query("BEGIN");
    try {
      await client.query(
        `INSERT INTO accounts (id, email, display_name, whatsapp_number)
         VALUES ($1, $2, 'BAYAR-003 Role Test', $3)`,
        [accountId, `bayar003-role-${accountId}@example.test`, `+629${Date.now()}`]
      );
      await client.query("SAVEPOINT role_constraint");
      await expect(client.query(
        `INSERT INTO transactions (id, creator_account_id, creator_role, state)
         VALUES ($1, $2, 'ADMIN', 'WAITING_COUNTERPARTY')`,
        [transactionId, accountId]
      )).rejects.toThrow();
      await client.query("ROLLBACK TO SAVEPOINT role_constraint");
    } finally {
      await client.query("ROLLBACK");
    }
  });
});
