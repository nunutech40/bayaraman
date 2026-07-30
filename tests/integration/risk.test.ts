import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { db } from "@/server/db";
import { financialOperations } from "@/server/db/schema";
import { claimRiskRefundHandoff } from "@/server/risk/handoff";
import { hashRequest } from "@/server/validation/mutation";
import {
  decideRiskReview,
  proposeRiskReview,
  readAdminRisks,
  readParticipantRisk,
  recordRisk
} from "@/server/risk/service";
import {
  evaluateReleaseGate,
  readReleaseGate,
  recordReleaseGateEvidence
} from "@/server/release-gate/service";
import type { ReleaseGateItemKey } from "@/server/release-gate/contracts";

const connectionString = process.env.TEST_DATABASE_URL;
const integration = connectionString ? describe : describe.skip;

integration("BAYAR-011 risk hold and release gate", () => {
  let client: Client;
  const intakeAdminId = randomUUID();
  const approvalAdminOneId = randomUUID();
  const approvalAdminTwoId = randomUUID();
  const gateAdminId = randomUUID();
  const buyerId = randomUUID();
  const sellerId = randomUUID();
  const transactionId = randomUUID();

  beforeAll(async () => {
    client = new Client({ connectionString });
    await client.connect();
    await client.query(
      `INSERT INTO accounts (id, email, display_name, whatsapp_number, is_admin)
       VALUES
         ($1, $2, 'Risk Intake Admin', $3, true),
         ($4, $5, 'Risk Approval One', $6, true),
         ($7, $8, 'Risk Approval Two', $9, true),
         ($10, $11, 'Release Gate Admin', $12, true),
         ($13, $14, 'Risk Buyer', $15, false),
         ($16, $17, 'Risk Seller', $18, false)`,
      [
        intakeAdminId, `risk-intake-${intakeAdminId}@example.test`, `+62821${intakeAdminId.slice(0, 8)}`,
        approvalAdminOneId, `risk-approval-one-${approvalAdminOneId}@example.test`, `+62822${approvalAdminOneId.slice(0, 8)}`,
        approvalAdminTwoId, `risk-approval-two-${approvalAdminTwoId}@example.test`, `+62823${approvalAdminTwoId.slice(0, 8)}`,
        gateAdminId, `risk-gate-${gateAdminId}@example.test`, `+62824${gateAdminId.slice(0, 8)}`,
        buyerId, `risk-buyer-${buyerId}@example.test`, `+62825${buyerId.slice(0, 8)}`,
        sellerId, `risk-seller-${sellerId}@example.test`, `+62826${sellerId.slice(0, 8)}`
      ]
    );
    await client.query(
      `INSERT INTO admin_task_assignments (account_id, task_scope, assigned_by_account_id)
       VALUES ($1, 'RISK_INTAKE', $1),
              ($2, 'RISK_APPROVAL', $1),
              ($3, 'RISK_APPROVAL', $1),
              ($4, 'RELEASE_GATE_REVIEW', $1)`,
      [intakeAdminId, approvalAdminOneId, approvalAdminTwoId, gateAdminId]
    );
    await client.query(
      `INSERT INTO transactions (id, creator_account_id, creator_role, state, state_version)
       VALUES ($1, $2, 'BUYER', 'READY_FOR_PAYOUT', 0)`,
      [transactionId, buyerId]
    );
    await client.query(
      `INSERT INTO transaction_participants
       (transaction_id, account_id, role, name_snapshot, whatsapp_snapshot, joined_at)
       VALUES ($1, $2, 'BUYER', 'Risk Buyer', '+628250001', now()),
              ($1, $3, 'SELLER', 'Risk Seller', '+628260001', now())`,
      [transactionId, buyerId, sellerId]
    );
    await client.query(
      `INSERT INTO transaction_terms
       (transaction_id, item_description, item_price, shipping_cost, service_fee, total_amount, frozen_at)
       VALUES ($1, 'Barang fisik', 100000, 10000, 5000, 115000, now())`,
      [transactionId]
    );
    await client.query(
      `INSERT INTO buyer_refund_destinations
       (transaction_id, participant_account_id, bank_name, account_holder_name,
        raw_account_value, masked_account_value, locked_at)
       VALUES ($1, $2, 'BCA', 'Risk Buyer', '0987654321', '******4321', now())`,
      [transactionId, buyerId]
    );
  });

  afterAll(async () => {
    await client.end();
  });

  it("creates an assigned risk hold and exposes only a generic participant summary", async () => {
    const input = {
      category: "SUSPECTED_FRAUD" as const,
      reason: "Admin menerima evidence risiko yang perlu diperiksa manual.",
      evidenceReference: "risk-evidence-001",
      evidenceHash: "1".repeat(64),
      expectedStateVersion: 0
    };
    const recorded = await recordRisk(
      { id: intakeAdminId, isAdmin: true },
      transactionId,
      input,
      { key: randomUUID(), requestHash: hashRequest(input) }
    ) as any;
    expect(recorded).toMatchObject({
      state: "RISK_HOLD",
      stateVersion: 1,
      lifecycle: "OPEN",
      mode: "ACTIVE_HOLD"
    });

    const participant = await readParticipantRisk(transactionId, buyerId);
    expect(participant).toMatchObject({
      status: "HOLD_ACTIVE",
      summary: "Transaksi sedang ditinjau Admin.",
      nextResponsibleActor: "ADMIN"
    });
    const serialized = JSON.stringify(participant);
    expect(serialized).not.toContain("SUSPECTED_FRAUD");
    expect(serialized).not.toContain("risk-evidence");
    expect(serialized).not.toContain("0987654321");
  });

  it("requires two distinct approvals and creates a refund handoff without moving money", async () => {
    const projection = await readAdminRisks(
      { id: approvalAdminOneId, isAdmin: true },
      transactionId
    );
    const risk = projection.risks.find((item) => item.active);
    expect(risk).toBeTruthy();
    const proposal = {
      outcome: "BUYER_REFUND" as const,
      evidenceEventId: risk!.currentEventId!,
      decisionNote: "Evidence mendukung refund Buyer melalui proses finansial terpisah.",
      expectedStateVersion: 1
    };
    const review = await proposeRiskReview(
      { id: approvalAdminOneId, isAdmin: true },
      transactionId,
      risk!.id,
      proposal,
      { key: randomUUID(), requestHash: hashRequest(proposal) }
    ) as any;
    expect(review.status).toBe("PENDING");

    const first = { decision: "APPROVED" as const, expectedStateVersion: 1 };
    const firstResult = await decideRiskReview(
      { id: approvalAdminOneId, isAdmin: true },
      transactionId,
      risk!.id,
      review.reviewId,
      first,
      { key: randomUUID(), requestHash: hashRequest(first) }
    ) as any;
    expect(firstResult).toMatchObject({ status: "PENDING", approvals: 1 });

    const second = { decision: "APPROVED" as const, expectedStateVersion: 1 };
    const finalResult = await decideRiskReview(
      { id: approvalAdminTwoId, isAdmin: true },
      transactionId,
      risk!.id,
      review.reviewId,
      second,
      { key: randomUUID(), requestHash: hashRequest(second) }
    ) as any;
    expect(finalResult).toMatchObject({
      status: "APPROVED",
      state: "REFUND_READY",
      stateVersion: 2,
      lifecycle: "REVIEW_APPROVED"
    });

    const handoffs = await client.query(
      `SELECT outcome, buyer_amount, currency, consumed_at
       FROM risk_financial_handoffs WHERE risk_case_id = $1`,
      [risk!.id]
    );
    expect(handoffs.rows).toHaveLength(1);
    expect(handoffs.rows[0]).toMatchObject({
      outcome: "BUYER_REFUND",
      buyer_amount: 115000,
      currency: "IDR",
      consumed_at: null
    });
    const operations = await client.query(
      "SELECT count(*)::int AS count FROM financial_operations WHERE transaction_id = $1",
      [transactionId]
    );
    expect(operations.rows[0].count).toBe(0);
    await expect(client.query(
      "UPDATE risk_financial_handoffs SET buyer_amount = buyer_amount + 1 WHERE risk_case_id = $1",
      [risk!.id]
    )).rejects.toThrow(/claim|immutable/i);
  });

  it("allows BAYAR-008 to claim the approved refund handoff exactly once", async () => {
    const handoffResult = await client.query(
      "SELECT id FROM risk_financial_handoffs WHERE transaction_id = $1",
      [transactionId]
    );
    const handoffId = handoffResult.rows[0].id as string;
    const operationId = randomUUID();
    await db.transaction(async (tx) => {
      await tx.insert(financialOperations).values({
        id: operationId,
        transactionId,
        type: "REFUND",
        result: "PROCESSING",
        amount: 115000,
        destinationSnapshot: "BCA ******4321",
        startedAt: new Date(),
        startedByAccountId: approvalAdminTwoId
      });
      const claimed = await claimRiskRefundHandoff(tx, {
        handoffId,
        transactionId,
        expectedSourceStateVersion: 2,
        parentOperationId: operationId,
        actorAccountId: approvalAdminTwoId,
        correlationId: randomUUID()
      });
      expect(claimed.consumedByOperationId).toBe(operationId);
      const replay = await claimRiskRefundHandoff(tx, {
        handoffId,
        transactionId,
        expectedSourceStateVersion: 2,
        parentOperationId: operationId,
        actorAccountId: approvalAdminTwoId,
        correlationId: randomUUID()
      });
      expect(replay.consumedByOperationId).toBe(operationId);
    });
    const otherOperationId = randomUUID();
    await client.query(
      `INSERT INTO financial_operations
       (id, transaction_id, type, result, amount, destination_snapshot,
        started_at, completed_at, started_by_account_id)
       VALUES ($1, $2, 'REFUND', 'FAILED', 115000, 'BCA ******4321', now(), now(), $3)`,
      [otherOperationId, transactionId, approvalAdminTwoId]
    );
    await expect(db.transaction((tx) => claimRiskRefundHandoff(tx, {
      handoffId,
      transactionId,
      expectedSourceStateVersion: 2,
      parentOperationId: otherOperationId,
      actorAccountId: approvalAdminTwoId,
      correlationId: randomUUID()
    }))).rejects.toThrow("RISK_HANDOFF_ALREADY_CLAIMED");
  });

  it("rejects unassigned intake and stores post-processing risk without state reversal", async () => {
    const unassignedAdminId = randomUUID();
    const postTransactionId = randomUUID();
    await client.query(
      `INSERT INTO accounts (id, email, display_name, whatsapp_number, is_admin)
       VALUES ($1, $2, 'Unassigned Risk Admin', $3, true)`,
      [unassignedAdminId, `risk-unassigned-${unassignedAdminId}@example.test`, `+62827${unassignedAdminId.slice(0, 8)}`]
    );
    await client.query(
      `INSERT INTO transactions (id, creator_account_id, creator_role, state, state_version)
       VALUES ($1, $2, 'SELLER', 'PAID_OUT', 7)`,
      [postTransactionId, sellerId]
    );
    const input = {
      category: "PROHIBITED_OR_POLICY" as const,
      reason: "Evidence diterima setelah payout berhasil diproses.",
      evidenceReference: "risk-post-processing",
      evidenceHash: "2".repeat(64),
      expectedStateVersion: 7
    };
    await expect(recordRisk(
      { id: unassignedAdminId, isAdmin: true },
      postTransactionId,
      input,
      { key: randomUUID(), requestHash: hashRequest(input) }
    )).rejects.toThrow("RISK_ASSIGNMENT_REQUIRED");
    const result = await recordRisk(
      { id: intakeAdminId, isAdmin: true },
      postTransactionId,
      input,
      { key: randomUUID(), requestHash: hashRequest(input) }
    ) as any;
    expect(result).toMatchObject({
      state: "PAID_OUT",
      stateVersion: 7,
      lifecycle: "POST_PROCESSING_RECORDED",
      mode: "RECORD_ONLY"
    });
  });

  it("supports keep-hold and clear-to-manual-review without a financial handoff", async () => {
    for (const [outcome, expectedState, expectedLifecycle] of [
      ["KEEP_HOLD", "RISK_HOLD", "REVIEWED_HOLD"],
      ["CLEAR_TO_MANUAL_REVIEW", "MANUAL_REVIEW_REQUIRED", "CLEARED_TO_MANUAL_REVIEW"]
    ] as const) {
      const reviewTransactionId = randomUUID();
      await client.query(
        `INSERT INTO transactions (id, creator_account_id, creator_role, state, state_version)
         VALUES ($1, $2, 'BUYER', 'PAYMENT_CONFIRMED', 0)`,
        [reviewTransactionId, buyerId]
      );
      const intake = {
        category: "OTHER_MANUAL_REVIEW" as const,
        reason: `Evidence untuk outcome ${outcome} perlu review Admin.`,
        note: "Case pengujian outcome non-finansial.",
        evidenceReference: `risk-${outcome.toLowerCase()}`,
        evidenceHash: "3".repeat(64),
        expectedStateVersion: 0
      };
      const recorded = await recordRisk(
        { id: intakeAdminId, isAdmin: true },
        reviewTransactionId,
        intake,
        { key: randomUUID(), requestHash: hashRequest(intake) }
      ) as any;
      const projection = await readAdminRisks(
        { id: approvalAdminOneId, isAdmin: true },
        reviewTransactionId
      );
      const risk = projection.risks[0]!;
      const proposal = {
        outcome,
        evidenceEventId: risk.currentEventId!,
        decisionNote: `Admin mengusulkan ${outcome} tanpa tindakan finansial langsung.`,
        expectedStateVersion: recorded.stateVersion
      };
      const review = await proposeRiskReview(
        { id: approvalAdminOneId, isAdmin: true },
        reviewTransactionId,
        risk.id,
        proposal,
        { key: randomUUID(), requestHash: hashRequest(proposal) }
      ) as any;
      const approval = {
        decision: "APPROVED" as const,
        expectedStateVersion: recorded.stateVersion
      };
      const result = await decideRiskReview(
        { id: approvalAdminOneId, isAdmin: true },
        reviewTransactionId,
        risk.id,
        review.reviewId,
        approval,
        { key: randomUUID(), requestHash: hashRequest(approval) }
      ) as any;
      expect(result).toMatchObject({
        status: "APPROVED",
        state: expectedState,
        lifecycle: expectedLifecycle
      });
      const handoff = await client.query(
        "SELECT count(*)::int AS count FROM risk_financial_handoffs WHERE transaction_id = $1",
        [reviewTransactionId]
      );
      expect(handoff.rows[0].count).toBe(0);
    }
  });

  it("records the release gate independently from transaction state", async () => {
    const before = await readReleaseGate({ id: gateAdminId, isAdmin: true });
    const item = before.items.find((candidate: { itemKey: string }) =>
      candidate.itemKey === "MIDTRANS_SETTLEMENT"
    );
    expect(item).toBeTruthy();
    const evidence = {
      status: "APPROVED" as const,
      evidenceReference: "external-midtrans-settlement-review",
      externalApproverReference: "merchant-review-001",
      expectedGateVersion: before.stateVersion
    };
    await recordReleaseGateEvidence(
      { id: gateAdminId, isAdmin: true },
      "MIDTRANS_SETTLEMENT",
      evidence,
      { key: randomUUID(), requestHash: hashRequest(evidence) }
    );
    const blockedEvidence = {
      status: "BLOCKED" as const,
      evidenceReference: "pending-legal-review",
      expectedGateVersion: before.stateVersion
    };
    await recordReleaseGateEvidence(
      { id: gateAdminId, isAdmin: true },
      "LEGAL_COMPLIANCE",
      blockedEvidence,
      { key: randomUUID(), requestHash: hashRequest(blockedEvidence) }
    );
    const evaluation = {
      expectedGateVersion: before.stateVersion
    };
    const result = await evaluateReleaseGate(
      { id: gateAdminId, isAdmin: true },
      evaluation,
      { key: randomUUID(), requestHash: hashRequest(evaluation) }
    ) as any;
    expect(result).toMatchObject({ status: "BLOCKED", stateVersion: before.stateVersion + 1 });
    const transaction = await client.query(
      "SELECT state, state_version FROM transactions WHERE id = $1",
      [transactionId]
    );
    expect(transaction.rows[0]).toMatchObject({ state: "REFUND_READY", state_version: 2 });
  });

  it("approves the release gate only after every item and an external decision are recorded", async () => {
    const before = await readReleaseGate({ id: gateAdminId, isAdmin: true });
    for (const item of before.items as Array<{ itemKey: ReleaseGateItemKey }>) {
      const evidence = {
        status: "APPROVED" as const,
        evidenceReference: `external-${String(item.itemKey).toLowerCase()}`,
        externalApproverReference: `authority-${String(item.itemKey).toLowerCase()}`,
        expectedGateVersion: before.stateVersion
      };
      await recordReleaseGateEvidence(
        { id: gateAdminId, isAdmin: true },
        item.itemKey,
        evidence,
        { key: randomUUID(), requestHash: hashRequest(evidence) }
      );
    }
    const evaluation = {
      expectedGateVersion: before.stateVersion,
      externalDecisionReference: "external-real-money-pilot-decision"
    };
    const approved = await evaluateReleaseGate(
      { id: gateAdminId, isAdmin: true },
      evaluation,
      { key: randomUUID(), requestHash: hashRequest(evaluation) }
    ) as any;
    expect(approved).toMatchObject({
      status: "APPROVED",
      stateVersion: before.stateVersion + 1
    });
  });
});
