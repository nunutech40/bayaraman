import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";

const connectionString = process.env.TEST_DATABASE_URL;
const integration = connectionString ? describe : describe.skip;

integration("BAYAR-006 PostgreSQL WhatsApp boundaries", () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString });
    await client.connect();
  });

  afterAll(async () => {
    await client?.end();
  });

  it("enforces canonical group, checkpoint vocabulary, heads, and append-only evidence", async () => {
    const accountId = randomUUID();
    const sellerId = randomUUID();
    const transactionId = randomUUID();
    const groupId = randomUUID();
    const checkpointId = randomUUID();
    const headId = randomUUID();
    await client.query("BEGIN");
    try {
      await client.query(
        `INSERT INTO accounts (id, email, display_name, whatsapp_number)
         VALUES ($1, $2, 'WA Admin', $3), ($4, $5, 'WA Seller', $6)`,
        [accountId, `wa-admin-${accountId}@example.test`, `+628${Date.now()}`, sellerId, `wa-seller-${sellerId}@example.test`, `+629${Date.now()}`]
      );
      await client.query(
        `INSERT INTO transactions (id, creator_account_id, creator_role, state)
         VALUES ($1, $2, 'BUYER', 'PAYMENT_CONFIRMED')`,
        [transactionId, accountId]
      );
      await client.query(
        `INSERT INTO whatsapp_groups (id, transaction_id, group_reference, created_by_account_id)
         VALUES ($1, $2, 'group-reference', $3)`,
        [groupId, transactionId, accountId]
      );
      await client.query(
        `INSERT INTO whatsapp_checkpoints
          (id, transaction_id, group_id, checkpoint_type, author_account_id,
           message_reference, evidence_reference, snapshot_hash,
           recorded_by_account_id, idempotency_key, delivery_result)
         VALUES ($1, $2, $3, 'PAYMENT_ANNOUNCED', $4, 'message-ref', 'evidence-ref', $5, $4, 'wa-test-key', 'SENT')`,
        [checkpointId, transactionId, groupId, accountId, "a".repeat(64)]
      );
      await client.query(
        `INSERT INTO whatsapp_checkpoint_heads (id, transaction_id, checkpoint_type, current_checkpoint_id)
         VALUES ($1, $2, 'PAYMENT_ANNOUNCED', $3)`,
        [headId, transactionId, checkpointId]
      );

      await expect(client.query(
        `INSERT INTO whatsapp_groups (transaction_id, group_reference, created_by_account_id)
         VALUES ($1, 'duplicate', $2)`,
        [transactionId, accountId]
      )).rejects.toThrow();

      await expect(client.query(
        `UPDATE whatsapp_checkpoints SET evidence_reference = 'changed' WHERE id = $1`,
        [checkpointId]
      )).rejects.toThrow();

      await expect(client.query(
        `INSERT INTO whatsapp_checkpoints
          (transaction_id, group_id, checkpoint_type, snapshot_hash,
           recorded_by_account_id, idempotency_key, delivery_result)
         VALUES ($1, $2, 'NOT_A_CHECKPOINT', $3, $4, 'bad-key', 'SENT')`,
        [transactionId, groupId, "b".repeat(64), accountId]
      )).rejects.toThrow();
    } finally {
      await client.query("ROLLBACK");
    }
  });
});
