import { supabase } from "../lib/supabase";
import { sanitizeMessage } from "../utils/format";

export async function getMessages(channel, limit = 60) {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, channel, user_id, username, text, kind, created_at")
    .eq("channel", channel)
    .order("created_at", { ascending: false })
    .limit(limit);
  return { data: (data || []).reverse(), error: error?.message };
}

export async function sendMessage(channel, username, text, kind = "msg") {
  const clean = sanitizeMessage(text);
  if (!clean) return { error: "Message is empty." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not logged in." };
  const { error } = await supabase
    .from("chat_messages")
    .insert({ channel, username, text: clean, kind, user_id: user.id });
  return { error: error?.message };
}

export function subscribeToChannel(channel, onInsert) {
  const sub = supabase
    .channel(`chat:${channel}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "chat_messages", filter: `channel=eq.${channel}` },
      (payload) => onInsert(payload.new)
    )
    .subscribe();
  return () => supabase.removeChannel(sub);
}

export async function getOpenBets() {
  const { data, error } = await supabase
    .from("side_bets")
    .select("*")
    .in("status", ["open", "matched"])
    .order("created_at", { ascending: false })
    .limit(30);
  return { data: data || [], error: error?.message };
}

export async function proposeSideBet(pick, market, stake) {
  const { data, error } = await supabase.rpc("propose_side_bet", {
    p_pick: pick, p_market: market, p_stake: stake,
  });
  return { data, error: error?.message };
}

export async function acceptSideBet(betId, pick) {
  const { error } = await supabase.rpc("accept_side_bet", {
    p_bet: betId, p_pick: pick,
  });
  return { error: error?.message };
}

export async function cancelSideBet(betId) {
  const { error } = await supabase.rpc("cancel_side_bet", { p_bet: betId });
  return { error: error?.message };
}

export function subscribeToBets(onChange) {
  const sub = supabase
    .channel("side_bets_rt")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "side_bets" },
      (payload) => onChange(payload)
    )
    .subscribe();
  return () => supabase.removeChannel(sub);
}
