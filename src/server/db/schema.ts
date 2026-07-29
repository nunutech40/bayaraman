import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

export const productRole = pgEnum("product_role", ["BUYER", "SELLER", "ADMIN"]);
export const transactionState = pgEnum("transaction_state", [
  "WAITING_COUNTERPARTY",
  "WAITING_COUNTERPARTY_DATA",
  "WAITING_BUYER_PAYMENT",
  "PAYMENT_UNDER_REVIEW",
  "PAYMENT_CONFIRMED",
  "PAYMENT_EXCEPTION_REVIEW",
  "PAYMENT_EXPIRED",
  "READY_FOR_FULFILLMENT",
  "WAITING_COMPLETION_REPORTS",
  "WAITING_OTHER_COMPLETION_REPORT",
  "READY_FOR_BUYER_CONFIRMATION",
  "WAITING_BUYER_CONFIRMATION",
  "BUYER_CONFIRMATION_OVERDUE",
  "READY_FOR_PAYOUT",
  "PAYOUT_ON_HOLD",
  "PAYOUT_PROCESSING",
  "PAID_OUT",
  "CANCELLATION_REQUESTED",
  "CANCELLATION_PENDING_RECONCILIATION",
  "FUNDED_CANCELLATION_REVIEW",
  "REFUND_READY",
  "REFUND_PROCESSING",
  "REFUNDED",
  "SPLIT_PROCESSING",
  "SPLIT_SETTLED",
  "MANUAL_REVIEW_REQUIRED",
  "RISK_HOLD",
  "CANCELLED"
]);
export const operationResult = pgEnum("operation_result", [
  "PROCESSING",
  "SUCCESS",
  "FAILED",
  "UNKNOWN"
]);
export const operationType = pgEnum("operation_type", [
  "PAYOUT",
  "REFUND",
  "SPLIT_BUYER",
  "SPLIT_SELLER"
]);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash"),
    displayName: text("display_name").notNull(),
    whatsappNumber: text("whatsapp_number").notNull(),
    whatsappVerifiedAt: timestamp("whatsapp_verified_at", { withTimezone: true }),
    isAdmin: boolean("is_admin").notNull().default(false),
    adminTaskAssignment: text("admin_task_assignment"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("accounts_email_unique").on(table.email),
    uniqueIndex("accounts_whatsapp_unique").on(table.whatsappNumber)
  ]
);

export const accountWhatsappVerifications = pgTable(
  "account_whatsapp_verifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id").notNull().references(() => accounts.id),
    destinationSnapshot: text("destination_snapshot").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    deliveryResult: text("delivery_result").notNull().default("PENDING"),
    deliveryAttemptedAt: timestamp("delivery_attempted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("account_verification_account_idx").on(table.accountId),
    check(
      "account_whatsapp_verification_delivery_result_check",
      sql.raw("delivery_result IN ('PENDING', 'SENT', 'FAILED', 'UNKNOWN')")
    ),
    uniqueIndex("account_whatsapp_verifications_one_active_idx")
      .on(table.accountId)
      .where(sql`${table.verifiedAt} IS NULL AND ${table.supersededAt} IS NULL`)
  ]
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    creatorAccountId: uuid("creator_account_id").notNull().references(() => accounts.id),
    creatorRole: productRole("creator_role").notNull(),
    state: transactionState("state").notNull(),
    stateVersion: integer("state_version").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("transactions_state_idx").on(table.state),
    index("transactions_creator_idx").on(table.creatorAccountId),
    check("transactions_state_version_nonnegative", sql.raw("state_version >= 0")),
    check("transactions_creator_role_participant", sql.raw("creator_role IN ('BUYER', 'SELLER')"))
  ]
);

export const transactionParticipants = pgTable(
  "transaction_participants",
  {
    transactionId: uuid("transaction_id").notNull().references(() => transactions.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").notNull().references(() => accounts.id),
    role: productRole("role").notNull(),
    nameSnapshot: text("name_snapshot").notNull(),
    whatsappSnapshot: text("whatsapp_snapshot").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.transactionId, table.accountId] }),
    uniqueIndex("transaction_participant_role_unique").on(table.transactionId, table.role),
    index("transaction_participant_account_idx").on(table.accountId),
    check("transaction_participants_role_participant", sql.raw("role IN ('BUYER', 'SELLER')"))
  ]
);

export const transactionItems = pgTable("transaction_items", {
  transactionId: uuid("transaction_id")
    .primaryKey()
    .references(() => transactions.id, { onDelete: "cascade" }),
  itemName: text("item_name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  condition: text("condition").notNull(),
  quantity: integer("quantity").notNull(),
  photoReference: text("photo_reference"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lockedAt: timestamp("locked_at", { withTimezone: true })
});

export const buyerShippingAddresses = pgTable(
  "buyer_shipping_addresses",
  {
    transactionId: uuid("transaction_id").notNull().references(() => transactions.id, { onDelete: "cascade" }),
    participantAccountId: uuid("participant_account_id").notNull().references(() => accounts.id),
    recipientName: text("recipient_name").notNull(),
    phoneSnapshot: text("phone_snapshot").notNull(),
    addressLine: text("address_line").notNull(),
    district: text("district").notNull(),
    city: text("city").notNull(),
    province: text("province").notNull(),
    postalCode: text("postal_code").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({ columns: [table.transactionId, table.participantAccountId] }),
    foreignKey({
      columns: [table.transactionId, table.participantAccountId],
      foreignColumns: [transactionParticipants.transactionId, transactionParticipants.accountId]
    }),
    index("buyer_shipping_address_account_idx").on(table.participantAccountId)
  ]
);

export const sellerPayoutDestinations = pgTable(
  "seller_payout_destinations",
  {
    transactionId: uuid("transaction_id").notNull().references(() => transactions.id, { onDelete: "cascade" }),
    participantAccountId: uuid("participant_account_id").notNull().references(() => accounts.id),
    bankName: text("bank_name").notNull(),
    accountHolderName: text("account_holder_name").notNull(),
    rawAccountValue: text("raw_account_value").notNull(),
    maskedAccountValue: text("masked_account_value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({ columns: [table.transactionId, table.participantAccountId] }),
    foreignKey({
      columns: [table.transactionId, table.participantAccountId],
      foreignColumns: [transactionParticipants.transactionId, transactionParticipants.accountId]
    }),
    index("seller_payout_destination_account_idx").on(table.participantAccountId)
  ]
);

export const buyerRefundDestinations = pgTable(
  "buyer_refund_destinations",
  {
    transactionId: uuid("transaction_id").notNull().references(() => transactions.id, { onDelete: "cascade" }),
    participantAccountId: uuid("participant_account_id").notNull().references(() => accounts.id),
    bankName: text("bank_name").notNull(),
    accountHolderName: text("account_holder_name").notNull(),
    rawAccountValue: text("raw_account_value").notNull(),
    maskedAccountValue: text("masked_account_value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({ columns: [table.transactionId, table.participantAccountId] }),
    foreignKey({
      columns: [table.transactionId, table.participantAccountId],
      foreignColumns: [transactionParticipants.transactionId, transactionParticipants.accountId]
    }),
    index("buyer_refund_destination_account_idx").on(table.participantAccountId)
  ]
);

export const transactionTerms = pgTable("transaction_terms", {
  transactionId: uuid("transaction_id").primaryKey().references(() => transactions.id, { onDelete: "cascade" }),
  itemDescription: text("item_description").notNull(),
  itemPrice: integer("item_price").notNull(),
  shippingCost: integer("shipping_cost").notNull().default(0),
  serviceFee: integer("service_fee").notNull().default(0),
  totalAmount: integer("total_amount").notNull(),
  frozenAt: timestamp("frozen_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transactionId: uuid("transaction_id").notNull().references(() => transactions.id, { onDelete: "cascade" }),
    targetRole: productRole("target_role").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("invitations_token_hash_unique").on(table.tokenHash),
    index("invitations_transaction_idx").on(table.transactionId),
    uniqueIndex("invitations_one_active_target_idx")
      .on(table.transactionId, table.targetRole)
      .where(sql`${table.revokedAt} IS NULL AND ${table.usedAt} IS NULL`)
  ]
);

// @deprecated Legacy manual-payment compatibility only. New foundation modules
// must use paymentInvoices, paymentProviderEvents, and paymentReconciliations.
export const paymentInstructions = pgTable("payment_instructions", {
  transactionId: uuid("transaction_id").primaryKey().references(() => transactions.id, { onDelete: "cascade" }),
  destinationBank: text("destination_bank").notNull(),
  destinationAccountValue: text("destination_account_value").notNull(),
  destinationAccountMask: text("destination_account_mask").notNull(),
  amount: integer("amount").notNull(),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
  deadlineAt: timestamp("deadline_at", { withTimezone: true }).notNull()
});

// @deprecated Legacy manual-payment compatibility only.
export const paymentClaims = pgTable(
  "payment_claims",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transactionId: uuid("transaction_id").notNull().references(() => transactions.id, { onDelete: "cascade" }),
    submittedByAccountId: uuid("submitted_by_account_id").notNull().references(() => accounts.id),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    active: boolean("active").notNull().default(true),
    metadata: jsonb("metadata")
  },
  (table) => [
    index("payment_claims_transaction_idx").on(table.transactionId),
    uniqueIndex("payment_claims_one_active_idx")
      .on(table.transactionId)
      .where(sql`${table.active} = true`)
  ]
);

// @deprecated Legacy manual-payment compatibility only.
export const paymentReviews = pgTable("payment_reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  transactionId: uuid("transaction_id").notNull().references(() => transactions.id, { onDelete: "cascade" }),
  claimId: uuid("claim_id").references(() => paymentClaims.id),
  result: text("result").notNull(),
  observedAmount: integer("observed_amount"),
  bankReference: text("bank_reference"),
  evidenceReference: text("evidence_reference"),
  reviewedByAccountId: uuid("reviewed_by_account_id").notNull().references(() => accounts.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow()
});

export const paymentInvoices = pgTable(
  "payment_invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transactionId: uuid("transaction_id").notNull().references(() => transactions.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerInvoiceId: text("provider_invoice_id"),
    providerOrderId: text("provider_order_id").notNull(),
    hostedPaymentUrl: text("hosted_payment_url"),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("IDR"),
    providerStatus: text("provider_status"),
    authoritativeProviderEventId: uuid("authoritative_provider_event_id"),
    idempotencyReference: text("idempotency_reference").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }).notNull(),
    dueDateAt: timestamp("due_date_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(false),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("payment_invoices_provider_order_unique").on(table.provider, table.providerOrderId),
    uniqueIndex("payment_invoices_provider_invoice_unique")
      .on(table.provider, table.providerInvoiceId)
      .where(sql`${table.providerInvoiceId} IS NOT NULL`),
    uniqueIndex("payment_invoices_idempotency_reference_unique").on(table.idempotencyReference),
    uniqueIndex("payment_invoices_one_active_idx")
      .on(table.transactionId)
      .where(sql`${table.isActive} = true`),
    index("payment_invoices_transaction_idx").on(table.transactionId)
  ]
);

export const paymentProviderEvents = pgTable(
  "payment_provider_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceId: uuid("invoice_id").references(() => paymentInvoices.id, { onDelete: "restrict" }),
    provider: text("provider").notNull(),
    providerEventId: text("provider_event_id").notNull(),
    payloadHash: text("payload_hash").notNull(),
    eventOccurredAt: timestamp("event_occurred_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    providerOrderId: text("provider_order_id").notNull(),
    amount: integer("amount"),
    currency: text("currency"),
    providerStatus: text("provider_status"),
    fraudStatus: text("fraud_status"),
    signatureValid: boolean("signature_valid"),
    validationOutcome: text("validation_outcome").notNull().default("LEGACY_UNASSESSED"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("payment_provider_events_provider_event_unique").on(table.provider, table.providerEventId),
    index("payment_provider_events_order_idx").on(table.provider, table.providerOrderId),
    index("payment_provider_events_invoice_idx").on(table.invoiceId),
    check(
      "payment_provider_events_validation_outcome_check",
      sql.raw("validation_outcome IN ('LEGACY_UNASSESSED', 'ACCEPTED', 'NON_AUTHORITATIVE', 'INVALID_SIGNATURE', 'UNKNOWN_ORDER', 'IDENTITY_MISMATCH', 'AMOUNT_MISMATCH', 'CURRENCY_MISMATCH', 'FRAUD_MISMATCH', 'CONFLICT', 'UNKNOWN')")
    )
  ]
);

export const paymentReconciliations = pgTable(
  "payment_reconciliations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transactionId: uuid("transaction_id").notNull().references(() => transactions.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").references(() => paymentInvoices.id, { onDelete: "set null" }),
    decision: text("decision").notNull(),
    decisionCode: text("decision_code"),
    providerStatusReference: text("provider_status_reference"),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }).notNull(),
    result: text("result").notNull(),
    evidenceReference: text("evidence_reference"),
    reconciledByAccountId: uuid("reconciled_by_account_id").references(() => accounts.id),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("payment_reconciliations_transaction_idx").on(table.transactionId),
    index("payment_reconciliations_invoice_idx").on(table.invoiceId),
    check(
      "payment_reconciliations_decision_code_check",
      sql.raw("decision_code IS NULL OR decision_code IN ('PROVIDER_STATUS_REVIEW', 'LATE_FUND_HANDOFF', 'CONTROLLED_EXCEPTION_HANDOFF')")
    )
  ]
);

export const paymentReconciliationEvents = pgTable(
  "payment_reconciliation_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reconciliationId: uuid("reconciliation_id").notNull().references(() => paymentReconciliations.id, { onDelete: "restrict" }),
    providerEventId: uuid("provider_event_id").notNull().references(() => paymentProviderEvents.id, { onDelete: "restrict" }),
    relationType: text("relation_type").notNull(),
    incomingPayloadHash: text("incoming_payload_hash").notNull(),
    sanitizedReason: text("sanitized_reason").notNull(),
    correlationId: uuid("correlation_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("payment_reconciliation_events_identity_unique").on(
      table.reconciliationId,
      table.providerEventId,
      table.relationType,
      table.incomingPayloadHash
    ),
    check(
      "payment_reconciliation_events_relation_type_check",
      sql.raw("relation_type IN ('PRIMARY_EVENT', 'CONFLICT_EVENT', 'OUT_OF_ORDER_EVENT', 'UNKNOWN_EVENT', 'LATE_EVENT')")
    ),
    index("payment_reconciliation_events_reconciliation_idx").on(table.reconciliationId),
    index("payment_reconciliation_events_provider_event_idx").on(table.providerEventId)
  ]
);

export const whatsappGroups = pgTable("whatsapp_groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  transactionId: uuid("transaction_id").notNull().references(() => transactions.id, { onDelete: "cascade" }),
  groupReference: text("group_reference").notNull(),
  createdByAccountId: uuid("created_by_account_id").notNull().references(() => accounts.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const whatsappCheckpoints = pgTable("whatsapp_checkpoints", {
  id: uuid("id").defaultRandom().primaryKey(),
  transactionId: uuid("transaction_id").notNull().references(() => transactions.id, { onDelete: "cascade" }),
  groupId: uuid("group_id").notNull().references(() => whatsappGroups.id),
  checkpointType: text("checkpoint_type").notNull(),
  authorAccountId: uuid("author_account_id").references(() => accounts.id),
  messageReference: text("message_reference"),
  evidenceReference: text("evidence_reference"),
  snapshotHash: text("snapshot_hash").notNull(),
  recordedByAccountId: uuid("recorded_by_account_id").notNull().references(() => accounts.id),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow()
});

export const confirmationLinks = pgTable(
  "confirmation_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transactionId: uuid("transaction_id").notNull().references(() => transactions.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    buyerWhatsappSnapshot: text("buyer_whatsapp_snapshot").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex("confirmation_links_token_hash_unique").on(table.tokenHash)]
);

export const confirmationOtps = pgTable("confirmation_otps", {
  id: uuid("id").defaultRandom().primaryKey(),
  confirmationLinkId: uuid("confirmation_link_id").notNull().references(() => confirmationLinks.id, { onDelete: "cascade" }),
  codeHash: text("code_hash").notNull(),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const cancellationRequests = pgTable(
  "cancellation_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transactionId: uuid("transaction_id").notNull().references(() => transactions.id, { onDelete: "cascade" }),
    requestedByAccountId: uuid("requested_by_account_id").notNull().references(() => accounts.id),
    cause: text("cause").notNull(),
    note: text("note"),
    status: text("status").notNull().default("ACTIVE"),
    stateVersion: integer("state_version").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("other_manual_review_requires_note", sql.raw("cause <> 'OTHER_MANUAL_REVIEW' OR note IS NOT NULL")),
    uniqueIndex("cancellation_requests_one_active_idx")
      .on(table.transactionId)
      .where(sql`${table.status} = 'ACTIVE'`)
  ]
);

export const cancellationReconciliations = pgTable(
  "cancellation_reconciliations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cancellationRequestId: uuid("cancellation_request_id").notNull().references(() => cancellationRequests.id, { onDelete: "cascade" }),
    bankResult: text("bank_result"),
    evidenceReference: text("evidence_reference"),
    reconciledByAccountId: uuid("reconciled_by_account_id").references(() => accounts.id),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true })
  },
  (table) => [uniqueIndex("cancellation_reconciliation_request_unique").on(table.cancellationRequestId)]
);

export const complaintHolds = pgTable("complaint_holds", {
  id: uuid("id").defaultRandom().primaryKey(),
  transactionId: uuid("transaction_id").notNull().references(() => transactions.id, { onDelete: "cascade" }),
  summary: text("summary").notNull(),
  evidenceReference: text("evidence_reference"),
  outcome: text("outcome"),
  createdByAccountId: uuid("created_by_account_id").notNull().references(() => accounts.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const riskHolds = pgTable("risk_holds", {
  id: uuid("id").defaultRandom().primaryKey(),
  transactionId: uuid("transaction_id").notNull().references(() => transactions.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  evidenceReference: text("evidence_reference"),
  outcome: text("outcome"),
  createdByAccountId: uuid("created_by_account_id").notNull().references(() => accounts.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const financialOperations = pgTable(
  "financial_operations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transactionId: uuid("transaction_id").notNull().references(() => transactions.id, { onDelete: "cascade" }),
    type: operationType("type").notNull(),
    result: operationResult("result").notNull().default("PROCESSING"),
    amount: integer("amount").notNull(),
    destinationSnapshot: text("destination_snapshot").notNull(),
    bankReference: text("bank_reference"),
    attempt: integer("attempt").notNull().default(1),
    startedByAccountId: uuid("started_by_account_id").notNull().references(() => accounts.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true })
  },
  (table) => [
    index("financial_operations_transaction_idx").on(table.transactionId),
    uniqueIndex("financial_operations_active_unique")
      .on(table.transactionId, table.type)
      .where(sql.raw("result IN ('PROCESSING', 'UNKNOWN')"))
  ]
);

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorAccountId: uuid("actor_account_id").references(() => accounts.id),
    actorScope: text("actor_scope").notNull(),
    command: text("command").notNull(),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    result: jsonb("result"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("idempotency_actor_scope_command_key_unique").on(
      table.actorScope,
      table.command,
      table.key
    )
  ]
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transactionId: uuid("transaction_id").references(() => transactions.id),
    actorAccountId: uuid("actor_account_id").references(() => accounts.id),
    eventType: text("event_type").notNull(),
    beforeState: transactionState("before_state"),
    afterState: transactionState("after_state"),
    stateVersion: integer("state_version"),
    correlationId: uuid("correlation_id").notNull(),
    evidenceReference: text("evidence_reference"),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("audit_events_transaction_idx").on(table.transactionId),
    index("audit_events_correlation_idx").on(table.correlationId)
  ]
);

export const accountsRelations = relations(accounts, ({ many }) => ({
  verifications: many(accountWhatsappVerifications),
  transactions: many(transactions),
  participants: many(transactionParticipants)
}));

export const transactionsRelations = relations(transactions, ({ many, one }) => ({
  creator: one(accounts, {
    fields: [transactions.creatorAccountId],
    references: [accounts.id]
  }),
  participants: many(transactionParticipants),
  terms: one(transactionTerms),
  invitations: many(invitations),
  claims: many(paymentClaims),
  reviews: many(paymentReviews),
  groups: many(whatsappGroups),
  cancellations: many(cancellationRequests),
  financialOperations: many(financialOperations),
  auditEvents: many(auditEvents)
}));

export const transactionParticipantsRelations = relations(
  transactionParticipants,
  ({ one }) => ({
    transaction: one(transactions, {
      fields: [transactionParticipants.transactionId],
      references: [transactions.id]
    }),
    account: one(accounts, {
      fields: [transactionParticipants.accountId],
      references: [accounts.id]
    })
  })
);
