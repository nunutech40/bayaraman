import { z } from "zod";

const configSchema = z.object({
  serverKey: z.string().min(1),
  apiBaseUrl: z.string().url(),
  environment: z.enum(["sandbox", "production"]),
  timeoutMs: z.coerce.number().int().min(500).max(30_000)
});

export type MidtransConfig = z.infer<typeof configSchema>;

export function getMidtransConfig(): MidtransConfig {
  const parsed = configSchema.safeParse({
    serverKey: process.env.MIDTRANS_SERVER_KEY ?? (process.env.NODE_ENV === "test" ? "test-server-key" : undefined),
    apiBaseUrl: process.env.MIDTRANS_API_BASE_URL ?? "https://api.sandbox.midtrans.com",
    environment: process.env.MIDTRANS_ENVIRONMENT ?? "sandbox",
    timeoutMs: process.env.MIDTRANS_REQUEST_TIMEOUT_MS ?? "10000"
  });

  if (!parsed.success) {
    throw new Error("MIDTRANS configuration is invalid or missing");
  }
  return parsed.data;
}

export function formatProviderDueDate(value: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).format(value).replace("T", " ");
}
