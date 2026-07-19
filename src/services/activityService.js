import { supabase } from "../lib/supabase";

// Public, privacy-safe live activity feed (wins, new lobbies, upcoming tournaments).
export async function getPlatformActivity(limit = 18) {
  const { data, error } = await supabase.rpc("platform_activity", { p_limit: limit });
  return { data: data || [], error: error?.message };
}
