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

export function createManualWhatsappDeliveryAdapter(
  result: WhatsappDeliveryResult = "PENDING"
): WhatsappDeliveryAdapter {
  return {
    async send() {
      return result;
    }
  };
}
