import { supabase } from "../lib/supabase";

export async function getCurrentSeason() {
  const { data, error } = await supabase.rpc("get_current_season");
  return { data: data?.[0] || null, error: error?.message };
}

export async function listSeasons() {
  const { data, error } = await supabase.rpc("list_seasons");
  return { data: data || [], error: error?.message };
}

export async function getSeasonLeaderboard(seasonId, metric = "xp", { region, platform, limit = 100 } = {}) {
  const { data, error } = await supabase.rpc("get_season_leaderboard", {
    p_season: seasonId,
    p_metric: metric,
    p_region: region || null,
    p_platform: platform || null,
    p_limit: limit,
  });
  return { data: data || [], error: error?.message };
}

export async function getMySeasonRank(seasonId, metric = "xp") {
  const { data, error } = await supabase.rpc("get_my_season_rank", {
    p_season: seasonId,
    p_metric: metric,
  });
  return { data: data?.[0] || null, error: error?.message };
}

export async function adminCreateSeason({ name, startDate, endDate, playoffSize = 8, prizePool = 0 }) {
  const { data, error } = await supabase.rpc("admin_create_season", {
    p_name: name,
    p_start: startDate,
    p_end: endDate,
    p_playoff_size: playoffSize,
    p_prize_pool: prizePool,
  });
  return { id: data, error: error?.message };
}

export async function adminEndSeason(seasonId) {
  const { data, error } = await supabase.rpc("end_season", { p_season: seasonId });
  return { tournamentId: data, error: error?.message };
}
