import React from "react";

const COLORS = {
  gold:   { cup: "#ffc23c", shine: "#ffe082", dark: "#c9960a", base: "#b8860b" },
  silver: { cup: "#b8c4cf", shine: "#dce4ea", dark: "#6b7b8a", base: "#5a6875" },
  bronze: { cup: "#c47a30", shine: "#daa06d", dark: "#7a4a1a", base: "#6b3e14" },
  wagr:   { cup: "#7c5cff", shine: "#b8a4ff", dark: "#4b2ec9", base: "#3a1faa" },
};

export function TrophyIcon({ tone = "gold", size = 48 }) {
  const c = COLORS[tone] || COLORS.gold;
  const isWagr = tone === "wagr";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {/* Glow for WAGR */}
      {isWagr && <circle cx="32" cy="28" r="24" fill={c.cup} opacity=".12" />}
      {/* Cup body */}
      <path d="M16 12h32v8c0 12-6 20-16 24-10-4-16-12-16-24v-8z" fill={`url(#cup-${tone})`} />
      {/* Left handle */}
      <path d="M16 16h-4c-3 0-5 2-5 5v2c0 4 3 7 7 7h2" stroke={c.dark} strokeWidth="2.5" fill="none" />
      {/* Right handle */}
      <path d="M48 16h4c3 0 5 2 5 5v2c0 4-3 7-7 7h-2" stroke={c.dark} strokeWidth="2.5" fill="none" />
      {/* Rim */}
      <rect x="14" y="10" width="36" height="4" rx="2" fill={c.shine} />
      {/* Stem */}
      <rect x="28" y="42" width="8" height="8" rx="1" fill={c.dark} />
      {/* Base */}
      <rect x="20" y="49" width="24" height="5" rx="2.5" fill={c.base} />
      <rect x="22" y="49" width="20" height="2" rx="1" fill={c.shine} opacity=".3" />
      {/* Emblem on cup */}
      {isWagr ? (
        <>
          <text x="32" y="30" textAnchor="middle" fontSize="12" fontWeight="900" fill="#fff" fontFamily="sans-serif">W</text>
          <circle cx="32" cy="26" r="10" stroke={c.shine} strokeWidth="1.5" fill="none" opacity=".5" />
        </>
      ) : (
        <path d="M32 18l2.5 5 5.5.8-4 3.9.9 5.5L32 30.7l-4.9 2.5.9-5.5-4-3.9 5.5-.8z" fill={c.shine} opacity=".7" />
      )}
      {/* Shine highlight */}
      <ellipse cx="26" cy="20" rx="3" ry="6" fill="#fff" opacity=".18" />
      <defs>
        <linearGradient id={`cup-${tone}`} x1="16" y1="12" x2="48" y2="44">
          <stop offset="0%" stopColor={c.shine} />
          <stop offset="40%" stopColor={c.cup} />
          <stop offset="100%" stopColor={c.dark} />
        </linearGradient>
      </defs>
    </svg>
  );
}
