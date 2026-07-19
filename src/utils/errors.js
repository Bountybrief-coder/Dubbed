// Map raw Supabase/Postgres error strings to friendly, user-facing messages
// so players never see things like "duplicate key value violates unique constraint".

export function inviteError(raw) {
  const e = String(raw || "").toLowerCase();
  if (e.includes("duplicate") || e.includes("already") || e.includes("unique")) return "That player already has a pending invite.";
  if (e.includes("not found") || e.includes("no rows") || e.includes("no user")) return "No player found with that username.";
  if (e.includes("member")) return "That player is already on the team.";
  if (e.includes("full")) return "This team is full.";
  return raw || "Couldn't send the invite. Try again.";
}

export function challengeError(raw) {
  const e = String(raw || "").toLowerCase();
  if (e.includes("duplicate") || e.includes("already") || e.includes("unique") || e.includes("pending")) return "You already have a pending challenge with this team.";
  if (e.includes("not found") || e.includes("no rows")) return "That team isn't available to challenge.";
  if (e.includes("self") || e.includes("own")) return "You can't challenge your own team.";
  return raw || "Couldn't send the challenge. Try again.";
}
