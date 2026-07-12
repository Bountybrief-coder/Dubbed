# Edge Function Environment Variables

All edge functions live under `supabase/functions/` and share `_shared/util.ts`.

## Auto-Injected by Supabase Runtime (no manual config needed)

| Env Var | Used By |
|---|---|
| `SUPABASE_URL` | All functions via `serviceClient()` / `getCaller()` |
| `SUPABASE_SERVICE_ROLE_KEY` | All functions via `serviceClient()` |
| `SUPABASE_ANON_KEY` | All non-webhook functions via `getCaller()` |

## Must Set Manually in Supabase Dashboard → Edge Functions → Secrets

| Env Var | Required | Used By |
|---|---|---|
| `STRIPE_SECRET_KEY` | YES | All functions via `stripeClient()` |
| `STRIPE_WEBHOOK_SECRET` | YES | `stripe-webhook` (subscription lifecycle) |
| `STRIPE_DEPOSIT_WEBHOOK_SECRET` | YES | `stripe-deposit-webhook` (wallet deposits) |
| `STRIPE_SHOP_WEBHOOK_SECRET` | YES | `stripe-shop-webhook` (shop purchases) |
| `PAYOUT_CURRENCY` | NO (default: `usd`) | `stripe-payout`, `stripe-shop-checkout` |

## Client-Side (Vite)

| Env Var | Set In | Used By |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env` / Netlify | `src/lib/supabase.js` |
| `VITE_SUPABASE_ANON_KEY` | `.env` / Netlify | `src/lib/supabase.js` |

**NEVER set**: `SUPABASE_SERVICE_ROLE_KEY` must never appear in any `VITE_*` variable or client-side code.
