BEGIN;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT transaction_id FROM risk_holds
    GROUP BY transaction_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'BAYAR-011 preflight: duplicate legacy risk cases';
  END IF;
  IF EXISTS (
    SELECT 1 FROM risk_holds rh
    LEFT JOIN transactions t ON t.id = rh.transaction_id
    LEFT JOIN accounts a ON a.id = rh.created_by_account_id
    WHERE t.id IS NULL OR a.id IS NULL
  ) THEN
    RAISE EXCEPTION 'BAYAR-011 preflight: orphan legacy risk reference';
  END IF;
  IF EXISTS (
    SELECT 1 FROM risk_holds
    WHERE NULLIF(BTRIM(reason), '') IS NULL OR outcome IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'BAYAR-011 preflight: ambiguous legacy risk authority';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE admin_task_assignments
  DROP CONSTRAINT admin_task_assignments_scope_check;
ALTER TABLE admin_task_assignments
  ADD CONSTRAINT admin_task_assignments_scope_check
  CHECK (task_scope IN (
    'COMPLAINT_INTAKE', 'COMPLAINT_APPROVAL',
    'RISK_INTAKE', 'RISK_APPROVAL', 'RELEASE_GATE_REVIEW'
  ));
--> statement-breakpoint
ALTER TABLE risk_holds
  DROP CONSTRAINT risk_holds_transaction_id_transactions_id_fk;
ALTER TABLE risk_holds
  ADD CONSTRAINT risk_holds_transaction_id_transactions_id_fk
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE RESTRICT;
ALTER TABLE risk_holds
  DROP CONSTRAINT risk_holds_created_by_account_id_accounts_id_fk;
ALTER TABLE risk_holds
  ADD CONSTRAINT risk_holds_created_by_account_id_accounts_id_fk
  FOREIGN KEY (created_by_account_id) REFERENCES accounts(id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE risk_holds ADD COLUMN category text;
ALTER TABLE risk_holds ADD COLUMN note text;
ALTER TABLE risk_holds ADD COLUMN mode text;
ALTER TABLE risk_holds ADD COLUMN lifecycle text;
ALTER TABLE risk_holds ADD COLUMN active boolean;
ALTER TABLE risk_holds ADD COLUMN source_state transaction_state;
ALTER TABLE risk_holds ADD COLUMN source_state_version integer;
ALTER TABLE risk_holds ADD COLUMN source_owner_type text;
ALTER TABLE risk_holds ADD COLUMN source_owner_id uuid;
ALTER TABLE risk_holds ADD COLUMN current_event_id uuid;
ALTER TABLE risk_holds ADD COLUMN current_review_id uuid;
ALTER TABLE risk_holds ADD COLUMN updated_at timestamp with time zone;
ALTER TABLE risk_holds ADD COLUMN resolved_at timestamp with time zone;
--> statement-breakpoint
UPDATE risk_holds rh
SET category = 'OTHER_MANUAL_REVIEW',
    note = 'Migrated legacy risk record.',
    mode = CASE WHEN t.state = 'RISK_HOLD' THEN 'ACTIVE_HOLD' ELSE 'RECORD_ONLY' END,
    lifecycle = CASE
      WHEN t.state = 'RISK_HOLD' THEN 'OPEN'
      WHEN t.state IN ('PAYOUT_PROCESSING', 'PAID_OUT', 'REFUND_PROCESSING',
                       'REFUNDED', 'SPLIT_PROCESSING', 'SPLIT_SETTLED',
                       'PAYMENT_EXPIRED', 'CANCELLED')
        THEN 'POST_PROCESSING_RECORDED'
      ELSE 'RECORD_ONLY'
    END,
    active = t.state = 'RISK_HOLD',
    source_state = t.state,
    source_state_version = t.state_version,
    source_owner_type = CASE WHEN t.state = 'RISK_HOLD' THEN NULL ELSE 'TERMINAL_TRANSACTION' END,
    source_owner_id = CASE WHEN t.state = 'RISK_HOLD' THEN NULL ELSE t.id END,
    updated_at = rh.created_at,
    resolved_at = CASE WHEN t.state = 'RISK_HOLD' THEN NULL ELSE rh.created_at END
FROM transactions t
WHERE t.id = rh.transaction_id;
--> statement-breakpoint
ALTER TABLE risk_holds ALTER COLUMN category SET NOT NULL;
ALTER TABLE risk_holds ALTER COLUMN mode SET NOT NULL;
ALTER TABLE risk_holds ALTER COLUMN mode SET DEFAULT 'ACTIVE_HOLD';
ALTER TABLE risk_holds ALTER COLUMN lifecycle SET NOT NULL;
ALTER TABLE risk_holds ALTER COLUMN lifecycle SET DEFAULT 'OPEN';
ALTER TABLE risk_holds ALTER COLUMN active SET NOT NULL;
ALTER TABLE risk_holds ALTER COLUMN active SET DEFAULT true;
ALTER TABLE risk_holds ALTER COLUMN source_state SET NOT NULL;
ALTER TABLE risk_holds ALTER COLUMN source_state_version SET NOT NULL;
ALTER TABLE risk_holds ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE risk_holds ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE risk_holds
  ADD CONSTRAINT risk_holds_category_check
  CHECK (category IN ('PROHIBITED_OR_POLICY', 'SUSPECTED_FRAUD', 'OTHER_MANUAL_REVIEW'));
ALTER TABLE risk_holds
  ADD CONSTRAINT risk_holds_other_note_check
  CHECK (category <> 'OTHER_MANUAL_REVIEW' OR NULLIF(BTRIM(note), '') IS NOT NULL);
ALTER TABLE risk_holds
  ADD CONSTRAINT risk_holds_mode_check CHECK (mode IN ('ACTIVE_HOLD', 'RECORD_ONLY'));
ALTER TABLE risk_holds
  ADD CONSTRAINT risk_holds_lifecycle_check
  CHECK (lifecycle IN ('OPEN', 'REVIEW_PENDING_APPROVAL', 'REVIEWED_HOLD',
    'REVIEW_APPROVED', 'CLEARED_TO_MANUAL_REVIEW', 'RECORD_ONLY',
    'POST_PROCESSING_RECORDED'));
ALTER TABLE risk_holds
  ADD CONSTRAINT risk_holds_source_version_check CHECK (source_state_version >= 0);
ALTER TABLE risk_holds
  ADD CONSTRAINT risk_holds_owner_type_check
  CHECK (source_owner_type IS NULL OR source_owner_type IN
    ('COMPLAINT_CASE', 'CANCELLATION_CASE', 'REFUND_CASE',
     'FINANCIAL_OPERATION', 'TERMINAL_TRANSACTION'));
ALTER TABLE risk_holds
  ADD CONSTRAINT risk_holds_active_mode_check
  CHECK (NOT active OR (mode = 'ACTIVE_HOLD' AND lifecycle NOT IN
    ('RECORD_ONLY', 'POST_PROCESSING_RECORDED', 'CLEARED_TO_MANUAL_REVIEW',
     'REVIEW_APPROVED')));
ALTER TABLE risk_holds
  ADD CONSTRAINT risk_holds_record_owner_check
  CHECK (mode <> 'RECORD_ONLY' OR
    (source_owner_type IS NOT NULL AND source_owner_id IS NOT NULL));
CREATE UNIQUE INDEX risk_holds_one_active_case_unique
  ON risk_holds(transaction_id) WHERE active = true;
CREATE INDEX risk_holds_transaction_idx ON risk_holds(transaction_id);
CREATE INDEX risk_holds_source_owner_idx
  ON risk_holds(source_owner_type, source_owner_id);
COMMENT ON COLUMN risk_holds.outcome IS
  'Legacy compatibility only. BAYAR-011 never reads or writes this field.';
--> statement-breakpoint
CREATE TABLE risk_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  risk_case_id uuid NOT NULL REFERENCES risk_holds(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  corrected_event_id uuid,
  actor_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  summary_snapshot text NOT NULL,
  evidence_reference text,
  evidence_hash text NOT NULL,
  correction_reason text,
  correlation_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT risk_events_type_check CHECK (event_type IN
    ('RISK_RECORDED', 'EVIDENCE_CORRECTED', 'REVIEW_PROPOSED',
     'REVIEW_APPROVED', 'REVIEW_REJECTED', 'HANDOFF_CLAIMED',
     'POST_PROCESSING_RECORDED')),
  CONSTRAINT risk_events_correction_check CHECK (
    (event_type = 'EVIDENCE_CORRECTED') =
    (corrected_event_id IS NOT NULL AND correction_reason IS NOT NULL)
  ),
  CONSTRAINT risk_events_corrected_fk FOREIGN KEY (corrected_event_id)
    REFERENCES risk_events(id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX risk_events_case_idempotency_unique
  ON risk_events(risk_case_id, idempotency_key);
CREATE INDEX risk_events_case_idx ON risk_events(risk_case_id);
--> statement-breakpoint
INSERT INTO risk_events (
  risk_case_id, event_type, actor_account_id, summary_snapshot,
  evidence_reference, evidence_hash, correlation_id, idempotency_key, created_at
)
SELECT id,
       CASE WHEN lifecycle = 'POST_PROCESSING_RECORDED'
         THEN 'POST_PROCESSING_RECORDED' ELSE 'RISK_RECORDED' END,
       created_by_account_id,
       'Legacy risk evidence migrated.',
       evidence_reference,
       md5(reason || ':' || id::text) || md5(id::text || ':' || reason),
       gen_random_uuid(),
       'LEGACY:' || id::text,
       created_at
FROM risk_holds;
UPDATE risk_holds rh
SET current_event_id = re.id
FROM risk_events re
WHERE re.risk_case_id = rh.id;
--> statement-breakpoint
CREATE TABLE risk_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  risk_case_id uuid NOT NULL REFERENCES risk_holds(id) ON DELETE RESTRICT,
  version integer NOT NULL,
  status text DEFAULT 'PENDING' NOT NULL,
  outcome text NOT NULL,
  buyer_amount integer DEFAULT 0 NOT NULL,
  currency text DEFAULT 'IDR' NOT NULL,
  calculation_hash text NOT NULL,
  buyer_destination_binding_id uuid,
  evidence_event_id uuid NOT NULL REFERENCES risk_events(id) ON DELETE RESTRICT,
  decision_note text NOT NULL,
  proposed_by_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  decided_at timestamp with time zone,
  CONSTRAINT risk_reviews_status_check CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  CONSTRAINT risk_reviews_outcome_check CHECK (outcome IN ('KEEP_HOLD', 'CLEAR_TO_MANUAL_REVIEW', 'BUYER_REFUND')),
  CONSTRAINT risk_reviews_currency_check CHECK (currency = 'IDR'),
  CONSTRAINT risk_reviews_amount_destination_check CHECK (
    (outcome = 'BUYER_REFUND' AND buyer_amount > 0 AND buyer_destination_binding_id IS NOT NULL)
    OR
    (outcome <> 'BUYER_REFUND' AND buyer_amount = 0 AND buyer_destination_binding_id IS NULL)
  )
);
CREATE UNIQUE INDEX risk_reviews_case_version_unique ON risk_reviews(risk_case_id, version);
CREATE UNIQUE INDEX risk_reviews_one_pending_unique
  ON risk_reviews(risk_case_id) WHERE status = 'PENDING';
CREATE INDEX risk_reviews_case_idx ON risk_reviews(risk_case_id);
--> statement-breakpoint
CREATE TABLE risk_review_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  review_id uuid NOT NULL REFERENCES risk_reviews(id) ON DELETE RESTRICT,
  admin_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  decision text NOT NULL,
  correlation_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT risk_review_approvals_decision_check
    CHECK (decision IN ('APPROVED', 'REJECTED'))
);
CREATE UNIQUE INDEX risk_review_approvals_admin_unique
  ON risk_review_approvals(review_id, admin_account_id);
CREATE UNIQUE INDEX risk_review_approvals_idempotency_unique
  ON risk_review_approvals(review_id, idempotency_key);
--> statement-breakpoint
CREATE TABLE risk_financial_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  risk_case_id uuid NOT NULL REFERENCES risk_holds(id) ON DELETE RESTRICT,
  review_id uuid NOT NULL REFERENCES risk_reviews(id) ON DELETE RESTRICT,
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
  outcome text DEFAULT 'BUYER_REFUND' NOT NULL,
  buyer_amount integer NOT NULL,
  currency text DEFAULT 'IDR' NOT NULL,
  buyer_destination_binding_id uuid NOT NULL,
  calculation_hash text NOT NULL,
  evidence_reference text NOT NULL,
  evidence_hash text NOT NULL,
  source_state transaction_state NOT NULL,
  source_state_version integer NOT NULL,
  approved_at timestamp with time zone NOT NULL,
  consumed_by_operation_id uuid REFERENCES financial_operations(id) ON DELETE RESTRICT,
  consumed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT risk_handoffs_outcome_check CHECK (outcome = 'BUYER_REFUND'),
  CONSTRAINT risk_handoffs_amount_currency_check CHECK (buyer_amount > 0 AND currency = 'IDR'),
  CONSTRAINT risk_handoffs_consumption_check CHECK (
    (consumed_by_operation_id IS NULL) = (consumed_at IS NULL)
  )
);
CREATE UNIQUE INDEX risk_handoffs_review_unique ON risk_financial_handoffs(review_id);
CREATE UNIQUE INDEX risk_handoffs_case_unique ON risk_financial_handoffs(risk_case_id);
CREATE INDEX risk_handoffs_transaction_idx ON risk_financial_handoffs(transaction_id);
--> statement-breakpoint
ALTER TABLE risk_holds
  ADD CONSTRAINT risk_holds_current_event_fk
  FOREIGN KEY (current_event_id) REFERENCES risk_events(id) ON DELETE RESTRICT;
ALTER TABLE risk_holds
  ADD CONSTRAINT risk_holds_current_review_fk
  FOREIGN KEY (current_review_id) REFERENCES risk_reviews(id) ON DELETE RESTRICT;
--> statement-breakpoint
CREATE TABLE release_gates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  gate_key text NOT NULL,
  status text DEFAULT 'OPEN' NOT NULL,
  state_version integer DEFAULT 0 NOT NULL,
  current_review_id uuid,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT release_gates_key_check CHECK (gate_key = 'REAL_MONEY_PILOT'),
  CONSTRAINT release_gates_status_check CHECK (status IN ('OPEN', 'BLOCKED', 'APPROVED')),
  CONSTRAINT release_gates_version_check CHECK (state_version >= 0),
  CONSTRAINT release_gates_key_unique UNIQUE (gate_key)
);
CREATE TABLE release_gate_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  gate_id uuid NOT NULL REFERENCES release_gates(id) ON DELETE RESTRICT,
  item_key text NOT NULL,
  status text DEFAULT 'OPEN' NOT NULL,
  current_event_id uuid,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT release_gate_items_key_check CHECK (item_key IN
    ('MIDTRANS_SETTLEMENT', 'CUSTODY_FORWARDING', 'CONSUMER_DISCLOSURE',
     'COMPLAINT_HANDLING', 'DATA_CONTROLS', 'PRODUCTION_CREDENTIALS_WEBHOOK',
     'REAL_MONEY_PILOT_EVIDENCE', 'LEGAL_COMPLIANCE')),
  CONSTRAINT release_gate_items_status_check CHECK (status IN ('OPEN', 'BLOCKED', 'APPROVED')),
  CONSTRAINT release_gate_items_key_unique UNIQUE (gate_id, item_key)
);
CREATE TABLE release_gate_item_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  item_id uuid NOT NULL REFERENCES release_gate_items(id) ON DELETE RESTRICT,
  status text NOT NULL,
  evidence_reference text NOT NULL,
  external_approver_reference text,
  corrected_event_id uuid REFERENCES release_gate_item_events(id) ON DELETE RESTRICT,
  correction_reason text,
  actor_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  correlation_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT release_gate_item_events_status_check CHECK (status IN ('OPEN', 'BLOCKED', 'APPROVED')),
  CONSTRAINT release_gate_item_events_correction_check CHECK (
    (corrected_event_id IS NULL) = (correction_reason IS NULL)
  ),
  CONSTRAINT release_gate_item_events_idempotency_unique UNIQUE (item_id, idempotency_key)
);
ALTER TABLE release_gate_items
  ADD CONSTRAINT release_gate_items_current_event_fk
  FOREIGN KEY (current_event_id) REFERENCES release_gate_item_events(id) ON DELETE RESTRICT;
CREATE TABLE release_gate_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  gate_id uuid NOT NULL REFERENCES release_gates(id) ON DELETE RESTRICT,
  resulting_status text NOT NULL,
  external_decision_reference text,
  actor_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  correlation_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  gate_version integer NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT release_gate_reviews_status_check CHECK (resulting_status IN ('OPEN', 'BLOCKED', 'APPROVED')),
  CONSTRAINT release_gate_reviews_approval_reference_check CHECK (
    resulting_status <> 'APPROVED' OR
    NULLIF(BTRIM(external_decision_reference), '') IS NOT NULL
  ),
  CONSTRAINT release_gate_reviews_idempotency_unique UNIQUE (gate_id, idempotency_key)
);
ALTER TABLE release_gates
  ADD CONSTRAINT release_gates_current_review_fk
  FOREIGN KEY (current_review_id) REFERENCES release_gate_reviews(id) ON DELETE RESTRICT;
--> statement-breakpoint
INSERT INTO release_gates (gate_key) VALUES ('REAL_MONEY_PILOT')
ON CONFLICT (gate_key) DO NOTHING;
INSERT INTO release_gate_items (gate_id, item_key)
SELECT rg.id, item_key
FROM release_gates rg
CROSS JOIN (VALUES
  ('MIDTRANS_SETTLEMENT'), ('CUSTODY_FORWARDING'), ('CONSUMER_DISCLOSURE'),
  ('COMPLAINT_HANDLING'), ('DATA_CONTROLS'), ('PRODUCTION_CREDENTIALS_WEBHOOK'),
  ('REAL_MONEY_PILOT_EVIDENCE'), ('LEGAL_COMPLIANCE')
) fixed(item_key)
WHERE rg.gate_key = 'REAL_MONEY_PILOT'
ON CONFLICT (gate_id, item_key) DO NOTHING;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION bayaraman_risk_append_only()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER risk_events_append_only_guard
  BEFORE UPDATE OR DELETE ON risk_events
  FOR EACH ROW EXECUTE FUNCTION bayaraman_risk_append_only();
CREATE TRIGGER risk_review_approvals_append_only_guard
  BEFORE UPDATE OR DELETE ON risk_review_approvals
  FOR EACH ROW EXECUTE FUNCTION bayaraman_risk_append_only();
CREATE TRIGGER release_gate_item_events_append_only_guard
  BEFORE UPDATE OR DELETE ON release_gate_item_events
  FOR EACH ROW EXECUTE FUNCTION bayaraman_risk_append_only();
CREATE TRIGGER release_gate_reviews_append_only_guard
  BEFORE UPDATE OR DELETE ON release_gate_reviews
  FOR EACH ROW EXECUTE FUNCTION bayaraman_risk_append_only();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION bayaraman_risk_review_final_guard()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'risk review cannot be deleted';
  END IF;
  IF OLD.status IN ('APPROVED', 'REJECTED') THEN
    RAISE EXCEPTION 'final risk review is immutable';
  END IF;
  IF NEW.status NOT IN ('APPROVED', 'REJECTED')
     OR NEW.risk_case_id IS DISTINCT FROM OLD.risk_case_id
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.outcome IS DISTINCT FROM OLD.outcome
     OR NEW.buyer_amount IS DISTINCT FROM OLD.buyer_amount
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.calculation_hash IS DISTINCT FROM OLD.calculation_hash
     OR NEW.buyer_destination_binding_id IS DISTINCT FROM OLD.buyer_destination_binding_id
     OR NEW.evidence_event_id IS DISTINCT FROM OLD.evidence_event_id
     OR NEW.decision_note IS DISTINCT FROM OLD.decision_note
     OR NEW.proposed_by_account_id IS DISTINCT FROM OLD.proposed_by_account_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'risk review authority fields are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER risk_reviews_final_immutable_guard
  BEFORE UPDATE OR DELETE ON risk_reviews
  FOR EACH ROW EXECUTE FUNCTION bayaraman_risk_review_final_guard();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION bayaraman_risk_hold_projection_guard()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'risk case cannot be deleted';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.transaction_id IS DISTINCT FROM OLD.transaction_id
     OR NEW.category IS DISTINCT FROM OLD.category
     OR NEW.reason IS DISTINCT FROM OLD.reason
     OR NEW.note IS DISTINCT FROM OLD.note
     OR NEW.evidence_reference IS DISTINCT FROM OLD.evidence_reference
     OR NEW.outcome IS DISTINCT FROM OLD.outcome
     OR NEW.mode IS DISTINCT FROM OLD.mode
     OR NEW.source_state IS DISTINCT FROM OLD.source_state
     OR NEW.source_state_version IS DISTINCT FROM OLD.source_state_version
     OR NEW.source_owner_type IS DISTINCT FROM OLD.source_owner_type
     OR NEW.source_owner_id IS DISTINCT FROM OLD.source_owner_id
     OR NEW.created_by_account_id IS DISTINCT FROM OLD.created_by_account_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'risk case source snapshot is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER risk_holds_projection_update_guard
  BEFORE UPDATE OR DELETE ON risk_holds
  FOR EACH ROW EXECUTE FUNCTION bayaraman_risk_hold_projection_guard();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION bayaraman_risk_handoff_claim_once_guard()
RETURNS trigger AS $$
DECLARE
  operation_transaction_id uuid;
  operation_type operation_type;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'risk handoff cannot be deleted';
  END IF;
  IF OLD.consumed_by_operation_id IS NOT NULL THEN
    RAISE EXCEPTION 'risk handoff is already consumed';
  END IF;
  IF NEW.consumed_by_operation_id IS NULL OR NEW.consumed_at IS NULL THEN
    RAISE EXCEPTION 'risk handoff claim must be complete';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.risk_case_id IS DISTINCT FROM OLD.risk_case_id
     OR NEW.review_id IS DISTINCT FROM OLD.review_id
     OR NEW.transaction_id IS DISTINCT FROM OLD.transaction_id
     OR NEW.outcome IS DISTINCT FROM OLD.outcome
     OR NEW.buyer_amount IS DISTINCT FROM OLD.buyer_amount
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.buyer_destination_binding_id IS DISTINCT FROM OLD.buyer_destination_binding_id
     OR NEW.calculation_hash IS DISTINCT FROM OLD.calculation_hash
     OR NEW.evidence_reference IS DISTINCT FROM OLD.evidence_reference
     OR NEW.evidence_hash IS DISTINCT FROM OLD.evidence_hash
     OR NEW.source_state IS DISTINCT FROM OLD.source_state
     OR NEW.source_state_version IS DISTINCT FROM OLD.source_state_version
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'risk handoff snapshot is immutable';
  END IF;
  SELECT transaction_id, type INTO operation_transaction_id, operation_type
  FROM financial_operations WHERE id = NEW.consumed_by_operation_id;
  IF operation_transaction_id IS DISTINCT FROM OLD.transaction_id
     OR operation_type IS DISTINCT FROM 'REFUND'::operation_type THEN
    RAISE EXCEPTION 'risk handoff operation mismatch';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER risk_financial_handoffs_claim_once_guard
  BEFORE UPDATE OR DELETE ON risk_financial_handoffs
  FOR EACH ROW EXECUTE FUNCTION bayaraman_risk_handoff_claim_once_guard();
--> statement-breakpoint
COMMIT;
