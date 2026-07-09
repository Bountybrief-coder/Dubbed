import { supabase } from "../lib/supabase";

export async function placeBet({ target, market, stake, odds, matchId }) {
  const params = {
    p_target: target,
    p_market: market,
    p_stake: Number(stake),
    p_odds: Number(odds)
  };
  if (matchId) params.p_match_id = matchId;
  const { data, error } = await supabase.rpc("place_bet", params);
  return { data, error: error?.message };
}

export async function getMyBets(userId) {
  const { data, error } = await supabase
    .from("bets")
    .select("id, target, market, stake, odds, status, match_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return { data: data || [], error: error?.message };
}

export async function getBetsForMatch(matchId) {
  const { data, error } = await supabase
    .from("bets")
    .select("id, user_id, target, market, stake, odds, status, created_at")
    .eq("match_id", matchId)
    .order("created_at", { ascending: false });
  return { data: data || [], error: error?.message };
}

export async function settleBet(betId, outcome) {
  const { error } = await supabase.rpc("settle_bet", {
    p_bet: betId,
    p_outcome: outcome
  });
  return { error: error?.message };
}

export function subscribeToBets(matchId, onChange) {
  const channel = supabase
    .channel(`bets:${matchId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "bets", filter: `match_id=eq.${matchId}` },
      onChange
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
