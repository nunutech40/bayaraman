import { describe, expect, it } from "vitest";
import {
  canonicalJobSignatureInput,
  signJobInvocation,
  verifyJobInvocation
} from "@/server/jobs/auth";
import { jobInvocationSchema, jobNameSchema } from "@/server/jobs/contracts";
import { notificationOccurrenceSchema } from "@/server/notifications/contracts";
import { addOperatingMinutesWib } from "@/server/domain/time/operating-hours";
import { formatWib, isWithinAdminOperatingHoursWib } from "@/server/domain/time/wib";

describe("BAYAR-012 scheduler contracts", () => {
  it("accepts only approved job names and strict invocation payloads", () => {
    expect(jobNameSchema.parse("payment-expiry")).toBe("payment-expiry");
    expect(() => jobNameSchema.parse("payout")).toThrow();
    expect(() => jobInvocationSchema.parse({
      scheduledFor: "2026-07-31T10:00:00.000Z",
      parameters: { unsafe: true }
    })).toThrow();
  });

  it("validates occurrence identity", () => {
    expect(notificationOccurrenceSchema.parse("ONCE")).toBe("ONCE");
    expect(notificationOccurrenceSchema.parse("ESCALATION:2")).toBe("ESCALATION:2");
    expect(() => notificationOccurrenceSchema.parse("ESCALATION:0")).toThrow();
  });

  it("signs exact request input and rejects stale or changed requests", () => {
    const prior = process.env.JOB_SCHEDULER_SECRET;
    process.env.JOB_SCHEDULER_SECRET = "test-scheduler-secret-with-at-least-32-bytes";
    try {
      const timestamp = "2026-07-31T10:00:00.000Z";
      const body = JSON.stringify({ scheduledFor: timestamp, parameters: {} });
      const signature = signJobInvocation({
        method: "POST",
        path: "/api/jobs/payment-expiry",
        timestamp,
        idempotencyKey: "payment-expiry:2026-07-31T10",
        body
      });
      expect(verifyJobInvocation({
        method: "POST",
        path: "/api/jobs/payment-expiry",
        timestamp,
        idempotencyKey: "payment-expiry:2026-07-31T10",
        signature,
        body,
        now: new Date(timestamp)
      }).idempotencyKey).toContain("payment-expiry");
      expect(() => verifyJobInvocation({
        method: "POST",
        path: "/api/jobs/payment-expiry",
        timestamp,
        idempotencyKey: "payment-expiry:2026-07-31T10",
        signature,
        body: `${body} `,
        now: new Date(timestamp)
      })).toThrow("JOB_SIGNATURE_INVALID");
      expect(() => verifyJobInvocation({
        method: "POST",
        path: "/api/jobs/payment-expiry",
        timestamp,
        idempotencyKey: "payment-expiry:2026-07-31T10",
        signature,
        body,
        now: new Date("2026-07-31T10:06:00.001Z")
      })).toThrow("JOB_TIMESTAMP_STALE");
      expect(canonicalJobSignatureInput({
        method: "POST",
        path: "/api/jobs/payment-expiry",
        timestamp,
        idempotencyKey: "payment-expiry:2026-07-31T10",
        body
      })).not.toContain(body);
    } finally {
      if (prior === undefined) delete process.env.JOB_SCHEDULER_SECRET;
      else process.env.JOB_SCHEDULER_SECRET = prior;
    }
  });
});

describe("BAYAR-012 WIB time", () => {
  it("pauses operating minutes outside 09:00-21:00 WIB", () => {
    const start = new Date("2026-07-31T13:30:00.000Z"); // 20:30 WIB
    expect(addOperatingMinutesWib(start, 120).toISOString())
      .toBe("2026-08-01T03:30:00.000Z"); // 10:30 WIB
  });

  it("formats and checks Admin operating hours in WIB", () => {
    expect(isWithinAdminOperatingHoursWib(new Date("2026-07-31T02:00:00.000Z"))).toBe(true);
    expect(isWithinAdminOperatingHoursWib(new Date("2026-07-31T14:00:00.000Z"))).toBe(false);
    expect(formatWib(new Date("2026-07-31T03:00:00.000Z"))).toContain("10.00");
  });
});
