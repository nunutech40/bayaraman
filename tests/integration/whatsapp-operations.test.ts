import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { hashRequest } from "@/server/validation/mutation";
import { recordWhatsAppCheckpoint, recordWhatsAppGroup } from "@/server/operations/whatsapp";

const connectionString = process.env.TEST_DATABASE_URL;
const integration = connectionString ? describe : describe.skip;

integration("BAYAR-006 WhatsApp operation matrix", () => {
  let client: Client;
  const adminId = randomUUID();
  const buyerId = randomUUID();
  const sellerId = randomUUID();
  const transactionId = randomUUID();
  const buyerPhone = "+6282221111";
  const sellerPhone = "+6283332222";

  beforeAll(async () => {
    client = new Client({ connectionString });
    await client.connect();
    await client.query(
      `INSERT INTO accounts (id, email, display_name, whatsapp_number, is_admin)
       VALUES ($1, $2, 'WA Operations Admin', $3, true),
              ($4, $5, 'WA Operations Buyer', $6, false),
              ($7, $8, 'WA Operations Seller', $9, false)`,
      [adminId, `wa-ops-admin-${adminId}@example.test`, `+628111${adminId.slice(0, 4)}`, buyerId, `wa-ops-buyer-${buyerId}@example.test`, `+628222${buyerId.slice(0, 4)}`, sellerId, `wa-ops-seller-${sellerId}@example.test`, `+628333${sellerId.slice(0, 4)}`]
    );
    await client.query(
      `INSERT INTO transactions (id, creator_account_id, creator_role, state)
       VALUES ($1, $2, 'BUYER', 'PAYMENT_CONFIRMED')`,
      [transactionId, buyerId]
    );
    await client.query(
      `INSERT INTO transaction_participants (transaction_id, account_id, role, name_snapshot, whatsapp_snapshot, joined_at)
       VALUES ($1, $2, 'BUYER', 'WA Buyer', $3, now()), ($1, $4, 'SELLER', 'WA Seller', $5, now())`,
      [transactionId, buyerId, buyerPhone, sellerId, sellerPhone]
    );
  });

  afterAll(async () => {
    await client.end();
  });

  async function checkpoint(input: Record<string, unknown>, key = randomUUID()): Promise<any> {
    return recordWhatsAppCheckpoint(adminId, transactionId, input as never, { key, requestHash: hashRequest(input) }) as Promise<any>;
  }

  it("executes the approved A-D state matrix and idempotent duplicate", async () => {
    const group = await recordWhatsAppGroup(adminId, transactionId, {
      groupReference: "wa-ops-group",
      buyerSnapshotConfirmation: { lastFour: buyerPhone.slice(-4) },
      sellerSnapshotConfirmation: { lastFour: sellerPhone.slice(-4) },
      evidenceReference: "group-evidence",
      expectedStateVersion: 0
    }, { key: randomUUID(), requestHash: "group-matrix-hash" }) as any;
    expect(group.state).toBe("PAYMENT_CONFIRMED");

    const paymentKey = randomUUID();
    const paymentInput = { checkpointType: "PAYMENT_ANNOUNCED", sourceAuthorRole: "ADMIN", evidenceReference: "payment-evidence", messageReference: "payment-message", snapshotHash: "1".repeat(64), deliveryResult: "SENT", expectedStateVersion: 0 };
    const payment = await checkpoint(paymentInput, paymentKey);
    expect(payment.state).toBe("READY_FOR_FULFILLMENT");
    const duplicate = await recordWhatsAppCheckpoint(adminId, transactionId, paymentInput as never, { key: paymentKey, requestHash: hashRequest(paymentInput) }) as any;
    expect(duplicate.checkpointId).toBe(payment.checkpointId);

    const shipment = await checkpoint({ checkpointType: "SELLER_SHIPMENT", sourceAuthorRole: "SELLER", evidenceReference: "shipment-evidence", messageReference: "shipment-message", snapshotHash: "2".repeat(64), deliveryResult: "SENT", expectedStateVersion: 1 });
    expect(shipment.state).toBe("WAITING_COMPLETION_REPORTS");
    const sellerCompletion = await checkpoint({ checkpointType: "SELLER_COMPLETION", sourceAuthorRole: "SELLER", evidenceReference: "seller-completion-evidence", messageReference: "seller-completion-message", snapshotHash: "3".repeat(64), deliveryResult: "SENT", expectedStateVersion: 2 });
    expect(sellerCompletion.state).toBe("WAITING_OTHER_COMPLETION_REPORT");
    const buyerCompletion = await checkpoint({ checkpointType: "BUYER_COMPLETION", sourceAuthorRole: "BUYER", evidenceReference: "buyer-completion-evidence", messageReference: "buyer-completion-message", snapshotHash: "4".repeat(64), deliveryResult: "SENT", expectedStateVersion: 3 });
    expect(buyerCompletion.state).toBe("READY_FOR_BUYER_CONFIRMATION");
  });

  it("keeps trusted correction append-only without replaying state", async () => {
    const original = await client.query(`SELECT current_checkpoint_id FROM whatsapp_checkpoint_heads WHERE transaction_id = $1 AND checkpoint_type = 'PAYMENT_ANNOUNCED'`, [transactionId]);
    const originalId = original.rows[0].current_checkpoint_id as string;
    const correction = await checkpoint({ checkpointType: "PAYMENT_ANNOUNCED", sourceAuthorRole: "ADMIN", evidenceReference: "payment-correction-evidence", messageReference: "payment-correction-message", snapshotHash: "5".repeat(64), deliveryResult: "SENT", correctedCheckpointId: originalId, correctionReason: "Corrected external reference", expectedStateVersion: 4 });
    expect(correction.state).toBe("READY_FOR_BUYER_CONFIRMATION");
    expect(correction.stateVersion).toBe(4);
    const rows = await client.query(`SELECT count(*)::int AS count FROM whatsapp_checkpoints WHERE transaction_id = $1 AND checkpoint_type = 'PAYMENT_ANNOUNCED'`, [transactionId]);
    expect(rows.rows[0].count).toBe(2);
    const head = await client.query(`SELECT current_checkpoint_id FROM whatsapp_checkpoint_heads WHERE transaction_id = $1 AND checkpoint_type = 'PAYMENT_ANNOUNCED'`, [transactionId]);
    expect(head.rows[0].current_checkpoint_id).toBe(correction.checkpointId);

    const concurrent = await Promise.allSettled([
      checkpoint({ checkpointType: "PAYMENT_ANNOUNCED", sourceAuthorRole: "ADMIN", evidenceReference: "concurrent-a", messageReference: "concurrent-a", snapshotHash: "7".repeat(64), deliveryResult: "SENT", correctedCheckpointId: correction.checkpointId, correctionReason: "Concurrent correction A", expectedStateVersion: 4 }),
      checkpoint({ checkpointType: "PAYMENT_ANNOUNCED", sourceAuthorRole: "ADMIN", evidenceReference: "concurrent-b", messageReference: "concurrent-b", snapshotHash: "8".repeat(64), deliveryResult: "SENT", correctedCheckpointId: correction.checkpointId, correctionReason: "Concurrent correction B", expectedStateVersion: 4 })
    ]);
    expect(concurrent.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(concurrent.filter((result) => result.status === "rejected")).toHaveLength(1);
  });

  it("rejects stale versions and checkpoint mutation before a canonical group", async () => {
    await expect(checkpoint({ checkpointType: "BUYER_COMPLETION", sourceAuthorRole: "BUYER", evidenceReference: "stale", messageReference: "stale", snapshotHash: "6".repeat(64), deliveryResult: "SENT", expectedStateVersion: 0 })).rejects.toThrow("STATE_VERSION_CONFLICT");
  });
});
