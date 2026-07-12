# Dashboard Steps — What YOU Must Do Before Launch

Every item below requires access to a live dashboard (Supabase, Netlify, Stripe).
The agent cannot do these. Execute them in order.

---

## 1. Supabase — Database Setup

### 1a. Run the SQL migrations (idempotent — safe to re-run)

Go to **Supabase Dashboard > SQL Editor** and run these files in order:

1. `supabase_setup.sql` — creates all tables, types, RLS policies, RPCs, triggers
2. `migrate_match_chat_username.sql`
3. `migrate_match_system_msgs.sql`
4. `migrate_rls_fix.sql`
5. `migrate_s2_batch2.sql`
6. `migrate_s2_create_match_refid.sql`
7. `migrate_s2_rake_pot.sql`
8. `migrate_s2_remaining.sql`
9. `migrate_weekly_stats.sql`
10. `tournament_schedule_setup.sql`
11. `rls_security_patch.sql` — **run this LAST** (revokes dangerous direct-write grants)

Every file is idempotent (`CREATE IF NOT EXISTS`, `DROP POLICY IF EXISTS`, etc.).

### 1b. Verify critical objects exist

After running the SQL, confirm these in **SQL Editor**:

```sql
-- Auth trigger (creates profile on sign-up)
SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created';

-- Username-to-email login RPC
SELECT proname FROM pg_proc WHERE proname = 'email_for_username';

-- Email verification trigger
SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_verified';

-- Leaderboard RPCs
SELECT proname FROM pg_proc WHERE proname IN ('get_leaderboard', 'get_my_rank', 'platform_stats');

-- RLS is on for money tables
SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  AND tablename IN ('wallet_ledger','withdrawal_requests','payment_events','payout_events')
  AND NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = tablename AND n.nspname = 'public' AND c.relrowsecurity
  );
-- ↑ Should return 0 rows (all have RLS enabled)
```

### 1c. Supabase Auth settings

Go to **Authentication > Providers > Email**:
- Enable email provider: **ON**
- Confirm email: **ON** (users must verify their email before they can log in)
- Secure email change: **ON** (sends confirmation to both old and new address)

Go to **Authentication > URL Configuration**:
- Site URL: `https://dubbed.pro`
- Redirect URLs: add `https://dubbed.pro/**`

### 1d. Enable Realtime

Go to **Database > Replication**:
- Enable realtime for tables: `profiles`, `matches`, `match_players`, `match_messages`,
  `notifications`, `withdrawal_requests`, `trophies`, `bet_offers`, `chat_messages`,
  `tournament_matches`

### 1e. Storage bucket

Go to **Storage**:
- Create bucket `avatars` (public)
- Create bucket `match-evidence` (private, RLS: authenticated users can upload to their own path)

### 1f. Deploy Edge Functions

From the project root, deploy each function:

```bash
supabase functions deploy stripe-deposit-checkout
supabase functions deploy stripe-deposit-webhook
supabase functions deploy stripe-shop-checkout
supabase functions deploy stripe-shop-webhook
supabase functions deploy stripe-webhook
supabase functions deploy stripe-connect-onboard
supabase functions deploy stripe-connect-status
supabase functions deploy stripe-payout
supabase functions deploy stripe-billing-portal
```

### 1g. Set Edge Function secrets

Go to **Edge Functions > Manage Secrets** (or use CLI):

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_DEPOSIT_WEBHOOK_SECRET=whsec_...
supabase secrets set STRIPE_SHOP_WEBHOOK_SECRET=whsec_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJ...
supabase secrets set SUPABASE_ANON_KEY=eyJ...
```

`SUPABASE_URL` is automatically available in Edge Functions.

**IMPORTANT**: Use `sk_test_...` and test webhook secrets until you're ready for real money.

---

## 2. Stripe — Payments + Connect

### 2a. API keys

Go to **Stripe Dashboard > Developers > API keys**:
- Copy the **Publishable key** (`pk_test_...`) — this goes to Netlify env (but the app
  currently uses redirect-based Checkout so it's not directly needed in client code)
- Copy the **Secret key** (`sk_test_...`) — this goes to Supabase Edge Function secrets (step 1g)

### 2b. Register webhooks

Go to **Stripe Dashboard > Developers > Webhooks > Add endpoint**:

| Endpoint URL | Events | Secret env var |
|---|---|---|
| `https://<project-ref>.supabase.co/functions/v1/stripe-deposit-webhook` | `checkout.session.completed` | `STRIPE_DEPOSIT_WEBHOOK_SECRET` |
| `https://<project-ref>.supabase.co/functions/v1/stripe-shop-webhook` | `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid` | `STRIPE_SHOP_WEBHOOK_SECRET` |
| `https://<project-ref>.supabase.co/functions/v1/stripe-webhook` | `account.updated`, `transfer.created`, `transfer.reversed`, `payout.paid`, `payout.failed` | `STRIPE_WEBHOOK_SECRET` |

After creating each webhook, copy its **Signing secret** (`whsec_...`) and set it in
Supabase Edge Function secrets (step 1g).

### 2c. Enable Stripe Connect

Go to **Stripe Dashboard > Connect > Settings**:
- Enable **Express accounts**
- Platform type: **Marketplace / Platform**
- Country: your country of incorporation
- Business profile: fill in Dubbed.pro details

**CRITICAL**: Stripe must **approve** your platform for real-money gaming/wagering.
This is an external review process — submit early. You can test everything in test mode
while waiting for approval.

### 2d. Customer Portal

Go to **Stripe Dashboard > Settings > Billing > Customer portal**:
- Enable the portal
- Allow customers to cancel subscriptions
- Add the WAGR Membership product to the portal

### 2e. Going live

When ready to accept real money:
1. Switch from test to live API keys in Supabase Edge Function secrets
2. Re-create all three webhooks pointing to the same Edge Function URLs but using live signing secrets
3. Update the secrets in Supabase (`STRIPE_SECRET_KEY`, all three `*_WEBHOOK_SECRET`)
4. Stripe Connect must be approved before live payouts work

---

## 3. Netlify — Build + Deploy

### 3a. Set environment variables

Go to **Netlify Dashboard > Site settings > Environment variables**:

| Variable | Value | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` | From Supabase Dashboard > Settings > API |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` (anon/public key) | Same location |

**IMPORTANT**: These must be set BEFORE the build runs — Vite inlines them at build time.
After setting them, trigger a redeploy: **Deploys > Trigger deploy > Deploy site**.

### 3b. Domain

Go to **Domain management**:
- Add custom domain `dubbed.pro`
- Enable HTTPS (automatic with Let's Encrypt)

### 3c. Verify headers

After deploy, check security headers with:
```bash
curl -sI https://dubbed.pro | grep -iE 'strict|frame|content-type|referrer|content-security'
```

Expected: HSTS, X-Frame-Options DENY, nosniff, strict-origin referrer, and a CSP that
allows Supabase + Stripe Checkout.

---

## 4. First Admin User

After deploying and signing up your first account:

```sql
-- Run in Supabase SQL Editor
INSERT INTO public.app_admins (user_id)
SELECT id FROM public.profiles WHERE username = 'YOUR_USERNAME';
```

This grants admin access to the admin pages (`/admin/*`).

---

## 5. Scheduled Jobs (optional but recommended)

Set up **pg_cron** or a Supabase scheduled function for:

```sql
-- Expire wallet-purchased WAGR memberships (run hourly)
SELECT cron.schedule('expire-memberships', '0 * * * *', 'SELECT public.expire_wallet_memberships()');

-- Auto-unban expired bans (run every 15 min)
SELECT cron.schedule('check-ban-expiry', '*/15 * * * *', 'SELECT public.check_ban_expiry()');

-- Purge old rate-limit rows (run daily)
SELECT cron.schedule('purge-rate-limits', '0 4 * * *', 'SELECT public.purge_old_rate_limits()');

-- Run tournament scheduler (run every 2 min if using auto-scheduling)
SELECT cron.schedule('tournament-scheduler', '*/2 * * * *', 'SELECT public.run_tournament_scheduler()');
```

Enable pg_cron extension first: **Database > Extensions > pg_cron > Enable**.

---

## Order of operations

1. Supabase: run SQL (1a), verify (1b), configure auth (1c), enable realtime (1d), storage (1e)
2. Stripe: get keys (2a), register webhooks (2b), enable Connect (2c)
3. Supabase: deploy Edge Functions (1f), set secrets including Stripe keys (1g)
4. Netlify: set env vars (3a), deploy (3b)
5. Verify: sign up, deposit in test mode, create a match
6. Stripe: apply for live approval when ready (2e)
