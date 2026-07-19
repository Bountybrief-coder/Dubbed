-- Team crests: a logo image + an accent color on teams, plus a public
-- storage bucket that only the team owner can write to.
--
-- Path convention for crest objects: '<team_id>/crest.<ext>'
-- so (storage.foldername(name))[1] = the team id.

-- §1 — Columns
alter table public.teams add column if not exists logo_url text;
alter table public.teams add column if not exists color text;

-- §2 — Public bucket for crests
insert into storage.buckets (id, name, public)
values ('team-crests', 'team-crests', true)
on conflict (id) do nothing;

-- §3 — Storage policies
-- Anyone can view crests (public bucket).
drop policy if exists "team crests read" on storage.objects;
create policy "team crests read" on storage.objects
  for select using (bucket_id = 'team-crests');

-- Only the owner of the team whose id prefixes the path can upload.
drop policy if exists "team crests insert" on storage.objects;
create policy "team crests insert" on storage.objects
  for insert with check (
    bucket_id = 'team-crests'
    and (storage.foldername(name))[1] in (
      select id::text from public.teams where owner_id = auth.uid()
    )
  );

drop policy if exists "team crests update" on storage.objects;
create policy "team crests update" on storage.objects
  for update using (
    bucket_id = 'team-crests'
    and (storage.foldername(name))[1] in (
      select id::text from public.teams where owner_id = auth.uid()
    )
  );

drop policy if exists "team crests delete" on storage.objects;
create policy "team crests delete" on storage.objects
  for delete using (
    bucket_id = 'team-crests'
    and (storage.foldername(name))[1] in (
      select id::text from public.teams where owner_id = auth.uid()
    )
  );
