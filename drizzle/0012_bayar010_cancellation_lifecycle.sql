BEGIN;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cancellation_requests)
     OR EXISTS (SELECT 1 FROM cancellation_reconciliations) THEN
    RAISE EXCEPTION 'BAYAR-010 preflight: legacy cancellation rows require an explicit data migration';
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
    'CANCELLATION_APPROVAL'
  ));
--> statement-breakpoint
ALTER TABLE cancellation_requests
  ADD COLUMN lifecycle text DEFAULT 'ACTIVE' NOT NULL,
  ADD COLUMN decision text,
  ADD COLUMN delegation_type text DEFAULT 'NONE' NOT NULL,
  ADD COLUMN delegation_status text DEFAULT 'NOT_REQUIRED' NOT NULL,
  ADD COLUMN prior_state transaction_state,
  ADD COLUMN payment_reconciliation_id uuid,
  ADD COLUMN complaint_case_id uuid,
  ADD COLUMN risk_case_id uuid,
  ADD COLUMN response_deadline_at timestamp with time zone,
  ADD COLUMN manual_review_reason text,
  ADD COLUMN resolved_at timestamp with time zone;
ALTER TABLE cancellation_requests ALTER COLUMN prior_state SET NOT NULL;
ALTER TABLE cancellation_requests
  ADD CONSTRAINT cancellation_requests_payment_reconciliation_fk
  FOREIGN KEY (payment_reconciliation_id) REFERENCES payment_reconciliations(id)
  ON DELETE RESTRICT;
ALTER TABLE cancellation_requests
  ADD CONSTRAINT cancellation_requests_complaint_case_fk
  FOREIGN KEY (complaint_case_id) REFERENCES complaint_holds(id)
  ON DELETE RESTRICT;
ALTER TABLE cancellation_requests
  ADD CONSTRAINT cancellation_requests_risk_case_fk
  FOREIGN KEY (risk_case_id) REFERENCES risk_holds(id)
  ON DELETE RESTRICT;
ALTER TABLE cancellation_requests
  ADD CONSTRAINT cancellation_requests_cause_check
  CHECK (cause IN (
    'BUYER_CHANGE_OF_MIND', 'SELLER_UNABLE_TO_FULFILL', 'MUTUAL_NEUTRAL',
    'BAYARAMAN_ERROR', 'PROHIBITED_OR_POLICY', 'SUSPECTED_FRAUD',
    'OTHER_MANUAL_REVIEW'
  ));
ALTER TABLE cancellation_requests
  ADD CONSTRAINT cancellation_requests_status_check
  CHECK (status IN ('ACTIVE', 'CLOSED'));
ALTER TABLE cancellation_requests
  ADD CONSTRAINT cancellation_requests_lifecycle_check
  CHECK (lifecycle IN (
    'ACTIVE', 'WITHDRAWN', 'REJECTED', 'RESOLVED',
    'REFERRED_TO_COMPLAINT', 'REFERRED_TO_RISK'
  ));
ALTER TABLE cancellation_requests
  ADD CONSTRAINT cancellation_requests_decision_check
  CHECK (decision IS NULL OR decision IN (
    'DIRECT_CANCELLED', 'DEFINITIVE_NON_PAID', 'FUNDED_REVIEW',
    'REFUND_APPROVED', 'LATE_FUND_REFUND', 'COMPLAINT_HANDOFF',
    'RISK_HANDOFF', 'MANUAL_REVIEW'
  ));
ALTER TABLE cancellation_requests
  ADD CONSTRAINT cancellation_requests_delegation_type_check
  CHECK (delegation_type IN ('NONE', 'COMPLAINT', 'RISK'));
ALTER TABLE cancellation_requests
  ADD CONSTRAINT cancellation_requests_delegation_status_check
  CHECK (delegation_status IN ('NOT_REQUIRED', 'REQUIRED', 'REFERRED'));
ALTER TABLE cancellation_requests
  ADD CONSTRAINT cancellation_requests_risk_required_check
  CHECK (NOT (delegation_type = 'RISK' AND delegation_status = 'REQUIRED')
    OR (status = 'ACTIVE' AND resolved_at IS NULL));
ALTER TABLE cancellation_requests
  ADD CONSTRAINT cancellation_requests_risk_referred_check
  CHECK (NOT (delegation_type = 'RISK' AND delegation_status = 'REFERRED')
    OR (status = 'CLOSED' AND lifecycle = 'REFERRED_TO_RISK'
      AND risk_case_id IS NOT NULL AND resolved_at IS NOT NULL));
ALTER TABLE cancellation_requests
  ADD CONSTRAINT cancellation_requests_complaint_referred_check
  CHECK (NOT (delegation_type = 'COMPLAINT' AND delegation_status = 'REFERRED')
    OR (status = 'CLOSED' AND lifecycle = 'REFERRED_TO_COMPLAINT'
      AND complaint_case_id IS NOT NULL AND resolved_at IS NOT NULL));
ALTER TABLE cancellation_requests
  ADD CONSTRAINT cancellation_requests_direct_nonrisk_check
  CHECK (NOT (decision = 'DIRECT_CANCELLED' AND delegation_type <> 'RISK')
    OR (status = 'CLOSED' AND lifecycle = 'RESOLVED'
      AND resolved_at IS NOT NULL));
CREATE INDEX cancellation_requests_payment_reconciliation_idx
  ON cancellation_requests(payment_reconciliation_id);
--> statement-breakpoint
DROP TABLE cancellation_reconciliations;
CREATE TABLE cancellation_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  cancellation_request_id uuid NOT NULL
    REFERENCES cancellation_requests(id) ON DELETE RESTRICT,
  payment_reconciliation_id uuid NOT NULL
    REFERENCES payment_reconciliations(id) ON DELETE RESTRICT,
  status text DEFAULT 'OPEN' NOT NULL,
  classification text,
  provider_event_id uuid REFERENCES payment_provider_events(id)
    ON DELETE RESTRICT,
  evidence_reference text,
  reconciled_by_account_id uuid REFERENCES accounts(id),
  deadline_at timestamp with time zone NOT NULL,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT cancellation_reconciliations_status_check
    CHECK (status IN ('OPEN', 'RESOLVED', 'TIMED_OUT')),
  CONSTRAINT cancellation_reconciliations_classification_check
    CHECK (classification IS NULL OR classification IN
      ('AUTHORITATIVE', 'DEFINITIVE_NON_PAID', 'WAITING', 'MISMATCH', 'UNKNOWN'))
);
CREATE UNIQUE INDEX cancellation_reconciliation_request_unique
  ON cancellation_reconciliations(cancellation_request_id);
CREATE INDEX cancellation_reconciliations_payment_idx
  ON cancellation_reconciliations(payment_reconciliation_id);
--> statement-breakpoint
CREATE TABLE cancellation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  cancellation_request_id uuid NOT NULL
    REFERENCES cancellation_requests(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  actor_account_id uuid REFERENCES accounts(id) ON DELETE RESTRICT,
  summary text NOT NULL,
  evidence_reference text,
  correlation_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT cancellation_events_type_check CHECK (event_type IN (
    'REQUESTED', 'EVIDENCE_CORRECTED', 'WITHDRAWN', 'REJECTED',
    'INVITATION_REVOKED', 'INVOICE_RETIRED', 'RECONCILIATION_LINKED',
    'PROVIDER_RESULT_RECORDED', 'WA_REQUEST_RECORDED',
    'PARTICIPANT_RESPONSE_RECORDED', 'SELLER_SHIPMENT_RECORDED',
    'RESPONSE_TIMEOUT_RECORDED', 'RECONCILIATION_TIMEOUT_RECORDED',
    'MANUAL_REVIEW_RECOVERY_RECORDED', 'REFUND_CALCULATION_PROPOSED',
    'REFUND_CALCULATION_APPROVED', 'REFUND_CALCULATION_REJECTED',
    'COMPLAINT_HANDOFF_REQUIRED', 'COMPLAINT_HANDOFF_RECORDED',
    'RISK_HANDOFF_REQUIRED', 'RISK_HANDOFF_RECORDED',
    'FINANCIAL_HANDOFF_CREATED', 'HANDOFF_CLAIMED'
  ))
);
CREATE UNIQUE INDEX cancellation_events_request_idempotency_unique
  ON cancellation_events(cancellation_request_id, idempotency_key);
CREATE INDEX cancellation_events_request_idx
  ON cancellation_events(cancellation_request_id);
--> statement-breakpoint
CREATE TABLE cancellation_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  cancellation_request_id uuid NOT NULL
    REFERENCES cancellation_requests(id) ON DELETE RESTRICT,
  evidence_key text NOT NULL,
  source_author_role text NOT NULL,
  source_account_id uuid REFERENCES accounts(id) ON DELETE RESTRICT,
  evidence_reference text NOT NULL,
  message_reference text,
  snapshot_hash text NOT NULL,
  delivery_result text NOT NULL,
  response_value text,
  corrected_evidence_id uuid REFERENCES cancellation_evidence(id)
    ON DELETE RESTRICT,
  correction_reason text,
  recorded_by_account_id uuid NOT NULL REFERENCES accounts(id)
    ON DELETE RESTRICT,
  correlation_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  recorded_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT cancellation_evidence_key_check
    CHECK (evidence_key IN
      ('WA_REQUEST', 'SELLER_SHIPMENT', 'BUYER_RESPONSE', 'SELLER_RESPONSE')),
  CONSTRAINT cancellation_evidence_author_role_check
    CHECK (source_author_role IN ('BUYER', 'SELLER', 'ADMIN')),
  CONSTRAINT cancellation_evidence_delivery_check
    CHECK (delivery_result IN ('PENDING', 'SENT', 'FAILED', 'UNKNOWN')),
  CONSTRAINT cancellation_evidence_correction_check
    CHECK ((corrected_evidence_id IS NULL) = (correction_reason IS NULL))
);
CREATE UNIQUE INDEX cancellation_evidence_request_idempotency_unique
  ON cancellation_evidence(cancellation_request_id, idempotency_key);
CREATE INDEX cancellation_evidence_request_idx
  ON cancellation_evidence(cancellation_request_id);
CREATE TABLE cancellation_evidence_heads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  cancellation_request_id uuid NOT NULL
    REFERENCES cancellation_requests(id) ON DELETE RESTRICT,
  evidence_key text NOT NULL,
  current_evidence_id uuid NOT NULL
    REFERENCES cancellation_evidence(id) ON DELETE RESTRICT,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX cancellation_evidence_heads_request_key_unique
  ON cancellation_evidence_heads(cancellation_request_id, evidence_key);
CREATE UNIQUE INDEX cancellation_evidence_heads_current_unique
  ON cancellation_evidence_heads(current_evidence_id);
--> statement-breakpoint
CREATE TABLE cancellation_provider_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
  cancellation_request_id uuid REFERENCES cancellation_requests(id)
    ON DELETE RESTRICT,
  payment_reconciliation_id uuid NOT NULL
    REFERENCES payment_reconciliations(id) ON DELETE RESTRICT,
  provider_event_id uuid NOT NULL REFERENCES payment_provider_events(id)
    ON DELETE RESTRICT,
  source text NOT NULL,
  classification text NOT NULL,
  outcome_state transaction_state NOT NULL,
  correlation_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT cancellation_provider_resolutions_source_check
    CHECK (source IN ('WEBHOOK', 'GET_STATUS', 'ADMIN_RECOVERY')),
  CONSTRAINT cancellation_provider_resolutions_classification_check
    CHECK (classification IN
      ('AUTHORITATIVE', 'DEFINITIVE_NON_PAID', 'WAITING', 'MISMATCH', 'UNKNOWN'))
);
CREATE UNIQUE INDEX cancellation_provider_resolutions_event_unique
  ON cancellation_provider_resolutions(provider_event_id);
CREATE UNIQUE INDEX cancellation_provider_resolutions_idempotency_unique
  ON cancellation_provider_resolutions(payment_reconciliation_id, idempotency_key);
--> statement-breakpoint
CREATE TABLE cancellation_refund_calculations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  cancellation_request_id uuid NOT NULL
    REFERENCES cancellation_requests(id) ON DELETE RESTRICT,
  version integer NOT NULL,
  status text DEFAULT 'PENDING' NOT NULL,
  buyer_amount integer NOT NULL,
  currency text DEFAULT 'IDR' NOT NULL,
  calculation_hash text NOT NULL,
  evidence_snapshot_hash text NOT NULL,
  buyer_destination_binding_id uuid NOT NULL,
  proposed_by_account_id uuid NOT NULL REFERENCES accounts(id)
    ON DELETE RESTRICT,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  decided_at timestamp with time zone,
  CONSTRAINT cancellation_refund_calculations_status_check
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  CONSTRAINT cancellation_refund_calculations_amount_check
    CHECK (buyer_amount > 0 AND currency = 'IDR')
);
CREATE UNIQUE INDEX cancellation_refund_calculations_request_version_unique
  ON cancellation_refund_calculations(cancellation_request_id, version);
CREATE UNIQUE INDEX cancellation_refund_calculations_one_pending_unique
  ON cancellation_refund_calculations(cancellation_request_id)
  WHERE status = 'PENDING';
CREATE TABLE cancellation_refund_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  calculation_id uuid NOT NULL
    REFERENCES cancellation_refund_calculations(id) ON DELETE RESTRICT,
  admin_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  decision text NOT NULL,
  correlation_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT cancellation_refund_approvals_decision_check
    CHECK (decision IN ('APPROVED', 'REJECTED'))
);
CREATE UNIQUE INDEX cancellation_refund_approvals_admin_unique
  ON cancellation_refund_approvals(calculation_id, admin_account_id);
CREATE UNIQUE INDEX cancellation_refund_approvals_idempotency_unique
  ON cancellation_refund_approvals(calculation_id, idempotency_key);
--> statement-breakpoint
CREATE TABLE cancellation_financial_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
  cancellation_request_id uuid REFERENCES cancellation_requests(id)
    ON DELETE RESTRICT,
  payment_reconciliation_id uuid REFERENCES payment_reconciliations(id)
    ON DELETE RESTRICT,
  provider_event_id uuid NOT NULL REFERENCES payment_provider_events(id)
    ON DELETE RESTRICT,
  source_type text NOT NULL,
  buyer_amount integer NOT NULL,
  currency text DEFAULT 'IDR' NOT NULL,
  buyer_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  calculation_id uuid REFERENCES cancellation_refund_calculations(id)
    ON DELETE RESTRICT,
  source_hash text NOT NULL,
  evidence_reference text NOT NULL,
  evidence_hash text NOT NULL,
  provider_order_id text NOT NULL,
  source_state transaction_state NOT NULL,
  source_state_version integer NOT NULL,
  source_finalized_at timestamp with time zone NOT NULL,
  consumed_by_operation_id uuid REFERENCES financial_operations(id)
    ON DELETE RESTRICT,
  consumed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT cancellation_financial_handoffs_source_type_check
    CHECK (source_type IN ('FUNDED_CANCELLATION', 'LATE_FUND')),
  CONSTRAINT cancellation_financial_handoffs_amount_check
    CHECK (buyer_amount > 0 AND currency = 'IDR'),
  CONSTRAINT cancellation_financial_handoffs_source_state_check
    CHECK (source_state = 'REFUND_READY'),
  CONSTRAINT cancellation_financial_handoffs_source_fields_check CHECK (
    (source_type = 'FUNDED_CANCELLATION'
      AND cancellation_request_id IS NOT NULL AND calculation_id IS NOT NULL)
    OR
    (source_type = 'LATE_FUND'
      AND calculation_id IS NULL AND payment_reconciliation_id IS NOT NULL)
  ),
  CONSTRAINT cancellation_financial_handoffs_consumption_check
    CHECK ((consumed_by_operation_id IS NULL) = (consumed_at IS NULL))
);
CREATE UNIQUE INDEX cancellation_financial_handoffs_provider_event_unique
  ON cancellation_financial_handoffs(provider_event_id);
CREATE UNIQUE INDEX cancellation_financial_handoffs_calculation_unique
  ON cancellation_financial_handoffs(calculation_id)
  WHERE calculation_id IS NOT NULL;
CREATE INDEX cancellation_financial_handoffs_transaction_idx
  ON cancellation_financial_handoffs(transaction_id);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION cancellation_append_only_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'BAYAR-010 append-only evidence cannot be changed';
END $$;
CREATE TRIGGER cancellation_events_insert_only_guard
  BEFORE UPDATE OR DELETE ON cancellation_events
  FOR EACH ROW EXECUTE FUNCTION cancellation_append_only_guard();
CREATE TRIGGER cancellation_evidence_insert_only_guard
  BEFORE UPDATE OR DELETE ON cancellation_evidence
  FOR EACH ROW EXECUTE FUNCTION cancellation_append_only_guard();
CREATE TRIGGER cancellation_provider_resolutions_insert_only_guard
  BEFORE UPDATE OR DELETE ON cancellation_provider_resolutions
  FOR EACH ROW EXECUTE FUNCTION cancellation_append_only_guard();
CREATE TRIGGER cancellation_refund_approvals_insert_only_guard
  BEFORE UPDATE OR DELETE ON cancellation_refund_approvals
  FOR EACH ROW EXECUTE FUNCTION cancellation_append_only_guard();
CREATE OR REPLACE FUNCTION cancellation_handoff_immutable_claim_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'BAYAR-010 financial handoff cannot be deleted';
  END IF;
  IF OLD.consumed_by_operation_id IS NOT NULL
     AND (NEW.consumed_by_operation_id IS DISTINCT FROM OLD.consumed_by_operation_id
       OR NEW.consumed_at IS DISTINCT FROM OLD.consumed_at) THEN
    RAISE EXCEPTION 'BAYAR-010 claimed financial handoff is immutable';
  END IF;
  IF ROW(NEW.transaction_id, NEW.cancellation_request_id,
         NEW.payment_reconciliation_id, NEW.provider_event_id,
         NEW.source_type, NEW.buyer_amount, NEW.currency,
         NEW.buyer_account_id, NEW.calculation_id, NEW.source_hash,
         NEW.evidence_reference, NEW.evidence_hash, NEW.provider_order_id,
         NEW.source_state, NEW.source_state_version,
         NEW.source_finalized_at)
     IS DISTINCT FROM
     ROW(OLD.transaction_id, OLD.cancellation_request_id,
         OLD.payment_reconciliation_id, OLD.provider_event_id,
         OLD.source_type, OLD.buyer_amount, OLD.currency,
         OLD.buyer_account_id, OLD.calculation_id, OLD.source_hash,
         OLD.evidence_reference, OLD.evidence_hash, OLD.provider_order_id,
         OLD.source_state, OLD.source_state_version,
         OLD.source_finalized_at) THEN
    RAISE EXCEPTION 'BAYAR-010 financial handoff source is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER cancellation_handoff_immutable_claim_guard
  BEFORE UPDATE OR DELETE ON cancellation_financial_handoffs
  FOR EACH ROW EXECUTE FUNCTION cancellation_handoff_immutable_claim_guard();
--> statement-breakpoint
COMMIT;
