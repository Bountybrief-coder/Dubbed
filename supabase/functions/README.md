# Dubbed — NOWPayments Edge Functions

All payment processing uses NOWPayments (crypto). Secrets stay server-side in
Supabase Edge Function env. Users deposit via hosted crypto checkout and
withdraw to their saved wallet address.

## Functions

| Function | Auth | Purpose |
|---|---|---|
| `nowpayments-deposit` | user JWT | Create a NOWPayments invoice for wallet deposit, return checkout URL. |
| `nowpayments-payout` | admin/user JWT | Send crypto payout to user's wallet address for a withdrawal request. |
| `nowpayments-webhook` | IPN signature | Verify HMAC-SHA512 + handle deposit credits, shop grants, payout status. |

## Required env (set in the Supabase dashboard → Edge Functions → Secrets)

```
NOWPAYMENTS_API_KEY=...
NOWPAYMENTS_IPN_SECRET=...
# These are provided by Supabase automatically, but list them if self-hosting:
# SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
```

## Deploy

```bash
supabase functions deploy nowpayments-deposit
supabase functions deploy nowpayments-payout
supabase functions deploy nowpayments-webhook --no-verify-jwt
```

The webhook must be deployed with `--no-verify-jwt` because NOWPayments (not a
logged-in user) calls it. It verifies the HMAC-SHA512 IPN signature instead.

## NOWPayments setup

1. Get your API key from the NOWPayments dashboard.
2. Set an IPN secret in the NOWPayments dashboard settings.
3. Set the IPN callback URL to: `https://<project>.supabase.co/functions/v1/nowpayments-webhook`

## Money model (all enforced in SQL, never the client)

- `request_withdrawal` moves funds `balance → pending_balance` and writes a
  `withdrawal_hold` ledger row. Minimum $5, blocked by
  `withdrawal_block_reason` (dispute / pending tournament / unsettled bet /
  suspended / no wallet address / insufficient balance).
- Admin **approve** → `nowpayments-payout` → `mark_withdrawal_processing_admin` +
  crypto payout (idempotent via order_id).
- IPN `finished` → `mark_withdrawal_paid` (clears the pending hold).
- Admin **reject** or IPN `failed` / `expired` →
  `reject_withdrawal` (restores funds to `balance`, writes `withdrawal_refund`).
- Every balance change writes an immutable `wallet_ledger` row; every webhook
  event is recorded once in `payout_events` (unique on `provider,event_id`).

## Subscription (WAGR membership)

Memberships are wallet-based. Users buy 30 days from their balance.
A daily cron function (`renew_wallet_subscriptions`) auto-charges the wallet
on renewal. If balance is insufficient, membership lapses. Users can cancel
anytime via the Shop page.
