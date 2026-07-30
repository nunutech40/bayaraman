BEGIN;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM financial_operations
    WHERE result = 'SUCCESS'
      AND (NULLIF(BTRIM(bank_reference), '') IS NULL)
  ) THEN
    RAISE EXCEPTION 'BAYAR-008 preflight: successful legacy operation lacks reference';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM financial_operations
    WHERE result IN ('PROCESSING', 'UNKNOWN')
    GROUP BY transaction_id, type
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'BAYAR-008 preflight: duplicate active financial operations';
  END IF;
END $$;
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
    'FINANCIAL_APPROVE', 'FINANCIAL_EXECUTE', 'FINANCIAL_RECONCILE'
  ));
--> statement-breakpoint
ALTER TABLE financial_operations
  ALTER COLUMN result DROP DEFAULT,
  ALTER COLUMN result DROP NOT NULL,
  ADD COLUMN evidence_hash text,
  ADD COLUMN route text,
  ADD COLUMN prepared_at timestamp with time zone,
  ADD COLUMN started_at timestamp with time zone,
  ADD COLUMN retry_of_operation_id uuid,
  ADD COLUMN root_operation_id uuid,
  ADD COLUMN source_type text,
  ADD COLUMN source_handoff_id uuid,
  ADD COLUMN source_hash text,
  ADD COLUMN source_finalized_at timestamp with time zone,
  ADD COLUMN source_state transaction_state,
  ADD COLUMN source_state_version integer,
  ADD COLUMN external_idempotency_key text,
  ADD COLUMN selected_capability_assessment_id uuid,
  ADD COLUMN state_version integer DEFAULT 0 NOT NULL;
UPDATE financial_operations
SET prepared_at = created_at,
    started_at = created_at,
    completed_at = CASE
      WHEN result IN ('SUCCESS', 'FAILED', 'UNKNOWN')
        THEN COALESCE(completed_at, created_at)
      ELSE completed_at
    END,
    evidence_hash = CASE
      WHEN result = 'SUCCESS' THEN md5(id::text || ':' || bank_reference)
      ELSE evidence_hash
    END;
ALTER TABLE financial_operations
  ALTER COLUMN prepared_at SET DEFAULT now(),
  ALTER COLUMN prepared_at SET NOT NULL;
--> statement-breakpoint
CREATE TABLE financial_operation_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL REFERENCES financial_operations(id) ON DELETE RESTRICT,
  admin_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  decision text NOT NULL,
  note text,
  operation_state_version integer NOT NULL,
  correlation_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT financial_operation_approvals_decision_check
    CHECK (decision IN ('APPROVED', 'REJECTED'))
);
CREATE UNIQUE INDEX financial_operation_approvals_admin_unique
  ON financial_operation_approvals(operation_id, admin_account_id);
CREATE UNIQUE INDEX financial_operation_approvals_idempotency_unique
  ON financial_operation_approvals(operation_id, idempotency_key);
CREATE INDEX financial_operation_approvals_operation_idx
  ON financial_operation_approvals(operation_id);
--> statement-breakpoint
CREATE TABLE financial_operation_reauth_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL REFERENCES financial_operations(id) ON DELETE RESTRICT,
  admin_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  session_id_hash text NOT NULL,
  granted_at timestamp with time zone DEFAULT now() NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  consumed_at timestamp with time zone,
  invalidated_at timestamp with time zone,
  state_version integer DEFAULT 0 NOT NULL,
  idempotency_key text NOT NULL,
  CONSTRAINT financial_operation_reauth_grants_version_check
    CHECK (state_version >= 0),
  CONSTRAINT financial_operation_reauth_grants_time_check
    CHECK (expires_at > granted_at)
);
CREATE UNIQUE INDEX financial_operation_reauth_grants_idempotency_unique
  ON financial_operation_reauth_grants(operation_id, idempotency_key);
CREATE UNIQUE INDEX financial_operation_reauth_grants_one_active_unique
  ON financial_operation_reauth_grants(operation_id, admin_account_id)
  WHERE consumed_at IS NULL AND invalidated_at IS NULL;
CREATE INDEX financial_operation_reauth_grants_operation_idx
  ON financial_operation_reauth_grants(operation_id);
--> statement-breakpoint
CREATE TABLE financial_split_calculations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_operation_id uuid NOT NULL REFERENCES financial_operations(id) ON DELETE RESTRICT,
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
  buyer_amount integer NOT NULL,
  seller_amount integer NOT NULL,
  pool_amount integer NOT NULL,
  currency text DEFAULT 'IDR' NOT NULL,
  calculation_hash text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT financial_split_calculations_amount_check
    CHECK (buyer_amount > 0 AND seller_amount > 0 AND buyer_amount + seller_amount = pool_amount),
  CONSTRAINT financial_split_calculations_currency_check CHECK (currency = 'IDR')
);
CREATE UNIQUE INDEX financial_split_calculations_root_unique
  ON financial_split_calculations(root_operation_id);
--> statement-breakpoint
CREATE TABLE refund_capability_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
  source_type text NOT NULL,
  source_handoff_id uuid NOT NULL,
  source_hash text NOT NULL,
  source_state_version integer NOT NULL,
  invoice_id uuid NOT NULL REFERENCES payment_invoices(id) ON DELETE RESTRICT,
  authoritative_provider_event_id uuid NOT NULL REFERENCES payment_provider_events(id) ON DELETE RESTRICT,
  provider_order_id text NOT NULL,
  amount integer NOT NULL,
  currency text DEFAULT 'IDR' NOT NULL,
  capability_snapshot_hash text NOT NULL,
  capability text NOT NULL,
  evidence_reference text,
  evidence_hash text,
  checked_at timestamp with time zone NOT NULL,
  actor_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  correlation_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT refund_capability_assessments_source_check
    CHECK (source_type IN ('COMPLAINT', 'RISK', 'FUNDED_CANCELLATION', 'LATE_FUND')),
  CONSTRAINT refund_capability_assessments_capability_check
    CHECK (capability IN ('SUPPORTED', 'UNSUPPORTED', 'UNKNOWN')),
  CONSTRAINT refund_capability_assessments_amount_check
    CHECK (amount > 0 AND currency = 'IDR')
);
CREATE UNIQUE INDEX refund_capability_assessments_idempotency_unique
  ON refund_capability_assessments(actor_account_id, idempotency_key);
CREATE INDEX refund_capability_assessments_transaction_idx
  ON refund_capability_assessments(transaction_id);
--> statement-breakpoint
ALTER TABLE financial_operations
  ADD CONSTRAINT financial_operations_retry_fk
    FOREIGN KEY (retry_of_operation_id) REFERENCES financial_operations(id) ON DELETE RESTRICT,
  ADD CONSTRAINT financial_operations_root_fk
    FOREIGN KEY (root_operation_id) REFERENCES financial_operations(id) ON DELETE RESTRICT,
  ADD CONSTRAINT financial_operations_capability_fk
    FOREIGN KEY (selected_capability_assessment_id) REFERENCES refund_capability_assessments(id) ON DELETE RESTRICT,
  ADD CONSTRAINT financial_operations_amount_check CHECK (amount > 0),
  ADD CONSTRAINT financial_operations_attempt_check CHECK (attempt > 0 AND state_version >= 0),
  ADD CONSTRAINT financial_operations_route_check
    CHECK (route IS NULL OR route IN ('MANUAL_PAYOUT', 'MIDTRANS_REFUND', 'MANUAL_REFUND', 'MANUAL_SPLIT')),
  ADD CONSTRAINT financial_operations_source_check
    CHECK (source_type IS NULL OR source_type IN ('COMPLAINT', 'RISK', 'FUNDED_CANCELLATION', 'LATE_FUND')),
  ADD CONSTRAINT financial_operations_lifecycle_check CHECK (
    (result IS NULL AND started_at IS NULL AND completed_at IS NULL
      AND bank_reference IS NULL AND evidence_hash IS NULL)
    OR (result = 'PROCESSING' AND started_at IS NOT NULL AND completed_at IS NULL)
    OR (result IN ('SUCCESS', 'FAILED', 'UNKNOWN')
      AND started_at IS NOT NULL AND completed_at IS NOT NULL)
  ),
  ADD CONSTRAINT financial_operations_success_evidence_check CHECK (
    result <> 'SUCCESS'
    OR (NULLIF(BTRIM(bank_reference), '') IS NOT NULL
      AND NULLIF(BTRIM(evidence_hash), '') IS NOT NULL)
  );
ALTER TABLE risk_financial_handoffs
  ADD CONSTRAINT risk_financial_handoffs_operation_fk
  FOREIGN KEY (consumed_by_operation_id) REFERENCES financial_operations(id)
  ON DELETE RESTRICT;
--> statement-breakpoint
DROP INDEX financial_operations_active_unique;
CREATE UNIQUE INDEX financial_operations_active_unique
  ON financial_operations(transaction_id, type)
  WHERE result IS NULL OR result IN ('PROCESSING', 'UNKNOWN');
CREATE UNIQUE INDEX financial_operations_external_key_unique
  ON financial_operations(external_idempotency_key)
  WHERE external_idempotency_key IS NOT NULL;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION bayaraman_financial_append_only()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER financial_operation_approvals_append_only
  BEFORE UPDATE OR DELETE ON financial_operation_approvals
  FOR EACH ROW EXECUTE FUNCTION bayaraman_financial_append_only();
CREATE TRIGGER refund_capability_assessments_append_only
  BEFORE UPDATE OR DELETE ON refund_capability_assessments
  FOR EACH ROW EXECUTE FUNCTION bayaraman_financial_append_only();
--> statement-breakpoint
COMMIT;
