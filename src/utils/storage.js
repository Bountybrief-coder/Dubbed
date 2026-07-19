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

const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export async function uploadTeamCrest(teamId, file) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { url: null, error: "Use a PNG, JPG, WebP, or GIF image." };
  }
  const ext = file.name.split(".").pop();
  const path = `${teamId}/crest.${ext}`;
  const { error } = await supabase.storage
    .from("team-crests")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) return { url: null, error: error.message };
  const { data: { publicUrl } } = supabase.storage.from("team-crests").getPublicUrl(path);
  // cache-bust so a replaced crest shows immediately
  return { url: `${publicUrl}?v=${Date.now()}`, error: null };
}

const ALLOWED_EVIDENCE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "video/mp4", "video/quicktime"];

export async function uploadEvidence(matchId, userId, file) {
  if (!ALLOWED_EVIDENCE_TYPES.includes(file.type)) {
    return { url: null, error: "Only images and videos are allowed (PNG, JPG, WebP, GIF, MP4)." };
  }
  const ext = file.name.split(".").pop();
  const path = `${matchId}/${userId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("evidence")
    .upload(path, file, { contentType: file.type });
  if (error) return { url: null, error: error.message };
  const { data } = await supabase.storage.from("evidence").createSignedUrl(path, 60 * 60 * 24 * 7);
  return { url: data?.signedUrl || path, error: null };
}
