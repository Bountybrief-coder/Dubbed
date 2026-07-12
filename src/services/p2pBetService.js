import { supabase } from "../lib/supabase";

export async function createBetOffer(section, eventRef, market, creatorPick, stake, locksAt) {
  const { data, error } = await supabase.rpc("create_bet_offer", {
    p_section: section, p_event_ref: eventRef, p_market: market,
    p_creator_pick: creatorPick, p_stake: stake, p_locks_at: locksAt || null,
  });
  return { data, error: error?.message };
}

export async function acceptBetOffer(offerId) {
  const { error } = await supabase.rpc("accept_bet_offer", { p_offer: offerId });
  return { error: error?.message };
}

export async function cancelBetOffer(offerId) {
  const { error } = await supabase.rpc("cancel_bet_offer", { p_offer: offerId });
  return { error: error?.message };
}

export async function settleBetOffer(offerId, winner) {
  const { error } = await supabase.rpc("settle_bet_offer", { p_offer: offerId, p_winner: winner });
  return { error: error?.message };
}

export async function voidBetOffer(offerId) {
  const { error } = await supabase.rpc("void_bet_offer", { p_offer: offerId });
  return { error: error?.message };
}

export async function getOpenOffers(section) {
  let q = supabase.from("bet_offers")
    .select("*, creator:profiles!bet_offers_creator_id_fkey(username, avatar_url), acceptor:profiles!bet_offers_acceptor_id_fkey(username, avatar_url)")
    .in("status", ["open", "matched"])
    .order("created_at", { ascending: false })
    .limit(50);
  if (section) q = q.eq("section", section);
  const { data, error } = await q;
  return { data: data || [], error: error?.message };
}

export async function getMyOffers(userId) {
  const { data, error } = await supabase.from("bet_offers")
    .select("*, creator:profiles!bet_offers_creator_id_fkey(username, avatar_url), acceptor:profiles!bet_offers_acceptor_id_fkey(username, avatar_url)")
    .or(`creator_id.eq.${userId},acceptor_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(50);
  return { data: data || [], error: error?.message };
}

export async function getAllOffers(statusFilter) {
  let q = supabase.from("bet_offers")
    .select("*, creator:profiles!bet_offers_creator_id_fkey(username, avatar_url), acceptor:profiles!bet_offers_acceptor_id_fkey(username, avatar_url)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (statusFilter) q = q.eq("status", statusFilter);
  const { data, error } = await q;
  return { data: data || [], error: error?.message };
}

export function subscribeToBetOffers(onChange) {
  const sub = supabase
    .channel("bet_offers_rt")
    .on("postgres_changes", { event: "*", schema: "public", table: "bet_offers" }, (payload) => onChange(payload))
    .subscribe();
  return () => supabase.removeChannel(sub);
}
