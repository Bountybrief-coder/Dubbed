import { supabase } from "../lib/supabase";

export async function listLfgPosts({ game, platform, region } = {}) {
  const { data, error } = await supabase.rpc("list_lfg_posts", {
    p_game: game || null,
    p_platform: platform || null,
    p_region: region || null,
  });
  return { data: data || [], error: error?.message };
}

export async function createLfgPost({ game, mode, platform, region, mic, teamSize, message }) {
  const { data, error } = await supabase.rpc("create_lfg_post", {
    p_game: game,
    p_mode: mode || null,
    p_platform: platform || null,
    p_region: region || null,
    p_mic: mic || false,
    p_team_size: teamSize || 2,
    p_message: message || "",
  });
  return { id: data, error: error?.message };
}

export async function fillLfgPost(postId) {
  const { error } = await supabase
    .from("lfg_posts")
    .update({ status: "filled" })
    .eq("id", postId);
  return { error: error?.message };
}

export async function deleteLfgPost(postId) {
  const { error } = await supabase
    .from("lfg_posts")
    .delete()
    .eq("id", postId);
  return { error: error?.message };
}
