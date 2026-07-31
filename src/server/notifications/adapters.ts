import type { NotificationDeliveryResult } from "./contracts";

export type NotificationDeliveryRequest = {
  notificationId: string;
  recipientAccountId: string | null;
  notificationType: string;
  payloadSnapshotHash: string;
  idempotencyKey: string;
};

export type NotificationDeliveryResponse = {
  result: Exclude<NotificationDeliveryResult, "PENDING">;
  providerReference?: string;
  errorCategory?: string;
};

export interface NotificationDeliveryAdapter {
  deliver(input: NotificationDeliveryRequest): Promise<NotificationDeliveryResponse>;
}

export class DisabledNotificationDeliveryAdapter implements NotificationDeliveryAdapter {
  async deliver(): Promise<NotificationDeliveryResponse> {
    return { result: "UNKNOWN", errorCategory: "PROVIDER_NOT_CONFIGURED" };
  }
}

export class FakeNotificationDeliveryAdapter implements NotificationDeliveryAdapter {
  constructor(private readonly response: NotificationDeliveryResponse = { result: "SENT" }) {}

  async deliver(): Promise<NotificationDeliveryResponse> {
    return this.response;
  }
}
