BEGIN;
--> statement-breakpoint
ALTER TABLE confirmation_otps ADD COLUMN IF NOT EXISTS superseded_at timestamp with time zone;
ALTER TABLE confirmation_otps ADD COLUMN IF NOT EXISTS verified_at timestamp with time zone;
ALTER TABLE confirmation_otps ADD COLUMN IF NOT EXISTS delivery_result text NOT NULL DEFAULT 'PENDING';
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT transaction_id FROM confirmation_links
    GROUP BY transaction_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot create one confirmation link per transaction: duplicate links exist';
  END IF;
  IF EXISTS (
    SELECT confirmation_link_id FROM confirmation_otps
    WHERE verified_at IS NULL AND superseded_at IS NULL
    GROUP BY confirmation_link_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot create active OTP index: multiple active challenges exist';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE confirmation_links ADD COLUMN IF NOT EXISTS buyer_account_id uuid;
ALTER TABLE confirmation_links ADD COLUMN IF NOT EXISTS reminder_due_at timestamp with time zone;
ALTER TABLE confirmation_links ADD COLUMN IF NOT EXISTS reminder_recorded_at timestamp with time zone;
ALTER TABLE confirmation_links ADD COLUMN IF NOT EXISTS reminder_recorded_by_account_id uuid;
ALTER TABLE confirmation_links ADD COLUMN IF NOT EXISTS reminder_evidence_reference text;
ALTER TABLE confirmation_links ADD COLUMN IF NOT EXISTS overdue_at timestamp with time zone;
ALTER TABLE confirmation_links ADD COLUMN IF NOT EXISTS idempotency_key text;
--> statement-breakpoint
UPDATE confirmation_links cl
SET buyer_account_id = p.account_id
FROM transaction_participants p
WHERE p.transaction_id = cl.transaction_id
  AND p.role = 'BUYER'
  AND cl.buyer_account_id IS NULL;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM confirmation_links WHERE buyer_account_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot backfill Buyer binding for confirmation links';
  END IF;
END $$;
--> statement-breakpoint
UPDATE confirmation_links
SET reminder_due_at = created_at + interval '1 day'
WHERE reminder_due_at IS NULL;
UPDATE confirmation_links
SET idempotency_key = 'LEGACY:CONFIRMATION_LINK:' || id::text
WHERE idempotency_key IS NULL;
ALTER TABLE confirmation_links ALTER COLUMN buyer_account_id SET NOT NULL;
ALTER TABLE confirmation_links ALTER COLUMN reminder_due_at SET NOT NULL;
ALTER TABLE confirmation_links ALTER COLUMN idempotency_key SET NOT NULL;
--> statement-breakpoint
ALTER TABLE confirmation_otps ADD COLUMN IF NOT EXISTS last_requested_at timestamp with time zone;
ALTER TABLE confirmation_otps ADD COLUMN IF NOT EXISTS send_window_started_at timestamp with time zone;
ALTER TABLE confirmation_otps ADD COLUMN IF NOT EXISTS send_count integer NOT NULL DEFAULT 0;
ALTER TABLE confirmation_otps ADD COLUMN IF NOT EXISTS cooldown_until timestamp with time zone;
ALTER TABLE confirmation_otps ADD COLUMN IF NOT EXISTS locked_until timestamp with time zone;
ALTER TABLE confirmation_otps ADD COLUMN IF NOT EXISTS idempotency_key text;
UPDATE confirmation_otps
SET idempotency_key = 'LEGACY:CONFIRMATION_OTP:' || id::text
WHERE idempotency_key IS NULL;
ALTER TABLE confirmation_otps ALTER COLUMN idempotency_key SET NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS confirmation_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  buyer_completion_checkpoint_id uuid NOT NULL REFERENCES whatsapp_checkpoints(id) ON DELETE RESTRICT,
  reason text NOT NULL,
  evidence_reference text NOT NULL,
  first_approved_by_admin_id uuid NOT NULL REFERENCES accounts(id),
  first_approved_at timestamp with time zone DEFAULT now() NOT NULL,
  second_approved_by_admin_id uuid REFERENCES accounts(id),
  second_approved_at timestamp with time zone,
  decision text DEFAULT 'PENDING_APPROVAL' NOT NULL,
  idempotency_key text NOT NULL,
  expected_state_version integer NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE confirmation_links
  ADD CONSTRAINT confirmation_links_buyer_participant_fk
  FOREIGN KEY (transaction_id, buyer_account_id)
  REFERENCES transaction_participants(transaction_id, account_id);
ALTER TABLE confirmation_links
  ADD CONSTRAINT confirmation_links_idempotency_unique UNIQUE (transaction_id, idempotency_key);
ALTER TABLE confirmation_otps
  ADD CONSTRAINT confirmation_otps_attempts_check CHECK (attempts >= 0 AND attempts <= 5);
ALTER TABLE confirmation_otps
  ADD CONSTRAINT confirmation_otps_send_count_check CHECK (send_count >= 0 AND send_count <= 3);
ALTER TABLE confirmation_otps
  ADD CONSTRAINT confirmation_otps_delivery_result_check CHECK (delivery_result IN ('PENDING', 'SENT', 'FAILED', 'UNKNOWN'));
ALTER TABLE confirmation_exceptions
  ADD CONSTRAINT confirmation_exceptions_decision_check CHECK (decision IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED'));
ALTER TABLE confirmation_exceptions
  ADD CONSTRAINT confirmation_exceptions_distinct_admin_check CHECK (second_approved_by_admin_id IS NULL OR second_approved_by_admin_id <> first_approved_by_admin_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS confirmation_links_one_transaction_unique ON confirmation_links(transaction_id);
CREATE UNIQUE INDEX IF NOT EXISTS confirmation_otps_one_active_link_unique
  ON confirmation_otps(confirmation_link_id)
  WHERE superseded_at IS NULL AND verified_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS confirmation_otps_idempotency_unique
  ON confirmation_otps(confirmation_link_id, idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS confirmation_exceptions_one_pending_transaction_unique
  ON confirmation_exceptions(transaction_id)
  WHERE decision = 'PENDING_APPROVAL';
CREATE UNIQUE INDEX IF NOT EXISTS confirmation_exceptions_idempotency_unique
  ON confirmation_exceptions(transaction_id, idempotency_key);
CREATE INDEX IF NOT EXISTS confirmation_exceptions_transaction_idx ON confirmation_exceptions(transaction_id);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION bayaraman_confirmation_link_used_at_immutable()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'consumed confirmation link is immutable';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.used_at IS NOT NULL AND NEW.used_at IS DISTINCT FROM OLD.used_at THEN
    RAISE EXCEPTION 'confirmation link used_at is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS confirmation_links_used_at_immutable_trigger ON confirmation_links;
CREATE TRIGGER confirmation_links_used_at_immutable_trigger
BEFORE UPDATE OR DELETE ON confirmation_links
FOR EACH ROW EXECUTE FUNCTION bayaraman_confirmation_link_used_at_immutable();
--> statement-breakpoint
COMMIT;
