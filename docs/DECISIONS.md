# Match Layout — Design Decisions

## No-Show Timing

Players have **10 minutes** from the scheduled match start to join the lobby.

- At 10 minutes the waiting player clicks **"No Show"** in the match chat,
  which auto-files a dispute with the reason pre-filled.
- An admin reviews and may grant a brief extension at their discretion.
- Failure to join after the admin's deadline results in a map or match forfeit.
- For multi-map series: if an opponent forfeits Map 1, the waiting team must
  still attempt Map 2 or provide proof of waiting the full window for that map.

## Reporting Timeout

If one team reports a result and the opponent does **not respond within
2 hours**, the reported result stands automatically. This prevents stalling.

## Host Rules (Per-Map)

| Series | Map 1 | Map 2 | Map 3+ |
|---|---|---|---|
| Bo1 | Match host (creator or higher rank) | — | — |
| Bo3 | Higher-ranked team hosts | Lower-ranked team hosts | Team with most combined kills/rounds from Maps 1–2 |
| Bo5 | Higher-ranked team hosts | Lower-ranked team hosts | Continues alternating; tiebreaker on kills |

Rank is determined by total XP (leaderboard position).

For **NA + EU** lobbies, the region with more players in the lobby hosts
(existing `resolve_host` RPC). This determines the server region; the per-map
host assignment determines which team creates the private match lobby.

## One Component, Two Contexts

`MatchRoomPage` serves both ladder matches and tournament matches. The only
difference is the `ContextStrip`:

- **Tournament match:** shows tournament name, round, match number, and
  "Back to bracket" link. Detected via `getTournamentContext(matchId)` query
  against `tournament_matches`.
- **Ladder match:** shows "Back to matchfinder" link.

Everything else (header, teams panel, host table, veto, reporting, chat,
rules strip) is identical between contexts.

## Proof Requirements

- All proof must be **video format** (VOD, clip, DVR recording).
- Proof must show the **full scoreboard with gamertags** clearly readable.
- PC players must stream with past broadcasts enabled; VOD stays up 24 hours.
- Conversations outside Dubbed are not valid proof.
- Accepted streaming platforms: Twitch, YouTube, Kick, Facebook. Not TikTok.

## Leaderboard Win % Threshold

The **Win %** board requires a minimum of **10 completed matches** to qualify.
Without this, a 1-0 player tops the board at 100%. The threshold is enforced
server-side in the `get_leaderboard` RPC (`WHERE (wins + losses) >= 10`).

## Weekly Leaderboard & Rewards

Weekly stats are tracked in `weekly_stats` (per-user, per-week deltas).
The week runs **Sunday 00:00 UTC to Saturday 23:59 UTC** (matching CMG).

**Credit rewards for top-3 weekly XP earners:**
| Place | Credits |
|---|---|
| 1st | $25.00 |
| 2nd | $15.00 |
| 3rd | $10.00 |

Credits are granted via `rollover_week()`, which writes to `wallet_ledger`
(reason `'weekly_reward'`) and uses `weekly_rewards` as an idempotency guard.
The function is designed for `pg_cron` or a Supabase scheduled function
running every Sunday at 00:00 UTC.

**Status:** The `weekly_stats` table and `rollover_week` function exist but
`settle_match` / `settle_tournament` do not yet INSERT/UPSERT into
`weekly_stats`. See TODO.md for the wiring steps.

## Settlement Is Server-Authoritative

The UI never computes payouts. All money movement goes through SQL RPCs
(`settle_match`, `settle_bet`, `settle_tournament`). The UI only submits
who won and the score — the server handles rake, balance credits, and
ledger entries.

## Match Gate — Linked Account + Team Requirements

Before posting or accepting a match, the server (`can_play_game` RPC) checks:
1. The user is a member of a team whose `game` matches the match's game.
2. The user has the correct linked gaming account for that game.

### Per-Game Linked-Account Rule Table

| Game | Required Account | Validation Pattern |
|---|---|---|
| Call of Duty: Black Ops 7 | Activision ID | `^\S+#\d{4,10}$` (e.g. `Player#1234567`) |
| Warzone | Activision ID | Same |
| Black Ops Royale | Activision ID | Same |
| Call of Duty: Modern Warfare 4 | Activision ID | Same |
| Call of Duty: WWII | PSN **or** Xbox | Non-empty string |
| (Future CoD titles) | Default: Activision ID | Unless old-gen console-only |

### Enforcement

- **Server-side** (`can_play_game`): called at the top of `create_match` and
  `join_match`. Returns a human-readable reason or NULL. This is authoritative.
- **Client-side** (`checkGameEligibility` in `games.js`): convenience check
  to show inline gates and disable buttons. Not a security boundary.

### Gamertag Privacy

Gamertags (Activision ID / PSN / Xbox) are only shown in the Match Room to
participants of that match, not to spectators or the public profile.

### Activision ID Format

Pattern: `^\S+#\d{4,10}$` — non-whitespace username followed by `#` and
4-10 digits. This is a format check only. Live verification against Activision
servers is a future integration (see `/docs/TODO.md`).

## Rate Limits

Server-side rate limits enforced in SQL via the `rate_limits` table and
`check_rate_limit(action, max_hits, window_seconds)` helper. Returns a
friendly "Slow down" error to the client — never a crash.

| Action | Max | Window | Notes |
|--------|-----|--------|-------|
| `create_match` | 5 | 60s | Prevents match spam |
| `join_match` | 10 | 60s | Generous — joining is quick |
| `place_bet` | 10 | 60s | Prevents bet spam on events |
| `withdrawal` | 3 | 300s (5min) | Financial action, tight limit |
| `send_chat_message` | 5 | 10s | Inline in the RPC (not via `rate_limits` table) |

### Implementation

- `rate_limits` table: `(user_id, action, hit_at)` composite PK with a
  descending index on `hit_at` for fast lookups.
- Each `check_rate_limit` call counts recent hits within the window, raises
  if over the max, and inserts a new row on success.
- Cleanup: old rows (>10 min) are purged probabilistically (2% of calls)
  via `purge_old_rate_limits()`. Can also be called from a cron.
- The table has RLS `using (false)` — no direct client access, only via
  SECURITY DEFINER functions.
- Limits are constants in SQL. To change, update the `check_rate_limit`
  call in the respective RPC and re-run the SQL.

## Smoothness Extras (Section 5)

### Offline Banner
`ConnectionBanner` component listens for `online`/`offline` browser events.
When the connection drops, a fixed-top red banner shows "You're offline —
reconnecting…" with a `WifiOff` icon. Disappears automatically when the
connection returns. Rendered at the top of `App` so it covers all pages.

### Web Vitals
`useWebVitals` hook uses `PerformanceObserver` to capture LCP, CLS, and INP.
Values are logged as `performance.mark("dubbed:lcp" | "dubbed:cls" | "dubbed:inp")`
for DevTools inspection. No external analytics dependency — marks are
inspectable in the Performance timeline and can be forwarded to a backend later.

### Optimistic UI
The Matchfinder "Accept" button shows an immediate "Joining…" state with a
loading spinner (`joiningId` local state) before the RPC round-trips. If the
join fails, the button reverts and a toast shows the error.

### Reduced Motion
A global `@media(prefers-reduced-motion: reduce)` rule in `theme.css` kills
all CSS animations and transitions (duration forced to 0.01ms, scroll-behavior
to auto). Users with accessibility settings get zero jank by default.

## Eligibility Gate — `can_play`

Server-authoritative function `can_play(user, game, platform, type)` blocks
match/tournament entry when a user lacks the right team or linked account.

### Per-Game / Platform Rule Table

| Game | Required Account | Platform Rule |
|------|-----------------|---------------|
| Black Ops 7 | Activision ID (`^\S+#\d{4,10}$`) | Any (PC/Console/Mixed) |
| Warzone | Activision ID | Any |
| Black Ops Royale | Activision ID | Any |
| MW4 | Activision ID | Any |
| WWII | PSN **or** Xbox (per team platform) | Split: PSN-only or Xbox-only |

### WWII Split Ladders (PSN vs Xbox)

WWII teams must declare `platform = 'PlayStation Only'` or `'Xbox Only'` at
creation. Matches inherit the creator's team platform. Joining requires a
team on the same platform. Standings are independent per platform.

### Team Records (Separate Tournament W/L)

Teams track `wins`, `losses`, `earnings`, `xp` for ladder matches and
`tourney_wins`, `tourney_losses` separately for tournaments. Both are
updated in `settle_match` based on whether the match belongs to a
tournament bracket. `team_match_history` stores per-match records.

### Active Matches on Team Page

The team detail page shows all matches with status `open|live|reported|
disputed` involving team members. Each card shows full setup (game, mode,
format, platform, region, entry, players, status) with a "Go to match"
button. Updates via Supabase realtime + `useVisibilityRefresh` fallback.
This guarantees a player never loses track of a live match.
