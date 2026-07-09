import { supabase } from "../lib/supabase";

const T_SELECT =
  "id, name, game, mode, format, entry, capacity, region, starts_at, status, created_at, winner_name, second_name, third_name, " +
  "platform, skill_tier, series, weapon_restriction, host_rule, bracket_generated";

export async function listTournaments() {
  const { data, error } = await supabase
    .from("tournaments")
    .select(`${T_SELECT}, tournament_entries(count)`)
    .order("starts_at", { ascending: true });
  const rows = (data || []).map((t) => ({
    ...t,
    entries_count: t.tournament_entries?.[0]?.count ?? 0
  }));
  return { data: rows, error: error?.message };
}

export async function getTournament(id) {
  const { data, error } = await supabase
    .from("tournaments")
    .select(`${T_SELECT}, tournament_entries(entrant_name, user_id, paid, placed)`)
    .eq("id", id)
    .maybeSingle();
  return { data, error: error?.message };
}

export async function joinTournament(tournamentId, entrantName) {
  const { error } = await supabase.rpc("join_tournament", {
    p_tournament: tournamentId,
    p_entrant: entrantName
  });
  return { error: error?.message };
}

export function pooledPrize(entry, joined) {
  const n = Math.max(0, joined || 0);
  const gross = Number(entry) * n;
  const houseCut = Math.round(gross * 0.02 * 100) / 100;
  const pot = Math.round((gross - houseCut) * 100) / 100;
  let first, second, third;
  if (n <= 2) {
    first = pot; second = 0; third = 0;
  } else if (n < 8) {
    first = Math.round(pot * 0.85 * 100) / 100;
    second = Math.round(pot * 0.15 * 100) / 100;
    third = 0;
  } else {
    first = Math.round(pot * 0.80 * 100) / 100;
    second = Math.round(pot * 0.15 * 100) / 100;
    third = Math.round(pot * 0.05 * 100) / 100;
  }
  return { gross, houseCut, pot, first, second, third };
}

// ---------------------------------------------------------------------------
// Bracket
// ---------------------------------------------------------------------------
export async function getTournamentBracket(tournamentId) {
  const [r, m] = await Promise.all([
    supabase.from("tournament_rounds").select("*").eq("tournament_id", tournamentId).order("round_number"),
    supabase.from("tournament_matches").select("*, match:match_id(id, code, status, winner_id)")
      .eq("tournament_id", tournamentId).order("match_number")
  ]);
  return { rounds: r.data || [], matches: m.data || [], error: r.error?.message || m.error?.message };
}

export async function adminGenerateBracket(tournamentId) {
  const { error } = await supabase.rpc("generate_bracket", { p_tournament: tournamentId });
  return { error: error?.message };
}

export async function startTournamentMatch(tmId) {
  const { data, error } = await supabase.rpc("start_tournament_match", { p_tm_id: tmId });
  return { matchId: data, error: error?.message };
}

export function subscribeToTournamentMatches(tournamentId, onChange) {
  const channel = supabase
    .channel(`tourney-matches:${tournamentId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "tournament_matches", filter: `tournament_id=eq.${tournamentId}` }, onChange)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tournaments", filter: `id=eq.${tournamentId}` }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export async function adminCreateTournament(params) {
  const { data, error } = await supabase.rpc("admin_create_tournament", {
    p_name: params.name, p_game: params.game, p_mode: params.mode, p_format: params.format,
    p_series: params.series, p_region: params.region, p_entry: Number(params.entry),
    p_capacity: Number(params.capacity), p_platform: params.platform, p_skill_tier: params.skillTier,
    p_starts_at: params.startsAt, p_weapon_restriction: params.weaponRestriction || null,
    p_host_rule: params.hostRule || "auto"
  });
  return { id: data, error: error?.message };
}
