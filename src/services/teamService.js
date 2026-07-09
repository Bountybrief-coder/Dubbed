import { supabase } from "../lib/supabase";

export async function getMyTeams(userId) {
  const { data, error } = await supabase
    .from("team_members")
    .select("team_id, role, teams(id, name, tag, type, game, owner_id, created_at, team_members(user_id, role, profiles(username)))")
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

export async function createTeam({ name, tag, type, game }) {
  // Insert the team, then the owner membership. RLS allows both as the owner.
  const { data: team, error } = await supabase
    .from("teams")
    .insert({ name, tag: (tag || name.slice(0, 3)).toUpperCase(), type, game })
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
