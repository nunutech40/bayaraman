import { db } from "@/server/db";
import {
  claimNextWhatsappNotification,
  createNotificationIntent,
  finalizeWhatsappNotification
} from "./repository";
import {
  DisabledNotificationDeliveryAdapter,
  type NotificationDeliveryAdapter,
  type NotificationDeliveryResponse
} from "./adapters";
import type { NotificationIntentInput } from "./contracts";

export async function enqueueNotification(
  input: NotificationIntentInput,
  now = new Date()
) {
  return db.transaction((tx) => createNotificationIntent(tx, input, now));
}

export async function deliverNextNotification(
  adapter: NotificationDeliveryAdapter = new DisabledNotificationDeliveryAdapter(),
  now = new Date()
) {
  const claim = await claimNextWhatsappNotification(now);
  if (!claim) return { kind: "EMPTY" as const };
  const response: NotificationDeliveryResponse = await adapter.deliver({
    notificationId: claim.notification.id,
    recipientAccountId: claim.notification.recipientAccountId,
    notificationType: claim.notification.notificationType,
    payloadSnapshotHash: claim.notification.payloadSnapshotHash,
    idempotencyKey: `${claim.notification.id}:${claim.attemptNumber}`
  }).catch(() => ({
    result: "UNKNOWN" as const,
    errorCategory: "ADAPTER_FAILURE",
    providerReference: undefined
  }));
  return finalizeWhatsappNotification({
    notificationId: claim.notification.id,
    version: claim.version,
    attemptNumber: claim.attemptNumber,
    leaseToken: claim.leaseToken,
    result: response.result,
    providerReference: response.providerReference,
    errorCategory: response.errorCategory,
    now
  });
}
