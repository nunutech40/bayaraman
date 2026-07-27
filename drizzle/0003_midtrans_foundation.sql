CREATE TABLE IF NOT EXISTS "payment_invoices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "transaction_id" uuid NOT NULL REFERENCES "transactions"("id") ON DELETE cascade,
  "provider" text NOT NULL,
  "provider_invoice_id" text,
  "provider_order_id" text NOT NULL,
  "hosted_payment_url" text,
  "amount" integer NOT NULL,
  "currency" text DEFAULT 'IDR' NOT NULL,
  "provider_status" text,
  "issued_at" timestamp with time zone,
  "deadline_at" timestamp with time zone NOT NULL,
  "due_date_at" timestamp with time zone,
  "is_active" boolean DEFAULT false NOT NULL,
  "retired_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_invoices_provider_order_unique" ON "payment_invoices" USING btree ("provider", "provider_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_invoices_provider_invoice_unique" ON "payment_invoices" USING btree ("provider", "provider_invoice_id") WHERE "provider_invoice_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_invoices_one_active_idx" ON "payment_invoices" USING btree ("transaction_id") WHERE "is_active" = true;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_invoices_transaction_idx" ON "payment_invoices" USING btree ("transaction_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "payment_provider_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "invoice_id" uuid REFERENCES "payment_invoices"("id") ON DELETE set null,
  "provider" text NOT NULL,
  "provider_event_id" text NOT NULL,
  "payload_hash" text NOT NULL,
  "event_occurred_at" timestamp with time zone,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL,
  "provider_order_id" text NOT NULL,
  "amount" integer,
  "provider_status" text,
  "fraud_status" text,
  "signature_valid" boolean,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_provider_events_provider_event_unique" ON "payment_provider_events" USING btree ("provider", "provider_event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_provider_events_order_idx" ON "payment_provider_events" USING btree ("provider", "provider_order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_provider_events_invoice_idx" ON "payment_provider_events" USING btree ("invoice_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "payment_reconciliations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "transaction_id" uuid NOT NULL REFERENCES "transactions"("id") ON DELETE cascade,
  "invoice_id" uuid REFERENCES "payment_invoices"("id") ON DELETE set null,
  "decision" text NOT NULL,
  "provider_status_reference" text,
  "deadline_at" timestamp with time zone NOT NULL,
  "result" text NOT NULL,
  "evidence_reference" text,
  "reconciled_by_account_id" uuid REFERENCES "accounts"("id"),
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_reconciliations_transaction_idx" ON "payment_reconciliations" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_reconciliations_invoice_idx" ON "payment_reconciliations" USING btree ("invoice_id");--> statement-breakpoint

ALTER TABLE "idempotency_keys" ADD COLUMN IF NOT EXISTS "actor_scope" text;--> statement-breakpoint
UPDATE "idempotency_keys"
SET "actor_scope" = CASE
  WHEN "actor_account_id" IS NOT NULL THEN 'ACCOUNT:' || "actor_account_id"::text
  ELSE 'SYSTEM:legacy-' || "id"::text
END
WHERE "actor_scope" IS NULL;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ALTER COLUMN "actor_scope" SET NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "idempotency_actor_command_key_unique";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idempotency_actor_scope_command_key_unique" ON "idempotency_keys" USING btree ("actor_scope", "command", "key");--> statement-breakpoint

ALTER TABLE "transactions" ADD CONSTRAINT "transactions_creator_role_participant" CHECK ("creator_role" IN ('BUYER', 'SELLER'));--> statement-breakpoint
ALTER TABLE "transaction_participants" ADD CONSTRAINT "transaction_participants_role_participant" CHECK ("role" IN ('BUYER', 'SELLER'));--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cancellation_requests_one_active_idx" ON "cancellation_requests" USING btree ("transaction_id") WHERE "status" = 'ACTIVE';--> statement-breakpoint

CREATE OR REPLACE FUNCTION "bayaraman_audit_events_insert_only"()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events are append-only';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS "audit_events_insert_only" ON "audit_events";--> statement-breakpoint
CREATE TRIGGER "audit_events_insert_only"
BEFORE UPDATE OR DELETE ON "audit_events"
FOR EACH ROW EXECUTE FUNCTION "bayaraman_audit_events_insert_only"();--> statement-breakpoint

CREATE OR REPLACE FUNCTION "bayaraman_protect_successful_financial_operation"()
RETURNS trigger AS $$
BEGIN
  IF OLD."result" = 'SUCCESS' THEN
    RAISE EXCEPTION 'successful financial operations are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS "financial_operations_success_immutable" ON "financial_operations";--> statement-breakpoint
CREATE TRIGGER "financial_operations_success_immutable"
BEFORE UPDATE OR DELETE ON "financial_operations"
FOR EACH ROW EXECUTE FUNCTION "bayaraman_protect_successful_financial_operation"();
