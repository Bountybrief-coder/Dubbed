# Security Headers — Dubbed

All headers are set in `netlify.toml` under the `/*` catch-all rule.

## Headers

### Strict-Transport-Security
```
max-age=31536000; includeSubDomains; preload
```
Forces HTTPS for 1 year. `preload` signals intent to join the HSTS preload list.

### X-Frame-Options
```
DENY
```
Prevents the site from being embedded in any iframe — anti-clickjacking. Reinforced by
`frame-ancestors 'none'` in CSP.

### X-Content-Type-Options
```
nosniff
```
Prevents browsers from MIME-sniffing responses away from the declared Content-Type.

### Referrer-Policy
```
strict-origin-when-cross-origin
```
Sends full URL on same-origin requests, origin-only on cross-origin, nothing on
downgrade (HTTPS → HTTP).

### Permissions-Policy
```
camera=(), microphone=(), geolocation=(), payment=(self), usb=(), magnetometer=(), gyroscope=(), accelerometer=()
```
Disables all unused browser APIs. `payment=(self)` allows the Payment Request API
for Stripe if needed in the future.

## Content-Security-Policy

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://*.supabase.co;
font-src 'self';
connect-src 'self' https://*.supabase.co wss://*.supabase.co;
frame-src https://player.twitch.tv https://www.twitch.tv https://checkout.stripe.com;
frame-ancestors 'none';
form-action 'self' https://checkout.stripe.com;
base-uri 'self';
object-src 'none'
```

### CSP Allowlist Rationale

| Directive | Allowed Origin | Reason |
|-----------|---------------|--------|
| `style-src 'unsafe-inline'` | — | React's inline `style={}` props require this. No user-controlled styles exist. |
| `img-src https://*.supabase.co` | Supabase Storage | Avatar images are served from Supabase Storage public URLs. |
| `img-src data: blob:` | — | Avatar preview before upload uses blob URLs; rank star images may use data URIs. |
| `connect-src https://*.supabase.co` | Supabase REST/Auth/Functions | All API calls go through the Supabase JS client. |
| `connect-src wss://*.supabase.co` | Supabase Realtime | WebSocket connections for live chat, match updates, profile sync. |
| `frame-src https://player.twitch.tv` | Twitch | Live Streams page embeds Twitch player iframes. |
| `frame-src https://www.twitch.tv` | Twitch | Live Streams page embeds Twitch chat iframes. |
| `frame-src https://checkout.stripe.com` | Stripe | Stripe Checkout may open in an iframe during payment flows. |
| `form-action https://checkout.stripe.com` | Stripe | Stripe Checkout redirect after Edge Function returns the session URL. |

### What's NOT allowed

- **No external scripts** — no CDN JS, no analytics, no third-party widgets.
- **No external fonts** — all fonts are self-hosted or system.
- **No `eval()`** — `script-src` has no `'unsafe-eval'`.
- **No `<object>` / `<embed>`** — `object-src 'none'`.
- **No framing** — `frame-ancestors 'none'` + `X-Frame-Options: DENY`.

## Rate Limiting

### Application-Level (SQL RPCs)

Server-side rate limits enforced in PostgreSQL via a `rate_limits` table and
`check_rate_limit(action, max_hits, window_seconds)`. Each protected RPC calls
this before doing any work. Exceeding the limit returns a friendly error:
`"Slow down — too many requests. Try again shortly."`

| Action | Max Hits | Window | RPC |
|--------|----------|--------|-----|
| `create_match` | 5 | 60s | `create_match()` |
| `join_match` | 10 | 60s | `join_match()` |
| `place_bet` | 10 | 60s | `place_side_bet()` |
| `withdrawal` | 3 | 5 min | `request_withdrawal()` |
| chat (inline) | 5 | 10s | `send_chat_message()` |

Old rate-limit rows (>10 min) are cleaned up probabilistically (2% of calls).

### Edge / CDN

Netlify offers rate limiting via [Netlify Traffic Rules](https://docs.netlify.com/security/secure-access-to-sites/traffic-rules/)
on paid plans. Enable for:
- `/` — 100 req/s per IP (DDoS protection)
- Bot detection — enable Netlify's bot protection if available

### Supabase Built-In Limits

- **Auth endpoints**: 30 requests per hour per IP (sign-up/sign-in)
- **REST API**: 1000 requests per second per project (shared across all users)
- **Realtime**: 200 concurrent connections per project (free tier)
- **Edge Functions**: 500k invocations/month on free tier, 2M on Pro
- **Storage**: 50 MB file limit, 1 GB total on free tier

These are sufficient for current scale. If traffic spikes, upgrade Supabase plan and
enable Netlify Traffic Rules.

## Testing Checklist

After deploying with these headers, verify:
- [ ] Stripe deposit flow works (redirect to checkout.stripe.com and back)
- [ ] Stripe Connect onboarding flow works
- [ ] Supabase realtime works (open chat, send a message, see it appear)
- [ ] Supabase auth works (sign up, sign in, password reset)
- [ ] Avatar upload works (image appears after upload)
- [ ] Twitch embeds load on Live page
- [ ] No CSP violations in browser console (check DevTools → Console)
- [ ] Site cannot be iframed (try embedding in an iframe from another origin)
