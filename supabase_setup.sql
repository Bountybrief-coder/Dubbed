-- ============================================================================
-- DUBBED.PRO — COMPLETE DATABASE SETUP (idempotent / safe to re-run)
-- Paste this whole file into the Supabase SQL editor and run it once.
-- It creates every table, type, policy, trigger and RPC the app needs, and
-- can be run again without errors (types/tables are guarded).
-- ============================================================================

-- ---------- EXTENSIONS ----------
create extension if not exists pgcrypto;   -- gen_random_uuid()

-- ---------- ENUM TYPES (guarded so re-running won't error) ----------
do $$ begin create type match_status as enum ('open','live','reported','settled','disputed','cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type match_kind as enum ('cash','xp'); exception when duplicate_object then null; end $$;
do $$ begin create type team_type as enum ('xp','cash'); exception when duplicate_object then null; end $$;
do $$ begin create type tournament_status as enum ('upcoming','live','completed','cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type chat_channel as enum ('global','lfg','betting','support'); exception when duplicate_object then null; end $$;
do $$ begin create type bet_market as enum ('streamer','cdl'); exception when duplicate_object then null; end $$;
do $$ begin create type bet_status as enum ('open','won','lost','void'); exception when duplicate_object then null; end $$;
do $$ begin create type bet_event_status as enum ('open','locked','settled','void'); exception when duplicate_object then null; end $$;
do $$ begin create type withdrawal_status as enum ('pending','processing','approved','rejected','paid'); exception when duplicate_object then null; end $$;
-- If the enum already existed from an older run without 'processing', add it.
-- (Runs in its own statement; on a fresh DB the create above already has it.)
do $$ begin alter type withdrawal_status add value if not exists 'processing' before 'approved'; exception when others then null; end $$;
do $$ begin create type dispute_status as enum ('open','reviewing','resolved','rejected'); exception when duplicate_object then null; end $$;
do $$ begin create type cancel_status as enum ('pending','accepted','declined'); exception when duplicate_object then null; end $$;
-- NOTE: intentionally not adding a value to match_status here — ALTER TYPE ...
-- ADD VALUE can't be used later in the same transaction it's created in, and
-- this whole file is typically run as one paste. The veto phase is tracked
-- with its own `veto_status` column instead (see matches table below).

-- ============================================================================
-- RATE LIMITS — lightweight per-user action throttle
-- ============================================================================
create table if not exists public.rate_limits (
  user_id    uuid not null references auth.users(id) on delete cascade,
  action     text not null,
  hit_at     timestamptz not null default now(),
  primary key (user_id, action, hit_at)
);
create index if not exists idx_rate_limits_lookup on public.rate_limits (user_id, action, hit_at desc);

-- Purge rate-limit rows older than 10 minutes (keep table small).
create or replace function public.purge_old_rate_limits()
returns void language sql security definer set search_path = public as $$
  delete from public.rate_limits where hit_at < now() - interval '10 minutes';
$$;

-- check_rate_limit(action, max_hits, window_seconds) → raises if over limit.
-- Records a hit on success. Cheap: single index scan + insert.
create or replace function public.check_rate_limit(p_action text, p_max int, p_window int)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid; v_count int;
begin
  v_uid := auth.uid();
  if v_uid is null then raise exception 'not authenticated'; end if;

  select count(*) into v_count from public.rate_limits
  where user_id = v_uid and action = p_action
    and hit_at > now() - (p_window || ' seconds')::interval;

  if v_count >= p_max then
    raise exception 'Slow down — too many requests. Try again shortly.';
  end if;

  insert into public.rate_limits(user_id, action) values (v_uid, p_action);

  -- Opportunistic cleanup (1-in-50 calls)
  if random() < 0.02 then
    perform public.purge_old_rate_limits();
  end if;
end $$;

-- No direct client access to the table.
alter table public.rate_limits enable row level security;
drop policy if exists "rate_limits_deny_all" on public.rate_limits;
create policy "rate_limits_deny_all" on public.rate_limits for all using (false);

-- ============================================================================
-- PROFILES  (1:1 with auth.users)
-- ============================================================================
create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  username       text unique not null,
  username_lower text unique not null,
  avatar_url     text default '',
  activision_id  text default '',
  psn            text default '',
  xbox           text default '',
  region         text default 'NA',
  xp             integer not null default 0,
  wins           integer not null default 0,
  losses         integer not null default 0,
  streak         integer not null default 0,
  earnings       numeric(12,2) not null default 0,
  balance        numeric(12,2) not null default 0,
  verified       boolean not null default false,
  member_since   timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  constraint username_len   check (char_length(username) between 1 and 8),
  constraint username_chars check (username !~ '\s')
);
create index if not exists profiles_username_lower_idx on public.profiles(username_lower);
create index if not exists profiles_xp_idx on public.profiles(xp desc);

-- add region/streak/verified/platform if an older profiles table already existed
alter table public.profiles add column if not exists region text default 'NA';
alter table public.profiles add column if not exists streak integer not null default 0;
alter table public.profiles add column if not exists verified boolean not null default false;
alter table public.profiles add column if not exists platform text default 'PC + Console';

-- Payout provider fields (Stripe Connect Express is the default provider).
-- `pending_balance` mirrors funds moved into an in-flight withdrawal so the
-- ledger stays the single source of truth: available = balance, in-flight =
-- pending_balance. `suspended` gates all payouts (fraud/abuse hold).
alter table public.profiles add column if not exists pending_balance numeric(12,2) not null default 0;
alter table public.profiles add column if not exists suspended boolean not null default false;
alter table public.profiles add column if not exists stripe_account_id text;
alter table public.profiles add column if not exists stripe_onboarding_complete boolean not null default false;
alter table public.profiles add column if not exists stripe_charges_enabled boolean not null default false;
alter table public.profiles add column if not exists stripe_payouts_enabled boolean not null default false;
alter table public.profiles add column if not exists stripe_verification_status text not null default 'unverified';
alter table public.profiles add column if not exists stripe_last_verified_at timestamptz;

-- Shop: WAGR membership + username-change entitlement.
-- `username_change_tokens` is a count of one-time username edits the user has
-- bought and not yet consumed. Membership fields mirror Stripe's subscription.
alter table public.profiles add column if not exists username_change_tokens integer not null default 0;
alter table public.profiles add column if not exists wagr_member boolean not null default false;
alter table public.profiles add column if not exists subscription_status text not null default 'none'; -- none|active|past_due|canceled|expired
alter table public.profiles add column if not exists subscription_provider text;                        -- 'stripe'
alter table public.profiles add column if not exists subscription_id text;                              -- sub_...
alter table public.profiles add column if not exists subscription_end timestamptz;

-- Ban system — fast-check fields on profiles, detailed history in user_bans.
alter table public.profiles add column if not exists banned boolean not null default false;
alter table public.profiles add column if not exists ban_reason text;
alter table public.profiles add column if not exists ban_expires_at timestamptz;

-- Double XP token: active until this timestamp.
alter table public.profiles add column if not exists double_xp_active_until timestamptz;

-- Private Stripe customer mapping (never world-readable like profiles).
create table if not exists public.stripe_customers (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  customer_id text not null unique,
  created_at  timestamptz not null default now()
);

-- keep username_lower in sync
create or replace function public.sync_username_lower()
returns trigger language plpgsql as $$
begin new.username_lower := lower(new.username); return new; end $$;

drop trigger if exists trg_profiles_username_lower on public.profiles;
create trigger trg_profiles_username_lower
before insert or update of username on public.profiles
for each row execute function public.sync_username_lower();

-- auto-create a profile when someone signs up (username comes from signUp meta)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, username_lower, verified)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'p' || substr(new.id::text,1,7)),
    lower(coalesce(new.raw_user_meta_data->>'username', 'p' || substr(new.id::text,1,7))),
    new.email_confirmed_at is not null
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Sync `profiles.verified` when Supabase Auth confirms an email (the user
-- clicks the link in their verification email, or an admin manually confirms).
-- Without this, profiles.verified stays false and withdrawals remain blocked.
create or replace function public.handle_user_verified()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null and (old.email_confirmed_at is null or old.email_confirmed_at <> new.email_confirmed_at) then
    update public.profiles set verified = true where id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_verified on auth.users;
create trigger on_auth_user_verified
after update of email_confirmed_at on auth.users
for each row execute function public.handle_user_verified();

-- ---------- USERNAME -> EMAIL for username login ----------
-- Login is username + password. Supabase Auth only knows email, so the client
-- calls this to resolve the email, then signs in. SECURITY DEFINER lets it read
-- auth.users; it only ever returns the email for an exact username match.
create or replace function public.email_for_username(p_username text)
returns text language plpgsql security definer set search_path = public, auth as $$
declare v_email text;
begin
  select u.email into v_email
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.username_lower = lower(p_username)
  limit 1;
  return v_email;
end $$;

grant execute on function public.email_for_username(text) to anon, authenticated;

-- ============================================================================
-- TROPHIES & RECORDS
-- ============================================================================
create table if not exists public.trophies (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  title      text not null,             -- tournament name
  place      integer,                   -- 1, 2, 3
  tone       text,                      -- 'gold' | 'silver' | 'bronze'
  game       text,
  prize      numeric(12,2) default 0,
  bracket_size integer,
  earned_at  timestamptz not null default now()
);
create index if not exists trophies_user_idx on public.trophies(user_id);

create table if not exists public.records (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  game    text not null,
  format  text,
  w       integer not null default 0,
  l       integer not null default 0,
  unique (user_id, game, format)
);
create index if not exists records_user_idx on public.records(user_id);

-- ============================================================================
-- TEAMS
-- ============================================================================
create table if not exists public.teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  tag        text not null,
  type       team_type not null default 'xp',
  game       text,
  owner_id   uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
-- Team columns added for records, platform, and sizing.
alter table public.teams add column if not exists platform text;
alter table public.teams add column if not exists size integer not null default 1;
alter table public.teams add column if not exists wins integer not null default 0;
alter table public.teams add column if not exists losses integer not null default 0;
alter table public.teams add column if not exists earnings numeric(12,2) not null default 0;
alter table public.teams add column if not exists xp integer not null default 0;
alter table public.teams add column if not exists tourney_wins integer not null default 0;
alter table public.teams add column if not exists tourney_losses integer not null default 0;

create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role    text not null default 'member',
  primary key (team_id, user_id)
);
create table if not exists public.team_invites (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

-- ============================================================================
-- MATCHES
-- ============================================================================
create table if not exists public.matches (
  id         uuid primary key default gen_random_uuid(),
  code       text unique not null,
  game       text not null,
  mode       text not null,
  format     text not null,
  region     text not null,
  entry      numeric(12,2) not null default 0,
  kind       match_kind not null default 'xp',
  status     match_status not null default 'open',
  created_by uuid not null references public.profiles(id) on delete cascade,
  winner_id  uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists matches_kind_status_idx on public.matches(kind, status);
create index if not exists matches_created_by_idx on public.matches(created_by);

-- Platform / skill / ruleset additions (idempotent on re-run).
alter table public.matches add column if not exists platform text not null default 'PC + Console Mixed';
alter table public.matches add column if not exists skill_tier text not null default 'Open';
alter table public.matches add column if not exists series text not null default 'Best of 1';
alter table public.matches add column if not exists weapon_restriction text;
alter table public.matches add column if not exists host_region text;
alter table public.matches add column if not exists host_rule text not null default 'auto';
-- veto_status: 'none' (no veto needed / not started), 'pending' (lobby full,
-- veto in progress — room is NOT playable yet), 'complete' (map(s) locked in).
alter table public.matches add column if not exists veto_status text not null default 'none';
alter table public.matches add column if not exists veto jsonb;
do $$ begin
  alter table public.matches add constraint matches_platform_chk check (platform in ('Console Only','PC Only','PC + Console Mixed')) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.matches add constraint matches_skill_chk check (skill_tier in ('Rookie Only','Open','Mixed Skill','Advanced/Elite')) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.matches add constraint matches_veto_status_chk check (veto_status in ('none','pending','complete')) not valid;
exception when duplicate_object then null; end $$;

create table if not exists public.match_players (
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (match_id, user_id)
);
-- Snapshot the player's region at join time — the host rule is decided off
-- who's actually in the lobby, not off whatever region they change to later.
alter table public.match_players add column if not exists region text not null default 'NA';
-- Which team the player entered with (for team record attribution on settle).
alter table public.match_players add column if not exists team_id uuid references public.teams(id) on delete set null;
alter table public.match_players add column if not exists team_name text;

create table if not exists public.match_reports (
  id           uuid primary key default gen_random_uuid(),
  match_id     uuid not null references public.matches(id) on delete cascade,
  reported_by  uuid not null references public.profiles(id) on delete cascade,
  winner_id    uuid references public.profiles(id) on delete set null,
  score        text,
  evidence_url text,
  created_at   timestamptz not null default now(),
  unique (match_id, reported_by)
);

create table if not exists public.match_disputes (
  id           uuid primary key default gen_random_uuid(),
  match_id     uuid not null references public.matches(id) on delete cascade,
  opened_by    uuid not null references public.profiles(id) on delete cascade,
  reason       text not null,
  evidence_url text,
  status       dispute_status not null default 'open',
  resolved_by  uuid references public.profiles(id) on delete set null,
  resolution   text,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

-- Per-match team chat — every player in the lobby can talk here, separate
-- from the global ChatDock channels.
create table if not exists public.match_messages (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.matches(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  username   text not null,
  text       text not null,
  kind       text not null default 'msg', -- 'msg' | 'system'
  created_at timestamptz not null default now()
);
create index if not exists match_messages_match_idx on public.match_messages(match_id, created_at);

-- Either side can request to cancel a lobby before it settles; the other
-- side (or an admin) has to accept it for the match to actually cancel.
create table if not exists public.match_cancel_requests (
  id           uuid primary key default gen_random_uuid(),
  match_id     uuid not null references public.matches(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  reason       text,
  status       cancel_status not null default 'pending',
  resolved_by  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);
create index if not exists cancel_requests_match_idx on public.match_cancel_requests(match_id);

-- ============================================================================
-- TOURNAMENTS
-- ============================================================================
create table if not exists public.tournaments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  game        text not null default 'Call of Duty: Black Ops 7',
  mode        text not null,
  format      text not null,
  entry       numeric(12,2) not null,
  capacity    integer not null,
  region      text not null default 'NA + EU',
  starts_at   timestamptz not null,
  status      tournament_status not null default 'upcoming',
  winner_name text,
  second_name text,
  third_name  text,
  created_at  timestamptz not null default now()
);
create index if not exists tournaments_status_idx on public.tournaments(status, starts_at);
alter table public.tournaments add column if not exists winner_name text;
alter table public.tournaments add column if not exists second_name text;
alter table public.tournaments add column if not exists third_name text;
alter table public.tournaments add column if not exists platform text not null default 'PC + Console Mixed';
alter table public.tournaments add column if not exists skill_tier text not null default 'Open';
alter table public.tournaments add column if not exists series text not null default 'Best of 1';
alter table public.tournaments add column if not exists weapon_restriction text;
alter table public.tournaments add column if not exists host_rule text not null default 'auto';

create table if not exists public.tournament_entries (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  entrant_name  text not null,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  paid          numeric(12,2) not null,
  placed        integer,
  joined_at     timestamptz not null default now(),
  primary key (tournament_id, entrant_name)
);

-- Which team the entrant registered with (for tournament record attribution).
alter table public.tournament_entries add column if not exists team_id uuid references public.teams(id) on delete set null;

-- Bracket rounds + matches for single-elimination tournaments.
create table if not exists public.tournament_rounds (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round_number  integer not null,
  round_name    text not null,
  series_format text not null default 'Best of 1',
  created_at    timestamptz not null default now(),
  unique (tournament_id, round_number)
);

create table if not exists public.tournament_matches (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null references public.tournaments(id) on delete cascade,
  round_id        uuid not null references public.tournament_rounds(id) on delete cascade,
  match_number    integer not null,
  seed_a          integer,
  seed_b          integer,
  entrant_a       text,
  entrant_b       text,
  user_a          uuid references public.profiles(id),
  user_b          uuid references public.profiles(id),
  match_id        uuid references public.matches(id),
  winner_entrant  text,
  winner_user     uuid references public.profiles(id),
  status          text not null default 'pending',
  created_at      timestamptz not null default now()
);
create index if not exists tm_tournament_idx on public.tournament_matches(tournament_id, round_id);

alter table public.tournaments add column if not exists bracket_generated boolean not null default false;
alter table public.tournaments add column if not exists current_round integer not null default 0;
alter table public.tournaments add column if not exists total_rounds integer;

-- Add resolution columns to match_disputes for admin dispute flow
alter table public.match_disputes add column if not exists resolved_by uuid references public.profiles(id);
alter table public.match_disputes add column if not exists resolved_at timestamptz;
alter table public.match_disputes add column if not exists resolution_note text;

-- ============================================================================
-- CHAT / BETS / NOTIFICATIONS / WALLET / WITHDRAWALS / AUDIT
-- ============================================================================
create table if not exists public.chat_messages (
  id        uuid primary key default gen_random_uuid(),
  channel   chat_channel not null,
  user_id   uuid default auth.uid() references public.profiles(id) on delete set null,
  username  text not null,
  text      text not null,
  kind      text not null default 'msg',
  created_at timestamptz not null default now()
);
create index if not exists chat_channel_idx on public.chat_messages(channel, created_at);

create table if not exists public.bets (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  target    text not null,
  market    bet_market not null,
  stake     numeric(12,2) not null check (stake > 0),
  odds      numeric(6,2) not null default 2.0,
  status    bet_status not null default 'open',
  created_at timestamptz not null default now()
);

-- ============================================================================
-- BET EVENTS + SIDE BETS (event-based betting with admin settlement)
-- ============================================================================
create table if not exists public.bet_events (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text default '',
  market        bet_market not null default 'cdl',
  options       jsonb not null default '[]'::jsonb,
  odds          numeric(6,2) not null default 2.0,
  status        bet_event_status not null default 'open',
  winner_option text,
  created_by    uuid not null default auth.uid() references public.profiles(id),
  locks_at      timestamptz,
  settled_at    timestamptz,
  created_at    timestamptz not null default now()
);

create table if not exists public.side_bets (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.bet_events(id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  selection  text not null,
  stake      numeric(12,2) not null check (stake > 0),
  odds       numeric(6,2) not null default 2.0,
  status     bet_status not null default 'open',
  payout     numeric(12,2),
  rake       numeric(12,2),
  settled_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists side_bets_event_idx on public.side_bets(event_id);
create index if not exists side_bets_user_idx on public.side_bets(user_id);

create table if not exists public.notifications (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.profiles(id) on delete cascade,
  text      text not null,
  read      boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at);

create table if not exists public.wallet_ledger (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.profiles(id) on delete cascade,
  delta     numeric(12,2) not null,
  reason    text not null,
  ref_id    uuid,
  created_at timestamptz not null default now()
);
create index if not exists wallet_user_idx on public.wallet_ledger(user_id, created_at);

create table if not exists public.withdrawal_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  amount      numeric(12,2) not null check (amount > 0),
  destination text,
  status      withdrawal_status not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz
);
-- Provider-agnostic payout metadata. `provider` defaults to 'stripe' but the
-- shape supports PayPal / Interac / Wise / bank later with no schema change —
-- provider-specific ids live in `payout_id` + `destination` + `meta`.
alter table public.withdrawal_requests add column if not exists provider text not null default 'stripe';
alter table public.withdrawal_requests add column if not exists payout_id text;           -- e.g. Stripe payout id (po_...)
alter table public.withdrawal_requests add column if not exists transfer_id text;          -- e.g. Stripe transfer id (tr_...)
alter table public.withdrawal_requests add column if not exists transaction_id text unique default gen_random_uuid()::text; -- our public reference
alter table public.withdrawal_requests add column if not exists rejected_reason text;
alter table public.withdrawal_requests add column if not exists completed_at timestamptz;
alter table public.withdrawal_requests add column if not exists processing_at timestamptz;
alter table public.withdrawal_requests add column if not exists meta jsonb;
create index if not exists withdrawals_user_idx on public.withdrawal_requests(user_id, created_at desc);
create index if not exists withdrawals_status_idx on public.withdrawal_requests(status, created_at desc);

-- Idempotency guard for provider webhooks (Stripe & any future provider).
-- The unique event id means a re-delivered webhook is a no-op.
create table if not exists public.payout_events (
  id          uuid primary key default gen_random_uuid(),
  provider    text not null default 'stripe',
  event_id    text not null,
  event_type  text,
  withdrawal_id uuid references public.withdrawal_requests(id) on delete set null,
  payload     jsonb,
  created_at  timestamptz not null default now(),
  unique (provider, event_id)
);

create table if not exists public.payment_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete set null,
  provider    text not null default 'stripe',
  event_type  text,
  external_id text unique,
  amount      numeric(12,2),
  payload     jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references public.profiles(id) on delete set null,
  action     text not null,
  target     text,
  meta       jsonb,
  created_at timestamptz not null default now()
);

-- Ban records — every ban/unban is an immutable audit row
create table if not exists public.user_bans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  banned_by   uuid not null references public.profiles(id) on delete set null,
  reason      text not null,
  duration    text not null,
  expires_at  timestamptz,
  active      boolean not null default true,
  unbanned_by uuid references public.profiles(id) on delete set null,
  unbanned_at timestamptz,
  unban_note  text,
  created_at  timestamptz not null default now()
);
create index if not exists bans_user_idx on public.user_bans(user_id, active);
create index if not exists bans_active_idx on public.user_bans(active, expires_at);

-- ============================================================================
-- SHOP — account services + memberships (never tournament entries)
-- ============================================================================
-- Immutable purchase record. `item_key` is the catalog id (server-priced), and
-- `payment_method` is 'wallet' or 'stripe'. `transaction_id` is a public ref.
create table if not exists public.shop_purchases (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  item_key       text not null,           -- 'username_change' | 'stat_reset' | 'wagr_membership'
  item_name      text not null,
  category       text not null,           -- 'membership' | 'account_service'
  price          numeric(12,2) not null,
  payment_method text not null default 'wallet',  -- 'wallet' | 'stripe'
  status         text not null default 'completed', -- 'completed' | 'pending' | 'failed' | 'refunded'
  transaction_id text unique default gen_random_uuid()::text,
  stripe_ref     text,                    -- checkout session / invoice id when relevant
  meta           jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists shop_purchases_user_idx on public.shop_purchases(user_id, created_at desc);
create index if not exists shop_purchases_item_idx on public.shop_purchases(item_key, created_at desc);

-- Username change audit trail (old -> new, who, when). Kept forever so
-- "previous usernames remain" after a stat reset.
create table if not exists public.username_history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  old_username text not null,
  new_username text not null,
  purchase_id uuid references public.shop_purchases(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists username_history_user_idx on public.username_history(user_id, created_at desc);

-- Stripe subscription webhook idempotency (one row per Stripe event id).
create table if not exists public.subscription_events (
  id          uuid primary key default gen_random_uuid(),
  provider    text not null default 'stripe',
  event_id    text not null,
  event_type  text,
  user_id     uuid references public.profiles(id) on delete set null,
  payload     jsonb,
  created_at  timestamptz not null default now(),
  unique (provider, event_id)
);


create table if not exists public.app_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade
);
create or replace function public.is_admin()
returns boolean language sql stable as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to authenticated;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles            enable row level security;
alter table public.trophies            enable row level security;
alter table public.records             enable row level security;
alter table public.teams               enable row level security;
alter table public.team_members        enable row level security;
alter table public.team_invites        enable row level security;
alter table public.matches             enable row level security;
alter table public.match_players       enable row level security;
alter table public.match_reports       enable row level security;
alter table public.match_disputes      enable row level security;
alter table public.match_messages      enable row level security;
alter table public.match_cancel_requests enable row level security;
alter table public.tournaments         enable row level security;
alter table public.tournament_entries  enable row level security;
alter table public.chat_messages       enable row level security;
alter table public.bets                enable row level security;
alter table public.notifications       enable row level security;
alter table public.wallet_ledger       enable row level security;
alter table public.withdrawal_requests enable row level security;
alter table public.payout_events       enable row level security;
alter table public.payment_events      enable row level security;
alter table public.audit_logs          enable row level security;
alter table public.shop_purchases      enable row level security;
alter table public.username_history    enable row level security;
alter table public.subscription_events enable row level security;
alter table public.stripe_customers    enable row level security;
alter table public.user_bans           enable row level security;
alter table public.tournament_rounds   enable row level security;
alter table public.tournament_matches  enable row level security;
alter table public.app_admins          enable row level security;
alter table public.bet_events          enable row level security;
alter table public.side_bets           enable row level security;

-- Helper to (re)create a policy idempotently
-- profiles: world-readable (public profiles), self-update for safe columns only
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select using (true);
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles for update using (auth.uid() = id);

-- Lock the money/stat columns: revoke direct UPDATE so only RPCs can change them
revoke update on public.profiles from authenticated;
grant update (avatar_url, activision_id, psn, xbox, region) on public.profiles to authenticated;

drop policy if exists "trophies read" on public.trophies;
create policy "trophies read" on public.trophies for select using (true);
drop policy if exists "records read" on public.records;
create policy "records read" on public.records for select using (true);

drop policy if exists "teams read" on public.teams;
create policy "teams read" on public.teams for select using (true);
drop policy if exists "teams insert" on public.teams;
create policy "teams insert" on public.teams for insert with check (auth.uid() = owner_id);
drop policy if exists "teams owner update" on public.teams;
create policy "teams owner update" on public.teams for update using (auth.uid() = owner_id);

drop policy if exists "members read" on public.team_members;
create policy "members read" on public.team_members for select using (true);
drop policy if exists "members insert" on public.team_members;
create policy "members insert" on public.team_members for insert with check (auth.uid() = user_id or exists (select 1 from public.teams t where t.id = team_id and t.owner_id = auth.uid()));

drop policy if exists "invites read" on public.team_invites;
create policy "invites read" on public.team_invites for select using (auth.uid() = user_id or exists (select 1 from public.teams t where t.id = team_id and t.owner_id = auth.uid()));
drop policy if exists "invites insert" on public.team_invites;
create policy "invites insert" on public.team_invites for insert with check (exists (select 1 from public.teams t where t.id = team_id and t.owner_id = auth.uid()));
drop policy if exists "invites delete" on public.team_invites;
create policy "invites delete" on public.team_invites for delete using (auth.uid() = user_id or exists (select 1 from public.teams t where t.id = team_id and t.owner_id = auth.uid()));

drop policy if exists "matches read" on public.matches;
create policy "matches read" on public.matches for select using (true);
drop policy if exists "match_players read" on public.match_players;
create policy "match_players read" on public.match_players for select using (true);
drop policy if exists "reports read" on public.match_reports;
create policy "reports read" on public.match_reports for select using (true);
drop policy if exists "disputes read" on public.match_disputes;
create policy "disputes read" on public.match_disputes for select using (true);

-- Match chat + cancel requests are only visible to the players in that lobby
-- (or an admin). Inserts go through RPCs, but reads are plain policy checks.
drop policy if exists "match msg read" on public.match_messages;
create policy "match msg read" on public.match_messages for select using (
  exists (select 1 from public.match_players mp where mp.match_id = match_messages.match_id and mp.user_id = auth.uid())
  or public.is_admin()
);
drop policy if exists "match msg insert" on public.match_messages;
create policy "match msg insert" on public.match_messages for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.match_players mp where mp.match_id = match_messages.match_id and mp.user_id = auth.uid())
);

drop policy if exists "cancel read" on public.match_cancel_requests;
create policy "cancel read" on public.match_cancel_requests for select using (
  exists (select 1 from public.match_players mp where mp.match_id = match_cancel_requests.match_id and mp.user_id = auth.uid())
  or public.is_admin()
);

drop policy if exists "tournaments read" on public.tournaments;
create policy "tournaments read" on public.tournaments for select using (true);
drop policy if exists "entries read" on public.tournament_entries;
create policy "entries read" on public.tournament_entries for select using (true);

drop policy if exists "chat read" on public.chat_messages;
create policy "chat read" on public.chat_messages for select
  using (auth.uid() is not null and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.banned));
drop policy if exists "chat insert" on public.chat_messages;
create policy "chat insert" on public.chat_messages for insert
  with check (auth.uid() = user_id and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.banned));

drop policy if exists "bets read own" on public.bets;
create policy "bets read own" on public.bets for select using (auth.uid() = user_id);

-- bet_events: anyone authed can read; only admins create/update
drop policy if exists "bet_events read" on public.bet_events;
create policy "bet_events read" on public.bet_events for select using (auth.uid() is not null);
drop policy if exists "bet_events admin insert" on public.bet_events;
create policy "bet_events admin insert" on public.bet_events for insert with check (public.is_admin());
drop policy if exists "bet_events admin update" on public.bet_events;
create policy "bet_events admin update" on public.bet_events for update using (public.is_admin());

-- side_bets: users read own + all on settled events (transparency); insert via RPC only
drop policy if exists "side_bets read" on public.side_bets;
create policy "side_bets read" on public.side_bets for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "notif read own" on public.notifications;
create policy "notif read own" on public.notifications for select using (auth.uid() = user_id);
drop policy if exists "notif update own" on public.notifications;
create policy "notif update own" on public.notifications for update using (auth.uid() = user_id);

drop policy if exists "ledger read own" on public.wallet_ledger;
create policy "ledger read own" on public.wallet_ledger for select using (auth.uid() = user_id);

drop policy if exists "wd read own" on public.withdrawal_requests;
create policy "wd read own" on public.withdrawal_requests for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists "wd admin update" on public.withdrawal_requests;
create policy "wd admin update" on public.withdrawal_requests for update using (public.is_admin());

drop policy if exists "payout events admin read" on public.payout_events;
create policy "payout events admin read" on public.payout_events for select using (public.is_admin());

drop policy if exists "shop read own" on public.shop_purchases;
create policy "shop read own" on public.shop_purchases for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists "username hist read own" on public.username_history;
create policy "username hist read own" on public.username_history for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists "sub events admin read" on public.subscription_events;
create policy "sub events admin read" on public.subscription_events for select using (public.is_admin());

drop policy if exists "bans read" on public.user_bans;
create policy "bans read" on public.user_bans for select using (public.is_admin() or auth.uid() = user_id);

drop policy if exists "tourney rounds read" on public.tournament_rounds;
create policy "tourney rounds read" on public.tournament_rounds for select using (true);
drop policy if exists "tourney matches read" on public.tournament_matches;
create policy "tourney matches read" on public.tournament_matches for select using (true);

drop policy if exists "pay admin read" on public.payment_events;
create policy "pay admin read" on public.payment_events for select using (public.is_admin());
drop policy if exists "audit admin read" on public.audit_logs;
create policy "audit admin read" on public.audit_logs for select using (public.is_admin());
drop policy if exists "admins read" on public.app_admins;
create policy "admins read" on public.app_admins for select using (public.is_admin());

-- ============================================================================
-- RPCs — all money/state changes go through these (SECURITY DEFINER)
-- ============================================================================

-- ---------- username (see change_username in the shop section below — it is
-- token-gated, checks reserved names, and logs to username_history) ----------

-- ---------- shop: server-side catalog (single source of truth for pricing) ----------
-- Prices live in SQL so the client can never set them. Tournament entries are
-- intentionally NOT sellable here — entry always comes from the wallet at join.
create or replace function public.shop_price(p_item text)
returns numeric language sql immutable as $$
  select case p_item
    when 'username_change' then 2.99
    when 'stat_reset'      then 4.99
    when 'wagr_membership' then 4.99
    when 'double_xp_token' then 0.99
    else null
  end
$$;

create or replace function public.shop_item_name(p_item text)
returns text language sql immutable as $$
  select case p_item
    when 'username_change' then 'Username Change'
    when 'stat_reset'      then 'Stat Reset'
    when 'wagr_membership' then 'WAGR Membership'
    when 'double_xp_token' then 'Double XP Token (24hr)'
    else p_item
  end
$$;

create or replace function public.shop_item_category(p_item text)
returns text language sql immutable as $$
  select case p_item
    when 'wagr_membership' then 'membership'
    else 'account_service'
  end
$$;

-- Reserved usernames (can't be taken via change). Case-insensitive.
create or replace function public.is_reserved_username(p_name text)
returns boolean language sql immutable as $$
  select lower(p_name) = any (array[
    'admin','administrator','dubbed','support','staff','mod','moderator',
    'system','root','owner','official','help','api','null','undefined',
    'wagr','cmg','checkmate'
  ])
$$;

-- Buy any shop item with WALLET balance — account services AND memberships.
-- For memberships, a wallet purchase grants 30 days (non-recurring). Users who
-- want auto-renewal can subscribe via Stripe instead. Server checks balance,
-- debits, writes an immutable ledger row + purchase record, grants the
-- entitlement, and notifies. Stripe-checkout purchases are granted by the
-- shop webhook instead (see grant_shop_item).
create or replace function public.purchase_with_wallet(p_item text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_price numeric; v_bal numeric; v_pid uuid; v_name text; v_cat text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  v_price := public.shop_price(p_item);
  if v_price is null then raise exception 'unknown shop item'; end if;
  v_name := public.shop_item_name(p_item);
  v_cat  := public.shop_item_category(p_item);

  select balance into v_bal from public.profiles where id = auth.uid() for update;
  if v_bal < v_price then raise exception 'insufficient wallet balance'; end if;

  update public.profiles set balance = balance - v_price where id = auth.uid();
  insert into public.wallet_ledger(user_id, delta, reason) values (auth.uid(), -v_price, 'shop_' || p_item);

  insert into public.shop_purchases(user_id, item_key, item_name, category, price, payment_method, status)
    values (auth.uid(), p_item, v_name, v_cat, v_price, 'wallet', 'completed')
    returning id into v_pid;

  -- Grant the entitlement.
  if p_item = 'username_change' then
    update public.profiles set username_change_tokens = username_change_tokens + 1 where id = auth.uid();
  elsif p_item = 'wagr_membership' then
    -- Wallet-purchased membership lasts 30 days from now (non-recurring).
    -- If already a member, extend from the current end date.
    update public.profiles set
      wagr_member = true,
      subscription_status = 'active',
      subscription_provider = 'wallet',
      subscription_end = greatest(coalesce(subscription_end, now()), now()) + interval '30 days'
    where id = auth.uid();
  elsif p_item = 'double_xp_token' then
    update public.profiles set
      double_xp_active_until = greatest(coalesce(double_xp_active_until, now()), now()) + interval '24 hours'
    where id = auth.uid();
  end if;
  -- buying it just records the purchase and unlocks the action client-side.

  insert into public.notifications(user_id, text)
    values (auth.uid(), 'Purchase successful: ' || v_name || ' ($' || to_char(v_price,'FM999990.00') || ').');
  return v_pid;
end $$;

-- Consume a username-change token to actually change the name. Enforces length,
-- uniqueness, profanity, and reserved names; logs old->new to username_history.
create or replace function public.change_username(p_new text)
returns void language plpgsql security definer set search_path = public as $$
declare v_old text; v_tokens int; v_purchase uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select username, username_change_tokens into v_old, v_tokens from public.profiles where id = auth.uid() for update;
  if coalesce(v_tokens,0) < 1 then raise exception 'no username change available — buy one in the Shop'; end if;
  if char_length(p_new) < 1 or char_length(p_new) > 8 then raise exception 'username must be 1-8 characters'; end if;
  if p_new ~ '\s' then raise exception 'username cannot contain spaces'; end if;
  if public.is_reserved_username(p_new) then raise exception 'that username is reserved'; end if;
  if lower(p_new) = lower(v_old) then raise exception 'that is already your username'; end if;
  if exists (select 1 from public.profiles where username_lower = lower(p_new) and id <> auth.uid())
    then raise exception 'username taken'; end if;

  -- Tie to the most recent unconsumed username_change purchase for the audit.
  select id into v_purchase from public.shop_purchases
    where user_id = auth.uid() and item_key = 'username_change'
    order by created_at desc limit 1;

  update public.profiles
    set username = p_new, username_change_tokens = username_change_tokens - 1
    where id = auth.uid();
  insert into public.username_history(user_id, old_username, new_username, purchase_id)
    values (auth.uid(), v_old, p_new, v_purchase);
  insert into public.audit_logs(actor_id, action, target, meta)
    values (auth.uid(), 'username_change', auth.uid()::text,
            jsonb_build_object('old', v_old, 'new', p_new));
  insert into public.notifications(user_id, text)
    values (auth.uid(), 'Your username was changed to ' || p_new || '.');
end $$;

-- Perform a stat reset. Requires a completed stat_reset purchase that hasn't
-- been applied yet (tracked via meta.applied). Zeroes competitive stats but
-- KEEPS trophies, wallet, ledger, purchases, disputes, tournament & username
-- history. Records the reset and consumes the purchase.
create or replace function public.perform_stat_reset()
returns void language plpgsql security definer set search_path = public as $$
declare v_purchase uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select id into v_purchase from public.shop_purchases
    where user_id = auth.uid() and item_key = 'stat_reset' and status = 'completed'
      and coalesce((meta->>'applied')::boolean, false) = false
    order by created_at desc limit 1
    for update;
  if v_purchase is null then raise exception 'no stat reset available — buy one in the Shop'; end if;

  -- Zero XP / W-L / streak on the profile. (Win %, K/D, ELO, leaderboard and
  -- rank progress are all derived from these, so this resets them too.)
  update public.profiles
    set xp = 0, wins = 0, losses = 0, streak = 0
    where id = auth.uid();
  -- Per-game records feed win% and placements — clear them (trophies stay).
  delete from public.records where user_id = auth.uid();

  update public.shop_purchases
    set meta = coalesce(meta,'{}'::jsonb) || jsonb_build_object('applied', true, 'applied_at', now())
    where id = v_purchase;
  insert into public.audit_logs(actor_id, action, target, meta)
    values (auth.uid(), 'stat_reset', auth.uid()::text, jsonb_build_object('purchase_id', v_purchase));
  insert into public.notifications(user_id, text)
    values (auth.uid(), 'Your stats have been reset. Trophies and wallet were preserved.');
end $$;

-- Expire wallet-purchased WAGR memberships whose 30-day window has passed.
-- Run this on a schedule (pg_cron every hour, or a Supabase cron Edge Function).
-- Stripe-managed subscriptions are expired by the subscription webhook instead.
create or replace function public.expire_wallet_memberships()
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  update public.profiles
    set wagr_member = false, subscription_status = 'expired'
  where wagr_member = true
    and subscription_provider = 'wallet'
    and subscription_end is not null
    and subscription_end < now();
  get diagnostics v_count = row_count;

  -- Notify each expired member.
  insert into public.notifications(user_id, text)
    select id, 'Your WAGR Membership has expired. Premium perks were removed. Renew anytime from the Shop.'
    from public.profiles
    where subscription_status = 'expired'
      and subscription_provider = 'wallet'
      and wagr_member = false
      and not exists (
        select 1 from public.notifications n
        where n.user_id = profiles.id and n.text like '%WAGR Membership has expired%'
          and n.created_at > now() - interval '1 day'
      );
  return v_count;
end $$;

-- ---------- wallet ----------
-- Dev/test deposit (direct credit). In production, balance is credited by the
-- stripe-deposit-webhook Edge Function via deposit_from_webhook below.
create or replace function public.deposit(amount numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if amount <= 0 then raise exception 'amount must be positive'; end if;
  update public.profiles set balance = balance + amount where id = auth.uid();
  insert into public.wallet_ledger(user_id, delta, reason) values (auth.uid(), amount, 'deposit');
end $$;

-- Webhook-called deposit: service_role only, idempotent on the Stripe ref.
create or replace function public.deposit_from_webhook(p_user uuid, p_amount numeric, p_ref text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (auth.role() = 'service_role') then raise exception 'service role only'; end if;
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;
  -- Idempotency is enforced by payment_events.external_id unique constraint
  -- in the Edge Function. This RPC just does the credit.
  update public.profiles set balance = balance + p_amount where id = p_user;
  insert into public.wallet_ledger(user_id, delta, reason) values (p_user, p_amount, 'deposit');
  insert into public.notifications(user_id, text)
    values (p_user, 'Deposit of $' || to_char(p_amount,'FM999990.00') || ' added to your wallet.');
end $$;

create or replace function public.request_withdrawal_legacy_removed()
returns void language plpgsql as $$ begin raise exception 'superseded'; end $$;
-- (The real request_withdrawal is defined in the withdrawals section below with
-- full fraud checks, the pending-balance hold model, and provider metadata.)

-- ---------- withdrawals (Stripe Connect Express default; provider-agnostic) ----------
-- Withdrawable = balance, MINUS anything tied up in open obligations. This is
-- computed fresh server-side on every request; the client value is never trusted.
--   * open cash matches the user is in (entry held)      -> not withdrawable
--   * disputed matches the user is in                    -> not withdrawable
--   * pending tournament entries (upcoming)              -> not withdrawable
--   * open side bets (stake still live)                  -> already debited, but
--     kept out of withdrawable until settled to avoid clawback races
-- `profiles.balance` already had these debited on entry, so we don't subtract
-- them again — instead we block withdrawal while such obligations are unsettled
-- via `withdrawal_block_reason`, and cap the amount at the plain balance.
create or replace function public.withdrawal_block_reason(p_user uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare v_p public.profiles;
begin
  select * into v_p from public.profiles where id = p_user;
  if v_p is null then return 'account not found'; end if;
  if v_p.suspended then return 'account is suspended'; end if;
  if not coalesce(v_p.verified, false) then return 'email not verified'; end if;
  if v_p.stripe_account_id is null then return 'connect a payout account first'; end if;
  if not v_p.stripe_onboarding_complete then return 'finish payout onboarding'; end if;
  if not v_p.stripe_payouts_enabled then return 'payout account needs verification'; end if;
  if exists (
    select 1 from public.match_players mp
    join public.matches m on m.id = mp.match_id
    where mp.user_id = p_user and m.status = 'disputed'
  ) then return 'you have a match under dispute'; end if;
  if exists (
    select 1 from public.tournament_entries te
    join public.tournaments t on t.id = te.tournament_id
    where te.user_id = p_user and t.status in ('upcoming','live') and te.placed is null
  ) then return 'you have a pending tournament payout'; end if;
  if exists (select 1 from public.bets where user_id = p_user and status = 'open')
    then return 'you have unsettled side bets'; end if;
  return null; -- no block
end $$;

-- Max the user can pull right now (never negative).
create or replace function public.available_to_withdraw(p_user uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select greatest(0, coalesce((select balance from public.profiles where id = p_user), 0))
$$;

-- File a withdrawal. Moves funds balance -> pending_balance (held, not gone),
-- writes an immutable ledger row, creates the request in 'pending', notifies.
create or replace function public.request_withdrawal(p_amount numeric, p_destination text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_bal numeric; v_id uuid; v_block text; v_tx text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  perform public.check_rate_limit('withdrawal', 3, 300);  -- 3 per 5 minutes
  if p_amount is null or p_amount < 10 then raise exception 'minimum withdrawal is $10'; end if;

  v_block := public.withdrawal_block_reason(auth.uid());
  if v_block is not null then raise exception 'cannot withdraw: %', v_block; end if;

  select balance into v_bal from public.profiles where id = auth.uid() for update;
  if v_bal < p_amount then raise exception 'insufficient available balance'; end if;

  update public.profiles
    set balance = balance - p_amount, pending_balance = pending_balance + p_amount
    where id = auth.uid();
  insert into public.wallet_ledger(user_id, delta, reason) values (auth.uid(), -p_amount, 'withdrawal_hold');

  insert into public.withdrawal_requests(user_id, amount, destination, provider, status)
    values (auth.uid(), p_amount, p_destination, 'stripe', 'pending')
    returning id, transaction_id into v_id, v_tx;

  insert into public.notifications(user_id, text)
    values (auth.uid(), 'Withdrawal requested: $' || to_char(p_amount, 'FM999999990.00') || ' — track it in your Wallet.');
  return v_id;
end $$;

-- Admin moves a request pending -> processing (about to fire the payout).
create or replace function public.mark_withdrawal_processing(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_w public.withdrawal_requests;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  select * into v_w from public.withdrawal_requests where id = p_id for update;
  if not found then raise exception 'request not found'; end if;
  if v_w.status <> 'pending' then raise exception 'request is not pending'; end if;
  update public.withdrawal_requests
    set status = 'processing', processing_at = now(), reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_id;
  insert into public.notifications(user_id, text)
    values (v_w.user_id, 'Your withdrawal of $' || to_char(v_w.amount,'FM999999990.00') || ' is processing.');
end $$;

-- Mark PAID. Called by the Stripe webhook Edge Function (payout.paid) via
-- service role, or by an admin for a manually-completed payout. Idempotent on
-- the request's own status; the webhook's global idempotency is enforced by
-- payout_events.unique(provider,event_id). Clears the held pending_balance.
create or replace function public.mark_withdrawal_paid(p_id uuid, p_payout_id text, p_transfer_id text)
returns void language plpgsql security definer set search_path = public as $$
declare v_w public.withdrawal_requests;
begin
  if not (public.is_admin() or auth.role() = 'service_role') then raise exception 'not authorized'; end if;
  select * into v_w from public.withdrawal_requests where id = p_id for update;
  if not found then raise exception 'request not found'; end if;
  if v_w.status = 'paid' then return; end if;              -- idempotent
  if v_w.status = 'rejected' then raise exception 'request was rejected'; end if;

  update public.withdrawal_requests
    set status = 'paid', payout_id = coalesce(p_payout_id, payout_id),
        transfer_id = coalesce(p_transfer_id, transfer_id), completed_at = now()
    where id = p_id;
  -- Funds were already held out of balance; clear the pending mirror.
  update public.profiles set pending_balance = greatest(0, pending_balance - v_w.amount) where id = v_w.user_id;
  insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (v_w.user_id, 0, 'withdrawal_paid', v_w.id);
  insert into public.notifications(user_id, text)
    values (v_w.user_id, 'Your withdrawal of $' || to_char(v_w.amount,'FM999999990.00') || ' was paid.');
end $$;

-- Reject (admin) or auto-fail (webhook payout.failed). Restores held funds to
-- available balance and records the reason. Idempotent.
create or replace function public.reject_withdrawal(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_w public.withdrawal_requests;
begin
  if not (public.is_admin() or auth.role() = 'service_role') then raise exception 'not authorized'; end if;
  select * into v_w from public.withdrawal_requests where id = p_id for update;
  if not found then raise exception 'request not found'; end if;
  if v_w.status in ('rejected','paid') then return; end if; -- idempotent / terminal

  update public.withdrawal_requests
    set status = 'rejected', rejected_reason = coalesce(p_reason,'rejected'),
        reviewed_by = coalesce(reviewed_by, auth.uid()), reviewed_at = now(), completed_at = now()
    where id = p_id;
  -- Restore the held funds back to available.
  update public.profiles
    set balance = balance + v_w.amount, pending_balance = greatest(0, pending_balance - v_w.amount)
    where id = v_w.user_id;
  insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (v_w.user_id, v_w.amount, 'withdrawal_refund', v_w.id);
  insert into public.notifications(user_id, text)
    values (v_w.user_id, 'Your withdrawal was rejected' ||
      case when p_reason is not null and p_reason <> '' then ': ' || p_reason else '.' end ||
      ' Funds are back in your balance.');
end $$;

-- Sync Stripe Connect account status from the webhook (account.updated) or the
-- onboarding-return Edge Function. Service role or the owner's own edge call.
create or replace function public.sync_stripe_account(
  p_user uuid, p_account_id text, p_onboarding boolean, p_charges boolean,
  p_payouts boolean, p_verification text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or auth.role() = 'service_role') then raise exception 'not authorized'; end if;
  update public.profiles set
    stripe_account_id = coalesce(p_account_id, stripe_account_id),
    stripe_onboarding_complete = coalesce(p_onboarding, stripe_onboarding_complete),
    stripe_charges_enabled = coalesce(p_charges, stripe_charges_enabled),
    stripe_payouts_enabled = coalesce(p_payouts, stripe_payouts_enabled),
    stripe_verification_status = coalesce(p_verification, stripe_verification_status),
    stripe_last_verified_at = case when p_payouts then now() else stripe_last_verified_at end
    where id = p_user;
  if not coalesce(p_payouts, false) then
    insert into public.notifications(user_id, text)
      values (p_user, 'Your payout account needs verification before you can withdraw. Open your Wallet to finish.');
  end if;
end $$;

grant execute on function public.withdrawal_block_reason(uuid) to authenticated;
grant execute on function public.available_to_withdraw(uuid) to authenticated;

-- ---------- shop: Stripe-side grants (service role) ----------
-- Records + grants a Stripe-Checkout account-service purchase (idempotent on
-- the Stripe ref). Used when the user pays by card instead of wallet.
create or replace function public.grant_shop_item(p_user uuid, p_item text, p_stripe_ref text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_price numeric; v_pid uuid; v_name text; v_cat text;
begin
  if not (auth.role() = 'service_role') then raise exception 'service role only'; end if;
  if p_stripe_ref is not null and exists (select 1 from public.shop_purchases where stripe_ref = p_stripe_ref)
    then return null; end if; -- idempotent
  v_price := public.shop_price(p_item);
  if v_price is null then raise exception 'unknown shop item'; end if;
  v_name := public.shop_item_name(p_item);
  v_cat  := public.shop_item_category(p_item);

  insert into public.shop_purchases(user_id, item_key, item_name, category, price, payment_method, status, stripe_ref)
    values (p_user, p_item, v_name, v_cat, v_price, 'stripe', 'completed', p_stripe_ref)
    returning id into v_pid;

  if p_item = 'username_change' then
    update public.profiles set username_change_tokens = username_change_tokens + 1 where id = p_user;
  end if;

  insert into public.notifications(user_id, text)
    values (p_user, 'Purchase successful: ' || v_name || '.');
  return v_pid;
end $$;

-- Sync WAGR membership from a Stripe subscription webhook. When active, sets
-- the badge + perks; when canceled/expired, removes them WITHOUT touching
-- anything else (balance, stats, trophies untouched).
create or replace function public.sync_subscription(
  p_user uuid, p_status text, p_subscription_id text, p_current_period_end timestamptz
) returns void language plpgsql security definer set search_path = public as $$
declare v_active boolean; v_was boolean;
begin
  if not (auth.role() = 'service_role' or public.is_admin()) then raise exception 'not authorized'; end if;
  v_active := p_status in ('active','trialing');
  select wagr_member into v_was from public.profiles where id = p_user;

  update public.profiles set
    wagr_member = v_active,
    subscription_status = p_status,
    subscription_provider = 'stripe',
    subscription_id = coalesce(p_subscription_id, subscription_id),
    subscription_end = p_current_period_end
    where id = p_user;

  if v_active and not coalesce(v_was,false) then
    insert into public.notifications(user_id, text) values (p_user, 'WAGR Membership activated. No-fee wagers and perks are live.');
  elsif v_active and coalesce(v_was,false) then
    insert into public.notifications(user_id, text) values (p_user, 'WAGR Membership renewed. $1.00 added to your wallet.');
    -- $1.00 monthly top-up perk
    update public.profiles set balance = balance + 1.00 where id = p_user;
    insert into public.wallet_ledger(user_id, delta, reason) values (p_user, 1.00, 'wagr_monthly_topup');
  elsif not v_active and coalesce(v_was,false) then
    insert into public.notifications(user_id, text) values (p_user, 'Your WAGR Membership has ended. Premium perks were removed.');
  end if;
end $$;

create or replace function public.record_subscription_event(
  p_event_id text, p_event_type text, p_user uuid, p_payload jsonb
) returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not (auth.role() = 'service_role') then raise exception 'service role only'; end if;
  insert into public.subscription_events(provider, event_id, event_type, user_id, payload)
    values ('stripe', p_event_id, p_event_type, p_user, p_payload);
  return true;
exception when unique_violation then
  return false;
end $$;

-- ---------- shop: admin ----------
create or replace function public.admin_list_shop_purchases(p_category text default null)
returns table (
  id uuid, user_id uuid, username text, item_key text, item_name text, category text,
  price numeric, payment_method text, status text, transaction_id text, stripe_ref text, created_at timestamptz
) language sql stable security definer set search_path = public as $$
  select s.id, s.user_id, p.username, s.item_key, s.item_name, s.category,
         s.price, s.payment_method, s.status, s.transaction_id, s.stripe_ref, s.created_at
  from public.shop_purchases s
  join public.profiles p on p.id = s.user_id
  where public.is_admin()
    and (p_category is null or s.category = p_category)
  order by s.created_at desc
$$;

-- Revenue + subscription analytics for the admin dashboard, one call.
create or replace function public.admin_shop_stats()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then jsonb_build_object(
    'revenue_total', coalesce((select sum(price) from public.shop_purchases where status = 'completed'),0),
    'revenue_memberships', coalesce((select sum(price) from public.shop_purchases where status='completed' and category='membership'),0),
    'revenue_services', coalesce((select sum(price) from public.shop_purchases where status='completed' and category='account_service'),0),
    'purchases_count', (select count(*) from public.shop_purchases where status='completed'),
    'username_changes', (select count(*) from public.shop_purchases where item_key='username_change' and status='completed'),
    'stat_resets', (select count(*) from public.shop_purchases where item_key='stat_reset' and status='completed'),
    'active_members', (select count(*) from public.profiles where wagr_member = true),
    'refunds', (select count(*) from public.shop_purchases where status='refunded')
  ) else null end
$$;

-- Admin refund: refunds a WALLET purchase back to balance, reverses the
-- entitlement where sensible, and marks the purchase refunded. (Stripe-paid
-- purchases are refunded in the Stripe dashboard; this handles the ledger.)
create or replace function public.admin_refund_purchase(p_purchase uuid, p_to_wallet boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_p public.shop_purchases;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  select * into v_p from public.shop_purchases where id = p_purchase for update;
  if not found then raise exception 'purchase not found'; end if;
  if v_p.status = 'refunded' then return; end if;

  if p_to_wallet then
    update public.profiles set balance = balance + v_p.price where id = v_p.user_id;
    insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (v_p.user_id, v_p.price, 'shop_refund', v_p.id);
  end if;
  -- Pull back an unused username-change token if this was that purchase.
  if v_p.item_key = 'username_change' then
    update public.profiles set username_change_tokens = greatest(0, username_change_tokens - 1) where id = v_p.user_id;
  end if;

  update public.shop_purchases set status = 'refunded' where id = p_purchase;
  insert into public.audit_logs(actor_id, action, target, meta)
    values (auth.uid(), 'shop_refund', v_p.user_id::text, jsonb_build_object('purchase_id', v_p.id, 'to_wallet', p_to_wallet));
  insert into public.notifications(user_id, text)
    values (v_p.user_id, 'Your purchase of ' || v_p.item_name || ' was refunded' || case when p_to_wallet then ' to your wallet.' else '.' end);
end $$;

-- Admin-only; RLS on the base table already restricts non-admins, but this
-- shapes the exact fields the admin dashboard needs in one call.
create or replace function public.admin_list_withdrawals(p_status text default null)
returns table (
  id uuid, user_id uuid, username text, amount numeric, status withdrawal_status,
  provider text, destination text, payout_id text, transaction_id text,
  rejected_reason text, created_at timestamptz, processing_at timestamptz, completed_at timestamptz,
  stripe_account_id text, stripe_payouts_enabled boolean, stripe_verification_status text, suspended boolean
) language sql stable security definer set search_path = public as $$
  select w.id, w.user_id, p.username, w.amount, w.status, w.provider, w.destination,
         w.payout_id, w.transaction_id, w.rejected_reason, w.created_at, w.processing_at, w.completed_at,
         p.stripe_account_id, p.stripe_payouts_enabled, p.stripe_verification_status, p.suspended
  from public.withdrawal_requests w
  join public.profiles p on p.id = w.user_id
  where public.is_admin()
    and (p_status is null or w.status::text = p_status)
  order by w.created_at desc
$$;

-- Service-role variant of mark processing: the payout Edge Function runs as
-- service_role (no auth.uid()), so it passes the acting admin id explicitly.
create or replace function public.mark_withdrawal_processing_admin(p_id uuid, p_admin uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_w public.withdrawal_requests;
begin
  if not (auth.role() = 'service_role' or public.is_admin()) then raise exception 'not authorized'; end if;
  if not exists (select 1 from public.app_admins where user_id = p_admin) then raise exception 'acting user is not an admin'; end if;
  select * into v_w from public.withdrawal_requests where id = p_id for update;
  if not found then raise exception 'request not found'; end if;
  if v_w.status <> 'pending' then return; end if;
  update public.withdrawal_requests
    set status = 'processing', processing_at = now(), reviewed_by = p_admin, reviewed_at = now()
    where id = p_id;
  insert into public.notifications(user_id, text)
    values (v_w.user_id, 'Your withdrawal of $' || to_char(v_w.amount,'FM999999990.00') || ' is processing.');
end $$;

-- Idempotent webhook sink. Records the provider event once (unique on
-- provider+event_id); returns true if this is the first time we've seen it.
create or replace function public.record_payout_event(
  p_provider text, p_event_id text, p_event_type text, p_withdrawal uuid, p_payload jsonb
) returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not (auth.role() = 'service_role') then raise exception 'service role only'; end if;
  insert into public.payout_events(provider, event_id, event_type, withdrawal_id, payload)
    values (p_provider, p_event_id, p_event_type, p_withdrawal, p_payload);
  return true;
exception when unique_violation then
  return false; -- already processed
end $$;

-- Look up a withdrawal by its Stripe transfer or payout id (webhook helper).
create or replace function public.withdrawal_by_ref(p_transfer text, p_payout text)
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.withdrawal_requests
  where (p_transfer is not null and transfer_id = p_transfer)
     or (p_payout is not null and payout_id = p_payout)
  limit 1
$$;

-- ---------- bets ----------
create or replace function public.place_bet(p_target text, p_market bet_market, p_stake numeric, p_odds numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_bal numeric; v_id uuid;
begin
  perform public.check_not_banned();
  if p_stake <= 0 then raise exception 'stake must be positive'; end if;
  select balance into v_bal from public.profiles where id = auth.uid() for update;
  if v_bal < p_stake then raise exception 'insufficient balance'; end if;
  update public.profiles set balance = balance - p_stake where id = auth.uid();
  insert into public.wallet_ledger(user_id, delta, reason) values (auth.uid(), -p_stake, 'bet');
  insert into public.bets(user_id, target, market, stake, odds)
    values (auth.uid(), p_target, p_market, p_stake, p_odds) returning id into v_id;
  return v_id;
end $$;

-- ---------- ban system ----------
-- Reusable guard — add to the top of any RPC that banned users shouldn't call.
create or replace function public.check_not_banned()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if exists (select 1 from public.profiles where id = auth.uid() and banned = true) then
    raise exception 'Your account is banned. You cannot perform this action.';
  end if;
end $$;

create or replace function public.admin_ban_user(p_user_id uuid, p_reason text, p_duration text)
returns void language plpgsql security definer set search_path = public as $$
declare v_expires timestamptz;
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  if p_user_id = auth.uid() then raise exception 'Cannot ban yourself'; end if;
  v_expires := case p_duration
    when '24h' then now() + interval '24 hours'
    when '7d'  then now() + interval '7 days'
    when '30d' then now() + interval '30 days'
    when 'permanent' then null
    else null end;
  -- Deactivate previous active bans
  update public.user_bans set active = false where user_id = p_user_id and active = true;
  insert into public.user_bans (user_id, banned_by, reason, duration, expires_at)
    values (p_user_id, auth.uid(), p_reason, p_duration, v_expires);
  update public.profiles set banned = true, ban_reason = p_reason, ban_expires_at = v_expires, suspended = true
    where id = p_user_id;
  -- Cancel open matches
  update public.matches set status = 'cancelled' where created_by = p_user_id and status = 'open';
  insert into public.audit_logs(actor_id, action, target, meta)
    values (auth.uid(), 'ban_user', p_user_id::text,
      jsonb_build_object('reason', p_reason, 'duration', p_duration, 'expires_at', v_expires));
  insert into public.notifications(user_id, text)
    values (p_user_id, 'Your account has been banned: ' || p_reason || '. Duration: ' || p_duration || '.');
end $$;

create or replace function public.admin_unban_user(p_user_id uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  update public.user_bans set active = false, unbanned_by = auth.uid(), unbanned_at = now(), unban_note = p_note
    where user_id = p_user_id and active = true;
  update public.profiles set banned = false, ban_reason = null, ban_expires_at = null, suspended = false
    where id = p_user_id;
  insert into public.audit_logs(actor_id, action, target, meta)
    values (auth.uid(), 'unban_user', p_user_id::text, jsonb_build_object('note', p_note));
  insert into public.notifications(user_id, text)
    values (p_user_id, 'Your account ban has been lifted.' || coalesce(' Note: ' || p_note, ''));
end $$;

create or replace function public.admin_list_bans(p_active_only boolean default true)
returns table (
  id uuid, user_id uuid, username text, reason text, duration text,
  expires_at timestamptz, active boolean, banned_by_name text,
  created_at timestamptz, unbanned_at timestamptz, unban_note text
) language sql stable security definer set search_path = public as $$
  select b.id, b.user_id, p.username, b.reason, b.duration,
    b.expires_at, b.active, bp.username as banned_by_name,
    b.created_at, b.unbanned_at, b.unban_note
  from public.user_bans b
  join public.profiles p on p.id = b.user_id
  left join public.profiles bp on bp.id = b.banned_by
  where public.is_admin() and (not p_active_only or b.active = true)
  order by b.created_at desc
$$;

create or replace function public.check_ban_expiry()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.user_bans set active = false, unban_note = 'auto-expired'
    where active = true and expires_at is not null and expires_at < now();
  update public.profiles set banned = false, ban_reason = null, ban_expires_at = null, suspended = false
    where banned = true and ban_expires_at is not null and ban_expires_at < now();
end $$;
grant execute on function public.check_ban_expiry() to authenticated;

-- ---------- tournament bracket ----------
-- Generate a seeded single-elimination bracket from the entries.
create or replace function public.generate_bracket(p_tournament uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_t public.tournaments; v_count int; v_bracket int; v_rounds int; v_round_id uuid;
  v_seed_a int; v_seed_b int; v_ea record; v_eb record; v_is_bye boolean; v_mn int;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  select * into v_t from public.tournaments where id = p_tournament for update;
  if v_t.status <> 'upcoming' then raise exception 'tournament already started'; end if;
  if v_t.bracket_generated then raise exception 'bracket already generated'; end if;
  select count(*) into v_count from public.tournament_entries where tournament_id = p_tournament;
  if v_count < 2 then raise exception 'need at least 2 entries'; end if;

  -- Round up to next power of 2
  v_bracket := 1;
  while v_bracket < v_count loop v_bracket := v_bracket * 2; end loop;
  v_rounds := 0;
  declare v_tmp int := v_bracket; begin
    while v_tmp > 1 loop v_rounds := v_rounds + 1; v_tmp := v_tmp / 2; end loop;
  end;

  -- Stable random seeding (one pass)
  create temp table _seeds on commit drop as
    select entrant_name, user_id, row_number() over (order by random()) as seed
    from public.tournament_entries where tournament_id = p_tournament;

  -- Round 1
  insert into public.tournament_rounds(tournament_id, round_number, round_name, series_format)
    values (p_tournament, 1,
      case v_rounds when 1 then 'Grand Final' when 2 then 'Semifinals' else 'Round 1' end,
      v_t.series)
    returning id into v_round_id;

  v_mn := 0;
  for v_seed_a in 1..(v_bracket / 2) loop
    v_seed_b := v_bracket + 1 - v_seed_a;
    v_is_bye := v_seed_b > v_count;
    select entrant_name, user_id into v_ea from _seeds where seed = v_seed_a;
    if not v_is_bye then select entrant_name, user_id into v_eb from _seeds where seed = v_seed_b; end if;
    v_mn := v_mn + 1;
    insert into public.tournament_matches(tournament_id, round_id, match_number, seed_a, seed_b,
      entrant_a, entrant_b, user_a, user_b, status, winner_entrant, winner_user)
      values (p_tournament, v_round_id, v_mn, v_seed_a, v_seed_b,
        v_ea.entrant_name,
        case when v_is_bye then null else v_eb.entrant_name end,
        v_ea.user_id,
        case when v_is_bye then null else v_eb.user_id end,
        case when v_is_bye then 'bye' else 'ready' end,
        case when v_is_bye then v_ea.entrant_name else null end,
        case when v_is_bye then v_ea.user_id else null end);
  end loop;

  -- Future rounds (empty placeholders)
  for v_mn in 2..v_rounds loop
    insert into public.tournament_rounds(tournament_id, round_number, round_name, series_format)
      values (p_tournament, v_mn,
        case when v_mn = v_rounds then 'Grand Final' when v_mn = v_rounds-1 then 'Semifinals'
             when v_mn = v_rounds-2 then 'Quarterfinals' else 'Round ' || v_mn end,
        case when v_mn = v_rounds then 'Best of 5' when v_mn >= v_rounds-1 then 'Best of 3' else v_t.series end);
  end loop;

  update public.tournaments set status='live', bracket_generated=true, current_round=1, total_rounds=v_rounds
    where id = p_tournament;
end $$;

-- Create a real match room for a bracket match.
create or replace function public.start_tournament_match(p_tm_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_tm public.tournament_matches; v_t public.tournaments; v_mid uuid; v_code text;
begin
  select * into v_tm from public.tournament_matches where id = p_tm_id for update;
  if not found then raise exception 'bracket match not found'; end if;
  if v_tm.status <> 'ready' then raise exception 'match not ready'; end if;
  if v_tm.match_id is not null then return v_tm.match_id; end if;
  select * into v_t from public.tournaments where id = v_tm.tournament_id;
  v_code := 'T-' || substr(v_tm.id::text, 1, 6);
  insert into public.matches(code, game, mode, format, region, entry, kind, status, created_by,
    platform, skill_tier, series, weapon_restriction, host_rule)
    values (v_code, v_t.game, v_t.mode, v_t.format, v_t.region, 0, 'xp', 'live',
      v_tm.user_a, coalesce(v_t.platform,'PC + Console Mixed'), coalesce(v_t.skill_tier,'Open'),
      coalesce(v_t.series,'Best of 1'), v_t.weapon_restriction, coalesce(v_t.host_rule,'auto'))
    returning id into v_mid;
  insert into public.match_players(match_id, user_id, region)
    values (v_mid, v_tm.user_a, coalesce((select region from public.profiles where id=v_tm.user_a),'NA'));
  insert into public.match_players(match_id, user_id, region)
    values (v_mid, v_tm.user_b, coalesce((select region from public.profiles where id=v_tm.user_b),'NA'));
  update public.tournament_matches set match_id = v_mid, status = 'live' where id = p_tm_id;
  insert into public.notifications(user_id, text) values
    (v_tm.user_a, 'Your ' || v_t.name || ' match is ready! Join the lobby.'),
    (v_tm.user_b, 'Your ' || v_t.name || ' match is ready! Join the lobby.');
  return v_mid;
end $$;

-- Advance the bracket after a match settles.
create or replace function public.advance_bracket(p_tm_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_tm public.tournament_matches; v_t public.tournaments; v_m public.matches;
  v_round public.tournament_rounds; v_done boolean; v_next_round_id uuid;
  v_next int; v_we text; v_wu uuid; v_le text; v_mn int; v_w1 record; v_w2 record; v_i int;
begin
  select * into v_tm from public.tournament_matches where id = p_tm_id for update;
  if v_tm.status = 'completed' then return; end if;
  select * into v_m from public.matches where id = v_tm.match_id;
  if v_m.winner_id is null then raise exception 'match has no winner'; end if;
  if v_m.winner_id = v_tm.user_a then v_we := v_tm.entrant_a; v_wu := v_tm.user_a; v_le := v_tm.entrant_b;
  else v_we := v_tm.entrant_b; v_wu := v_tm.user_b; v_le := v_tm.entrant_a; end if;
  update public.tournament_matches set status='completed', winner_entrant=v_we, winner_user=v_wu where id=p_tm_id;

  select * into v_t from public.tournaments where id = v_tm.tournament_id;
  select * into v_round from public.tournament_rounds where id = v_tm.round_id;
  select not exists (select 1 from public.tournament_matches where round_id=v_round.id and status not in ('completed','bye'))
    into v_done;
  if not v_done then return; end if;

  v_next := v_round.round_number + 1;
  if v_next > v_t.total_rounds then
    -- Final done — settle tournament
    declare v_fl text; v_third text; begin
      v_fl := case when v_we = v_tm.entrant_a then v_tm.entrant_b else v_tm.entrant_a end;
      select case when tm2.winner_entrant=tm2.entrant_a then tm2.entrant_b else tm2.entrant_a end into v_third
        from public.tournament_matches tm2 join public.tournament_rounds tr2 on tr2.id=tm2.round_id
        where tm2.tournament_id=v_t.id and tr2.round_number=v_t.total_rounds-1 and tm2.status='completed'
        order by tm2.match_number limit 1;
      perform public.settle_tournament(v_t.id, v_we, v_fl, coalesce(v_third, v_fl));
    end;
    return;
  end if;

  select id into v_next_round_id from public.tournament_rounds
    where tournament_id=v_t.id and round_number=v_next;
  v_mn := 0;
  for v_i in 1..(select count(*) from public.tournament_matches where round_id=v_round.id) / 2 loop
    select winner_entrant, winner_user into v_w1 from public.tournament_matches
      where round_id=v_round.id and match_number=(v_i-1)*2+1;
    select winner_entrant, winner_user into v_w2 from public.tournament_matches
      where round_id=v_round.id and match_number=(v_i-1)*2+2;
    v_mn := v_mn + 1;
    insert into public.tournament_matches(tournament_id, round_id, match_number, entrant_a, entrant_b, user_a, user_b, status)
      values (v_t.id, v_next_round_id, v_mn, v_w1.winner_entrant, v_w2.winner_entrant, v_w1.winner_user, v_w2.winner_user, 'ready');
    insert into public.notifications(user_id, text) values
      (v_w1.winner_user, 'You advanced! Next match in ' || v_t.name || ' is ready.'),
      (v_w2.winner_user, 'You advanced! Next match in ' || v_t.name || ' is ready.');
  end loop;
  update public.tournaments set current_round = v_next where id = v_t.id;
end $$;

grant execute on function public.generate_bracket(uuid) to authenticated;
grant execute on function public.start_tournament_match(uuid) to authenticated;
grant execute on function public.advance_bracket(uuid) to authenticated;

-- ---------- admin dispute resolution ----------
create or replace function public.admin_settle_dispute(p_match uuid, p_winner uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_tm_id uuid;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  perform public.settle_match_admin(p_match, p_winner, coalesce(p_note, 'Admin dispute resolution'));
  update public.match_disputes set status='resolved', resolved_by=auth.uid(), resolved_at=now(), resolution_note=p_note
    where match_id=p_match and status='open';
  select id into v_tm_id from public.tournament_matches where match_id=p_match limit 1;
  if v_tm_id is not null then perform public.advance_bracket(v_tm_id); end if;
  insert into public.notifications(user_id, text)
    select user_id, 'Your disputed match has been resolved by an admin. Check the match room.'
    from public.match_players where match_id=p_match;
end $$;

create or replace function public.admin_cancel_dispute(p_match uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_entry numeric; v_pid uuid;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  select entry into v_entry from public.matches where id=p_match;
  update public.matches set status='cancelled', winner_id=null where id=p_match;
  for v_pid in select user_id from public.match_players where match_id=p_match loop
    if coalesce(v_entry,0) > 0 then
      update public.profiles set balance=balance+v_entry where id=v_pid;
      insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (v_pid, v_entry, 'match_cancel_refund', p_match);
    end if;
  end loop;
  update public.match_disputes set status='resolved', resolved_by=auth.uid(), resolved_at=now(),
    resolution_note=coalesce(p_note, 'Match cancelled by admin — both refunded')
    where match_id=p_match and status='open';
  insert into public.audit_logs(actor_id, action, target, meta)
    values (auth.uid(), 'admin_cancel_dispute', p_match::text, jsonb_build_object('note', p_note));
end $$;

create or replace function public.admin_list_disputes(p_status text default 'open')
returns table (
  dispute_id uuid, match_id uuid, match_code text, game text, mode text, format text,
  player_a_id uuid, player_a_name text, player_b_id uuid, player_b_name text,
  dispute_reason text, dispute_evidence text, dispute_by_name text,
  tournament_name text, created_at timestamptz, status text
) language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  return query
    select d.id, m.id, m.code, m.game, m.mode, m.format,
      (select user_id from public.match_players where match_id=m.id order by joined_at limit 1),
      (select username from public.profiles where id=(select user_id from public.match_players where match_id=m.id order by joined_at limit 1)),
      (select user_id from public.match_players where match_id=m.id order by joined_at desc limit 1),
      (select username from public.profiles where id=(select user_id from public.match_players where match_id=m.id order by joined_at desc limit 1)),
      d.reason, d.evidence_url,
      (select username from public.profiles where id=d.opened_by),
      (select t.name from public.tournament_matches tm join public.tournaments t on t.id=tm.tournament_id where tm.match_id=m.id limit 1),
      d.created_at, d.status::text
    from public.match_disputes d
    join public.matches m on m.id=d.match_id
    where (p_status = 'all' or d.status::text = p_status)
    order by d.created_at desc;
end $$;

grant execute on function public.admin_settle_dispute(uuid, uuid, text) to authenticated;
grant execute on function public.admin_cancel_dispute(uuid, text) to authenticated;
grant execute on function public.admin_list_disputes(text) to authenticated;

-- Admin creates a tournament from the UI.
create or replace function public.admin_create_tournament(
  p_name text, p_game text, p_mode text, p_format text, p_series text,
  p_region text, p_entry numeric, p_capacity integer, p_platform text,
  p_skill_tier text, p_starts_at timestamptz,
  p_weapon_restriction text default null, p_host_rule text default 'auto'
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if p_region not in ('NA','EU','NA + EU') then raise exception 'Invalid region'; end if;
  insert into public.tournaments(name, game, mode, format, series, region, entry, capacity, platform,
    skill_tier, starts_at, weapon_restriction, host_rule, status)
    values (p_name, p_game, p_mode, p_format, p_series, p_region, p_entry, p_capacity, p_platform,
      p_skill_tier, p_starts_at, p_weapon_restriction, p_host_rule, 'upcoming')
    returning id into v_id;
  insert into public.audit_logs(actor_id, action, target, meta)
    values (auth.uid(), 'create_tournament', v_id::text,
      jsonb_build_object('name', p_name, 'region', p_region, 'entry', p_entry));
  return v_id;
end $$;
grant execute on function public.admin_create_tournament(text,text,text,text,text,text,numeric,integer,text,text,timestamptz,text,text) to authenticated;

-- ---------- match rule helpers ----------
create or replace function public.team_size(p_format text)
returns int language sql immutable as $$
  select case p_format when '1v1' then 1 when '2v2' then 2 when '3v3' then 3 when '4v4' then 4 else 1 end
$$;

-- Battle-royale titles cap at 2v2 — Warzone/Black Ops Royale never allow 3v3/4v4.
create or replace function public.format_allowed(p_game text, p_format text)
returns boolean language sql immutable as $$
  select case
    when p_game in ('Warzone','Black Ops Royale') then p_format in ('1v1','2v2')
    else p_format in ('1v1','2v2','3v3','4v4')
  end
$$;

-- Only the CDL map-and-mode games (BO7's SND/Hardpoint/Overload) run a veto.
create or replace function public.mode_needs_veto(p_mode text)
returns boolean language sql immutable as $$
  select p_mode in ('Search & Destroy','Hardpoint','Overload')
$$;

create or replace function public.maps_for_mode(p_mode text)
returns jsonb language sql immutable as $$
  select case when public.mode_needs_veto(p_mode)
    then '["Den","Raid","Scar","Gridlock","Hacienda","Vault","Skyline"]'::jsonb
    else '[]'::jsonb end
$$;

create or replace function public.maps_needed(p_series text)
returns int language sql immutable as $$
  select case p_series when 'Best of 3' then 3 else 1 end
$$;

-- Resolves the required host region for a lobby given who's actually in it.
-- NA Only / EU Only lobbies always host in their own region. NA + EU lobbies
-- host wherever there are more players; ties fall back to p_host_rule
-- ('NA' | 'EU') or a random pick when the rule itself is 'auto'.
create or replace function public.resolve_host(p_match uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_m public.matches; v_na int; v_eu int;
begin
  select * into v_m from public.matches where id = p_match;
  if v_m.region = 'NA' then return 'NA'; end if;
  if v_m.region = 'EU' then return 'EU'; end if;
  select count(*) filter (where region = 'NA'), count(*) filter (where region = 'EU')
    into v_na, v_eu
  from public.match_players where match_id = p_match;
  if v_na > v_eu then return 'NA'; end if;
  if v_eu > v_na then return 'EU'; end if;
  if v_m.host_rule in ('NA','EU') then return v_m.host_rule; end if;
  return case when random() < 0.5 then 'NA' else 'EU' end;
end $$;

-- ---------- migration: activision_id column ----------
alter table public.profiles add column if not exists activision_id text default '';

-- ---------- can_play gate ----------
-- Full eligibility check: team + linked account + platform (WWII split).
-- p_platform / p_type are optional — when NULL, checks for ANY matching team.
-- Returns NULL when eligible, or a human reason string when blocked.
create or replace function public.can_play(
  p_user uuid, p_game text,
  p_platform text default null, p_type text default null
) returns text language plpgsql stable security definer set search_path = public as $$
declare
  v_act text; v_psn text; v_xbox text;
  v_needs_activision boolean;
  v_is_wwii boolean;
  v_team_platform text;
begin
  v_is_wwii := p_game = 'Call of Duty: WWII';
  v_needs_activision := p_game in (
    'Call of Duty: Black Ops 7', 'Warzone', 'Black Ops Royale',
    'Call of Duty: Modern Warfare 4'
  );

  -- 1. Team check (game + type + platform for WWII)
  if v_is_wwii then
    if not exists (
      select 1 from public.team_members tm
      join public.teams t on t.id = tm.team_id
      where tm.user_id = p_user and t.game = p_game
        and (p_type is null or t.type::text = p_type)
        and (p_platform is null or t.platform = p_platform)
    ) then
      if p_platform is not null then
        return 'Create a ' || p_platform || ' team for WWII first';
      end if;
      return 'Create a team for ' || p_game || ' first';
    end if;

    -- For WWII, get the team's platform to check the right linked account
    select t.platform into v_team_platform
    from public.team_members tm
    join public.teams t on t.id = tm.team_id
    where tm.user_id = p_user and t.game = p_game
      and (p_type is null or t.type::text = p_type)
      and (p_platform is null or t.platform = p_platform)
    limit 1;

    select coalesce(psn, ''), coalesce(xbox, '') into v_psn, v_xbox
    from public.profiles where id = p_user;

    if v_team_platform = 'PlayStation Only' and v_psn = '' then
      return 'Link your PSN account to play WWII on PlayStation';
    elsif v_team_platform = 'Xbox Only' and v_xbox = '' then
      return 'Link your Xbox account to play WWII on Xbox';
    elsif v_psn = '' and v_xbox = '' then
      return 'Link an Xbox or PSN account to play ' || p_game;
    end if;
  else
    -- Non-WWII: just game + type
    if not exists (
      select 1 from public.team_members tm
      join public.teams t on t.id = tm.team_id
      where tm.user_id = p_user and t.game = p_game
        and (p_type is null or t.type::text = p_type)
    ) then
      return 'Create a team for ' || p_game || ' first';
    end if;

    -- Activision ID check for current-gen titles
    if v_needs_activision then
      select coalesce(activision_id, '') into v_act from public.profiles where id = p_user;
      if v_act = '' or v_act !~ '^\S+#\d{4,10}$' then
        return 'Link your Activision ID to play ' || p_game;
      end if;
    end if;
  end if;

  return null; -- eligible
end $$;

-- Backward-compat wrapper: existing calls use can_play_game(user, game).
create or replace function public.can_play_game(p_user uuid, p_game text)
returns text language plpgsql stable security definer set search_path = public as $$
begin
  return public.can_play(p_user, p_game);
end $$;

-- ---------- chat: purge + rate-limited send ----------
-- Purge global-channel messages older than 3 hours.
-- Schedule via pg_cron: SELECT cron.schedule('purge-chat','0 */1 * * *','select public.purge_old_chat()');
create or replace function public.purge_old_chat()
returns void language sql security definer set search_path = public as $$
  delete from public.chat_messages
  where channel in ('global','lfg','betting')
    and created_at < now() - interval '3 hours';
$$;

-- Rate-limited chat send: max 5 messages per 10s per user.
create or replace function public.send_chat_message(p_channel chat_channel, p_text text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid; v_name text; v_clean text; v_count int; v_id uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then raise exception 'not authenticated'; end if;
  perform public.check_not_banned();

  -- rate limit: 5 messages in 10 seconds
  select count(*) into v_count from public.chat_messages
  where user_id = v_uid and created_at > now() - interval '10 seconds';
  if v_count >= 5 then raise exception 'Slow down — wait a few seconds'; end if;

  -- sanitize + length cap (400 chars)
  v_clean := trim(left(regexp_replace(p_text, '[\x00-\x08\x0B\x0C\x0E-\x1F]', '', 'g'), 400));
  if v_clean = '' then raise exception 'Message is empty'; end if;

  select username into v_name from public.profiles where id = v_uid;
  insert into public.chat_messages(channel, user_id, username, text, kind)
    values (p_channel, v_uid, v_name, v_clean, 'msg')
    returning id into v_id;
  return v_id;
end $$;

-- ---------- matches ----------
create or replace function public.create_match(
  p_game text, p_mode text, p_format text, p_region text, p_entry numeric, p_kind match_kind,
  p_platform text default 'PC + Console Mixed', p_skill_tier text default 'Open',
  p_series text default 'Best of 1', p_weapon_restriction text default null,
  p_host_rule text default 'auto', p_team_id uuid default null
) returns matches language plpgsql security definer set search_path = public as $$
declare v_code text; v_match public.matches; v_bal numeric; v_xp int; v_region text; v_gate text;
        v_team public.teams; v_team_name text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  perform public.check_not_banned();
  perform public.check_rate_limit('create_match', 5, 60);

  -- Resolve team: if not passed, pick the user's first matching team
  if p_team_id is not null then
    select * into v_team from public.teams where id = p_team_id;
    if not found then raise exception 'team not found'; end if;
    if not exists (select 1 from public.team_members where team_id = p_team_id and user_id = auth.uid()) then
      raise exception 'you are not on this team';
    end if;
  else
    select t.* into v_team from public.team_members tm
    join public.teams t on t.id = tm.team_id
    where tm.user_id = auth.uid() and t.game = p_game
      and t.type::text = p_kind::text
    limit 1;
  end if;

  -- Full eligibility gate (team + linked account + platform for WWII)
  v_gate := public.can_play(auth.uid(), p_game, p_platform, p_kind::text);
  if v_gate is not null then raise exception '%', v_gate; end if;

  if not public.format_allowed(p_game, p_format) then
    raise exception '% only supports 1v1/2v2 lobbies', p_game;
  end if;
  if p_skill_tier = 'Rookie Only' then
    select xp into v_xp from public.profiles where id = auth.uid();
    if coalesce(v_xp,0) >= 25000 then raise exception 'Rookie Only lobbies require Rookie rank (under 25,000 XP)'; end if;
  end if;

  -- WWII: force platform from team
  if p_game = 'Call of Duty: WWII' and v_team.id is not null then
    p_platform := v_team.platform;
  end if;

  v_team_name := v_team.name;

  loop
    v_code := 'DUB-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    exit when not exists (select 1 from public.matches where code = v_code);
  end loop;
  if p_kind = 'cash' then
    if p_entry <= 0 then raise exception 'cash match needs a positive entry'; end if;
    select balance into v_bal from public.profiles where id = auth.uid() for update;
    if v_bal < p_entry then raise exception 'insufficient balance'; end if;
    update public.profiles set balance = balance - p_entry where id = auth.uid();
    insert into public.wallet_ledger(user_id, delta, reason) values (auth.uid(), -p_entry, 'match_entry');
  end if;
  insert into public.matches(code, game, mode, format, region, entry, kind, status, created_by,
                              platform, skill_tier, series, weapon_restriction, host_rule)
    values (v_code, p_game, p_mode, p_format, p_region,
            case when p_kind='cash' then p_entry else 0 end, p_kind, 'open', auth.uid(),
            p_platform, p_skill_tier, p_series, nullif(p_weapon_restriction,'None'), coalesce(p_host_rule,'auto'))
    returning * into v_match;
  select region into v_region from public.profiles where id = auth.uid();
  insert into public.match_players(match_id, user_id, region, team_id, team_name)
    values (v_match.id, auth.uid(), coalesce(v_region,'NA'), v_team.id, v_team_name);
  return v_match;
end $$;

create or replace function public.join_match(p_match uuid, p_team_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_m public.matches; v_bal numeric; v_xp int; v_region text; v_players int; v_needed int;
        v_pool jsonb; v_gate text; v_team public.teams; v_team_name text;
begin
  perform public.check_not_banned();
  perform public.check_rate_limit('join_match', 10, 60);
  select * into v_m from public.matches where id = p_match for update;
  if not found then raise exception 'match not found'; end if;
  if v_m.status <> 'open' then raise exception 'match is not open'; end if;

  -- Resolve team
  if p_team_id is not null then
    select * into v_team from public.teams where id = p_team_id;
    if not found then raise exception 'team not found'; end if;
  else
    select t.* into v_team from public.team_members tm
    join public.teams t on t.id = tm.team_id
    where tm.user_id = auth.uid() and t.game = v_m.game
      and t.type::text = v_m.kind::text
    limit 1;
  end if;

  v_gate := public.can_play(auth.uid(), v_m.game, v_m.platform, v_m.kind::text);
  if v_gate is not null then raise exception '%', v_gate; end if;

  -- WWII platform must match the match
  if v_m.game = 'Call of Duty: WWII' and v_team.id is not null
     and v_team.platform <> v_m.platform then
    raise exception 'Your team is % but this match is %', v_team.platform, v_m.platform;
  end if;

  if exists (select 1 from public.match_players where match_id=p_match and user_id=auth.uid())
    then raise exception 'already joined'; end if;
  if v_m.skill_tier = 'Rookie Only' then
    select xp into v_xp from public.profiles where id = auth.uid();
    if coalesce(v_xp,0) >= 25000 then raise exception 'Rookie Only lobby — your rank is above Rookie'; end if;
  end if;
  if v_m.kind = 'cash' then
    select balance into v_bal from public.profiles where id = auth.uid() for update;
    if v_bal < v_m.entry then raise exception 'insufficient balance'; end if;
    update public.profiles set balance = balance - v_m.entry where id = auth.uid();
    insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (auth.uid(), -v_m.entry, 'match_entry', p_match);
  end if;
  v_team_name := v_team.name;
  select region into v_region from public.profiles where id = auth.uid();
  insert into public.match_players(match_id, user_id, region, team_id, team_name)
    values (p_match, auth.uid(), coalesce(v_region,'NA'), v_team.id, v_team_name);

  select count(*) into v_players from public.match_players where match_id = p_match;
  v_needed := public.team_size(v_m.format) * 2;
  if v_players >= v_needed then
    if public.mode_needs_veto(v_m.mode) then
      v_pool := public.maps_for_mode(v_m.mode);
      update public.matches set
        status = 'live',
        veto_status = 'pending',
        veto = jsonb_build_object(
          'pool', v_pool,
          'remaining', v_pool,
          'needed', public.maps_needed(v_m.series),
          'order', (select jsonb_agg(user_id order by joined_at) from public.match_players where match_id = p_match),
          'turn', 0,
          'actions', '[]'::jsonb,
          'finalMaps', '[]'::jsonb
        )
      where id = p_match;
    else
      update public.matches set status = 'live', veto_status = 'complete', host_region = public.resolve_host(p_match) where id = p_match;
    end if;
    insert into public.match_messages(match_id, user_id, username, text, kind)
      select p_match, auth.uid(), 'System', 'Lobby is full. ' ||
        case when public.mode_needs_veto(v_m.mode) then 'Map veto has started.' else 'Match is live — good luck.' end, 'system';
  end if;
end $$;

-- Map veto — alternating ban turns among the lobby (joined_at order) until
-- the series' required map count remains. Series' worth of maps left = locked in.
create or replace function public.veto_action(p_match uuid, p_map text)
returns matches language plpgsql security definer set search_path = public as $$
declare v_m public.matches; v_state jsonb; v_order jsonb; v_turn int; v_actor uuid;
        v_remaining jsonb; v_needed int; v_actions jsonb; v_count int;
begin
  select * into v_m from public.matches where id = p_match for update;
  if not found then raise exception 'match not found'; end if;
  if v_m.veto_status <> 'pending' then raise exception 'veto is not active for this match'; end if;
  if not exists (select 1 from public.match_players where match_id=p_match and user_id=auth.uid())
    then raise exception 'not a participant'; end if;

  v_state := v_m.veto;
  v_order := v_state->'order';
  v_turn := coalesce((v_state->>'turn')::int, 0);
  v_actor := (v_order->>(v_turn % jsonb_array_length(v_order)))::uuid;
  if v_actor <> auth.uid() then raise exception 'not your turn to ban'; end if;
  if not ((v_state->'remaining') ? p_map) then raise exception 'map already banned or invalid'; end if;

  select jsonb_agg(x) into v_remaining
    from jsonb_array_elements_text(v_state->'remaining') x
    where x <> p_map;
  v_remaining := coalesce(v_remaining, '[]'::jsonb);
  v_actions := coalesce(v_state->'actions','[]'::jsonb) || jsonb_build_object('by', auth.uid(), 'map', p_map);
  v_needed := coalesce((v_state->>'needed')::int, 1);

  v_state := jsonb_set(v_state, '{remaining}', v_remaining);
  v_state := jsonb_set(v_state, '{actions}', v_actions);
  v_state := jsonb_set(v_state, '{turn}', to_jsonb(v_turn + 1));

  v_count := jsonb_array_length(v_remaining);
  if v_count <= v_needed then
    v_state := jsonb_set(v_state, '{finalMaps}', v_remaining);
    update public.matches
      set veto = v_state, veto_status = 'complete', host_region = public.resolve_host(p_match)
      where id = p_match returning * into v_m;
    insert into public.match_messages(match_id, user_id, username, text, kind)
      values (p_match, auth.uid(), 'System', 'Veto complete. Map(s): ' || array_to_string(array(select jsonb_array_elements_text(v_remaining)), ', '), 'system');
  else
    update public.matches set veto = v_state where id = p_match returning * into v_m;
  end if;
  return v_m;
end $$;

create or replace function public.settle_match(p_match uuid, p_winner uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_m public.matches; v_players int; v_pot numeric; v_rake numeric; v_payout numeric; v_member boolean;
        v_mp record; v_is_tourney boolean; v_opp_team uuid;
begin
  select * into v_m from public.matches where id = p_match for update;
  if v_m.status = 'settled' then return; end if;
  select count(*) into v_players from public.match_players where match_id = p_match;
  if v_m.kind = 'cash' then
    select wagr_member into v_member from public.profiles where id = p_winner;
    v_pot := v_m.entry * v_players;
    v_rake := case when coalesce(v_member,false) then 0 else round(v_pot * 0.10, 2) end;
    v_payout := v_pot - v_rake;
    update public.profiles set balance = balance + v_payout, earnings = earnings + v_payout where id = p_winner;
    insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (p_winner, v_payout, 'match_payout', p_match);
  end if;
  update public.profiles p set
    xp = xp + case when p.id = p_winner then 100 else 25 end,
    wins = wins + case when p.id = p_winner then 1 else 0 end,
    losses = losses + case when p.id = p_winner then 0 else 1 end,
    streak = case when p.id = p_winner then streak + 1 else 0 end
  from public.match_players mp where mp.match_id = p_match and mp.user_id = p.id;
  update public.matches set status='settled', winner_id=p_winner where id=p_match;

  -- Check if this is a tournament match
  v_is_tourney := exists (select 1 from public.tournament_matches where match_id = p_match);

  -- Credit team records
  for v_mp in select mp.user_id, mp.team_id from public.match_players mp where mp.match_id = p_match and mp.team_id is not null loop
    -- Find opponent team
    select mp2.team_id into v_opp_team from public.match_players mp2
    where mp2.match_id = p_match and mp2.user_id <> v_mp.user_id and mp2.team_id is not null limit 1;

    if v_mp.user_id = p_winner then
      if v_is_tourney then
        update public.teams set tourney_wins = tourney_wins + 1,
          xp = xp + 100,
          earnings = earnings + coalesce(v_payout, 0)
        where id = v_mp.team_id;
      else
        update public.teams set wins = wins + 1,
          xp = xp + 100,
          earnings = earnings + coalesce(v_payout, 0)
        where id = v_mp.team_id;
      end if;
      insert into public.team_match_history(team_id, match_id, result, earnings, xp_earned, opponent_team_id,
        tournament_id)
        values (v_mp.team_id, p_match, 'win', coalesce(v_payout, 0), 100, v_opp_team,
          (select tournament_id from public.tournament_matches where match_id = p_match limit 1));
    else
      if v_is_tourney then
        update public.teams set tourney_losses = tourney_losses + 1, xp = xp + 25
        where id = v_mp.team_id;
      else
        update public.teams set losses = losses + 1, xp = xp + 25
        where id = v_mp.team_id;
      end if;
      insert into public.team_match_history(team_id, match_id, result, earnings, xp_earned, opponent_team_id,
        tournament_id)
        values (v_mp.team_id, p_match, 'loss', 0, 25, v_opp_team,
          (select tournament_id from public.tournament_matches where match_id = p_match limit 1));
    end if;
  end loop;

  perform public.settle_match_bets(p_match, p_winner);
  declare v_tm_id uuid; begin
    select id into v_tm_id from public.tournament_matches where match_id=p_match limit 1;
    if v_tm_id is not null then perform public.advance_bracket(v_tm_id); end if;
  end;
end $$;

create or replace function public.report_match(p_match uuid, p_winner uuid, p_score text, p_evidence_url text)
returns void language plpgsql security definer set search_path = public as $$
declare v_players int; v_reports int; v_distinct int;
begin
  perform public.check_not_banned();
  if not exists (select 1 from public.match_players where match_id=p_match and user_id=auth.uid())
    then raise exception 'not a participant'; end if;
  insert into public.match_reports(match_id, reported_by, winner_id, score, evidence_url)
    values (p_match, auth.uid(), p_winner, p_score, p_evidence_url)
    on conflict (match_id, reported_by)
    do update set winner_id=excluded.winner_id, score=excluded.score, evidence_url=excluded.evidence_url;
  update public.matches set status = 'reported' where id = p_match and status = 'live';
  select count(*) into v_players from public.match_players where match_id = p_match;
  select count(*), count(distinct winner_id) into v_reports, v_distinct from public.match_reports where match_id = p_match;
  if v_reports = v_players and v_distinct = 1 then
    perform public.settle_match(p_match, p_winner);
  end if;
end $$;

create or replace function public.open_dispute(p_match uuid, p_reason text, p_evidence_url text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.check_not_banned();
  if not exists (select 1 from public.match_players where match_id=p_match and user_id=auth.uid())
    then raise exception 'not a participant'; end if;
  insert into public.match_disputes(match_id, opened_by, reason, evidence_url) values (p_match, auth.uid(), p_reason, p_evidence_url);
  update public.matches set status='disputed' where id=p_match;
end $$;

-- Either participant can request to cancel a lobby that hasn't settled yet.
-- The other participant (or an admin) accepts or declines it. Accepting
-- refunds any cash entries and marks the match cancelled.
create or replace function public.request_match_cancel(p_match uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_m public.matches; v_id uuid;
begin
  select * into v_m from public.matches where id = p_match for update;
  if not found then raise exception 'match not found'; end if;
  if v_m.status in ('settled','cancelled') then raise exception 'match already finished'; end if;
  if not exists (select 1 from public.match_players where match_id=p_match and user_id=auth.uid())
    then raise exception 'not a participant'; end if;
  if exists (select 1 from public.match_cancel_requests where match_id=p_match and status='pending')
    then raise exception 'a cancel request is already pending'; end if;
  insert into public.match_cancel_requests(match_id, requested_by, reason)
    values (p_match, auth.uid(), p_reason) returning id into v_id;
  insert into public.match_messages(match_id, user_id, username, text, kind)
    values (p_match, auth.uid(), 'System', 'A cancellation was requested. Waiting on the other side to respond.', 'system');
  return v_id;
end $$;

create or replace function public.respond_match_cancel(p_request uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_req public.match_cancel_requests; v_m public.matches; v_pid uuid; v_entry numeric;
begin
  select * into v_req from public.match_cancel_requests where id = p_request for update;
  if not found then raise exception 'request not found'; end if;
  if v_req.status <> 'pending' then raise exception 'request already resolved'; end if;
  select * into v_m from public.matches where id = v_req.match_id for update;
  if not (exists (select 1 from public.match_players where match_id=v_m.id and user_id=auth.uid()) or public.is_admin())
    then raise exception 'not authorized'; end if;

  if p_accept then
    update public.match_cancel_requests set status='accepted', resolved_by=auth.uid(), resolved_at=now() where id=p_request;
    if v_m.kind = 'cash' and v_m.status <> 'open' then
      for v_pid in select user_id from public.match_players where match_id = v_m.id loop
        update public.profiles set balance = balance + v_m.entry where id = v_pid;
        insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (v_pid, v_m.entry, 'match_cancel_refund', v_m.id);
      end loop;
    end if;
    update public.matches set status='cancelled' where id=v_m.id;
    insert into public.match_messages(match_id, user_id, username, text, kind)
      values (v_m.id, auth.uid(), 'System', 'Cancellation accepted. Match closed' || (case when v_m.kind='cash' then ' and entries refunded.' else '.' end), 'system');
  else
    update public.match_cancel_requests set status='declined', resolved_by=auth.uid(), resolved_at=now() where id=p_request;
    insert into public.match_messages(match_id, user_id, username, text, kind)
      values (v_m.id, auth.uid(), 'System', 'Cancellation request declined. Match continues.', 'system');
  end if;
end $$;

create or replace function public.settle_match_admin(p_match uuid, p_winner uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  perform public.settle_match(p_match, p_winner);
  update public.match_disputes set status='resolved', resolved_by=auth.uid(), resolution=p_note, resolved_at=now()
    where match_id=p_match and status in ('open','reviewing');
end $$;

-- ---------- tournaments ----------
-- Join: pot is built from who actually joins (entry x entries). Holds entry.
create or replace function public.join_tournament(p_tournament uuid, p_entrant text, p_team_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_t public.tournaments; v_bal numeric; v_count int; v_gate text;
        v_team public.teams;
begin
  perform public.check_not_banned();
  select * into v_t from public.tournaments where id = p_tournament for update;
  if not found then raise exception 'tournament not found'; end if;
  if v_t.status <> 'upcoming' then raise exception 'tournament is not open'; end if;

  -- Resolve + validate team
  if p_team_id is not null then
    select * into v_team from public.teams where id = p_team_id;
    if not found then raise exception 'team not found'; end if;
    if not exists (select 1 from public.team_members where team_id = p_team_id and user_id = auth.uid()) then
      raise exception 'you are not on this team';
    end if;
  else
    select t.* into v_team from public.team_members tm
    join public.teams t on t.id = tm.team_id
    where tm.user_id = auth.uid() and t.game = v_t.game
    limit 1;
  end if;

  -- Eligibility gate
  v_gate := public.can_play(auth.uid(), v_t.game, v_t.platform, null);
  if v_gate is not null then raise exception '%', v_gate; end if;

  -- WWII platform match
  if v_t.game = 'Call of Duty: WWII' and v_team.id is not null
     and v_team.platform <> v_t.platform then
    raise exception 'Your team is % but this tournament is %', v_team.platform, v_t.platform;
  end if;

  -- Region enforcement
  if v_t.region = 'NA' and coalesce((select region from public.profiles where id=auth.uid()),'NA') <> 'NA' then
    raise exception 'This tournament is NA Only. Set your profile region to NA.';
  end if;
  if v_t.region = 'EU' and coalesce((select region from public.profiles where id=auth.uid()),'NA') <> 'EU' then
    raise exception 'This tournament is EU Only. Set your profile region to EU.';
  end if;
  select count(*) into v_count from public.tournament_entries where tournament_id = p_tournament;
  if v_count >= v_t.capacity then raise exception 'tournament is full'; end if;
  if exists (select 1 from public.tournament_entries where tournament_id=p_tournament and user_id=auth.uid())
    then raise exception 'already entered'; end if;
  select balance into v_bal from public.profiles where id = auth.uid() for update;
  if v_bal < v_t.entry then raise exception 'insufficient balance'; end if;
  update public.profiles set balance = balance - v_t.entry where id = auth.uid();
  insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (auth.uid(), -v_t.entry, 'tournament_entry', p_tournament);
  insert into public.tournament_entries(tournament_id, entrant_name, user_id, paid, team_id)
    values (p_tournament, p_entrant, auth.uid(), v_t.entry, v_team.id);
end $$;

-- Settle a tournament: pot = entry * teams joined. Pays 1st 80%, 2nd 15%, 3rd 5%
-- to the users behind the given entrant names, awards gold/silver/bronze
-- trophies (with the tournament title), and records placements. Admin only.
create or replace function public.settle_tournament(
  p_tournament uuid, p_first text, p_second text, p_third text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_t public.tournaments; v_joined int; v_pot numeric;
  v_p1 numeric; v_p2 numeric; v_p3 numeric;
  v_u1 uuid; v_u2 uuid; v_u3 uuid;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  select * into v_t from public.tournaments where id = p_tournament for update;
  if not found then raise exception 'tournament not found'; end if;
  if v_t.status = 'completed' then return; end if;

  select count(*) into v_joined from public.tournament_entries where tournament_id = p_tournament;
  v_pot := round(v_t.entry * v_joined * 0.98, 2); -- 2% house cut
  v_p1 := round(v_pot * 0.833, 2);
  v_p2 := round(v_pot * 0.10, 2);
  v_p3 := round(v_pot * 0.067, 2);

  select user_id into v_u1 from public.tournament_entries where tournament_id=p_tournament and entrant_name=p_first limit 1;
  select user_id into v_u2 from public.tournament_entries where tournament_id=p_tournament and entrant_name=p_second limit 1;
  select user_id into v_u3 from public.tournament_entries where tournament_id=p_tournament and entrant_name=p_third limit 1;

  -- 1st: cash + earnings + gold trophy + XP
  if v_u1 is not null then
    update public.profiles set balance=balance+v_p1, earnings=earnings+v_p1, xp=xp+500 where id=v_u1;
    insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (v_u1, v_p1, 'tournament_payout', p_tournament);
    insert into public.trophies(user_id, title, place, tone, game, prize, bracket_size)
      values (v_u1, v_t.name, 1, 'gold', v_t.game, v_p1, v_joined);
    update public.tournament_entries set placed=1 where tournament_id=p_tournament and entrant_name=p_first;
  end if;
  -- 2nd: cash + silver trophy
  if v_u2 is not null then
    update public.profiles set balance=balance+v_p2, earnings=earnings+v_p2, xp=xp+250 where id=v_u2;
    insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (v_u2, v_p2, 'tournament_payout', p_tournament);
    insert into public.trophies(user_id, title, place, tone, game, prize, bracket_size)
      values (v_u2, v_t.name, 2, 'silver', v_t.game, v_p2, v_joined);
    update public.tournament_entries set placed=2 where tournament_id=p_tournament and entrant_name=p_second;
  end if;
  -- 3rd: cash + bronze trophy
  if v_u3 is not null then
    update public.profiles set balance=balance+v_p3, earnings=earnings+v_p3, xp=xp+100 where id=v_u3;
    insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (v_u3, v_p3, 'tournament_payout', p_tournament);
    insert into public.trophies(user_id, title, place, tone, game, prize, bracket_size)
      values (v_u3, v_t.name, 3, 'bronze', v_t.game, v_p3, v_joined);
    update public.tournament_entries set placed=3 where tournament_id=p_tournament and entrant_name=p_third;
  end if;

  update public.tournaments
    set status='completed', winner_name=p_first, second_name=p_second, third_name=p_third
    where id=p_tournament;

  -- notify winners
  if v_u1 is not null then insert into public.notifications(user_id, text) values (v_u1, 'You won ' || v_t.name || '! +' || v_p1); end if;
  if v_u2 is not null then insert into public.notifications(user_id, text) values (v_u2, '2nd place in ' || v_t.name || '. +' || v_p2); end if;
  if v_u3 is not null then insert into public.notifications(user_id, text) values (v_u3, '3rd place in ' || v_t.name || '. +' || v_p3); end if;
end $$;

-- Lock down direct execution of the placeholder deposit in production by
-- revoking from anon (authenticated still allowed for testing; remove before launch).
revoke execute on function public.deposit(numeric) from anon;

-- ============================================================================
-- REALTIME — add tables to the publication (guarded)
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','matches','match_reports','match_disputes','chat_messages',
    'notifications','tournaments','tournament_entries','wallet_ledger',
    'match_messages','match_cancel_requests','withdrawal_requests','shop_purchases','user_bans',
    'tournament_rounds','tournament_matches','trophies'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null; when others then null;
    end;
  end loop;
end $$;

-- ============================================================================
-- SIDE-BET SETTLEMENT
-- ============================================================================
-- Link bets to matches so they auto-settle when a match resolves.
alter table public.bets add column if not exists match_id uuid references public.matches(id);
create index if not exists bets_match_idx on public.bets(match_id) where match_id is not null;

-- Settle a single bet. Admin only.
-- p_outcome: 'won' | 'lost' | 'void'
-- Won:  gross = stake * odds, profit = gross - stake, rake = profit * 5% (WAGR 0%), credit net.
-- Lost: no balance change (stake already debited at place time).
-- Void: full stake refund.
create or replace function public.settle_bet(p_bet uuid, p_outcome bet_status)
returns void language plpgsql security definer set search_path = public as $$
declare v_bet public.bets; v_gross numeric; v_profit numeric; v_rake numeric; v_net numeric; v_member boolean;
begin
  select * into v_bet from public.bets where id = p_bet for update;
  if not found then raise exception 'bet not found'; end if;
  if v_bet.status <> 'open' then return; end if;

  if p_outcome = 'won' then
    v_gross := round(v_bet.stake * v_bet.odds, 2);
    v_profit := v_gross - v_bet.stake;
    select wagr_member into v_member from public.profiles where id = v_bet.user_id;
    v_rake := case when coalesce(v_member, false) then 0 else round(greatest(v_profit, 0) * 0.05, 2) end;
    v_net := v_gross - v_rake;
    update public.profiles set balance = balance + v_net, earnings = earnings + v_net where id = v_bet.user_id;
    insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (v_bet.user_id, v_net, 'bet_payout', p_bet);
  elsif p_outcome = 'void' then
    update public.profiles set balance = balance + v_bet.stake where id = v_bet.user_id;
    insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (v_bet.user_id, v_bet.stake, 'bet_refund', p_bet);
  end if;
  -- 'lost': stake was already debited by place_bet, nothing to move.

  update public.bets set status = p_outcome where id = p_bet;
end $$;

-- Auto-settle all open bets linked to a match after it resolves.
-- Bets whose target = winner_id win; all others lose.
create or replace function public.settle_match_bets(p_match uuid, p_winner uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_bet record;
begin
  for v_bet in
    select id, target from public.bets
    where match_id = p_match and status = 'open'
    for update
  loop
    if v_bet.target = p_winner::text then
      perform public.settle_bet(v_bet.id, 'won');
    else
      perform public.settle_bet(v_bet.id, 'lost');
    end if;
  end loop;
end $$;

-- Update place_bet to accept an optional match link.
create or replace function public.place_bet(p_target text, p_market bet_market, p_stake numeric, p_odds numeric, p_match_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_bal numeric; v_id uuid;
begin
  perform public.check_not_banned();
  if p_stake <= 0 then raise exception 'stake must be positive'; end if;
  if p_match_id is not null and not exists (select 1 from public.matches where id = p_match_id and status in ('open','live'))
    then raise exception 'match not found or not active'; end if;
  select balance into v_bal from public.profiles where id = auth.uid() for update;
  if v_bal < p_stake then raise exception 'insufficient balance'; end if;
  update public.profiles set balance = balance - p_stake where id = auth.uid();
  insert into public.wallet_ledger(user_id, delta, reason) values (auth.uid(), -p_stake, 'bet');
  insert into public.bets(user_id, target, market, stake, odds, match_id)
    values (auth.uid(), p_target, p_market, p_stake, p_odds, p_match_id) returning id into v_id;
  return v_id;
end $$;

-- Add bets to realtime publication.
do $$ begin
  execute 'alter publication supabase_realtime add table public.bets';
exception when duplicate_object then null; when others then null;
end $$;

-- Add bet_events + side_bets to realtime publication.
do $$ begin
  execute 'alter publication supabase_realtime add table public.bet_events';
exception when duplicate_object then null; when others then null;
end $$;
do $$ begin
  execute 'alter publication supabase_realtime add table public.side_bets';
exception when duplicate_object then null; when others then null;
end $$;

-- ============================================================================
-- SIDE BET EVENT RPCs
-- ============================================================================

-- Admin: create a bet event
create or replace function public.create_bet_event(
  p_title text, p_description text, p_market bet_market,
  p_options jsonb, p_odds numeric, p_locks_at timestamptz default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  insert into public.bet_events(title, description, market, options, odds, locks_at, created_by)
    values (p_title, p_description, p_market, p_options, p_odds, p_locks_at, auth.uid())
    returning id into v_id;
  return v_id;
end $$;

-- Admin: lock an event (no more bets)
create or replace function public.lock_bet_event(p_event uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  update public.bet_events set status = 'locked' where id = p_event and status = 'open';
  if not found then raise exception 'event not found or not open'; end if;
end $$;

-- Admin: settle an event — pay winners, mark losers
create or replace function public.settle_bet_event(p_event uuid, p_winner_option text)
returns void language plpgsql security definer set search_path = public as $$
declare v_ev public.bet_events; v_sb record;
  v_gross numeric; v_profit numeric; v_rake numeric; v_net numeric; v_member boolean;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;

  select * into v_ev from public.bet_events where id = p_event for update;
  if not found then raise exception 'event not found'; end if;
  if v_ev.status = 'settled' then return; end if;
  if v_ev.status = 'void' then raise exception 'event is voided'; end if;

  -- Lock first if still open
  if v_ev.status = 'open' then
    update public.bet_events set status = 'locked' where id = p_event;
  end if;

  for v_sb in select * from public.side_bets where event_id = p_event and status = 'open' for update
  loop
    if v_sb.selection = p_winner_option then
      -- Winner: gross = stake * odds, profit = gross - stake, rake = 5% of profit (WAGR = 0%)
      v_gross := round(v_sb.stake * v_sb.odds, 2);
      v_profit := v_gross - v_sb.stake;
      select wagr_member into v_member from public.profiles where id = v_sb.user_id;
      v_rake := case when coalesce(v_member, false) then 0 else round(greatest(v_profit, 0) * 0.05, 2) end;
      v_net := v_gross - v_rake;

      update public.profiles set balance = balance + v_net, earnings = earnings + (v_profit - v_rake) where id = v_sb.user_id;
      insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (v_sb.user_id, v_net, 'side_bet_payout', v_sb.id);
      if v_rake > 0 then
        insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (v_sb.user_id, -v_rake, 'side_bet_rake', v_sb.id);
      end if;

      update public.side_bets set status = 'won', payout = v_net, rake = v_rake, settled_at = now() where id = v_sb.id;
    else
      -- Loser: stake already debited
      update public.side_bets set status = 'lost', payout = 0, rake = 0, settled_at = now() where id = v_sb.id;
    end if;
  end loop;

  update public.bet_events set status = 'settled', winner_option = p_winner_option, settled_at = now() where id = p_event;

  -- Post settlement announcement to betting chat
  insert into public.chat_messages(channel, user_id, username, text, kind)
    values ('betting'::chat_channel, auth.uid(), 'System',
            '🏆 "' || v_ev.title || '" settled — winner: ' || p_winner_option || '!', 'system');
end $$;

-- Admin: void an event — refund all stakes
create or replace function public.void_bet_event(p_event uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_ev public.bet_events; v_sb record;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  select * into v_ev from public.bet_events where id = p_event for update;
  if not found then raise exception 'event not found'; end if;
  if v_ev.status in ('settled','void') then return; end if;

  for v_sb in select * from public.side_bets where event_id = p_event and status = 'open' for update
  loop
    update public.profiles set balance = balance + v_sb.stake where id = v_sb.user_id;
    insert into public.wallet_ledger(user_id, delta, reason, ref_id) values (v_sb.user_id, v_sb.stake, 'side_bet_refund', v_sb.id);
    update public.side_bets set status = 'void', payout = v_sb.stake, rake = 0, settled_at = now() where id = v_sb.id;
  end loop;

  update public.bet_events set status = 'void', settled_at = now() where id = p_event;
end $$;

-- User: place a side bet on an event option
create or replace function public.place_side_bet(p_event uuid, p_selection text, p_stake numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_ev public.bet_events; v_bal numeric; v_id uuid;
begin
  perform public.check_not_banned();
  perform public.check_rate_limit('place_bet', 10, 60);  -- 10 per minute
  select * into v_ev from public.bet_events where id = p_event;
  if not found then raise exception 'event not found'; end if;
  if v_ev.status <> 'open' then raise exception 'betting is closed for this event'; end if;
  if v_ev.locks_at is not null and now() >= v_ev.locks_at then raise exception 'betting is closed for this event'; end if;
  if not v_ev.options @> to_jsonb(p_selection) then raise exception 'invalid selection'; end if;
  if p_stake <= 0 then raise exception 'stake must be positive'; end if;
  if p_stake > 100 then raise exception 'max bet is $100'; end if;

  select balance into v_bal from public.profiles where id = auth.uid() for update;
  if v_bal < p_stake then raise exception 'insufficient balance'; end if;

  update public.profiles set balance = balance - p_stake where id = auth.uid();
  insert into public.wallet_ledger(user_id, delta, reason) values (auth.uid(), -p_stake, 'side_bet');

  insert into public.side_bets(event_id, user_id, selection, stake, odds)
    values (p_event, auth.uid(), p_selection, p_stake, v_ev.odds)
    returning id into v_id;
  return v_id;
end $$;

-- ============================================================================
-- SEED — a few upcoming tournaments so the page isn't empty (only if none yet)
-- ============================================================================
insert into public.tournaments
  (name, game, mode, format, entry, capacity, region, starts_at, status, platform, skill_tier, series, weapon_restriction, host_rule)
select name, game, mode, format, entry, capacity, region, starts_at, status::tournament_status, platform, skill_tier, series, weapon_restriction, host_rule
from (values
  ('2v2 Console Only SND Best of 3',            'Call of Duty: Black Ops 7', 'Search & Destroy',                '2v2', 10.00::numeric, 16, 'NA',      now() + interval '1 days',  'upcoming', 'Console Only',       'Open',           'Best of 3',  null::text,           'auto'),
  ('3v3 Console Only SND Bo3 Rookie Only',      'Call of Duty: Black Ops 7', 'Search & Destroy',                '3v3', 5.00,  12, 'NA',      now() + interval '2 days',  'upcoming', 'Console Only',       'Rookie Only',    'Best of 3',  null,                 'auto'),
  ('2v2 PC/Console SND Best of 1',              'Call of Duty: Black Ops 7', 'Search & Destroy',                '2v2', 8.00,  16, 'NA + EU', now() + interval '2 days',  'upcoming', 'PC + Console Mixed', 'Mixed Skill',    'Best of 1',  null,                 'auto'),
  ('1v1 Console Only SND Best of 1',            'Call of Duty: Black Ops 7', 'Search & Destroy',                '1v1', 5.00,  32, 'NA',      now() + interval '3 days',  'upcoming', 'Console Only',       'Open',           'Best of 1',  'M15 / Dravec Only',  'auto'),
  ('1v1 Console Only SND 1 and Done',           'Call of Duty: Black Ops 7', 'Search & Destroy',                '1v1', 5.00,  32, 'NA',      now() + interval '3 days',  'upcoming', 'Console Only',       'Open',           '1 and Done', null,                 'auto'),
  ('Hardpoint Mixed PC + Console',              'Call of Duty: Black Ops 7', 'Hardpoint',                       '2v2', 10.00, 16, 'NA + EU', now() + interval '4 days',  'upcoming', 'PC + Console Mixed', 'Mixed Skill',    'Best of 3',  null,                 'auto'),
  ('Rookie Only Open Bracket',                  'Call of Duty: Black Ops 7', 'Search & Destroy',                '1v1', 3.00,  16, 'NA',      now() + interval '1 days',  'upcoming', 'PC + Console Mixed', 'Rookie Only',    'Best of 1',  null,                 'auto'),
  ('CDL Search and Destroy',                    'Call of Duty: Black Ops 7', 'Search & Destroy',                '4v4', 25.00, 8,  'NA + EU', now() + interval '5 days',  'upcoming', 'PC + Console Mixed', 'Advanced/Elite', 'Best of 3',  null,                 'NA'),
  ('CDL Hardpoint',                             'Call of Duty: Black Ops 7', 'Hardpoint',                       '4v4', 25.00, 8,  'NA + EU', now() + interval '5 days',  'upcoming', 'PC + Console Mixed', 'Advanced/Elite', 'Best of 3',  null,                 'NA'),
  ('CDL Overload',                              'Call of Duty: Black Ops 7', 'Overload',                        '4v4', 25.00, 8,  'NA + EU', now() + interval '6 days',  'upcoming', 'PC + Console Mixed', 'Advanced/Elite', 'Best of 3',  null,                 'EU'),
  ('CDL Rotation — SND / HP / Overload',        'Call of Duty: Black Ops 7', 'Hardpoint',                       '4v4', 30.00, 8,  'NA + EU', now() + interval '7 days',  'upcoming', 'PC + Console Mixed', 'Advanced/Elite', 'Best of 3',  null,                 'auto'),
  ('Warzone Resurgence 1v1 Kill Race',          'Warzone',                   'Resurgence Kill Race',            '1v1', 5.00,  32, 'NA',      now() + interval '2 days',  'upcoming', 'PC + Console Mixed', 'Open',           'Best of 1',  null,                 'auto'),
  ('Warzone Resurgence 2v2 Kill Race',          'Warzone',                   'Resurgence Kill Race',            '2v2', 10.00, 24, 'NA + EU', now() + interval '3 days',  'upcoming', 'PC + Console Mixed', 'Open',           'Best of 1',  null,                 'auto'),
  ('Warzone BR Big Map 2v2 Kill Race',          'Warzone',                   'Battle Royale Big Map Kill Race', '2v2', 10.00, 20, 'NA + EU', now() + interval '4 days',  'upcoming', 'PC + Console Mixed', 'Mixed Skill',    'Best of 1',  null,                 'auto'),
  ('Warzone BR Big Map 1v1 Survival',           'Warzone',                   'Battle Royale Big Map Survival',  '1v1', 5.00,  24, 'NA',      now() + interval '5 days',  'upcoming', 'Console Only',       'Open',           'Best of 1',  null,                 'auto'),
  ('Black Ops Royale 2v2 Kill Race',            'Black Ops Royale',         'Kill Race',                        '2v2', 5.00,  20, 'NA + EU', now() + interval '2 days',  'upcoming', 'PC + Console Mixed', 'Open',           'Best of 1',  null,                 'auto'),
  ('Black Ops Royale 1v1 Survival Rookie Cup',  'Black Ops Royale',         'Survival',                        '1v1', 3.00,  24, 'NA',      now() + interval '3 days',  'upcoming', 'Console Only',       'Rookie Only',    'Best of 1',  null,                 'auto')
) as seed(name, game, mode, format, entry, capacity, region, starts_at, status, platform, skill_tier, series, weapon_restriction, host_rule)
where not exists (select 1 from public.tournaments);

-- ============================================================================
-- STORAGE BUCKETS (run separately if this fails — storage schema may not exist
-- in the SQL editor; create buckets via Supabase dashboard instead).
-- ============================================================================
-- insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict do nothing;
-- insert into storage.buckets (id, name, public) values ('evidence', 'evidence', false) on conflict do nothing;
-- Then in dashboard -> Storage -> avatars -> Policies:
--   SELECT: allow all (public bucket)
--   INSERT: auth.uid()::text = (storage.foldername(name))[1]
--   UPDATE: same as INSERT
-- And evidence -> Policies:
--   SELECT: authenticated
--   INSERT: authenticated

-- ============================================================================
-- LEADERBOARD — multi-metric boards, weekly stubs, player-of-the-week
-- ============================================================================

-- Indexes for leaderboard sort columns (xp already indexed above).
create index if not exists profiles_earnings_idx on public.profiles(earnings desc);
create index if not exists profiles_streak_idx  on public.profiles(streak desc);

-- get_leaderboard: server-ordered multi-metric query.
-- p_metric: 'xp' | 'earnings' | 'streak' | 'winpct'
-- Win% requires >= 10 matches (threshold documented in DECISIONS.md).
create or replace function public.get_leaderboard(
  p_metric   text    default 'xp',
  p_region   text    default null,
  p_platform text    default null,
  p_limit    int     default 100
)
returns table(
  id          uuid,
  username    text,
  xp          int,
  wins        int,
  losses      int,
  earnings    numeric,
  streak      int,
  region      text,
  platform    text,
  avatar_url  text,
  wagr_member boolean,
  verified    boolean,
  rank_pos    bigint
) language plpgsql stable security definer set search_path = public as $$
begin
  return query
    select
      p.id, p.username, p.xp, p.wins, p.losses, p.earnings, p.streak,
      p.region, p.platform, p.avatar_url, p.wagr_member, p.verified,
      row_number() over (
        order by
          case p_metric
            when 'earnings' then p.earnings
            when 'streak'   then p.streak::numeric
            when 'winpct'   then case when (p.wins+p.losses) >= 10
                                      then p.wins::numeric / nullif(p.wins+p.losses, 0)
                                      else -1 end
            else p.xp::numeric
          end desc,
          p.xp desc
      ) as rank_pos
    from public.profiles p
    where (p_region   is null or p.region   = p_region)
      and (p_platform is null or p.platform = p_platform)
      and (p_metric <> 'winpct' or (p.wins + p.losses) >= 10)
    limit p_limit;
end $$;
grant execute on function public.get_leaderboard(text,text,text,int) to anon, authenticated;

-- get_my_rank: find the caller's position on a given board.
create or replace function public.get_my_rank(
  p_metric   text default 'xp',
  p_region   text default null,
  p_platform text default null
)
returns table(rank_pos bigint, total bigint) language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  return query
    with ranked as (
      select
        p.id,
        row_number() over (
          order by
            case p_metric
              when 'earnings' then p.earnings
              when 'streak'   then p.streak::numeric
              when 'winpct'   then case when (p.wins+p.losses) >= 10
                                        then p.wins::numeric / nullif(p.wins+p.losses, 0)
                                        else -1 end
              else p.xp::numeric
            end desc,
            p.xp desc
        ) as rank_pos
      from public.profiles p
      where (p_region   is null or p.region   = p_region)
        and (p_platform is null or p.platform = p_platform)
        and (p_metric <> 'winpct' or (p.wins + p.losses) >= 10)
    )
    select r.rank_pos, (select count(*) from ranked)::bigint as total
    from ranked r where r.id = v_uid;
end $$;
grant execute on function public.get_my_rank(text,text,text) to authenticated;

-- weekly_stats: per-week deltas (STUB — not yet populated by settle functions).
create table if not exists public.weekly_stats (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id),
  week_start      date not null,
  xp_gained       int not null default 0,
  earnings_gained numeric(12,2) not null default 0,
  wins            int not null default 0,
  losses          int not null default 0,
  unique(user_id, week_start)
);
create index if not exists weekly_stats_week_xp_idx on public.weekly_stats(week_start, xp_gained desc);

-- weekly_rewards: idempotency guard for credit grants.
create table if not exists public.weekly_rewards (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id),
  week_start date not null,
  credits    numeric(12,2) not null,
  created_at timestamptz not null default now(),
  unique(user_id, week_start)
);

-- rollover_week: STUB — to be called by pg_cron or Supabase scheduled function
-- every Sunday 00:00 UTC. Grants credits to top-3 weekly XP earners.
create or replace function public.rollover_week()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_week date := date_trunc('week', now() - interval '1 day')::date;
  v_row  record;
  v_credits numeric;
begin
  for v_row in
    select user_id, xp_gained,
           row_number() over (order by xp_gained desc) as pos
    from public.weekly_stats
    where week_start = v_week
    order by xp_gained desc
    limit 3
  loop
    v_credits := case v_row.pos when 1 then 25.00 when 2 then 15.00 when 3 then 10.00 else 0 end;
    if v_credits > 0 and not exists (
      select 1 from public.weekly_rewards where user_id = v_row.user_id and week_start = v_week
    ) then
      insert into public.weekly_rewards(user_id, week_start, credits)
        values (v_row.user_id, v_week, v_credits);
      update public.profiles set balance = balance + v_credits where id = v_row.user_id;
      insert into public.wallet_ledger(user_id, delta, reason)
        values (v_row.user_id, v_credits, 'weekly_reward');
      insert into public.notifications(user_id, text)
        values (v_row.user_id,
          'You earned ' || v_credits || ' credits as a Player of the Week! (#' || v_row.pos || ')');
    end if;
  end loop;
end $$;

alter table public.weekly_stats   enable row level security;
alter table public.weekly_rewards enable row level security;
drop policy if exists "weekly_stats read own" on public.weekly_stats;
create policy "weekly_stats read own" on public.weekly_stats for select using (true);
drop policy if exists "weekly_rewards read own" on public.weekly_rewards;
create policy "weekly_rewards read own" on public.weekly_rewards for select using (true);

-- ============================================================================
-- TEAM MATCH HISTORY (per-team per-settled-match record)
-- ============================================================================
create table if not exists public.team_match_history (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  match_id   uuid references public.matches(id) on delete set null,
  tournament_id uuid references public.tournaments(id) on delete set null,
  result     text not null check (result in ('win','loss')),
  earnings   numeric(12,2) not null default 0,
  xp_earned  integer not null default 0,
  opponent_team_id uuid references public.teams(id) on delete set null,
  settled_at timestamptz not null default now()
);
create index if not exists tmh_team_idx on public.team_match_history(team_id, settled_at desc);

alter table public.team_match_history enable row level security;
drop policy if exists "team_match_history read" on public.team_match_history;
create policy "team_match_history read" on public.team_match_history for select using (true);

do $$ begin
  execute 'alter publication supabase_realtime add table public.team_match_history';
exception when duplicate_object then null; when others then null;
end $$;

-- ============================================================================
-- DONE. After running:
--  1) Authentication -> Providers -> Email: enable email/password.
--  2) (optional) turn off "Confirm email" while testing so you can log in fast.
--  3) To make yourself an admin:
--       insert into public.app_admins(user_id)
--       select id from public.profiles where username_lower = lower('YOURNAME');
--  4) Create storage buckets "avatars" (public) and "evidence" (private) in dashboard.
--  5) Deploy Edge Functions (see supabase/functions/README.md).
-- ============================================================================
