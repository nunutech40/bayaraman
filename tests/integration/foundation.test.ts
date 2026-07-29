import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";

const connectionString = process.env.TEST_DATABASE_URL;
const integration = connectionString ? describe : describe.skip;

integration("BAYAR-001 PostgreSQL foundation", () => {
  let client: Client;

  async function expectConstraintFailure(run: () => Promise<unknown>): Promise<void> {
    await client.query("SAVEPOINT expected_constraint_failure");
    let failed = false;
    try {
      await run();
    } catch {
      failed = true;
    } finally {
      await client.query("ROLLBACK TO SAVEPOINT expected_constraint_failure");
    }
    expect(failed).toBe(true);
  }

  beforeAll(async () => {
    client = new Client({ connectionString });
    await client.connect();
  });

  afterAll(async () => {
    await client?.end();
  });

  it("enforces invoice, role, idempotency, audit, and financial immutability boundaries", async () => {
    const accountId = randomUUID();
    const transactionId = randomUUID();
    const invoiceId = randomUUID();
    const auditId = randomUUID();
    const operationId = randomUUID();

    await client.query("BEGIN");
    try {
      await client.query(
        `INSERT INTO accounts (id, email, display_name, whatsapp_number)
         VALUES ($1, $2, 'Foundation Test', $3)`,
        [accountId, `foundation-${accountId}@example.test`, `+62${Date.now()}`]
      );
      await client.query(
        `INSERT INTO transactions (id, creator_account_id, creator_role, state)
         VALUES ($1, $2, 'BUYER', 'WAITING_COUNTERPARTY')`,
        [transactionId, accountId]
      );
      await expectConstraintFailure(() => client.query(
          `INSERT INTO transactions (id, creator_account_id, creator_role, state)
           VALUES ($1, $2, 'ADMIN', 'WAITING_COUNTERPARTY')`,
          [randomUUID(), accountId]
        ));

      await client.query(
        `INSERT INTO payment_invoices
         (id, transaction_id, provider, provider_order_id, amount, idempotency_reference, issued_at, deadline_at, is_active)
         VALUES ($1, $2, 'MIDTRANS', $3, 10000, $4, now(), now() + interval '1 day', true)`,
        [invoiceId, transactionId, `order-${invoiceId}`, `PAYMENT_INVOICE_CREATE:LEGACY:${invoiceId}`]
      );
      await expectConstraintFailure(() => client.query(
          `INSERT INTO payment_invoices
           (transaction_id, provider, provider_order_id, amount, deadline_at, is_active)
           VALUES ($1, 'MIDTRANS', $2, 10000, now() + interval '1 day', true)`,
          [transactionId, `order-${randomUUID()}`]
        ));
      await client.query("UPDATE payment_invoices SET provider_status = 'PENDING' WHERE id = $1", [invoiceId]);
      await expectConstraintFailure(() => client.query(
        "UPDATE payment_invoices SET amount = 99999 WHERE id = $1",
        [invoiceId]
      ));
      await expectConstraintFailure(() => client.query("DELETE FROM payment_invoices WHERE id = $1", [invoiceId]));

      await client.query(
        `INSERT INTO idempotency_keys (actor_scope, command, key, request_hash)
         VALUES ($1, 'foundation.test', 'foundation-key-123', 'hash')`,
        [`ACCOUNT:${accountId}`]
      );
      await expectConstraintFailure(() => client.query(
          `INSERT INTO idempotency_keys (actor_scope, command, key, request_hash)
           VALUES ($1, 'foundation.test', 'foundation-key-123', 'hash')`,
          [`ACCOUNT:${accountId}`]
        ));

      await client.query(
        `INSERT INTO audit_events (id, actor_account_id, event_type, correlation_id)
         VALUES ($1, $2, 'FOUNDATION_TEST', $3)`,
        [auditId, accountId, randomUUID()]
      );
      await expectConstraintFailure(() => client.query("DELETE FROM audit_events WHERE id = $1", [auditId]));

      await client.query(
        `INSERT INTO financial_operations
         (id, transaction_id, type, result, amount, destination_snapshot, bank_reference, started_by_account_id)
         VALUES ($1, $2, 'REFUND', 'SUCCESS', 10000, 'masked', 'reference', $3)`,
        [operationId, transactionId, accountId]
      );
      await expectConstraintFailure(() => client.query(
          "UPDATE financial_operations SET bank_reference = 'changed' WHERE id = $1",
          [operationId]
        ));
    } finally {
      await client.query("ROLLBACK");
    }
  });
});
