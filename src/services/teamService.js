import { supabase } from "../lib/supabase";

// The team-crests migration adds teams.logo_url / teams.color. Until it's
// applied, selecting those columns 400s. These helpers let the app run either
// way: try with the crest columns, and on a "column does not exist" error,
// transparently retry without them.
const isMissingCrestCols = (err) =>
  !!err && /logo_url|color/i.test(err) && /does not exist/i.test(err);
const stripCrestCols = (sel) => sel.replace("logo_url, color, ", "");

export async function getMyTeams(userId) {
  const sel = "team_id, role, teams(id, name, tag, type, game, platform, size, owner_id, created_at, logo_url, color, wins, losses, earnings, xp, tourney_wins, tourney_losses, team_members(user_id, role, profiles(username, avatar_url, xp, wagr_member, country, wins, losses)))";
  let { data, error } = await supabase.from("team_members").select(sel).eq("user_id", userId);
  if (error && isMissingCrestCols(error.message)) {
    ({ data, error } = await supabase.from("team_members").select(stripCrestCols(sel)).eq("user_id", userId));
  }
  const teams = (data || []).map(d => ({ ...d.teams, myRole: d.role }));
  return { data: teams, error: error?.message };
}

// Browse other teams to challenge (ladder). Teams are publicly readable.
// Excludes teams the current user is already a member of.
export async function browseTeams({ game, size, type, excludeUserId, limit = 60 } = {}) {
  const sel = "id, name, tag, type, game, platform, size, owner_id, logo_url, color, wins, losses, earnings, xp, tourney_wins, tourney_losses, team_members(user_id, role, profiles(username, avatar_url, xp, wagr_member, country, wins, losses))";
  const run = (s) => {
    let q = supabase.from("teams").select(s)
      .order("wins", { ascending: false }).order("xp", { ascending: false }).limit(limit);
    if (game) q = q.eq("game", game);
    if (size) q = q.eq("size", Number(size));
    if (type) q = q.eq("type", type);
    return q;
  };
  let { data, error } = await run(sel);
  if (error && isMissingCrestCols(error.message)) ({ data, error } = await run(stripCrestCols(sel)));
  let teams = data || [];
  if (excludeUserId) {
    teams = teams.filter((t) => !(t.team_members || []).some((m) => m.user_id === excludeUserId));
  }
  return { data: teams, error: error?.message };
}

// Owner-only: save a team's crest image and/or accent color.
export async function updateTeamCrest(teamId, { logo_url, color }) {
  const patch = {};
  if (logo_url !== undefined) patch.logo_url = logo_url;
  if (color !== undefined) patch.color = color;
  const { error } = await supabase.from("teams").update(patch).eq("id", teamId);
  return { error: error?.message };
}

export async function getTeam(teamId) {
  const { data, error } = await supabase
    .from("teams")
    .select("*, team_members(user_id, role, profiles(username, avatar_url, xp, wagr_member, country, wins, losses)), team_invites(user_id, profiles(username))")
    .eq("id", teamId)
    .maybeSingle();
  return { data, error: error?.message };
}

export async function createTeam({ name, tag, type, game, platform = null, size = 1, color = null }) {
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) return { error: "Not authenticated" };
  const row = { name, tag: (tag || name.slice(0, 3)).toUpperCase(), type, game, size, owner_id: user.id };
  if (platform) row.platform = platform;
  if (color) row.color = color;
  let { data: team, error } = await supabase.from("teams").insert(row).select().maybeSingle();
  if (error && isMissingCrestCols(error.message)) {
    // team-crests migration not applied — create without the color.
    const { color: _omit, ...rowNoColor } = row;
    ({ data: team, error } = await supabase.from("teams").insert(rowNoColor).select().maybeSingle());
  }
  if (error) return { error: error.message };

  const { error: memErr } = await supabase
    .from("team_members")
    .insert({ team_id: team.id, user_id: team.owner_id, role: "owner" });
  if (memErr) return { error: memErr.message };
  return { data: team };
}

export async function inviteToTeam(teamId, username) {
  // Resolve username → id, then insert an invite row.
  const { data: user } = await supabase
    .from("profiles")
    .select("id")
    .eq("username_lower", username.toLowerCase())
    .maybeSingle();
  if (!user) return { error: "No user with that username." };

  const { error } = await supabase
    .from("team_invites")
    .insert({ team_id: teamId, user_id: user.id });
  if (error) return { error: error.message };
  return { data: true };
}

export async function getMyInvites(userId) {
  const { data, error } = await supabase
    .from("team_invites")
    .select("team_id, teams(id, name, tag, type, owner_id, profiles:owner_id(username))")
    .eq("user_id", userId);
  return { data: data || [], error: error?.message };
}

export async function acceptInvite(teamId, userId) {
  const { error } = await supabase
    .from("team_members")
    .insert({ team_id: teamId, user_id: userId, role: "member" });
  if (error) return { error: error.message };
  await supabase.from("team_invites").delete().match({ team_id: teamId, user_id: userId });
  return { data: true };
}

export async function declineInvite(teamId, userId) {
  const { error } = await supabase
    .from("team_invites")
    .delete()
    .match({ team_id: teamId, user_id: userId });
  return { error: error?.message };
}

export async function leaveTeam(teamId, userId) {
  const { error } = await supabase
    .from("team_members")
    .delete()
    .match({ team_id: teamId, user_id: userId });
  return { error: error?.message };
}

export async function disbandTeam(teamId) {
  const { error } = await supabase
    .from("teams")
    .delete()
    .eq("id", teamId);
  return { error: error?.message };
}

export async function getTeamActiveMatches(teamId) {
  const { data: mp } = await supabase
    .from("match_players")
    .select("match_id")
    .eq("team_id", teamId);
  if (!mp || mp.length === 0) return { data: [] };
  const matchIds = [...new Set(mp.map((r) => r.match_id))];
  const { data, error } = await supabase
    .from("matches")
    .select("id, code, game, mode, format, region, entry, kind, status, created_by, platform, skill_tier, series, host_region, host_rule, veto_status, veto, match_players(user_id, region, team_name, profiles(username, avatar_url))")
    .in("id", matchIds)
    .in("status", ["open", "live", "reported", "disputed"])
    .order("created_at", { ascending: false });
  return { data: data || [], error: error?.message };
}

export async function getTeamMatchHistory(teamId, limit = 10) {
  const { data, error } = await supabase
    .from("team_match_history")
    .select("id, match_id, tournament_id, result, earnings, xp_earned, settled_at, opponent_team_id, opponent:opponent_team_id(name, tag)")
    .eq("team_id", teamId)
    .order("settled_at", { ascending: false })
    .limit(limit);
  return { data: data || [], error: error?.message };
}

export function subscribeToTeamMatches(teamId, onChange) {
  const channel = supabase
    .channel(`team-matches:${teamId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "team_match_history", filter: `team_id=eq.${teamId}` }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export async function getUserTeams(userId) {
  let { data, error } = await supabase
    .from("team_members")
    .select("team_id, role, teams(id, name, tag, type, game, platform, size, owner_id, logo_url, color, wins, losses, xp, team_members(user_id, role, profiles(username, avatar_url)))")
    .eq("user_id", userId);
  if (error && isMissingCrestCols(error.message)) {
    ({ data, error } = await supabase.from("team_members")
      .select("team_id, role, teams(id, name, tag, type, game, platform, size, owner_id, wins, losses, xp, team_members(user_id, role, profiles(username, avatar_url)))")
      .eq("user_id", userId));
  }
  const teams = (data || []).map(d => ({ ...d.teams, myRole: d.role }));
  return { data: teams, error: error?.message };
}

export async function sendChallenge(fromTeamId, toTeamId, message, matchConfig = {}) {
  const { data, error } = await supabase
    .from("team_challenges")
    .insert({
      from_team_id: fromTeamId,
      to_team_id: toTeamId,
      message: message || null,
      status: "pending",
      game: matchConfig.game || null,
      mode: matchConfig.mode || "Search and Destroy",
      format: matchConfig.format || "1v1",
      kind: matchConfig.kind || "xp",
      entry: matchConfig.kind === "cash" ? (matchConfig.entry || 0) : 0,
      region: matchConfig.region || "NA East",
      series: matchConfig.series || "Best of 1",
      platform: matchConfig.platform || "PC + Console Mixed",
    })
    .select()
    .maybeSingle();
  return { data, error: error?.message };
}

export async function getTeamChallenges(teamId) {
  const { data, error } = await supabase
    .from("team_challenges")
    .select("*, from_team:teams!team_challenges_from_team_id_fkey(id, name, tag, game, wins, losses), to_team:teams!team_challenges_to_team_id_fkey(id, name, tag, game, wins, losses), game, mode, format, kind, entry, region, series, match_id")
    .or(`from_team_id.eq.${teamId},to_team_id.eq.${teamId}`)
    .order("created_at", { ascending: false })
    .limit(20);
  return { data: data || [], error: error?.message };
}

export async function respondChallenge(challengeId, accept) {
  if (!accept) {
    const { error } = await supabase
      .from("team_challenges")
      .update({ status: "declined" })
      .eq("id", challengeId);
    return { error: error?.message };
  }
  const { data, error } = await supabase.rpc("accept_challenge", { p_challenge_id: challengeId });
  if (error) return { error: error.message };
  return { data, error: null };
}

// Cancel a pending challenge you sent (SECURITY DEFINER RPC verifies you own the sending team).
export async function cancelChallenge(challengeId) {
  const { error } = await supabase.rpc("cancel_challenge", { p_challenge_id: challengeId });
  return { error: error?.message };
}

export function subscribeToChallenges(teamId, onChange) {
  const channel = supabase
    .channel(`team-challenges:${teamId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "team_challenges", filter: `to_team_id=eq.${teamId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "team_challenges", filter: `from_team_id=eq.${teamId}` }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export function subscribeToInvites(userId, onChange) {
  const channel = supabase
    .channel(`team-invites:${userId}:${Math.random().toString(36).slice(2, 8)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "team_invites", filter: `user_id=eq.${userId}` }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
