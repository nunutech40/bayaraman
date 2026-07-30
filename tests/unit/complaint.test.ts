import { describe, expect, it } from "vitest";
import {
  complaintAgreementSchema,
  complaintApprovalSchema,
  complaintCorrectionSchema,
  complaintIntakeSchema
} from "@/server/complaint/contracts";

describe("BAYAR-009 complaint contracts", () => {
  it("accepts a sanitized complaint intake and rejects raw/invalid evidence hashes", () => {
    expect(complaintIntakeSchema.parse({
      summary: "Buyer melaporkan barang tidak sesuai kesepakatan.",
      evidenceReference: "wa-message-123",
      evidenceHash: "a".repeat(64),
      sourceAuthorRole: "BUYER",
      expectedStateVersion: 3
    })).toMatchObject({ sourceAuthorRole: "BUYER", expectedStateVersion: 3 });

    expect(() => complaintIntakeSchema.parse({
      summary: "Terlalu pendek",
      evidenceReference: "x",
      evidenceHash: "plaintext evidence",
      sourceAuthorRole: "ADMIN",
      expectedStateVersion: -1
    })).toThrow();
  });

  it("requires complete split amounts and approved decision vocabulary", () => {
    expect(() => complaintAgreementSchema.parse({
      outcome: "SPLIT",
      evidenceEventId: crypto.randomUUID(),
      evidenceReference: "agreement-reference",
      evidenceHash: "b".repeat(64),
      buyerAmount: 5000,
      expectedStateVersion: 1
    })).toThrow();
    expect(complaintApprovalSchema.parse({ decision: "APPROVED", expectedStateVersion: 1 }))
      .toEqual({ decision: "APPROVED", expectedStateVersion: 1 });
  });

  it("requires an explicit immutable correction target and reason", () => {
    expect(complaintCorrectionSchema.parse({
      correctedEventId: crypto.randomUUID(),
      summary: "Koreksi referensi evidence dari laporan Buyer.",
      evidenceReference: "wa-message-corrected",
      evidenceHash: "c".repeat(64),
      correctionReason: "Referensi pesan sebelumnya keliru.",
      sourceAuthorRole: "BUYER",
      expectedStateVersion: 2
    }).correctionReason).toContain("keliru");
  });
});

