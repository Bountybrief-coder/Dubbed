import { supabase } from "../lib/supabase";
import { sanitizeMessage } from "../utils/format";

export async function getMatchMessages(matchId, limit = 100) {
  const { data, error } = await supabase
    .from("match_messages")
    .select("id, match_id, user_id, username, text, kind, created_at, profiles(wagr_member)")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true })
    .limit(limit);
  return { data: data || [], error: error?.message };
}

export async function sendMatchMessage(matchId, userId, username, text) {
  const clean = sanitizeMessage(text);
  if (!clean) return { error: "Message is empty." };
  const { error } = await supabase
    .from("match_messages")
    .insert({ match_id: matchId, user_id: userId, username, text: clean });
  return { error: error?.message };
}

export function subscribeToMatchMessages(matchId, onInsert) {
  const channel = supabase
    .channel(`match-chat:${matchId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "match_messages", filter: `match_id=eq.${matchId}` },
      (payload) => onInsert(payload.new)
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
