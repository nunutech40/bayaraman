CREATE TYPE "public"."operation_result" AS ENUM('PROCESSING', 'SUCCESS', 'FAILED', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."operation_type" AS ENUM('PAYOUT', 'REFUND', 'SPLIT_BUYER', 'SPLIT_SELLER');--> statement-breakpoint
CREATE TYPE "public"."product_role" AS ENUM('BUYER', 'SELLER', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."transaction_state" AS ENUM('WAITING_COUNTERPARTY', 'WAITING_COUNTERPARTY_DATA', 'WAITING_BUYER_PAYMENT', 'PAYMENT_UNDER_REVIEW', 'PAYMENT_CONFIRMED', 'PAYMENT_EXCEPTION_REVIEW', 'PAYMENT_EXPIRED', 'READY_FOR_FULFILLMENT', 'WAITING_COMPLETION_REPORTS', 'WAITING_OTHER_COMPLETION_REPORT', 'READY_FOR_BUYER_CONFIRMATION', 'WAITING_BUYER_CONFIRMATION', 'BUYER_CONFIRMATION_OVERDUE', 'READY_FOR_PAYOUT', 'PAYOUT_ON_HOLD', 'PAYOUT_PROCESSING', 'PAID_OUT', 'CANCELLATION_REQUESTED', 'CANCELLATION_PENDING_RECONCILIATION', 'FUNDED_CANCELLATION_REVIEW', 'REFUND_READY', 'REFUND_PROCESSING', 'REFUNDED', 'SPLIT_PROCESSING', 'SPLIT_SETTLED', 'MANUAL_REVIEW_REQUIRED', 'RISK_HOLD', 'CANCELLED');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account_whatsapp_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"destination_snapshot" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"display_name" text NOT NULL,
	"whatsapp_number" text NOT NULL,
	"whatsapp_verified_at" timestamp with time zone,
	"is_admin" boolean DEFAULT false NOT NULL,
	"admin_task_assignment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid,
	"actor_account_id" uuid,
	"event_type" text NOT NULL,
	"before_state" "transaction_state",
	"after_state" "transaction_state",
	"state_version" integer,
	"correlation_id" uuid NOT NULL,
	"evidence_reference" text,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cancellation_reconciliations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cancellation_request_id" uuid NOT NULL,
	"bank_result" text,
	"evidence_reference" text,
	"reconciled_by_account_id" uuid,
	"deadline_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cancellation_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"requested_by_account_id" uuid NOT NULL,
	"cause" text NOT NULL,
	"note" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"state_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "other_manual_review_requires_note" CHECK (cause <> 'OTHER_MANUAL_REVIEW' OR note IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "complaint_holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"summary" text NOT NULL,
	"evidence_reference" text,
	"outcome" text,
	"created_by_account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "confirmation_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"buyer_whatsapp_snapshot" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "confirmation_otps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"confirmation_link_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "financial_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"type" "operation_type" NOT NULL,
	"result" "operation_result" DEFAULT 'PROCESSING' NOT NULL,
	"amount" integer NOT NULL,
	"destination_snapshot" text NOT NULL,
	"bank_reference" text,
	"attempt" integer DEFAULT 1 NOT NULL,
	"started_by_account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "idempotency_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_account_id" uuid,
	"command" text NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"target_role" "product_role" NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"submitted_by_account_id" uuid NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_instructions" (
	"transaction_id" uuid PRIMARY KEY NOT NULL,
	"destination_bank" text NOT NULL,
	"destination_account_mask" text NOT NULL,
	"amount" integer NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"deadline_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"claim_id" uuid,
	"result" text NOT NULL,
	"observed_amount" integer,
	"bank_reference" text,
	"evidence_reference" text,
	"reviewed_by_account_id" uuid NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "risk_holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"evidence_reference" text,
	"outcome" text,
	"created_by_account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transaction_participants" (
	"transaction_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"role" "product_role" NOT NULL,
	"name_snapshot" text NOT NULL,
	"whatsapp_snapshot" text NOT NULL,
	"joined_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transaction_participants_transaction_id_account_id_pk" PRIMARY KEY("transaction_id","account_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transaction_terms" (
	"transaction_id" uuid PRIMARY KEY NOT NULL,
	"item_description" text NOT NULL,
	"item_price" integer NOT NULL,
	"shipping_cost" integer DEFAULT 0 NOT NULL,
	"service_fee" integer DEFAULT 0 NOT NULL,
	"total_amount" integer NOT NULL,
	"frozen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_account_id" uuid NOT NULL,
	"creator_role" "product_role" NOT NULL,
	"state" "transaction_state" NOT NULL,
	"state_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_state_version_nonnegative" CHECK (state_version >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "whatsapp_checkpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"checkpoint_type" text NOT NULL,
	"author_account_id" uuid,
	"message_reference" text,
	"evidence_reference" text,
	"snapshot_hash" text NOT NULL,
	"recorded_by_account_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "whatsapp_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"group_reference" text NOT NULL,
	"created_by_account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "account_whatsapp_verifications" ADD CONSTRAINT "account_whatsapp_verifications_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_account_id_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cancellation_reconciliations" ADD CONSTRAINT "cancellation_reconciliations_cancellation_request_id_cancellation_requests_id_fk" FOREIGN KEY ("cancellation_request_id") REFERENCES "public"."cancellation_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cancellation_reconciliations" ADD CONSTRAINT "cancellation_reconciliations_reconciled_by_account_id_accounts_id_fk" FOREIGN KEY ("reconciled_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cancellation_requests" ADD CONSTRAINT "cancellation_requests_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cancellation_requests" ADD CONSTRAINT "cancellation_requests_requested_by_account_id_accounts_id_fk" FOREIGN KEY ("requested_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "complaint_holds" ADD CONSTRAINT "complaint_holds_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "complaint_holds" ADD CONSTRAINT "complaint_holds_created_by_account_id_accounts_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "confirmation_links" ADD CONSTRAINT "confirmation_links_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "confirmation_otps" ADD CONSTRAINT "confirmation_otps_confirmation_link_id_confirmation_links_id_fk" FOREIGN KEY ("confirmation_link_id") REFERENCES "public"."confirmation_links"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_operations" ADD CONSTRAINT "financial_operations_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_operations" ADD CONSTRAINT "financial_operations_started_by_account_id_accounts_id_fk" FOREIGN KEY ("started_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_actor_account_id_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invitations" ADD CONSTRAINT "invitations_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_claims" ADD CONSTRAINT "payment_claims_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_claims" ADD CONSTRAINT "payment_claims_submitted_by_account_id_accounts_id_fk" FOREIGN KEY ("submitted_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_instructions" ADD CONSTRAINT "payment_instructions_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_reviews" ADD CONSTRAINT "payment_reviews_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_reviews" ADD CONSTRAINT "payment_reviews_claim_id_payment_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."payment_claims"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_reviews" ADD CONSTRAINT "payment_reviews_reviewed_by_account_id_accounts_id_fk" FOREIGN KEY ("reviewed_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "risk_holds" ADD CONSTRAINT "risk_holds_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "risk_holds" ADD CONSTRAINT "risk_holds_created_by_account_id_accounts_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transaction_participants" ADD CONSTRAINT "transaction_participants_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transaction_participants" ADD CONSTRAINT "transaction_participants_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transaction_terms" ADD CONSTRAINT "transaction_terms_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_creator_account_id_accounts_id_fk" FOREIGN KEY ("creator_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "whatsapp_checkpoints" ADD CONSTRAINT "whatsapp_checkpoints_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "whatsapp_checkpoints" ADD CONSTRAINT "whatsapp_checkpoints_group_id_whatsapp_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."whatsapp_groups"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "whatsapp_checkpoints" ADD CONSTRAINT "whatsapp_checkpoints_author_account_id_accounts_id_fk" FOREIGN KEY ("author_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "whatsapp_checkpoints" ADD CONSTRAINT "whatsapp_checkpoints_recorded_by_account_id_accounts_id_fk" FOREIGN KEY ("recorded_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "whatsapp_groups" ADD CONSTRAINT "whatsapp_groups_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "whatsapp_groups" ADD CONSTRAINT "whatsapp_groups_created_by_account_id_accounts_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_verification_account_idx" ON "account_whatsapp_verifications" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_email_unique" ON "accounts" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_whatsapp_unique" ON "accounts" USING btree ("whatsapp_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_transaction_idx" ON "audit_events" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_correlation_idx" ON "audit_events" USING btree ("correlation_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cancellation_reconciliation_request_unique" ON "cancellation_reconciliations" USING btree ("cancellation_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "confirmation_links_token_hash_unique" ON "confirmation_links" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_operations_transaction_idx" ON "financial_operations" USING btree ("transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "financial_operations_active_unique" ON "financial_operations" USING btree ("transaction_id","type") WHERE result IN ('PROCESSING', 'UNKNOWN');--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idempotency_actor_command_key_unique" ON "idempotency_keys" USING btree ("actor_account_id","command","key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invitations_token_hash_unique" ON "invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invitations_transaction_idx" ON "invitations" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_claims_transaction_idx" ON "payment_claims" USING btree ("transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "transaction_participant_role_unique" ON "transaction_participants" USING btree ("transaction_id","role");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transaction_participant_account_idx" ON "transaction_participants" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_state_idx" ON "transactions" USING btree ("state");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_creator_idx" ON "transactions" USING btree ("creator_account_id");