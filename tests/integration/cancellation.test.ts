import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { decideCancellationCalculation } from "@/server/cancellation/approval";
import { proposeCancellationCalculation } from "@/server/cancellation/calculation";
import { handoffCancellationToRisk } from "@/server/cancellation/delegation";
import { recordCancellationEvidence } from "@/server/cancellation/evidence";
import { recoverCancellationResponse } from "@/server/cancellation/response-recovery";
import { requestCancellation, withdrawCancellation } from "@/server/cancellation/service";
import { resolveCancellationProviderStatus } from "@/server/cancellation/provider-resolution";
import { db } from "@/server/db";
import { runCancellationReconciliationTimeout } from "@/server/jobs/cancellation-reconciliation-timeout";
import { runCancellationResponseTimeout } from "@/server/jobs/cancellation-response-timeout";
import { hashRequest } from "@/server/validation/mutation";

const connectionString = process.env.TEST_DATABASE_URL;
const integration = connectionString ? describe : describe.skip;
const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

integration("BAYAR-010 cancellation lifecycle", () => {
  let client: Client;
  const buyerId = randomUUID();
  const sellerId = randomUUID();
  const riskAdminId = randomUUID();
  const evidenceAdminId = randomUUID();
  const approvalAdminOneId = randomUUID();
  const approvalAdminTwoId = randomUUID();

  beforeAll(async () => {
    client = new Client({ connectionString });
    await client.connect();
    await client.query(
      `INSERT INTO accounts
       (id, email, display_name, whatsapp_number, whatsapp_verified_at, is_admin)
       VALUES
         ($1, $2, 'Cancel Buyer', $3, now(), false),
         ($4, $5, 'Cancel Seller', $6, now(), false),
         ($7, $8, 'Risk Admin', $9, now(), true),
         ($10, $11, 'Evidence Admin', $12, now(), true),
         ($13, $14, 'Approval Admin One', $15, now(), true),
         ($16, $17, 'Approval Admin Two', $18, now(), true)`,
      [
        buyerId, `cancel-buyer-${buyerId}@example.test`, `+62811${buyerId.slice(0, 8)}`,
        sellerId, `cancel-seller-${sellerId}@example.test`, `+62812${sellerId.slice(0, 8)}`,
        riskAdminId, `cancel-risk-${riskAdminId}@example.test`, `+62813${riskAdminId.slice(0, 8)}`,
        evidenceAdminId, `cancel-evidence-${evidenceAdminId}@example.test`, `+62814${evidenceAdminId.slice(0, 8)}`,
        approvalAdminOneId, `cancel-approval-one-${approvalAdminOneId}@example.test`, `+62815${approvalAdminOneId.slice(0, 8)}`,
        approvalAdminTwoId, `cancel-approval-two-${approvalAdminTwoId}@example.test`, `+62816${approvalAdminTwoId.slice(0, 8)}`
      ]
    );
    await client.query(
      `INSERT INTO admin_task_assignments
       (account_id, task_scope, assigned_by_account_id)
       VALUES
         ($1, 'RISK_INTAKE', $1),
         ($2, 'CANCELLATION_EVIDENCE', $1),
         ($2, 'CANCELLATION_RECONCILIATION', $1),
         ($3, 'CANCELLATION_APPROVAL', $1),
         ($4, 'CANCELLATION_APPROVAL', $1)`,
      [riskAdminId, evidenceAdminId, approvalAdminOneId, approvalAdminTwoId]
    );
  });

  afterAll(async () => {
    await client.end();
  });

  async function seedTransaction(state: string) {
    const transactionId = randomUUID();
    await client.query(
      `INSERT INTO transactions
       (id, creator_account_id, creator_role, state, state_version)
       VALUES ($1, $2, 'BUYER', $3, 0)`,
      [transactionId, buyerId, state]
    );
    await client.query(
      `INSERT INTO transaction_participants
       (transaction_id, account_id, role, name_snapshot, whatsapp_snapshot, joined_at)
       VALUES
         ($1, $2, 'BUYER', 'Cancel Buyer', '+628110001', now()),
         ($1, $3, 'SELLER', 'Cancel Seller', '+628120001', now())`,
      [transactionId, buyerId, sellerId]
    );
    return transactionId;
  }

  it("resolves direct non-risk cancellation and keeps direct risk active until handoff", async () => {
    const directId = await seedTransaction("WAITING_COUNTERPARTY_DATA");
    const directInput = {
      cause: "MUTUAL_NEUTRAL" as const,
      expectedStateVersion: 0
    };
    const direct = await requestCancellation(
      { id: buyerId, whatsappVerifiedAt: new Date() },
      directId,
      directInput,
      { key: randomUUID(), requestHash: hashRequest(directInput) }
    ) as any;
    expect(direct).toMatchObject({
      transactionState: "CANCELLED",
      requestStatus: "CLOSED",
      lifecycle: "RESOLVED"
    });

    const riskId = await seedTransaction("WAITING_COUNTERPARTY_DATA");
    const riskInput = {
      cause: "SUSPECTED_FRAUD" as const,
      expectedStateVersion: 0
    };
    const riskRequest = await requestCancellation(
      { id: buyerId, whatsappVerifiedAt: new Date() },
      riskId,
      riskInput,
      { key: randomUUID(), requestHash: hashRequest(riskInput) }
    ) as any;
    expect(riskRequest).toMatchObject({
      transactionState: "CANCELLED",
      requestStatus: "ACTIVE",
      delegationType: "RISK",
      delegationStatus: "REQUIRED"
    });
    const handoffInput = {
      cancellationRequestId: riskRequest.cancellationRequestId,
      evidenceReference: "risk-evidence",
      evidenceHash: "a".repeat(64),
      expectedStateVersion: 1
    };
    const handoff = await handoffCancellationToRisk(
      { id: riskAdminId, isAdmin: true },
      riskId,
      handoffInput,
      { key: randomUUID(), requestHash: hashRequest(handoffInput) }
    ) as any;
    expect(handoff).toMatchObject({ state: "CANCELLED", mode: "RECORD_ONLY" });
    const request = await client.query(
      "SELECT status, lifecycle, delegation_status, risk_case_id FROM cancellation_requests WHERE id = $1",
      [riskRequest.cancellationRequestId]
    );
    expect(request.rows[0]).toMatchObject({
      status: "CLOSED",
      lifecycle: "REFERRED_TO_RISK",
      delegation_status: "REFERRED"
    });
    expect(request.rows[0].risk_case_id).toBeTruthy();
  });

  it("keeps evidence append-only and creates a funded handoff after two Admin approvals", async () => {
    const transactionId = await seedTransaction("PAYMENT_CONFIRMED");
    await client.query(
      `INSERT INTO transaction_terms
       (transaction_id, item_description, item_price, shipping_cost,
        service_fee, total_amount, frozen_at)
       VALUES ($1, 'Barang fisik', 100000, 10000, 5000, 115000, now())`,
      [transactionId]
    );
    await client.query(
      `INSERT INTO buyer_refund_destinations
       (transaction_id, participant_account_id, bank_name, account_holder_name,
        raw_account_value, masked_account_value, locked_at)
       VALUES ($1, $2, 'BCA', 'Cancel Buyer', '1234567890', '******7890', now())`,
      [transactionId, buyerId]
    );
    const invoiceId = randomUUID();
    const providerEventId = randomUUID();
    await client.query(
      `INSERT INTO payment_invoices
       (id, transaction_id, provider, provider_order_id, amount, currency,
        idempotency_reference, deadline_at, is_active)
       VALUES ($1, $2, 'MIDTRANS', $3, 115000, 'IDR', $4,
        now() + interval '1 day', false)`,
      [invoiceId, transactionId, `ORDER-${transactionId}`, `INVOICE:${transactionId}`]
    );
    await client.query(
      `INSERT INTO payment_provider_events
       (id, invoice_id, provider, provider_event_id, payload_hash,
        provider_order_id, amount, currency, provider_status, fraud_status,
        validation_outcome)
       VALUES ($1, $2, 'MIDTRANS', $3, $4, $5, 115000, 'IDR',
        'settlement', 'accept', 'ACCEPTED')`,
      [
        providerEventId,
        invoiceId,
        `EVENT-${transactionId}`,
        "b".repeat(64),
        `ORDER-${transactionId}`
      ]
    );
    await client.query(
      "UPDATE payment_invoices SET authoritative_provider_event_id = $1 WHERE id = $2",
      [providerEventId, invoiceId]
    );

    const requestInput = {
      cause: "SELLER_UNABLE_TO_FULFILL" as const,
      expectedStateVersion: 0
    };
    const cancellation = await requestCancellation(
      { id: buyerId, whatsappVerifiedAt: new Date() },
      transactionId,
      requestInput,
      { key: randomUUID(), requestHash: hashRequest(requestInput) }
    ) as any;
    expect(cancellation.transactionState).toBe("FUNDED_CANCELLATION_REVIEW");

    const evidenceInput = {
      cancellationRequestId: cancellation.cancellationRequestId,
      evidenceKey: "WA_REQUEST" as const,
      sourceAuthorRole: "ADMIN" as const,
      evidenceReference: "wa-cancel-request",
      messageReference: "message-1",
      snapshotHash: "c".repeat(64),
      deliveryResult: "SENT" as const,
      expectedStateVersion: 1
    };
    const evidence = await recordCancellationEvidence(
      { id: evidenceAdminId, isAdmin: true },
      transactionId,
      evidenceInput,
      { key: randomUUID(), requestHash: hashRequest(evidenceInput) }
    ) as any;
    await expect(client.query(
      "UPDATE cancellation_evidence SET evidence_reference = 'changed' WHERE id = $1",
      [evidence.evidenceId]
    )).rejects.toThrow(/append-only/i);

    const heads = await client.query(
      `SELECT evidence_key, current_evidence_id
       FROM cancellation_evidence_heads
       WHERE cancellation_request_id = $1 ORDER BY evidence_key`,
      [cancellation.cancellationRequestId]
    );
    const evidenceSnapshotHash = digest(heads.rows.map((row) => ({
      key: row.evidence_key,
      id: row.current_evidence_id
    })));
    const calculationInput = {
      cancellationRequestId: cancellation.cancellationRequestId,
      evidenceSnapshotHash,
      expectedStateVersion: 1
    };
    const calculation = await proposeCancellationCalculation(
      { id: approvalAdminOneId, isAdmin: true },
      transactionId,
      calculationInput,
      { key: randomUUID(), requestHash: hashRequest(calculationInput) }
    ) as any;
    expect(calculation.buyerAmount).toBe(115000);

    for (const adminId of [approvalAdminOneId, approvalAdminTwoId]) {
      const decision = { decision: "APPROVED" as const, expectedStateVersion: 1 };
      await decideCancellationCalculation(
        { id: adminId, isAdmin: true },
        transactionId,
        calculation.calculationId,
        decision,
        { key: randomUUID(), requestHash: hashRequest(decision) }
      );
    }
    const handoffs = await client.query(
      `SELECT source_type, buyer_amount, source_state, consumed_at
       FROM cancellation_financial_handoffs WHERE transaction_id = $1`,
      [transactionId]
    );
    expect(handoffs.rows).toEqual([{
      source_type: "FUNDED_CANCELLATION",
      buyer_amount: 115000,
      source_state: "REFUND_READY",
      consumed_at: null
    }]);
    const operations = await client.query(
      "SELECT count(*)::int AS count FROM financial_operations WHERE transaction_id = $1",
      [transactionId]
    );
    expect(operations.rows[0].count).toBe(0);
  });

  it("records response timeout and recovers through an append-only Admin command", async () => {
    const transactionId = await seedTransaction("PAYMENT_CONFIRMED");
    const requestInput = {
      cause: "SELLER_UNABLE_TO_FULFILL" as const,
      expectedStateVersion: 0
    };
    const cancellation = await requestCancellation(
      { id: buyerId, whatsappVerifiedAt: new Date() },
      transactionId,
      requestInput,
      { key: randomUUID(), requestHash: hashRequest(requestInput) }
    ) as any;
    const evidenceInput = {
      cancellationRequestId: cancellation.cancellationRequestId,
      evidenceKey: "WA_REQUEST" as const,
      sourceAuthorRole: "ADMIN" as const,
      evidenceReference: "wa-timeout-request",
      snapshotHash: "d".repeat(64),
      deliveryResult: "SENT" as const,
      expectedStateVersion: 1
    };
    await recordCancellationEvidence(
      { id: evidenceAdminId, isAdmin: true },
      transactionId,
      evidenceInput,
      { key: randomUUID(), requestHash: hashRequest(evidenceInput) }
    );
    expect(await runCancellationResponseTimeout(
      new Date(Date.now() + 25 * 60 * 60 * 1000)
    )).toBeGreaterThanOrEqual(1);
    const timedOut = await client.query(
      `SELECT t.state, t.state_version, cr.manual_review_reason
       FROM transactions t
       JOIN cancellation_requests cr ON cr.transaction_id = t.id
       WHERE t.id = $1`,
      [transactionId]
    );
    expect(timedOut.rows[0]).toMatchObject({
      state: "MANUAL_REVIEW_REQUIRED",
      state_version: 2,
      manual_review_reason: "FUNDED_RESPONSE_TIMEOUT"
    });
    const heads = await client.query(
      `SELECT current_evidence_id FROM cancellation_evidence_heads
       WHERE cancellation_request_id = $1`,
      [cancellation.cancellationRequestId]
    );
    const recoveryInput = {
      cancellationRequestId: cancellation.cancellationRequestId,
      currentEvidenceHeadIds: heads.rows.map((row) => row.current_evidence_id as string),
      expectedStateVersion: 2
    };
    const recovered = await recoverCancellationResponse(
      { id: evidenceAdminId, isAdmin: true },
      transactionId,
      recoveryInput,
      { key: randomUUID(), requestHash: hashRequest(recoveryInput) }
    ) as any;
    expect(recovered).toMatchObject({
      state: "FUNDED_CANCELLATION_REVIEW",
      stateVersion: 3
    });
    const timeoutEvents = await client.query(
      `SELECT event_type FROM cancellation_events
       WHERE cancellation_request_id = $1 ORDER BY created_at`,
      [cancellation.cancellationRequestId]
    );
    expect(timeoutEvents.rows.map((row) => row.event_type)).toContain("RESPONSE_TIMEOUT_RECORDED");
    expect(timeoutEvents.rows.map((row) => row.event_type)).toContain("MANUAL_REVIEW_RECOVERY_RECORDED");
  });

  it("keeps timed-out reconciliation history and handles late fund without revival", async () => {
    const transactionId = await seedTransaction("WAITING_BUYER_PAYMENT");
    const invoiceId = randomUUID();
    await client.query(
      `INSERT INTO payment_invoices
       (id, transaction_id, provider, provider_order_id, amount, currency,
        idempotency_reference, deadline_at, is_active)
       VALUES ($1, $2, 'MIDTRANS', $3, 50000, 'IDR', $4,
        now() + interval '1 day', true)`,
      [invoiceId, transactionId, `ORDER-${transactionId}`, `INVOICE:${transactionId}`]
    );
    const requestInput = {
      cause: "MUTUAL_NEUTRAL" as const,
      expectedStateVersion: 0
    };
    const cancellation = await requestCancellation(
      { id: buyerId, whatsappVerifiedAt: new Date() },
      transactionId,
      requestInput,
      { key: randomUUID(), requestHash: hashRequest(requestInput) }
    ) as any;
    const reconciliation = await client.query(
      `SELECT cr.id, cr.payment_reconciliation_id
       FROM cancellation_reconciliations cr
       WHERE cr.cancellation_request_id = $1`,
      [cancellation.cancellationRequestId]
    );
    expect(await runCancellationReconciliationTimeout(
      new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    )).toBeGreaterThanOrEqual(1);
    const providerEventId = randomUUID();
    await client.query(
      `INSERT INTO payment_provider_events
       (id, invoice_id, provider, provider_event_id, payload_hash,
        provider_order_id, amount, currency, provider_status, fraud_status,
        validation_outcome)
       VALUES ($1, $2, 'MIDTRANS', $3, $4, $5, 50000, 'IDR',
        'settlement', 'accept', 'ACCEPTED')`,
      [
        providerEventId,
        invoiceId,
        `TIMEOUT-EVENT-${transactionId}`,
        "e".repeat(64),
        `ORDER-${transactionId}`
      ]
    );
    await db.transaction((tx) => resolveCancellationProviderStatus(tx, {
      transactionId,
      invoiceId,
      cancellationRequestId: cancellation.cancellationRequestId,
      paymentReconciliationId: reconciliation.rows[0].payment_reconciliation_id as string,
      providerEventId,
      expectedStateVersion: 2,
      source: "ADMIN_RECOVERY",
      correlationId: randomUUID(),
      idempotencyKey: randomUUID()
    }));
    const timeoutRow = await client.query(
      "SELECT status FROM cancellation_reconciliations WHERE id = $1",
      [reconciliation.rows[0].id]
    );
    expect(timeoutRow.rows[0].status).toBe("TIMED_OUT");

    const lateTransactionId = await seedTransaction("PAYMENT_EXPIRED");
    const lateInvoiceId = randomUUID();
    const lateEventId = randomUUID();
    const lateReconciliationId = randomUUID();
    await client.query(
      `INSERT INTO payment_invoices
       (id, transaction_id, provider, provider_order_id, amount, currency,
        idempotency_reference, deadline_at, is_active)
       VALUES ($1, $2, 'MIDTRANS', $3, 75000, 'IDR', $4,
        now() - interval '1 day', false)`,
      [lateInvoiceId, lateTransactionId, `ORDER-${lateTransactionId}`, `INVOICE:${lateTransactionId}`]
    );
    await client.query(
      `INSERT INTO payment_provider_events
       (id, invoice_id, provider, provider_event_id, payload_hash,
        provider_order_id, amount, currency, provider_status, fraud_status,
        validation_outcome)
       VALUES ($1, $2, 'MIDTRANS', $3, $4, $5, 75000, 'IDR',
        'settlement', 'accept', 'ACCEPTED')`,
      [
        lateEventId,
        lateInvoiceId,
        `LATE-EVENT-${lateTransactionId}`,
        "f".repeat(64),
        `ORDER-${lateTransactionId}`
      ]
    );
    await client.query(
      `INSERT INTO payment_reconciliations
       (id, transaction_id, invoice_id, decision, decision_code,
        deadline_at, result)
       VALUES ($1, $2, $3, 'LATE_FUND_HANDOFF', 'LATE_FUND_HANDOFF',
        now(), 'UNKNOWN')`,
      [lateReconciliationId, lateTransactionId, lateInvoiceId]
    );
    const lateResult = await db.transaction((tx) => resolveCancellationProviderStatus(tx, {
      transactionId: lateTransactionId,
      invoiceId: lateInvoiceId,
      cancellationRequestId: null,
      paymentReconciliationId: lateReconciliationId,
      providerEventId: lateEventId,
      expectedStateVersion: 0,
      source: "WEBHOOK",
      correlationId: randomUUID(),
      idempotencyKey: randomUUID()
    })) as any;
    expect(lateResult).toMatchObject({ state: "REFUND_READY", stateVersion: 1 });
    const lateInvoice = await client.query(
      "SELECT authoritative_provider_event_id FROM payment_invoices WHERE id = $1",
      [lateInvoiceId]
    );
    expect(lateInvoice.rows[0].authoritative_provider_event_id).toBeNull();
    const lateHandoff = await client.query(
      `SELECT source_type, source_state FROM cancellation_financial_handoffs
       WHERE transaction_id = $1`,
      [lateTransactionId]
    );
    expect(lateHandoff.rows[0]).toMatchObject({
      source_type: "LATE_FUND",
      source_state: "REFUND_READY"
    });
  });

  it("withdraws only by restoring the same still-safe invoice", async () => {
    const transactionId = await seedTransaction("WAITING_BUYER_PAYMENT");
    const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await client.query(
      `INSERT INTO payment_invoices
       (transaction_id, provider, provider_order_id, amount, currency,
        provider_status, idempotency_reference, deadline_at, is_active)
       VALUES ($1, 'MIDTRANS', $2, 90000, 'IDR', 'pending', $3, $4, true)`,
      [transactionId, `ORDER-${transactionId}`, `INVOICE:${transactionId}`, deadline]
    );
    const requestInput = {
      cause: "BUYER_CHANGE_OF_MIND" as const,
      expectedStateVersion: 0
    };
    const cancellation = await requestCancellation(
      { id: buyerId, whatsappVerifiedAt: new Date() },
      transactionId,
      requestInput,
      { key: randomUUID(), requestHash: hashRequest(requestInput) }
    ) as any;
    const withdrawInput = {
      cancellationRequestId: cancellation.cancellationRequestId,
      reason: "Buyer dan Seller sepakat melanjutkan transaksi.",
      expectedStateVersion: 1
    };
    const withdrawn = await withdrawCancellation(
      { id: buyerId, whatsappVerifiedAt: new Date() },
      transactionId,
      withdrawInput,
      { key: randomUUID(), requestHash: hashRequest(withdrawInput) }
    ) as any;
    expect(withdrawn).toMatchObject({
      transactionState: "WAITING_BUYER_PAYMENT",
      stateVersion: 2,
      requestStatus: "CLOSED",
      lifecycle: "WITHDRAWN"
    });
    const invoice = await client.query(
      `SELECT is_active, deadline_at FROM payment_invoices
       WHERE transaction_id = $1`,
      [transactionId]
    );
    expect(invoice.rows[0].is_active).toBe(true);
    expect(new Date(invoice.rows[0].deadline_at).getTime()).toBe(deadline.getTime());
  });
});
