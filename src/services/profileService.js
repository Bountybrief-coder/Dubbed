import { supabase } from "../lib/supabase";
import { validateUsername } from "../utils/validation";

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  return { data, error: error?.message };
}

export async function getProfileByUsername(username) {
  if (!username) return { data: null, error: "No username" };
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("username_lower", username.toLowerCase())
    .maybeSingle();
  return { data, error: error?.message };
}

// Only non-money, non-stat fields. Balance/xp/wins are locked at the DB level.
export async function updateProfile(userId, patch) {
  const allowed = {};
  for (const k of ["avatar_url", "psn", "xbox", "activision_id", "twitter", "youtube", "twitch_username", "region", "platform", "favorite_game", "favorite_mode"]) {
    if (k in patch) allowed[k] = patch[k];
  }
  const { data, error } = await supabase
    .from("profiles")
    .update(allowed)
    .eq("id", userId)
    .select()
    .maybeSingle();
  return { data, error: error?.message };
}

export async function searchUsers(query, limit = 8) {
  if (!query?.trim()) return { data: [] };
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, xp, avatar_url")
    .ilike("username", `%${query}%`)
    .limit(limit);
  return { data: data || [], error: error?.message };
}

export async function isUsernameTaken(username) {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("username_lower", username.toLowerCase())
    .maybeSingle();
  return Boolean(data);
}

// Username change goes through an RPC so the uniqueness + rules are enforced
// server-side (and can be tied to a paid shop item later).
export async function changeUsername(newName) {
  const err = validateUsername(newName);
  if (err) return { error: err };
  const { error } = await supabase.rpc("change_username", { p_new: newName });
  return { error: error?.message };
}

export async function getStreamers() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, xp, wins, losses, earnings, twitch_username, wagr_member")
    .not("twitch_username", "is", null)
    .neq("twitch_username", "")
    .order("xp", { ascending: false });
  return { data: data || [], error: error?.message };
}

export async function getRecords(userId) {
  const { data, error } = await supabase
    .from("records")
    .select("*")
    .eq("user_id", userId)
    .order("game");
  return { data: data || [], error: error?.message };
}

export async function getTrophies(userId) {
  const { data, error } = await supabase
    .from("trophies")
    .select("*")
    .eq("user_id", userId)
    .order("earned_at", { ascending: false });
  return { data: data || [], error: error?.message };
}

export async function getTrophyCounts(userId) {
  const { data, error } = await supabase
    .from("trophies")
    .select("tone, place")
    .eq("user_id", userId);
  const rows = data || [];
  const counts = { gold: 0, silver: 0, bronze: 0 };
  for (const t of rows) {
    const tone = t.tone || (t.place === 1 ? "gold" : t.place === 2 ? "silver" : t.place === 3 ? "bronze" : null);
    if (tone && counts[tone] != null) counts[tone] += 1;
  }
  return { data: counts, error: error?.message };
}

export async function getRecentMatches(userId, limit = 5) {
  const { data, error } = await supabase
    .from("match_players")
    .select("match_id, matches!inner(id, status, winner_id, created_at)")
    .eq("user_id", userId)
    .eq("matches.status", "settled")
    .order("matches(created_at)", { ascending: false })
    .limit(limit);
  const rows = (data || []).map((r) => ({
    matchId: r.match_id,
    won: r.matches?.winner_id === userId,
    xp: r.matches?.winner_id === userId ? 25 : -15
  }));
  return { data: rows, error: error?.message };
}
