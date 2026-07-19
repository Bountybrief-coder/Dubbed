import { supabase } from "../lib/supabase";

export async function getLeaderboard(metric = "xp", { region, platform, limit = 100 } = {}) {
  const { data, error } = await supabase.rpc("get_leaderboard", {
    p_metric: metric,
    p_region: region || null,
    p_platform: platform || null,
    p_limit: limit,
  });
  return { data: data || [], error: error?.message };
}

export async function getMyRank(metric = "xp", { region, platform } = {}) {
  const { data, error } = await supabase.rpc("get_my_rank", {
    p_metric: metric,
    p_region: region || null,
    p_platform: platform || null,
  });
  return { data: data?.[0] || null, error: error?.message };
}

export async function getWeeklyTopPlayers(weekStart) {
  const { data, error } = await supabase
    .from("weekly_stats")
    .select("user_id, xp_gained, earnings_gained, wins, losses, profiles(username, avatar_url, xp, wagr_member, country)")
    .eq("week_start", weekStart)
    .order("xp_gained", { ascending: false })
    .limit(3);
  return { data: data || [], error: error?.message };
}

export async function getTimedLeaderboard(metric = "xp", since, { region, platform, limit = 100 } = {}) {
  const { data, error } = await supabase.rpc("get_timed_leaderboard", {
    p_metric: metric,
    p_since: since,
    p_region: region || null,
    p_platform: platform || null,
    p_limit: limit,
  });
  return { data: data || [], error: error?.message };
}

export async function getMyTimedRank(metric = "xp", since, { region, platform } = {}) {
  const { data, error } = await supabase.rpc("get_my_timed_rank", {
    p_metric: metric,
    p_since: since,
    p_region: region || null,
    p_platform: platform || null,
  });
  return { data: data?.[0] || null, error: error?.message };
}

export async function getWeeklyRewards(weekStart) {
  const { data, error } = await supabase
    .from("weekly_rewards")
    .select("user_id, credits, profiles(username, avatar_url, country, xp)")
    .eq("week_start", weekStart)
    .order("credits", { ascending: false })
    .limit(3);
  return { data: data || [], error: error?.message };
}
