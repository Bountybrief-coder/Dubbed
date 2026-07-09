import { supabase } from "../lib/supabase";

export async function adminListDisputes(status = "open") {
  const { data, error } = await supabase.rpc("admin_list_disputes", { p_status: status });
  return { data: data || [], error: error?.message };
}

export async function adminSettleDispute(matchId, winnerId, note) {
  const { error } = await supabase.rpc("admin_settle_dispute", {
    p_match: matchId, p_winner: winnerId, p_note: note || null
  });
  return { error: error?.message };
}

export async function adminCancelDispute(matchId, note) {
  const { error } = await supabase.rpc("admin_cancel_dispute", {
    p_match: matchId, p_note: note || null
  });
  return { error: error?.message };
}
