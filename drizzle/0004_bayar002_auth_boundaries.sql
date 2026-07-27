DO $$
BEGIN
  IF EXISTS (
    SELECT lower(email)
    FROM accounts
    GROUP BY lower(email)
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot create normalized email uniqueness index: duplicate lower(email) values exist';
  END IF;
END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "accounts_email_normalized_unique"
  ON "accounts" (lower("email"));
--> statement-breakpoint

ALTER TABLE "account_whatsapp_verifications"
  ADD COLUMN IF NOT EXISTS "superseded_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "account_whatsapp_verifications"
  ADD COLUMN IF NOT EXISTS "delivery_result" text NOT NULL DEFAULT 'PENDING';
--> statement-breakpoint
ALTER TABLE "account_whatsapp_verifications"
  ADD COLUMN IF NOT EXISTS "delivery_attempted_at" timestamp with time zone;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'account_whatsapp_verification_delivery_result_check'
  ) THEN
    ALTER TABLE "account_whatsapp_verifications"
      ADD CONSTRAINT "account_whatsapp_verification_delivery_result_check"
      CHECK ("delivery_result" IN ('PENDING', 'SENT', 'FAILED', 'UNKNOWN'));
  END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT account_id
    FROM account_whatsapp_verifications
    WHERE verified_at IS NULL AND superseded_at IS NULL
    GROUP BY account_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot create active WhatsApp challenge index: duplicate active challenges exist';
  END IF;
END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "account_whatsapp_verifications_one_active_idx"
  ON "account_whatsapp_verifications" ("account_id")
  WHERE "verified_at" IS NULL AND "superseded_at" IS NULL;
