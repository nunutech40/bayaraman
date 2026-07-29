import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";

const connectionString = process.env.TEST_DATABASE_URL;
const integration = connectionString ? describe : describe.skip;

integration("BAYAR-005 provider reconciliation database boundary", () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString });
    await client.connect();
  });

  afterAll(async () => {
    await client?.end();
  });

  it("has the provider validation, authority, conflict, and reconciliation boundaries", async () => {
    const tables = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name IN
       ('payment_provider_events', 'payment_reconciliation_events', 'payment_reconciliations')`
    );
    expect(new Set(tables.rows.map((row) => row.table_name))).toEqual(new Set([
      "payment_provider_events",
      "payment_reconciliation_events",
      "payment_reconciliations"
    ]));

    const constraints = await client.query<{ constraint_name: string }>(
      `SELECT constraint_name FROM information_schema.table_constraints
       WHERE table_schema = 'public' AND constraint_name IN
       ('payment_provider_events_validation_outcome_check',
        'payment_reconciliation_events_relation_type_check',
        'payment_invoices_authoritative_event_fk')`
    );
    expect(constraints.rows.map((row) => row.constraint_name)).toEqual(expect.arrayContaining([
      "payment_provider_events_validation_outcome_check",
      "payment_reconciliation_events_relation_type_check",
      "payment_invoices_authoritative_event_fk"
    ]));
  });
});
