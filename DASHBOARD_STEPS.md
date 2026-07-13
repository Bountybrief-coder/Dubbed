# Dashboard Steps (human actions required)

## GA4 + GTM Setup

### 1. Create a GTM container
1. Go to https://tagmanager.google.com
2. Create Account > name it "Dubbed"
3. Create Container > name "dubbed.pro" > select "Web"
4. Copy your container ID (format: `GTM-XXXXXXX`)
5. Replace `GTM-XXXXXXX` in `index.html` (appears twice — head script and body noscript)

### 2. Create a GA4 property
1. Go to https://analytics.google.com
2. Admin > Create Property > name "Dubbed" > set timezone/currency
3. Create a Web data stream > URL: `dubbed.pro`
4. Copy the Measurement ID (format: `G-XXXXXXXXXX`)

### 3. Connect GA4 to GTM
1. In GTM, go to Tags > New
2. Tag type: "Google Analytics: GA4 Configuration"
3. Measurement ID: paste your `G-XXXXXXXXXX`
4. Trigger: "All Pages"
5. Save and name it "GA4 - Config"

### 4. Create custom event tags in GTM
For each dataLayer event the code pushes, create a GA4 Event tag:

| Event name    | Trigger (Custom Event) | Parameters        |
|---------------|------------------------|-------------------|
| sign_up       | sign_up                | -                 |
| login         | login                  | -                 |
| deposit       | deposit                | value             |
| withdraw      | withdraw               | value             |
| match_create  | match_create           | game, value       |
| match_join    | match_join             | game, value       |
| tourney_join  | tourney_join           | tournament, value |
| bet_post      | bet_post               | value             |
| bet_accept    | bet_accept             | value             |
| shop_purchase | shop_purchase          | item, value       |
| wagr_upgrade  | wagr_upgrade           | -                 |
| page_view     | page_view              | page_title        |

For each:
1. Tags > New > GA4 Event
2. Configuration tag: select "GA4 - Config"
3. Event name: (from table above)
4. Add event parameters from the table
5. Trigger: Custom Event > event name matches

### 5. Publish
1. In GTM, click Submit > Publish
2. Verify in GA4 Realtime report — visit dubbed.pro and check events appear

---

## Email Deliverability (CRITICAL — emails going to spam)

Verification and password-reset emails from `noreply@dubbed.pro` are being sent via Resend (Amazon SES), but `dubbed.pro` is missing SPF/DMARC DNS records. Gmail and iCloud will reject or spam-folder these emails.

### 1. Add SPF record in Porkbun
1. Go to https://porkbun.com → manage `dubbed.pro` → DNS Records
2. Add a **TXT** record:
   - **Host/Name**: *(leave blank for apex)*
   - **Type**: TXT
   - **Value**: `v=spf1 include:amazonses.com ~all`
   - **TTL**: 300

### 2. Fix DMARC record in Porkbun
1. Find the existing `_dmarc` CNAME record (currently points to `pixie.porkbun.com` — Porkbun placeholder)
2. **Delete** the CNAME record for `_dmarc`
3. Add a **TXT** record:
   - **Host/Name**: `_dmarc`
   - **Type**: TXT
   - **Value**: `v=DMARC1; p=none; rua=mailto:admin@dubbed.pro`
   - **TTL**: 300

### 3. Verify Resend DKIM (may already be correct)
1. In Porkbun, check that `resend._domainkey` has a TXT record with a public key (starts with `p=MIGf...`). If it exists, DKIM is fine.
2. Also check if Resend's dashboard (https://resend.com/domains) shows `dubbed.pro` as verified. If any records are pending, add them.

### 4. Verify
Wait 5 minutes for DNS propagation, then test:
```bash
dig +short TXT dubbed.pro          # should show SPF
dig +short TXT _dmarc.dubbed.pro   # should show DMARC policy
```
Then sign up a new test account with a Gmail address and confirm the verification email arrives in the inbox (not spam).

---

## No-Show Timer (5 minutes)

### 1. Run migration: `migrate_noshow_timer.sql`
1. Open Supabase SQL Editor
2. Paste the contents of `migrate_noshow_timer.sql` and run
3. This adds `accepted_at` column to `matches` and updates `join_match` RPC to set it when the match goes live

### 2. Verify
1. Check `accepted_at` column exists: `select accepted_at from matches limit 1;`
2. Existing live matches should have `accepted_at` backfilled to `created_at`

---

## Withdrawal Fee (2% + $0.25)

### 1. Run migration: `migrate_withdrawal_fee.sql`
1. Open Supabase SQL Editor
2. Paste the contents of `migrate_withdrawal_fee.sql` and run
3. This adds a `fee` column to `withdrawal_requests` and creates `calc_withdrawal_fee()` helper

### 2. Patch `request_withdrawal` RPC
The existing `request_withdrawal` function needs manual patching since it was created in the dashboard. In the SQL Editor:

1. Run `\df+ public.request_withdrawal` or search for it in the Functions list
2. Add to the `declare` block: `v_fee numeric;`
3. After the existing balance deduction, add:
   ```sql
   v_fee := public.calc_withdrawal_fee(p_amount);
   ```
4. When inserting into `withdrawal_requests`, set `fee = v_fee`
5. The amount held from the user's balance stays the same (`p_amount`)
6. The actual payout sent to Stripe should be `p_amount - v_fee`
7. The `v_fee` stays in platform revenue (no ledger entry needed — it's simply not paid out)

### 3. Verify
1. Check fee column: `select public.calc_withdrawal_fee(25.00);` should return `0.75`
2. Test a withdrawal in test mode and confirm `fee` is populated on the request row
