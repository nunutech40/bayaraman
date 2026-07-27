import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { buyerRefundDestinations, buyerShippingAddresses, sellerPayoutDestinations, transactionItems, transactionParticipants, transactionTerms, transactions } from "@/server/db/schema";

function maskWhatsapp(value: string): string {
  return value.length > 4 ? `••••${value.slice(-4)}` : "••••";
}

export async function readTransaction(transactionId: string, actorAccountId: string) {
  const [transaction] = await db.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
  if (!transaction) throw new Error("TRANSACTION_NOT_FOUND");
  const participants = await db.select().from(transactionParticipants).where(eq(transactionParticipants.transactionId, transactionId));
  const actorParticipant = participants.find((participant) => participant.accountId === actorAccountId);
  if (!actorParticipant) throw new Error("TRANSACTION_FORBIDDEN");
  const [terms] = await db.select().from(transactionTerms).where(eq(transactionTerms.transactionId, transactionId)).limit(1);
  const [item] = await db.select().from(transactionItems).where(eq(transactionItems.transactionId, transactionId)).limit(1);
  const [shipping] = await db.select().from(buyerShippingAddresses).where(eq(buyerShippingAddresses.transactionId, transactionId)).limit(1);
  const [refund] = await db.select().from(buyerRefundDestinations).where(eq(buyerRefundDestinations.transactionId, transactionId)).limit(1);
  const [payout] = await db.select().from(sellerPayoutDestinations).where(eq(sellerPayoutDestinations.transactionId, transactionId)).limit(1);
  const readyForPaymentInstructions = Boolean(shipping && refund && payout && participants.length === 2);

  return {
    transactionId,
    state: transaction.state,
    stateVersion: transaction.stateVersion,
    creatorRole: transaction.creatorRole,
    currentRole: actorParticipant.role,
    readyForPaymentInstructions,
    item: item ? { itemName: item.itemName, description: item.description, category: item.category, condition: item.condition, quantity: item.quantity, photoReference: item.photoReference } : null,
    terms: terms ? { itemPrice: terms.itemPrice, shippingCost: terms.shippingCost, serviceFee: terms.serviceFee, totalAmount: terms.totalAmount } : null,
    participants: participants.map((participant) => ({
      role: participant.role,
      name: participant.nameSnapshot,
      whatsapp: participant.accountId === actorAccountId ? participant.whatsappSnapshot : maskWhatsapp(participant.whatsappSnapshot),
      joined: participant.joinedAt !== null
    })),
    shippingAddress: shipping ? {
      recipientName: shipping.recipientName,
      phoneSnapshot: shipping.participantAccountId === actorAccountId ? shipping.phoneSnapshot : maskWhatsapp(shipping.phoneSnapshot),
      addressLine: shipping.participantAccountId === actorAccountId || actorParticipant.role === "SELLER" ? shipping.addressLine : undefined,
      district: shipping.district,
      city: shipping.city,
      province: shipping.province,
      postalCode: shipping.postalCode
    } : null,
    refundDestination: refund ? { bankName: refund.bankName, accountHolderName: refund.accountHolderName, accountNumber: refund.maskedAccountValue } : null,
    payoutDestination: payout ? { bankName: payout.bankName, accountHolderName: payout.accountHolderName, accountNumber: payout.maskedAccountValue } : null
  };
}
