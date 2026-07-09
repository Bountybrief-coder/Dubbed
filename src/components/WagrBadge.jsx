import React from "react";
import wagrBadge from "../assets/wagr-badge.png";

// Inline WAGR member badge rendered next to usernames. Sized to sit on the
// same baseline as the name text — defaults to 20px which works next to 15-18px
// type. Pass `size` to scale for larger/smaller contexts (profile hero, cards).
export function WagrBadge({ size = 20, className = "" }) {
  return (
    <img
      src={wagrBadge}
      alt="WAGR Member"
      title="WAGR Member"
      className={`wagrBadgeImg ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
