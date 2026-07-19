import { supabase } from "../lib/supabase";

export async function canEscalateMatch(matchId) {
  const { data, error } = await supabase.rpc("can_escalate_match", { p_match: matchId });
  return { data: data?.[0] || { can_escalate: false, reason: "unknown" }, error: error?.message };
}

export async function escalateMatch(matchId, reason, priority = false) {
  const { data, error } = await supabase.rpc("escalate_match", {
    p_match: matchId,
    p_reason: reason,
    p_priority: priority,
  });
  return { id: data, error: error?.message };
}

export async function listEscalationTickets(status = null) {
  const { data, error } = await supabase.rpc("list_escalation_tickets", {
    p_status: status,
  });
  return { data: data || [], error: error?.message };
}

export async function resolveEscalation(ticketId, resolution, notes = null) {
  const { error } = await supabase.rpc("resolve_escalation", {
    p_ticket: ticketId,
    p_resolution: resolution,
    p_notes: notes,
  });
  return { error: error?.message };
}
