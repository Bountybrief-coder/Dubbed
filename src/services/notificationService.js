import { supabase } from "../lib/supabase";

export async function getNotifications(userId) {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, text, read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);
  return { data: data || [], error: error?.message };
}

export async function markRead(id) {
  const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
  return { error: error?.message };
}

export async function markAllRead() {
  const { error } = await supabase.rpc("mark_all_notifications_read");
  return { error: error?.message };
}

export function subscribeToNotifications(userId, onInsert) {
  const sub = supabase
    .channel(`notif:${userId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
      (payload) => onInsert(payload.new)
    )
    .subscribe();
  return () => supabase.removeChannel(sub);
}
