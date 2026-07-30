import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { randomUUID } from "node:crypto";
import { hashRequest } from "@/server/validation/mutation";
import { createConfirmationLink, recordConfirmationException, requestConfirmationOtp, verifyConfirmationOtp } from "@/server/confirmation/service";

const connectionString = process.env.TEST_DATABASE_URL;
const integration = connectionString ? describe : describe.skip;

integration("BAYAR-007 buyer confirmation and OTP", () => {
  let client: Client;
  const adminId = randomUUID();
  const secondAdminId = randomUUID();
  const buyerId = randomUUID();
  const sellerId = randomUUID();
  const transactionId = randomUUID();
  const groupId = randomUUID();
  const sellerCompletionId = randomUUID();
  const buyerCompletionId = randomUUID();

  beforeAll(async () => {
    client = new Client({ connectionString });
    await client.connect();
    await client.query(
      `INSERT INTO accounts (id, email, display_name, whatsapp_number, whatsapp_verified_at, is_admin)
       VALUES ($1, $2, 'Confirmation Admin', $3, now(), true),
              ($4, $5, 'Confirmation Admin Two', $6, now(), true),
              ($7, $8, 'Confirmation Buyer', $9, now(), false),
              ($10, $11, 'Confirmation Seller', $12, now(), false)`,
      [adminId, `confirmation-admin-${adminId}@example.test`, `+62811${adminId.slice(0, 8)}`, secondAdminId, `confirmation-admin-two-${secondAdminId}@example.test`, `+62812${secondAdminId.slice(0, 8)}`, buyerId, `confirmation-buyer-${buyerId}@example.test`, `+62813${buyerId.slice(0, 8)}`, sellerId, `confirmation-seller-${sellerId}@example.test`, `+62814${sellerId.slice(0, 8)}`]
    );
    await client.query(
      `INSERT INTO transactions (id, creator_account_id, creator_role, state, state_version)
       VALUES ($1, $2, 'SELLER', 'READY_FOR_BUYER_CONFIRMATION', 0)`,
      [transactionId, sellerId]
    );
    await client.query(
      `INSERT INTO transaction_participants (transaction_id, account_id, role, name_snapshot, whatsapp_snapshot, joined_at)
       VALUES ($1, $2, 'BUYER', 'Confirmation Buyer', $3, now()), ($1, $4, 'SELLER', 'Confirmation Seller', $5, now())`,
      [transactionId, buyerId, `+62813${buyerId.slice(0, 8)}`, sellerId, `+62814${sellerId.slice(0, 8)}`]
    );
    await client.query("INSERT INTO whatsapp_groups (id, transaction_id, group_reference, created_by_account_id) VALUES ($1, $2, 'confirmation-group', $3)", [groupId, transactionId, adminId]);
    await client.query(
      `INSERT INTO whatsapp_checkpoints (id, transaction_id, group_id, checkpoint_type, author_account_id, evidence_reference, snapshot_hash, recorded_by_account_id, idempotency_key, delivery_result)
       VALUES ($1, $2, $3, 'SELLER_COMPLETION', $4, 'seller-completion', $5, $6, $7, 'SENT'),
              ($8, $2, $3, 'BUYER_COMPLETION', $9, 'buyer-completion', $10, $6, $11, 'SENT')`,
      [sellerCompletionId, transactionId, groupId, sellerId, "1".repeat(64), adminId, `test-${sellerCompletionId}`, buyerCompletionId, buyerId, "2".repeat(64), `test-${buyerCompletionId}`]
    );
    await client.query(
      `INSERT INTO whatsapp_checkpoint_heads (transaction_id, checkpoint_type, current_checkpoint_id)
       VALUES ($1, 'SELLER_COMPLETION', $2), ($1, 'BUYER_COMPLETION', $3)`,
      [transactionId, sellerCompletionId, buyerCompletionId]
    );
  });

  afterAll(async () => {
    // Audit events are append-only by design; fixture rows remain for audit verification.
    await client.end();
  });

  it("creates a Buyer-bound link, sends hashed OTP, and confirms exactly once", async () => {
    const createInput = { expectedStateVersion: 0 };
    const link = await createConfirmationLink({ id: adminId, isAdmin: true }, transactionId, 0, { key: randomUUID(), requestHash: hashRequest(createInput) }) as any;
    expect(link.postingUrl).toMatch(/^\/confirm\//);
    expect(link.buyerWhatsapp).toMatch(/••••\d{4}/);

    let sentCode = "";
    const otpInput = {};
    const otp = await requestConfirmationOtp(buyerId, link.postingUrl.slice("/confirm/".length), { key: randomUUID(), requestHash: hashRequest(otpInput) }, { send: async ({ code }) => { sentCode = code; return "SENT" as const; } }) as any;
    expect(otp.delivery).toBe("SENT");
    expect(sentCode).toMatch(/^\d{6}$/);

    const verifyInput = { challengeId: otp.challengeId, code: sentCode, expectedStateVersion: 1 };
    const verified = await verifyConfirmationOtp(buyerId, link.postingUrl.slice("/confirm/".length), verifyInput, { key: randomUUID(), requestHash: hashRequest(verifyInput) });
    expect(verified).toMatchObject({ verified: true, state: "READY_FOR_PAYOUT" });

    const indexes = await client.query("SELECT indexname FROM pg_indexes WHERE tablename = 'confirmation_links'");
    expect(indexes.rows.map((row) => row.indexname)).toContain("confirmation_links_one_transaction_unique");
    const stored = await client.query("SELECT code_hash, used_at FROM confirmation_otps o JOIN confirmation_links l ON l.id = o.confirmation_link_id WHERE l.transaction_id = $1", [transactionId]);
    expect(stored.rows[0].code_hash).not.toBe(sentCode);
    expect(stored.rows[0].used_at).not.toBeNull();
  });

  it("requires two distinct Admin approvals for overdue exception eligibility", async () => {
    const exceptionTransactionId = randomUUID();
    const exceptionGroupId = randomUUID();
    const exceptionCheckpointId = randomUUID();
    await client.query("INSERT INTO transactions (id, creator_account_id, creator_role, state, state_version) VALUES ($1, $2, 'SELLER', 'BUYER_CONFIRMATION_OVERDUE', 0)", [exceptionTransactionId, sellerId]);
    await client.query("INSERT INTO transaction_participants (transaction_id, account_id, role, name_snapshot, whatsapp_snapshot, joined_at) VALUES ($1, $2, 'BUYER', 'Buyer', '+62815', now()), ($1, $3, 'SELLER', 'Seller', '+62816', now())", [exceptionTransactionId, buyerId, sellerId]);
    await client.query("INSERT INTO whatsapp_groups (id, transaction_id, group_reference, created_by_account_id) VALUES ($1, $2, 'exception-group', $3)", [exceptionGroupId, exceptionTransactionId, adminId]);
    await client.query("INSERT INTO whatsapp_checkpoints (id, transaction_id, group_id, checkpoint_type, author_account_id, evidence_reference, snapshot_hash, recorded_by_account_id, idempotency_key, delivery_result) VALUES ($1, $2, $3, 'BUYER_COMPLETION', $4, 'exception-completion', $5, $6, $7, 'SENT')", [exceptionCheckpointId, exceptionTransactionId, exceptionGroupId, buyerId, "3".repeat(64), adminId, `test-${exceptionCheckpointId}`]);
    await client.query("INSERT INTO whatsapp_checkpoint_heads (transaction_id, checkpoint_type, current_checkpoint_id) VALUES ($1, 'BUYER_COMPLETION', $2)", [exceptionTransactionId, exceptionCheckpointId]);
    const request = { approvalAction: "REQUEST", buyerCompletionCheckpointId: exceptionCheckpointId, reason: "Buyer completed but link overdue", evidenceReference: "exception-evidence", expectedStateVersion: 0 };
    const pending = await recordConfirmationException({ id: adminId, isAdmin: true }, exceptionTransactionId, request, { key: randomUUID(), requestHash: hashRequest(request) }) as any;
    expect(pending.decision).toBe("PENDING_APPROVAL");
    const approval = { approvalAction: "APPROVE", exceptionId: pending.exceptionId, expectedStateVersion: 0 };
    await expect(recordConfirmationException({ id: adminId, isAdmin: true }, exceptionTransactionId, approval, { key: randomUUID(), requestHash: hashRequest(approval) })).rejects.toThrow("SECOND_ADMIN_REQUIRED");
    const approved = await recordConfirmationException({ id: secondAdminId, isAdmin: true }, exceptionTransactionId, approval, { key: randomUUID(), requestHash: hashRequest(approval) }) as any;
    expect(approved).toMatchObject({ decision: "APPROVED", state: "READY_FOR_PAYOUT" });
  });
});
