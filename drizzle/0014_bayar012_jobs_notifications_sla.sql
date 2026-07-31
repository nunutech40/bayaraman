BEGIN;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM audit_events
    WHERE actor_account_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM accounts WHERE accounts.id = audit_events.actor_account_id
      )
  ) THEN
    RAISE EXCEPTION 'BAYAR-012 preflight: invalid audit actor reference';
  END IF;
  IF EXISTS (
    SELECT 1 FROM payment_reconciliations
    WHERE result NOT IN ('SUCCESS', 'UNKNOWN')
  ) THEN
    RAISE EXCEPTION 'BAYAR-012 preflight: unsupported payment reconciliation result';
  END IF;
  IF EXISTS (
    SELECT 1 FROM admin_task_assignments
    WHERE task_scope NOT IN (
      'COMPLAINT_INTAKE', 'COMPLAINT_APPROVAL',
      'RISK_INTAKE', 'RISK_APPROVAL', 'RELEASE_GATE_REVIEW',
      'CANCELLATION_RECONCILIATION', 'CANCELLATION_EVIDENCE',
      'CANCELLATION_APPROVAL', 'FINANCIAL_PREPARE',
      'FINANCIAL_APPROVE', 'FINANCIAL_EXECUTE', 'FINANCIAL_RECONCILE'
    )
  ) THEN
    RAISE EXCEPTION 'BAYAR-012 preflight: unsupported Admin task assignment';
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  correlation_id uuid NOT NULL,
  status text DEFAULT 'RUNNING' NOT NULL,
  run_version integer DEFAULT 0 NOT NULL,
  attempt_count integer DEFAULT 1 NOT NULL,
  scheduled_for timestamp with time zone NOT NULL,
  lease_owner_hash text,
  lease_expires_at timestamp with time zone,
  result jsonb,
  error_category text,
  started_at timestamp with time zone NOT NULL,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT job_runs_name_check CHECK (
    job_name IN (
      'payment-expiry', 'confirmation-reminder', 'confirmation-overdue',
      'payment-reconciliation-sla', 'cancellation-reconciliation-timeout',
      'cancellation-response-timeout', 'financial-sla-escalation',
      'notification-delivery'
    )
  ),
  CONSTRAINT job_runs_status_check CHECK (status IN ('RUNNING', 'SUCCESS', 'FAILED')),
  CONSTRAINT job_runs_version_attempt_check CHECK (run_version >= 0 AND attempt_count > 0),
  CONSTRAINT job_runs_lifecycle_check CHECK (
    (status = 'RUNNING' AND completed_at IS NULL
      AND lease_owner_hash IS NOT NULL AND lease_expires_at IS NOT NULL)
    OR
    (status IN ('SUCCESS', 'FAILED') AND completed_at IS NOT NULL
      AND lease_owner_hash IS NULL AND lease_expires_at IS NULL)
  )
);
CREATE UNIQUE INDEX job_runs_name_idempotency_unique
  ON job_runs(job_name, idempotency_key);
CREATE UNIQUE INDEX job_runs_correlation_unique ON job_runs(correlation_id);
CREATE INDEX job_runs_recovery_idx ON job_runs(status, lease_expires_at);
--> statement-breakpoint
CREATE TABLE job_run_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_run_id uuid NOT NULL REFERENCES job_runs(id) ON DELETE RESTRICT,
  attempt_number integer NOT NULL,
  result text NOT NULL,
  started_at timestamp with time zone NOT NULL,
  completed_at timestamp with time zone NOT NULL,
  lease_owner_hash text NOT NULL,
  error_category text,
  correlation_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT job_run_attempts_number_check CHECK (attempt_number > 0),
  CONSTRAINT job_run_attempts_result_check CHECK (result IN ('SUCCESS', 'FAILED', 'UNKNOWN'))
);
CREATE UNIQUE INDEX job_run_attempts_number_unique
  ON job_run_attempts(job_run_id, attempt_number);
--> statement-breakpoint
CREATE TABLE sla_trackers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
  sla_type text NOT NULL,
  source_type text NOT NULL,
  source_id text NOT NULL,
  source_timestamp_kind text DEFAULT 'CANONICAL' NOT NULL,
  started_at timestamp with time zone NOT NULL,
  target_at timestamp with time zone NOT NULL,
  handled_at timestamp with time zone,
  next_escalation_at timestamp with time zone NOT NULL,
  escalation_count integer DEFAULT 0 NOT NULL,
  last_escalated_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT sla_trackers_type_check CHECK (
    sla_type IN (
      'PAYMENT_RECONCILIATION', 'CONFIRMATION_REMINDER',
      'CONFIRMATION_OVERDUE', 'CANCELLATION_RECONCILIATION',
      'CANCELLATION_RESPONSE', 'PAYOUT', 'REFUND', 'SPLIT'
    )
  ),
  CONSTRAINT sla_trackers_timestamp_kind_check
    CHECK (source_timestamp_kind IN ('CANONICAL', 'LEGACY_FALLBACK')),
  CONSTRAINT sla_trackers_time_check
    CHECK (target_at >= started_at AND next_escalation_at >= target_at AND escalation_count >= 0)
);
CREATE UNIQUE INDEX sla_trackers_source_unique
  ON sla_trackers(sla_type, source_type, source_id);
CREATE INDEX sla_trackers_due_idx
  ON sla_trackers(handled_at, next_escalation_at);
--> statement-breakpoint
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
  notification_type text NOT NULL,
  source_type text NOT NULL,
  source_id text NOT NULL,
  recipient_scope text NOT NULL,
  recipient_account_id uuid REFERENCES accounts(id) ON DELETE RESTRICT,
  channel text NOT NULL,
  occurrence_key text NOT NULL,
  payload_snapshot_hash text NOT NULL,
  status text DEFAULT 'PENDING' NOT NULL,
  attempt_count integer DEFAULT 0 NOT NULL,
  next_attempt_at timestamp with time zone,
  last_attempt_at timestamp with time zone,
  active_attempt_number integer,
  lease_owner_hash text,
  lease_expires_at timestamp with time zone,
  notification_version integer DEFAULT 0 NOT NULL,
  sent_at timestamp with time zone,
  final_failure_at timestamp with time zone,
  correlation_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT notifications_channel_check CHECK (channel IN ('IN_APP', 'WHATSAPP')),
  CONSTRAINT notifications_status_check CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'UNKNOWN')),
  CONSTRAINT notifications_attempt_check
    CHECK (attempt_count >= 0 AND attempt_count <= 3 AND notification_version >= 0),
  CONSTRAINT notifications_occurrence_check CHECK (
    occurrence_key = 'ONCE'
    OR occurrence_key ~ '^ESCALATION:[1-9][0-9]*$'
  ),
  CONSTRAINT notifications_recipient_check CHECK (
    (recipient_scope LIKE 'ACCOUNT:%' AND recipient_account_id IS NOT NULL)
    OR
    (recipient_scope = 'ADMIN:SLA_NOTIFICATION_REVIEW' AND recipient_account_id IS NULL)
  ),
  CONSTRAINT notifications_lease_check CHECK (
    (active_attempt_number IS NULL AND lease_owner_hash IS NULL AND lease_expires_at IS NULL)
    OR
    (channel = 'WHATSAPP' AND active_attempt_number IS NOT NULL
      AND lease_owner_hash IS NOT NULL AND lease_expires_at IS NOT NULL)
  ),
  CONSTRAINT notifications_sent_check
    CHECK (status <> 'SENT' OR (sent_at IS NOT NULL AND final_failure_at IS NULL)),
  CONSTRAINT notifications_final_failure_check
    CHECK (final_failure_at IS NULL OR (attempt_count = 3 AND status <> 'SENT'))
);
CREATE UNIQUE INDEX notifications_occurrence_unique
  ON notifications(
    notification_type, source_type, source_id, recipient_scope,
    channel, occurrence_key
  );
CREATE INDEX notifications_delivery_due_idx
  ON notifications(channel, status, next_attempt_at);
CREATE INDEX notifications_transaction_idx ON notifications(transaction_id);
--> statement-breakpoint
CREATE TABLE notification_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE RESTRICT,
  attempt_number integer,
  event_type text NOT NULL,
  result text,
  provider_reference text,
  error_category text,
  corrected_attempt_id uuid REFERENCES notification_attempts(id) ON DELETE RESTRICT,
  correction_reason text,
  correlation_id uuid NOT NULL,
  attempted_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT notification_attempts_event_type_check
    CHECK (event_type IN ('DELIVERY_RESULT', 'CORRECTION')),
  CONSTRAINT notification_attempts_result_check
    CHECK (result IS NULL OR result IN ('SENT', 'FAILED', 'UNKNOWN')),
  CONSTRAINT notification_attempts_shape_check CHECK (
    (
      event_type = 'DELIVERY_RESULT'
      AND attempt_number > 0
      AND result IS NOT NULL
      AND corrected_attempt_id IS NULL
      AND correction_reason IS NULL
    )
    OR
    (
      event_type = 'CORRECTION'
      AND attempt_number IS NULL
      AND result IS NULL
      AND corrected_attempt_id IS NOT NULL
      AND NULLIF(BTRIM(correction_reason), '') IS NOT NULL
    )
  )
);
CREATE UNIQUE INDEX notification_attempts_delivery_unique
  ON notification_attempts(notification_id, attempt_number)
  WHERE event_type = 'DELIVERY_RESULT';
--> statement-breakpoint
ALTER TABLE confirmation_links
  ADD COLUMN reminder_queued_at timestamp with time zone;
--> statement-breakpoint
ALTER TABLE audit_events ADD COLUMN actor_scope text;
ALTER TABLE audit_events DISABLE TRIGGER audit_events_insert_only;
UPDATE audit_events
SET actor_scope = CASE
  WHEN actor_account_id IS NOT NULL THEN 'ACCOUNT:' || actor_account_id::text
  ELSE 'SYSTEM:legacy-' || id::text
END;
ALTER TABLE audit_events ENABLE TRIGGER audit_events_insert_only;
ALTER TABLE audit_events
  ALTER COLUMN actor_scope SET NOT NULL,
  ADD CONSTRAINT audit_events_actor_scope_check CHECK (
    (actor_account_id IS NOT NULL AND actor_scope = 'ACCOUNT:' || actor_account_id::text)
    OR
    (actor_account_id IS NULL AND actor_scope LIKE 'SYSTEM:%')
  );
--> statement-breakpoint
ALTER TABLE payment_reconciliations
  ADD CONSTRAINT payment_reconciliations_result_check
  CHECK (result IN ('SUCCESS', 'UNKNOWN'));
--> statement-breakpoint
ALTER TABLE admin_task_assignments
  DROP CONSTRAINT admin_task_assignments_scope_check;
ALTER TABLE admin_task_assignments
  ADD CONSTRAINT admin_task_assignments_scope_check
  CHECK (task_scope IN (
    'COMPLAINT_INTAKE', 'COMPLAINT_APPROVAL',
    'RISK_INTAKE', 'RISK_APPROVAL', 'RELEASE_GATE_REVIEW',
    'CANCELLATION_RECONCILIATION', 'CANCELLATION_EVIDENCE',
    'CANCELLATION_APPROVAL', 'FINANCIAL_PREPARE',
    'FINANCIAL_APPROVE', 'FINANCIAL_EXECUTE', 'FINANCIAL_RECONCILE',
    'SLA_NOTIFICATION_REVIEW'
  ));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION bayaraman_bayar012_insert_only()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER job_run_attempts_insert_only
  BEFORE UPDATE OR DELETE ON job_run_attempts
  FOR EACH ROW EXECUTE FUNCTION bayaraman_bayar012_insert_only();
CREATE TRIGGER notification_attempts_insert_only
  BEFORE UPDATE OR DELETE ON notification_attempts
  FOR EACH ROW EXECUTE FUNCTION bayaraman_bayar012_insert_only();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION bayaraman_job_run_terminal_guard()
RETURNS trigger AS $$
BEGIN
  IF OLD.status IN ('SUCCESS', 'FAILED') AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'terminal job run is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER job_runs_terminal_guard
  BEFORE UPDATE ON job_runs
  FOR EACH ROW EXECUTE FUNCTION bayaraman_job_run_terminal_guard();
--> statement-breakpoint
COMMIT;
