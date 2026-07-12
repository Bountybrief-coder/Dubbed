-- Fix: Enable RLS on 3 tables that were missing it
-- tournament_templates, tournament_schedules, tournament_log are admin/system tables

alter table public.tournament_templates enable row level security;
drop policy if exists "tt admin" on public.tournament_templates;
create policy "tt admin" on public.tournament_templates for all using (public.is_admin());

alter table public.tournament_schedules enable row level security;
drop policy if exists "ts admin" on public.tournament_schedules;
create policy "ts admin" on public.tournament_schedules for all using (public.is_admin());

alter table public.tournament_log enable row level security;
drop policy if exists "tlog read" on public.tournament_log;
create policy "tlog read" on public.tournament_log for select using (public.is_admin());
