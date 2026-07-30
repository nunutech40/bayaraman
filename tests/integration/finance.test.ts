import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { hashPassword } from "@/server/auth/password";
import {
  approveFinancialOperation,
  executeFinancialOperation,
  prepareFinancialOperation,
  reauthenticateFinancialOperation,
  retryFinancialOperation
} from "@/server/finance/service";
import {
  createFakeFinancialTransferAdapter,
  createFakeRefundProviderAdapter
} from "@/server/providers/finance";
import { hashRequest } from "@/server/validation/mutation";

const connectionString = process.env.TEST_DATABASE_URL;
const integration = connectionString ? describe : describe.skip;

integration("BAYAR-008 financial operations", () => {
  let client: Client;
  const prepareAdminId = randomUUID();
  const executeAdminId = randomUUID();
  const legacyOnlyAdminId = randomUUID();
  const buyerId = randomUUID();
  const sellerId = randomUUID();
  const password = "financial-secret";

  beforeAll(async () => {
    client = new Client({ connectionString });
    await client.connect();
    const passwordHash = await hashPassword(password);
    await client.query(
      `INSERT INTO accounts
       (id, email, password_hash, display_name, whatsapp_number, is_admin, admin_task_assignment)
       VALUES
       ($1, $2, $3, 'Prepare Admin', $4, true, NULL),
       ($5, $6, $3, 'Execute Admin', $7, true, NULL),
       ($8, $9, $3, 'Legacy Admin', $10, true, 'FINANCIAL_PREPARE'),
       ($11, $12, $3, 'Finance Buyer', $13, false, NULL),
       ($14, $15, $3, 'Finance Seller', $16, false, NULL)`,
      [
        prepareAdminId, `finance-prepare-${prepareAdminId}@example.test`, passwordHash,
        `+62831${prepareAdminId.slice(0, 8)}`,
        executeAdminId, `finance-execute-${executeAdminId}@example.test`,
        `+62832${executeAdminId.slice(0, 8)}`,
        legacyOnlyAdminId, `finance-legacy-${legacyOnlyAdminId}@example.test`,
        `+62833${legacyOnlyAdminId.slice(0, 8)}`,
        buyerId, `finance-buyer-${buyerId}@example.test`,
        `+62834${buyerId.slice(0, 8)}`,
        sellerId, `finance-seller-${sellerId}@example.test`,
        `+62835${sellerId.slice(0, 8)}`
      ]
    );
    await client.query(
      `INSERT INTO admin_task_assignments
       (account_id, task_scope, assigned_by_account_id)
       VALUES
       ($1, 'FINANCIAL_PREPARE', $1),
       ($1, 'FINANCIAL_APPROVE', $1),
       ($2, 'FINANCIAL_APPROVE', $1),
       ($2, 'FINANCIAL_EXECUTE', $1),
       ($2, 'FINANCIAL_RECONCILE', $1)`,
      [prepareAdminId, executeAdminId]
    );
  });

  afterAll(async () => {
    await client.end();
  });

  async function createEligiblePayout(amount = 250000) {
    const transactionId = randomUUID();
    await client.query(
      `INSERT INTO transactions
       (id, creator_account_id, creator_role, state, state_version)
       VALUES ($1, $2, 'BUYER', 'READY_FOR_PAYOUT', 0)`,
      [transactionId, buyerId]
    );
    await client.query(
      `INSERT INTO transaction_participants
       (transaction_id, account_id, role, name_snapshot, whatsapp_snapshot, joined_at)
       VALUES
       ($1, $2, 'BUYER', 'Finance Buyer', '+628340001', now()),
       ($1, $3, 'SELLER', 'Finance Seller', '+628350001', now())`,
      [transactionId, buyerId, sellerId]
    );
    await client.query(
      `INSERT INTO transaction_terms
       (transaction_id, item_description, item_price, shipping_cost,
        service_fee, total_amount, frozen_at)
       VALUES ($1, 'Barang fisik', $2, 0, 5000, $2 + 5000, now())`,
      [transactionId, amount]
    );
    await client.query(
      `INSERT INTO seller_payout_destinations
       (transaction_id, participant_account_id, bank_name, account_holder_name,
        raw_account_value, masked_account_value, locked_at)
       VALUES ($1, $2, 'BCA', 'Finance Seller', '1234567890', '******7890', now())`,
      [transactionId, sellerId]
    );
    await client.query(
      `INSERT INTO confirmation_links
       (transaction_id, buyer_account_id, token_hash, buyer_whatsapp_snapshot,
        expires_at, reminder_due_at, used_at, idempotency_key)
       VALUES ($1, $2, $3, '+628340001', now() + interval '1 day',
        now() + interval '12 hours', now(), $4)`,
      [transactionId, buyerId, `token-${transactionId}`, `confirmation-${transactionId}`]
    );
    return transactionId;
  }

  it("prepares, re-authenticates, and completes Seller payout separately from payment", async () => {
    const transactionId = await createEligiblePayout();
    const prepareInput = {
      transactionId,
      operation: "PAYOUT" as const,
      expectedStateVersion: 0
    };
    const prepared = await prepareFinancialOperation(
      { id: prepareAdminId, isAdmin: true },
      prepareInput,
      { key: randomUUID(), requestHash: hashRequest(prepareInput) }
    ) as any;
    expect(prepared).toMatchObject({
      lifecycle: "PREPARED",
      result: null,
      amount: 250000,
      destination: "BCA ******7890 a.n. Finance Seller"
    });

    const reauthInput = { password, expectedOperationVersion: 0 };
    await expect(reauthenticateFinancialOperation(
      { id: executeAdminId, isAdmin: true },
      "session-finance-1",
      prepared.id,
      password,
      0,
      { key: randomUUID(), requestHash: hashRequest(reauthInput) }
    )).resolves.toMatchObject({ reauthenticated: true });

    const executeInput = { expectedOperationVersion: 0 };
    const completed = await executeFinancialOperation(
      { id: executeAdminId, isAdmin: true },
      "session-finance-1",
      prepared.id,
      0,
      { key: randomUUID(), requestHash: hashRequest(executeInput) },
      createFakeFinancialTransferAdapter("SUCCESS")
    ) as any;
    expect(completed).toMatchObject({ result: "SUCCESS", lifecycle: "SUCCESS" });
    const transaction = await client.query(
      "SELECT state FROM transactions WHERE id = $1",
      [transactionId]
    );
    expect(transaction.rows[0].state).toBe("PAID_OUT");
    const operation = await client.query(
      `SELECT result, bank_reference, evidence_hash, started_at, completed_at
       FROM financial_operations WHERE id = $1`,
      [prepared.id]
    );
    expect(operation.rows[0]).toMatchObject({ result: "SUCCESS" });
    expect(operation.rows[0].bank_reference).toBeTruthy();
    expect(operation.rows[0].evidence_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("permits linked retry after FAILED and forbids retry after UNKNOWN", async () => {
    const failedTransactionId = await createEligiblePayout(300000);
    const failedInput = {
      transactionId: failedTransactionId,
      operation: "PAYOUT" as const,
      expectedStateVersion: 0
    };
    const failedPrepared = await prepareFinancialOperation(
      { id: prepareAdminId, isAdmin: true },
      failedInput,
      { key: randomUUID(), requestHash: hashRequest(failedInput) }
    ) as any;
    await reauthenticateFinancialOperation(
      { id: executeAdminId, isAdmin: true },
      "session-finance-failed",
      failedPrepared.id,
      password,
      0,
      { key: randomUUID(), requestHash: hashRequest({ password: "***", version: 0 }) }
    );
    const failed = await executeFinancialOperation(
      { id: executeAdminId, isAdmin: true },
      "session-finance-failed",
      failedPrepared.id,
      0,
      { key: randomUUID(), requestHash: hashRequest({ version: 0 }) },
      createFakeFinancialTransferAdapter("FAILED")
    ) as any;
    expect(failed.result).toBe("FAILED");
    const retryInput = { expectedOperationVersion: 2 };
    const retry = await retryFinancialOperation(
      { id: executeAdminId, isAdmin: true },
      failedPrepared.id,
      failed.stateVersion,
      { key: randomUUID(), requestHash: hashRequest(retryInput) }
    ) as any;
    expect(retry).toMatchObject({ attempt: 2, lifecycle: "PREPARED" });

    const unknownTransactionId = await createEligiblePayout(350000);
    const unknownInput = {
      transactionId: unknownTransactionId,
      operation: "PAYOUT" as const,
      expectedStateVersion: 0
    };
    const unknownPrepared = await prepareFinancialOperation(
      { id: prepareAdminId, isAdmin: true },
      unknownInput,
      { key: randomUUID(), requestHash: hashRequest(unknownInput) }
    ) as any;
    await reauthenticateFinancialOperation(
      { id: executeAdminId, isAdmin: true },
      "session-finance-unknown",
      unknownPrepared.id,
      password,
      0,
      { key: randomUUID(), requestHash: hashRequest({ password: "***", version: 0 }) }
    );
    const unknown = await executeFinancialOperation(
      { id: executeAdminId, isAdmin: true },
      "session-finance-unknown",
      unknownPrepared.id,
      0,
      { key: randomUUID(), requestHash: hashRequest({ version: 0 }) },
      createFakeFinancialTransferAdapter("UNKNOWN")
    ) as any;
    expect(unknown.result).toBe("UNKNOWN");
    await expect(retryFinancialOperation(
      { id: executeAdminId, isAdmin: true },
      unknownPrepared.id,
      unknown.stateVersion,
      { key: randomUUID(), requestHash: hashRequest({ unknown: true }) }
    )).rejects.toThrow("FINANCIAL_RETRY_NOT_ALLOWED");
  });

  it("claims a risk refund handoff, freezes the provider route, and requires two Admins", async () => {
    const transactionId = randomUUID();
    const riskCaseId = randomUUID();
    const eventId = randomUUID();
    const reviewId = randomUUID();
    const handoffId = randomUUID();
    const invoiceId = randomUUID();
    const providerEventId = randomUUID();
    const amount = 225000;
    await client.query(
      `INSERT INTO transactions
       (id, creator_account_id, creator_role, state, state_version)
       VALUES ($1, $2, 'BUYER', 'REFUND_READY', 0)`,
      [transactionId, buyerId]
    );
    await client.query(
      `INSERT INTO transaction_participants
       (transaction_id, account_id, role, name_snapshot, whatsapp_snapshot, joined_at)
       VALUES
       ($1, $2, 'BUYER', 'Finance Buyer', '+628340001', now()),
       ($1, $3, 'SELLER', 'Finance Seller', '+628350001', now())`,
      [transactionId, buyerId, sellerId]
    );
    await client.query(
      `INSERT INTO transaction_terms
       (transaction_id, item_description, item_price, shipping_cost,
        service_fee, total_amount, frozen_at)
       VALUES ($1, 'Barang refund', $2, 0, 5000, $2 + 5000, now())`,
      [transactionId, amount]
    );
    await client.query(
      `INSERT INTO buyer_refund_destinations
       (transaction_id, participant_account_id, bank_name, account_holder_name,
        raw_account_value, masked_account_value, locked_at)
       VALUES ($1, $2, 'BCA', 'Finance Buyer', '9876543210', '******3210', now())`,
      [transactionId, buyerId]
    );
    await client.query(
      `INSERT INTO risk_holds
       (id, transaction_id, category, reason, outcome, mode, lifecycle, active,
        source_state, source_state_version, created_by_account_id, resolved_at)
       VALUES ($1, $2, 'SUSPECTED_FRAUD', 'Risk review sudah selesai',
        'BUYER_REFUND', 'ACTIVE_HOLD', 'REVIEW_APPROVED', false,
        'RISK_HOLD', 0, $3, now())`,
      [riskCaseId, transactionId, prepareAdminId]
    );
    await client.query(
      `INSERT INTO risk_events
       (id, risk_case_id, event_type, actor_account_id, summary_snapshot,
        evidence_reference, evidence_hash, correlation_id, idempotency_key)
       VALUES ($1, $2, 'REVIEW_APPROVED', $3, 'Refund Buyer disetujui',
        'risk-evidence', repeat('b', 64), $4, $5)`,
      [eventId, riskCaseId, prepareAdminId, randomUUID(), `risk-event-${randomUUID()}`]
    );
    await client.query(
      `INSERT INTO risk_reviews
       (id, risk_case_id, version, status, outcome, buyer_amount, currency,
        calculation_hash, buyer_destination_binding_id, evidence_event_id,
        decision_note, proposed_by_account_id, decided_at)
       VALUES ($1, $2, 1, 'APPROVED', 'BUYER_REFUND', $3, 'IDR',
        repeat('c', 64), $4, $5, 'Dua Admin menyetujui refund', $6, now())`,
      [reviewId, riskCaseId, amount, buyerId, eventId, prepareAdminId]
    );
    await client.query(
      `INSERT INTO risk_financial_handoffs
       (id, risk_case_id, review_id, transaction_id, outcome, buyer_amount,
        currency, buyer_destination_binding_id, calculation_hash,
        evidence_reference, evidence_hash, source_state, source_state_version,
        approved_at)
       VALUES ($1, $2, $3, $4, 'BUYER_REFUND', $5, 'IDR', $6,
        repeat('c', 64), 'risk-evidence', repeat('b', 64),
        'REFUND_READY', 0, now())`,
      [handoffId, riskCaseId, reviewId, transactionId, amount, buyerId]
    );
    await client.query(
      `INSERT INTO payment_invoices
       (id, transaction_id, provider, provider_order_id, amount, currency,
        idempotency_reference, issued_at, deadline_at, is_active)
       VALUES ($1, $2, 'MIDTRANS', $3, $4, 'IDR', $5, now(),
        now() + interval '1 day', false)`,
      [
        invoiceId, transactionId, `refund-order-${transactionId}`, amount,
        `REFUND_INVOICE:${transactionId}`
      ]
    );
    await client.query(
      `INSERT INTO payment_provider_events
       (id, invoice_id, provider, provider_event_id, payload_hash,
        provider_order_id, amount, currency, provider_status, fraud_status,
        signature_valid, validation_outcome)
       VALUES ($1, $2, 'MIDTRANS', $3, repeat('d', 64), $4, $5, 'IDR',
        'settlement', 'accept', true, 'ACCEPTED')`,
      [
        providerEventId, invoiceId, `refund-event-${transactionId}`,
        `refund-order-${transactionId}`, amount
      ]
    );
    await client.query(
      `UPDATE payment_invoices
       SET authoritative_provider_event_id = $1, provider_status = 'settlement'
       WHERE id = $2`,
      [providerEventId, invoiceId]
    );
    const input = {
      transactionId,
      operation: "REFUND" as const,
      sourceType: "RISK" as const,
      handoffId,
      expectedStateVersion: 0
    };
    const prepared = await prepareFinancialOperation(
      { id: prepareAdminId, isAdmin: true },
      input,
      { key: randomUUID(), requestHash: hashRequest(input) },
      createFakeRefundProviderAdapter("SUPPORTED")
    ) as any;
    expect(prepared).toMatchObject({
      type: "REFUND",
      route: "MIDTRANS_REFUND",
      lifecycle: "PREPARED"
    });
    const firstApproval = {
      decision: "APPROVED" as const,
      expectedOperationVersion: 0
    };
    await approveFinancialOperation(
      { id: prepareAdminId, isAdmin: true },
      prepared.id,
      firstApproval,
      { key: randomUUID(), requestHash: hashRequest(firstApproval) }
    );
    const secondApproval = {
      decision: "APPROVED" as const,
      expectedOperationVersion: 0
    };
    await approveFinancialOperation(
      { id: executeAdminId, isAdmin: true },
      prepared.id,
      secondApproval,
      { key: randomUUID(), requestHash: hashRequest(secondApproval) }
    );
    const completed = await executeFinancialOperation(
      { id: executeAdminId, isAdmin: true },
      "refund-session",
      prepared.id,
      0,
      { key: randomUUID(), requestHash: hashRequest({ version: 0 }) },
      createFakeFinancialTransferAdapter("SUCCESS")
    ) as any;
    expect(completed.result).toBe("SUCCESS");
    const evidence = await client.query(
      `SELECT h.consumed_by_operation_id, o.route, a.capability, t.state
       FROM risk_financial_handoffs h
       JOIN financial_operations o ON o.id = h.consumed_by_operation_id
       JOIN refund_capability_assessments a
         ON a.id = o.selected_capability_assessment_id
       JOIN transactions t ON t.id = h.transaction_id
       WHERE h.id = $1`,
      [handoffId]
    );
    expect(evidence.rows[0]).toMatchObject({
      consumed_by_operation_id: prepared.id,
      route: "MIDTRANS_REFUND",
      capability: "SUPPORTED",
      state: "REFUNDED"
    });
  });

  it("never authorizes money movement from the legacy account assignment field", async () => {
    const transactionId = await createEligiblePayout(200000);
    const input = {
      transactionId,
      operation: "PAYOUT" as const,
      expectedStateVersion: 0
    };
    await expect(prepareFinancialOperation(
      { id: legacyOnlyAdminId, isAdmin: true },
      input,
      { key: randomUUID(), requestHash: hashRequest(input) }
    )).rejects.toThrow("FINANCIAL_ASSIGNMENT_REQUIRED");
  });

  it("enforces prepared lifecycle and append-only approvals in PostgreSQL", async () => {
    const transactionId = await createEligiblePayout(180000);
    await client.query("BEGIN");
    try {
      await expect(client.query(
        `INSERT INTO financial_operations
         (transaction_id, type, result, amount, destination_snapshot,
          started_by_account_id)
         VALUES ($1, 'PAYOUT', 'PROCESSING', 180000, 'masked', $2)`,
        [transactionId, prepareAdminId]
      )).rejects.toThrow(/lifecycle/i);
    } finally {
      await client.query("ROLLBACK");
    }
  });
});
