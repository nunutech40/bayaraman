# BayarAman QA Scenarios

## 1. Document Metadata

```text
Feature/product area: BayarAman MVP physical-goods transaction
Version: 0.2
Status: Approved
Source requirements: docs/product/03-user-requirements.md v0.4 (Approved)
Source UI/UX Design: docs/product/04-ui-ux-spec.md v0.2 (Approved)
Source User Journey/UX Flow (traceability gaps only): docs/product/01-user-journey.md v0.6 and docs/product/02-ux-flow.md v0.3
Owner: Product Owner BayarAman / QA
Last updated: 2026-07-26
Approved by: Product Owner BayarAman
Approved on: 2026-07-26
```

This document defines observable QA coverage for the approved product rules and
UI/UX states. It does not define implementation architecture, database schema,
provider behavior, or automated test tooling.

## 2. Coverage Map

Coverage is grouped where several requirements share the same contract. Each
group still requires the individual IDs to be checked during execution.

| Requirement/UI state ID | Covered by scenario IDs | Coverage status |
| --- | --- | --- |
| `UR-ACCOUNT-001` to `UR-ACCOUNT-002`, `UR-BR-026` | `QA-ACCOUNT-001` to `QA-ACCOUNT-003`, `QA-SEC-001` | Covered |
| `UR-INIT-001` to `UR-INIT-005`, `UR-BUYER-001` to `UR-BUYER-003`, `UR-SELLER-001` to `UR-SELLER-003` | `QA-TRANS-001` to `QA-TRANS-006`, `QA-SEC-002` | Covered |
| `UR-SYSTEM-001`, `UR-PARTICIPANT-001` to `UR-PARTICIPANT-004`, `UR-BR-001` to `UR-BR-012`, `UR-BR-027` to `UR-BR-032` | `QA-TRANS-003` to `QA-TRANS-006`, `QA-PAY-001`, `QA-UI-001` | Covered |
| `UR-BUYER-004` to `UR-BUYER-005`, `UR-BUYER-009`, `UR-SYSTEM-004` to `UR-SYSTEM-007`, `UR-PAYMENT-001` to `UR-PAYMENT-007`, `UR-BR-030` to `UR-BR-035` | `QA-PAY-001` to `QA-PAY-010`, `QA-EXP-001` to `QA-EXP-004`, `QA-MP-001` to `QA-MP-008` | Covered |
| `UR-ADMIN-001` to `UR-ADMIN-004`, `UR-ADMIN-020` to `UR-ADMIN-023`, `UR-PAYMENT-004` to `UR-PAYMENT-006`, `UR-BR-013` to `UR-BR-025` | `QA-MP-003` to `QA-MP-008`, `QA-WA-001` to `QA-WA-004`, `QA-SEC-003` | Covered |
| `UR-SELLER-004`, `UR-PARTY-001` to `UR-PARTY-002`, `UR-ADMIN-005`, `UR-BR-014` to `UR-BR-016` | `QA-WA-002` to `QA-WA-004` | Covered |
| `UR-BUYER-006` to `UR-BUYER-008`, `UR-SYSTEM-002` to `UR-SYSTEM-003`, `UR-ADMIN-008` to `UR-ADMIN-011`, `UR-BR-017` to `UR-BR-020`, `UR-BR-036` | `QA-CONF-001` to `QA-CONF-005` | Covered |
| `UR-PARTY-003` to `UR-PARTY-004`, `UR-ADMIN-012` to `UR-ADMIN-019`, `UR-BR-021` to `UR-BR-025`, `UR-BR-038` | `QA-COMPLAINT-001` to `QA-COMPLAINT-004` | Covered |
| `UR-ADMIN-006` to `UR-ADMIN-007`, `UR-FINANCIAL-001` to `UR-FINANCIAL-003`, `UR-SYSTEM-009`, `UR-ADMIN-015` to `UR-ADMIN-019`, `UR-BR-037` to `UR-BR-044` | `QA-FIN-001` to `QA-FIN-008`, `QA-SLA-001` to `QA-SLA-002`, `QA-NOTIFY-001` | Covered |
| `UR-CANCEL-001` to `UR-CANCEL-025`, `UR-CAN-OD-001` to `UR-CAN-OD-008`, `UR-BR-047` to `UR-BR-065` | `QA-CANCEL-001` to `QA-CANCEL-014`, `QA-RISK-001` to `QA-RISK-002`, `QA-SEC-004` to `QA-SEC-005` | Covered |
| `UI-SCR-001` to `UI-SCR-024` | `QA-UI-001` to `QA-UI-006` and all functional scenarios | Covered |
| `UI-SCR-009`, `UI-SCR-010`, `UI-SCR-011`, `UI-SCR-014`, `UI-SCR-016`, `UI-SCR-020` to `UI-SCR-024` states | `QA-UI-002` to `QA-UI-006`, `QA-PAY-003`, `QA-CONF-002`, `QA-CANCEL-003` to `QA-CANCEL-014` | Covered |
| `UR-BR-034`, `UR-BR-035` | `QA-PAY-009`, `QA-PAY-010` | Covered |
| `UR-BR-038`, `UR-BR-040`, `UR-BR-041`, `UR-BR-042` | `QA-FIN-007`, `QA-FIN-008`, `QA-SEC-004`, `QA-SEC-005` | Covered |
| `UR-BR-043` | `QA-SLA-001`, `QA-SLA-002` | Covered |
| `UR-BR-044` | `QA-NOTIFY-001`, `QA-UI-006` | Covered |
| `UR-BR-046`, `PB-MP-009`, `PB-MP-OD-005` | `QA-LAUNCH-001` | Non-UI |

| `PB-MP-001` to `PB-MP-006`, `PB-MP-OD-001` to `PB-MP-OD-004` | `QA-MP-001` to `QA-MP-008` | Covered |
| `PB-MP-007` to `PB-MP-008` | `QA-FIN-001` to `QA-FIN-004`, `QA-CANCEL-011` | Covered |

`UR-BR-001` through `UR-BR-065` are mapped above. `UR-BR-046` is a non-UI
launch gate and must be recorded as a release-readiness decision, not inferred
from a user-facing scenario. The execution report must retain the individual
ID-to-result mapping.

### 2.1 Requirement-Level Coverage Reconciliation

The following requirement IDs were previously represented only by grouped
ranges. They now have explicit scenario ownership. A requirement is Covered
only when the named scenario has executable steps; otherwise it remains Gap.

| Requirement ID | Scenario ID | Coverage status |
| --- | --- | --- |
| `UR-ADMIN-009` | `QA-SEC-002` | Covered |
| `UR-ADMIN-010` | `QA-SEC-002` | Covered |
| `UR-ADMIN-021` | `QA-FIN-006` | Covered |
| `UR-ADMIN-022` | `QA-FIN-006` | Covered |
| `UR-ADMIN-024` | `QA-SEC-003` | Covered |
| `UR-ADMIN-025` | `QA-RISK-002` | Covered |
| `UR-ADMIN-026` | `QA-SEC-002` | Covered |
| `UR-FINANCIAL-002` | `QA-FIN-002`, `QA-FIN-005` | Covered |
| `UR-SYSTEM-008` | `QA-EXP-002` | Covered |
| `UR-SYSTEM-011` | `QA-UI-002` | Covered |
| `UR-PARTICIPANT-002` | `QA-UI-001` | Covered |
| `UR-PARTICIPANT-003` | `QA-WA-003` | Covered |
| `UR-BUYER-010` | `QA-PAY-008` | Covered |
| `UR-CANCEL-012` | `QA-CANCEL-004` | Covered |
| `UR-BR-002` to `UR-BR-011` | `QA-TRANS-005`, `QA-UI-003`, `QA-UI-004` | Covered |
| `UR-BR-015`, `UR-BR-018`, `UR-BR-019` | `QA-UI-005` | Covered |
| `UR-BR-022`, `UR-BR-023`, `UR-BR-024` | `QA-COMPLAINT-003` | Covered |
| `UR-BR-048`, `UR-BR-049`, `UR-BR-050`, `UR-BR-051` | `QA-EXP-001`, `QA-EXP-003`, `QA-EXP-004`, `QA-CANCEL-002` | Covered |
| `UR-BR-054` | `QA-CANCEL-006` | Covered |
| `UR-BR-052`, `UR-BR-053`, `UR-BR-055`, `UR-BR-056`, `UR-BR-057`, `UR-BR-058`, `UR-BR-059`, `UR-BR-060`, `UR-BR-061`, `UR-BR-062`, `UR-BR-063` | `QA-CANCEL-004`, `QA-CANCEL-005`, `QA-CANCEL-010`, `QA-CANCEL-013`, `QA-CANCEL-014`, `QA-RISK-002`, `QA-SEC-002`, `QA-SEC-003`, `QA-UI-002`, `QA-UI-006` | Covered |
| `UR-OD-001` to `UR-OD-012` | `QA-CANCEL-010`, `QA-CANCEL-014`, `QA-CANCEL-013`, `QA-SEC-004`, `QA-SEC-005`, `QA-SLA-001`, `QA-SLA-002`, `QA-NOTIFY-001` | Covered |

Individual coverage keys (the canonical IDs, without range expansion) are:
`UR-ADMIN-009`, `UR-ADMIN-010`, `UR-ADMIN-021`, `UR-ADMIN-022`,
`UR-ADMIN-024`, `UR-ADMIN-025`, `UR-ADMIN-026`, `UR-FINANCIAL-002`,
`UR-SYSTEM-008`, `UR-SYSTEM-011`, `UR-PARTICIPANT-002`,
`UR-PARTICIPANT-003`, `UR-BUYER-010`, `UR-CANCEL-012`,
`UR-BR-002`, `UR-BR-003`, `UR-BR-004`, `UR-BR-005`, `UR-BR-006`,
`UR-BR-007`, `UR-BR-008`, `UR-BR-009`, `UR-BR-010`, `UR-BR-011`,
`UR-BR-015`, `UR-BR-018`, `UR-BR-019`, `UR-BR-022`, `UR-BR-023`,
`UR-BR-024`, `UR-BR-048`, `UR-BR-049`, `UR-BR-050`, `UR-BR-051`,
`UR-BR-052`, `UR-BR-053`, `UR-BR-054`, `UR-BR-055`, `UR-BR-056`,
`UR-BR-057`, `UR-BR-058`, `UR-BR-059`, `UR-BR-060`, `UR-BR-061`,
`UR-BR-062`, `UR-BR-063`, `UR-OD-001`, `UR-OD-002`, `UR-OD-003`,
`UR-OD-004`, `UR-OD-005`, `UR-OD-006`, `UR-OD-007`, `UR-OD-008`,
`UR-OD-009`, `UR-OD-010`, `UR-OD-011`, and `UR-OD-012`.

Additional individual keys retained from the approved requirements are:
`UR-INIT-002` (QA-TRANS-001), `UR-BUYER-002` (QA-TRANS-002),
`UR-INIT-004` (QA-TRANS-002), `UR-SELLER-002` (QA-TRANS-001),
`UR-ADMIN-017` (QA-FIN-004), `UR-SYSTEM-010` (QA-TRANS-001),
`UR-CANCEL-005` (QA-CANCEL-003), `UR-CANCEL-010` (QA-CANCEL-011),
`UR-CANCEL-013` (QA-COMPLAINT-001), `UR-CANCEL-014` (QA-COMPLAINT-002),
`UR-CANCEL-015` (QA-COMPLAINT-003), `UR-CANCEL-019` (QA-CANCEL-009),
`UR-CANCEL-020` (QA-CANCEL-009), `UR-CANCEL-021` (QA-RISK-001),
`UR-BR-028` (QA-TRANS-001), `UR-BR-029` (QA-TRANS-001),
`UR-BR-031` (QA-TRANS-001), and `UR-BR-064` (QA-LAUNCH-001).

Explicit mapping for the individual keys: `UR-ADMIN-009` -> `QA-SEC-002`;
`UR-ADMIN-010` -> `QA-SEC-002`; `UR-ADMIN-021` -> `QA-FIN-006`;
`UR-ADMIN-022` -> `QA-FIN-006`; `UR-ADMIN-024` -> `QA-SEC-003`;
`UR-ADMIN-025` -> `QA-RISK-002`; `UR-ADMIN-026` -> `QA-SEC-005`;
`UR-FINANCIAL-002` -> `QA-FIN-002`; `UR-SYSTEM-008` -> `QA-EXP-002`;
`UR-SYSTEM-011` -> `QA-UI-002`; `UR-PARTICIPANT-002` -> `QA-UI-001`;
`UR-PARTICIPANT-003` -> `QA-WA-003`; `UR-BUYER-010` -> `QA-PAY-008`;
`UR-CANCEL-012` -> `QA-CANCEL-004`; `UR-INIT-002` -> `QA-TRANS-001`;
`UR-BUYER-002` -> `QA-TRANS-002`; `UR-INIT-004` -> `QA-TRANS-002`;
`UR-SELLER-002` -> `QA-TRANS-001`; `UR-ADMIN-017` -> `QA-FIN-004`;
`UR-SYSTEM-010` -> `QA-TRANS-001`; `UR-CANCEL-005` -> `QA-CANCEL-003`;
`UR-CANCEL-010` -> `QA-CANCEL-011`; `UR-CANCEL-013` -> `QA-COMPLAINT-001`;
`UR-CANCEL-014` -> `QA-COMPLAINT-002`; `UR-CANCEL-015` -> `QA-COMPLAINT-003`;
`UR-CANCEL-019` -> `QA-CANCEL-009`; `UR-CANCEL-020` -> `QA-CANCEL-009`;
`UR-CANCEL-021` -> `QA-RISK-001`; `UR-BR-002` -> `QA-TRANS-005`;
`UR-BR-003` -> `QA-SEC-001`; `UR-BR-004` -> `QA-SEC-001`;
`UR-BR-005` -> `QA-UI-003`; `UR-BR-006` -> `QA-UI-003`;
`UR-BR-007` -> `QA-UI-003`; `UR-BR-008` -> `QA-UI-004`;
`UR-BR-009` -> `QA-UI-004`; `UR-BR-010` -> `QA-UI-004`;
`UR-BR-011` -> `QA-UI-005`; `UR-BR-015` -> `QA-UI-005`;
`UR-BR-018` -> `QA-UI-005`; `UR-BR-019` -> `QA-UI-005`;
`UR-BR-022` -> `QA-COMPLAINT-003`; `UR-BR-023` -> `QA-COMPLAINT-003`;
`UR-BR-024` -> `QA-COMPLAINT-003`; `UR-BR-028` -> `QA-TRANS-001`;
`UR-BR-029` -> `QA-TRANS-001`; `UR-BR-031` -> `QA-TRANS-001`;
`UR-BR-048` -> `QA-EXP-001`; `UR-BR-049` -> `QA-EXP-003`;
`UR-BR-050` -> `QA-EXP-004`; `UR-BR-051` -> `QA-CANCEL-002`;
`UR-BR-052` -> `QA-CANCEL-004`; `UR-BR-053` -> `QA-CANCEL-005`;
`UR-BR-054` -> `QA-CANCEL-006`; `UR-BR-055` -> `QA-CANCEL-010`;
`UR-BR-056` -> `QA-CANCEL-013`; `UR-BR-057` -> `QA-CANCEL-014`;
`UR-BR-058` -> `QA-RISK-002`; `UR-BR-059` -> `QA-SEC-002`;
`UR-BR-060` -> `QA-SEC-003`; `UR-BR-061` -> `QA-SEC-003`;
`UR-BR-062` -> `QA-UI-002`; `UR-BR-063` -> `QA-UI-006`;
`UR-BR-064` -> `QA-LAUNCH-001`; `UR-OD-001` -> `QA-CANCEL-010`;
`UR-OD-002` -> `QA-CANCEL-014`; `UR-OD-003` -> `QA-SLA-001`;
`UR-OD-004` -> `QA-SLA-001`; `UR-OD-005` -> `QA-SLA-002`;
`UR-OD-006` -> `QA-SLA-002`; `UR-OD-007` -> `QA-SEC-004`;
`UR-OD-008` -> `QA-SEC-004`; `UR-OD-009` -> `QA-SEC-005`;
`UR-OD-010` -> `QA-NOTIFY-001`; `UR-OD-011` -> `QA-NOTIFY-001`;
`UR-OD-012` -> `QA-NOTIFY-001`.

Explicit Midtrans decision coverage: `PB-MP-001` -> `QA-MP-001`;
`PB-MP-002` -> `QA-MP-001`; `PB-MP-003` -> `QA-MP-003`;
`PB-MP-004` -> `QA-MP-005`; `PB-MP-005` -> `QA-MP-006`;
`PB-MP-006` -> `QA-MP-007`; `PB-MP-007` -> `QA-FIN-004`;
`PB-MP-008` -> `QA-FIN-004`; `PB-MP-009` -> `QA-LAUNCH-001`;
`PB-MP-OD-001` -> `QA-MP-001`; `PB-MP-OD-002` -> `QA-MP-005`;
`PB-MP-OD-003` -> `QA-MP-006`; `PB-MP-OD-004` -> `QA-MP-007`;
`PB-MP-OD-005` -> `QA-LAUNCH-001`.

## 3. Scenario List

| ID | Type | Actor | Scenario | Preconditions | Expected result | Priority | Manual/system |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `QA-ACCOUNT-001` | Happy | Buyer/Seller/Admin | Complete account and WhatsApp prerequisite | New account | Account can enter its allowed area | P0 | System |
| `QA-ACCOUNT-002` | Negative/Security | Buyer/Seller | Reject missing, invalid, duplicate, or unverified WhatsApp | Incomplete account | Participation is blocked with actionable error | P0 | System |
| `QA-ACCOUNT-003` | Recovery | Buyer/Seller | Recover an active transaction after lost number | Active number unavailable | Account enters manual hold/recovery; number snapshot is not silently changed | P1 | Manual/system |
| `QA-TRANS-001` | Happy | Seller | Create seller-started transaction | Seller account complete; valid physical goods | Seller owns seller/payout data and invitation is created | P0 | System |
| `QA-TRANS-002` | Happy | Buyer | Create buyer-started transaction | Buyer account complete; valid physical goods | Buyer owns buyer/refund data; seller payout remains absent | P0 | System |
| `QA-TRANS-003` | Happy | Buyer/Seller | Join invitation with distinct opposite account | Valid single-use invitation | Role data is bound; same-account join is impossible | P0 | System |
| `QA-TRANS-004` | Negative | Buyer/Seller | Reject invalid, expired, revoked, reused, or wrong-role invitation | Invitation altered or expired | No role binding or invoice/payment link is created | P0 | System |
| `QA-TRANS-005` | Negative | Buyer/Seller | Reject invalid goods, amount, fee, or missing required data | Invalid transaction input | Field error shown; transaction cannot become payable | P0 | System |
| `QA-TRANS-006` | Edge | Buyer/Seller | Lock authoritative data when both sides complete | Both role datasets complete | Payable snapshot and original deadline are created once; material edits are blocked | P0 | System |
| `QA-MP-001` | Happy/Idempotency | System/Admin | Create one Midtrans invoice after both role datasets complete | Frozen terms; no active invoice | One Invoice API request with `payment_type: payment_link`; duplicate request returns same invoice | P0 | System/provider |
| `QA-MP-002` | Security | Buyer/Seller/Admin | Protect Midtrans invoice data and provider credentials | Invoice exists | Client receives permitted link/status only; secrets and raw provider data never leak | P0 | System |
| `QA-MP-003` | Happy | Buyer | Open hosted Midtrans payment page | Active invoice; deadline active | Hosted checkout opens with frozen amount and no manual bank instruction | P0 | System/provider |
| `QA-MP-004` | Negative/Edge | System | Reject non-authoritative Midtrans payment statuses | Pending/capture/deny/cancel/failure/expire event | Payment is not marked paid and no WhatsApp/payout action unlocks | P0 | System/provider |
| `QA-MP-005` | Happy/Security | System/Admin | Accept authoritative Midtrans settlement | Valid signature, order ID, amount, `settlement`, `fraud_status=accept` | Payment becomes confirmed exactly once with audit evidence | P0 | System/provider |
| `QA-MP-006` | Recovery/Security | System/Admin | Handle invalid, duplicate, delayed, and out-of-order webhook | Provider events with invalid signature/order/amount/order | Invalid events are rejected; stale/duplicate events are idempotent; newer authority is not overwritten | P0 | System/provider |
| `QA-MP-007` | Recovery | Admin | Reconcile UNKNOWN or provider outage with Get Status API | Ambiguous event or unavailable provider response | Payment remains non-authoritative until authoritative result; deadline does not reset | P0 | Manual/system |
| `QA-MP-008` | Edge/Recovery | System/Admin | Handle expired or late Midtrans payment | Invoice expired or provider success arrives after expiry/cancellation | Transaction remains closed; late funds follow refund-only reconciliation | P0 | Manual/system |
| `QA-PAY-001` | Happy | Buyer | View hosted Midtrans payment link | Payable transaction; deadline active | Frozen amount, invoice link, provider status, and original WIB deadline are visible | P0 | System/provider |
| `QA-PAY-002` | Negative | Buyer | Ensure no client action confirms payment | Active invoice | `Cek status pembayaran` only refreshes; no `Sudah Bayar` action exists | P0 | System |
| `QA-PAY-003` | Happy | Buyer/Admin | Refresh and reconcile Midtrans payment status | Invoice active or provider event pending | Refresh does not reset deadline; Admin sees event/reconciliation task; no automatic confirmation | P0 | Manual/system |
| `QA-PAY-004` | Happy | Admin | Accept authoritative Midtrans payment | Valid settlement + fraud accept event | `PAYMENT_CONFIRMED` is recorded exactly once with provider evidence | P0 | Manual/system |
| `QA-PAY-005` | Negative | Admin | Handle definitive non-paid Midtrans result before deadline | Provider result is deny/cancel/failure/expire; deadline future | Payment waiting remains; original deadline is unchanged | P0 | Manual/system |
| `QA-PAY-006` | Edge | Admin | Handle definitive non-paid result after deadline | Provider result is non-paid; deadline passed | Transaction expires; no extension or fulfillment | P0 | Manual/system |
| `QA-PAY-007` | Recovery | Admin | Recover provider outage, UNKNOWN, or ambiguous event | No authoritative provider result in target time | Remains pending or becomes manual review; system never infers paid/non-paid | P0 | Manual/system |
| `QA-PAY-008` | Security | Buyer/Seller/Admin | Enforce payment visibility and provider-data masking | Transaction has financial data | Buyer sees permitted invoice; seller sees no payment secret; raw provider evidence is Admin-only | P0 | System |
| `QA-PAY-009` | Edge/Recovery | Buyer/Admin | Handle partial payment and top-up before the unchanged deadline | Partial transfer found; deadline future | Top-up remains tied to the original amount/deadline; no new deadline or fulfillment authorization | P0 | Manual/system |
| `QA-PAY-010` | Negative/Recovery | Admin | Handle excess, duplicate, and late payment | Mismatched or late funds found | Exception is isolated and refund-only; transaction is not revived | P0 | Manual/system |
| `QA-WA-001` | Happy | Admin | Create and record correct WhatsApp group | Payment confirmed; participant snapshots available | Group checkpoint records group reference, participants, operator, and time | P0 | Manual/system |
| `QA-WA-002` | Negative | Admin | Reject wrong group, wrong participant, or duplicate group checkpoint | Incorrect group data | Fulfillment remains blocked; correction is audited | P0 | Manual/system |
| `QA-WA-003` | Happy | Admin/Seller/Buyer | Announce payment and record separate completion checkpoints | Group recorded; payment confirmed | Seller can ship; seller and buyer reports remain separate; link waits for both | P0 | Manual/system |
| `QA-WA-004` | Recovery | Admin | Handle WhatsApp delivery failure or retry | Group or announcement delivery fails | Retry is visible; notification failure does not alter trusted transaction state | P1 | Manual/system |
| `QA-CONF-001` | Happy | Buyer/Admin | Generate, post, and open buyer confirmation link | Both completion checkpoints recorded | Link binds buyer and starts distinct 2x24-hour confirmation window | P0 | Manual/system |
| `QA-CONF-002` | Happy | Buyer | Confirm receipt with valid WhatsApp OTP | Link active; OTP sent to frozen group number | OTP records receipt and makes payout eligible only if no hold exists | P0 | System |
| `QA-CONF-003` | Negative/Security | Buyer | Reject invalid, old, reused, excessive, or early OTP | OTP invalid, expired, or locked | Confirmation is rejected; five-attempt/30-minute lock rules apply | P0 | System |
| `QA-CONF-004` | Recovery | Buyer/Admin | Recover OTP resend or delivery failure | Same WhatsApp snapshot; resend eligible | Resend waits 60 seconds, limits sends, and routes persistent failure to manual review | P1 | Manual/system |
| `QA-CONF-005` | Timeout | Buyer/Admin | Handle buyer silence after confirmation link | No valid OTP | Reminder after 1x24 hours; overdue after 2x24; payout remains blocked | P0 | Manual/system |
| `QA-FIN-001` | Happy | Admin | Start eligible payout to seller | Valid confirmation or controlled exception; no hold | Unique operation starts `PAYOUT_PROCESSING`; no premature success | P0 | Manual/system |
| `QA-FIN-002` | Happy | Admin | Record successful seller payout | Processing operation; bank reference | Immutable success evidence produces `PAID_OUT` | P0 | Manual/system |
| `QA-FIN-003` | Failure/Recovery | Admin | Handle failed or unknown payout | Payout attempt fails or is ambiguous | `FAILED` may retry; `UNKNOWN` requires reconciliation before retry | P0 | Manual/system |
| `QA-FIN-004` | Happy | Admin | Record agreed full refund | Approved refund; frozen buyer destination | `REFUND_PROCESSING` then `REFUNDED` only after bank success | P0 | Manual/system |
| `QA-FIN-005` | Happy | Admin | Record split settlement | Approved split; both legs calculated | Buyer and seller legs are independently evidenced; terminal state waits for both | P1 | Manual/system |
| `QA-FIN-006` | Security | Admin | Enforce Admin task assignment and approval threshold | Financial operation exists | Unauthorized internal Admin task cannot act; required second participant keeps action disabled | P0 | Manual/system |
| `QA-FIN-007` | Negative/Edge | Admin | Validate split amounts and transfer order | Approved split outcome | Buyer plus seller portions equal the split pool; buyer leg is attempted before seller leg | P1 | Manual/system |
| `QA-FIN-008` | Security | Admin | Enforce two-admin approval and ordinary payout re-authentication | Controlled financial action exists | Missing second participant or re-auth keeps action disabled; valid authorization is auditable | P0 | Manual/system |
| `QA-COMPLAINT-001` | Happy | Buyer/Seller/Admin | Record complaint before payout processing | Complaint reported in WhatsApp | Admin checkpoint creates `PAYOUT_ON_HOLD`; no automatic adjudication | P0 | Manual/system |
| `QA-COMPLAINT-002` | Negative | Buyer/Seller/Admin | Prevent payout/exception while complaint unresolved | Active hold; no agreement | No release, refund, split, or exception action is enabled | P0 | System |
| `QA-COMPLAINT-003` | Happy | Admin | Record written mutual agreement | Hold active; evidence and amounts available | Exactly one approved outcome becomes available: seller release, refund, or split | P0 | Manual/system |
| `QA-COMPLAINT-004` | Recovery | Admin | Handle no agreement or post-processing complaint | No agreement or payout processing already started | Manual review remains visible; post-processing complaint does not silently reverse money | P1 | Manual/system |
| `QA-EXP-001` | Happy/Time | System | Expire unpaid transaction at original 1x24 deadline | Midtrans invoice available; no authoritative payment | State becomes terminal `PAYMENT_EXPIRED` | P0 | System |
| `QA-EXP-002` | Edge/Time | System | Do not expire while timely claim is under review | Claim submitted before deadline | Expiry pauses; original deadline is preserved | P0 | System |
| `QA-EXP-003` | Recovery | Admin | Resolve definitive non-paid provider result before deadline | Midtrans result is definitive non-paid; deadline future | Returns to payment waiting with remaining original time | P0 | Manual/system |
| `QA-EXP-004` | Edge | Admin | Refund late or unmatched funds after expiry | Expired transaction receives money | Refund-only exception; transaction never revives | P0 | Manual/system |
| `QA-CANCEL-001` | Happy | Initiator | Cancel before counterparty joins | Initiator-only eligible state | Direct `CANCELLED`; invitation revoked; no refund operation or fee | P0 | System |
| `QA-CANCEL-002` | Happy | Buyer/Seller | Cancel after both parties join but before invoice creation | Both roles complete; not payable | Direct `CANCELLED`; no payment or fee | P0 | System |
| `QA-CANCEL-003` | Happy | Buyer/Seller | Submit cancellation after invoice creation but before provider review | Invoice active; no provider review | `CANCELLATION_PENDING_RECONCILIATION`; invoice inactive | P0 | System/manual |
| `QA-CANCEL-004` | Edge | Buyer/Seller/Admin | Cancel while Midtrans payment is under review | Provider review active | Existing provider review stays authoritative; no duplicate reconciliation | P0 | Manual/system |
| `QA-CANCEL-005` | Happy | Admin | Reconcile cancellation with definitive non-paid provider result | Reconciliation active; definitive non-paid result | `CANCELLED`; no automatic refund or payout | P0 | Manual/system |
| `QA-CANCEL-006` | Happy | Admin | Reconcile cancellation with authoritative provider result | Reconciliation active; settlement + accept result | `FUNDED_CANCELLATION_REVIEW`; fulfillment and payout held | P0 | Manual/system |
| `QA-CANCEL-007` | Happy | Admin/Seller/Buyer | Collect funded-cancellation responses and seller shipment statement | Funded review; correct WA group | Separate response/checkpoint records; unverified WA text has no authority | P0 | Manual/system |
| `QA-CANCEL-008` | Timeout | System/Admin | Timeout funded-cancellation response | WA request checkpoint; no required response for 1x24 hours | `MANUAL_REVIEW_REQUIRED`; no refund, payout, or fulfillment | P0 | Manual/system |
| `QA-CANCEL-009` | Negative | Admin | Stop cancellation when seller says shipped or evidence conflicts | Funded cancellation; shipment/conflict evidence | Route to complaint and `PAYOUT_ON_HOLD`; cancellation result unavailable | P0 | Manual/system |
| `QA-CANCEL-010` | Happy | Admin | Calculate cause-based cancellation refund | Approved cause and verified funds | Correct service-fee treatment and frozen destination are shown; no ad hoc override | P0 | Manual/system |
| `QA-CANCEL-011` | Recovery | Admin | Process cancellation refund and late-fund refund | Approved outcome or late funds | Only successful transfer reaches `REFUNDED`; late funds never revive transaction | P0 | Manual/system |
| `QA-CANCEL-012` | Negative | Buyer/Seller/Admin | Reject cancellation after shipment, financial processing, or terminal state | Cutoff state reached | Request rejected and audited; existing financial operation is not reversed | P0 | System |
| `QA-CANCEL-013` | Recovery | Requester/Admin | Withdraw or reject cancellation safely | Request active; no authoritative decision/financial operation | Withdrawal/rejection restores only a still-valid prior state; otherwise manual review | P1 | Manual/system |
| `QA-CANCEL-014` | Edge | Buyer/Seller/Admin | Apply cancellation reason, note, and immutable correction | Cancellation request submitted | Taxonomy enforced; `OTHER_MANUAL_REVIEW` requires note; correction appends audit event | P0 | System/manual |
| `QA-RISK-001` | Happy | Admin | Create and review outcome-neutral risk hold | Prohibited item or suspected fraud signal | `RISK_HOLD`; fulfillment, payout, and automatic refund blocked | P0 | Manual/system |
| `QA-RISK-002` | Security/Recovery | Admin/Buyer/Seller | Enforce risk visibility and authorized outcome | Risk hold active | Participants see generic status only; Admin actions are audited; missing decision leaves hold | P0 | Manual/system |
| `QA-SEC-001` | Security | Buyer/Seller | Prevent cross-account role or data access | Two distinct accounts and active transaction | Wrong role cannot edit payout/refund/contact data or use protected link | P0 | System |
| `QA-SEC-002` | Security | Admin | Enforce product-role boundary | Admin task assignments configured | Ops/Finance/Supervisor labels do not create extra product roles; unauthorized task is denied | P0 | System |
| `QA-SEC-003` | Security | Buyer/Seller/Admin | Mask financial and WhatsApp evidence | Transaction has sensitive data | Participants see permitted summary/masked digits; raw evidence is Admin-only | P0 | System |
| `QA-SEC-004` | Edge | Any actor | Reject stale, duplicate, and concurrent mutation | Same transaction/version receives parallel actions | One active cancellation; duplicate returns same result; conflict is rejected and audited | P0 | System |
| `QA-SEC-005` | Audit | Admin | Preserve append-only audit and immutable financial evidence | Correction or successful transfer exists | New correction event is appended; original success evidence cannot be overwritten | P0 | System |
| `QA-UI-001` | Interaction/Accessibility | Buyer/Seller/Admin | Render primary, disabled, loading, success, empty, and error states | Each relevant screen state seeded | Current status and next actor remain visible; actions do not shift or duplicate | P1 | System |
| `QA-UI-002` | Interaction | Buyer/Seller/Admin | Render expired, unauthorized, manual-review, and recovery states | Expiry/auth/review fixture available | Message explains state and only valid recovery action is offered | P0 | System |
| `QA-UI-003` | Accessibility | Buyer/Seller/Admin | Verify labels, focus, announcements, contrast, and non-color status | Supported browser viewport | Keyboard and assistive technology can complete relevant actions; status is not color-only | P1 | System |
| `QA-UI-004` | Responsive | Buyer/Seller/Admin | Verify mobile-width surface on mobile and desktop browser | Small mobile and wide browser viewports | App remains constrained mobile-width on desktop; no horizontal clipping or overlapping text | P1 | System |
| `QA-UI-005` | Content | Buyer/Seller/Admin | Verify Indonesian copy and stable status terminology | All primary screens | Product terms and status IDs remain consistent; no deprecated terms appear | P1 | System |
| `QA-UI-006` | Recovery | Buyer/Seller/Admin | Recover after refresh, network failure, or duplicate tap | Action in progress or failed | Trusted state reloads; failed action is not shown as successful; retry is safe | P0 | System |
| `QA-SLA-001` | Edge/Time | Admin/System | Apply operating hours to manual actions and reconciliation | Action begins before, during, or after 09.00-21.00 WIB | Two operating hours pause outside the window; deadline is displayed in WIB | P0 | Manual/system |
| `QA-SLA-002` | Timeout/Recovery | Admin/System | Escalate payment, payout, refund, and reconciliation SLA breach | Target deadline passes without authoritative result | Reminder is emitted every 1x24 hours; status remains held/manual review and no outcome is inferred | P0 | Manual/system |
| `QA-NOTIFY-001` | Failure/Recovery | System/Admin | Limit automatic notification attempts | Notification delivery repeatedly fails | At most three attempts; final failure is visible to Admin and does not change transaction state | P0 | System/manual |
| `QA-LAUNCH-001` | Non-UI/Release | Product Owner/Admin | Enforce real-money launch-readiness gate | Pilot release is proposed | Product remains test/prototype-only until bank/PJP, disclosures, complaint, data, and legal/compliance validation are recorded | P0 | Manual/release |

### 3.1 Individual Traceability Index

Every scenario in the Scenario List has an individual traceability entry below.
Additional IDs may be listed in its detailed block where the scenario spans
multiple requirements or screens.

| Scenario ID | User Requirement ID | UX Flow ID | UI-SCR/state ID |
| --- | --- | --- | --- |
| `QA-ACCOUNT-001` | `UR-ACCOUNT-001` | `UX-FLOW-001` | `UI-SCR-001` default/success |
| `QA-ACCOUNT-002` | `UR-ACCOUNT-001` | `UX-FLOW-001` | `UI-SCR-001` error/disabled |
| `QA-ACCOUNT-003` | `UR-ACCOUNT-002` | `UX-FLOW-001` | `UI-SCR-001`, `UI-SCR-009` manual-review |
| `QA-TRANS-001` | `UR-INIT-001` | `UX-FLOW-002` | `UI-SCR-002`, `UI-SCR-003` |
| `QA-TRANS-002` | `UR-INIT-003` | `UX-FLOW-007` | `UI-SCR-002`, `UI-SCR-004` |
| `QA-TRANS-003` | `UR-BUYER-001` | `UX-FLOW-005` | `UI-SCR-006`, `UI-SCR-007` |
| `QA-TRANS-004` | `UR-BUYER-001` | `UX-FLOW-005` | `UI-SCR-006` error/expired |
| `QA-TRANS-005` | `UR-SELLER-001` | `UX-FLOW-003` | `UI-SCR-003` error |
| `QA-TRANS-006` | `UR-SYSTEM-001` | `UX-FLOW-012` | `UI-SCR-009`, `UI-SCR-010` locked |
| `QA-MP-001` | `UR-PAYMENT-001`, `UR-PAYMENT-002` | `UX-FLOW-012`, `UX-FLOW-013` | `UI-SCR-009`, `UI-SCR-010` |
| `QA-MP-002` | `UR-PAYMENT-003`, `UR-PAYMENT-004` | `UX-FLOW-013`, `UX-FLOW-015` | `UI-SCR-010`, `UI-SCR-011` |
| `QA-MP-003` | `UR-BUYER-004`, `UR-PAYMENT-003` | `UX-FLOW-013` | `UI-SCR-010` |
| `QA-MP-004` | `UR-SYSTEM-007`, `UR-BUYER-009` | `UX-FLOW-046`, `UX-FLOW-048`, `UX-FLOW-049` | `UI-SCR-010`, `UI-SCR-011` |
| `QA-MP-005` | `UR-ADMIN-001`, `UR-ADMIN-002`, `UR-PAYMENT-004` | `UX-FLOW-015`, `UX-FLOW-016` | `UI-SCR-011`, `UI-SCR-012` |
| `QA-MP-006` | `UR-PAYMENT-004`, `UR-PAYMENT-005`, `UR-ADMIN-020` | `UX-FLOW-015`, `UX-FLOW-047`, `UX-FLOW-050` | `UI-SCR-011` |
| `QA-MP-007` | `UR-PAYMENT-006`, `UR-ADMIN-023`, `UR-BR-046` | `UX-FLOW-047`, `UX-FLOW-050` | `UI-SCR-011`, `UI-SCR-022` |
| `QA-MP-008` | `UR-SYSTEM-005`, `UR-SYSTEM-006`, `UR-PAYMENT-007`, `UR-BR-059` | `UX-FLOW-045`, `UX-FLOW-049`, `UX-FLOW-050` | `UI-SCR-010`, `UI-SCR-018`, `UI-SCR-020` |
| `QA-PAY-001` | `UR-BUYER-004` | `UX-FLOW-013` | `UI-SCR-010` default |
| `QA-PAY-002` | `UR-BR-033` | `UX-FLOW-047` | `UI-SCR-011` exception |
| `QA-PAY-003` | `UR-BUYER-005` | `UX-FLOW-014` | `UI-SCR-010` loading, `UI-SCR-011` pending |
| `QA-PAY-004` | `UR-ADMIN-002` | `UX-FLOW-016` | `UI-SCR-011`, `UI-SCR-012` success |
| `QA-PAY-005` | `UR-ADMIN-020` | `UX-FLOW-047` | `UI-SCR-011`, `UI-SCR-010` recovery |
| `QA-PAY-006` | `UR-SYSTEM-007` | `UX-FLOW-049` | `UI-SCR-020` expired |
| `QA-PAY-007` | `UR-ADMIN-001` | `UX-FLOW-015` | `UI-SCR-011` manual-review |
| `QA-PAY-008` | `UR-BR-045` | `UX-FLOW-019` | `UI-SCR-009`, `UI-SCR-010` privacy |
| `QA-PAY-009` | `UR-BR-034` | `UX-FLOW-048` | `UI-SCR-010`, `UI-SCR-011` exception |
| `QA-PAY-010` | `UR-BR-035` | `UX-FLOW-049` | `UI-SCR-018`, `UI-SCR-020` |
| `QA-WA-001` | `UR-ADMIN-003` | `UX-FLOW-017` | `UI-SCR-012` group checkpoint |
| `QA-WA-002` | `UR-ADMIN-003` | `UX-FLOW-017` | `UI-SCR-012` error |
| `QA-WA-003` | `UR-PARTY-001` | `UX-FLOW-020` | `UI-SCR-012`, `UI-SCR-013` |
| `QA-WA-004` | `UR-BR-044` | `UX-FLOW-018` | `UI-SCR-012` recovery |
| `QA-CONF-001` | `UR-ADMIN-005` | `UX-FLOW-022` | `UI-SCR-013` |
| `QA-CONF-002` | `UR-BUYER-007` | `UX-FLOW-024` | `UI-SCR-014` |
| `QA-CONF-003` | `UR-BR-036` | `UX-FLOW-024` | `UI-SCR-014` error/locked |
| `QA-CONF-004` | `UR-BUYER-008` | `UX-FLOW-033` | `UI-SCR-014` recovery |
| `QA-CONF-005` | `UR-SYSTEM-003` | `UX-FLOW-029` | `UI-SCR-015` overdue |
| `QA-FIN-001` | `UR-ADMIN-006` | `UX-FLOW-025` | `UI-SCR-016` processing |
| `QA-FIN-002` | `UR-ADMIN-007` | `UX-FLOW-026` | `UI-SCR-020` success |
| `QA-FIN-003` | `UR-BR-042` | `UX-FLOW-026` | `UI-SCR-016` error/manual-review |
| `QA-FIN-004` | `UR-ADMIN-016` | `UX-FLOW-040` | `UI-SCR-018`, `UI-SCR-020` |
| `QA-FIN-005` | `UR-ADMIN-018` | `UX-FLOW-042` | `UI-SCR-019`, `UI-SCR-020` |
| `QA-FIN-006` | `UR-BR-039` | `UX-FLOW-025` | `UI-SCR-016` permission |
| `QA-FIN-007` | `UR-BR-038` | `UX-FLOW-042` | `UI-SCR-019` validation |
| `QA-FIN-008` | `UR-BR-040` | `UX-FLOW-025` | `UI-SCR-016` permission |
| `QA-COMPLAINT-001` | `UR-ADMIN-012` | `UX-FLOW-035` | `UI-SCR-017` |
| `QA-COMPLAINT-002` | `UR-PARTY-004` | `UX-FLOW-036` | `UI-SCR-017`, `UI-SCR-016` disabled |
| `QA-COMPLAINT-003` | `UR-ADMIN-014` | `UX-FLOW-038` | `UI-SCR-017`, `UI-SCR-018`, `UI-SCR-019` |
| `QA-COMPLAINT-004` | `UR-ADMIN-013` | `UX-FLOW-037` | `UI-SCR-017`, `UI-SCR-009` manual-review |
| `QA-EXP-001` | `UR-SYSTEM-005` | `UX-FLOW-045` | `UI-SCR-020` expired |
| `QA-EXP-002` | `UR-BUYER-009` | `UX-FLOW-046` | `UI-SCR-010`, `UI-SCR-011` pending |
| `QA-EXP-003` | `UR-SYSTEM-006` | `UX-FLOW-048` | `UI-SCR-010` recovery |
| `QA-EXP-004` | `UR-BR-035` | `UX-FLOW-049` | `UI-SCR-018`, `UI-SCR-020` |
| `QA-CANCEL-001` | `UR-CANCEL-002` | `UX-FLOW-052` | `UI-SCR-021`, `UI-SCR-020` |
| `QA-CANCEL-002` | `UR-CANCEL-003` | `UX-FLOW-053` | `UI-SCR-021`, `UI-SCR-020` |
| `QA-CANCEL-003` | `UR-CANCEL-004` | `UX-FLOW-054` | `UI-SCR-021`, `UI-SCR-022` |
| `QA-CANCEL-004` | `UR-CANCEL-011` | `UX-FLOW-061` | `UI-SCR-011`, `UI-SCR-021` |
| `QA-CANCEL-005` | `UR-CANCEL-006` | `UX-FLOW-056` | `UI-SCR-022`, `UI-SCR-020` |
| `QA-CANCEL-006` | `UR-CANCEL-007` | `UX-FLOW-057` | `UI-SCR-022`, `UI-SCR-023` |
| `QA-CANCEL-007` | `UR-CANCEL-016` | `UX-FLOW-065` | `UI-SCR-023`, `UI-SCR-017` |
| `QA-CANCEL-008` | `UR-CANCEL-017` | `UX-FLOW-067` | `UI-SCR-009`, `UI-SCR-023` manual-review |
| `QA-CANCEL-009` | `UR-CANCEL-018` | `UX-FLOW-068` | `UI-SCR-017`, `UI-SCR-023` hold |
| `QA-CANCEL-010` | `UR-CANCEL-008` | `UX-FLOW-058` | `UI-SCR-018`, `UI-SCR-023` |
| `QA-CANCEL-011` | `UR-CANCEL-009` | `UX-FLOW-059` | `UI-SCR-018`, `UI-SCR-020` |
| `QA-CANCEL-012` | `UR-CANCEL-024` | `UX-FLOW-074` | `UI-SCR-021`, `UI-SCR-020` cutoff |
| `QA-CANCEL-013` | `UR-CANCEL-025` | `UX-FLOW-075` | `UI-SCR-021`, `UI-SCR-009` recovery |
| `QA-CANCEL-014` | `UR-CAN-OD-001` | `UX-FLOW-051` | `UI-SCR-021`, `UI-SCR-022` |
| `QA-RISK-001` | `UR-CANCEL-022` | `UX-FLOW-072` | `UI-SCR-024`, `UI-SCR-009` |
| `QA-RISK-002` | `UR-CANCEL-023` | `UX-FLOW-073` | `UI-SCR-024`, `UI-SCR-009` privacy |
| `QA-SEC-001` | `UR-BR-045` | `UX-FLOW-005` | `UI-SCR-006`, `UI-SCR-007`, `UI-SCR-008` unauthorized |
| `QA-SEC-002` | `UR-BR-039` | `UX-FLOW-072` | `UI-SCR-024` permission |
| `QA-SEC-003` | `UR-BR-045` | `UX-FLOW-017` | `UI-SCR-009`, `UI-SCR-012`, `UI-SCR-023` privacy |
| `QA-SEC-004` | `UR-CAN-OD-007` | `UX-FLOW-055` | `UI-SCR-022`, `UI-SCR-018` |
| `QA-SEC-005` | `UR-CAN-OD-007` | `UX-FLOW-071` | `UI-SCR-018`, `UI-SCR-020` audit |
| `QA-UI-001` | `UR-PARTICIPANT-001` | `UX-FLOW-012` | `UI-SCR-001` to `UI-SCR-024` relevant states |
| `QA-UI-002` | `UR-SYSTEM-005` | `UX-FLOW-045` | `UI-SCR-009`, `UI-SCR-020` |
| `QA-UI-003` | `UR-BR-001` | `UX-FLOW-001` | `UI-SCR-001` to `UI-SCR-024` accessibility |
| `QA-UI-004` | `UR-BR-001` | `UX-FLOW-012` | `UI-SCR-001` to `UI-SCR-024` responsive |
| `QA-UI-005` | `UR-BR-044` | `UX-FLOW-012` | `UI-SCR-009`, `UI-SCR-020` content |
| `QA-UI-006` | `UR-CAN-OD-007` | `UX-FLOW-051` | `UI-SCR-009`, `UI-SCR-021` recovery |
| `QA-SLA-001` | `UR-CAN-OD-003` | `UX-FLOW-055` | `UI-SCR-022`, `UI-SCR-023` |
| `QA-SLA-002` | `UR-CAN-OD-008` | `UX-FLOW-066` | `UI-SCR-011`, `UI-SCR-018`, `UI-SCR-022` |
| `QA-NOTIFY-001` | `UR-BR-044` | `UX-FLOW-018` | `UI-SCR-012`, `UI-SCR-013` |
| `QA-LAUNCH-001` | `UR-BR-046` | Non-UI release gate | Non-UI release gate |

## 4. Detailed Scenarios

The following scenarios are the executable minimum for P0 coverage. P1
scenarios in the list remain required for release-quality review.

### QA-ACCOUNT-001: Account And WhatsApp Prerequisite

```text
Scenario ID: QA-ACCOUNT-001
Requirement IDs: UR-ACCOUNT-001, UR-ACCOUNT-002, UR-BR-026
UX Flow IDs: UX-FLOW-001
UI IDs/states: UI-SCR-001 default, loading, success
Title: Complete account and mandatory WhatsApp prerequisite
Type: Happy
Priority: P0

Given:
- A new account opens BayarAman.
When:
1. Enter valid identity and WhatsApp data.
2. Complete the verification step.
3. Continue to the role start area.
Then:
- The account is authenticated and can enter only its permitted product areas.
- The verified WhatsApp number is bound to the account.
- The next actor/action is visible.
Data setup:
- Use a unique valid WhatsApp number and test verification code.
Expected state transition:
ACCOUNT_SETUP_REQUIRED -> ACCOUNT_READY
Expected audit/notification:
- Verification result and account binding are recorded.
Cleanup:
- Remove or deactivate the test account according to test-environment policy.
```

### QA-TRANS-001: Seller-Created Transaction

```text
Scenario ID: QA-TRANS-001
Requirement IDs: UR-INIT-001, UR-SELLER-001, UR-INIT-002, UR-SYSTEM-010, UR-BR-001, UR-BR-029 to UR-BR-031
UX Flow IDs: UX-FLOW-002 to UX-FLOW-004
UI IDs/states: UI-SCR-002, UI-SCR-003, UI-SCR-005
Title: Seller creates a valid physical-goods transaction
Type: Happy
Priority: P0

Given:
- Seller account is ready and no counterparty is joined.
When:
1. Select Start as Seller.
2. Enter valid item, shipping, seller, WhatsApp, and payout data.
3. Submit the transaction.
Then:
- Seller role is assigned to the initiator.
- Shared data and seller-owned payout data are stored under seller ownership.
- Buyer invitation is generated and no invoice/payment link is shown.
Data setup:
- Use a legal shippable physical item and item price within the approved range.
Expected state transition:
ACCOUNT_READY -> WAITING_COUNTERPARTY
Expected audit/notification:
- Transaction creation and invitation reference are recorded.
Cleanup:
- Cancel the unfunded transaction after the scenario.
```

### QA-TRANS-002: Buyer-Created Transaction

```text
Scenario ID: QA-TRANS-002
Requirement IDs: UR-INIT-003, UR-BUYER-003, UR-INIT-004, UR-BR-001, UR-BR-032, UR-BR-037
UX Flow IDs: UX-FLOW-007 to UX-FLOW-009
UI IDs/states: UI-SCR-002, UI-SCR-004, UI-SCR-005
Title: Buyer creates a valid transaction without authoring seller payout data
Type: Happy
Priority: P0

Given:
- Buyer account is ready.
When:
1. Select Start as Buyer.
2. Enter shared deal, buyer, WhatsApp, address, and refund data.
3. Submit the transaction.
Then:
- Buyer role is assigned to the initiator.
- Seller invitation is generated.
- Seller payout data remains absent until the seller joins and authors it.
- Invoice/payment link is unavailable.
Data setup:
- Use a valid buyer-owned refund destination.
Expected state transition:
ACCOUNT_READY -> WAITING_COUNTERPARTY
Expected audit/notification:
- Buyer-owned snapshots and invitation are recorded.
Cleanup:
- Cancel the unfunded transaction after the scenario.
```

### QA-TRANS-003: Distinct Counterparty Join

```text
Scenario ID: QA-TRANS-003
Requirement IDs: UR-BUYER-001, UR-BUYER-002, UR-SELLER-002, UR-SELLER-003, UR-SYSTEM-001, UR-BR-026 to UR-BR-028
UX Flow IDs: UX-FLOW-005, UX-FLOW-006, UX-FLOW-010 to UX-FLOW-012
UI IDs/states: UI-SCR-006, UI-SCR-007, UI-SCR-008, UI-SCR-009
Title: Distinct opposite account joins and completes its owned data
Type: Happy/Security
Priority: P0

Given:
- An invitation is valid and the initiator is already bound.
When:
1. Open the invitation as a different verified account.
2. Complete only the invited role's fields.
3. Refresh the transaction status.
Then:
- The opposite role is bound to the second account.
- Both role datasets complete only after their respective owners submit data.
- Payment becomes available exactly once after prerequisites are met.
Data setup:
- Use separate buyer and seller accounts with different verified WhatsApp numbers.
Expected state transition:
WAITING_COUNTERPARTY -> WAITING_BUYER_PAYMENT
Expected audit/notification:
- Join, data completion, payable timestamp, and original deadline are recorded.
Cleanup:
- Use the cancellation scenario for the created fixture.
```

### QA-PAY-003: Midtrans Status Refresh And Reconciliation

```text
Scenario ID: QA-PAY-003
Requirement IDs: UR-BUYER-004, UR-BUYER-005, UR-BUYER-009, UR-ADMIN-001, UR-ADMIN-020, UR-PAYMENT-004, UR-PAYMENT-006, UR-SYSTEM-005
UX Flow IDs: UX-FLOW-013 to UX-FLOW-016, UX-FLOW-044 to UX-FLOW-050
UI IDs/states: UI-SCR-010 default/loading, UI-SCR-011 pending/manual-review
Title: Buyer refreshes Midtrans status and Admin reconciles provider result
Type: Happy/Recovery/Manual operation
Priority: P0

Given:
- A payable transaction has an active Midtrans invoice and original deadline.
When:
1. Buyer opens the hosted Midtrans payment page.
2. Buyer returns and selects `Cek status pembayaran`.
3. Inject a pending or ambiguous provider result.
4. Admin validates webhook fields and uses Get Status API when required.
Then:
- Status refresh does not reset the original deadline or mark payment paid.
- Pending/ambiguous results remain under provider reconciliation.
- Only a validated `settlement` with `fraud_status=accept` can create `PAYMENT_CONFIRMED` exactly once.
Failure path:
- Invalid signature, order ID, amount, or fraud status is rejected and audited without a paid transition.
Timeout path:
- Provider outage/UNKNOWN remains non-authoritative and escalates to manual review.
Recovery path:
- Retry Get Status API; duplicate or stale events return the existing result and cannot overwrite newer authority.
Data setup:
- Use frozen buyer total, invoice ID, signed webhook fixtures, and ordered provider events.
Expected state transition:
WAITING_BUYER_PAYMENT -> PAYMENT_CONFIRMED only after settlement + fraud accept
Expected audit/notification:
- Invoice refresh, provider event validation, reconciliation, operator, time, and notification outcome are recorded.
Cleanup:
- Continue to WhatsApp checkpoint or reset the provider fixture.
```

### QA-WA-003: Group And Separate Completion Checkpoints

```text
Scenario ID: QA-WA-003
Requirement IDs: UR-ADMIN-003, UR-ADMIN-004, UR-SELLER-004, UR-PARTY-001, UR-PARTY-002, UR-ADMIN-005, UR-BR-013 to UR-BR-016
UX Flow IDs: UX-FLOW-017 to UX-FLOW-022
UI IDs/states: UI-SCR-012, UI-SCR-013, UI-SCR-009
Title: Admin records WhatsApp group, payment announcement, and two completion checkpoints
Type: Happy/Manual operation
Priority: P0

Given:
- Payment is confirmed and participant WhatsApp snapshots are frozen.
When:
1. Admin records the correct WhatsApp group and participant references.
2. Admin records the payment announcement.
3. Seller reports shipment and Admin records the seller checkpoint.
4. Buyer reports completion and Admin records the buyer checkpoint separately.
5. Admin generates and posts the confirmation link.
Then:
- Seller is allowed to fulfill only after payment announcement.
- One checkpoint cannot satisfy the other role.
- Confirmation link is created only after both checkpoints.
Data setup:
- Use the correct group and two distinct participant reports.
Expected state transition:
PAYMENT_CONFIRMED -> WAITING_SELLER_SHIPMENT -> READY_FOR_BUYER_CONFIRMATION
Expected audit/notification:
- Group, announcement, each checkpoint, link reference, operator, and time are recorded.
Cleanup:
- Continue to buyer confirmation scenario.
```

### QA-CONF-002: Buyer OTP Confirmation

```text
Scenario ID: QA-CONF-002
Requirement IDs: UR-BUYER-006, UR-BUYER-007, UR-BUYER-008, UR-SYSTEM-002, UR-BR-017 to UR-BR-020, UR-BR-036
UX Flow IDs: UX-FLOW-023 to UX-FLOW-024, UX-FLOW-033
UI IDs/states: UI-SCR-013, UI-SCR-014, UI-SCR-020
Title: Buyer confirms receipt using OTP sent to the frozen WhatsApp number
Type: Happy/Security
Priority: P0

Given:
- Both completion checkpoints exist and the confirmation link is active.
When:
1. Buyer opens the link.
2. System sends a six-digit OTP to the WhatsApp snapshot used for the group.
3. Buyer enters the newest valid OTP within five minutes.
Then:
- Receipt confirmation is recorded.
- `READY_FOR_PAYOUT` is shown only when no complaint or risk hold exists.
- OTP value and alternate channels are not exposed to other actors.
Data setup:
- Use the correct buyer account and frozen WhatsApp number.
Expected state transition:
READY_FOR_BUYER_CONFIRMATION -> READY_FOR_PAYOUT
Expected audit/notification:
- OTP request, confirmation actor/time, and delivery result are recorded without storing the raw OTP in participant views.
Cleanup:
- Continue to payout scenario or reset fixture.
```

### QA-FIN-001: Payout And Financial Recovery

```text
Scenario ID: QA-FIN-001
Requirement IDs: UR-ADMIN-006, UR-ADMIN-007, UR-SYSTEM-009, UR-ADMIN-015, UR-BR-037 to UR-BR-044
UX Flow IDs: UX-FLOW-025, UX-FLOW-026, UX-FLOW-039
UI IDs/states: UI-SCR-016, UI-SCR-020
Title: Admin executes an auditable payout and handles transfer outcomes
Type: Happy/Failure/Recovery
Priority: P0

Given:
- Transaction is payout-eligible, unheld, and seller destination is frozen.
When:
1. Admin starts a payout with required authorization.
2. System creates a unique operation ID and shows processing.
3. Record success, failure, and unknown outcomes in separate executions.
4. Retry only the failed operation; reconcile the unknown operation before retry.
Then:
- Success with immutable bank reference produces `PAID_OUT`.
- Failed remains non-terminal and retryable.
- Unknown remains non-terminal and blocks blind retry.
Data setup:
- Use fixtures for successful, failed, and ambiguous bank responses.
Expected state transition:
READY_FOR_PAYOUT -> PAYOUT_PROCESSING -> PAID_OUT, with operation result SUCCESS / FAILED / UNKNOWN
Expected audit/notification:
- Operation ID, amount, destination snapshot, operator, authorization, bank reference, and notification outcome are recorded.
Cleanup:
- Reconcile every non-success fixture and close test records.
```

### QA-CANCEL-003: Cancellation Pending Reconciliation

```text
Scenario ID: QA-CANCEL-003
Requirement IDs: UR-CANCEL-001, UR-CANCEL-004, UR-CANCEL-005, UR-CANCEL-006, UR-CANCEL-011, UR-BR-047 to UR-BR-052, UR-CAN-OD-002, UR-CAN-OD-003, UR-CAN-OD-007
UX Flow IDs: UX-FLOW-051, UX-FLOW-054 to UX-FLOW-063
UI IDs/states: UI-SCR-009, UI-SCR-010, UI-SCR-011, UI-SCR-021, UI-SCR-022
Title: Cancellation after invoice creation enters controlled reconciliation
Type: Happy/Edge/Manual operation
Priority: P0

Given:
- A Midtrans invoice exists and no terminal financial operation has started.
When:
1. Buyer or seller submits an eligible cancellation request.
2. System validates the current state version and deactivates the invoice/payment link.
3. Admin reconciles Midtrans webhook/Get Status API during operating hours.
4. Record either definitive non-paid or authoritative settlement result.
Then:
- State becomes `CANCELLATION_PENDING_RECONCILIATION` while unresolved.
- No automatic refund, payout, or transaction revival occurs.
- Definitive non-paid closes as `CANCELLED`; authoritative settlement enters funded cancellation review.
Data setup:
- Run with both definitive non-paid and settlement provider fixtures.
Expected state transition:
WAITING_BUYER_PAYMENT -> CANCELLATION_PENDING_RECONCILIATION -> CANCELLED / FUNDED_CANCELLATION_REVIEW
Expected audit/notification:
- Request ID, source state version, reconciliation ID, provider result/reference, operator, and deadline are recorded.
Cleanup:
- Complete the matching cancellation outcome scenario.
```

### QA-CANCEL-007: Funded Cancellation Evidence

```text
Scenario ID: QA-CANCEL-007
Requirement IDs: UR-CANCEL-007, UR-CANCEL-013, UR-CANCEL-014, UR-CANCEL-015, UR-CANCEL-016, UR-CAN-OD-001 to UR-CAN-OD-005, UR-BR-053 to UR-BR-057
UX Flow IDs: UX-FLOW-057, UX-FLOW-063 to UX-FLOW-071
UI IDs/states: UI-SCR-017, UI-SCR-018, UI-SCR-021, UI-SCR-023
Title: Admin evaluates funded cancellation before shipment
Type: Happy/Manual operation
Priority: P0

Given:
- Funds are verified and the transaction is in funded cancellation review.
When:
1. Admin posts the response request to the correct transaction group.
2. Seller states whether goods were shipped.
3. Buyer and seller responses are separately checkpointed.
4. Admin validates cause, evidence, risk, and refund calculation.
Then:
- Uncheckpointed WhatsApp messages do not authorize an outcome.
- Seller shipment statement and evidence conflict are visible.
- Approved cause determines fee treatment and refund amount; no ad hoc destination change is allowed.
Data setup:
- Run seller-not-shipped, seller-shipped, missing-response, and conflicting-evidence fixtures.
Expected state transition:
FUNDED_CANCELLATION_REVIEW -> REFUND_READY / PAYOUT_ON_HOLD / MANUAL_REVIEW_REQUIRED
Expected audit/notification:
- Message/evidence reference, immutable snapshot/hash, author, event time, recorder, cause, calculation, and decision are recorded.
Cleanup:
- Route each fixture to refund, complaint, or manual review completion.
```

### QA-CANCEL-008: Funded Response Timeout

```text
Scenario ID: QA-CANCEL-008
Requirement IDs: UR-CANCEL-017, UR-CANCEL-018, UR-CAN-OD-003, UR-CAN-OD-004, UR-CAN-OD-008, UR-BR-055, UR-BR-065
UX Flow IDs: UX-FLOW-064 to UX-FLOW-066
UI IDs/states: UI-SCR-009, UI-SCR-022, UI-SCR-023
Title: Missing funded-cancellation response becomes manual review
Type: Timeout/Recovery
Priority: P0

Given:
- Admin successfully recorded the message in the correct group.
When:
1. Advance time by 1x24 calendar hours without a required response.
2. Observe participant and Admin status.
3. Submit late evidence and perform manual recovery.
Then:
- State becomes `MANUAL_REVIEW_REQUIRED`.
- Silence does not authorize refund, payout, or fulfillment.
- A later response does not silently reset the original deadline.
Data setup:
- Use WIB timestamps and a message checkpoint reference.
Expected state transition:
FUNDED_CANCELLATION_REVIEW -> MANUAL_REVIEW_REQUIRED
Expected audit/notification:
- Timeout, escalation reminder, late evidence, and recovery decision are append-only recorded.
Cleanup:
- Leave unresolved case visible until an authorized Admin outcome is recorded.
```

### QA-CANCEL-009: Shipment Or Evidence Conflict

```text
Scenario ID: QA-CANCEL-009
Requirement IDs: UR-CANCEL-019, UR-CANCEL-020, UR-CANCEL-021, UR-PARTY-003, UR-ADMIN-012, UR-CAN-OD-002, UR-BR-056, UR-BR-062
UX Flow IDs: UX-FLOW-067 to UX-FLOW-071
UI IDs/states: UI-SCR-017, UI-SCR-020, UI-SCR-023
Title: Shipped goods or conflicting evidence stops cancellation
Type: Negative/Manual operation
Priority: P0

Given:
- A funded cancellation is under review.
When:
1. Admin records that goods were shipped, or records conflicting evidence.
2. Attempt to continue cancellation refund.
Then:
- Cancellation refund action is disabled.
- Transaction enters or joins complaint `PAYOUT_ON_HOLD` path.
- Participants see only the generic hold/review status.
Data setup:
- Use both shipment claim and contradictory evidence fixtures.
Expected state transition:
FUNDED_CANCELLATION_REVIEW -> PAYOUT_ON_HOLD
Expected audit/notification:
- Evidence and hold reason are recorded; no adjudication is inferred.
Cleanup:
- Resolve only through the approved complaint settlement path.
```

### QA-CANCEL-011: Refund And Late Funds

```text
Scenario ID: QA-CANCEL-011
Requirement IDs: UR-CANCEL-008, UR-CANCEL-009, UR-CANCEL-010, UR-CANCEL-022, UR-CANCEL-023, UR-ADMIN-016, UR-ADMIN-017, UR-CAN-OD-005, UR-CAN-OD-007, UR-CAN-OD-008, UR-BR-058, UR-BR-059
UX Flow IDs: UX-FLOW-040, UX-FLOW-041, UX-FLOW-058 to UX-FLOW-060, UX-FLOW-069 to UX-FLOW-071
UI IDs/states: UI-SCR-018, UI-SCR-020, UI-SCR-022, UI-SCR-023
Title: Process approved refund and late-fund refund without revival
Type: Happy/Failure/Recovery
Priority: P0

Given:
- An authorized refund calculation and destination exist, or late funds arrive after cancellation.
When:
1. Admin starts a refund operation.
2. Record success, failure, or unknown transfer result.
3. Reconcile unknown result before any retry.
Then:
- Correct cause-based amount and frozen destination are used.
- Only successful financial evidence/reference produces `REFUNDED`.
- Late funds are handled through a refund-only exception and cannot revive payment, fulfillment, or payout.
Data setup:
- Run buyer-change, neutral, seller-unable, BayarAman-error, and late-fund fixtures.
Expected state transition:
REFUND_READY -> REFUND_PROCESSING -> REFUNDED, with operation result SUCCESS / FAILED / UNKNOWN
Expected audit/notification:
- Calculation ID, operation ID, amount, source/destination, bank reference, and result are immutable/audited.
Cleanup:
- Reconcile failed/unknown records and leave no revived transaction actions.
```

### QA-CANCEL-012: Cancellation Cutoff

```text
Scenario ID: QA-CANCEL-012
Requirement IDs: UR-CANCEL-024, UR-CANCEL-025, UR-BR-062, UR-BR-063
UX Flow IDs: UX-FLOW-074, UX-FLOW-075
UI IDs/states: UI-SCR-009, UI-SCR-020, UI-SCR-021
Title: Reject cancellation after shipment or financial processing cutoff
Type: Negative/Security
Priority: P0

Given:
- Transaction is shipped, payout/refund processing, or terminal financial state.
When:
1. Buyer, seller, and Admin each attempt cancellation.
2. Requester attempts withdrawal or Admin attempts rejection/rollback.
Then:
- Cancellation is unavailable after the approved cutoff.
- Existing money movement is not stopped or reversed.
- Only a still-valid prior state may be restored; otherwise state becomes manual review.
Data setup:
- Use shipped, `PAYOUT_PROCESSING`, `REFUND_PROCESSING`, `PAID_OUT`, `REFUNDED`, and `CANCELLED` fixtures.
Expected state transition:
PAYMENT_CONFIRMED -> PAYOUT_ON_HOLD; PAYOUT_PROCESSING -> PAYOUT_PROCESSING; REFUND_PROCESSING -> REFUND_PROCESSING; PAID_OUT / REFUNDED / CANCELLED -> same terminal state
Expected audit/notification:
- Rejected action, source version, actor, and reason are recorded.
Cleanup:
- Keep terminal fixtures read-only.
```

### QA-RISK-001: Risk Hold

```text
Scenario ID: QA-RISK-001
Requirement IDs: UR-CANCEL-022, UR-CANCEL-023, UR-CAN-OD-006, UR-BR-060, UR-BR-061
UX Flow IDs: UX-FLOW-072, UX-FLOW-073
UI IDs/states: UI-SCR-024, UI-SCR-009
Title: Create outcome-neutral risk hold for prohibited item or suspected fraud
Type: Security/Manual operation
Priority: P0

Given:
- Admin identifies a prohibited-item, policy, or suspected-fraud concern.
When:
1. Admin creates `RISK_HOLD` with evidence and reason.
2. Buyer and seller open the transaction.
3. Admin attempts payout, fulfillment release, and automatic refund.
Then:
- `RISK_HOLD` blocks fulfillment, payout, and automatic refund.
- Participants see only generic hold/review status.
- Admin task assignment and every action are audited.
Data setup:
- Use prohibited-item and suspected-fraud fixtures.
Expected state transition:
PAYMENT_CONFIRMED -> RISK_HOLD
Expected audit/notification:
- Hold actor, reason category, evidence reference, task assignment, and timestamps are recorded.
Cleanup:
- Record an authorized outcome or leave the case held; do not infer a default financial result.
```

### QA-SEC-004: Idempotency And State Version Conflict

```text
Scenario ID: QA-SEC-004
Requirement IDs: UR-CAN-OD-007, UR-CANCEL-001, UR-CANCEL-002, UR-CANCEL-005, UR-CANCEL-008, UR-CANCEL-010, UR-BR-041, UR-BR-042, UR-BR-064, UR-BR-065
UX Flow IDs: UX-FLOW-051 to UX-FLOW-060, UX-FLOW-064 to UX-FLOW-071
UI IDs/states: UI-SCR-021, UI-SCR-022, UI-SCR-023, UI-SCR-018
Title: Reject stale and conflicting mutations while returning duplicate results safely
Type: Security/Concurrency/Recovery
Priority: P0

Given:
- A transaction has a known state version and one active cancellation request.
When:
1. Submit the same request twice.
2. Submit a second conflicting cancellation or financial action with the stale version.
3. Retry after a network timeout.
Then:
- Duplicate request returns the active or final result and creates no second operation.
- Conflicting action is rejected and audited.
- Financial success evidence remains immutable.
Data setup:
- Use concurrent requests with identical and different payloads.
Expected state transition:
CANCELLATION_PENDING_RECONCILIATION -> CANCELLATION_PENDING_RECONCILIATION or CANCELLED
Expected audit/notification:
- Unique request, reconciliation, checkpoint, calculation, operation, and source-version IDs are retained.
Cleanup:
- Reconcile any intentionally interrupted test operation.
```

### 4.1 Execution Contract For Every Listed Scenario

Every ID in the Scenario List, including P1 and Non-UI scenarios, must be
executed with the following fields. The scenario-specific values are defined
by its row and the traceability/coverage map; a scenario is not complete merely
because its happy-path expected result is listed.

```text
Scenario ID:
Actor:
Type:
Priority:
Preconditions:
Test steps:
1. Prepare the stated fixture and verify the starting status/version.
2. Perform the actor action stated in the Scenario List.
3. Observe the primary result, audit record, notification, and next actor.
4. Repeat the action, use an unauthorized actor, or inject the stated failure when the scenario is negative, security, or recovery type.
Expected result:
Failure path:
- Reject the invalid action, preserve the authoritative state, and show an actionable error unless the approved scenario specifies a hold/manual-review transition.
Timeout path:
- Preserve the active operation and deadline; escalate or enter the approved manual-review state when the relevant SLA expires.
Recovery path:
- Retry only an approved retryable operation, reconcile UNKNOWN before retry, and return the same active/final result for duplicate actions.
Expected status transition:
Audit/notification expectation:
Traceability:
- User Requirement IDs, UX Flow IDs, and UI-SCR/state IDs must be recorded for the individual scenario.
```

The following added scenarios provide the previously missing executable
coverage.

The records below complete the executable contract for every scenario that was
previously represented only in the Scenario List. Each row is an independent
test record, not a reference to the generic contract above.

| Scenario ID | Actor, precondition, and test steps | Expected/failure/timeout/recovery | Transition, audit, and notification | Individual traceability |
| --- | --- | --- | --- | --- |
| `QA-ACCOUNT-002` | Buyer/Seller; account missing, malformed, duplicate, or unverified WhatsApp. Submit each variant and then a corrected verified number. | Invalid variants are rejected; correction recovers; delivery timeout keeps participation blocked. | `ACCOUNT_SETUP_REQUIRED` remains non-ready; denial, validation, and notification recorded. | `UR-ACCOUNT-001`, `UX-FLOW-001`, `UI-SCR-001` error/disabled |
| `QA-ACCOUNT-003` | Buyer/Seller; active transaction and unavailable number. Request recovery, retry old/new number, and submit Admin checkpoint. | Number is not silently replaced; failed delivery remains blocked; approved recovery is explicit. | Transaction remains held; recovery audit and next-actor notification recorded. | `UR-ACCOUNT-002`, `UX-FLOW-001`, `UI-SCR-001`, `UI-SCR-009` manual-review |
| `QA-TRANS-004` | Buyer/Seller; open altered, expired, revoked, reused, and wrong-role invitation tokens, then retry with a fresh token. | Join is rejected for invalid tokens; fresh token recovers; no binding or invoice is created. | `WAITING_COUNTERPARTY` unchanged; denial and invitation audit recorded. | `UR-BUYER-001`, `UX-FLOW-005`, `UI-SCR-006` error/expired |
| `QA-TRANS-005` | Buyer/Seller; submit prohibited goods, invalid amount/fee, missing address, and incomplete data, then correct each input. | Field errors prevent payable state; corrected input succeeds; network failure preserves draft. | `WAITING_COUNTERPARTY_DATA` preserved; validation and notification recorded. | `UR-SELLER-001`, `UR-BR-002`, `UX-FLOW-003`, `UI-SCR-003` error |
| `QA-TRANS-006` | Buyer/Seller; complete both datasets, repeat completion, then attempt material edits. | Freeze happens once; duplicate is idempotent; post-freeze edits are disabled. | Payable boundary is created once; freeze audit and notification recorded. | `UR-SYSTEM-001`, `UR-PARTICIPANT-001`, `UX-FLOW-012`, `UI-SCR-009` locked |
| `QA-PAY-001` | Buyer; active invoice. Open payment screen, refresh, inspect amount/link/status/deadline, and force loading/error. | Frozen values render; retry is safe; no manual account instruction appears. | Waiting-payment state unchanged; view and error notification recorded. | `UR-BUYER-004`, `UR-PAYMENT-001`, `UX-FLOW-013`, `UI-SCR-010` |
| `QA-PAY-002` | Buyer; active invoice. Inspect available actions and submit a forged client payment-confirmation request. | Only status refresh is available; forged confirmation is unauthorized and cannot mark paid. | No transition; denial audit and safe error notification recorded. | `UR-BR-033`, `UR-PAYMENT-003`, `UX-FLOW-047`, `UI-SCR-011` |
| `QA-PAY-004` | Admin; valid settlement and fraud accept event. Submit event twice and refresh. | Authority accepted once; duplicate returns same result; payout remains separate. | `PAYMENT_CONFIRMED`; immutable provider evidence and notification recorded. | `UR-ADMIN-002`, `UR-PAYMENT-004`, `UX-FLOW-016`, `UI-SCR-011` success |
| `QA-PAY-005` | Admin; deny/cancel/failure/expire event before deadline. Submit each and retry. | No paid transition; deadline unchanged; retry is idempotent. | Waiting state preserved; provider result and audit recorded. | `UR-ADMIN-020`, `UR-PAYMENT-005`, `UX-FLOW-047`, `UI-SCR-011` recovery |
| `QA-PAY-006` | Admin; definitive non-paid result after deadline. Run expiry, then submit event. | Transaction remains expired; no extension or fulfillment. | `PAYMENT_EXPIRED`; audit and user notification recorded. | `UR-SYSTEM-007`, `UR-PAYMENT-007`, `UX-FLOW-049`, `UI-SCR-020` expired |
| `QA-PAY-007` | Admin; provider outage/UNKNOWN. Run timeout, Get Status retry, and reconciliation. | No paid inference; manual review remains until authoritative result; deadline never resets. | Manual-review boundary; escalation and reconciliation audit recorded. | `UR-ADMIN-001`, `UR-PAYMENT-006`, `UX-FLOW-015`, `UI-SCR-011` manual-review |
| `QA-PAY-008` | Buyer/Seller/Admin; invoice and raw provider evidence exist. Request views as each role and attempt raw access. | Buyer sees permitted invoice, Seller masked summary, Admin raw evidence only. | No transition; authorization and access audit recorded. | `UR-BR-045`, `UX-FLOW-019`, `UI-SCR-009`, `UI-SCR-010` privacy |
| `QA-PAY-009` | Buyer/Admin; partial payment, top-up, duplicate top-up before deadline. Submit provider events in that order. | Frozen amount/deadline remain; no paid or fulfillment transition; Admin reconciliation required. | Waiting/manual boundary; each event idempotent and audited. | `UR-BR-034`, `UR-PAYMENT-004`, `UX-FLOW-048`, `UI-SCR-010` exception |
| `QA-PAY-010` | Admin; excess, duplicate, and late provider events. Submit mismatched amount and success after expiry. | Exception isolated; transaction not revived; refund/reconciliation only. | Existing held/terminal state preserved; provider references and notification recorded. | `UR-BR-035`, `UR-PAYMENT-007`, `UX-FLOW-049`, `UI-SCR-018` |
| `QA-WA-001` | Admin; authoritative payment and participant snapshots. Create correct, incorrect, and duplicate group records. | Correct group creates one checkpoint; wrong/duplicate input is rejected or idempotent. | Group checkpoint recorded; Admin action and notification evidence recorded. | `UR-ADMIN-003`, `UX-FLOW-017`, `UI-SCR-012` |
| `QA-WA-002` | Admin; group checkpoint open. Submit wrong group, missing participant, and duplicate checkpoint, then corrected data. | Invalid checkpoint rejected; corrected retry succeeds once. | Fulfillment blocked until valid checkpoint; audit recorded. | `UR-ADMIN-003`, `UR-PARTY-002`, `UX-FLOW-017`, `UI-SCR-012` error |
| `QA-WA-004` | Admin; WhatsApp delivery fails/delays. Force failure, retry, and wait for timeout. | Retry visible and bounded; delivery failure never changes trusted transaction state. | State unchanged; notification attempts and escalation recorded. | `UR-BR-044`, `UX-FLOW-018`, `UI-SCR-012` recovery |
| `QA-CONF-001` | Admin; both completion checkpoints exist. Generate, post, open, revoke, and retry confirmation link. | Correct buyer link opens once; invalid/revoked link fails; valid regeneration recovers. | Confirmation window starts; link audit and notification recorded. | `UR-ADMIN-005`, `UR-SYSTEM-002`, `UX-FLOW-022`, `UI-SCR-013` |
| `QA-CONF-003` | Buyer; confirmation link active. Submit invalid, expired, reused, excessive, and early OTP values. | Invalid values fail; lock/resend rules apply; valid retry works after allowed wait. | Confirmation remains pending; attempts, lock, audit, notification recorded. | `UR-BR-036`, `UR-BUYER-007`, `UX-FLOW-024`, `UI-SCR-014` error/locked |
| `QA-CONF-004` | Buyer/Admin; OTP delivery failure/cooldown. Request resend immediately, after cooldown, and after failure. | Immediate resend disabled; eligible resend targets same WhatsApp; persistent failure routes Admin review. | Confirmation pending; delivery result and audit recorded. | `UR-BUYER-008`, `UR-SYSTEM-002`, `UX-FLOW-033`, `UI-SCR-014` recovery |
| `QA-CONF-005` | Buyer/Admin; link opened and buyer silent. Advance clock by 1x24 and 2x24 hours. | Reminder then overdue state; payout blocked; Admin recovery explicit. | Confirmation timeout/manual review; reminder audit recorded. | `UR-SYSTEM-003`, `UR-ADMIN-011`, `UX-FLOW-029`, `UI-SCR-015` overdue |
| `QA-FIN-002` | Admin; payout processing. Submit immutable bank success reference, duplicate callback, and altered evidence. | Only success reference yields terminal payout; duplicate idempotent; altered evidence rejected. | `PAID_OUT` only after `SUCCESS`; audit and notification recorded. | `UR-ADMIN-007`, `UR-FINANCIAL-002`, `UX-FLOW-026`, `UI-SCR-020` success |
| `QA-FIN-003` | Admin; payout result FAILED then UNKNOWN. Retry FAILED; attempt UNKNOWN retry before reconciliation. | FAILED retry allowed; UNKNOWN retry blocked; no false terminal. | Financial result retained; escalation and audit recorded. | `UR-FINANCIAL-003`, `UR-BR-042`, `UX-FLOW-026`, `UI-SCR-016` manual-review |
| `QA-FIN-004` | Admin; approved refund and destination. Submit PROCESSING, SUCCESS, FAILED, and UNKNOWN variants. | Only SUCCESS with evidence yields `REFUNDED`; FAILED retries; UNKNOWN reconciles first. | Financial result sequence and notification recorded. | `UR-ADMIN-016`, `UR-FINANCIAL-001`, `PB-MP-008`, `UX-FLOW-040`, `UI-SCR-018` |
| `QA-FIN-005` | Admin; approved split pool. Calculate two legs, submit success/failure/unknown, then retry. | Legs equal pool; terminal waits for both success references; UNKNOWN blocks retry. | Split remains processing/held; evidence and audit recorded. | `UR-ADMIN-018`, `UR-FINANCIAL-002`, `UR-BR-038`, `UX-FLOW-042`, `UI-SCR-019` |
| `QA-FIN-006` | Admin; task assignment and approval threshold configured. Attempt as unassigned/assigned/second approver. | Unauthorized action denied; missing approval disables action; valid action audited. | No mutation before authorization; denial/approval notification recorded. | `UR-ADMIN-021`, `UR-ADMIN-022`, `UR-BR-039`, `UX-FLOW-025`, `UI-SCR-016` |
| `QA-COMPLAINT-001` | Buyer/Seller/Admin; complaint in WhatsApp. Record correct and duplicate complaint references. | One hold created; duplicate returns same hold; no automatic adjudication. | `PAYOUT_ON_HOLD`; evidence, actor, time, notification recorded. | `UR-ADMIN-012`, `UR-PARTY-003`, `UX-FLOW-035`, `UI-SCR-017` |
| `QA-COMPLAINT-002` | Buyer/Seller/Admin; active hold. Attempt payout/refund/split/release under each permission. | Participants denied; Admin release unavailable without approved outcome. | Hold remains; denials and audit recorded. | `UR-PARTY-004`, `UR-ADMIN-013`, `UX-FLOW-036`, `UI-SCR-017` disabled |
| `QA-COMPLAINT-003` | Admin; evidence and mutual agreement. Record release, refund, and split variants. | Exactly chosen outcome eligible; second outcome rejected. | Selected financial operation starts only after authorization; audit recorded. | `UR-ADMIN-014`, `UR-ADMIN-015`, `UX-FLOW-038`, `UI-SCR-018` |
| `QA-COMPLAINT-004` | Admin; no agreement or payout processing. Submit unresolved complaint before and after processing. | Manual review remains; no silent reversal or automatic adjudication. | Hold/manual boundary preserved; escalation and audit recorded. | `UR-ADMIN-013`, `UR-ADMIN-024`, `UX-FLOW-037`, `UI-SCR-017` |
| `QA-EXP-001` | System; invoice active/no authority. Run job one second before, at, and after deadline. | Only at/after deadline expires; before deadline remains payable. | `PAYMENT_EXPIRED` once; job correlation, audit, notification recorded. | `UR-SYSTEM-005`, `UR-BR-048`, `UX-FLOW-045`, `UI-SCR-020` |
| `QA-EXP-002` | System/Admin; timely provider review. Submit status request, run expiry, then reconcile. | Timely review prevents premature expiry; deadline immutable. | Pending/manual boundary; job and reconciliation audit recorded. | `UR-BUYER-009`, `UR-SYSTEM-008`, `UX-FLOW-046`, `UI-SCR-010` |
| `QA-EXP-003` | Admin; definitive non-paid result before deadline. Reconcile and refresh buyer view. | Remains non-paid with remaining original time; no extension. | Waiting state preserved; reconciliation result and notification recorded. | `UR-SYSTEM-006`, `UR-BR-049`, `UX-FLOW-048`, `UI-SCR-010` |
| `QA-EXP-004` | Admin; expired invoice receives late provider event. Run late-fund process. | No revival; refund/reconciliation exception only; payout unavailable. | Expired/cancelled state preserved; late-fund audit recorded. | `UR-BR-035`, `UR-BR-050`, `UX-FLOW-049`, `UI-SCR-018` |
| `QA-CANCEL-001` | Initiator; counterparty absent. Submit cancellation twice and reopen invitation. | One direct cancellation; invitation revoked; duplicate final result returned. | `CANCELLED`; request/revocation/notification audit recorded. | `UR-CANCEL-002`, `UR-BR-047`, `UX-FLOW-052`, `UI-SCR-021` |
| `QA-CANCEL-002` | Buyer/Seller; both joined, no invoice. Race cancellation requests from both. | Valid request wins idempotently; stale conflict rejected; no refund. | `CANCELLED`; state-version conflict and audit recorded. | `UR-CANCEL-003`, `UR-BR-051`, `UX-FLOW-053`, `UI-SCR-021` |
| `QA-CANCEL-004` | Buyer/Seller/Admin; provider status pending/capture/unknown. Request cancellation during each. | Reconciliation starts; no paid/refund inference; duplicate stable. | `CANCELLATION_PENDING_RECONCILIATION`; provider reference/timer recorded. | `UR-CANCEL-011`, `UR-CANCEL-012`, `UR-BR-052`, `UX-FLOW-061`, `UI-SCR-022` |
| `QA-CANCEL-005` | Admin; cancellation reconciliation has definitive non-paid result. Submit and retry. | Cancellation completes without refund/payout; duplicate idempotent. | `CANCELLED`; provider result and Admin decision audited. | `UR-CANCEL-006`, `UR-BR-053`, `UX-FLOW-056`, `UI-SCR-022` |
| `QA-CANCEL-006` | Admin; reconciliation has settlement+accept. Submit result and attempt shipment/payout. | Funded review opens; shipment/payout blocked pending response. | `FUNDED_CANCELLATION_REVIEW`; hold evidence and notification recorded. | `UR-CANCEL-007`, `UR-BR-054`, `UX-FLOW-057`, `UI-SCR-023` |
| `QA-CANCEL-010` | Admin; approved cancellation cause and frozen terms. Calculate each cause and inspect fee treatment. | Taxonomy and fee treatment deterministic; override requires audit. | Refund calculation non-terminal until financial success; audit recorded. | `UR-CANCEL-008`, `UR-CAN-OD-001`, `UR-BR-055`, `UX-FLOW-058`, `UI-SCR-018` |
| `QA-CANCEL-013` | Requester/Admin; active request without decision/financial operation. Withdraw, reject, and race decision. | Only valid prior state restores; stale race rejected or manual review. | State-version conflict and next-actor notification recorded. | `UR-CANCEL-025`, `UR-BR-056`, `UX-FLOW-075`, `UI-SCR-021` |
| `QA-CANCEL-014` | Buyer/Seller/Admin; cancellation reason submitted. Test all reasons, missing OTHER note, and correction. | Taxonomy enforced; missing note rejected; correction appends, never overwrites. | Request/result separated; append-only audit recorded. | `UR-CAN-OD-001`, `UR-CAN-OD-002`, `UR-BR-057`, `UX-FLOW-051`, `UI-SCR-021` |
| `QA-RISK-002` | Buyer/Seller/Admin; risk hold active. Request participant view, raw evidence, and Admin outcome. | Participants see generic status; only authorized Admin sees raw evidence and acts. | `RISK_HOLD` outcome-neutral; access audit and notification recorded. | `UR-CANCEL-023`, `UR-ADMIN-025`, `UR-BR-058`, `UX-FLOW-073`, `UI-SCR-024` |
| `QA-SEC-001` | Buyer/Seller; two distinct accounts. Attempt cross-role edits, reads, and protected-link use. | Unauthorized actions denied; own data remains available; no leakage. | No transition; denial audit and safe message recorded. | `UR-BR-002`, `UR-BR-003`, `UR-BR-004`, `UX-FLOW-005`, `UI-SCR-006` |
| `QA-SEC-002` | Admin; internal task assignments configured. Attempt Ops/Finance/Supervisor/Reviewer as product roles. | Only Admin permission applies; assignment never creates participant role. | No product-role mutation; authorization audit recorded. | `UR-ADMIN-009`, `UR-ADMIN-010`, `UR-ADMIN-026`, `UR-BR-059`, `UX-FLOW-072`, `UI-SCR-024` |
| `QA-SEC-003` | Buyer/Seller/Admin; raw financial/WhatsApp evidence exists. Request as participant, unassigned Admin, authorized Admin. | Participants/unassigned Admin get masked summary; authorized Admin gets raw evidence. | No transition; access/masking audit recorded. | `UR-ADMIN-024`, `UR-BR-060`, `UR-BR-061`, `UX-FLOW-017`, `UI-SCR-023` privacy |
| `QA-SEC-005` | Admin; correction and successful financial evidence exist. Attempt overwrite, delete, and append correction. | Original evidence remains immutable; correction is a new append-only event; delete is denied. | No prior evidence changes; audit, actor, timestamp, and notification recorded. | `UR-CAN-OD-007`, `UR-ADMIN-026`, `UX-FLOW-071`, `UI-SCR-018`, `UI-SCR-020` audit |
| `QA-UI-001` | Buyer/Seller/Admin; default/loading/empty/disabled/success/error fixtures. Load and activate valid actions. | Status/next actor visible; no duplicate action or layout shift. | No unrequested domain transition; UI/accessibility evidence recorded. | `UR-PARTICIPANT-002`, `UR-BR-001`, `UX-FLOW-012`, `UI-SCR-001` to `UI-SCR-024` |
| `QA-UI-002` | Buyer/Seller/Admin; expired/unauthorized/manual-review/recovery fixtures. Open and activate available action. | Correct message and only valid recovery shown; forbidden action disabled. | Domain state unchanged unless approved recovery; UI/audit evidence recorded. | `UR-SYSTEM-011`, `UR-BR-062`, `UX-FLOW-045`, `UI-SCR-009`, `UI-SCR-020` |
| `QA-UI-003` | Buyer/Seller/Admin; supported browser and assistive technology. Test keyboard, labels, focus, announcements, contrast, non-color status. | Relevant actions operable and statuses understandable. | No domain transition; accessibility evidence attached. | `UR-BR-005`, `UR-BR-006`, `UR-BR-007`, `UX-FLOW-001`, `UI-SCR-001` to `UI-SCR-024` |
| `QA-UI-004` | Buyer/Seller/Admin; mobile and wide desktop viewport. Resize and inspect constrained shell. | Mobile-width surface usable on desktop; no clipping, overlap, or horizontal overflow. | No domain transition; viewport evidence recorded. | `UR-BR-008`, `UR-BR-009`, `UR-BR-010`, `UX-FLOW-012`, `UI-SCR-001` to `UI-SCR-024` |
| `QA-UI-005` | Buyer/Seller/Admin; primary screens/statuses. Scan copy for deprecated terms and unclear next actor. | Approved terminology consistent; deprecated behavior absent. | No domain transition; content defect and notification evidence recorded. | `UR-BR-011`, `UR-BR-015`, `UR-BR-018`, `UR-BR-019`, `UX-FLOW-012`, `UI-SCR-009` |
| `QA-UI-006` | Buyer/Seller/Admin; action interrupted by refresh/network failure/duplicate tap. Interrupt, reload, retry. | Trusted server state reloads; failure not shown as success; retry idempotent. | State/version preserved; error, recovery, and audit evidence recorded. | `UR-CAN-OD-007`, `UR-BR-063`, `UX-FLOW-051`, `UI-SCR-009`, `UI-SCR-021` |

### QA-MP-001: Idempotent Midtrans Invoice

```text
Scenario ID: QA-MP-001
Requirement IDs: UR-SYSTEM-004, UR-PAYMENT-001, UR-PAYMENT-002
UX Flow IDs: UX-FLOW-012, UX-FLOW-013
UI IDs/states: UI-SCR-009 payable, UI-SCR-010 default/loading
Title: Create exactly one Midtrans payment link from frozen terms
Type: Happy/Idempotency
Priority: P0

Given:
- Buyer and Seller data are complete and frozen.
When:
1. Request invoice creation with `payment_type: payment_link`.
2. Repeat the request with the same idempotency key and concurrently with a duplicate key.
Then:
- One active invoice is returned for the transaction.
- Amount, invoice reference, payment link, issuedAt, and expiresAt are immutable.
Failure path: Provider failure leaves the transaction payable without creating a second invoice.
Timeout path: Retry returns the existing result or a reconciliation task; deadline is unchanged.
Recovery path: Retry only through the same idempotent invoice boundary.
Expected state transition: WAITING_COUNTERPARTY_DATA -> WAITING_BUYER_PAYMENT
Expected audit/notification: Invoice request, provider reference, idempotency key, and deadline are recorded without secrets.
Cleanup: Revoke the test invoice fixture.
```

### QA-MP-002: Midtrans Data Boundary

```text
Scenario ID: QA-MP-002
Requirement IDs: UR-PAYMENT-003, UR-PAYMENT-004
UX Flow IDs: UX-FLOW-013, UX-FLOW-015
UI IDs/states: UI-SCR-010 default, UI-SCR-011 unauthorized/error
Title: Prevent provider secrets and raw event data from leaking
Type: Security
Priority: P0

Given:
- An active invoice and webhook fixture exist.
When:
1. Open the Buyer payment screen, Seller view, Admin view, logs, audit output, and idempotency response.
2. Inspect values returned to each actor.
Then:
- Buyer receives only permitted invoice/payment-link data.
- Seller receives no provider secret or raw provider evidence.
- Secrets, signatures, and raw sensitive payloads are absent from client, logs, audit, and generic errors.
Failure path: Any leak fails the scenario and blocks release.
Timeout path: Unavailable provider data stays hidden and non-authoritative.
Recovery path: Remove the exposed field and append an audit/security incident record.
Expected state transition: WAITING_BUYER_PAYMENT -> WAITING_BUYER_PAYMENT
Expected audit/notification: Access denial and any leak investigation are audited without storing the secret.
Cleanup: Remove provider fixture payloads.
```

### QA-MP-003: Hosted Midtrans Checkout

```text
Scenario ID: QA-MP-003
Requirement IDs: UR-BUYER-004, UR-PAYMENT-001, UR-PAYMENT-003
UX Flow IDs: UX-FLOW-013
UI IDs/states: UI-SCR-010 default/loading/error
Title: Open hosted Midtrans checkout with frozen amount and deadline
Type: Happy
Priority: P0

Given:
- An active invoice exists within its absolute WIB deadline.
When:
1. Buyer opens `Bayar melalui Midtrans`.
2. Return to BayarAman and select `Cek status pembayaran`.
Then:
- Hosted checkout opens with the frozen amount.
- Refresh only reads status; no `Sudah Bayar` or client confirmation action exists.
Failure path: Provider/link failure leaves the transaction waiting and offers retry.
Timeout path: Loading ends in a retryable error without deadline reset.
Recovery path: Reopen the same invoice/payment link while still valid.
Expected state transition: WAITING_BUYER_PAYMENT -> WAITING_BUYER_PAYMENT
Expected audit/notification: Checkout open and status-refresh events are recorded without payment confirmation.
Cleanup: Close checkout fixture.
```

### QA-MP-004: Non-Authoritative Provider Status

```text
Scenario ID: QA-MP-004
Requirement IDs: UR-SYSTEM-007, UR-BUYER-009, UR-PAYMENT-004
UX Flow IDs: UX-FLOW-046, UX-FLOW-048, UX-FLOW-049
UI IDs/states: UI-SCR-010 pending/error, UI-SCR-011 reconciliation
Title: Keep pending, capture, deny, cancel, failure, and expire non-paid
Type: Negative/Edge
Priority: P0

Given:
- An active invoice exists.
When:
1. Deliver each provider status fixture: pending, capture, deny, cancel, failure, and expire.
2. Refresh Buyer status and inspect Admin operations.
Then:
- None produces payment confirmation or unlocks WhatsApp, fulfillment, or payout.
- Capture remains provider-success but not settlement for payout.
Failure path: Any non-authoritative result becoming paid fails the scenario.
Timeout path: Pending/unknown remains waiting or manual review.
Recovery path: Accept only a later valid settlement + fraud accept event before deadline.
Expected state transition: WAITING_BUYER_PAYMENT -> WAITING_BUYER_PAYMENT or PAYMENT_EXPIRED
Expected audit/notification: Provider status and rejection reason are recorded.
Cleanup: Reset each provider status fixture.
```

### QA-MP-005: Authoritative Settlement

```text
Scenario ID: QA-MP-005
Requirement IDs: UR-ADMIN-001, UR-ADMIN-002, UR-PAYMENT-004
UX Flow IDs: UX-FLOW-015, UX-FLOW-016
UI IDs/states: UI-SCR-011 success, UI-SCR-012 enabled
Title: Accept payment only at settlement with fraud acceptance
Type: Happy/Security
Priority: P0

Given:
- Invoice amount and order ID are frozen.
When:
1. Deliver a correctly signed webhook with matching order ID and amount, `transaction_status=settlement`, and `fraud_status=accept`.
2. Deliver the same event again.
Then:
- Payment becomes authoritative exactly once.
- Duplicate delivery returns the existing result and does not create a second transition.
- WhatsApp group handoff becomes eligible; seller payout remains separate.
Failure path: Signature/order/amount/fraud mismatch is rejected without paid state.
Timeout path: Missing webhook remains non-authoritative and uses Get Status reconciliation.
Recovery path: Reconcile the provider event, then continue the same transaction once.
Expected state transition: WAITING_BUYER_PAYMENT -> PAYMENT_CONFIRMED
Expected audit/notification: Event ID, validation evidence, authority decision, and notification are append-only recorded.
Cleanup: Remove webhook fixtures and reset transaction.
```

### QA-MP-006: Webhook Ordering And Idempotency

```text
Scenario ID: QA-MP-006
Requirement IDs: UR-PAYMENT-004, UR-PAYMENT-005, UR-ADMIN-020
UX Flow IDs: UX-FLOW-015, UX-FLOW-047, UX-FLOW-050
UI IDs/states: UI-SCR-011 error/manual-review
Title: Reject invalid and stale provider events safely
Type: Recovery/Security
Priority: P0

Given:
- A transaction has a current provider event version.
When:
1. Deliver invalid signature, wrong order ID, amount mismatch, duplicate, delayed, and out-of-order events.
2. Inspect state and audit after each event.
Then:
- Invalid events are rejected/audited.
- Duplicate events are idempotent.
- Stale events cannot overwrite newer authoritative state.
Failure path: Any state regression or paid transition from an invalid event fails.
Timeout path: Unresolved event remains UNKNOWN/manual review.
Recovery path: Use Get Status API and accept only the authoritative ordered result.
Expected state transition: Current state -> Current state or MANUAL_REVIEW_REQUIRED
Expected audit/notification: Event IDs, ordering decision, validation errors, and Admin follow-up are recorded.
Cleanup: Clear provider event fixtures.
```

### QA-MP-007: Provider Reconciliation

```text
Scenario ID: QA-MP-007
Requirement IDs: UR-PAYMENT-006, UR-ADMIN-023, UR-BR-046
UX Flow IDs: UX-FLOW-047, UX-FLOW-050
UI IDs/states: UI-SCR-011 manual-review, UI-SCR-022 error
Title: Reconcile UNKNOWN or provider outage without inference
Type: Recovery/Manual operation
Priority: P0

Given:
- Webhook delivery is missing, ambiguous, or the provider is unavailable.
When:
1. Open Admin reconciliation.
2. Retry Get Status API within the approved SLA.
3. Record authoritative, definitive non-paid, or still UNKNOWN result.
Then:
- No missing event is treated as paid or unpaid automatically.
- Deadline remains the original absolute timestamp.
Failure path: Get Status outage keeps the transaction non-authoritative.
Timeout path: SLA breach becomes manual review and escalates without money movement.
Recovery path: Continue from the same reconciliation record when provider status becomes authoritative.
Expected state transition: WAITING_BUYER_PAYMENT -> WAITING_BUYER_PAYMENT, PAYMENT_CONFIRMED, or MANUAL_REVIEW_REQUIRED
Expected audit/notification: Lookup, result, operator, SLA, and escalation reminder are recorded.
Cleanup: Restore provider availability fixture.
```

### QA-MP-008: Expiry And Late Provider Success

```text
Scenario ID: QA-MP-008
Requirement IDs: UR-SYSTEM-005, UR-SYSTEM-006, UR-PAYMENT-007, UR-BR-059
UX Flow IDs: UX-FLOW-045, UX-FLOW-049, UX-FLOW-050
UI IDs/states: UI-SCR-010 expired, UI-SCR-018 refund, UI-SCR-020 terminal
Title: Keep expired or cancelled transactions closed after late payment
Type: Edge/Recovery
Priority: P0

Given:
- An invoice has passed its original 1x24-hour deadline or the transaction is cancelled.
When:
1. Deliver a late authoritative Midtrans success event.
2. Run reconciliation and prepare the approved refund route.
Then:
- The transaction remains `PAYMENT_EXPIRED` or `CANCELLED`.
- Invitation, fulfillment, and Seller payout are not reopened.
- Refund proceeds through Midtrans Refund API when supported or Admin fallback.
Failure path: Any revival or payout eligibility fails the scenario.
Timeout path: Refund remains PROCESSING/UNKNOWN and is not blindly retried.
Recovery path: Retry only FAILED refund operations after reconciliation.
Expected state transition: PAYMENT_EXPIRED/CANCELLED -> REFUND_READY -> REFUND_PROCESSING -> REFUNDED on SUCCESS
Expected audit/notification: Late provider reference, no-revival decision, refund operation, result, and notification are recorded.
Cleanup: Reconcile and close refund fixture.
```

### QA-PAY-009: Partial Payment And Top-Up

```text
Scenario ID: QA-PAY-009
Requirement IDs: UR-BR-033, UR-BR-034, UR-SYSTEM-004, UR-SYSTEM-006, UR-PAYMENT-006
UX Flow IDs: UX-FLOW-013, UX-FLOW-014, UX-FLOW-047, UX-FLOW-048
UI IDs/states: UI-SCR-010, UI-SCR-011
Title: Allow a partial-payment top-up only until the unchanged deadline
Type: Edge/Recovery
Priority: P0

Given:
- Buyer total is known, the Midtrans invoice is active, and provider reconciliation reports a partial/mismatched amount before the original deadline.
When:
1. Inject a partial or mismatched Midtrans event.
2. Reconcile the event without accepting it as authoritative.
3. Inject a later exact `settlement` with `fraud_status=accept` before the original deadline.
4. Repeat after the deadline has passed.
Then:
- Before the deadline, the event remains under provider reconciliation and the original deadline is unchanged.
- Only the later authoritative event can confirm payment.
- After the deadline, the event follows refund/payment-exception handling and cannot authorize fulfillment.
Failure path:
- Partial or mismatched amount never produces `PAYMENT_CONFIRMED`.
Timeout path:
- Original deadline remains unchanged and expiry is evaluated at that deadline.
Recovery path:
- Use Midtrans Get Status API or provider reconciliation; refund late funds through the approved route if needed.
Expected state transition:
WAITING_BUYER_PAYMENT -> PAYMENT_EXCEPTION_REVIEW -> PAYMENT_CONFIRMED or REFUND_PROCESSING / PAYMENT_EXPIRED
Expected audit/notification:
- Provider event/status references, amounts, original deadline, operator, reconciliation result, and notifications are recorded.
Cleanup:
- Close both before-deadline and after-deadline fixtures.
```

### QA-PAY-010: Excess Duplicate And Late Payment

```text
Scenario ID: QA-PAY-010
Requirement IDs: UR-BR-033, UR-BR-035, UR-SYSTEM-005, UR-SYSTEM-007, UR-PAYMENT-007, UR-FINANCIAL-001
UX Flow IDs: UX-FLOW-045, UX-FLOW-047, UX-FLOW-049
UI IDs/states: UI-SCR-010, UI-SCR-011, UI-SCR-018, UI-SCR-020
Title: Isolate excess, duplicate, and late funds without reviving a transaction
Type: Negative/Recovery
Priority: P0

Given:
- A transaction receives an excess, duplicate, or post-expiry Midtrans provider event.
When:
1. Inject each provider event separately.
2. Attempt normal payment confirmation and fulfillment.
3. Prepare the approved refund-only operation.
Then:
- No mismatch authorizes group fulfillment or payout.
- Late/duplicate funds remain linked to an exception and the transaction does not revive.
Failure path:
- Normal confirmation and any client-side payment confirmation action are rejected.
Timeout path:
- Ambiguous provider status remains held for reconciliation; no automatic outcome is inferred.
Recovery path:
- Reconcile through webhook/Get Status API, then refund through Midtrans or the approved Admin fallback using a unique operation ID.
Expected state transition:
PAYMENT_EXPIRED or PAYMENT_EXCEPTION_REVIEW -> REFUND_PROCESSING -> REFUNDED
Expected audit/notification:
- Each provider event, exception, refund calculation, operation, and result reference is retained.
Cleanup:
- Reconcile all unmatched funds.
```

### QA-FIN-007: Split Amount And Transfer Order

```text
Scenario ID: QA-FIN-007
Requirement IDs: UR-ADMIN-018, UR-ADMIN-019, UR-BR-038, UR-BR-041
UX Flow IDs: UX-FLOW-042, UX-FLOW-043
UI IDs/states: UI-SCR-019, UI-SCR-020
Title: Validate split totals and buyer-first transfer order
Type: Negative/Edge
Priority: P1

Given:
- A written settlement authorizes a split.
When:
1. Enter valid and invalid buyer/seller portions.
2. Attempt to start the seller leg before the buyer leg.
3. Record both valid transfer results.
Then:
- Buyer portion plus seller portion equals item price plus shipping.
- Service fee remains outside the split pool according to approved rules.
- Buyer leg is attempted before seller leg and both successes are required for `SPLIT_SETTLED`.
Failure path:
- Invalid total or wrong order keeps split disabled.
Timeout path:
- One successful leg does not close the transaction.
Recovery path:
- Retry only failed leg; reconcile unknown leg before retry.
Expected state transition:
PAYOUT_ON_HOLD -> SPLIT_PROCESSING -> SPLIT_SETTLED
Expected audit/notification:
- Calculation, leg order, operation IDs, amounts, and both bank references are recorded.
Cleanup:
- Reconcile each partial split fixture.
```

### QA-FIN-008: Admin Authorization And Re-Authentication

```text
Scenario ID: QA-FIN-008
Requirement IDs: UR-ADMIN-006, UR-ADMIN-016, UR-ADMIN-018, UR-BR-039, UR-BR-040
UX Flow IDs: UX-FLOW-025, UX-FLOW-040, UX-FLOW-042
UI IDs/states: UI-SCR-016, UI-SCR-018, UI-SCR-019
Title: Enforce internal Admin task assignment, two-person approval, and payout re-authentication
Type: Security
Priority: P0

Given:
- A payout, refund, split, controlled exception, or high-value operation is prepared.
When:
1. Attempt the action with an Admin outside the assigned task.
2. Attempt a controlled/high-value action with only one required Admin participant.
3. Attempt ordinary payout without the required Admin re-authentication.
4. Repeat with valid assignments and approvals.
Then:
- Invalid attempts are denied and audited.
- Valid authorization enables only the permitted operation.
Failure path:
- Missing assignment, second participant, or re-authentication keeps the action disabled.
Timeout path:
- Pending approval remains non-terminal and escalates under SLA.
Recovery path:
- A valid assigned Admin can complete the missing authorization without changing the amount/destination snapshot.
Expected state transition:
READY_FOR_PAYOUT -> READY_FOR_PAYOUT or PAYOUT_PROCESSING
Expected audit/notification:
- Assignment, participants, re-authentication, amount, and authorization timestamps are recorded.
Cleanup:
- Revoke test assignment after execution.
```

### QA-SLA-001: Operating Hours And WIB Deadline

```text
Scenario ID: QA-SLA-001
Requirement IDs: UR-CAN-OD-003, UR-CAN-OD-008, UR-BR-043
UX Flow IDs: UX-FLOW-055, UX-FLOW-066
UI IDs/states: UI-SCR-009, UI-SCR-022, UI-SCR-023
Title: Pause operating-hour SLA outside Admin hours
Type: Edge/Time
Priority: P0

Given:
- Admin operations run 09.00-21.00 WIB and a reconciliation starts at different boundary times.
When:
1. Start at 09.00, 20.30, 21.00, and outside-hours fixtures.
2. Advance clock across the operating boundary.
Then:
- Only operating hours count toward the two-hour reconciliation target.
- A 20.30 start reaches its deadline at 10.30 WIB next operating day.
- UI shows one absolute WIB deadline and remaining time.
Failure path:
- Invalid timezone or client clock cannot alter the server deadline.
Timeout path:
- Missed target becomes `MANUAL_REVIEW_REQUIRED` without inferring funds.
Recovery path:
- Admin resumes from the preserved reconciliation task.
Expected state transition:
CANCELLATION_PENDING_RECONCILIATION -> CANCELLATION_PENDING_RECONCILIATION / MANUAL_REVIEW_REQUIRED
Expected audit/notification:
- Server time, operating-window calculation, deadline, and escalation are recorded.
Cleanup:
- Reset test clock and close the reconciliation.
```

### QA-SLA-002: SLA Breach And Escalation

```text
Scenario ID: QA-SLA-002
Requirement IDs: UR-ADMIN-001, UR-ADMIN-016, UR-CAN-OD-008, UR-BR-043
UX Flow IDs: UX-FLOW-015, UX-FLOW-040, UX-FLOW-055, UX-FLOW-066
UI IDs/states: UI-SCR-011, UI-SCR-018, UI-SCR-022, UI-SCR-023
Title: Escalate overdue review and financial operations without inventing a result
Type: Timeout/Recovery
Priority: P0

Given:
- Payment review, reconciliation, payout, or refund has no authoritative result by its target.
When:
1. Advance time beyond the applicable target.
2. Advance one or more additional 1x24-hour periods.
Then:
- Escalation reminder is issued every 1x24 hours until assigned/recorded.
- Payment/cancellation remains pending or manual review; financial operation remains non-terminal.
- Payout target is 1x24 after eligibility and refund/split target is 2x24 after approval.
Failure path:
- No timeout may infer no funds, success, refund, or payout.
Timeout path:
- The target breach itself is visible to Admin and participants as permitted.
Recovery path:
- Authoritative result resolves the held operation and stops escalation.
Expected state transition:
PAYMENT_UNDER_REVIEW -> PAYMENT_UNDER_REVIEW or MANUAL_REVIEW_REQUIRED
Expected audit/notification:
- Target, breach, reminder count, assignee, and final result are recorded.
Cleanup:
- Resolve every seeded overdue case.
```

### QA-NOTIFY-001: Notification Attempt Limit

```text
Scenario ID: QA-NOTIFY-001
Requirement IDs: UR-BR-044
UX Flow IDs: UX-FLOW-018, UX-FLOW-022, UX-FLOW-028
UI IDs/states: UI-SCR-009, UI-SCR-012, UI-SCR-013
Title: Limit automatic notification delivery and preserve source-of-truth status
Type: Failure/Recovery
Priority: P0

Given:
- A status change triggers an automatic notification and the delivery provider fails.
When:
1. Force the first, second, and third delivery attempts to fail.
2. Observe the transaction status and Admin queue.
3. Retry any permitted manual communication.
Then:
- At most three automatic attempts are made.
- Final delivery failure is visible to Admin.
- Transaction status is unchanged by notification failure.
Failure path:
- No duplicate financial or status mutation is created by retrying delivery.
Timeout path:
- Delivery remains failed and requires manual follow-up.
Recovery path:
- Admin can communicate manually without rewriting the trusted event.
Expected state transition:
PAYMENT_CONFIRMED -> PAYMENT_CONFIRMED
Expected audit/notification:
- Attempt count, provider result, final failure, and Admin follow-up are recorded.
Cleanup:
- Restore the notification provider fixture.
```

### QA-LAUNCH-001: Real-Money Launch Gate

```text
Scenario ID: QA-LAUNCH-001
Requirement IDs: UR-BR-046
UX Flow IDs: None; release-readiness non-UI requirement
UI IDs/states: None; release gate
Title: Block real-money pilot until external and compliance prerequisites are validated
Type: Non-UI/Release
Priority: P0

Given:
- A real-money pilot release is proposed.
When:
1. Review Midtrans merchant settlement and custody/forwarding arrangement.
2. Review consumer disclosures, complaint handling, data controls, and legal/compliance approval.
3. Attempt to mark the pilot production-ready with any prerequisite missing.
Then:
- The product remains prototype/test-only until all required validation is recorded.
- This gate does not invent a user-facing transaction status.
Failure path:
- Missing evidence blocks release approval.
Timeout path:
- Gate remains open and is escalated to the Product Owner; no production launch is inferred.
Recovery path:
- Attach the missing validation evidence and rerun the release review.
Expected release gate transition:
OPEN -> BLOCKED while any validation is missing; OPEN -> APPROVED only after all gate evidence is approved
Expected audit/notification:
- Gate checklist, approvers, dates, evidence references, and decision are recorded.
Cleanup:
- Keep the pilot marked test-only unless the approved gate is complete.
```

## 5. Required Coverage

- Every primary seller-created and buyer-created journey has a happy-path scenario.
- Every Must requirement has at least one positive and one relevant negative or edge scenario.
- Unauthorized actor action, same-account join, wrong role, and sensitive-data access are tested.
- Loading, empty, disabled, error, success, expired, unauthorized, timeout, and manual-review states are tested on the relevant screens.
- Payment expiry starts only when the Midtrans invoice is available; the original deadline is never silently extended.
- `Cek status pembayaran` only refreshes provider status and never confirms payment.
- OTP lifetime, resend interval, send limit, invalid-attempt limit, lockout, and same-number destination are tested.
- WhatsApp activity is never treated as trusted without an Admin checkpoint.
- Seller and buyer completion checkpoints are tested as separate records.
- Complaint, payout hold, cancellation, risk hold, refund, split, and late-fund paths are tested without automatic adjudication.
- Financial amount mismatch, destination ownership, `PROCESSING`, `SUCCESS`, `FAILED`, and `UNKNOWN` outcomes are tested.
- State version, idempotency, duplicate action, append-only audit, and immutable financial evidence are tested.
- Keyboard/focus, labels/announcements, contrast, mobile viewport, and constrained desktop mobile-width behavior are tested.
- All deadline assertions use WIB; Admin operating hours are 09:00-21:00 WIB.

## 6. Manual Operation Checks

| Operation | Evidence needed | System record expected | Recovery if operator makes a mistake |
| --- | --- | --- | --- |
| Midtrans payment reconciliation | Webhook/Get Status reference, order ID, amount, signature/fraud validation, observed time | Provider result, reconciliation decision, operator, time, note | Append correction; never overwrite authoritative evidence |
| WhatsApp group creation | Correct group reference and participant number snapshots | Group reference, participants, Admin, time | Revoke/replace checkpoint through an audited correction |
| Payment announcement | Message reference and delivery result | Announcement checkpoint and notification status | Retry without changing payment state |
| Seller shipment statement | Seller-authored statement in correct group | Seller shipment checkpoint, author, time, evidence reference | Conflicting evidence routes to complaint hold |
| Buyer completion report | Buyer-authored group message | Buyer checkpoint separate from seller checkpoint | Keep confirmation unavailable until valid checkpoint |
| Confirmation link post | Link reference and correct group | Link lifecycle, destination, Admin, deadline | Revoke and regenerate only through valid lifecycle action |
| Complaint hold | WA evidence and complaint summary | `PAYOUT_ON_HOLD`, actor, time, evidence | Keep funds held; append corrected evidence |
| Risk hold | Restricted evidence and reason category | `RISK_HOLD`, task assignment, actor, time | Keep outcome neutral until authorized decision |
| Cancellation provider reconciliation | Midtrans webhook/Get Status reference and result | Reconciliation ID, result, deadline, Admin | Preserve pending/manual review; never infer paid or non-paid |
| Funded cancellation response | Message reference, immutable snapshot/hash, author, time | Separate response/checkpoint and timer | Retry message without resetting timer |
| Refund/payout/split transfer | Operation ID, destination snapshot, amount, bank reference | Processing/result state and immutable success evidence | Retry only `FAILED`; reconcile `UNKNOWN` |

## 7. Regression Checklist

- [ ] Existing approved seller-created journey still works.
- [ ] Existing approved buyer-created journey still works.
- [ ] Approved UX Flow transitions and UI/UX states remain consistent.
- [ ] No deprecated terms or state names reappear.
- [ ] Manual actions are not shown as automatic system actions.
- [ ] Only Buyer, Seller, and Admin remain product roles.
- [ ] Internal Admin task assignments do not grant extra participant access.
- [ ] Financial actions remain auditable and idempotent.
- [ ] Participant views never expose raw bank or WhatsApp evidence.
- [ ] No cancellation route bypasses shipment, hold, financial-processing, or terminal cutoffs.
- [ ] Late funds never revive an expired or cancelled transaction.
- [ ] Notification failure never changes trusted transaction state.
- [ ] Mobile-width application surface remains usable on mobile and desktop browsers.

## 8. Exit Criteria

- [ ] Every Must requirement and critical UI state has positive and relevant negative/edge coverage.
- [ ] P0 scenarios pass in the approved test environment.
- [ ] Midtrans provider and WhatsApp evidence is captured for relevant scenarios; manual bank evidence is limited to approved payout/refund fallback.
- [ ] Financial failure, unknown, retry, and reconciliation evidence is recorded.
- [ ] Accessibility and responsive checks pass for supported browser classes.
- [ ] Known gaps have an owner and a product decision; no new product policy is invented in QA.
- [x] Product Owner reviews and approves QA Scenarios v0.2.

## 9. Approval Checklist

- [x] All 83 scenario IDs are unique and retained.
- [x] Every listed scenario has executable detail and individual traceability.
- [x] Requirement, UX Flow, UI/UX, User Journey, and Product Brief references are valid.
- [x] Midtrans authority, webhook recovery, expiry, late-fund, refund, and payout boundaries are covered.
- [x] Cancellation, complaint hold, risk hold, OTP, audit, notification, and permission coverage are present.
- [x] No new product role, transaction state, placeholder, or legacy payment behavior was introduced.
- [x] Coverage status does not rely on an untested requirement range.
- [x] Product Owner review completed and QA Scenarios v0.2 approved.

QA Scenarios v0.2 is `Approved`. Execution evidence remains a release validation
activity and does not change the scenario contract.
