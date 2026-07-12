-- Add missing grants for P2P bet offer RPCs
grant execute on function public.create_bet_offer(text,text,text,text,numeric,timestamptz) to authenticated;
grant execute on function public.accept_bet_offer(uuid) to authenticated;
grant execute on function public.cancel_bet_offer(uuid) to authenticated;
grant execute on function public.settle_bet_offer(uuid,text) to authenticated;
grant execute on function public.void_bet_offer(uuid) to authenticated;
