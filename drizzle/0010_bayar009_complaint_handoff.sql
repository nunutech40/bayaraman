BEGIN;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT transaction_id
    FROM complaint_holds
    GROUP BY transaction_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'BAYAR-009 preflight: duplicate legacy complaint cases';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM complaint_holds ch
    LEFT JOIN transactions t ON t.id = ch.transaction_id
    LEFT JOIN accounts a ON a.id = ch.created_by_account_id
    WHERE t.id IS NULL OR a.id IS NULL
  ) THEN
    RAISE EXCEPTION 'BAYAR-009 preflight: orphan legacy complaint reference';
  END IF;

  IF EXISTS (SELECT 1 FROM complaint_holds WHERE outcome IS NOT NULL) THEN
    RAISE EXCEPTION 'BAYAR-009 preflight: legacy complaint outcome is ambiguous';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM complaint_holds ch
    JOIN transactions t ON t.id = ch.transaction_id
    WHERE t.state NOT IN (
      'PAYMENT_CONFIRMED', 'READY_FOR_FULFILLMENT',
      'WAITING_COMPLETION_REPORTS', 'WAITING_OTHER_COMPLETION_REPORT',
      'READY_FOR_BUYER_CONFIRMATION', 'WAITING_BUYER_CONFIRMATION',
      'BUYER_CONFIRMATION_OVERDUE', 'READY_FOR_PAYOUT',
      'PAYOUT_ON_HOLD', 'MANUAL_REVIEW_REQUIRED',
      'PAYOUT_PROCESSING', 'PAID_OUT', 'REFUND_PROCESSING',
      'REFUNDED', 'SPLIT_PROCESSING', 'SPLIT_SETTLED'
    )
  ) THEN
    RAISE EXCEPTION 'BAYAR-009 preflight: unsupported legacy complaint state';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE complaint_holds
  DROP CONSTRAINT complaint_holds_transaction_id_transactions_id_fk;
ALTER TABLE complaint_holds
  ADD CONSTRAINT complaint_holds_transaction_id_transactions_id_fk
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE RESTRICT;
ALTER TABLE complaint_holds
  DROP CONSTRAINT complaint_holds_created_by_account_id_accounts_id_fk;
ALTER TABLE complaint_holds
  ADD CONSTRAINT complaint_holds_created_by_account_id_accounts_id_fk
  FOREIGN KEY (created_by_account_id) REFERENCES accounts(id) ON DELETE RESTRICT;
--> statement-breakpoint
CREATE TABLE admin_task_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  task_scope text NOT NULL,
  assigned_by_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  assigned_at timestamp with time zone DEFAULT now() NOT NULL,
  revoked_at timestamp with time zone,
  CONSTRAINT admin_task_assignments_scope_check
    CHECK (task_scope IN ('COMPLAINT_INTAKE', 'COMPLAINT_APPROVAL'))
);
CREATE UNIQUE INDEX admin_task_assignments_active_scope_unique
  ON admin_task_assignments(account_id, task_scope)
  WHERE revoked_at IS NULL;
--> statement-breakpoint
ALTER TABLE complaint_holds ADD COLUMN lifecycle text;
ALTER TABLE complaint_holds ADD COLUMN active boolean;
ALTER TABLE complaint_holds ADD COLUMN source_state transaction_state;
ALTER TABLE complaint_holds ADD COLUMN source_state_version integer;
ALTER TABLE complaint_holds ADD COLUMN current_event_id uuid;
ALTER TABLE complaint_holds ADD COLUMN current_agreement_id uuid;
ALTER TABLE complaint_holds ADD COLUMN updated_at timestamp with time zone;
ALTER TABLE complaint_holds ADD COLUMN resolved_at timestamp with time zone;
--> statement-breakpoint
UPDATE complaint_holds ch
SET lifecycle = CASE
      WHEN t.state = 'MANUAL_REVIEW_REQUIRED' THEN 'NO_AGREEMENT'
      WHEN t.state IN ('PAYOUT_PROCESSING', 'PAID_OUT', 'REFUND_PROCESSING',
                       'REFUNDED', 'SPLIT_PROCESSING', 'SPLIT_SETTLED')
        THEN 'POST_PROCESSING_RECORDED'
      ELSE 'OPEN'
    END,
    active = t.state NOT IN ('PAYOUT_PROCESSING', 'PAID_OUT', 'REFUND_PROCESSING',
                             'REFUNDED', 'SPLIT_PROCESSING', 'SPLIT_SETTLED'),
    source_state = t.state,
    source_state_version = t.state_version,
    updated_at = ch.created_at,
    resolved_at = CASE
      WHEN t.state IN ('PAYOUT_PROCESSING', 'PAID_OUT', 'REFUND_PROCESSING',
                       'REFUNDED', 'SPLIT_PROCESSING', 'SPLIT_SETTLED')
        THEN ch.created_at
      ELSE NULL
    END
FROM transactions t
WHERE t.id = ch.transaction_id;
--> statement-breakpoint
ALTER TABLE complaint_holds ALTER COLUMN lifecycle SET NOT NULL;
ALTER TABLE complaint_holds ALTER COLUMN lifecycle SET DEFAULT 'OPEN';
ALTER TABLE complaint_holds ALTER COLUMN active SET NOT NULL;
ALTER TABLE complaint_holds ALTER COLUMN active SET DEFAULT true;
ALTER TABLE complaint_holds ALTER COLUMN source_state SET NOT NULL;
ALTER TABLE complaint_holds ALTER COLUMN source_state_version SET NOT NULL;
ALTER TABLE complaint_holds ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE complaint_holds ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE complaint_holds
  ADD CONSTRAINT complaint_holds_lifecycle_check
  CHECK (lifecycle IN ('OPEN', 'NO_AGREEMENT', 'AGREEMENT_PENDING_APPROVAL',
                       'AGREEMENT_APPROVED', 'POST_PROCESSING_RECORDED'));
ALTER TABLE complaint_holds
  ADD CONSTRAINT complaint_holds_source_version_check
  CHECK (source_state_version >= 0);
CREATE UNIQUE INDEX complaint_holds_one_active_case_unique
  ON complaint_holds(transaction_id) WHERE active = true;
CREATE INDEX complaint_holds_transaction_idx ON complaint_holds(transaction_id);
--> statement-breakpoint
CREATE TABLE complaint_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  complaint_case_id uuid NOT NULL REFERENCES complaint_holds(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  corrected_event_id uuid,
  actor_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  source_author_role text,
  summary_snapshot text NOT NULL,
  evidence_reference text,
  evidence_hash text NOT NULL,
  correction_reason text,
  correlation_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT complaint_events_type_check CHECK (
    event_type IN ('COMPLAINT_RECORDED', 'EVIDENCE_CORRECTED',
      'NO_AGREEMENT_RECORDED', 'AGREEMENT_PROPOSED', 'AGREEMENT_APPROVED',
      'HANDOFF_CLAIMED', 'POST_PROCESSING_RECORDED')
  ),
  CONSTRAINT complaint_events_author_role_check CHECK (
    source_author_role IS NULL OR source_author_role IN ('BUYER', 'SELLER', 'ADMIN')
  ),
  CONSTRAINT complaint_events_correction_check CHECK (
    (event_type = 'EVIDENCE_CORRECTED') =
    (corrected_event_id IS NOT NULL AND correction_reason IS NOT NULL)
  ),
  CONSTRAINT complaint_events_corrected_event_fk
    FOREIGN KEY (corrected_event_id) REFERENCES complaint_events(id) ON DELETE RESTRICT,
  CONSTRAINT complaint_events_case_idempotency_unique
    UNIQUE (complaint_case_id, idempotency_key)
);
CREATE INDEX complaint_events_case_idx ON complaint_events(complaint_case_id);
--> statement-breakpoint
INSERT INTO complaint_events (
  complaint_case_id, event_type, actor_account_id, summary_snapshot,
  evidence_reference, evidence_hash, correlation_id, idempotency_key, created_at
)
SELECT ch.id,
  CASE WHEN ch.lifecycle = 'NO_AGREEMENT' THEN 'NO_AGREEMENT_RECORDED'
       WHEN ch.lifecycle = 'POST_PROCESSING_RECORDED' THEN 'POST_PROCESSING_RECORDED'
       ELSE 'COMPLAINT_RECORDED' END,
  ch.created_by_account_id, ch.summary, ch.evidence_reference,
  md5(coalesce(ch.evidence_reference, '') || ':' || ch.summary) ||
    md5(ch.summary || ':' || coalesce(ch.evidence_reference, '')),
  gen_random_uuid(), 'LEGACY:COMPLAINT:' || ch.id::text, ch.created_at
FROM complaint_holds ch;
UPDATE complaint_holds ch
SET current_event_id = event.id
FROM complaint_events event
WHERE event.complaint_case_id = ch.id;
ALTER TABLE complaint_holds
  ADD CONSTRAINT complaint_holds_current_event_fk
  FOREIGN KEY (current_event_id) REFERENCES complaint_events(id) ON DELETE RESTRICT;
--> statement-breakpoint
CREATE TABLE complaint_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  complaint_case_id uuid NOT NULL REFERENCES complaint_holds(id) ON DELETE RESTRICT,
  version integer NOT NULL,
  status text DEFAULT 'PENDING' NOT NULL,
  outcome text NOT NULL,
  buyer_amount integer NOT NULL,
  seller_amount integer NOT NULL,
  currency text DEFAULT 'IDR' NOT NULL,
  calculation_hash text NOT NULL,
  buyer_destination_binding_id uuid,
  seller_destination_binding_id uuid,
  evidence_event_id uuid NOT NULL REFERENCES complaint_events(id) ON DELETE RESTRICT,
  evidence_reference text NOT NULL,
  evidence_hash text NOT NULL,
  proposed_by_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  decided_at timestamp with time zone,
  CONSTRAINT complaint_agreements_status_check
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  CONSTRAINT complaint_agreements_outcome_check
    CHECK (outcome IN ('SELLER_RELEASE', 'BUYER_REFUND', 'SPLIT')),
  CONSTRAINT complaint_agreements_amount_check
    CHECK (buyer_amount >= 0 AND seller_amount >= 0),
  CONSTRAINT complaint_agreements_currency_check CHECK (currency = 'IDR'),
  CONSTRAINT complaint_agreements_case_version_unique
    UNIQUE (complaint_case_id, version)
);
CREATE INDEX complaint_agreements_case_idx ON complaint_agreements(complaint_case_id);
ALTER TABLE complaint_holds
  ADD CONSTRAINT complaint_holds_current_agreement_fk
  FOREIGN KEY (current_agreement_id) REFERENCES complaint_agreements(id) ON DELETE RESTRICT;
--> statement-breakpoint
CREATE TABLE complaint_agreement_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  agreement_id uuid NOT NULL REFERENCES complaint_agreements(id) ON DELETE RESTRICT,
  admin_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  decision text NOT NULL,
  correlation_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT complaint_agreement_approvals_decision_check
    CHECK (decision IN ('APPROVED', 'REJECTED')),
  CONSTRAINT complaint_agreement_approvals_admin_unique
    UNIQUE (agreement_id, admin_account_id),
  CONSTRAINT complaint_agreement_approvals_idempotency_unique
    UNIQUE (agreement_id, idempotency_key)
);
--> statement-breakpoint
CREATE TABLE complaint_financial_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  complaint_case_id uuid NOT NULL REFERENCES complaint_holds(id) ON DELETE RESTRICT,
  agreement_id uuid NOT NULL REFERENCES complaint_agreements(id) ON DELETE RESTRICT,
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
  outcome text NOT NULL,
  buyer_amount integer NOT NULL,
  seller_amount integer NOT NULL,
  currency text DEFAULT 'IDR' NOT NULL,
  calculation_hash text NOT NULL,
  buyer_destination_binding_id uuid,
  seller_destination_binding_id uuid,
  evidence_reference text NOT NULL,
  evidence_hash text NOT NULL,
  source_state transaction_state NOT NULL,
  source_state_version integer NOT NULL,
  approved_at timestamp with time zone NOT NULL,
  consumed_by_operation_id uuid REFERENCES financial_operations(id) ON DELETE RESTRICT,
  consumed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT complaint_financial_handoffs_outcome_check
    CHECK (outcome IN ('SELLER_RELEASE', 'BUYER_REFUND', 'SPLIT')),
  CONSTRAINT complaint_financial_handoffs_amount_check
    CHECK (buyer_amount >= 0 AND seller_amount >= 0),
  CONSTRAINT complaint_financial_handoffs_currency_check CHECK (currency = 'IDR'),
  CONSTRAINT complaint_financial_handoffs_consumption_check
    CHECK ((consumed_by_operation_id IS NULL) = (consumed_at IS NULL)),
  CONSTRAINT complaint_financial_handoffs_agreement_unique UNIQUE (agreement_id),
  CONSTRAINT complaint_financial_handoffs_case_unique UNIQUE (complaint_case_id)
);
CREATE INDEX complaint_financial_handoffs_transaction_idx
  ON complaint_financial_handoffs(transaction_id);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION bayaraman_complaint_append_only()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER complaint_events_append_only_trigger
  BEFORE UPDATE OR DELETE ON complaint_events
  FOR EACH ROW EXECUTE FUNCTION bayaraman_complaint_append_only();
CREATE TRIGGER complaint_agreement_approvals_append_only_trigger
  BEFORE UPDATE OR DELETE ON complaint_agreement_approvals
  FOR EACH ROW EXECUTE FUNCTION bayaraman_complaint_append_only();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION bayaraman_complaint_agreement_final_guard()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'complaint agreement cannot be deleted';
  END IF;
  IF OLD.status IN ('APPROVED', 'REJECTED') THEN
    RAISE EXCEPTION 'final complaint agreement is immutable';
  END IF;
  IF NEW.complaint_case_id IS DISTINCT FROM OLD.complaint_case_id
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.outcome IS DISTINCT FROM OLD.outcome
     OR NEW.buyer_amount IS DISTINCT FROM OLD.buyer_amount
     OR NEW.seller_amount IS DISTINCT FROM OLD.seller_amount
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.calculation_hash IS DISTINCT FROM OLD.calculation_hash
     OR NEW.buyer_destination_binding_id IS DISTINCT FROM OLD.buyer_destination_binding_id
     OR NEW.seller_destination_binding_id IS DISTINCT FROM OLD.seller_destination_binding_id
     OR NEW.evidence_event_id IS DISTINCT FROM OLD.evidence_event_id
     OR NEW.evidence_reference IS DISTINCT FROM OLD.evidence_reference
     OR NEW.evidence_hash IS DISTINCT FROM OLD.evidence_hash
     OR NEW.proposed_by_account_id IS DISTINCT FROM OLD.proposed_by_account_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'complaint agreement authority fields are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER complaint_agreements_final_guard_trigger
  BEFORE UPDATE OR DELETE ON complaint_agreements
  FOR EACH ROW EXECUTE FUNCTION bayaraman_complaint_agreement_final_guard();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION bayaraman_complaint_handoff_claim_once_guard()
RETURNS trigger AS $$
DECLARE
  operation_transaction_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'complaint handoff cannot be deleted';
  END IF;
  IF OLD.consumed_by_operation_id IS NOT NULL THEN
    RAISE EXCEPTION 'complaint handoff is already consumed';
  END IF;
  IF NEW.consumed_by_operation_id IS NULL OR NEW.consumed_at IS NULL THEN
    RAISE EXCEPTION 'complaint handoff claim must set operation and timestamp together';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.complaint_case_id IS DISTINCT FROM OLD.complaint_case_id
     OR NEW.agreement_id IS DISTINCT FROM OLD.agreement_id
     OR NEW.transaction_id IS DISTINCT FROM OLD.transaction_id
     OR NEW.outcome IS DISTINCT FROM OLD.outcome
     OR NEW.buyer_amount IS DISTINCT FROM OLD.buyer_amount
     OR NEW.seller_amount IS DISTINCT FROM OLD.seller_amount
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.calculation_hash IS DISTINCT FROM OLD.calculation_hash
     OR NEW.buyer_destination_binding_id IS DISTINCT FROM OLD.buyer_destination_binding_id
     OR NEW.seller_destination_binding_id IS DISTINCT FROM OLD.seller_destination_binding_id
     OR NEW.evidence_reference IS DISTINCT FROM OLD.evidence_reference
     OR NEW.evidence_hash IS DISTINCT FROM OLD.evidence_hash
     OR NEW.source_state IS DISTINCT FROM OLD.source_state
     OR NEW.source_state_version IS DISTINCT FROM OLD.source_state_version
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'complaint handoff snapshot is immutable';
  END IF;
  SELECT transaction_id INTO operation_transaction_id
  FROM financial_operations
  WHERE id = NEW.consumed_by_operation_id;
  IF operation_transaction_id IS DISTINCT FROM OLD.transaction_id THEN
    RAISE EXCEPTION 'complaint handoff operation transaction mismatch';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER complaint_financial_handoffs_claim_once_guard
  BEFORE UPDATE OR DELETE ON complaint_financial_handoffs
  FOR EACH ROW EXECUTE FUNCTION bayaraman_complaint_handoff_claim_once_guard();
--> statement-breakpoint
COMMIT;
