import { supabase } from "../lib/supabase";
import { validateUsername, validateEmail, validatePassword } from "../utils/validation";
import { track } from "../utils/analytics";

export async function signUp({ email, username, password }) {
  const uErr = validateUsername(username);
  if (uErr) return { error: uErr };
  const eErr = validateEmail(email);
  if (eErr) return { error: eErr };
  const pErr = validatePassword(password);
  if (pErr) return { error: pErr };

  const { data: taken } = await supabase
    .from("profiles")
    .select("id")
    .eq("username_lower", username.toLowerCase())
    .maybeSingle();
  if (taken) return { error: "That username is already taken." };

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { username: username.trim() } }
  });
  if (error) return { error: error.message };
  track.signup();
  return { data };
}

// Login with username + password.
// Supabase Auth only understands email, so we resolve username -> email via a
// SECURITY DEFINER RPC (email_for_username), then sign in with that email.
export async function signIn({ username, password }) {
  const uname = String(username || "").trim();
  if (!uname) return { error: "Enter your username." };
  if (!password) return { error: "Enter your password." };

  const { data: email, error: rpcErr } = await supabase.rpc("email_for_username", {
    p_username: uname
  });
  if (rpcErr) return { error: rpcErr.message };
  if (!email) return { error: "No account with that username." };

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (/invalid login/i.test(error.message)) return { error: "Incorrect username or password." };
    if (/email.*not.*confirmed/i.test(error.message)) return { error: "Check your email to verify your account before logging in." };
    return { error: error.message };
  }
  track.login();
  return { data };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error: error?.message };
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// Password reset still needs an email (Supabase sends the reset link there).
export async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  return { error: error?.message };
}

export function onAuthChange(cb) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}
