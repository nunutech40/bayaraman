BEGIN;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT transaction_id FROM whatsapp_groups
    GROUP BY transaction_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot create canonical WhatsApp group index: duplicate groups exist';
  END IF;
  IF EXISTS (
    SELECT transaction_id, checkpoint_type FROM whatsapp_checkpoints
    WHERE checkpoint_type NOT IN ('PAYMENT_ANNOUNCED', 'SELLER_SHIPMENT', 'SELLER_COMPLETION', 'BUYER_COMPLETION')
    GROUP BY transaction_id, checkpoint_type
  ) THEN
    RAISE EXCEPTION 'Cannot create WhatsApp checkpoint boundary: invalid checkpoint types exist';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE whatsapp_checkpoints ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE whatsapp_checkpoints ADD COLUMN IF NOT EXISTS delivery_result text NOT NULL DEFAULT 'PENDING';
ALTER TABLE whatsapp_checkpoints ADD COLUMN IF NOT EXISTS corrected_checkpoint_id uuid;
ALTER TABLE whatsapp_checkpoints ADD COLUMN IF NOT EXISTS correction_reason text;
--> statement-breakpoint
UPDATE whatsapp_checkpoints
SET idempotency_key = 'LEGACY:' || id::text
WHERE idempotency_key IS NULL;
--> statement-breakpoint
ALTER TABLE whatsapp_checkpoints ALTER COLUMN idempotency_key SET NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS whatsapp_checkpoint_heads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  checkpoint_type text NOT NULL,
  current_checkpoint_id uuid NOT NULL REFERENCES whatsapp_checkpoints(id) ON DELETE RESTRICT,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE whatsapp_checkpoints
  ADD CONSTRAINT whatsapp_checkpoints_corrected_checkpoint_fk
  FOREIGN KEY (corrected_checkpoint_id) REFERENCES whatsapp_checkpoints(id) ON DELETE RESTRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_groups_one_canonical_per_transaction_idx ON whatsapp_groups(transaction_id);
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_checkpoints_transaction_idempotency_unique ON whatsapp_checkpoints(transaction_id, idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_checkpoint_heads_transaction_type_unique ON whatsapp_checkpoint_heads(transaction_id, checkpoint_type);
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_checkpoint_heads_current_event_unique ON whatsapp_checkpoint_heads(current_checkpoint_id);
--> statement-breakpoint
ALTER TABLE whatsapp_checkpoints
  ADD CONSTRAINT whatsapp_checkpoints_type_check
  CHECK (checkpoint_type IN ('PAYMENT_ANNOUNCED', 'SELLER_SHIPMENT', 'SELLER_COMPLETION', 'BUYER_COMPLETION'));
ALTER TABLE whatsapp_checkpoints
  ADD CONSTRAINT whatsapp_checkpoints_delivery_result_check
  CHECK (delivery_result IN ('PENDING', 'SENT', 'FAILED', 'UNKNOWN'));
ALTER TABLE whatsapp_checkpoints
  ADD CONSTRAINT whatsapp_checkpoints_correction_reason_check
  CHECK (corrected_checkpoint_id IS NULL OR correction_reason IS NOT NULL);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION bayaraman_whatsapp_checkpoint_insert_only()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'whatsapp_checkpoints are append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS whatsapp_checkpoints_insert_only ON whatsapp_checkpoints;
CREATE TRIGGER whatsapp_checkpoints_insert_only
BEFORE UPDATE OR DELETE ON whatsapp_checkpoints
FOR EACH ROW EXECUTE FUNCTION bayaraman_whatsapp_checkpoint_insert_only();
--> statement-breakpoint
COMMIT;
