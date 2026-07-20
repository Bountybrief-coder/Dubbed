-- TEMP (dropped next migration): expose function EXECUTE grants so we can
-- audit which SECURITY DEFINER money functions are callable by regular users.
create or replace function public._inspect_acl()
returns table(fn text, sec_definer boolean, acl text)
language sql
security definer
set search_path = public
as $$
  select p.proname::text,
         p.prosecdef,
         coalesce(array_to_string(p.proacl::text[], ' | '), '(NULL = PUBLIC EXECUTE)')
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
  order by p.proname;
$$;
grant execute on function public._inspect_acl() to anon, authenticated;
