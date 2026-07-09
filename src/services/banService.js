import { supabase } from "../lib/supabase";

export async function adminListBans(activeOnly = true) {
  const { data, error } = await supabase.rpc("admin_list_bans", { p_active_only: activeOnly });
  return { data: data || [], error: error?.message };
}

export async function adminBanUser(userId, reason, duration, banType = "other", ipAddress = null) {
  const { error } = await supabase.rpc("admin_ban_user", {
    p_user_id: userId,
    p_reason: reason,
    p_duration: duration,
    p_ban_type: banType,
    p_ip_address: ipAddress
  });
  return { error: error?.message };
}

export async function adminUnbanUser(userId, note, markRedeemed = false) {
  const { error } = await supabase.rpc("admin_unban_user", {
    p_user_id: userId,
    p_note: note || null,
    p_mark_redeemed: markRedeemed
  });
  return { error: error?.message };
}

export async function checkBanExpiry() {
  const { error } = await supabase.rpc("check_ban_expiry");
  return { error: error?.message };
}

export async function lookupUser(username) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, banned, ban_reason, ban_expires_at")
    .ilike("username_lower", username.toLowerCase())
    .limit(5);
  return { data: data || [], error: error?.message };
}
