-- TEMP introspection helper (dropped in the next migration) — used to audit
-- money-flow function bodies that live only in the DB (e.g. accept_challenge).
create or replace function public._inspect_all_fns()
returns table(name text, def text)
language sql
security definer
set search_path = public
as $$
  select p.proname::text, pg_get_functiondef(p.oid)
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
  order by p.proname;
$$;
grant execute on function public._inspect_all_fns() to anon, authenticated;
