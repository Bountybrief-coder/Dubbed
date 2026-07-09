import { supabase } from "../lib/supabase";

export async function getAchievements(userId) {
  const { data, error } = await supabase.rpc("get_achievements", { p_user: userId });
  return { data: data || [], error: error?.message };
}
