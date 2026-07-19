import React from "react";

// Team identity mark. Shows the uploaded crest if present, otherwise a tag
// chip tinted with the team's accent color (falls back to the neon accent).
export function TeamCrest({ team, size = 40, className = "" }) {
  const tag = (team?.tag || "?").toUpperCase();
  const color = team?.color || null;
  const dim = { width: size, height: size };

  if (team?.logo_url) {
    return (
      <img
        className={`teamCrest ${className}`}
        src={team.logo_url}
        alt={`${team.name || tag} crest`}
        style={dim}
        loading="lazy"
      />
    );
  }

  const fontSize = Math.max(10, Math.round(size * 0.32));
  const style = color
    ? { ...dim, fontSize, background: `${color}22`, color, borderColor: `${color}66` }
    : { ...dim, fontSize };
  return <span className={`teamCrestTag ${className}`} style={style}>{tag}</span>;
}
