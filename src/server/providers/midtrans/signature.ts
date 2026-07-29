import { createHash } from "node:crypto";
import { getMidtransConfig } from "./config";

export function midtransSignatureInput(input: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
}): string {
  return `${input.orderId}${input.statusCode}${input.grossAmount}`;
}

export function verifyMidtransSignature(input: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  signatureKey: string;
}): boolean {
  const config = getMidtransConfig();
  const expected = createHash("sha512")
    .update(`${midtransSignatureInput(input)}${config.serverKey}`)
    .digest("hex");
  return expected === input.signatureKey.toLowerCase();
}

export function payloadHash(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function deterministicProviderEventId(payload: {
  orderId: string;
  transactionStatus: string;
  statusCode: string;
  grossAmount: string;
  currency: string;
  fraudStatus: string;
  eventTime: string | null;
  settlementTime: string | null;
}): string {
  return `MIDTRANS-HASH:${createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}
