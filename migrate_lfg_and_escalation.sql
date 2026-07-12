-- migrate_lfg_and_escalation.sql
-- Standalone LFG posts + ticket escalation system.
-- Idempotent — safe to re-run.

-- ═══════════════════════════════════════════════════════════════
-- §1 — LFG Posts
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.lfg_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  game text not null,
  mode text,
  platform text,
  region text,
  mic_required boolean not null default false,
  team_size int not null default 2,
  message text not null default '',
  status text not null default 'open' check (status in ('open','filled','expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '4 hours')
);

create index if not exists lfg_posts_status_idx on public.lfg_posts(status, created_at desc);
create index if not exists lfg_posts_user_idx on public.lfg_posts(user_id);

alter table public.lfg_posts enable row level security;

drop policy if exists "lfg read all" on public.lfg_posts;
create policy "lfg read all" on public.lfg_posts for select using (true);

drop policy if exists "lfg insert own" on public.lfg_posts;
create policy "lfg insert own" on public.lfg_posts for insert
  with check (user_id = auth.uid());

drop policy if exists "lfg update own" on public.lfg_posts;
create policy "lfg update own" on public.lfg_posts for update
  using (user_id = auth.uid());

drop policy if exists "lfg delete own" on public.lfg_posts;
create policy "lfg delete own" on public.lfg_posts for delete
  using (user_id = auth.uid());

-- Create LFG post RPC (enforces max 3 active posts per user)
create or replace function public.create_lfg_post(
  p_game text,
  p_mode text default null,
  p_platform text default null,
  p_region text default null,
  p_mic boolean default false,
  p_team_size int default 2,
  p_message text default ''
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_count int;
begin
  select count(*) into v_count from public.lfg_posts
    where user_id = auth.uid() and status = 'open' and expires_at > now();
  if v_count >= 3 then
    raise exception 'max 3 active LFG posts';
  end if;

  insert into public.lfg_posts(user_id, game, mode, platform, region, mic_required, team_size, message)
    values (auth.uid(), p_game, p_mode, p_platform, p_region, p_mic, p_team_size,
            left(p_message, 280))
    returning id into v_id;
  return v_id;
end $$;

-- List active LFG posts with profile info
create or replace function public.list_lfg_posts(
  p_game text default null,
  p_platform text default null,
  p_region text default null
)
returns table(
  id uuid, user_id uuid, game text, mode text, platform text, region text,
  mic_required boolean, team_size int, message text, status text,
  created_at timestamptz, expires_at timestamptz,
  username text, avatar_url text, xp int, wagr_member boolean, verified boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  -- Auto-expire old posts
  update public.lfg_posts set status = 'expired'
    where status = 'open' and expires_at <= now();

  return query
    select
      l.id, l.user_id, l.game, l.mode, l.platform, l.region,
      l.mic_required, l.team_size, l.message, l.status,
      l.created_at, l.expires_at,
      p.username, p.avatar_url, p.xp, p.wagr_member, p.verified
    from public.lfg_posts l
    join public.profiles p on p.id = l.user_id
    where l.status = 'open' and l.expires_at > now()
      and (p_game     is null or l.game     = p_game)
      and (p_platform is null or l.platform = p_platform)
      and (p_region   is null or l.region   = p_region)
    order by l.created_at desc
    limit 50;
end $$;

grant execute on function public.create_lfg_post(text, text, text, text, boolean, int, text) to authenticated;
grant execute on function public.list_lfg_posts(text, text, text) to authenticated, anon;

-- ═══════════════════════════════════════════════════════════════
-- §2 — Ticket Escalation
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.escalation_tickets (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id),
  user_id uuid not null references public.profiles(id),
  reason text not null,
  status text not null default 'open' check (status in ('open','reviewing','resolved','rejected')),
  admin_notes text,
  resolution text,
  resolved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint one_escalation_per_user_per_match unique (match_id, user_id)
);

create index if not exists escalation_status_idx on public.escalation_tickets(status, created_at desc);

alter table public.escalation_tickets enable row level security;

drop policy if exists "escalation read own" on public.escalation_tickets;
create policy "escalation read own" on public.escalation_tickets for select
  using (user_id = auth.uid() or public.is_admin());

-- Escalate a settled/disputed cash match within 24 hours
create or replace function public.escalate_match(
  p_match uuid,
  p_reason text
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_m public.matches;
  v_id uuid;
  v_settled_at timestamptz;
begin
  select * into v_m from public.matches where id = p_match;
  if not found then raise exception 'match not found'; end if;

  -- Cash matches only
  if v_m.kind <> 'cash' then
    raise exception 'escalation is only available for cash matches';
  end if;

  -- Must be settled or disputed
  if v_m.status not in ('settled', 'disputed') then
    raise exception 'match must be settled or disputed to escalate';
  end if;

  -- Must be a participant
  if not exists (select 1 from public.match_players where match_id = p_match and user_id = auth.uid()) then
    raise exception 'only match participants can escalate';
  end if;

  -- Within 24 hours of settlement
  select updated_at into v_settled_at from public.matches where id = p_match;
  if v_settled_at is null then v_settled_at := v_m.created_at; end if;
  if now() - v_settled_at > interval '24 hours' then
    raise exception 'escalation window has closed (24 hours)';
  end if;

  -- One per user per match
  if exists (select 1 from public.escalation_tickets where match_id = p_match and user_id = auth.uid()) then
    raise exception 'you have already escalated this match';
  end if;

  insert into public.escalation_tickets(match_id, user_id, reason)
    values (p_match, auth.uid(), left(p_reason, 1000))
    returning id into v_id;

  -- Notify admins
  insert into public.notifications(user_id, text)
    select p.id, 'Escalation ticket opened for match #' || coalesce(v_m.code, v_m.id::text)
    from public.profiles p where p.is_admin = true;

  return v_id;
end $$;

-- Admin: resolve an escalation ticket
create or replace function public.resolve_escalation(
  p_ticket uuid,
  p_resolution text,
  p_notes text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_t public.escalation_tickets;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;

  select * into v_t from public.escalation_tickets where id = p_ticket for update;
  if not found then raise exception 'ticket not found'; end if;
  if v_t.status in ('resolved', 'rejected') then return; end if;

  update public.escalation_tickets
    set status = p_resolution, -- 'resolved' or 'rejected'
        admin_notes = p_notes,
        resolved_by = auth.uid(),
        resolved_at = now()
    where id = p_ticket;

  insert into public.notifications(user_id, text)
    values (v_t.user_id,
      'Your escalation ticket has been ' || p_resolution || '.' ||
      case when p_notes is not null and p_notes <> '' then ' Note: ' || left(p_notes, 200) else '' end
    );
end $$;

-- List escalation tickets (admin sees all, user sees own)
create or replace function public.list_escalation_tickets(p_status text default null)
returns table(
  id uuid, match_id uuid, user_id uuid, reason text, status text,
  admin_notes text, resolution text, resolved_by uuid,
  created_at timestamptz, resolved_at timestamptz,
  username text, match_code text, match_entry numeric
)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
    select
      t.id, t.match_id, t.user_id, t.reason, t.status,
      t.admin_notes, t.resolution, t.resolved_by,
      t.created_at, t.resolved_at,
      p.username,
      m.code as match_code,
      m.entry as match_entry
    from public.escalation_tickets t
    join public.profiles p on p.id = t.user_id
    join public.matches m on m.id = t.match_id
    where (public.is_admin() or t.user_id = auth.uid())
      and (p_status is null or t.status = p_status)
    order by t.created_at desc
    limit 100;
end $$;

-- Check if user can escalate a specific match
create or replace function public.can_escalate_match(p_match uuid)
returns table(can_escalate boolean, reason text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_m public.matches;
  v_settled_at timestamptz;
begin
  select * into v_m from public.matches where id = p_match;
  if not found then return query select false, 'match not found'; return; end if;
  if v_m.kind <> 'cash' then return query select false, 'xp matches cannot be escalated'; return; end if;
  if v_m.status not in ('settled', 'disputed') then return query select false, 'match not settled'; return; end if;
  if not exists (select 1 from public.match_players where match_id = p_match and user_id = auth.uid()) then
    return query select false, 'not a participant'; return;
  end if;
  select updated_at into v_settled_at from public.matches where id = p_match;
  if v_settled_at is null then v_settled_at := v_m.created_at; end if;
  if now() - v_settled_at > interval '24 hours' then
    return query select false, 'escalation window closed'; return;
  end if;
  if exists (select 1 from public.escalation_tickets where match_id = p_match and user_id = auth.uid()) then
    return query select false, 'already escalated'; return;
  end if;
  return query select true, 'eligible';
end $$;

grant execute on function public.escalate_match(uuid, text) to authenticated;
grant execute on function public.resolve_escalation(uuid, text, text) to authenticated;
grant execute on function public.list_escalation_tickets(text) to authenticated;
grant execute on function public.can_escalate_match(uuid) to authenticated;
