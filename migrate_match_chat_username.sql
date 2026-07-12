-- Fix match chat username spoofing: force real username from profile on insert.
-- System messages (kind='system') are inserted by SECURITY DEFINER RPCs and keep
-- their username (typically 'System'). User messages get the real profile username.

create or replace function public.match_msg_set_username()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_real text;
begin
  if NEW.kind = 'msg' then
    select username into v_real from public.profiles where id = NEW.user_id;
    if v_real is not null then
      NEW.username := v_real;
    end if;
  end if;
  return NEW;
end $$;

drop trigger if exists match_msg_username_trg on public.match_messages;
create trigger match_msg_username_trg
  before insert on public.match_messages
  for each row execute function public.match_msg_set_username();
