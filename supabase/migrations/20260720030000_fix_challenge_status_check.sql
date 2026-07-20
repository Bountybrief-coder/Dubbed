-- Challenge inserts use status='pending' but the original check constraint
-- rejected it (bug: "violates check constraint team_challenges_status_check").
-- Normalize any legacy value and widen the constraint to the full status set
-- the app actually uses.
alter table public.team_challenges drop constraint if exists team_challenges_status_check;

update public.team_challenges set status = 'pending'
  where status is null or status not in ('pending','accepted','declined','cancelled','expired','completed','open');

alter table public.team_challenges
  add constraint team_challenges_status_check
  check (status in ('pending','accepted','declined','cancelled','expired','completed','open'));

alter table public.team_challenges alter column status set default 'pending';
