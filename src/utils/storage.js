import { supabase } from "../lib/supabase";

export async function uploadAvatar(userId, file) {
  const ext = file.name.split(".").pop();
  const path = `${userId}/avatar.${ext}`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) return { url: null, error: error.message };
  const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
  return { url: publicUrl, error: null };
}

export async function uploadEvidence(matchId, userId, file) {
  const ext = file.name.split(".").pop();
  const path = `${matchId}/${userId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("evidence")
    .upload(path, file, { contentType: file.type });
  if (error) return { url: null, error: error.message };
  const { data } = await supabase.storage.from("evidence").createSignedUrl(path, 60 * 60 * 24 * 7);
  return { url: data?.signedUrl || path, error: null };
}
