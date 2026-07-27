# BAYAR-004 Validation

## Metadata

```text
Ticket: BAYAR-004 — Payment Instructions, Sudah Bayar Claim, and Original Expiry
Implementation scope: Payment instruction issuance, Buyer payment claim,
original 1x24-hour expiry, participant projections, and payment UI states
Validated on: 2026-07-23
```

## Files Changed

- `src/server/db/schema.ts` for the immutable receiving-account snapshot field
  and PostgreSQL partial unique index for one active claim.
- `drizzle/0002_demonic_mentallo.sql` for the BAYAR-004 migration.
- `.env.example` for receiving-account placeholders; local values remain in
  ignored `.env`.
- `package.json` and `package-lock.json` for the local expiry runner command and
  `tsx` runner dependency.
- `src/server/payment/` for receiving-account configuration, masking/WIB
  projection, instruction issuance, payment read, and Buyer claim service.
- `src/server/transaction/service.ts` for the atomic payable transition after
  both role datasets are complete.
- `src/server/jobs/` for deterministic expiry and local runner boundary.
- `src/app/api/transactions/[id]/payment-instructions/route.ts` and
  `payment-claim/route.ts` for payment read/claim APIs.
- `src/components/transactions/status.tsx` and `src/app/globals.css` for
  payment instruction, claim, review, expired, loading, and deferred UI states.
- `tests/unit/payment.test.ts` for receiving-account, masking, and WIB tests.

No Product Brief, User Journey, UX Flow, User Requirements, UI/UX Specification,
QA Scenarios, PRD, TRD, engineering ticket, prototype, or BAYAR-005 code was
changed.

## Commands And Results

| Command/check | Result |
| --- | --- |
| `npm test` | Pass: 4 test files, 16 tests |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass: no warnings or errors |
| `npm run build` | Pass: Next.js production build; payment routes included |
| `npm run db:generate` | Pass: no schema changes after migration generation |
| `npm run db:migrate` | Pass: migration applied; rerun has no pending changes |
| `npm run job:payment-expiry` | Pass: local runner completed; rerun with no candidates is safe |
| `docker compose exec -T postgres pg_isready -U bayaraman -d bayaraman` | Pass: accepting connections |
| `git diff --check` | Pass |

## Manual Smoke Test

Using two temporary verified local accounts and the OrbStack PostgreSQL
container:

1. Seller created a physical-goods transaction.
2. Buyer joined using the invitation and completed shipping/refund data.
3. The final role-data mutation atomically created payment instructions and
   changed the transaction to `WAITING_BUYER_PAYMENT` at state version 2.
4. The Buyer payment projection returned:
   - total `Rp275.000`;
   - receiving bank `BCA`;
   - exact local receiving account only to Buyer;
   - original deadline exactly 24 hours after issuance, rendered in WIB.
5. Seller received only `••••7890` for the same destination.
6. Buyer submitted `Sudah Bayar`; the transaction changed to
   `PAYMENT_UNDER_REVIEW` at state version 3.
7. Repeating the same claim idempotency key returned the original claim ID and
   timestamp without creating a second claim.
8. A second transaction with its local deadline moved into the past was
   processed by `npm run job:payment-expiry` and changed to `PAYMENT_EXPIRED`.
9. The expiry runner did not change the claimed transaction and did not create
   payment confirmation.

Temporary accounts and transactions were deleted after the smoke test. No real
bank transfer, bank review, or payment confirmation was performed.

## Acceptance Criteria

- Complete Buyer/Seller role data creates one immutable payment-instruction
  snapshot and transitions to `WAITING_BUYER_PAYMENT`.
- Exact integer amount comes from frozen transaction terms.
- Original deadline is created once, stored as an absolute timestamp, and
  displayed in WIB.
- Buyer can read the exact receiving destination and Seller receives only the
  masked destination.
- One active payment claim is enforced by the PostgreSQL partial unique index
  `payment_claims(transaction_id) WHERE active = true`.
- Only the verified Buyer participant can submit `Sudah Bayar`.
- Timely claim transitions to `PAYMENT_UNDER_REVIEW` and preserves the original
  deadline.
- Duplicate claim requests return the original idempotent result.
- Expiry only processes unpaid `WAITING_BUYER_PAYMENT` transactions after the
  deadline, using a state/version guard and post-update audit.
- Expiry reruns do not duplicate the transition or audit event.
- Partial, excess, duplicate, and late external-fund observations remain
  non-authoritative and do not produce `PAYMENT_CONFIRMED`, a deadline reset,
  fulfillment authorization, or a new state.
- UI-SCR-009 and UI-SCR-010 include payable, loading, disabled, error/retry,
  review, expired, unauthorized, keyboard, label, and responsive states.
- UI-SCR-021 remains deferred/disabled; no cancellation API or cancellation
  transition was implemented.
- Product roles and transaction states remain the approved vocabulary.

## Scope Confirmation

- BAYAR-005 bank review and payment confirmation were not implemented.
- No refund, payout, WhatsApp, fulfillment, cancellation, complaint, risk hold,
  or money movement behavior was added.
- No new transaction state or product role was added.
- OrbStack is used only as the local PostgreSQL runtime.
- The production scheduler is not provisioned by this ticket; it invokes the
  bounded expiry function in the deployment environment.

## Residual Risks

- Receiving-account configuration must be supplied securely in each runtime;
  `.env.example` contains placeholders and no real account value.
- The local expiry runner is validated, but production scheduler wiring and
  operational monitoring remain deployment work.
- Raw receiving-account values are restricted by application projection and
  logging boundaries; production database-at-rest encryption and secret
  management remain infrastructure responsibilities.
- No real bank integration or browser automation suite exists yet; Admin bank
  review is intentionally deferred to BAYAR-005.
- `npm install` reports existing dependency audit findings (7 moderate,
  6 high, 1 critical); forced upgrades were not introduced.

## Status

```text
Implementation: Complete
Validation: Passed with residual risks documented
```
