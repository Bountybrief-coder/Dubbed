// Username rules (per product spec):
//  - 1 to 8 characters
//  - special characters allowed
//  - no profanity
// Passwords and email are handled by Supabase Auth; we only validate email shape
// client-side for a friendlier error before the network call.

// Root profanity stems. Kept deliberately small and matched against a normalized
// form (leetspeak collapsed) so obvious variants are caught. This is a first
// line of defense only — pair with a server-side check / moderation for real use.
const PROFANITY = [
  "fuck", "shit", "bitch", "cunt", "nigger", "nigga", "faggot", "retard",
  "kike", "chink", "spic", "coon", "whore", "rape", "nazi"
];

const normalizeForProfanity = (s) =>
  s.toLowerCase()
    .replace(/[!|1]/g, "i")
    .replace(/[3]/g, "e")
    .replace(/[4@]/g, "a")
    .replace(/[0]/g, "o")
    .replace(/[5$]/g, "s")
    .replace(/[7]/g, "t")
    .replace(/[^a-z]/g, ""); // collapse to letters so "f.u.c.k" -> "fuck"

export function containsProfanity(name) {
  const norm = normalizeForProfanity(name);
  return PROFANITY.some((w) => norm.includes(w));
}

// Returns "" when valid, else a human-readable error string.
export function validateUsername(name) {
  const value = String(name ?? "");
  if (value.length < 1) return "Username is required.";
  if (value.length > 8) return "Username must be 8 characters or less.";
  if (/\s/.test(value)) return "Username can't contain spaces.";
  if (containsProfanity(value)) return "That username isn't allowed.";
  return "";
}

export function validateEmail(email) {
  const value = String(email ?? "").trim();
  if (!value) return "Email is required.";
  // Intentionally permissive — Supabase does the authoritative check.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Enter a valid email.";
  return "";
}

export function validatePassword(pw) {
  if (String(pw ?? "").length < 6) return "Password must be at least 6 characters.";
  return "";
}

// Positive integer / money-ish entry validation used by create-match & bets.
export function validateEntry(amount, { min = 1 } = {}) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "Enter a valid amount.";
  if (n < min) return `Minimum is ${min}.`;
  return "";
}
