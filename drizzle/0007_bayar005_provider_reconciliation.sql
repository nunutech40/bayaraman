BEGIN;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM payment_reconciliations
    WHERE completed_at IS NULL
    GROUP BY transaction_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot create active reconciliation index: duplicate active rows exist';
  END IF;

  IF EXISTS (
    SELECT 1 FROM payment_provider_events e
    LEFT JOIN payment_invoices i ON i.id = e.invoice_id
    WHERE e.provider IS NULL
      OR e.provider_event_id IS NULL
      OR e.provider_order_id IS NULL
      OR (e.invoice_id IS NOT NULL AND i.id IS NULL)
  ) THEN
    RAISE EXCEPTION 'Cannot add provider reconciliation boundary: invalid provider event references exist';
  END IF;

  IF EXISTS (
    SELECT 1 FROM payment_reconciliations
    WHERE decision NOT IN ('PROVIDER_STATUS_REVIEW', 'LATE_FUND_HANDOFF', 'CONTROLLED_EXCEPTION_HANDOFF')
  ) THEN
    RAISE EXCEPTION 'Legacy reconciliation decision values require review before BAYAR-005 migration';
  END IF;

END $$;
--> statement-breakpoint
ALTER TABLE payment_provider_events
  ADD COLUMN IF NOT EXISTS validation_outcome text NOT NULL DEFAULT 'LEGACY_UNASSESSED';
--> statement-breakpoint
ALTER TABLE payment_provider_events
  ADD COLUMN IF NOT EXISTS currency text;
--> statement-breakpoint
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_attribute attr ON attr.attrelid = rel.oid AND attr.attnum = ANY(con.conkey)
  WHERE rel.relname = 'payment_provider_events'
    AND con.contype = 'f'
    AND attr.attname = 'invoice_id'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE payment_provider_events DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE payment_provider_events
  ADD CONSTRAINT payment_provider_events_invoice_fk
  FOREIGN KEY (invoice_id) REFERENCES payment_invoices(id) ON DELETE RESTRICT;
ALTER TABLE payment_reconciliations
  ADD COLUMN IF NOT EXISTS decision_code text;
--> statement-breakpoint
ALTER TABLE payment_invoices
  ADD COLUMN IF NOT EXISTS authoritative_provider_event_id uuid;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM payment_invoices i
    JOIN payment_provider_events e ON e.id = i.authoritative_provider_event_id
    WHERE e.invoice_id IS DISTINCT FROM i.id
       OR e.provider IS DISTINCT FROM i.provider
       OR e.validation_outcome <> 'ACCEPTED'
       OR lower(coalesce(e.provider_status, '')) <> 'settlement'
       OR lower(coalesce(e.fraud_status, '')) <> 'accept'
       OR e.amount IS DISTINCT FROM i.amount
       OR e.currency IS DISTINCT FROM i.currency
  ) THEN
    RAISE EXCEPTION 'Cannot create authority pointer boundary: inconsistent existing authority references exist';
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT authoritative_provider_event_id
    FROM payment_invoices
    WHERE authoritative_provider_event_id IS NOT NULL
    GROUP BY authoritative_provider_event_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot create authority pointer index: duplicate pointers exist';
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS payment_reconciliation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  reconciliation_id uuid NOT NULL REFERENCES payment_reconciliations(id) ON DELETE RESTRICT,
  provider_event_id uuid NOT NULL REFERENCES payment_provider_events(id) ON DELETE RESTRICT,
  relation_type text NOT NULL,
  incoming_payload_hash text NOT NULL,
  sanitized_reason text NOT NULL,
  correlation_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE payment_invoices
  ADD CONSTRAINT payment_invoices_authoritative_event_fk
  FOREIGN KEY (authoritative_provider_event_id)
  REFERENCES payment_provider_events(id) ON DELETE RESTRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS payment_invoices_authoritative_event_unique
  ON payment_invoices (authoritative_provider_event_id)
  WHERE authoritative_provider_event_id IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS payment_reconciliation_events_identity_unique
  ON payment_reconciliation_events (reconciliation_id, provider_event_id, relation_type, incoming_payload_hash);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS payment_reconciliations_one_active_transaction_idx
  ON payment_reconciliations (transaction_id)
  WHERE completed_at IS NULL;
--> statement-breakpoint
ALTER TABLE payment_provider_events
  ADD CONSTRAINT payment_provider_events_validation_outcome_check
  CHECK (validation_outcome IN (
    'LEGACY_UNASSESSED', 'ACCEPTED', 'NON_AUTHORITATIVE',
    'INVALID_SIGNATURE', 'UNKNOWN_ORDER', 'IDENTITY_MISMATCH',
    'AMOUNT_MISMATCH', 'CURRENCY_MISMATCH', 'FRAUD_MISMATCH',
    'CONFLICT', 'UNKNOWN'
  ));
--> statement-breakpoint
ALTER TABLE payment_reconciliation_events
  ADD CONSTRAINT payment_reconciliation_events_relation_type_check
  CHECK (relation_type IN (
    'PRIMARY_EVENT', 'CONFLICT_EVENT', 'OUT_OF_ORDER_EVENT',
    'UNKNOWN_EVENT', 'LATE_EVENT'
  ));
--> statement-breakpoint
ALTER TABLE payment_reconciliations
  ADD CONSTRAINT payment_reconciliations_decision_code_check
  CHECK (decision_code IS NULL OR decision_code IN (
    'PROVIDER_STATUS_REVIEW', 'LATE_FUND_HANDOFF',
    'CONTROLLED_EXCEPTION_HANDOFF'
  ));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION bayaraman_provider_events_insert_only()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'payment_provider_events are append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS payment_provider_events_insert_only ON payment_provider_events;
--> statement-breakpoint
CREATE TRIGGER payment_provider_events_insert_only
BEFORE UPDATE OR DELETE ON payment_provider_events
FOR EACH ROW EXECUTE FUNCTION bayaraman_provider_events_insert_only();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION bayaraman_reconciliation_events_insert_only()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'payment_reconciliation_events are append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS payment_reconciliation_events_insert_only ON payment_reconciliation_events;
--> statement-breakpoint
CREATE TRIGGER payment_reconciliation_events_insert_only
BEFORE UPDATE OR DELETE ON payment_reconciliation_events
FOR EACH ROW EXECUTE FUNCTION bayaraman_reconciliation_events_insert_only();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION bayaraman_payment_invoice_authority_pointer_once()
RETURNS trigger AS $$
DECLARE
  event_record record;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.authoritative_provider_event_id IS NOT NULL
     AND OLD.authoritative_provider_event_id IS DISTINCT FROM NEW.authoritative_provider_event_id THEN
    RAISE EXCEPTION 'authoritative provider event pointer is immutable';
  END IF;

  IF OLD.authoritative_provider_event_id IS NULL
     AND NEW.authoritative_provider_event_id IS NOT NULL THEN
    SELECT e.invoice_id, e.provider, e.validation_outcome,
           e.provider_status, e.fraud_status, e.amount, e.currency
    INTO event_record
    FROM payment_provider_events e
    WHERE e.id = NEW.authoritative_provider_event_id;

    IF event_record.invoice_id IS DISTINCT FROM NEW.id
       OR event_record.provider IS DISTINCT FROM NEW.provider
       OR event_record.validation_outcome <> 'ACCEPTED'
       OR lower(coalesce(event_record.provider_status, '')) <> 'settlement'
       OR lower(coalesce(event_record.fraud_status, '')) <> 'accept'
       OR event_record.amount IS DISTINCT FROM NEW.amount
       OR event_record.currency IS DISTINCT FROM NEW.currency THEN
      RAISE EXCEPTION 'invalid authoritative provider event pointer';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS payment_invoices_authority_pointer_once ON payment_invoices;
--> statement-breakpoint
CREATE TRIGGER payment_invoices_authority_pointer_once
BEFORE INSERT OR UPDATE ON payment_invoices
FOR EACH ROW EXECUTE FUNCTION bayaraman_payment_invoice_authority_pointer_once();
--> statement-breakpoint
COMMIT;
