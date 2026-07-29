-- BAYAR-004: immutable Midtrans invoice identity and idempotency boundary.
-- Existing rows receive a deterministic compatibility reference before NOT NULL.
ALTER TABLE payment_invoices
  ADD COLUMN IF NOT EXISTS idempotency_reference text;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM payment_invoices
    WHERE idempotency_reference IS NULL
  ) THEN
    UPDATE payment_invoices
    SET idempotency_reference = 'PAYMENT_INVOICE_CREATE:LEGACY:' || id::text
    WHERE idempotency_reference IS NULL;
  END IF;

  IF EXISTS (
    SELECT idempotency_reference
    FROM payment_invoices
    GROUP BY idempotency_reference
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot create payment invoice idempotency index: duplicate references exist';
  END IF;
END $$;
--> statement-breakpoint
UPDATE payment_invoices
SET idempotency_reference = 'PAYMENT_INVOICE_CREATE:LEGACY:' || id::text
WHERE idempotency_reference IS NULL;
--> statement-breakpoint
ALTER TABLE payment_invoices
  ALTER COLUMN idempotency_reference SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS payment_invoices_idempotency_reference_unique
  ON payment_invoices (idempotency_reference);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION bayaraman_payment_invoice_immutable_fields()
RETURNS trigger AS $$
BEGIN
  IF OLD.transaction_id IS DISTINCT FROM NEW.transaction_id
    OR OLD.provider IS DISTINCT FROM NEW.provider
    OR OLD.provider_invoice_id IS DISTINCT FROM NEW.provider_invoice_id
    OR OLD.provider_order_id IS DISTINCT FROM NEW.provider_order_id
    OR OLD.hosted_payment_url IS DISTINCT FROM NEW.hosted_payment_url
    OR OLD.amount IS DISTINCT FROM NEW.amount
    OR OLD.currency IS DISTINCT FROM NEW.currency
    OR OLD.issued_at IS DISTINCT FROM NEW.issued_at
    OR OLD.deadline_at IS DISTINCT FROM NEW.deadline_at
    OR OLD.due_date_at IS DISTINCT FROM NEW.due_date_at
    OR OLD.idempotency_reference IS DISTINCT FROM NEW.idempotency_reference
  THEN
    RAISE EXCEPTION 'issued payment invoice identity is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS payment_invoices_immutable_fields ON payment_invoices;
--> statement-breakpoint
CREATE TRIGGER payment_invoices_immutable_fields
BEFORE UPDATE ON payment_invoices
FOR EACH ROW
WHEN (OLD.issued_at IS NOT NULL)
EXECUTE FUNCTION bayaraman_payment_invoice_immutable_fields();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION bayaraman_payment_invoice_no_delete()
RETURNS trigger AS $$
BEGIN
  IF OLD.issued_at IS NOT NULL THEN
    RAISE EXCEPTION 'issued payment invoices cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS payment_invoices_no_delete ON payment_invoices;
--> statement-breakpoint
CREATE TRIGGER payment_invoices_no_delete
BEFORE DELETE ON payment_invoices
FOR EACH ROW
EXECUTE FUNCTION bayaraman_payment_invoice_no_delete();
