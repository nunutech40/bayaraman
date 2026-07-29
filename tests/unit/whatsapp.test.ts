import { describe, expect, it } from "vitest";
import { whatsappCheckpointInputSchema, whatsappGroupInputSchema } from "@/server/operations/contracts";

describe("BAYAR-006 WhatsApp checkpoint contracts", () => {
  const base = {
    checkpointType: "SELLER_COMPLETION" as const,
    sourceAuthorRole: "SELLER" as const,
    evidenceReference: "wa-evidence-1",
    messageReference: "wa-message-1",
    snapshotHash: "a".repeat(64),
    deliveryResult: "SENT" as const,
    expectedStateVersion: 3
  };

  it("accepts the four approved checkpoint types and delivery results", () => {
    expect(whatsappCheckpointInputSchema.parse(base).checkpointType).toBe("SELLER_COMPLETION");
    expect(whatsappCheckpointInputSchema.parse({ ...base, checkpointType: "PAYMENT_ANNOUNCED", sourceAuthorRole: "ADMIN", deliveryResult: "PENDING" }).deliveryResult).toBe("PENDING");
    expect(whatsappCheckpointInputSchema.parse({ ...base, checkpointType: "BUYER_COMPLETION", sourceAuthorRole: "BUYER", deliveryResult: "FAILED" }).deliveryResult).toBe("FAILED");
    expect(whatsappCheckpointInputSchema.parse({ ...base, checkpointType: "SELLER_SHIPMENT", sourceAuthorRole: "SELLER", deliveryResult: "UNKNOWN" }).deliveryResult).toBe("UNKNOWN");
  });

  it("requires a correction reason and bounded snapshot hash", () => {
    expect(() => whatsappCheckpointInputSchema.parse({ ...base, correctedCheckpointId: "00000000-0000-0000-0000-000000000000" })).toThrow();
    expect(() => whatsappCheckpointInputSchema.parse({ ...base, snapshotHash: "raw-whatsapp-message" })).toThrow();
    expect(whatsappCheckpointInputSchema.parse({ ...base, correctedCheckpointId: "00000000-0000-0000-0000-000000000000", correctionReason: "Corrected reference" }).correctionReason).toBe("Corrected reference");
  });

  it("requires four-digit participant confirmations for a group", () => {
    const parsed = whatsappGroupInputSchema.parse({
      groupReference: "group-123",
      buyerSnapshotConfirmation: { lastFour: "1010" },
      sellerSnapshotConfirmation: { lastFour: "2020" },
      evidenceReference: "admin-note-1",
      expectedStateVersion: 4
    });
    expect(parsed.buyerSnapshotConfirmation.lastFour).toBe("1010");
    expect(() => whatsappGroupInputSchema.parse({ ...parsed, sellerSnapshotConfirmation: { lastFour: "20" } })).toThrow();
  });
});
