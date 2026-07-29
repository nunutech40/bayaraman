DO $$
BEGIN
  IF EXISTS (
    SELECT transaction_id, target_role
    FROM invitations
    WHERE revoked_at IS NULL AND used_at IS NULL
    GROUP BY transaction_id, target_role
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot create active invitation index: duplicate active invitations exist';
  END IF;
END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX "invitations_one_active_target_idx"
  ON "invitations" ("transaction_id", "target_role")
  WHERE "revoked_at" IS NULL AND "used_at" IS NULL;
