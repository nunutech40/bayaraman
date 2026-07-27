# BayarAman UI/UX Design Specification

## 1. Document Control

```text
Product/feature: BayarAman MVP physical-goods transaction
Version: 0.2
Status: Approved
Owner/designer: Product Owner BayarAman / Product Design
Last updated: 2026-07-25
Approved by: Product Owner BayarAman
Approved on: 2026-07-25
Source UX Flow: docs/product/02-ux-flow.md v0.3 (Approved)
Source User Requirements: docs/product/03-user-requirements.md v0.4 (Approved)
Wireframe/prototype reference: None; no wireframe or prototype is created in this draft
```

This specification defines the reviewable web experience contract. It does not define API shape, database schema, provider choice, or implementation architecture.

## 2. Experience Scope

```text
Target actors: Buyer, Seller, Admin
Platforms: Web application with mobile-app presentation
Supported viewport/device classes: Small mobile, large mobile, tablet/desktop browser canvas with constrained mobile-width surface
Included UX Flow IDs: UX-FLOW-001 through UX-FLOW-075
Included User Requirement IDs: All approved User Requirements v0.4, including UR-PAYMENT-001 through UR-PAYMENT-007, UR-FINANCIAL-001 through UR-FINANCIAL-003, and UR-CANCEL-001 through UR-CANCEL-025
Excluded experience areas: Midtrans API implementation, credential storage, automatic WhatsApp group creation/parsing, complaint adjudication, technical authentication, database, and implementation details
```

Product roles are only Buyer, Seller, and Admin. Ops, Finance, Supervisor, and reviewer labels in upstream requirements are internal Admin task assignments and are represented in the UI as Admin permissions or task context, never as additional user-facing roles.

## 3. Design Principles And Constraints

- Keep one clear next action visible: the current status, responsible actor, deadline, and allowed action must be scannable before secondary details.
- Treat BayarAman status as the source of truth. Midtrans events, WhatsApp messages, seller shipping, and buyer reports become trusted only after the required validation or Admin checkpoint.
- Keep provider and manual boundaries visible. Use separate labels for `Midtrans`, `WhatsApp`, `Admin record`, and `System status`; manual bank work is only a payout/refund fallback, never the primary payment flow.
- Use a constrained mobile-width application surface on both mobile and desktop browsers. The desktop canvas may show surrounding whitespace, but the application does not expand into a wide dashboard.
- Use stable dimensions for status banners, action areas, input rows, timers, and admin evidence panels so dynamic messages do not shift primary actions.
- Use text, icon, and color together for statuses. Color alone must never communicate payment, hold, expiry, success, or risk.
- Destructive or financially meaningful actions require an explicit confirmation step, visible consequence, current status, and idempotent result handling.
- Mask sensitive bank data by default. Never expose raw WhatsApp evidence, bank evidence, OTP values, or internal risk notes to the wrong actor.
- Use concise Indonesian-facing product copy in the final UI; this specification uses stable English status IDs and intents for traceability.
- Do not add cancellation policy, complaint adjudication, automatic delivery detection, or financial outcomes beyond the approved Product Brief, Journey, UX Flow, and User Requirements.

## 4. Information Architecture And Navigation

| Area | Actor | Contains | Entry method | Exit/next area |
| --- | --- | --- | --- | --- |
| Account access | Buyer/Seller/Admin | Sign-in, account identity, WhatsApp prerequisite, account recovery state | App open or protected link | Role home, invitation, or blocked prerequisite |
| Role start | Buyer/Seller | Start transaction as buyer or seller; view existing transactions | Authenticated account | Seller input, buyer input, or transaction list |
| Seller transaction input | Seller | Shared deal data, seller identity, WhatsApp, payout data | Role start or seller invitation | Invitation waiting or transaction status |
| Buyer transaction input | Buyer | Shared deal data, buyer identity, WhatsApp, address, refund data | Role start or buyer invitation | Invitation waiting or transaction status |
| Invitation and join | Buyer/Seller | Invitation identity, opposite role, account distinction, owned role data | Shared invitation link | Role completion or waiting/recovery |
| Participant transaction detail | Buyer/Seller | Status, next actor, deadline, holds, masked financial data, allowed actions | Transaction list, invitation, confirmation link | Payment, cancellation, confirmation, terminal result |
| Admin operations | Admin | Queues, payment review, WA checkpoints, complaints, cancellation review, financial operations | Admin operation queue or transaction record | Evidence checkpoint, manual operation, result, or hold |
| Confirmation | Buyer | Confirmation link, fixed WhatsApp destination, OTP request/input, receipt result | Link posted in transaction WhatsApp group | Ready for payout, hold, or recovery |
| Terminal result | Buyer/Seller/Admin | Final status, allowed reference summary, next support path if applicable | Status transition or transaction detail | End/read-only status |

Primary participant navigation uses three destinations: `Transactions`, `Create`, and `Account`. Admin navigation uses `Operations`, `Transactions`, and `Account`; internal Admin task assignment is shown as filters/tags within Admin operations, not role switching.

## 5. Screen Inventory

| UI ID | Screen/component | Actor | Purpose | Source UX IDs | Source requirement IDs |
| --- | --- | --- | --- | --- | --- |
| `UI-SCR-001` | Account access | Buyer/Seller/Admin | Authenticate and satisfy WhatsApp prerequisite | `UX-SCR-001`, `UX-FLOW-001` | `UR-ACCOUNT-001`, `UR-ACCOUNT-002` |
| `UI-SCR-002` | Role start | Buyer/Seller | Choose buyer or seller initiator path | `UX-SCR-002`, `UX-FLOW-002`, `UX-FLOW-007` | `UR-INIT-001`, `UR-INIT-003` |
| `UI-SCR-003` | Seller transaction input | Seller | Enter shared deal, seller, WhatsApp, and payout data | `UX-SCR-003`, `UX-FLOW-003` | `UR-SELLER-001`, `UR-SYSTEM-010`, `UR-PARTICIPANT-003` |
| `UI-SCR-004` | Buyer transaction input | Buyer | Enter shared deal, buyer, WhatsApp, address, and refund data | `UX-SCR-004`, `UX-FLOW-008` | `UR-BUYER-003`, `UR-BUYER-010`, `UR-SYSTEM-010`, `UR-PARTICIPANT-003` |
| `UI-SCR-005` | Invitation waiting | Buyer/Seller initiator | Share invitation and show waiting state | `UX-SCR-005`, `UX-FLOW-004`, `UX-FLOW-009` | `UR-INIT-002`, `UR-INIT-004`, `UR-INIT-005` |
| `UI-SCR-006` | Invitation join | Buyer/Seller counterparty | Validate invitation and distinct account | `UX-SCR-006`, `UX-FLOW-005`, `UX-FLOW-010` | `UR-BUYER-001`, `UR-SELLER-002`, `UR-INIT-005` |
| `UI-SCR-007` | Buyer role completion | Buyer | Complete buyer-owned data | `UX-SCR-007`, `UX-FLOW-006` | `UR-BUYER-002`, `UR-BUYER-010`, `UR-ACCOUNT-002` |
| `UI-SCR-008` | Seller role completion | Seller | Complete seller-owned and payout data | `UX-SCR-008`, `UX-FLOW-011` | `UR-SELLER-003`, `UR-ACCOUNT-002` |
| `UI-SCR-009` | Participant transaction status | Buyer/Seller | Show trusted status, next actor, deadline, hold, and outcome | `UX-SCR-009`, `UX-FLOW-012`, `UX-FLOW-019`, `UX-FLOW-032`, `UX-FLOW-067`, `UX-FLOW-075` | `UR-PARTICIPANT-001`, `UR-PARTICIPANT-002`, `UR-PARTICIPANT-004`, `UR-CANCEL-017`, `UR-CANCEL-025` |
| `UI-SCR-010` | Buyer Midtrans payment | Buyer | Show hosted Midtrans payment link, frozen amount, deadline, and provider status refresh | `UX-SCR-010`, `UX-FLOW-013`, `UX-FLOW-014`, `UX-FLOW-044`, `UX-FLOW-046`, `UX-FLOW-048` | `UR-BUYER-004`, `UR-BUYER-005`, `UR-SYSTEM-004`, `UR-SYSTEM-005`, `UR-SYSTEM-006`, `UR-SYSTEM-007`, `UR-BUYER-009`, `UR-PAYMENT-001`, `UR-PAYMENT-002`, `UR-PAYMENT-003` |
| `UI-SCR-011` | Admin Midtrans payment reconciliation | Admin | Review webhook/Get Status results and record provider reconciliation | `UX-SCR-011`, `UX-FLOW-015`, `UX-FLOW-016`, `UX-FLOW-047`, `UX-FLOW-048`, `UX-FLOW-049`, `UX-FLOW-050`, `UX-FLOW-061`, `UX-FLOW-062`, `UX-FLOW-063` | `UR-ADMIN-001`, `UR-ADMIN-002`, `UR-ADMIN-020`, `UR-ADMIN-021`, `UR-ADMIN-023`, `UR-PAYMENT-004`, `UR-PAYMENT-005`, `UR-PAYMENT-006`, `UR-CANCEL-005`, `UR-CANCEL-011`, `UR-CANCEL-012`, `UR-CANCEL-013` |
| `UI-SCR-012` | Admin operations | Admin | Record WA group, announcements, completion checkpoints, link, complaints, and task handoffs | `UX-SCR-012`, `UX-FLOW-017`, `UX-FLOW-018`, `UX-FLOW-020`, `UX-FLOW-021`, `UX-FLOW-022`, `UX-FLOW-034`, `UX-FLOW-035`, `UX-FLOW-038`, `UX-FLOW-050` | `UR-ADMIN-003`, `UR-ADMIN-004`, `UR-PARTY-001`, `UR-PARTY-002`, `UR-ADMIN-005`, `UR-PARTY-003`, `UR-ADMIN-012`, `UR-ADMIN-014`, `UR-ADMIN-021`, `UR-SYSTEM-008`, `UR-ADMIN-022` |
| `UI-SCR-013` | Buyer confirmation link | Buyer | Bind the link to buyer and request WhatsApp OTP | `UX-SCR-013`, `UX-FLOW-022`, `UX-FLOW-023`, `UX-FLOW-027`, `UX-FLOW-028` | `UR-ADMIN-005`, `UR-BUYER-006`, `UR-SYSTEM-002`, `UR-ADMIN-008` |
| `UI-SCR-014` | Buyer OTP confirmation | Buyer | Enter OTP and confirm receipt | `UX-SCR-014`, `UX-FLOW-024`, `UX-FLOW-033` | `UR-BUYER-006`, `UR-BUYER-007`, `UR-BUYER-008`, `UR-SYSTEM-011` |
| `UI-SCR-015` | Admin confirmation exception | Admin | Review overdue confirmation evidence | `UX-SCR-015`, `UX-FLOW-030`, `UX-FLOW-031`, `UX-FLOW-032` | `UR-ADMIN-009`, `UR-ADMIN-010`, `UR-ADMIN-011` |
| `UI-SCR-016` | Admin seller payout | Admin | Prepare, start, and record seller payout | `UX-SCR-016`, `UX-FLOW-025`, `UX-FLOW-026`, `UX-FLOW-039` | `UR-ADMIN-006`, `UR-ADMIN-007`, `UR-ADMIN-015`, `UR-SYSTEM-009`, `UR-ADMIN-026` |
| `UI-SCR-017` | Admin complaint hold | Admin | Record complaint and outside-system settlement | `UX-SCR-017`, `UX-FLOW-034` through `UX-FLOW-039` | `UR-PARTY-003`, `UR-ADMIN-012`, `UR-PARTY-004`, `UR-ADMIN-013`, `UR-ADMIN-014`, `UR-ADMIN-015` |
| `UI-SCR-018` | Admin buyer refund | Admin | Prepare, start, and record a buyer refund | `UX-SCR-018`, `UX-FLOW-040`, `UX-FLOW-041`, `UX-FLOW-058`, `UX-FLOW-059`, `UX-FLOW-060`, `UX-FLOW-069`, `UX-FLOW-070`, `UX-FLOW-071` | `UR-ADMIN-016`, `UR-ADMIN-017`, `UR-BUYER-010`, `UR-CANCEL-008`, `UR-CANCEL-009`, `UR-CANCEL-010`, `UR-CANCEL-019`, `UR-CANCEL-020`, `UR-CANCEL-021` |
| `UI-SCR-019` | Admin split settlement | Admin | Prepare and record agreed split transfers | `UX-SCR-019`, `UX-FLOW-042`, `UX-FLOW-043` | `UR-ADMIN-018`, `UR-ADMIN-019`, `UR-ADMIN-024` |
| `UI-SCR-020` | Terminal transaction result | Buyer/Seller/Admin | Show final status and permitted references | `UX-SCR-020`, `UX-FLOW-026`, `UX-FLOW-041`, `UX-FLOW-043`, `UX-FLOW-045`, `UX-FLOW-049`, `UX-FLOW-052`, `UX-FLOW-053`, `UX-FLOW-056`, `UX-FLOW-060`, `UX-FLOW-071` | `UR-ADMIN-007`, `UR-ADMIN-017`, `UR-ADMIN-019`, `UR-SYSTEM-005`, `UR-SYSTEM-007`, `UR-CANCEL-002`, `UR-CANCEL-003`, `UR-CANCEL-006`, `UR-CANCEL-010`, `UR-CANCEL-021`, `UR-SYSTEM-009` |
| `UI-SCR-021` | Cancellation entry and eligibility | Buyer/Seller/Admin | Explain cancellation consequences and evaluate request | `UX-SCR-021`, `UX-FLOW-051`, `UX-FLOW-054`, `UX-FLOW-061`, `UX-FLOW-064`, `UX-FLOW-074` | `UR-CANCEL-001`, `UR-CANCEL-004`, `UR-CANCEL-011`, `UR-CANCEL-014`, `UR-CANCEL-024`, `UR-CANCEL-025`, `UR-SYSTEM-008`, `UR-PARTICIPANT-002` |
| `UI-SCR-022` | Admin Midtrans cancellation reconciliation | Admin | Reconcile provider events/status after invoice cancellation and record authoritative or definitive non-paid result | `UX-SCR-022`, `UX-FLOW-055`, `UX-FLOW-056`, `UX-FLOW-057`, `UX-FLOW-058`, `UX-FLOW-062`, `UX-FLOW-063` | `UR-CANCEL-005`, `UR-CANCEL-006`, `UR-CANCEL-007`, `UR-CANCEL-008`, `UR-CANCEL-012`, `UR-CANCEL-013`, `UR-PAYMENT-006`, `UR-PAYMENT-007`, `UR-SYSTEM-009`, `UR-ADMIN-022` |
| `UI-SCR-023` | Admin funded cancellation review | Admin | Review WA evidence, shipment state, cause, fee, and refund readiness | `UX-SCR-023`, `UX-FLOW-057`, `UX-FLOW-063`, `UX-FLOW-064` through `UX-FLOW-071`, `UX-FLOW-075` | `UR-CANCEL-007`, `UR-CANCEL-013`, `UR-CANCEL-014` through `UR-CANCEL-021`, `UR-CANCEL-025`, `UR-SYSTEM-008`, `UR-SYSTEM-009` |
| `UI-SCR-024` | Admin risk hold review | Admin | Review risk evidence without implying an outcome | `UX-SCR-024`, `UX-FLOW-072`, `UX-FLOW-073` | `UR-CANCEL-022`, `UR-CANCEL-023`, `UR-BR-060`, `UR-BR-061`, `UR-ADMIN-022` |

## 6. Screen Specification

The following blocks use the same interaction contract: every submit action has a loading state, the current status remains visible while loading, duplicate taps return the active/final result, and a failed operation never appears successful. Screen-specific states below override that general behavior only where stated.

### UI-SCR-001: Account Access

```text
Purpose: Authenticate and verify the account WhatsApp prerequisite.
Allowed actors: Buyer, Seller, Admin.
Entry conditions: App open, protected transaction link, or incomplete account prerequisite.
Source UX Flow IDs: UX-FLOW-001.
Source requirement IDs: UR-ACCOUNT-001, UR-ACCOUNT-002.
```

Content and hierarchy: identity first, WhatsApp prerequisite second, next available action third. Show whether the number is verified and whether it is already bound to another account.

Fields: full name; WhatsApp number; verification code. Full number is owner-only. Validation uses normalized number, one account per verified number, and mandatory completion before transaction participation.

Actions: `Continue` when account data is valid; `Verify WhatsApp` when number is unverified; `Retry` after provider failure; no transaction action while prerequisite is incomplete.

States: default shows the form; loading locks submit; empty is not applicable; error explains invalid/duplicate number; success routes to role start or the original link; disabled prevents transaction entry; expired link routes to invitation recovery; unauthorized denies protected access; manual review appears for lost-number recovery on an active transaction.

### UI-SCR-002: Role Start

```text
Purpose: Let one account start as buyer or seller without creating a new account role.
Allowed actors: Authenticated Buyer or Seller account.
Entry conditions: Account access is complete and user selects Create.
Source UX Flow IDs: UX-FLOW-002, UX-FLOW-007, UX-DEC-001.
Source requirement IDs: UR-INIT-001, UR-INIT-003.
```

Content: two equal choices, `Start as Seller` and `Start as Buyer`, plus existing transactions. Explain that the counterparty must use a distinct account with the opposite role.

Actions: role choice routes to UI-SCR-003 or UI-SCR-004; back returns to transactions; no action creates an invoice.

States: default shows both choices; loading is a short route transition; error preserves the selection; success opens the selected form; disabled applies only when account prerequisite is incomplete; expired/unauthorized follow UI-SCR-001; manual review is not applicable.

### UI-SCR-003: Seller Transaction Input

```text
Purpose: Collect shared deal data and seller-owned identity, contact, and payout data.
Allowed actors: Seller initiator.
Entry conditions: Seller role selected.
Source UX Flow IDs: UX-FLOW-003, UX-DEC-003.
Source requirement IDs: UR-SELLER-001, UR-SYSTEM-010, UR-PARTICIPANT-003.
```

Fields: item name, description, category, condition, quantity, item price, shipping cost, optional photo, seller name, seller WhatsApp, payout bank, account number, and account-holder name. Price is Rp100,000-Rp5,000,000; shipping is non-negative; only eligible physical goods are accepted; payout details are seller-authored.

Actions: `Save and create invitation` validates all required fields; `Save draft` retains draft only if supported by the approved implementation; `Cancel` returns without creating an invoice. The summary must show fee and buyer total only after valid calculation.

States: default is editable; loading locks save; empty shows field guidance; error marks field and summary calculation errors; success routes to UI-SCR-005; disabled applies until required fields are complete; expired is not applicable before invitation; unauthorized blocks non-seller editing; manual review appears only when a funded correction is later attempted.

### UI-SCR-004: Buyer Transaction Input

```text
Purpose: Collect shared deal data and buyer-owned identity, contact, address, and refund data.
Allowed actors: Buyer initiator.
Entry conditions: Buyer role selected.
Source UX Flow IDs: UX-FLOW-008, UX-DEC-003.
Source requirement IDs: UR-BUYER-003, UR-BUYER-010, UR-SYSTEM-010, UR-PARTICIPANT-003.
```

Fields: shared deal data, buyer full name, WhatsApp, shipping address, refund bank, refund account number, and account-holder name. Buyer cannot enter seller payout data. Refund bank is buyer-authored and frozen at payable time.

Actions: `Save and create invitation` validates and routes to UI-SCR-005; `Cancel` returns to role start; payment is not available until the seller completes seller-owned data.

States: default is editable; loading locks save; empty highlights missing buyer data; error explains invalid data or ineligible goods; success routes to UI-SCR-005; disabled prevents submit; expired invitation is handled by UI-SCR-006; unauthorized blocks seller/admin editing; manual review is only for later funded corrections.

### UI-SCR-005: Invitation Waiting

```text
Purpose: Show the initiator that the opposite role must join and provide a shareable invitation.
Allowed actors: Buyer or Seller initiator.
Entry conditions: Initiator data is saved and counterparty role is incomplete.
Source UX Flow IDs: UX-FLOW-004, UX-FLOW-009, UX-MAN-001, UX-DEC-015.
Source requirement IDs: UR-INIT-002, UR-INIT-004, UR-INIT-005, UR-CANCEL-002.
```

Content: transaction summary, invitation role, expiry timestamp, joined/not-joined indicator, no invoice/payment link, and cancellation eligibility. Show `WAITING_COUNTERPARTY` or `WAITING_COUNTERPARTY_DATA`.

Actions: `Copy invitation` opens the external share handoff; `Refresh status` reloads trusted state; `Cancel transaction` opens UI-MOD-001 only when initiator-only direct cancellation is eligible; reissue invalidates the previous link.

States: default shows waiting; loading shows status refresh; empty is not applicable; error keeps the invitation visible and offers retry; success after join routes to UI-SCR-007 or UI-SCR-008; disabled prevents payment/cancel actions when not eligible; expired shows reissue; unauthorized denies another account's invitation; manual review is shown only if a funded correction/cancellation later conflicts.

### UI-SCR-006: Invitation Join

```text
Purpose: Validate a role-bound invitation and bind a distinct opposite-role account.
Allowed actors: Invited Buyer or Seller.
Entry conditions: Shared invitation is opened.
Source UX Flow IDs: UX-FLOW-005, UX-FLOW-010, UX-DEC-002.
Source requirement IDs: UR-BUYER-001, UR-SELLER-002, UR-INIT-005.
```

Content: initiator name/role, transaction summary allowed by the link, invited role, expiry, and distinct-account warning. Do not show payout details or invoice/payment link before role completion.

Actions: `Continue as Buyer` or `Continue as Seller` after authentication; `Switch account` for wrong account; `Back` leaves the link unused. Same-account join is never enabled.

States: default shows invitation; loading validates token; empty is invalid invitation; error distinguishes expired, revoked, wrong account, and same-account rejection; success routes to UI-SCR-007 or UI-SCR-008; disabled prevents join until authentication; expired offers reissue contact path; unauthorized blocks access; manual review is not applicable.

### UI-SCR-007: Buyer Role Completion

```text
Purpose: Let the invited buyer author buyer-owned data and WhatsApp snapshot.
Allowed actors: Buyer account assigned to this transaction.
Entry conditions: Valid invitation and distinct account.
Source UX Flow IDs: UX-FLOW-006, UX-DEC-003.
Source requirement IDs: UR-BUYER-002, UR-BUYER-010, UR-ACCOUNT-002.
```

Fields: buyer name, verified WhatsApp, shipping address, refund bank, account number, and account-holder name. Only buyer-owned fields are editable. Show seller-owned fields as waiting, not editable.

Actions: `Complete buyer data` saves and routes to UI-SCR-009; `Edit` remains available until payable lock; no payment action is shown before both roles are complete.

States: default is incomplete form; loading locks save; empty shows required fields; error marks validation/provider errors; success shows waiting or payable status; disabled applies to missing verification; expired invitation routes to UI-SCR-005 recovery; unauthorized denies another account; manual review appears for active-number loss.

### UI-SCR-008: Seller Role Completion

```text
Purpose: Let the invited seller author seller-owned identity, WhatsApp, and payout data.
Allowed actors: Seller account assigned to this transaction.
Entry conditions: Valid invitation and distinct account.
Source UX Flow IDs: UX-FLOW-011, UX-DEC-003.
Source requirement IDs: UR-SELLER-003, UR-ACCOUNT-002.
```

Fields: seller name, verified WhatsApp, payout bank, account number, and account-holder name. Buyer cannot edit or replace these values.

Actions: `Complete seller data` saves and routes to UI-SCR-009; edit is allowed until payable lock; invoice/payment link remains hidden until both datasets are complete.

States: default is incomplete form; loading locks save; empty shows required payout/contact fields; error explains invalid bank or number; success routes to waiting/payable status; disabled applies to unverified WhatsApp; expired/wrong-account follow invitation recovery; manual review appears for active-number loss or funded correction.

### UI-SCR-009: Participant Transaction Status

```text
Purpose: Provide one trusted status surface for buyer and seller.
Allowed actors: Buyer or Seller associated with the transaction.
Entry conditions: Transaction exists or a participant opens a link.
Source UX Flow IDs: UX-FLOW-012, UX-FLOW-019, UX-FLOW-032, UX-FLOW-067, UX-FLOW-075.
Source requirement IDs: UR-PARTICIPANT-001, UR-PARTICIPANT-002, UR-PARTICIPANT-004, UR-CANCEL-017, UR-CANCEL-025.
```

Content hierarchy: status banner, next responsible actor, deadline/timer, current checkpoint, allowed primary action, hold explanation, masked financial summary, and event timeline. The other participant's bank data shows only bank name and last four digits.

Actions: open payment, open cancellation, provide required participant response through the external channel, open confirmation link, or view terminal result when available. Actions not valid for the state are hidden or disabled with an explanation.

States: default shows current status; loading preserves previous trusted status; empty shows no transaction; error offers retry without changing state; success shows the recorded transition; disabled shows hold/cutoff; expired shows `PAYMENT_EXPIRED` or invitation expiry; unauthorized denies access; manual review shows owner, reason category, and no financial action promise.

### UI-SCR-010: Buyer Midtrans Payment

```text
Purpose: Send the buyer to the hosted Midtrans payment page and show the frozen BayarAman payment context.
Allowed actors: Buyer.
Entry conditions: Both role datasets are complete and payment is payable.
Source UX Flow IDs: UX-FLOW-013, UX-FLOW-014, UX-FLOW-044, UX-FLOW-046, UX-FLOW-048.
Source requirement IDs: UR-BUYER-004, UR-BUYER-005, UR-SYSTEM-004, UR-SYSTEM-005, UR-SYSTEM-006, UR-SYSTEM-007, UR-BUYER-009, UR-PAYMENT-001, UR-PAYMENT-002, UR-PAYMENT-003.
```

Fields/displayed data: item price, shipping, service fee, exact frozen total, Midtrans invoice/payment-link reference, hosted checkout link, original deadline in WIB, provider status, and help message. Midtrans secrets and raw provider credentials are never shown.

Actions: `Bayar melalui Midtrans` opens the hosted payment page; `Cek status pembayaran` refreshes provider status without confirming payment; `Cancel transaction` opens UI-SCR-021 if eligible. No client action can mark payment paid.

States: default shows invoice and timer; loading shows provider-page navigation or status refresh; empty is not payable; error shows provider outage or unavailable invoice with retry; pending/capture remain non-authoritative; settlement plus `fraud_status=accept` shows confirmed payment; denied/cancelled/failed/expire remain non-paid; expired shows `PAYMENT_EXPIRED`; unauthorized denies access; `UNKNOWN`, mismatch, signature, duplicate, or out-of-order results show Admin reconciliation without deadline reset.

### UI-SCR-011: Admin Midtrans Payment Reconciliation

```text
Purpose: Let Admin review validated Midtrans webhook/Get Status results and reconcile provider exceptions.
Allowed actors: Admin with the relevant internal task assignment.
Entry conditions: `PAYMENT_UNDER_REVIEW` or a payment exception requires review.
Source UX Flow IDs: UX-FLOW-015, UX-FLOW-016, UX-FLOW-047, UX-FLOW-048, UX-FLOW-049, UX-FLOW-050, UX-FLOW-061, UX-FLOW-062, UX-FLOW-063.
Source requirement IDs: UR-ADMIN-001, UR-ADMIN-002, UR-ADMIN-020, UR-ADMIN-021, UR-ADMIN-023, UR-PAYMENT-004, UR-PAYMENT-005, UR-PAYMENT-006, UR-CANCEL-005, UR-CANCEL-011, UR-CANCEL-012, UR-CANCEL-013.
```

Fields: transaction ID, Midtrans order ID, invoice ID, event ID/time, expected amount, received amount, signature/order/amount/fraud validation results, provider status, event ordering, Get Status result, reconciliation note, and cancellation-pending indicator. Raw provider evidence is Admin-only.

Actions: `Accept authoritative settlement`, `Record definitive non-paid`, `Reconcile UNKNOWN`, `Refresh Get Status`, and `Save reconciliation`. Settlement is accepted only with `fraud_status=accept`; duplicate or stale events return the existing result; cancellation keeps the existing provider review authoritative.

States: default shows provider event review; loading locks result controls; empty shows no event or reconciliation task; error retains the current non-authoritative state; success routes to confirmed operations, waiting/expired payment, cancelled, or funded review; disabled prevents duplicate/out-of-order mutation; expired preserves the original deadline; unauthorized hides raw evidence; manual review remains for UNKNOWN, mismatch, signature failure, outage, or late success.

### UI-SCR-012: Admin Operations

```text
Purpose: Coordinate manual WhatsApp work and record trusted checkpoints.
Allowed actors: Admin with the relevant internal task assignment.
Entry conditions: Payment is confirmed or an operational checkpoint is due.
Source UX Flow IDs: UX-FLOW-017, UX-FLOW-018, UX-FLOW-020, UX-FLOW-021, UX-FLOW-022, UX-FLOW-034, UX-FLOW-035, UX-FLOW-038, UX-FLOW-050.
Source requirement IDs: UR-ADMIN-003, UR-ADMIN-004, UR-PARTY-001, UR-PARTY-002, UR-ADMIN-005, UR-PARTY-003, UR-ADMIN-012, UR-ADMIN-014, UR-ADMIN-021, UR-SYSTEM-008, UR-ADMIN-022.
```

Content: task queue, transaction participants and WhatsApp snapshots, payment announcement checkpoint, seller/buyer completion checkpoints, confirmation-link post checkpoint, complaint report, written agreement evidence, and current financial hold.

Actions: `Create/use group`, `Record payment announcement`, `Record seller complete`, `Record buyer complete`, `Post confirmation link`, `Record complaint`, `Record written agreement`, and `Open next Admin task`. Every action asks for source/reference, timestamp, and operator confirmation. WhatsApp itself remains external.

States: default shows due tasks; loading locks the selected checkpoint; empty shows no due operations; error preserves incomplete checkpoint and offers retry; success updates the timeline; disabled applies when prerequisite or hold is missing; expired shows invitation/deadline status; unauthorized hides restricted evidence; manual review shows the unresolved task and owner.

### UI-SCR-013: Buyer Confirmation Link

```text
Purpose: Bind the confirmation session to the buyer and request OTP on the fixed WhatsApp snapshot.
Allowed actors: Buyer associated with the secure link.
Entry conditions: Both completion checkpoints exist and link is valid.
Source UX Flow IDs: UX-FLOW-022, UX-FLOW-023, UX-FLOW-027, UX-FLOW-028.
Source requirement IDs: UR-ADMIN-005, UR-BUYER-006, UR-SYSTEM-002, UR-ADMIN-008.
```

Content: transaction summary, both completion checkpoint statuses, buyer WhatsApp masked, confirmation deadline, and clear statement that OTP confirms goods receipt but does not itself transfer money.

Actions: `Send OTP` sends to the fixed snapshot; `Enter OTP` routes to UI-SCR-014; `Back to transaction` returns to read-only status. No channel switch or number edit is offered.

States: default shows request action; loading shows OTP request progress; empty is invalid link; error explains invalid/expired link or delivery failure; success confirms OTP sent; disabled applies to hold, expired, or already confirmed; expired shows confirmation overdue/recovery; unauthorized denies non-buyer access; manual review appears after bounded delivery failure.

### UI-SCR-014: Buyer OTP Confirmation

```text
Purpose: Authenticate buyer receipt confirmation using WhatsApp OTP.
Allowed actors: Buyer associated with the link.
Entry conditions: OTP was requested for the fixed buyer number.
Source UX Flow IDs: UX-FLOW-024, UX-FLOW-033, UX-DEC-007, UX-DEC-008.
Source requirement IDs: UR-BUYER-006, UR-BUYER-007, UR-BUYER-008, UR-SYSTEM-011.
```

Fields: six-digit OTP, masked destination, remaining validity, resend cooldown, attempt count, and lockout message. OTP value is never echoed or shown to Admin.

Actions: `Confirm receipt`, `Resend OTP` under limits, and `Return to transaction`. A valid OTP moves to `READY_FOR_PAYOUT` only when no complaint/risk hold blocks it.

States: default accepts six digits; loading validates once; empty shows input; error shows invalid/expired code and remaining attempts; success shows receipt confirmed and routes to status; disabled applies during cooldown/lockout/hold; expired shows request-new-code or overdue path; unauthorized denies access; manual review appears after repeated delivery failure or a blocked hold.

### UI-SCR-015: Admin Confirmation Exception

```text
Purpose: Review overdue buyer confirmation and record a controlled Admin exception when evidence allows it.
Allowed actors: Admin with the relevant internal task assignment.
Entry conditions: `BUYER_CONFIRMATION_OVERDUE`.
Source UX Flow IDs: UX-FLOW-030, UX-FLOW-031, UX-FLOW-032, UX-DEC-011.
Source requirement IDs: UR-ADMIN-009, UR-ADMIN-010, UR-ADMIN-011.
```

Fields: buyer-complete checkpoint, WA evidence reference, complaint/risk hold status, reason, operator, timestamp, and exception result. Evidence is sensitive and Admin-only.

Actions: `Record eligible exception`, `Keep manual review`, or `Record complaint hold`. The eligible action is disabled when buyer evidence is missing or any hold exists.

States: default shows overdue evidence; loading locks decision; empty means no overdue case; error preserves hold; success routes to `READY_FOR_PAYOUT` or `PAYOUT_ON_HOLD`; disabled explains missing evidence; expired is the overdue state itself; unauthorized hides raw evidence; manual review remains visible until a valid result is recorded.

### UI-SCR-016: Admin Seller Payout

```text
Purpose: Prepare, start, and record the external seller payout.
Allowed actors: Admin with payout task assignment.
Entry conditions: `READY_FOR_PAYOUT`, seller snapshot exists, and no hold is active.
Source UX Flow IDs: UX-FLOW-025, UX-FLOW-026, UX-FLOW-039, UX-DEC-014.
Source requirement IDs: UR-ADMIN-006, UR-ADMIN-007, UR-ADMIN-015, UR-SYSTEM-009, UR-ADMIN-026.
```

Fields: seller bank snapshot, item plus shipping release amount, operation ID, approval/task context, transfer status, bank reference, result note, and audit timestamp. Account number is masked except for authorized Admin.

Actions: `Start payout` creates an operation before external transfer; `Record success`, `Record failed`, or `Record unknown` records the result. `Retry` is only available for confirmed failure.

States: default shows ready amount; loading shows `PAYOUT_PROCESSING`; empty means not eligible; error leaves payout non-terminal; success requires bank reference and routes to `PAID_OUT`; disabled applies to any hold or missing approval; expired is not applicable; unauthorized denies bank data; manual review is used for unknown results.

### UI-SCR-017: Admin Complaint Hold

```text
Purpose: Record a complaint, preserve the hold, and record an outside-system written agreement without adjudicating it.
Allowed actors: Admin; Buyer and Seller participate through WhatsApp outside the system.
Entry conditions: Complaint reported before payout processing.
Source UX Flow IDs: UX-FLOW-034 through UX-FLOW-039, UX-DEC-012, UX-DEC-013.
Source requirement IDs: UR-PARTY-003, UR-ADMIN-012, UR-PARTY-004, UR-ADMIN-013, UR-ADMIN-014, UR-ADMIN-015.
```

Fields: reporter, complaint summary, WhatsApp evidence reference, hold timestamp, written agreement evidence, selected outcome, agreed amounts, and operator. Raw complaint evidence is Admin-only; participants see hold and outcome summary.

Actions: `Record complaint`, `Record no agreement`, `Record written agreement`, and route to seller release, buyer refund, or split. Financial actions are disabled until a valid recorded agreement exists.

States: default shows `PAYOUT_ON_HOLD`; loading locks record; empty is not a complaint case; error leaves hold unchanged; success routes to `READY_FOR_PAYOUT`, `REFUND_READY`, or split preparation; disabled prevents payout/exception; expired is not applicable; unauthorized denies evidence; manual review remains while no written agreement exists.

### UI-SCR-018: Admin Buyer Refund

```text
Purpose: Prepare, start, and record a buyer refund through Midtrans or the approved Admin fallback.
Allowed actors: Admin with refund task assignment.
Entry conditions: Approved complaint refund, cancellation refund, late-fund exception, or authorized risk outcome is `REFUND_READY`.
Source UX Flow IDs: UX-FLOW-040, UX-FLOW-041, UX-FLOW-058 through UX-FLOW-060, UX-FLOW-069 through UX-FLOW-071, UX-DEC-014.
Source requirement IDs: UR-ADMIN-016, UR-ADMIN-017, UR-BUYER-010, UR-CANCEL-008, UR-CANCEL-009, UR-CANCEL-010, UR-CANCEL-019, UR-CANCEL-020, UR-CANCEL-021, UR-SYSTEM-009, UR-ADMIN-026.
```

Fields: cause, item price, shipping, service-fee treatment, refund amount, approved buyer destination, verified original source when supported, selected route (`Midtrans Refund API` or `Admin manual fallback`), operation ID, approval/task context, status, reference, and note. The UI must show the calculation before transfer and must not permit ad hoc destination edits.

Actions: `Approve/prepare calculation` when assigned, `Start Midtrans refund`, `Start manual fallback`, `Record success`, `Record failed`, and `Record unknown`. Retry is only available for confirmed failure; unknown requires reconciliation.

States: default shows `REFUND_READY`; loading shows `PROCESSING`; empty means no refund eligibility; error leaves the refund non-terminal; success requires financial reference/evidence and routes to `REFUNDED`; `FAILED` enables retry; `UNKNOWN` hides retry until reconciliation; disabled applies to holds, missing evidence, or invalid calculation; expired is not applicable; unauthorized masks destination/evidence; manual review is shown for ambiguous cause, failed, or unknown result.

### UI-SCR-019: Admin Split Settlement

```text
Purpose: Record two manual settlement legs from an approved complaint agreement.
Allowed actors: Admin with settlement task assignment.
Entry conditions: Written agreement selects split and amounts validate.
Source UX Flow IDs: UX-FLOW-042, UX-FLOW-043, UX-DEC-013, UX-DEC-014.
Source requirement IDs: UR-ADMIN-018, UR-ADMIN-019, UR-ADMIN-024.
```

Fields: buyer portion, seller portion, item plus shipping pool, masked destinations, two operation IDs, transfer order, results, and references. Service fee is shown outside the split pool.

Actions: `Start split`, `Record buyer leg`, `Record seller leg`, `Record failed`, and `Record unknown`. Both successful references are required for `SPLIT_SETTLED`; blind retry is disabled for unknown.

States: default shows validated split; loading shows processing legs; empty means no agreement; error leaves the affected leg non-terminal; success shows `SPLIT_SETTLED` only after both references; disabled applies to invalid totals or hold; expired is not applicable; unauthorized masks destinations; manual review remains for unknown or conflicting results.

### UI-SCR-020: Terminal Transaction Result

```text
Purpose: Show a read-only terminal or closed financial result with only permitted references.
Allowed actors: Buyer, Seller, Admin.
Entry conditions: `PAID_OUT`, `PAYMENT_EXPIRED`, `CANCELLED`, `REFUNDED`, or `SPLIT_SETTLED`.
Source UX Flow IDs: UX-FLOW-026, UX-FLOW-041, UX-FLOW-043, UX-FLOW-045, UX-FLOW-049, UX-FLOW-052, UX-FLOW-053, UX-FLOW-056, UX-FLOW-060, UX-FLOW-071.
Source requirement IDs: UR-ADMIN-007, UR-ADMIN-017, UR-ADMIN-019, UR-SYSTEM-005, UR-SYSTEM-007, UR-CANCEL-002, UR-CANCEL-003, UR-CANCEL-006, UR-CANCEL-010, UR-CANCEL-021, UR-SYSTEM-009.
```

Content: final status, timestamp, next support/manual path if allowed, amount summary appropriate to the actor, and masked transfer reference. A cancelled transaction explicitly says that late funds do not reactivate it.

Actions: `View details`, `View allowed reference`, or `Contact support/manual Admin path` where the upstream flow allows it. No transaction mutation or cancellation action is available after terminal state.

States: default is read-only result; loading refreshes status; empty is not applicable; error offers refresh without changing result; success shows authoritative reference; disabled removes financial actions; expired is represented by `PAYMENT_EXPIRED`; unauthorized masks details; manual review is shown only when a terminal financial result is not yet evidenced.

### UI-SCR-021: Cancellation Entry And Eligibility

```text
Purpose: Let an eligible participant or Admin start cancellation and understand that a request is not yet a result.
Allowed actors: Buyer, Seller, or Admin according to current transaction state.
Entry conditions: Transaction context is open and actor/status/cutoff evaluation can run.
Source UX Flow IDs: UX-FLOW-051, UX-FLOW-054, UX-FLOW-061, UX-FLOW-064, UX-FLOW-074, UX-DEC-015, UX-DEC-016.
Source requirement IDs: UR-CANCEL-001, UR-CANCEL-004, UR-CANCEL-011, UR-CANCEL-014, UR-CANCEL-024, UR-CANCEL-025, UR-BR-047, UR-BR-048.
```

Fields: current status, requester role, cancellation reason taxonomy, optional note required for `OTHER_MANUAL_REVIEW`, payment exposure, shipment checkpoint, financial cutoff, consequence summary, and request ID after submission.

Actions: `Request cancellation`, `Withdraw request` when valid, `Close`, and `View current status`. Confirmation must state whether the result is direct `CANCELLED`, pending reconciliation, payment-review waiting, funded review, risk hold, or rejection. Duplicate submission returns the existing request.

States: default shows eligibility and consequence; loading shows request evaluation; empty is not applicable; error preserves current status; success shows `CANCELLATION_REQUESTED` or the resulting branch; disabled explains cutoff/hold; expired shows no action; unauthorized hides action; manual review shows owner and no financial outcome.

### UI-SCR-022: Admin Cancellation Reconciliation

```text
Purpose: Reconcile Midtrans provider events/status after invoice cancellation entry or while provider payment review is authoritative.
Allowed actors: Admin with internal Midtrans reconciliation task assignment.
Entry conditions: A Midtrans invoice existed, provider payment is under review, or a late provider success is detected.
Source UX Flow IDs: UX-FLOW-055, UX-FLOW-056, UX-FLOW-057, UX-FLOW-058, UX-FLOW-062, UX-FLOW-063, UX-DEC-017, UX-DEC-018.
Source requirement IDs: UR-CANCEL-005, UR-CANCEL-006, UR-CANCEL-007, UR-CANCEL-008, UR-CANCEL-012, UR-CANCEL-013, UR-BR-050, UR-BR-051, UR-BR-052, UR-BR-059.
```

Fields: original deadline, reconciliation start/deadline in WIB, expected amount, Midtrans order/event/status reference, authoritative/non-authoritative/definitive-non-paid/UNKNOWN result, received amount, operator, and current state version. The invoice is visibly inactive.

Actions: `Record definitive non-paid`, `Record authoritative settlement`, `Reconcile late success`, `Continue reconciliation`, and `Escalate manual review`. No result may be inferred from a timeout; a duplicate result returns the active/final result.

States: default shows waiting reconciliation; loading locks result; empty means no reconciliation task; error keeps pending; success routes to `CANCELLED`, funded review, or late-fund refund; disabled prevents a second reconciliation for the same active request; expired becomes `MANUAL_REVIEW_REQUIRED` if no authoritative result exists; unauthorized hides raw provider evidence; manual review shows overdue owner and unresolved exposure.

### UI-SCR-023: Admin Funded Cancellation Review

```text
Purpose: Review funded cancellation evidence before shipment and expose only the approved next operation.
Allowed actors: Admin with the relevant internal task assignment.
Entry conditions: Funds are confirmed and goods are not confirmed shipped.
Source UX Flow IDs: UX-FLOW-057, UX-FLOW-063, UX-FLOW-064 through UX-FLOW-071, UX-FLOW-075, UX-DEC-019, UX-DEC-020, UX-DEC-021, UX-DEC-023.
Source requirement IDs: UR-CANCEL-007, UR-CANCEL-013, UR-CANCEL-014 through UR-CANCEL-021, UR-CANCEL-025, UR-SYSTEM-008, UR-SYSTEM-009, UR-BR-053 through UR-BR-058, UR-BR-062 through UR-BR-065.
```

Content: funded amount, inactive fulfillment/payout status, WA group/message checkpoint, required responder, 1x24-hour deadline, seller shipped/not-shipped statement, participant response, evidence references, cause, service-fee treatment, refund calculation, and current Admin task.

Actions: `Create/use group and request response`, `Record seller statement`, `Record participant response`, `Mark overdue`, `Open complaint hold`, `Prepare refund`, `Withdraw/reject`, and `Open risk hold`. Actions are state-versioned and each checkpoint is separate. No direct payout or refund occurs from evidence alone.

States: default shows funded review; loading locks the current checkpoint; empty means no funded case; error preserves hold; success routes to refund ready, complaint hold, risk hold, or valid prior state; disabled explains missing response/evidence or cutoff; expired after 1x24 hour shows `MANUAL_REVIEW_REQUIRED`; unauthorized masks raw evidence; manual review is the normal state for missing/conflicting evidence.

### UI-SCR-024: Admin Risk Hold Review

```text
Purpose: Record and review a prohibited-item, suspected-fraud, or policy hold without implying a default money outcome.
Allowed actors: Admin; internal task assignment may restrict evidence/actions.
Entry conditions: Admin records a risk concern and transaction enters `RISK_HOLD`.
Source UX Flow IDs: UX-FLOW-072, UX-FLOW-073, UX-DEC-022, UX-MAN-020, UX-EXT-003.
Source requirement IDs: UR-CANCEL-022, UR-CANCEL-023, UR-BR-060, UR-BR-061, UR-ADMIN-022.
```

Fields: risk category, reason, evidence references, current hold status, assigned Admin task, allowed outcome, decision note, approval/audit timestamps, and permitted financial operation. Buyer and seller do not see raw evidence or internal risk notes.

Actions: `Create hold`, `Record review outcome`, `Keep hold`, `Open refund preparation` only when explicitly authorized, and `Return to transaction`. No default refund, payout, fee, or release action is presented.

States: default shows outcome-neutral hold; loading locks review; empty is not a risk case; error leaves `RISK_HOLD`; success exposes only the recorded authorized operation; disabled blocks incompatible actions; expired is not applicable because risk holds have no participant-facing automatic expiry; unauthorized hides restricted evidence; manual review is the expected state until Admin records an outcome.

## 7. Cross-Screen Interactions And Feedback

| Trigger | UI response | Status feedback | Notification/channel | Retry or next action |
| --- | --- | --- | --- | --- |
| Both role datasets complete | Participant status switches to payable; buyer payment card appears | `WAITING_BUYER_PAYMENT` with original deadline | BayarAman status | Open UI-SCR-010 |
| Buyer opens hosted checkout | Midtrans payment page opens with frozen amount | Provider pending/non-authoritative until validated | BayarAman/Midtrans | Buyer returns to UI-SCR-010 |
| Buyer selects `Cek status pembayaran` | Status refreshes without payment confirmation | Current provider/BayarAman state | BayarAman/Midtrans | Retry while deadline remains valid |
| Midtrans webhook is authoritative | Participant status updates and Admin task opens | `PAYMENT_CONFIRMED` | BayarAman plus manual WhatsApp announcement | Admin records group/announcement in UI-SCR-012 |
| Midtrans result is non-authoritative or ambiguous | Buyer sees waiting/reconciliation state and unchanged deadline | Existing waiting state or `MANUAL_REVIEW_REQUIRED` | BayarAman/Admin | Admin uses Get Status API |
| Buyer or seller requests cancellation | Confirmation modal records request, then shows branch | `CANCELLATION_REQUESTED` or branch status | BayarAman | Reopen current status, never duplicate request |
| Cancellation has payment exposure | Payment card is inactive and reconciliation deadline appears | `CANCELLATION_PENDING_RECONCILIATION` | BayarAman/Admin task | Admin opens UI-SCR-022 |
| Cancellation waits for active payment review | Cancellation banner explains review ownership | `PAYMENT_UNDER_REVIEW` with pending cancellation | BayarAman | Existing review continues in UI-SCR-011 |
| Funds found for cancellation | Fulfillment and payout actions disappear; funded review appears | `FUNDED_CANCELLATION_REVIEW` | BayarAman and manual WhatsApp | Admin opens UI-SCR-023 |
| Admin posts funded-cancellation response request | Required responder and deadline appear in timeline | Funded review waiting | WhatsApp group plus BayarAman checkpoint | Admin records response or timeout |
| Seller says goods shipped or evidence conflicts | Cancellation refund action disappears | `PAYOUT_ON_HOLD` | BayarAman plus manual WhatsApp | Admin opens UI-SCR-017 |
| Funded response deadline passes | Missing response and no-auto-money message appear | `MANUAL_REVIEW_REQUIRED` | BayarAman and manual follow-up | Admin continues evidence review |
| Buyer opens confirmation link | Buyer sees masked destination and OTP request | `WAITING_BUYER_CONFIRMATION` | WhatsApp OTP | UI-SCR-014 |
| OTP valid | Receipt confirmation is recorded; payout eligibility is separate | `READY_FOR_PAYOUT` | BayarAman | Admin opens UI-SCR-016 |
| OTP invalid/expired/locked | Attempts, cooldown, or lockout is shown | Confirmation remains waiting/locked | WhatsApp retry within limits | Request newest OTP when allowed |
| Complaint recorded | All normal payout/exception actions become unavailable | `PAYOUT_ON_HOLD` | BayarAman plus WhatsApp | Admin records agreement in UI-SCR-017 |
| Financial operation starts | Amount and destination are fixed; success is not shown | `PAYOUT_PROCESSING`, `REFUND_PROCESSING`, or `SPLIT_PROCESSING` | BayarAman | Record result; retry only confirmed failure |
| Financial result unknown | Retry action is hidden | `UNKNOWN` | Admin escalation | Reconcile provider/manual operation before retry |
| Financial result succeeds | Terminal reference summary appears | `PAID_OUT`, `REFUNDED`, or `SPLIT_SETTLED` | BayarAman | Read-only UI-SCR-020 |
| Payment deadline expires | Payment controls disappear | `PAYMENT_EXPIRED` | BayarAman | Read-only terminal result |

## 8. Role Visibility, Privacy, And Safety

| Data/action | Visible to | Hidden/masked from | Reason/source ID |
| --- | --- | --- | --- |
| Own full identity, WhatsApp, address, refund bank, or payout bank | Owning Buyer/Seller and authorized Admin task | Other participant | `UR-ACCOUNT-001`, `UR-BR-045` |
| Other participant bank data | Buyer/Seller as bank name plus last four digits | Full account number | `UR-BR-045`, `UR-PARTICIPANT-002` |
| Midtrans invoice/payment status | Buyer; Admin as needed | Seller and unrelated accounts | `UR-BUYER-004`, `UR-PAYMENT-003`, `UX-SCR-010` |
| Provider event and reconciliation status | Buyer, seller, Admin | Raw provider evidence from participants | `UR-BUYER-005`, `UR-ADMIN-001`, `UR-PAYMENT-004` |
| WhatsApp participant snapshots | Admin task assignment; masked where not needed | Unrelated Admin and other participant except permitted contact display | `UR-ADMIN-003`, `UR-CAN-OD-004` |
| Raw WhatsApp cancellation evidence | Authorized Admin task assignment | Buyer, seller, unrelated Admin | `UR-CANCEL-016`, `UR-CAN-OD-004` |
| Seller/buyer completion checkpoints | Buyer, seller, Admin | Raw source evidence from participants | `UR-PARTY-001`, `UR-PARTY-002` |
| OTP destination | Buyer as masked number; system/provider | Seller, Admin, other accounts | `UR-BUYER-006`, `UR-BR-004` |
| Complaint evidence and agreement | Admin; participants see hold/outcome summary | Unrelated accounts | `UR-PARTY-004`, `UR-ADMIN-014` |
| Risk reason, raw evidence, internal notes | Authorized Admin task assignment | Buyer, seller, unrelated Admin | `UR-CANCEL-022`, `UR-CAN-OD-006` |
| Risk hold status | Buyer, seller, Admin | Restricted evidence and default outcome assumptions | `UX-MSG-016`, `UR-CANCEL-022` |
| Refund/payout attempt state | Relevant recipient and Admin | Other participant's full destination | `UR-SYSTEM-009`, `UR-BR-045` |
| Audit event details | Admin according to task; participants see relevant status history | Unrelated accounts and restricted evidence | `UR-ADMIN-022`, `UR-BR-065` |

Safety rules: financial actions require explicit confirmation and fixed amount/destination summary; cancellation requires current state/version validation; duplicate requests return the active/final result; `UNKNOWN` results cannot be retried blindly; sensitive evidence is never copied into participant notifications.

## 9. Responsive And Accessibility Specification

| Area/UI ID | Small viewport behavior | Large viewport behavior | Keyboard/focus | Label/contrast/announcement needs |
| --- | --- | --- | --- | --- |
| App shell, UI-SCR-001 through 024 | Full available viewport width with one-column flow and bottom-safe spacing | Constrained mobile-width surface centered in browser canvas; no wide dashboard expansion | Focus order follows header, status, content, primary action, secondary action | Landmark labels, visible page title, focus ring, no color-only status |
| Status banner, UI-SCR-009/020 | Full-width within app surface; status and next actor stack vertically | Same mobile width; no horizontal stretching | Banner announced on status transition | Text status ID/label, icon plus color, sufficient contrast |
| Timers, UI-SCR-005/010/013/022/023 | Timer remains near relevant action and wraps without clipping | Same hierarchy and width | Timer updates must not steal focus | Absolute WIB deadline plus remaining time; do not rely on color |
| Forms, UI-SCR-003/004/007/008 | One field per row; validation below field; sticky submit only when it does not occlude content | Same column width; no multi-column form expansion | Labels, errors, and required state programmatically associated | Input labels are persistent; numeric currency uses clear unit and integer formatting |
| Admin evidence tables, UI-SCR-011/012/015/017/018/019/022/023/024 | Cards or stacked rows; horizontal scrolling allowed only for non-editable audit detail | Constrained table/card surface with visible task filters | Keyboard can reach filters, evidence, action, and confirmation | Masked values, row headings, announced result/error, no raw evidence in generic toast |
| Confirmation/OTP, UI-SCR-013/014 | Large touch targets; OTP cells remain one logical input; no horizontal clipping | Same mobile surface | Focus moves to OTP input after successful request; errors return focus to input | Remaining attempts/cooldown announced; never expose OTP value in accessible label |
| Modals, UI-MOD-001/002 | Full-width bottom sheet or near-full viewport with clear close/confirm controls | Same constrained surface, never centered as a desktop dashboard dialog | Focus trap and return focus to triggering action | Consequence, status, and destructive action text are explicit |
| Notifications and inline messages | Wrap naturally; no overlay over action | Same copy and hierarchy | Live region only for meaningful result/error, not ticking timer | Message intent and recovery action are explicit |

## 10. Content And Terminology

| UI ID | Element | Approved copy/intent | Dynamic values | Error/help copy |
| --- | --- | --- | --- | --- |
| `UI-SCR-001` | WhatsApp prerequisite | "Nomor WhatsApp wajib diverifikasi sebelum transaksi." | Masked number | Explain duplicate number and manual active-transaction recovery |
| `UI-SCR-005` | Waiting status | "Menunggu pihak lain bergabung." | Counterparty role, invitation deadline | "Pembayaran belum tersedia." |
| `UI-SCR-010` | Midtrans payment | "Bayar melalui Midtrans" / "Cek status pembayaran" | Frozen amount, payment link, original deadline, provider status | "Pembayaran dinyatakan masuk setelah status Midtrans terverifikasi." |
| `UI-SCR-011` | Provider reconciliation | "Pembayaran terverifikasi" / "Status masih diproses" / "Status perlu rekonsiliasi" | Midtrans reference, validation result, operator/time | "Status provider belum authoritative. Admin perlu melakukan rekonsiliasi." |
| `UI-SCR-012` | WA checkpoint | "Catat checkpoint WhatsApp" | Group/message reference, timestamp | "Pesan WhatsApp tidak menjadi status transaksi sebelum dicatat Admin." |
| `UI-SCR-013` | OTP request | "Kirim OTP ke WhatsApp berakhiran ...." | Masked last digits, cooldown | "OTP hanya dikirim ke nomor WhatsApp transaksi." |
| `UI-SCR-017` | Complaint hold | "Payout ditahan. Penyelesaian dilakukan melalui WhatsApp." | Hold time, next Admin action | Do not describe BayarAman as deciding who is right |
| `UI-SCR-021` | Cancellation request | "Ajukan pembatalan" | Reason, current state, consequence | "Pengajuan belum berarti transaksi sudah dibatalkan." |
| `UI-SCR-022` | Reconciliation | "Invoice dinonaktifkan sementara." | WIB deadline, provider amount/reference, reconciliation result | "Admin masih merekonsiliasi status Midtrans. Sistem tidak mengaktifkan kembali transaksi secara otomatis." |
| `UI-SCR-023` | Funded review | "Dana ditemukan. Pengiriman dan payout ditahan untuk review." | Response deadline, evidence state | "Tidak ada refund atau payout otomatis." |
| `UI-SCR-024` | Risk hold | "Transaksi sedang ditinjau Admin." | Generic status, next review state | Do not expose fraud/policy evidence to participants |
| `UI-SCR-020` | Late funds | "Dana yang masuk terlambat tidak mengaktifkan kembali transaksi." | Received amount, refund status | Show refund-only path and non-reactivation |
| All | Status labels | `WAITING_COUNTERPARTY`, `WAITING_BUYER_PAYMENT`, `PAYMENT_UNDER_REVIEW`, `CANCELLATION_PENDING_RECONCILIATION`, `FUNDED_CANCELLATION_REVIEW`, `MANUAL_REVIEW_REQUIRED`, `PAYOUT_ON_HOLD`, `RISK_HOLD`, `REFUND_PROCESSING`, `REFUNDED`, `PAID_OUT`, `PAYMENT_EXPIRED`, `CANCELLED` | Human-readable Indonesian label plus stable status ID for Admin | Every non-terminal status names next actor and recovery |

## 11. Wireframe Or Prototype References

| UI/flow IDs | Artifact/link | Fidelity | What must be reviewed | Status |
| --- | --- | --- | --- | --- |
| All UI-SCR IDs | None | N/A | No wireframe or prototype is included in UI/UX Specification v0.2 | Not created |

No prototype behavior may be treated as a requirement. A future prototype must link back to this approved specification and preserve the same IDs and states.

## 12. Usability Review Scenarios

| Review ID | Actor/task | Starting point | Success signal | Observed issue/decision |
| --- | --- | --- | --- | --- |
| `UX-REVIEW-001` | Seller creates a transaction and shares invitation | UI-SCR-002 | Seller sees waiting state and no invoice/payment link | To be reviewed |
| `UX-REVIEW-002` | Buyer joins seller invitation with a distinct account | UI-SCR-006 | Buyer owns only buyer fields and reaches payable state after completion | To be reviewed |
| `UX-REVIEW-003` | Buyer opens Midtrans checkout and refreshes payment status | UI-SCR-010 | Refresh is visibly different from payment confirmation | To be reviewed |
| `UX-REVIEW-004` | Admin records payment and creates WA checkpoints | UI-SCR-011 | Manual bank/WA boundaries and audit fields are clear | To be reviewed |
| `UX-REVIEW-005` | Buyer opens confirmation link and completes WhatsApp OTP | UI-SCR-013 | OTP destination is fixed and payout eligibility is distinct from payout success | To be reviewed |
| `UX-REVIEW-006` | Buyer or seller requests cancellation before payment exposure | UI-SCR-021 | Direct cancellation consequence is clear and idempotent | To be reviewed |
| `UX-REVIEW-007` | Cancellation is requested after invoice creation | UI-SCR-021/022 | Invoice becomes inactive and reconciliation deadline is understandable | To be reviewed |
| `UX-REVIEW-008` | Funds are found during cancellation reconciliation | UI-SCR-022/023 | Funded review blocks fulfillment/payout and asks for WA evidence | To be reviewed |
| `UX-REVIEW-009` | Seller reports goods shipped during funded cancellation | UI-SCR-023/017 | Cancellation refund disappears and complaint hold becomes clear | To be reviewed |
| `UX-REVIEW-010` | No funded response arrives within 1x24 hours | UI-SCR-023 | Manual review is shown without automatic refund/payout | To be reviewed |
| `UX-REVIEW-011` | Late funds arrive after cancellation | UI-SCR-020/018 | Transaction stays cancelled and exposes refund-only path | To be reviewed |
| `UX-REVIEW-012` | Admin handles a risk hold | UI-SCR-024 | Participants see generic hold; Admin sees restricted evidence and no default outcome | To be reviewed |

## 13. Traceability

### 13.1 UX Flow Coverage

| UX Flow IDs | UI IDs/states | Coverage |
| --- | --- | --- |
| `UX-FLOW-001` | `UI-SCR-001` | Covered |
| `UX-FLOW-002` | `UI-SCR-002` | Covered |
| `UX-FLOW-003` | `UI-SCR-003` | Covered |
| `UX-FLOW-004` | `UI-SCR-005` | Covered/manual |
| `UX-FLOW-005` | `UI-SCR-006` | Covered |
| `UX-FLOW-006` | `UI-SCR-007` | Covered |
| `UX-FLOW-007` | `UI-SCR-002` | Covered |
| `UX-FLOW-008` | `UI-SCR-004` | Covered |
| `UX-FLOW-009` | `UI-SCR-005` | Covered/manual |
| `UX-FLOW-010` | `UI-SCR-006` | Covered |
| `UX-FLOW-011` | `UI-SCR-008` | Covered |
| `UX-FLOW-012` | `UI-SCR-009`, `UI-SCR-010` | Covered/non-UI |
| `UX-FLOW-013` | `UI-SCR-010` | Covered |
| `UX-FLOW-014` | `UI-SCR-010` | Covered |
| `UX-FLOW-015`, `UX-FLOW-016` | `UI-SCR-011` | Covered/manual |
| `UX-FLOW-017`, `UX-FLOW-018` | `UI-SCR-012` | Covered/manual |
| `UX-FLOW-019` | `UI-SCR-009` | Covered/manual |
| `UX-FLOW-020`, `UX-FLOW-021`, `UX-FLOW-022` | `UI-SCR-012`, `UI-SCR-013` | Covered/manual |
| `UX-FLOW-023`, `UX-FLOW-024` | `UI-SCR-013`, `UI-SCR-014` | Covered |
| `UX-FLOW-025`, `UX-FLOW-026` | `UI-SCR-016`, `UI-SCR-020` | Covered/manual |
| `UX-FLOW-027`, `UX-FLOW-028`, `UX-FLOW-029` | `UI-SCR-013`, `UI-SCR-014` | Covered/manual |
| `UX-FLOW-030`, `UX-FLOW-031`, `UX-FLOW-032`, `UX-FLOW-033` | `UI-SCR-015`, `UI-SCR-014`, `UI-SCR-009` | Covered/manual |
| `UX-FLOW-034` through `UX-FLOW-039` | `UI-SCR-017`, `UI-SCR-016` | Covered/manual |
| `UX-FLOW-040`, `UX-FLOW-041` | `UI-SCR-018`, `UI-SCR-020` | Covered/manual |
| `UX-FLOW-042`, `UX-FLOW-043` | `UI-SCR-019`, `UI-SCR-020` | Covered/manual |
| `UX-FLOW-044`, `UX-FLOW-045`, `UX-FLOW-046`, `UX-FLOW-047`, `UX-FLOW-048`, `UX-FLOW-049`, `UX-FLOW-050` | `UI-SCR-010`, `UI-SCR-011`, `UI-SCR-012`, `UI-SCR-020` | Covered/non-UI/manual |
| `UX-FLOW-051` | `UI-SCR-021` | Covered |
| `UX-FLOW-052`, `UX-FLOW-053` | `UI-SCR-020`, `UI-SCR-021` | Covered |
| `UX-FLOW-054`, `UX-FLOW-055`, `UX-FLOW-056`, `UX-FLOW-057` | `UI-SCR-021`, `UI-SCR-022`, `UI-SCR-023`, `UI-SCR-020` | Covered/manual |
| `UX-FLOW-058`, `UX-FLOW-059`, `UX-FLOW-060` | `UI-SCR-018`, `UI-SCR-020` | Covered/manual |
| `UX-FLOW-061`, `UX-FLOW-062`, `UX-FLOW-063` | `UI-SCR-011`, `UI-SCR-021`, `UI-SCR-022`, `UI-SCR-023` | Covered/manual |
| `UX-FLOW-064`, `UX-FLOW-065`, `UX-FLOW-066` | `UI-SCR-021`, `UI-SCR-023`, `UI-SCR-012` | Covered/manual |
| `UX-FLOW-067`, `UX-FLOW-068` | `UI-SCR-009`, `UI-SCR-017`, `UI-SCR-023` | Covered/manual |
| `UX-FLOW-069`, `UX-FLOW-070`, `UX-FLOW-071` | `UI-SCR-023`, `UI-SCR-018`, `UI-SCR-020` | Covered/manual |
| `UX-FLOW-072`, `UX-FLOW-073` | `UI-SCR-024`, `UI-SCR-018` | Covered/manual |
| `UX-FLOW-074`, `UX-FLOW-075` | `UI-SCR-021`, `UI-SCR-017`, `UI-SCR-023`, `UI-SCR-009` | Covered/manual |

### 13.2 UX Node Coverage

| UX node family | UI treatment |
| --- | --- |
| `UX-SCR-001` through `UX-SCR-024` | Mapped one-to-one to `UI-SCR-001` through `UI-SCR-024` in the Screen Inventory |
| `UX-MSG-001` through `UX-MSG-017` | Inline status banners, modal confirmations, timeline events, and notification copy in UI-SCR-005, 009, 010, 011, 013, 014, 017, 020, 021, 022, 023, and 024 |
| `UX-DEC-001` through `UX-DEC-023` | Eligibility, validation, action enabled/disabled state, and result routing in the referenced screen blocks |
| `UX-MAN-001` through `UX-MAN-020` | Explicit external/manual labels and Admin checkpoint actions in UI-SCR-005, 010, 011, 012, 015, 016, 017, 018, 019, 022, 023, and 024 |
| `UX-EXT-001` through `UX-EXT-003` | Channel labels for WhatsApp, Midtrans, approved payout/refund fallback, complaint negotiation, and risk review in the Cross-Screen Interactions and Privacy sections |

### 13.3 User Requirement Coverage

| Requirement family | UI IDs/states | Coverage |
| --- | --- | --- |
| `UR-ACCOUNT-001` through `UR-ACCOUNT-002` | `UI-SCR-001`, `UI-SCR-007`, `UI-SCR-008` | Covered |
| `UR-INIT-001` through `UR-INIT-005` | `UI-SCR-002`, `UI-SCR-005`, `UI-SCR-006` | Covered |
| `UR-SELLER-001` through `UR-SELLER-004` | `UI-SCR-003`, `UI-SCR-008`, `UI-SCR-009`, `UI-SCR-010` | Covered |
| `UR-BUYER-001` through `UR-BUYER-010` | `UI-SCR-004`, `UI-SCR-006`, `UI-SCR-007`, `UI-SCR-010`, `UI-SCR-013`, `UI-SCR-014`, `UI-SCR-018` | Covered |
| `UR-SYSTEM-001` through `UR-SYSTEM-011` | `UI-SCR-003`, `UI-SCR-004`, `UI-SCR-009`, `UI-SCR-010`, `UI-SCR-013`, `UI-SCR-014`, `UI-SCR-016`, `UI-SCR-017`, `UI-SCR-018`, `UI-SCR-020`, `UI-SCR-021`, `UI-SCR-022`, `UI-SCR-023` | Covered/non-UI |
| `UR-PARTICIPANT-001` through `UR-PARTICIPANT-004` | `UI-SCR-009`, `UI-SCR-020`, `UI-SCR-021` | Covered |
| `UR-PARTY-001` through `UR-PARTY-004` | `UI-SCR-012`, `UI-SCR-017` | Covered/manual |
| `UR-ADMIN-001` through `UR-ADMIN-026` | `UI-SCR-011`, `UI-SCR-012`, `UI-SCR-015` through `UI-SCR-024` | Covered/manual |
| `UR-BR-001` through `UR-BR-046` | All applicable participant/Admin screens and states | Covered/non-UI |
| `UR-BR-047` through `UR-BR-065` | `UI-SCR-009`, `UI-SCR-011`, `UI-SCR-017`, `UI-SCR-018`, `UI-SCR-020` through `UI-SCR-024` | Covered/manual |
| `UR-CANCEL-001` through `UR-CANCEL-025` | `UI-SCR-009`, `UI-SCR-017`, `UI-SCR-018`, `UI-SCR-020` through `UI-SCR-024` | Covered/manual |
| `UR-OD-001` through `UR-OD-012` and `UR-CAN-OD-001` through `UR-CAN-OD-008` | Cross-screen data, permissions, state, privacy, and financial safeguards | Covered/non-UI |

### 13.4 Product Brief Midtrans Coverage

| Product Brief ID | UI treatment | UI IDs |
| --- | --- | --- |
| `PB-MP-001` | Idempotent invoice creation with `payment_type: payment_link` | `UI-SCR-009`, `UI-SCR-010` |
| `PB-MP-002` | Hosted Midtrans checkout and server-side provider boundary | `UI-SCR-010` |
| `PB-MP-003` | Settlement plus accepted fraud status authority; capture remains non-settled for payout | `UI-SCR-010`, `UI-SCR-011`, `UI-SCR-016` |
| `PB-MP-004` | Duplicate, delayed, out-of-order, mismatch, and unknown provider events | `UI-SCR-011`, `UI-SCR-022` |
| `PB-MP-005` | Absolute invoice deadline and no reset on refresh/retry | `UI-SCR-009`, `UI-SCR-010`, `UI-SCR-020` |
| `PB-MP-006` | Expired/late payment refund-only path without revival | `UI-SCR-018`, `UI-SCR-020`, `UI-SCR-022` |
| `PB-MP-007` | Seller payout remains separate from Midtrans settlement | `UI-SCR-016`, `UI-SCR-020` |
| `PB-MP-008` | Midtrans Refund API or Admin fallback with four financial results | `UI-SCR-018`, `UI-SCR-020` |
| `PB-MP-009` | Production launch gate remains a non-UI blocker | `UI-SCR-011`, `UI-SCR-018`, `UI-SCR-016` |
| `PB-MP-OD-001` | Canonical Midtrans Invoice API path | `UI-SCR-010` |
| `PB-MP-OD-002` | Payment authority and capture boundary | `UI-SCR-010`, `UI-SCR-011`, `UI-SCR-016` |
| `PB-MP-OD-003` | Deadline synchronization and late-payment recovery | `UI-SCR-010`, `UI-SCR-020`, `UI-SCR-022` |
| `PB-MP-OD-004` | Signature validation, idempotency, ordering, and Get Status reconciliation | `UI-SCR-011`, `UI-SCR-022` |
| `PB-MP-OD-005` | Production credential/webhook/legal launch gate | `UI-SCR-011` |

Explicit ID index for review and QA tooling:

```text
UX-FLOW-001, UX-FLOW-002, UX-FLOW-003, UX-FLOW-004, UX-FLOW-005, UX-FLOW-006, UX-FLOW-007, UX-FLOW-008, UX-FLOW-009, UX-FLOW-010, UX-FLOW-011, UX-FLOW-012, UX-FLOW-013, UX-FLOW-014, UX-FLOW-015, UX-FLOW-016, UX-FLOW-017, UX-FLOW-018, UX-FLOW-019, UX-FLOW-020, UX-FLOW-021, UX-FLOW-022, UX-FLOW-023, UX-FLOW-024, UX-FLOW-025, UX-FLOW-026, UX-FLOW-027, UX-FLOW-028, UX-FLOW-029, UX-FLOW-030, UX-FLOW-031, UX-FLOW-032, UX-FLOW-033, UX-FLOW-034, UX-FLOW-035, UX-FLOW-036, UX-FLOW-037, UX-FLOW-038, UX-FLOW-039, UX-FLOW-040, UX-FLOW-041, UX-FLOW-042, UX-FLOW-043, UX-FLOW-044, UX-FLOW-045, UX-FLOW-046, UX-FLOW-047, UX-FLOW-048, UX-FLOW-049, UX-FLOW-050, UX-FLOW-051, UX-FLOW-052, UX-FLOW-053, UX-FLOW-054, UX-FLOW-055, UX-FLOW-056, UX-FLOW-057, UX-FLOW-058, UX-FLOW-059, UX-FLOW-060, UX-FLOW-061, UX-FLOW-062, UX-FLOW-063, UX-FLOW-064, UX-FLOW-065, UX-FLOW-066, UX-FLOW-067, UX-FLOW-068, UX-FLOW-069, UX-FLOW-070, UX-FLOW-071, UX-FLOW-072, UX-FLOW-073, UX-FLOW-074, UX-FLOW-075
UX-SCR-001, UX-SCR-002, UX-SCR-003, UX-SCR-004, UX-SCR-005, UX-SCR-006, UX-SCR-007, UX-SCR-008, UX-SCR-009, UX-SCR-010, UX-SCR-011, UX-SCR-012, UX-SCR-013, UX-SCR-014, UX-SCR-015, UX-SCR-016, UX-SCR-017, UX-SCR-018, UX-SCR-019, UX-SCR-020, UX-SCR-021, UX-SCR-022, UX-SCR-023, UX-SCR-024
UX-MSG-001, UX-MSG-002, UX-MSG-003, UX-MSG-004, UX-MSG-005, UX-MSG-006, UX-MSG-007, UX-MSG-008, UX-MSG-009, UX-MSG-010, UX-MSG-011, UX-MSG-012, UX-MSG-013, UX-MSG-014, UX-MSG-015, UX-MSG-016, UX-MSG-017
UX-DEC-001, UX-DEC-002, UX-DEC-003, UX-DEC-004, UX-DEC-005, UX-DEC-006, UX-DEC-007, UX-DEC-008, UX-DEC-009, UX-DEC-010, UX-DEC-011, UX-DEC-012, UX-DEC-013, UX-DEC-014, UX-DEC-015, UX-DEC-016, UX-DEC-017, UX-DEC-018, UX-DEC-019, UX-DEC-020, UX-DEC-021, UX-DEC-022, UX-DEC-023
UX-MAN-001, UX-MAN-002, UX-MAN-003, UX-MAN-004, UX-MAN-005, UX-MAN-006, UX-MAN-007, UX-MAN-008, UX-MAN-009, UX-MAN-010, UX-MAN-011, UX-MAN-012, UX-MAN-013, UX-MAN-014, UX-MAN-015, UX-MAN-016, UX-MAN-017, UX-MAN-018, UX-MAN-019, UX-MAN-020
UX-EXT-001, UX-EXT-002, UX-EXT-003
UR-ACCOUNT-001, UR-ACCOUNT-002, UR-INIT-001, UR-INIT-002, UR-INIT-003, UR-INIT-004, UR-INIT-005, UR-SELLER-001, UR-SELLER-002, UR-SELLER-003, UR-SELLER-004, UR-BUYER-001, UR-BUYER-002, UR-BUYER-003, UR-BUYER-004, UR-BUYER-005, UR-BUYER-006, UR-BUYER-007, UR-BUYER-008, UR-BUYER-009, UR-BUYER-010, UR-SYSTEM-001, UR-SYSTEM-002, UR-SYSTEM-003, UR-SYSTEM-004, UR-SYSTEM-005, UR-SYSTEM-006, UR-SYSTEM-007, UR-SYSTEM-008, UR-SYSTEM-009, UR-SYSTEM-010, UR-SYSTEM-011, UR-PARTICIPANT-001, UR-PARTICIPANT-002, UR-PARTICIPANT-003, UR-PARTICIPANT-004, UR-PARTY-001, UR-PARTY-002, UR-PARTY-003, UR-PARTY-004
UR-ADMIN-001, UR-ADMIN-002, UR-ADMIN-003, UR-ADMIN-004, UR-ADMIN-005, UR-ADMIN-006, UR-ADMIN-007, UR-ADMIN-008, UR-ADMIN-009, UR-ADMIN-010, UR-ADMIN-011, UR-ADMIN-012, UR-ADMIN-013, UR-ADMIN-014, UR-ADMIN-015, UR-ADMIN-016, UR-ADMIN-017, UR-ADMIN-018, UR-ADMIN-019, UR-ADMIN-020, UR-ADMIN-021, UR-ADMIN-022, UR-ADMIN-023, UR-ADMIN-024, UR-ADMIN-025, UR-ADMIN-026
UR-CANCEL-001, UR-CANCEL-002, UR-CANCEL-003, UR-CANCEL-004, UR-CANCEL-005, UR-CANCEL-006, UR-CANCEL-007, UR-CANCEL-008, UR-CANCEL-009, UR-CANCEL-010, UR-CANCEL-011, UR-CANCEL-012, UR-CANCEL-013, UR-CANCEL-014, UR-CANCEL-015, UR-CANCEL-016, UR-CANCEL-017, UR-CANCEL-018, UR-CANCEL-019, UR-CANCEL-020, UR-CANCEL-021, UR-CANCEL-022, UR-CANCEL-023, UR-CANCEL-024, UR-CANCEL-025
UR-BR-001, UR-BR-002, UR-BR-003, UR-BR-004, UR-BR-005, UR-BR-006, UR-BR-007, UR-BR-008, UR-BR-009, UR-BR-010, UR-BR-011, UR-BR-012, UR-BR-013, UR-BR-014, UR-BR-015, UR-BR-016, UR-BR-017, UR-BR-018, UR-BR-019, UR-BR-020, UR-BR-021, UR-BR-022, UR-BR-023, UR-BR-024, UR-BR-025, UR-BR-026, UR-BR-027, UR-BR-028, UR-BR-029, UR-BR-030, UR-BR-031, UR-BR-032, UR-BR-033, UR-BR-034, UR-BR-035, UR-BR-036, UR-BR-037, UR-BR-038, UR-BR-039, UR-BR-040, UR-BR-041, UR-BR-042, UR-BR-043, UR-BR-044, UR-BR-045, UR-BR-046, UR-BR-047, UR-BR-048, UR-BR-049, UR-BR-050, UR-BR-051, UR-BR-052, UR-BR-053, UR-BR-054, UR-BR-055, UR-BR-056, UR-BR-057, UR-BR-058, UR-BR-059, UR-BR-060, UR-BR-061, UR-BR-062, UR-BR-063, UR-BR-064, UR-BR-065
UR-OD-001, UR-OD-002, UR-OD-003, UR-OD-004, UR-OD-005, UR-OD-006, UR-OD-007, UR-OD-008, UR-OD-009, UR-OD-010, UR-OD-011, UR-OD-012
UR-CAN-OD-001, UR-CAN-OD-002, UR-CAN-OD-003, UR-CAN-OD-004, UR-CAN-OD-005, UR-CAN-OD-006, UR-CAN-OD-007, UR-CAN-OD-008
```

## 14. Open Decisions

No new product behavior is open in this UI/UX draft. The following design details remain review items and do not change approved product rules:

| Decision | Impact | Owner | Needed before |
| --- | --- | --- | --- |
| Exact maximum mobile surface width and breakpoint values | Final CSS layout and desktop canvas behavior | Product Design | QA Scenarios/Implementation |
| Final visual tokens, icon set, and component library mapping | Consistent implementation styling | Product Design | Implementation |
| Final Indonesian copy and localization review | User comprehension and support wording | Product Owner/Design | QA Scenarios |
| Prototype or wireframe fidelity and review artifact | Visual review evidence | Product Owner/Design | UI/UX approval |

These are presentation and review decisions only. They must not change role ownership, financial rules, cancellation eligibility, evidence visibility, or status transitions without revising the owning approved artifact.

## 15. Design Approval Checklist

- [x] Relevant approved UX Flow and User Requirement IDs are traced.
- [x] Product roles are explicitly Buyer, Seller, and Admin; internal Admin task assignments are not new product roles.
- [x] Screens, data, actions, permissions, and navigation are explicit.
- [x] Relevant default, loading, empty, error, success, disabled, expired, unauthorized, and manual-review states are defined.
- [x] Midtrans, WhatsApp, fulfillment, complaint, cancellation, and approved payout/refund fallback handoffs remain visible.
- [x] Responsive, accessibility, privacy, and sensitive-data constraints are specified.
- [x] Cancellation states, evidence, timeout, refund, late funds, risk hold, idempotency, and cutoff behavior are represented.
- [x] Wireframe/prototype work is explicitly deferred and is not a blocker for this specification approval.
- [x] Product owner reviews the experience and approves the specification.

UI/UX Specification v0.2 is `Approved`. Wireframe/prototype work remains intentionally deferred. The next workflow stage is QA Scenarios for the Midtrans flow.
