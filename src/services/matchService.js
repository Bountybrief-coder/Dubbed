import { supabase } from "../lib/supabase";

const MATCH_SELECT =
  "id, code, match_number, game, mode, format, region, entry, kind, status, created_by, winner_id, created_at, accepted_at, " +
  "platform, skill_tier, series, weapon_restriction, host_region, host_rule, veto_status, veto, team_name, map, allowed_input";

export async function listOpenMatches({ kind, game } = {}) {
  let q = supabase
    .from("matches")
    .select(MATCH_SELECT)
    .eq("status", "open")
    .order("created_at", { ascending: false });
  if (kind) q = q.eq("kind", kind);
  if (game) q = q.eq("game", game);
  const { data, error } = await q;
  return { data: data || [], error: error?.message };
}

export async function getMatch(matchId) {
  const { data, error } = await supabase
    .from("matches")
    .select(`${MATCH_SELECT}, match_players(user_id, region, team_id, team_name, profiles(username, avatar_url, wagr_member, xp, wins, losses, earnings, psn, xbox, activision_id, twitter, youtube, twitch_username))`)
    .eq("id", matchId)
    .maybeSingle();
  return { data, error: error?.message };
}

export async function getMyMatches(userId) {
  // Matches where I'm a participant.
  const { data, error } = await supabase
    .from("matches")
    .select(`${MATCH_SELECT}, match_players!inner(user_id)`)
    .eq("match_players.user_id", userId)
    .order("created_at", { ascending: false });
  return { data: data || [], error: error?.message };
}

// All money/state transitions run through RPCs (SECURITY DEFINER) so the client
// never edits balances or match status directly.
export async function createMatch({
  game, mode, format, region, entry, kind,
  platform = "PC + Console Mixed", skillTier = "Open", series = "Best of 1",
  weaponRestriction = null, hostRule = "auto", teamId = null, map = null,
  vetoBan = null, mapPool = null, allowedInput = "Controller + M&K",
  roster = null
}) {
  const params = {
    p_game: game,
    p_mode: mode,
    p_format: format,
    p_region: region,
    p_entry: kind === "cash" ? Number(entry) : 0,
    p_kind: kind,
    p_platform: platform,
    p_skill_tier: skillTier,
    p_series: series,
    p_weapon_restriction: weaponRestriction,
    p_host_rule: hostRule,
    p_allowed_input: allowedInput
  };
  if (teamId) params.p_team_id = teamId;
  if (map) params.p_map = map;
  if (vetoBan) params.p_veto_ban = vetoBan;
  if (mapPool) params.p_map_pool = mapPool;
  if (roster && roster.length > 0) params.p_roster = roster;
  const { data, error } = await supabase.rpc("create_match", params);
  return { data, error: error?.message };
}

// Map veto — cast a ban/pick for the current turn.
export async function submitVeto(matchId, map) {
  const { data, error } = await supabase.rpc("veto_action", { p_match: matchId, p_map: map });
  return { data, error: error?.message };
}

export async function requestMatchCancel(matchId, reason) {
  const { data, error } = await supabase.rpc("request_match_cancel", { p_match: matchId, p_reason: reason || null });
  return { data, error: error?.message };
}

export async function respondMatchCancel(requestId, accept) {
  const { error } = await supabase.rpc("respond_match_cancel", { p_request: requestId, p_accept: accept });
  return { error: error?.message };
}

export async function getCancelRequest(matchId) {
  const { data, error } = await supabase
    .from("match_cancel_requests")
    .select("id, match_id, requested_by, reason, status, created_at")
    .eq("match_id", matchId)
    .eq("status", "pending")
    .maybeSingle();
  return { data, error: error?.message };
}

export function subscribeToCancelRequests(matchId, onChange) {
  const channel = supabase
    .channel(`match-cancel:${matchId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "match_cancel_requests", filter: `match_id=eq.${matchId}` },
      onChange
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export async function joinMatch(matchId, vetoBan, roster) {
  const params = { p_match: matchId };
  if (vetoBan) params.p_veto_ban = vetoBan;
  if (roster && roster.length > 0) params.p_roster = roster;
  const { error } = await supabase.rpc("join_match", params);
  return { error: error?.message };
}

export async function reportMatch(matchId, { winnerId, score, evidenceUrl }) {
  const { error } = await supabase.rpc("report_match", {
    p_match: matchId,
    p_winner: winnerId,
    p_score: score || null,
    p_evidence_url: evidenceUrl || null
  });
  return { error: error?.message };
}

export async function openDispute(matchId, { reason, evidenceUrl }) {
  const { data, error } = await supabase.rpc("open_dispute", {
    p_match: matchId,
    p_reason: reason,
    p_evidence_url: evidenceUrl || null
  });
  return { data, error: error?.message };
}

export async function getMatchDispute(matchId) {
  const { data, error } = await supabase.rpc("get_match_dispute", { p_match: matchId });
  return { data: data?.[0] || null, error: error?.message };
}

export async function submitDisputeProof(matchId, evidenceUrl, notes) {
  const { error } = await supabase.rpc("submit_dispute_proof", {
    p_match: matchId,
    p_evidence_url: evidenceUrl,
    p_notes: notes || null
  });
  return { error: error?.message };
}

export async function adminAwardMatch(matchId, winnerId, note) {
  const { error } = await supabase.rpc("admin_award_match", {
    p_match: matchId,
    p_winner: winnerId,
    p_note: note || null
  });
  return { error: error?.message };
}

export async function getTournamentContext(matchId) {
  const { data, error } = await supabase
    .from("tournament_matches")
    .select("tournament_id, match_number, round_id, tournament_rounds(round_name, round_number), tournaments(name)")
    .eq("match_id", matchId)
    .maybeSingle();
  if (!data) return { data: null, error: error?.message };
  return {
    data: {
      tournamentId: data.tournament_id,
      tournamentName: data.tournaments?.name,
      roundName: data.tournament_rounds?.round_name,
      roundNumber: data.tournament_rounds?.round_number,
      matchNumber: data.match_number,
    },
    error: null,
  };
}

export function subscribeToMatch(matchId, onChange) {
  const channel = supabase
    .channel(`match:${matchId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "matches", filter: `id=eq.${matchId}` },
      onChange
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export function subscribeToOpenMatches(onChange) {
  const channel = supabase
    .channel("open-matches")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "matches" },
      (payload) => onChange(payload)
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
