# Dubbed — Stripe Connect withdrawal edge functions

Server-side payout system. Nothing here runs in the browser; all secret keys
stay in Supabase Edge Function env. Stripe Connect **Express** is the default
provider, and the schema is provider-agnostic so PayPal / Interac / Wise / bank
can be added later without a migration (see `withdrawal_requests.provider`).

## Functions

| Function | Auth | Purpose |
|---|---|---|
| `stripe-connect-onboard` | user JWT | Create/reuse the caller's Express account, return an onboarding Account Link. |
| `stripe-connect-status` | user JWT | Retrieve the account from Stripe and sync status into the profile. |
| `stripe-payout` | admin JWT | Mark a request `processing` and create the Stripe Transfer (idempotent). |
| `stripe-webhook` | Stripe signature | Verify + idempotently handle `account.updated`, `transfer.created`, `transfer.reversed`, `payout.failed`. |
| `stripe-shop-checkout` | user JWT | Create a Checkout Session: one-time payment for services, subscription for WAGR. |
| `stripe-billing-portal` | user JWT | Open the Stripe Customer Portal so a WAGR member can manage/cancel. |
| `stripe-shop-webhook` | Stripe signature | Handle `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`. |

## Required env (set in the Supabase dashboard → Edge Functions → Secrets)

```
STRIPE_SECRET_KEY=sk_live_...          # or sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...        # from the payout webhook endpoint
STRIPE_SHOP_WEBHOOK_SECRET=whsec_...   # from the shop webhook endpoint (separate)
PAYOUT_CURRENCY=usd                    # optional, defaults to usd
# These are provided by Supabase automatically, but list them if self-hosting:
# SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
```

## Deploy

```bash
supabase functions deploy stripe-connect-onboard
supabase functions deploy stripe-connect-status
supabase functions deploy stripe-payout
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy stripe-shop-checkout
supabase functions deploy stripe-billing-portal
supabase functions deploy stripe-shop-webhook --no-verify-jwt
```

The webhook must be deployed with `--no-verify-jwt` because Stripe (not a
logged-in user) calls it; the request is instead authenticated by verifying the
Stripe signature against `STRIPE_WEBHOOK_SECRET`.

## Stripe setup

1. Enable **Connect** in the Stripe dashboard (Express accounts, `transfers`
   capability).
2. Create a **payout webhook endpoint** pointing at the deployed `stripe-webhook`
   URL, subscribed to at least:
   `account.updated`, `transfer.created`, `transfer.reversed`, `payout.failed`.
   Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
3. Create a **shop webhook endpoint** pointing at the deployed `stripe-shop-webhook`
   URL, subscribed to at least:
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.paid`.
   Copy its signing secret into `STRIPE_SHOP_WEBHOOK_SECRET`.
4. Enable the Customer Portal in the Stripe dashboard (for WAGR membership
   management / cancellation).
5. Fund your platform balance (transfers pull from it) or use test mode.

## Money model (all enforced in SQL, never the client)

- `request_withdrawal` moves funds `balance → pending_balance` and writes a
  `withdrawal_hold` ledger row. Minimum $10, blocked by
  `withdrawal_block_reason` (dispute / pending tournament / unsettled bet /
  unverified email / suspended / incomplete Stripe / insufficient balance).
- Admin **approve** → `stripe-payout` → `mark_withdrawal_processing_admin` +
  Stripe Transfer (idempotency key `dubbed_wd_<id>`).
- Webhook `transfer.created` → `mark_withdrawal_paid` (clears the pending hold).
- Admin **reject** or webhook `payout.failed` / `transfer.reversed` →
  `reject_withdrawal` (restores funds to `balance`, writes `withdrawal_refund`).
- Every balance change writes an immutable `wallet_ledger` row; every webhook
  event is recorded once in `payout_events` (unique on `provider,event_id`).
