# Dubbed

Underground competitive arena for Call of Duty, Warzone and Black Ops Royale — head-to-head cash matches, XP ladders, and pooled-prize tournaments. Built with React + Vite and backed by Supabase (auth, Postgres, realtime).

## Stack

- **Frontend:** React 18 + Vite, `lucide-react` icons, plain CSS (`styles.css` + `theme.css`)
- **Backend:** Supabase — Auth (email + password), Postgres with Row Level Security, realtime subscriptions, and `SECURITY DEFINER` RPCs for every money-moving action
- **State:** no localStorage store anymore — the live session/profile come from Supabase and a small set of hooks (`useAuth`, `useToast`, `useAsync`)

## Project layout

```
src/
  lib/          supabase client singleton
  services/     one module per domain (auth, profiles, matches, tournaments,
                teams, chat, wallet, bets, notifications, leaderboard)
  hooks/        useAuth (session + live profile), useToast, useAsync/useCountdown
  utils/        format, validation, ranks, games catalog + mode rules
  components/   shared UI (Button, Modal, Skeleton, EmptyState, TopNav,
                ChatDock, AuthModal, CreateMatchModal, RankStar, ...)
  pages/        Home, Matchfinder, MatchRoom, Tournaments, Teams, Profile,
                Leaderboard, Wallet, Notifications
  App.jsx       app shell: routing, nav, chat, auth modal
  main.jsx      entry — wraps App in ToastProvider + AuthProvider
```

## Setup

### 1. Install

```bash
npm install
```

### 2. Create a Supabase project

At supabase.com, create a new project. Then in **Project Settings -> API**, copy the project URL and the `anon` public key.

### 3. Environment

```bash
cp .env.example .env
```

Fill in:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

### 4. Run the database migrations

In the Supabase dashboard, open **SQL Editor**, paste the entire contents of **`supabase_setup.sql`**, and run it. It's idempotent — safe to run more than once — and creates every table, policy, trigger, RPC, realtime config, and a few seed tournaments in one shot.
### 5. Configure Auth

In **Authentication -> Providers -> Email**, make sure email/password is enabled. If you want the email-verification flow, keep "Confirm email" on (the app already handles the "check your email" state). For faster local testing you can turn confirmation off.

### 6. Run

```bash
npm run dev      # http://localhost:5173
npm run build    # production build to dist/
npm run preview  # preview the built app
```

## Deploying to Netlify

The repo is Netlify-ready. `netlify.toml` sets the build command (`npm run build`), the publish directory (`dist`), Node 20, and — importantly — an SPA redirect so deep links and page refreshes don't 404 (there's also a `public/_redirects` copy as a fallback).

**Deploy via the Netlify dashboard:**

1. Push this project to a Git repo (GitHub/GitLab/Bitbucket) and "Add new site -> Import an existing project" in Netlify. It auto-detects the build command and publish dir from `netlify.toml`.
2. In **Site settings -> Environment variables**, add the same two keys from your `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

   These must be set in Netlify — the `.env` file is gitignored and never uploaded, and Vite bakes `VITE_*` vars in at build time, so a deploy without them will load but show the "Supabase isn't configured" banner.
3. Trigger a deploy. Done.

**Or via the CLI:**

```bash
npm i -g netlify-cli
netlify deploy --build --prod
```

(Set the env vars first with `netlify env:set VITE_SUPABASE_URL ...` and `netlify env:set VITE_SUPABASE_ANON_KEY ...`, or in the dashboard.)

**One Supabase setting to update after your first deploy:** in the Supabase dashboard under **Authentication -> URL Configuration**, set the **Site URL** to your Netlify URL (e.g. `https://your-site.netlify.app`) and add it to **Redirect URLs**. Otherwise the email-verification and password-reset links will point at localhost.

## How money works (important)

Nothing on the client is trusted with balances. Every value that touches money is read from the database, and **every mutation goes through a `SECURITY DEFINER` RPC** that re-checks the balance server-side under a row lock:

- **Match entry** is held from balance when you create or join a cash match.
- **Settlement** pays the pot minus a 10% rake to the winner, and awards XP (100 win / 25 loss). A match auto-settles only when every participant reports the same winner; otherwise it's flagged `disputed` for staff.
- **Deposits** currently credit balance directly as a placeholder (see TODO). **Withdrawals never auto-pay** — they hold the balance and file a `withdrawal_requests` row for admin review.

Row Level Security is on for every table, and the sensitive profile columns (`balance`, `xp`, `wins`, `losses`, `earnings`) have `UPDATE` revoked from the `authenticated` role so they can only change via RPCs.

## Authentication

Signup is **email + username + password** (with email verification). **Login is username + password** — the app resolves your username to its email via a secure `email_for_username` RPC, then authenticates. Password reset uses email.

## Username rules

1–8 characters, special characters allowed, no whitespace, profanity-filtered (client-side in `utils/validation.js`, enforced again in the `change_username` RPC and a table constraint).

## What still needs wiring before real launch

See `NOTES.md`.
