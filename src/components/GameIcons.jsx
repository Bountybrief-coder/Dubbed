import React from "react";

// A clean, recognizable game controller (grips + D-pad + face buttons + sticks).
// Used across the app wherever a game is represented.
export function ControllerIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* body with grips */}
      <path
        d="M8.6 7.5h6.8a4.2 4.2 0 0 1 4.06 3.1l1.5 5.6a2.35 2.35 0 0 1-4.16 1.98l-1.24-1.76a2.6 2.6 0 0 0-2.12-1.12h-1.88a2.6 2.6 0 0 0-2.12 1.12l-1.24 1.76A2.35 2.35 0 0 1 3.04 16.2l1.5-5.6A4.2 4.2 0 0 1 8.6 7.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        fill="none"
      />
      {/* D-pad */}
      <path d="M7.9 10.3v2.9M6.45 11.75h2.9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      {/* face buttons */}
      <circle cx="15.3" cy="10.9" r="1.05" fill="currentColor" />
      <circle cx="17.15" cy="12.6" r="1.05" fill="currentColor" />
    </svg>
  );
}

// Every game maps to the controller. Individual named exports kept as aliases
// so any existing imports keep working.
export const BO7Icon = ControllerIcon;
export const WZIcon = ControllerIcon;
export const BORIcon = ControllerIcon;
export const MW4Icon = ControllerIcon;
export const WWIIIcon = ControllerIcon;
export const BO1Icon = ControllerIcon;
export const BO2Icon = ControllerIcon;

export function GameIcon({ size = 16 }) {
  return <ControllerIcon size={size} />;
}
