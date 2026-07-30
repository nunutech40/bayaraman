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
}, (table) => [
  uniqueIndex("whatsapp_groups_one_canonical_per_transaction_idx").on(table.transactionId)
]);

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
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  idempotencyKey: text("idempotency_key").notNull(),
  deliveryResult: text("delivery_result").notNull().default("PENDING"),
  correctedCheckpointId: uuid("corrected_checkpoint_id"),
  correctionReason: text("correction_reason")
}, (table) => [
  uniqueIndex("whatsapp_checkpoints_transaction_idempotency_unique").on(table.transactionId, table.idempotencyKey),
  foreignKey({
    columns: [table.correctedCheckpointId],
    foreignColumns: [table.id]
  }),
  check("whatsapp_checkpoints_type_check", sql.raw("checkpoint_type IN ('PAYMENT_ANNOUNCED', 'SELLER_SHIPMENT', 'SELLER_COMPLETION', 'BUYER_COMPLETION')")),
  check("whatsapp_checkpoints_delivery_result_check", sql.raw("delivery_result IN ('PENDING', 'SENT', 'FAILED', 'UNKNOWN')")),
  check("whatsapp_checkpoints_correction_reason_check", sql.raw("corrected_checkpoint_id IS NULL OR correction_reason IS NOT NULL"))
]);

export const whatsappCheckpointHeads = pgTable("whatsapp_checkpoint_heads", {
  id: uuid("id").defaultRandom().primaryKey(),
  transactionId: uuid("transaction_id").notNull().references(() => transactions.id, { onDelete: "cascade" }),
  checkpointType: text("checkpoint_type").notNull(),
  currentCheckpointId: uuid("current_checkpoint_id").notNull().references(() => whatsappCheckpoints.id, { onDelete: "restrict" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("whatsapp_checkpoint_heads_transaction_type_unique").on(table.transactionId, table.checkpointType),
  uniqueIndex("whatsapp_checkpoint_heads_current_event_unique").on(table.currentCheckpointId)
]);

export const confirmationLinks = pgTable(
  "confirmation_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transactionId: uuid("transaction_id").notNull().references(() => transactions.id, { onDelete: "cascade" }),
    buyerAccountId: uuid("buyer_account_id").notNull().references(() => accounts.id),
    tokenHash: text("token_hash").notNull(),
    buyerWhatsappSnapshot: text("buyer_whatsapp_snapshot").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    reminderDueAt: timestamp("reminder_due_at", { withTimezone: true }).notNull(),
    reminderRecordedAt: timestamp("reminder_recorded_at", { withTimezone: true }),
    reminderRecordedByAccountId: uuid("reminder_recorded_by_account_id").references(() => accounts.id),
    reminderEvidenceReference: text("reminder_evidence_reference"),
    overdueAt: timestamp("overdue_at", { withTimezone: true }),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("confirmation_links_token_hash_unique").on(table.tokenHash),
    uniqueIndex("confirmation_links_one_transaction_unique").on(table.transactionId),
    uniqueIndex("confirmation_links_idempotency_unique").on(table.transactionId, table.idempotencyKey),
    foreignKey({
      name: "confirmation_links_buyer_participant_fk",
      columns: [table.transactionId, table.buyerAccountId],
      foreignColumns: [transactionParticipants.transactionId, transactionParticipants.accountId]
    })
  ]
);

export const confirmationOtps = pgTable("confirmation_otps", {
  id: uuid("id").defaultRandom().primaryKey(),
  confirmationLinkId: uuid("confirmation_link_id").notNull().references(() => confirmationLinks.id, { onDelete: "cascade" }),
  codeHash: text("code_hash").notNull(),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  lastRequestedAt: timestamp("last_requested_at", { withTimezone: true }),
  sendWindowStartedAt: timestamp("send_window_started_at", { withTimezone: true }),
  sendCount: integer("send_count").notNull().default(0),
  cooldownUntil: timestamp("cooldown_until", { withTimezone: true }),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  supersededAt: timestamp("superseded_at", { withTimezone: true }),
  deliveryResult: text("delivery_result").notNull().default("PENDING"),
  idempotencyKey: text("idempotency_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  check("confirmation_otps_attempts_check", sql.raw("attempts >= 0 AND attempts <= 5")),
  check("confirmation_otps_send_count_check", sql.raw("send_count >= 0 AND send_count <= 3")),
  check("confirmation_otps_delivery_result_check", sql.raw("delivery_result IN ('PENDING', 'SENT', 'FAILED', 'UNKNOWN')")),
  uniqueIndex("confirmation_otps_one_active_link_unique")
    .on(table.confirmationLinkId)
    .where(sql`${table.supersededAt} IS NULL AND ${table.verifiedAt} IS NULL`),
  uniqueIndex("confirmation_otps_idempotency_unique").on(table.confirmationLinkId, table.idempotencyKey)
]);

export const confirmationExceptions = pgTable("confirmation_exceptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  transactionId: uuid("transaction_id").notNull().references(() => transactions.id, { onDelete: "cascade" }),
  buyerCompletionCheckpointId: uuid("buyer_completion_checkpoint_id").notNull().references(() => whatsappCheckpoints.id, { onDelete: "restrict" }),
  reason: text("reason").notNull(),
  evidenceReference: text("evidence_reference").notNull(),
  firstApprovedByAdminId: uuid("first_approved_by_admin_id").notNull().references(() => accounts.id),
  firstApprovedAt: timestamp("first_approved_at", { withTimezone: true }).notNull().defaultNow(),
  secondApprovedByAdminId: uuid("second_approved_by_admin_id").references(() => accounts.id),
  secondApprovedAt: timestamp("second_approved_at", { withTimezone: true }),
  decision: text("decision").notNull().default("PENDING_APPROVAL"),
  idempotencyKey: text("idempotency_key").notNull(),
  expectedStateVersion: integer("expected_state_version").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  check("confirmation_exceptions_decision_check", sql.raw("decision IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED')")),
  check("confirmation_exceptions_distinct_admin_check", sql.raw("second_approved_by_admin_id IS NULL OR second_approved_by_admin_id <> first_approved_by_admin_id")),
  uniqueIndex("confirmation_exceptions_idempotency_unique").on(table.transactionId, table.idempotencyKey),
  uniqueIndex("confirmation_exceptions_one_pending_transaction_unique")
    .on(table.transactionId)
    .where(sql`${table.decision} = 'PENDING_APPROVAL'`),
  index("confirmation_exceptions_transaction_idx").on(table.transactionId)
]);

export const cancellationRequests = pgTable(
  "cancellation_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transactionId: uuid("transaction_id").notNull().references(() => transactions.id, { onDelete: "cascade" }),
    requestedByAccountId: uuid("requested_by_account_id").notNull().references(() => accounts.id),
    cause: text("cause").notNull(),
    note: text("note"),
    status: text("status").notNull().default("ACTIVE"),
    lifecycle: text("lifecycle").notNull().default("ACTIVE"),
    decision: text("decision"),
    delegationType: text("delegation_type").notNull().default("NONE"),
    delegationStatus: text("delegation_status").notNull().default("NOT_REQUIRED"),
    priorState: transactionState("prior_state").notNull(),
    paymentReconciliationId: uuid("payment_reconciliation_id").references(() => paymentReconciliations.id, { onDelete: "restrict" }),
    complaintCaseId: uuid("complaint_case_id"),
    riskCaseId: uuid("risk_case_id"),
    responseDeadlineAt: timestamp("response_deadline_at", { withTimezone: true }),
    manualReviewReason: text("manual_review_reason"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    stateVersion: integer("state_version").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("cancellation_requests_cause_check", sql.raw("cause IN ('BUYER_CHANGE_OF_MIND', 'SELLER_UNABLE_TO_FULFILL', 'MUTUAL_NEUTRAL', 'BAYARAMAN_ERROR', 'PROHIBITED_OR_POLICY', 'SUSPECTED_FRAUD', 'OTHER_MANUAL_REVIEW')")),
    check("other_manual_review_requires_note", sql.raw("cause <> 'OTHER_MANUAL_REVIEW' OR NULLIF(BTRIM(note), '') IS NOT NULL")),
    check("cancellation_requests_status_check", sql.raw("status IN ('ACTIVE', 'CLOSED')")),
    check("cancellation_requests_lifecycle_check", sql.raw("lifecycle IN ('ACTIVE', 'WITHDRAWN', 'REJECTED', 'RESOLVED', 'REFERRED_TO_COMPLAINT', 'REFERRED_TO_RISK')")),
    check("cancellation_requests_decision_check", sql.raw("decision IS NULL OR decision IN ('DIRECT_CANCELLED', 'DEFINITIVE_NON_PAID', 'FUNDED_REVIEW', 'REFUND_APPROVED', 'LATE_FUND_REFUND', 'COMPLAINT_HANDOFF', 'RISK_HANDOFF', 'MANUAL_REVIEW')")),
    check("cancellation_requests_delegation_type_check", sql.raw("delegation_type IN ('NONE', 'COMPLAINT', 'RISK')")),
    check("cancellation_requests_delegation_status_check", sql.raw("delegation_status IN ('NOT_REQUIRED', 'REQUIRED', 'REFERRED')")),
    check("cancellation_requests_risk_required_check", sql.raw("NOT (delegation_type = 'RISK' AND delegation_status = 'REQUIRED') OR (status = 'ACTIVE' AND resolved_at IS NULL)")),
    check("cancellation_requests_risk_referred_check", sql.raw("NOT (delegation_type = 'RISK' AND delegation_status = 'REFERRED') OR (status = 'CLOSED' AND lifecycle = 'REFERRED_TO_RISK' AND risk_case_id IS NOT NULL AND resolved_at IS NOT NULL)")),
    check("cancellation_requests_complaint_referred_check", sql.raw("NOT (delegation_type = 'COMPLAINT' AND delegation_status = 'REFERRED') OR (status = 'CLOSED' AND lifecycle = 'REFERRED_TO_COMPLAINT' AND complaint_case_id IS NOT NULL AND resolved_at IS NOT NULL)")),
    check("cancellation_requests_direct_nonrisk_check", sql.raw("NOT (decision = 'DIRECT_CANCELLED' AND delegation_type <> 'RISK') OR (status = 'CLOSED' AND lifecycle = 'RESOLVED' AND resolved_at IS NOT NULL)")),
    uniqueIndex("cancellation_requests_one_active_idx")
      .on(table.transactionId)
      .where(sql`${table.status} = 'ACTIVE'`),
    index("cancellation_requests_payment_reconciliation_idx").on(table.paymentReconciliationId)
  ]
);

export const cancellationReconciliations = pgTable(
  "cancellation_reconciliations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cancellationRequestId: uuid("cancellation_request_id").notNull().references(() => cancellationRequests.id, { onDelete: "restrict" }),
    paymentReconciliationId: uuid("payment_reconciliation_id").notNull().references(() => paymentReconciliations.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("OPEN"),
    classification: text("classification"),
    providerEventId: uuid("provider_event_id").references(() => paymentProviderEvents.id, { onDelete: "restrict" }),
    evidenceReference: text("evidence_reference"),
    reconciledByAccountId: uuid("reconciled_by_account_id").references(() => accounts.id),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("cancellation_reconciliation_request_unique").on(table.cancellationRequestId),
    check("cancellation_reconciliations_status_check", sql.raw("status IN ('OPEN', 'RESOLVED', 'TIMED_OUT')")),
    check("cancellation_reconciliations_classification_check", sql.raw("classification IS NULL OR classification IN ('AUTHORITATIVE', 'DEFINITIVE_NON_PAID', 'WAITING', 'MISMATCH', 'UNKNOWN')")),
    index("cancellation_reconciliations_payment_idx").on(table.paymentReconciliationId)
  ]
);

export const cancellationEvents = pgTable("cancellation_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  cancellationRequestId: uuid("cancellation_request_id").notNull().references(() => cancellationRequests.id, { onDelete: "restrict" }),
  eventType: text("event_type").notNull(),
  actorAccountId: uuid("actor_account_id").references(() => accounts.id, { onDelete: "restrict" }),
  summary: text("summary").notNull(),
  evidenceReference: text("evidence_reference"),
  correlationId: uuid("correlation_id").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  check("cancellation_events_type_check", sql.raw("event_type IN ('REQUESTED', 'EVIDENCE_CORRECTED', 'WITHDRAWN', 'REJECTED', 'INVITATION_REVOKED', 'INVOICE_RETIRED', 'RECONCILIATION_LINKED', 'PROVIDER_RESULT_RECORDED', 'WA_REQUEST_RECORDED', 'PARTICIPANT_RESPONSE_RECORDED', 'SELLER_SHIPMENT_RECORDED', 'RESPONSE_TIMEOUT_RECORDED', 'RECONCILIATION_TIMEOUT_RECORDED', 'MANUAL_REVIEW_RECOVERY_RECORDED', 'REFUND_CALCULATION_PROPOSED', 'REFUND_CALCULATION_APPROVED', 'REFUND_CALCULATION_REJECTED', 'COMPLAINT_HANDOFF_REQUIRED', 'COMPLAINT_HANDOFF_RECORDED', 'RISK_HANDOFF_REQUIRED', 'RISK_HANDOFF_RECORDED', 'FINANCIAL_HANDOFF_CREATED', 'HANDOFF_CLAIMED')")),
  uniqueIndex("cancellation_events_request_idempotency_unique").on(table.cancellationRequestId, table.idempotencyKey),
  index("cancellation_events_request_idx").on(table.cancellationRequestId)
]);

export const cancellationEvidence = pgTable("cancellation_evidence", {
  id: uuid("id").defaultRandom().primaryKey(),
  cancellationRequestId: uuid("cancellation_request_id").notNull().references(() => cancellationRequests.id, { onDelete: "restrict" }),
  evidenceKey: text("evidence_key").notNull(),
  sourceAuthorRole: text("source_author_role").notNull(),
  sourceAccountId: uuid("source_account_id").references(() => accounts.id, { onDelete: "restrict" }),
  evidenceReference: text("evidence_reference").notNull(),
  messageReference: text("message_reference"),
  snapshotHash: text("snapshot_hash").notNull(),
  deliveryResult: text("delivery_result").notNull(),
  responseValue: text("response_value"),
  correctedEvidenceId: uuid("corrected_evidence_id"),
  correctionReason: text("correction_reason"),
  recordedByAccountId: uuid("recorded_by_account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
  correlationId: uuid("correlation_id").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  check("cancellation_evidence_key_check", sql.raw("evidence_key IN ('WA_REQUEST', 'SELLER_SHIPMENT', 'BUYER_RESPONSE', 'SELLER_RESPONSE')")),
  check("cancellation_evidence_author_role_check", sql.raw("source_author_role IN ('BUYER', 'SELLER', 'ADMIN')")),
  check("cancellation_evidence_delivery_check", sql.raw("delivery_result IN ('PENDING', 'SENT', 'FAILED', 'UNKNOWN')")),
  check("cancellation_evidence_correction_check", sql.raw("(corrected_evidence_id IS NULL) = (correction_reason IS NULL)")),
  foreignKey({ columns: [table.correctedEvidenceId], foreignColumns: [table.id] }).onDelete("restrict"),
  uniqueIndex("cancellation_evidence_request_idempotency_unique").on(table.cancellationRequestId, table.idempotencyKey),
  index("cancellation_evidence_request_idx").on(table.cancellationRequestId)
]);

export const cancellationEvidenceHeads = pgTable("cancellation_evidence_heads", {
  id: uuid("id").defaultRandom().primaryKey(),
  cancellationRequestId: uuid("cancellation_request_id").notNull().references(() => cancellationRequests.id, { onDelete: "restrict" }),
  evidenceKey: text("evidence_key").notNull(),
  currentEvidenceId: uuid("current_evidence_id").notNull().references(() => cancellationEvidence.id, { onDelete: "restrict" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("cancellation_evidence_heads_request_key_unique").on(table.cancellationRequestId, table.evidenceKey),
  uniqueIndex("cancellation_evidence_heads_current_unique").on(table.currentEvidenceId)
]);

export const cancellationProviderResolutions = pgTable("cancellation_provider_resolutions", {
  id: uuid("id").defaultRandom().primaryKey(),
  transactionId: uuid("transaction_id").notNull().references(() => transactions.id, { onDelete: "restrict" }),
  cancellationRequestId: uuid("cancellation_request_id").references(() => cancellationRequests.id, { onDelete: "restrict" }),
  paymentReconciliationId: uuid("payment_reconciliation_id").notNull().references(() => paymentReconciliations.id, { onDelete: "restrict" }),
  providerEventId: uuid("provider_event_id").notNull().references(() => paymentProviderEvents.id, { onDelete: "restrict" }),
  source: text("source").notNull(),
  classification: text("classification").notNull(),
  outcomeState: transactionState("outcome_state").notNull(),
  correlationId: uuid("correlation_id").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  check("cancellation_provider_resolutions_source_check", sql.raw("source IN ('WEBHOOK', 'GET_STATUS', 'ADMIN_RECOVERY')")),
  check("cancellation_provider_resolutions_classification_check", sql.raw("classification IN ('AUTHORITATIVE', 'DEFINITIVE_NON_PAID', 'WAITING', 'MISMATCH', 'UNKNOWN')")),
  uniqueIndex("cancellation_provider_resolutions_event_unique").on(table.providerEventId),
  uniqueIndex("cancellation_provider_resolutions_idempotency_unique").on(table.paymentReconciliationId, table.idempotencyKey)
]);

export const cancellationRefundCalculations = pgTable("cancellation_refund_calculations", {
  id: uuid("id").defaultRandom().primaryKey(),
  cancellationRequestId: uuid("cancellation_request_id").notNull().references(() => cancellationRequests.id, { onDelete: "restrict" }),
  version: integer("version").notNull(),
  status: text("status").notNull().default("PENDING"),
  buyerAmount: integer("buyer_amount").notNull(),
  currency: text("currency").notNull().default("IDR"),
  calculationHash: text("calculation_hash").notNull(),
  evidenceSnapshotHash: text("evidence_snapshot_hash").notNull(),
  buyerDestinationBindingId: uuid("buyer_destination_binding_id").notNull(),
  proposedByAccountId: uuid("proposed_by_account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp("decided_at", { withTimezone: true })
}, (table) => [
  check("cancellation_refund_calculations_status_check", sql.raw("status IN ('PENDING', 'APPROVED', 'REJECTED')")),
  check("cancellation_refund_calculations_amount_check", sql.raw("buyer_amount > 0 AND currency = 'IDR'")),
  uniqueIndex("cancellation_refund_calculations_request_version_unique").on(table.cancellationRequestId, table.version),
  uniqueIndex("cancellation_refund_calculations_one_pending_unique").on(table.cancellationRequestId).where(sql`${table.status} = 'PENDING'`)
]);

export const cancellationRefundApprovals = pgTable("cancellation_refund_approvals", {
  id: uuid("id").defaultRandom().primaryKey(),
  calculationId: uuid("calculation_id").notNull().references(() => cancellationRefundCalculations.id, { onDelete: "restrict" }),
  adminAccountId: uuid("admin_account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
  decision: text("decision").notNull(),
  correlationId: uuid("correlation_id").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  check("cancellation_refund_approvals_decision_check", sql.raw("decision IN ('APPROVED', 'REJECTED')")),
  uniqueIndex("cancellation_refund_approvals_admin_unique").on(table.calculationId, table.adminAccountId),
  uniqueIndex("cancellation_refund_approvals_idempotency_unique").on(table.calculationId, table.idempotencyKey)
]);

export const cancellationFinancialHandoffs = pgTable("cancellation_financial_handoffs", {
  id: uuid("id").defaultRandom().primaryKey(),
  transactionId: uuid("transaction_id").notNull().references(() => transactions.id, { onDelete: "restrict" }),
  cancellationRequestId: uuid("cancellation_request_id").references(() => cancellationRequests.id, { onDelete: "restrict" }),
  paymentReconciliationId: uuid("payment_reconciliation_id").references(() => paymentReconciliations.id, { onDelete: "restrict" }),
  providerEventId: uuid("provider_event_id").notNull().references(() => paymentProviderEvents.id, { onDelete: "restrict" }),
  sourceType: text("source_type").notNull(),
  buyerAmount: integer("buyer_amount").notNull(),
  currency: text("currency").notNull().default("IDR"),
  buyerAccountId: uuid("buyer_account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
  calculationId: uuid("calculation_id").references(() => cancellationRefundCalculations.id, { onDelete: "restrict" }),
  sourceHash: text("source_hash").notNull(),
  evidenceReference: text("evidence_reference").notNull(),
  evidenceHash: text("evidence_hash").notNull(),
  providerOrderId: text("provider_order_id").notNull(),
  sourceState: transactionState("source_state").notNull(),
  sourceStateVersion: integer("source_state_version").notNull(),
  sourceFinalizedAt: timestamp("source_finalized_at", { withTimezone: true }).notNull(),
  consumedByOperationId: uuid("consumed_by_operation_id").references(() => financialOperations.id, { onDelete: "restrict" }),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  check("cancellation_financial_handoffs_source_type_check", sql.raw("source_type IN ('FUNDED_CANCELLATION', 'LATE_FUND')")),
  check("cancellation_financial_handoffs_amount_check", sql.raw("buyer_amount > 0 AND currency = 'IDR'")),
  check("cancellation_financial_handoffs_source_state_check", sql.raw("source_state = 'REFUND_READY'")),
  check("cancellation_financial_handoffs_source_fields_check", sql.raw("(source_type = 'FUNDED_CANCELLATION' AND cancellation_request_id IS NOT NULL AND calculation_id IS NOT NULL) OR (source_type = 'LATE_FUND' AND calculation_id IS NULL AND payment_reconciliation_id IS NOT NULL)")),
  check("cancellation_financial_handoffs_consumption_check", sql.raw("(consumed_by_operation_id IS NULL) = (consumed_at IS NULL)")),
  uniqueIndex("cancellation_financial_handoffs_provider_event_unique").on(table.providerEventId),
  uniqueIndex("cancellation_financial_handoffs_calculation_unique").on(table.calculationId).where(sql`${table.calculationId} IS NOT NULL`),
  index("cancellation_financial_handoffs_transaction_idx").on(table.transactionId)
]);

export const adminTaskAssignments = pgTable("admin_task_assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
  taskScope: text("task_scope").notNull(),
  assignedByAccountId: uuid("assigned_by_account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true })
}, (table) => [
  check("admin_task_assignments_scope_check", sql.raw("task_scope IN ('COMPLAINT_INTAKE', 'COMPLAINT_APPROVAL', 'RISK_INTAKE', 'RISK_APPROVAL', 'RELEASE_GATE_REVIEW', 'CANCELLATION_RECONCILIATION', 'CANCELLATION_EVIDENCE', 'CANCELLATION_APPROVAL', 'FINANCIAL_PREPARE', 'FINANCIAL_APPROVE', 'FINANCIAL_EXECUTE', 'FINANCIAL_RECONCILE')")),
  uniqueIndex("admin_task_assignments_active_scope_unique")
    .on(table.accountId, table.taskScope)
    .where(sql`${table.revokedAt} IS NULL`)
]);

export const complaintHolds = pgTable("complaint_holds", {
  id: uuid("id").defaultRandom().primaryKey(),
  transactionId: uuid("transaction_id").notNull().references(() => transactions.id, { onDelete: "restrict" }),
  summary: text("summary").notNull(),
  evidenceReference: text("evidence_reference"),
  outcome: text("outcome"),
  lifecycle: text("lifecycle").notNull().default("OPEN"),
  active: boolean("active").notNull().default(true),
  sourceState: transactionState("source_state").notNull(),
  sourceStateVersion: integer("source_state_version").notNull(),
  currentEventId: uuid("current_event_id"),
  currentAgreementId: uuid("current_agreement_id"),
  createdByAccountId: uuid("created_by_account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true })
}, (table) => [
  check("complaint_holds_lifecycle_check", sql.raw("lifecycle IN ('OPEN', 'NO_AGREEMENT', 'AGREEMENT_PENDING_APPROVAL', 'AGREEMENT_APPROVED', 'POST_PROCESSING_RECORDED')")),
  check("complaint_holds_source_version_check", sql.raw("source_state_version >= 0")),
  uniqueIndex("complaint_holds_one_active_case_unique")
    .on(table.transactionId)
    .where(sql`${table.active} = true`),
  index("complaint_holds_transaction_idx").on(table.transactionId)
]);

export const complaintEvents = pgTable("complaint_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  complaintCaseId: uuid("complaint_case_id").notNull().references(() => complaintHolds.id, { onDelete: "restrict" }),
  eventType: text("event_type").notNull(),
  correctedEventId: uuid("corrected_event_id"),
  actorAccountId: uuid("actor_account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
  sourceAuthorRole: text("source_author_role"),
  summarySnapshot: text("summary_snapshot").notNull(),
  evidenceReference: text("evidence_reference"),
  evidenceHash: text("evidence_hash").notNull(),
  correctionReason: text("correction_reason"),
  correlationId: uuid("correlation_id").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  check("complaint_events_type_check", sql.raw("event_type IN ('COMPLAINT_RECORDED', 'EVIDENCE_CORRECTED', 'NO_AGREEMENT_RECORDED', 'AGREEMENT_PROPOSED', 'AGREEMENT_APPROVED', 'HANDOFF_CLAIMED', 'POST_PROCESSING_RECORDED')")),
  check("complaint_events_author_role_check", sql.raw("source_author_role IS NULL OR source_author_role IN ('BUYER', 'SELLER', 'ADMIN')")),
  check("complaint_events_correction_check", sql.raw("(event_type = 'EVIDENCE_CORRECTED') = (corrected_event_id IS NOT NULL AND correction_reason IS NOT NULL)")),
  foreignKey({
    columns: [table.correctedEventId],
    foreignColumns: [table.id]
  }).onDelete("restrict"),
  uniqueIndex("complaint_events_case_idempotency_unique").on(table.complaintCaseId, table.idempotencyKey),
  index("complaint_events_case_idx").on(table.complaintCaseId)
]);

export const complaintAgreements = pgTable("complaint_agreements", {
  id: uuid("id").defaultRandom().primaryKey(),
  complaintCaseId: uuid("complaint_case_id").notNull().references(() => complaintHolds.id, { onDelete: "restrict" }),
  version: integer("version").notNull(),
  status: text("status").notNull().default("PENDING"),
  outcome: text("outcome").notNull(),
  buyerAmount: integer("buyer_amount").notNull(),
  sellerAmount: integer("seller_amount").notNull(),
  currency: text("currency").notNull().default("IDR"),
  calculationHash: text("calculation_hash").notNull(),
  buyerDestinationBindingId: uuid("buyer_destination_binding_id"),
  sellerDestinationBindingId: uuid("seller_destination_binding_id"),
  evidenceEventId: uuid("evidence_event_id").notNull().references(() => complaintEvents.id, { onDelete: "restrict" }),
  evidenceReference: text("evidence_reference").notNull(),
  evidenceHash: text("evidence_hash").notNull(),
  proposedByAccountId: uuid("proposed_by_account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp("decided_at", { withTimezone: true })
}, (table) => [
  check("complaint_agreements_status_check", sql.raw("status IN ('PENDING', 'APPROVED', 'REJECTED')")),
  check("complaint_agreements_outcome_check", sql.raw("outcome IN ('SELLER_RELEASE', 'BUYER_REFUND', 'SPLIT')")),
  check("complaint_agreements_amount_check", sql.raw("buyer_amount >= 0 AND seller_amount >= 0")),
  check("complaint_agreements_currency_check", sql.raw("currency = 'IDR'")),
  uniqueIndex("complaint_agreements_case_version_unique").on(table.complaintCaseId, table.version),
  index("complaint_agreements_case_idx").on(table.complaintCaseId)
]);

export const complaintAgreementApprovals = pgTable("complaint_agreement_approvals", {
  id: uuid("id").defaultRandom().primaryKey(),
  agreementId: uuid("agreement_id").notNull().references(() => complaintAgreements.id, { onDelete: "restrict" }),
  adminAccountId: uuid("admin_account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
  decision: text("decision").notNull(),
  correlationId: uuid("correlation_id").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  check("complaint_agreement_approvals_decision_check", sql.raw("decision IN ('APPROVED', 'REJECTED')")),
  uniqueIndex("complaint_agreement_approvals_admin_unique").on(table.agreementId, table.adminAccountId),
  uniqueIndex("complaint_agreement_approvals_idempotency_unique").on(table.agreementId, table.idempotencyKey)
]);

export const complaintFinancialHandoffs = pgTable("complaint_financial_handoffs", {
  id: uuid("id").defaultRandom().primaryKey(),
  complaintCaseId: uuid("complaint_case_id").notNull().references(() => complaintHolds.id, { onDelete: "restrict" }),
  agreementId: uuid("agreement_id").notNull().references(() => complaintAgreements.id, { onDelete: "restrict" }),
  transactionId: uuid("transaction_id").notNull().references(() => transactions.id, { onDelete: "restrict" }),
  outcome: text("outcome").notNull(),
  buyerAmount: integer("buyer_amount").notNull(),
  sellerAmount: integer("seller_amount").notNull(),
  currency: text("currency").notNull().default("IDR"),
  calculationHash: text("calculation_hash").notNull(),
  buyerDestinationBindingId: uuid("buyer_destination_binding_id"),
  sellerDestinationBindingId: uuid("seller_destination_binding_id"),
  evidenceReference: text("evidence_reference").notNull(),
  evidenceHash: text("evidence_hash").notNull(),
  sourceState: transactionState("source_state").notNull(),
  sourceStateVersion: integer("source_state_version").notNull(),
  approvedAt: timestamp("approved_at", { withTimezone: true }).notNull(),
  consumedByOperationId: uuid("consumed_by_operation_id").references(() => financialOperations.id, { onDelete: "restrict" }),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  check("complaint_financial_handoffs_outcome_check", sql.raw("outcome IN ('SELLER_RELEASE', 'BUYER_REFUND', 'SPLIT')")),
  check("complaint_financial_handoffs_amount_check", sql.raw("buyer_amount >= 0 AND seller_amount >= 0")),
  check("complaint_financial_handoffs_currency_check", sql.raw("currency = 'IDR'")),
  check("complaint_financial_handoffs_consumption_check", sql.raw("(consumed_by_operation_id IS NULL) = (consumed_at IS NULL)")),
  uniqueIndex("complaint_financial_handoffs_agreement_unique").on(table.agreementId),
  uniqueIndex("complaint_financial_handoffs_case_unique").on(table.complaintCaseId),
  index("complaint_financial_handoffs_transaction_idx").on(table.transactionId)
]);

export const riskHolds = pgTable("risk_holds", {
  id: uuid("id").defaultRandom().primaryKey(),
  transactionId: uuid("transaction_id").notNull().references(() => transactions.id, { onDelete: "restrict" }),
  category: text("category").notNull(),
  reason: text("reason").notNull(),
  note: text("note"),
  evidenceReference: text("evidence_reference"),
  outcome: text("outcome"),
  mode: text("mode").notNull().default("ACTIVE_HOLD"),
  lifecycle: text("lifecycle").notNull().default("OPEN"),
  active: boolean("active").notNull().default(true),
  sourceState: transactionState("source_state").notNull(),
  sourceStateVersion: integer("source_state_version").notNull(),
  sourceOwnerType: text("source_owner_type"),
  sourceOwnerId: uuid("source_owner_id"),
  currentEventId: uuid("current_event_id"),
  currentReviewId: uuid("current_review_id"),
  createdByAccountId: uuid("created_by_account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true })
}, (table) => [
  check("risk_holds_category_check", sql.raw("category IN ('PROHIBITED_OR_POLICY', 'SUSPECTED_FRAUD', 'OTHER_MANUAL_REVIEW')")),
  check("risk_holds_other_note_check", sql.raw("category <> 'OTHER_MANUAL_REVIEW' OR NULLIF(BTRIM(note), '') IS NOT NULL")),
  check("risk_holds_mode_check", sql.raw("mode IN ('ACTIVE_HOLD', 'RECORD_ONLY')")),
  check("risk_holds_lifecycle_check", sql.raw("lifecycle IN ('OPEN', 'REVIEW_PENDING_APPROVAL', 'REVIEWED_HOLD', 'REVIEW_APPROVED', 'CLEARED_TO_MANUAL_REVIEW', 'RECORD_ONLY', 'POST_PROCESSING_RECORDED')")),
  check("risk_holds_source_version_check", sql.raw("source_state_version >= 0")),
  check("risk_holds_owner_type_check", sql.raw("source_owner_type IS NULL OR source_owner_type IN ('COMPLAINT_CASE', 'CANCELLATION_CASE', 'REFUND_CASE', 'FINANCIAL_OPERATION', 'TERMINAL_TRANSACTION')")),
  check("risk_holds_active_mode_check", sql.raw("NOT active OR (mode = 'ACTIVE_HOLD' AND lifecycle NOT IN ('RECORD_ONLY', 'POST_PROCESSING_RECORDED', 'CLEARED_TO_MANUAL_REVIEW', 'REVIEW_APPROVED'))")),
  check("risk_holds_record_owner_check", sql.raw("mode <> 'RECORD_ONLY' OR (source_owner_type IS NOT NULL AND source_owner_id IS NOT NULL)")),
  uniqueIndex("risk_holds_one_active_case_unique").on(table.transactionId).where(sql`${table.active} = true`),
  index("risk_holds_transaction_idx").on(table.transactionId),
  index("risk_holds_source_owner_idx").on(table.sourceOwnerType, table.sourceOwnerId)
]);

export const riskEvents = pgTable("risk_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  riskCaseId: uuid("risk_case_id").notNull().references(() => riskHolds.id, { onDelete: "restrict" }),
  eventType: text("event_type").notNull(),
  correctedEventId: uuid("corrected_event_id"),
  actorAccountId: uuid("actor_account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
  summarySnapshot: text("summary_snapshot").notNull(),
  evidenceReference: text("evidence_reference"),
  evidenceHash: text("evidence_hash").notNull(),
  correctionReason: text("correction_reason"),
  correlationId: uuid("correlation_id").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  check("risk_events_type_check", sql.raw("event_type IN ('RISK_RECORDED', 'EVIDENCE_CORRECTED', 'REVIEW_PROPOSED', 'REVIEW_APPROVED', 'REVIEW_REJECTED', 'HANDOFF_CLAIMED', 'POST_PROCESSING_RECORDED')")),
  check("risk_events_correction_check", sql.raw("(event_type = 'EVIDENCE_CORRECTED') = (corrected_event_id IS NOT NULL AND correction_reason IS NOT NULL)")),
  foreignKey({ columns: [table.correctedEventId], foreignColumns: [table.id] }).onDelete("restrict"),
  uniqueIndex("risk_events_case_idempotency_unique").on(table.riskCaseId, table.idempotencyKey),
  index("risk_events_case_idx").on(table.riskCaseId)
]);

export const riskReviews = pgTable("risk_reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  riskCaseId: uuid("risk_case_id").notNull().references(() => riskHolds.id, { onDelete: "restrict" }),
  version: integer("version").notNull(),
  status: text("status").notNull().default("PENDING"),
  outcome: text("outcome").notNull(),
  buyerAmount: integer("buyer_amount").notNull().default(0),
  currency: text("currency").notNull().default("IDR"),
  calculationHash: text("calculation_hash").notNull(),
  buyerDestinationBindingId: uuid("buyer_destination_binding_id"),
  evidenceEventId: uuid("evidence_event_id").notNull().references(() => riskEvents.id, { onDelete: "restrict" }),
  decisionNote: text("decision_note").notNull(),
  proposedByAccountId: uuid("proposed_by_account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp("decided_at", { withTimezone: true })
}, (table) => [
  check("risk_reviews_status_check", sql.raw("status IN ('PENDING', 'APPROVED', 'REJECTED')")),
  check("risk_reviews_outcome_check", sql.raw("outcome IN ('KEEP_HOLD', 'CLEAR_TO_MANUAL_REVIEW', 'BUYER_REFUND')")),
  check("risk_reviews_currency_check", sql.raw("currency = 'IDR'")),
  check("risk_reviews_amount_destination_check", sql.raw("((outcome = 'BUYER_REFUND' AND buyer_amount > 0 AND buyer_destination_binding_id IS NOT NULL) OR (outcome <> 'BUYER_REFUND' AND buyer_amount = 0 AND buyer_destination_binding_id IS NULL))")),
  uniqueIndex("risk_reviews_case_version_unique").on(table.riskCaseId, table.version),
  uniqueIndex("risk_reviews_one_pending_unique").on(table.riskCaseId).where(sql`${table.status} = 'PENDING'`),
  index("risk_reviews_case_idx").on(table.riskCaseId)
]);

export const riskReviewApprovals = pgTable("risk_review_approvals", {
  id: uuid("id").defaultRandom().primaryKey(),
  reviewId: uuid("review_id").notNull().references(() => riskReviews.id, { onDelete: "restrict" }),
  adminAccountId: uuid("admin_account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
  decision: text("decision").notNull(),
  correlationId: uuid("correlation_id").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  check("risk_review_approvals_decision_check", sql.raw("decision IN ('APPROVED', 'REJECTED')")),
  uniqueIndex("risk_review_approvals_admin_unique").on(table.reviewId, table.adminAccountId),
  uniqueIndex("risk_review_approvals_idempotency_unique").on(table.reviewId, table.idempotencyKey)
]);

export const riskFinancialHandoffs = pgTable("risk_financial_handoffs", {
  id: uuid("id").defaultRandom().primaryKey(),
  riskCaseId: uuid("risk_case_id").notNull().references(() => riskHolds.id, { onDelete: "restrict" }),
  reviewId: uuid("review_id").notNull().references(() => riskReviews.id, { onDelete: "restrict" }),
  transactionId: uuid("transaction_id").notNull().references(() => transactions.id, { onDelete: "restrict" }),
  outcome: text("outcome").notNull().default("BUYER_REFUND"),
  buyerAmount: integer("buyer_amount").notNull(),
  currency: text("currency").notNull().default("IDR"),
  buyerDestinationBindingId: uuid("buyer_destination_binding_id").notNull(),
  calculationHash: text("calculation_hash").notNull(),
  evidenceReference: text("evidence_reference").notNull(),
  evidenceHash: text("evidence_hash").notNull(),
  sourceState: transactionState("source_state").notNull(),
  sourceStateVersion: integer("source_state_version").notNull(),
  approvedAt: timestamp("approved_at", { withTimezone: true }).notNull(),
  consumedByOperationId: uuid("consumed_by_operation_id"),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  check("risk_handoffs_outcome_check", sql.raw("outcome = 'BUYER_REFUND'")),
  check("risk_handoffs_amount_currency_check", sql.raw("buyer_amount > 0 AND currency = 'IDR'")),
  check("risk_handoffs_consumption_check", sql.raw("(consumed_by_operation_id IS NULL) = (consumed_at IS NULL)")),
  uniqueIndex("risk_handoffs_review_unique").on(table.reviewId),
  uniqueIndex("risk_handoffs_case_unique").on(table.riskCaseId),
  index("risk_handoffs_transaction_idx").on(table.transactionId)
]);

export const releaseGates = pgTable("release_gates", {
  id: uuid("id").defaultRandom().primaryKey(),
  gateKey: text("gate_key").notNull(),
  status: text("status").notNull().default("OPEN"),
  stateVersion: integer("state_version").notNull().default(0),
  currentReviewId: uuid("current_review_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  check("release_gates_key_check", sql.raw("gate_key = 'REAL_MONEY_PILOT'")),
  check("release_gates_status_check", sql.raw("status IN ('OPEN', 'BLOCKED', 'APPROVED')")),
  check("release_gates_version_check", sql.raw("state_version >= 0")),
  uniqueIndex("release_gates_key_unique").on(table.gateKey)
]);

export const releaseGateItems = pgTable("release_gate_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  gateId: uuid("gate_id").notNull().references(() => releaseGates.id, { onDelete: "restrict" }),
  itemKey: text("item_key").notNull(),
  status: text("status").notNull().default("OPEN"),
  currentEventId: uuid("current_event_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  check("release_gate_items_key_check", sql.raw("item_key IN ('MIDTRANS_SETTLEMENT', 'CUSTODY_FORWARDING', 'CONSUMER_DISCLOSURE', 'COMPLAINT_HANDLING', 'DATA_CONTROLS', 'PRODUCTION_CREDENTIALS_WEBHOOK', 'REAL_MONEY_PILOT_EVIDENCE', 'LEGAL_COMPLIANCE')")),
  check("release_gate_items_status_check", sql.raw("status IN ('OPEN', 'BLOCKED', 'APPROVED')")),
  uniqueIndex("release_gate_items_key_unique").on(table.gateId, table.itemKey)
]);

export const releaseGateItemEvents = pgTable("release_gate_item_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  itemId: uuid("item_id").notNull().references(() => releaseGateItems.id, { onDelete: "restrict" }),
  status: text("status").notNull(),
  evidenceReference: text("evidence_reference").notNull(),
  externalApproverReference: text("external_approver_reference"),
  correctedEventId: uuid("corrected_event_id"),
  correctionReason: text("correction_reason"),
  actorAccountId: uuid("actor_account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
  correlationId: uuid("correlation_id").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  check("release_gate_item_events_status_check", sql.raw("status IN ('OPEN', 'BLOCKED', 'APPROVED')")),
  check("release_gate_item_events_correction_check", sql.raw("(corrected_event_id IS NULL) = (correction_reason IS NULL)")),
  foreignKey({ columns: [table.correctedEventId], foreignColumns: [table.id] }).onDelete("restrict"),
  uniqueIndex("release_gate_item_events_idempotency_unique").on(table.itemId, table.idempotencyKey)
]);

export const releaseGateReviews = pgTable("release_gate_reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  gateId: uuid("gate_id").notNull().references(() => releaseGates.id, { onDelete: "restrict" }),
  resultingStatus: text("resulting_status").notNull(),
  externalDecisionReference: text("external_decision_reference"),
  actorAccountId: uuid("actor_account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
  correlationId: uuid("correlation_id").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  gateVersion: integer("gate_version").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  check("release_gate_reviews_status_check", sql.raw("resulting_status IN ('OPEN', 'BLOCKED', 'APPROVED')")),
  check("release_gate_reviews_approval_reference_check", sql.raw("resulting_status <> 'APPROVED' OR NULLIF(BTRIM(external_decision_reference), '') IS NOT NULL")),
  uniqueIndex("release_gate_reviews_idempotency_unique").on(table.gateId, table.idempotencyKey)
]);

export const financialOperations = pgTable(
  "financial_operations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transactionId: uuid("transaction_id").notNull().references(() => transactions.id, { onDelete: "cascade" }),
    type: operationType("type").notNull(),
    result: operationResult("result"),
    amount: integer("amount").notNull(),
    destinationSnapshot: text("destination_snapshot").notNull(),
    bankReference: text("bank_reference"),
    evidenceHash: text("evidence_hash"),
    route: text("route"),
    attempt: integer("attempt").notNull().default(1),
    preparedAt: timestamp("prepared_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    retryOfOperationId: uuid("retry_of_operation_id"),
    rootOperationId: uuid("root_operation_id"),
    sourceType: text("source_type"),
    sourceHandoffId: uuid("source_handoff_id"),
    sourceHash: text("source_hash"),
    sourceFinalizedAt: timestamp("source_finalized_at", { withTimezone: true }),
    sourceState: transactionState("source_state"),
    sourceStateVersion: integer("source_state_version"),
    externalIdempotencyKey: text("external_idempotency_key"),
    selectedCapabilityAssessmentId: uuid("selected_capability_assessment_id"),
    stateVersion: integer("state_version").notNull().default(0),
    startedByAccountId: uuid("started_by_account_id").notNull().references(() => accounts.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true })
  },
  (table) => [
    index("financial_operations_transaction_idx").on(table.transactionId),
    uniqueIndex("financial_operations_external_key_unique")
      .on(table.externalIdempotencyKey)
      .where(sql`${table.externalIdempotencyKey} IS NOT NULL`),
    uniqueIndex("financial_operations_active_unique")
      .on(table.transactionId, table.type)
      .where(sql.raw("result IS NULL OR result IN ('PROCESSING', 'UNKNOWN')")),
    check("financial_operations_amount_check", sql.raw("amount > 0")),
    check("financial_operations_attempt_check", sql.raw("attempt > 0 AND state_version >= 0")),
    check("financial_operations_route_check", sql.raw("route IS NULL OR route IN ('MANUAL_PAYOUT', 'MIDTRANS_REFUND', 'MANUAL_REFUND', 'MANUAL_SPLIT')")),
    check("financial_operations_source_check", sql.raw("source_type IS NULL OR source_type IN ('COMPLAINT', 'RISK', 'FUNDED_CANCELLATION', 'LATE_FUND')")),
    check("financial_operations_lifecycle_check", sql.raw(
      "(result IS NULL AND started_at IS NULL AND completed_at IS NULL AND bank_reference IS NULL AND evidence_hash IS NULL) OR " +
      "(result = 'PROCESSING' AND started_at IS NOT NULL AND completed_at IS NULL) OR " +
      "(result IN ('SUCCESS', 'FAILED', 'UNKNOWN') AND started_at IS NOT NULL AND completed_at IS NOT NULL)"
    )),
    check("financial_operations_success_evidence_check", sql.raw(
      "result <> 'SUCCESS' OR (NULLIF(BTRIM(bank_reference), '') IS NOT NULL AND NULLIF(BTRIM(evidence_hash), '') IS NOT NULL)"
    ))
  ]
);

export const financialOperationApprovals = pgTable("financial_operation_approvals", {
  id: uuid("id").defaultRandom().primaryKey(),
  operationId: uuid("operation_id").notNull().references(() => financialOperations.id, { onDelete: "restrict" }),
  adminAccountId: uuid("admin_account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
  decision: text("decision").notNull(),
  note: text("note"),
  operationStateVersion: integer("operation_state_version").notNull(),
  correlationId: uuid("correlation_id").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  check("financial_operation_approvals_decision_check", sql.raw("decision IN ('APPROVED', 'REJECTED')")),
  uniqueIndex("financial_operation_approvals_admin_unique").on(table.operationId, table.adminAccountId),
  uniqueIndex("financial_operation_approvals_idempotency_unique").on(table.operationId, table.idempotencyKey),
  index("financial_operation_approvals_operation_idx").on(table.operationId)
]);

export const financialOperationReauthGrants = pgTable("financial_operation_reauth_grants", {
  id: uuid("id").defaultRandom().primaryKey(),
  operationId: uuid("operation_id").notNull().references(() => financialOperations.id, { onDelete: "restrict" }),
  adminAccountId: uuid("admin_account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
  sessionIdHash: text("session_id_hash").notNull(),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  invalidatedAt: timestamp("invalidated_at", { withTimezone: true }),
  stateVersion: integer("state_version").notNull().default(0),
  idempotencyKey: text("idempotency_key").notNull()
}, (table) => [
  check("financial_operation_reauth_grants_version_check", sql.raw("state_version >= 0")),
  check("financial_operation_reauth_grants_time_check", sql.raw("expires_at > granted_at")),
  uniqueIndex("financial_operation_reauth_grants_idempotency_unique").on(table.operationId, table.idempotencyKey),
  uniqueIndex("financial_operation_reauth_grants_one_active_unique")
    .on(table.operationId, table.adminAccountId)
    .where(sql`${table.consumedAt} IS NULL AND ${table.invalidatedAt} IS NULL`),
  index("financial_operation_reauth_grants_operation_idx").on(table.operationId)
]);

export const financialSplitCalculations = pgTable("financial_split_calculations", {
  id: uuid("id").defaultRandom().primaryKey(),
  rootOperationId: uuid("root_operation_id").notNull().references(() => financialOperations.id, { onDelete: "restrict" }),
  transactionId: uuid("transaction_id").notNull().references(() => transactions.id, { onDelete: "restrict" }),
  buyerAmount: integer("buyer_amount").notNull(),
  sellerAmount: integer("seller_amount").notNull(),
  poolAmount: integer("pool_amount").notNull(),
  currency: text("currency").notNull().default("IDR"),
  calculationHash: text("calculation_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  check("financial_split_calculations_amount_check", sql.raw("buyer_amount > 0 AND seller_amount > 0 AND buyer_amount + seller_amount = pool_amount")),
  check("financial_split_calculations_currency_check", sql.raw("currency = 'IDR'")),
  uniqueIndex("financial_split_calculations_root_unique").on(table.rootOperationId)
]);

export const refundCapabilityAssessments = pgTable("refund_capability_assessments", {
  id: uuid("id").defaultRandom().primaryKey(),
  transactionId: uuid("transaction_id").notNull().references(() => transactions.id, { onDelete: "restrict" }),
  sourceType: text("source_type").notNull(),
  sourceHandoffId: uuid("source_handoff_id").notNull(),
  sourceHash: text("source_hash").notNull(),
  sourceStateVersion: integer("source_state_version").notNull(),
  invoiceId: uuid("invoice_id").notNull().references(() => paymentInvoices.id, { onDelete: "restrict" }),
  authoritativeProviderEventId: uuid("authoritative_provider_event_id").notNull().references(() => paymentProviderEvents.id, { onDelete: "restrict" }),
  providerOrderId: text("provider_order_id").notNull(),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("IDR"),
  capabilitySnapshotHash: text("capability_snapshot_hash").notNull(),
  capability: text("capability").notNull(),
  evidenceReference: text("evidence_reference"),
  evidenceHash: text("evidence_hash"),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull(),
  actorAccountId: uuid("actor_account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
  correlationId: uuid("correlation_id").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  check("refund_capability_assessments_source_check", sql.raw("source_type IN ('COMPLAINT', 'RISK', 'FUNDED_CANCELLATION', 'LATE_FUND')")),
  check("refund_capability_assessments_capability_check", sql.raw("capability IN ('SUPPORTED', 'UNSUPPORTED', 'UNKNOWN')")),
  check("refund_capability_assessments_amount_check", sql.raw("amount > 0 AND currency = 'IDR'")),
  uniqueIndex("refund_capability_assessments_idempotency_unique").on(table.actorAccountId, table.idempotencyKey),
  index("refund_capability_assessments_transaction_idx").on(table.transactionId)
]);

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
