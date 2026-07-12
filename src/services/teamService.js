import { supabase } from "../lib/supabase";

export async function getMyTeams(userId) {
  const { data, error } = await supabase
    .from("team_members")
    .select("team_id, role, teams(id, name, tag, type, game, platform, size, owner_id, created_at, wins, losses, earnings, xp, tourney_wins, tourney_losses, team_members(user_id, role, profiles(username, avatar_url)))")
    .eq("user_id", userId);
  const teams = (data || []).map(d => ({ ...d.teams, myRole: d.role }));
  return { data: teams, error: error?.message };
}

export async function getTeam(teamId) {
  const { data, error } = await supabase
    .from("teams")
    .select("*, team_members(user_id, role, profiles(username, avatar_url)), team_invites(user_id, profiles(username))")
    .eq("id", teamId)
    .maybeSingle();
  return { data, error: error?.message };
}

export async function createTeam({ name, tag, type, game, platform = null, size = 1 }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const row = { name, tag: (tag || name.slice(0, 3)).toUpperCase(), type, game, size, owner_id: user.id };
  if (platform) row.platform = platform;
  const { data: team, error } = await supabase
    .from("teams")
    .insert(row)
    .select()
    .maybeSingle();
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

export function subscribeToInvites(userId, onChange) {
  const channel = supabase
    .channel(`team-invites:${userId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "team_invites", filter: `user_id=eq.${userId}` }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
