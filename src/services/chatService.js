import { supabase } from "../lib/supabase";
import { sanitizeMessage } from "../utils/format";

export async function getMessages(channel, limit = 60) {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, channel, user_id, username, text, kind, created_at, profiles(wagr_member)")
    .eq("channel", channel)
    .order("created_at", { ascending: false })
    .limit(limit);
  return { data: (data || []).reverse(), error: error?.message };
}

export async function sendMessage(channel, username, text) {
  const clean = sanitizeMessage(text);
  if (!clean) return { error: "Message is empty." };
  const { error } = await supabase.rpc("send_chat_message", {
    p_channel: channel, p_text: clean,
  });
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

// ── Bet Events ──

export async function getBetEvents(statusFilter) {
  let q = supabase.from("bet_events").select("*").order("created_at", { ascending: false }).limit(50);
  if (statusFilter) q = q.eq("status", statusFilter);
  const { data, error } = await q;
  return { data: data || [], error: error?.message };
}

export async function getOpenBetEvents() {
  const { data, error } = await supabase
    .from("bet_events")
    .select("*")
    .in("status", ["open", "locked"])
    .order("created_at", { ascending: false })
    .limit(20);
  return { data: data || [], error: error?.message };
}

export async function placeSideBet(eventId, selection, stake) {
  const { data, error } = await supabase.rpc("place_side_bet", {
    p_event: eventId, p_selection: selection, p_stake: stake,
  });
  return { data, error: error?.message };
}

export async function getMySideBets() {
  const { data, error } = await supabase
    .from("side_bets")
    .select("*, bet_events(title, status, winner_option)")
    .order("created_at", { ascending: false })
    .limit(50);
  return { data: data || [], error: error?.message };
}

export function subscribeToBetEvents(onChange) {
  const sub = supabase
    .channel("bet_events_rt")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "bet_events" },
      (payload) => onChange(payload)
    )
    .subscribe();
  return () => supabase.removeChannel(sub);
}

export function subscribeToSideBets(onChange) {
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

// ── Admin RPCs ──

export async function createBetEvent(title, description, market, options, odds, locksAt) {
  const { data, error } = await supabase.rpc("create_bet_event", {
    p_title: title, p_description: description || "", p_market: market,
    p_options: options, p_odds: odds, p_locks_at: locksAt || null,
  });
  return { data, error: error?.message };
}

export async function lockBetEvent(eventId) {
  const { error } = await supabase.rpc("lock_bet_event", { p_event: eventId });
  return { error: error?.message };
}

export async function settleBetEvent(eventId, winnerOption) {
  const { error } = await supabase.rpc("settle_bet_event", {
    p_event: eventId, p_winner_option: winnerOption,
  });
  return { error: error?.message };
}

export async function voidBetEvent(eventId) {
  const { error } = await supabase.rpc("void_bet_event", { p_event: eventId });
  return { error: error?.message };
}
