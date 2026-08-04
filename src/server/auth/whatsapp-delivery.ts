export const whatsappDeliveryResults = ["PENDING", "SENT", "FAILED", "UNKNOWN"] as const;
export type WhatsappDeliveryResult = (typeof whatsappDeliveryResults)[number];

export type WhatsappDeliveryRequest = {
  destination: string;
  code: string;
  challengeId: string;
};

export type WhatsappDeliveryAdapter = {
  send: (request: WhatsappDeliveryRequest) => Promise<WhatsappDeliveryResult>;
};

export function configuredWhatsappOtp(fallback: () => string): string {
  if (process.env.WHATSAPP_PROVIDER !== "fake") return fallback();
  const configured = process.env.WHATSAPP_FAKE_OTP;
  if (!configured || !/^\d{6}$/.test(configured)) {
    throw new Error("WHATSAPP_FAKE_OTP must be six digits when fake provider is enabled");
  }
  return configured;
}

export function createFakeWhatsappDeliveryAdapter(): WhatsappDeliveryAdapter {
  return { async send() { return "SENT"; } };
}

export function createConfiguredWhatsappDeliveryAdapter(): WhatsappDeliveryAdapter {
  return process.env.WHATSAPP_PROVIDER === "fake"
    ? createFakeWhatsappDeliveryAdapter()
    : createManualWhatsappDeliveryAdapter();
}

export function createManualWhatsappDeliveryAdapter(
  result: WhatsappDeliveryResult = "PENDING"
): WhatsappDeliveryAdapter {
  return {
    async send() {
      return result;
    }
  };
}
