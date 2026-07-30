import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { hashRequest } from "@/server/validation/mutation";
import {
  correctComplaintEvidence,
  decideComplaintAgreement,
  proposeComplaintAgreement,
  readAdminComplaints,
  readParticipantComplaint,
  recordComplaint,
  recordNoAgreement
} from "@/server/complaint/service";

const connectionString = process.env.TEST_DATABASE_URL;
const integration = connectionString ? describe : describe.skip;

integration("BAYAR-009 complaint hold and external settlement recording", () => {
  let client: Client;
  const intakeAdminId = randomUUID();
  const approvalAdminOneId = randomUUID();
  const approvalAdminTwoId = randomUUID();
  const buyerId = randomUUID();
  const sellerId = randomUUID();
  const transactionId = randomUUID();

  beforeAll(async () => {
    client = new Client({ connectionString });
    await client.connect();
    await client.query(
      `INSERT INTO accounts (id, email, display_name, whatsapp_number, is_admin)
       VALUES
         ($1, $2, 'Complaint Intake Admin', $3, true),
         ($4, $5, 'Complaint Approval One', $6, true),
         ($7, $8, 'Complaint Approval Two', $9, true),
         ($10, $11, 'Complaint Buyer', $12, false),
         ($13, $14, 'Complaint Seller', $15, false)`,
      [
        intakeAdminId, `complaint-intake-${intakeAdminId}@example.test`, `+62811${intakeAdminId.slice(0, 8)}`,
        approvalAdminOneId, `complaint-approval-one-${approvalAdminOneId}@example.test`, `+62812${approvalAdminOneId.slice(0, 8)}`,
        approvalAdminTwoId, `complaint-approval-two-${approvalAdminTwoId}@example.test`, `+62813${approvalAdminTwoId.slice(0, 8)}`,
        buyerId, `complaint-buyer-${buyerId}@example.test`, `+62814${buyerId.slice(0, 8)}`,
        sellerId, `complaint-seller-${sellerId}@example.test`, `+62815${sellerId.slice(0, 8)}`
      ]
    );
    await client.query(
      `INSERT INTO admin_task_assignments (account_id, task_scope, assigned_by_account_id)
       VALUES ($1, 'COMPLAINT_INTAKE', $1),
              ($2, 'COMPLAINT_APPROVAL', $1),
              ($3, 'COMPLAINT_APPROVAL', $1)`,
      [intakeAdminId, approvalAdminOneId, approvalAdminTwoId]
    );
    await client.query(
      `INSERT INTO transactions (id, creator_account_id, creator_role, state, state_version)
       VALUES ($1, $2, 'BUYER', 'PAYMENT_CONFIRMED', 0)`,
      [transactionId, buyerId]
    );
    await client.query(
      `INSERT INTO transaction_participants
       (transaction_id, account_id, role, name_snapshot, whatsapp_snapshot, joined_at)
       VALUES ($1, $2, 'BUYER', 'Complaint Buyer', '+628140001', now()),
              ($1, $3, 'SELLER', 'Complaint Seller', '+628150001', now())`,
      [transactionId, buyerId, sellerId]
    );
    await client.query(
      `INSERT INTO transaction_terms
       (transaction_id, item_description, item_price, shipping_cost, service_fee, total_amount, frozen_at)
       VALUES ($1, 'Barang fisik', 100000, 10000, 5000, 115000, now())`,
      [transactionId]
    );
    await client.query(
      `INSERT INTO seller_payout_destinations
       (transaction_id, participant_account_id, bank_name, account_holder_name,
        raw_account_value, masked_account_value, locked_at)
       VALUES ($1, $2, 'BCA', 'Complaint Seller', '1234567890', '******7890', now())`,
      [transactionId, sellerId]
    );
    await client.query(
      `INSERT INTO buyer_refund_destinations
       (transaction_id, participant_account_id, bank_name, account_holder_name,
        raw_account_value, masked_account_value, locked_at)
       VALUES ($1, $2, 'BCA', 'Complaint Buyer', '0987654321', '******4321', now())`,
      [transactionId, buyerId]
    );
  });

  afterAll(async () => {
    await client.end();
  });

  it("holds an eligible transaction, corrects evidence append-only, and masks participant projection", async () => {
    const intake = {
      summary: "Buyer melaporkan barang berbeda dari kesepakatan di group.",
      evidenceReference: "wa-complaint-001",
      evidenceHash: "1".repeat(64),
      sourceAuthorRole: "BUYER" as const,
      expectedStateVersion: 0
    };
    const recorded = await recordComplaint(
      { id: intakeAdminId, isAdmin: true }, transactionId, intake,
      { key: randomUUID(), requestHash: hashRequest(intake) }
    ) as any;
    expect(recorded).toMatchObject({ state: "PAYOUT_ON_HOLD", stateVersion: 1, lifecycle: "OPEN" });

    const current = await client.query("SELECT current_event_id FROM complaint_holds WHERE id = $1", [recorded.complaintCaseId]);
    const correction = {
      correctedEventId: current.rows[0].current_event_id as string,
      summary: "Buyer mengoreksi referensi laporan tanpa mengubah substansi.",
      evidenceReference: "wa-complaint-002",
      evidenceHash: "2".repeat(64),
      correctionReason: "Referensi pesan pertama tidak tepat.",
      sourceAuthorRole: "BUYER" as const,
      expectedStateVersion: 1
    };
    await correctComplaintEvidence(
      { id: intakeAdminId, isAdmin: true }, transactionId, recorded.complaintCaseId,
      correction, { key: randomUUID(), requestHash: hashRequest(correction) }
    );
    const events = await client.query("SELECT event_type FROM complaint_events WHERE complaint_case_id = $1 ORDER BY created_at", [recorded.complaintCaseId]);
    expect(events.rows.map((row) => row.event_type)).toEqual(["COMPLAINT_RECORDED", "EVIDENCE_CORRECTED"]);

    const summary = await readParticipantComplaint(transactionId, buyerId);
    expect(summary).toMatchObject({ status: "HOLD_ACTIVE", nextResponsibleActor: "BUYER_SELLER" });
    expect(JSON.stringify(summary)).not.toContain("wa-complaint");
    expect(JSON.stringify(summary)).not.toContain("1234567890");
  });

  it("publishes one handoff only after two distinct approval assignments", async () => {
    const caseRow = await client.query("SELECT id, current_event_id FROM complaint_holds WHERE transaction_id = $1 AND active = true", [transactionId]);
    const complaintCaseId = caseRow.rows[0].id as string;
    const proposal = {
      outcome: "SELLER_RELEASE" as const,
      evidenceEventId: caseRow.rows[0].current_event_id as string,
      evidenceReference: "written-mutual-agreement",
      evidenceHash: "3".repeat(64),
      expectedStateVersion: 1
    };
    const agreement = await proposeComplaintAgreement(
      { id: intakeAdminId, isAdmin: true }, transactionId, complaintCaseId,
      proposal, { key: randomUUID(), requestHash: hashRequest(proposal) }
    ) as any;
    expect(agreement.status).toBe("PENDING");
    const approvalProjection = await readAdminComplaints(
      { id: approvalAdminOneId, isAdmin: true },
      transactionId
    );
    expect(approvalProjection.complaints[0]?.agreements[0]?.id).toBe(agreement.agreementId);

    const first = { decision: "APPROVED" as const, expectedStateVersion: 1 };
    const firstResult = await decideComplaintAgreement(
      { id: approvalAdminOneId, isAdmin: true }, transactionId, complaintCaseId,
      agreement.agreementId, first, { key: randomUUID(), requestHash: hashRequest(first) }
    ) as any;
    expect(firstResult).toMatchObject({ status: "PENDING", approvals: 1 });

    const second = { decision: "APPROVED" as const, expectedStateVersion: 1 };
    const finalResult = await decideComplaintAgreement(
      { id: approvalAdminTwoId, isAdmin: true }, transactionId, complaintCaseId,
      agreement.agreementId, second, { key: randomUUID(), requestHash: hashRequest(second) }
    ) as any;
    expect(finalResult).toMatchObject({ status: "APPROVED", state: "READY_FOR_PAYOUT", stateVersion: 2 });
    const handoffs = await client.query("SELECT outcome, seller_amount, buyer_amount, consumed_at FROM complaint_financial_handoffs WHERE complaint_case_id = $1", [complaintCaseId]);
    expect(handoffs.rows).toHaveLength(1);
    expect(handoffs.rows[0]).toMatchObject({ outcome: "SELLER_RELEASE", seller_amount: 110000, buyer_amount: 0, consumed_at: null });
    const operations = await client.query("SELECT count(*)::int AS count FROM financial_operations WHERE transaction_id = $1", [transactionId]);
    expect(operations.rows[0].count).toBe(0);
    await expect(client.query(
      "UPDATE complaint_financial_handoffs SET seller_amount = seller_amount + 1 WHERE complaint_case_id = $1",
      [complaintCaseId]
    )).rejects.toThrow(/claim|immutable/i);
  });

  it("keeps no-agreement held and creates no financial operation", async () => {
    const noAgreementTransactionId = randomUUID();
    await client.query(
      `INSERT INTO transactions (id, creator_account_id, creator_role, state, state_version)
       VALUES ($1, $2, 'BUYER', 'READY_FOR_PAYOUT', 0)`,
      [noAgreementTransactionId, buyerId]
    );
    const intake = {
      summary: "Seller dan Buyer belum mencapai kesepakatan tertulis.",
      evidenceReference: "wa-no-agreement",
      evidenceHash: "4".repeat(64),
      sourceAuthorRole: "SELLER" as const,
      expectedStateVersion: 0
    };
    const complaint = await recordComplaint(
      { id: intakeAdminId, isAdmin: true }, noAgreementTransactionId, intake,
      { key: randomUUID(), requestHash: hashRequest(intake) }
    ) as any;
    const noAgreement = {
      summary: "Batas pembahasan selesai tanpa kesepakatan tertulis.",
      evidenceReference: "wa-no-agreement-final",
      evidenceHash: "5".repeat(64),
      expectedStateVersion: 1
    };
    const result = await recordNoAgreement(
      { id: intakeAdminId, isAdmin: true }, noAgreementTransactionId,
      complaint.complaintCaseId, noAgreement,
      { key: randomUUID(), requestHash: hashRequest(noAgreement) }
    ) as any;
    expect(result).toMatchObject({ state: "MANUAL_REVIEW_REQUIRED", lifecycle: "NO_AGREEMENT" });
    const operations = await client.query("SELECT count(*)::int AS count FROM financial_operations WHERE transaction_id = $1", [noAgreementTransactionId]);
    expect(operations.rows[0].count).toBe(0);
  });

  it("rejects an Admin without the required assignment and records post-processing complaints without reversal", async () => {
    const unassignedAdminId = randomUUID();
    const postProcessingTransactionId = randomUUID();
    await client.query(
      `INSERT INTO accounts (id, email, display_name, whatsapp_number, is_admin)
       VALUES ($1, $2, 'Unassigned Admin', $3, true)`,
      [unassignedAdminId, `complaint-unassigned-${unassignedAdminId}@example.test`, `+62816${unassignedAdminId.slice(0, 8)}`]
    );
    await client.query(
      `INSERT INTO transactions (id, creator_account_id, creator_role, state, state_version)
       VALUES ($1, $2, 'SELLER', 'PAYOUT_PROCESSING', 7)`,
      [postProcessingTransactionId, sellerId]
    );
    const input = {
      summary: "Complaint diterima setelah payout sudah mulai diproses.",
      evidenceReference: "wa-post-processing",
      evidenceHash: "6".repeat(64),
      sourceAuthorRole: "BUYER" as const,
      expectedStateVersion: 7
    };
    await expect(recordComplaint(
      { id: unassignedAdminId, isAdmin: true }, postProcessingTransactionId,
      input, { key: randomUUID(), requestHash: hashRequest(input) }
    )).rejects.toThrow("COMPLAINT_ASSIGNMENT_REQUIRED");

    const recorded = await recordComplaint(
      { id: intakeAdminId, isAdmin: true }, postProcessingTransactionId,
      input, { key: randomUUID(), requestHash: hashRequest(input) }
    ) as any;
    expect(recorded).toMatchObject({
      state: "PAYOUT_PROCESSING",
      stateVersion: 7,
      lifecycle: "POST_PROCESSING_RECORDED"
    });
    const transaction = await client.query("SELECT state, state_version FROM transactions WHERE id = $1", [postProcessingTransactionId]);
    expect(transaction.rows[0]).toMatchObject({ state: "PAYOUT_PROCESSING", state_version: 7 });
  });
});
