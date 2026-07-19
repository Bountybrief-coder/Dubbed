import React from "react";

function Ico({ children, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {children}
    </svg>
  );
}

export function BO7Icon({ size = 16 }) {
  return (
    <Ico size={size}>
      <rect x="3" y="8" width="18" height="10" rx="5" stroke="currentColor" strokeWidth="1.8" fill="none"/>
      <circle cx="8.5" cy="13" r="1.5" fill="currentColor"/>
      <circle cx="15.5" cy="13" r="1.5" fill="currentColor"/>
      <line x1="11" y1="11" x2="13" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="12" y1="6" x2="12" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </Ico>
  );
}

export function WZIcon({ size = 16 }) {
  return (
    <Ico size={size}>
      <rect x="3" y="8" width="18" height="10" rx="5" stroke="currentColor" strokeWidth="1.8" fill="none"/>
      <circle cx="8.5" cy="13" r="1.5" fill="currentColor"/>
      <circle cx="15.5" cy="13" r="1.5" fill="currentColor"/>
      <path d="M11 10.5h2v1.5h-2z" fill="currentColor"/>
      <circle cx="7" cy="8" r="1.2" fill="currentColor"/>
      <circle cx="17" cy="8" r="1.2" fill="currentColor"/>
    </Ico>
  );
}

export function BORIcon({ size = 16 }) {
  return (
    <Ico size={size}>
      <rect x="3" y="8" width="18" height="10" rx="5" stroke="currentColor" strokeWidth="1.8" fill="none"/>
      <circle cx="8.5" cy="13" r="1.5" fill="currentColor"/>
      <circle cx="15.5" cy="13" r="1.5" fill="currentColor"/>
      <path d="M11 10.5h2v1.5h-2z" fill="currentColor"/>
      <path d="M5 7l2 1M19 7l-2 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </Ico>
  );
}

export function MW4Icon({ size = 16 }) {
  return (
    <Ico size={size}>
      <rect x="3" y="8" width="18" height="10" rx="5" stroke="currentColor" strokeWidth="1.8" fill="none"/>
      <path d="M7 11v4M10 11v4M8.5 13h-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <circle cx="16" cy="13" r="2" stroke="currentColor" strokeWidth="1.3" fill="none"/>
      <circle cx="16" cy="13" r=".7" fill="currentColor"/>
    </Ico>
  );
}

export function WWIIIcon({ size = 16 }) {
  return (
    <Ico size={size}>
      <rect x="3" y="8" width="18" height="10" rx="5" stroke="currentColor" strokeWidth="1.8" fill="none"/>
      <circle cx="8.5" cy="13" r="1.5" fill="currentColor"/>
      <circle cx="15.5" cy="13" r="1.5" fill="currentColor"/>
      <path d="M10.5 10h3v2h-3z" fill="currentColor" opacity=".6"/>
      <line x1="12" y1="6" x2="12" y2="8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="10" y1="6.5" x2="14" y2="6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </Ico>
  );
}

export function BO1Icon({ size = 16 }) {
  return (
    <Ico size={size}>
      <rect x="3" y="8" width="18" height="10" rx="5" stroke="currentColor" strokeWidth="1.8" fill="none"/>
      <circle cx="8" cy="12.5" r="2" stroke="currentColor" strokeWidth="1.3" fill="none"/>
      <line x1="8" y1="10.5" x2="8" y2="14.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
      <line x1="6" y1="12.5" x2="10" y2="12.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
      <circle cx="15.5" cy="11.5" r="1" fill="currentColor"/>
      <circle cx="17.5" cy="13" r="1" fill="currentColor"/>
      <circle cx="15.5" cy="14.5" r="1" fill="currentColor"/>
      <circle cx="13.5" cy="13" r="1" fill="currentColor"/>
    </Ico>
  );
}

export function BO2Icon({ size = 16 }) {
  return (
    <Ico size={size}>
      <rect x="3" y="8" width="18" height="10" rx="5" stroke="currentColor" strokeWidth="1.8" fill="none"/>
      <circle cx="8" cy="12.5" r="2" stroke="currentColor" strokeWidth="1.3" fill="none"/>
      <line x1="8" y1="10.5" x2="8" y2="14.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
      <line x1="6" y1="12.5" x2="10" y2="12.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
      <rect x="14" y="11" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <line x1="16" y1="11.5" x2="16" y2="14.5" stroke="currentColor" strokeWidth=".8" strokeLinecap="round"/>
      <line x1="14.5" y1="13" x2="17.5" y2="13" stroke="currentColor" strokeWidth=".8" strokeLinecap="round"/>
    </Ico>
  );
}

const GAME_ICON_MAP = {
  bo7: BO7Icon,
  warzone: WZIcon,
  bor: BORIcon,
  mw4: MW4Icon,
  wwii: WWIIIcon,
  bo1: BO1Icon,
  bo2: BO2Icon,
};

export function GameIcon({ slug, size = 16 }) {
  const Icon = GAME_ICON_MAP[slug] || BO7Icon;
  return <Icon size={size} />;
}
