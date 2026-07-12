// Money — always render from a numeric string/number the DB gave us.
export const money = (n) =>
  Number(n || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

export const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export const timeAgo = (iso) => {
  const then = new Date(iso).getTime();
  const secs = Math.floor((Date.now() - then) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
};

export const shortTime = (iso) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

// Countdown parts for a future timestamp.
export const countdownParts = (toMs) => {
  const ms = Math.max(0, toMs - Date.now());
  return {
    d: Math.floor(ms / 86400000),
    h: Math.floor((ms % 86400000) / 3600000),
    m: Math.floor((ms % 3600000) / 60000),
    s: Math.floor((ms % 60000) / 1000),
    done: ms === 0
  };
};

// Basic input hardening for chat/messages. We store text, never HTML — React
// already escapes on render — but we strip control chars and cap length so a
// pasted payload can't blow up the UI or the row.
export const sanitizeMessage = (raw, max = 400) =>
  String(raw || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trimEnd()
    .slice(0, max);

export const WITHDRAWAL_PROCESSING_COPY = "1–2 business days";

export const estimatedArrival = (createdAt) => {
  // Add ~3 calendar days as a friendly upper bound (skips exact banking math).
  const d = new Date(createdAt);
  d.setDate(d.getDate() + 3);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export const shortDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "-";
