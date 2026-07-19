import React from "react";

export function TwitchIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3.5 2L2 5.5V20h5v3h3l3-3h4l5-5V2H3.5zm15 11l-3 3H11l-3 3v-3H4.5V4H18.5v9z" fill="#9146FF"/>
      <path d="M15.5 7h-2v5h2V7zM11.5 7h-2v5h2V7z" fill="#9146FF"/>
    </svg>
  );
}

export function TwitterIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="#fff"/>
    </svg>
  );
}

export function YouTubeIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M23.5 6.2c-.3-1-1-1.8-2-2.1C19.7 3.5 12 3.5 12 3.5s-7.7 0-9.5.6c-1 .3-1.7 1.1-2 2.1C0 8 0 12 0 12s0 4 .5 5.8c.3 1 1 1.8 2 2.1 1.8.6 9.5.6 9.5.6s7.7 0 9.5-.6c1-.3 1.7-1.1 2-2.1.5-1.8.5-5.8.5-5.8s0-4-.5-5.8z" fill="#FF0000"/>
      <path d="M9.75 15.02l6.35-3.52-6.35-3.52v7.04z" fill="#FFF"/>
    </svg>
  );
}

export function PSNIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <text x="12" y="17" textAnchor="middle" fontFamily="Arial,Helvetica,sans-serif" fontSize="15" fontWeight="900" fill="#006FCD">PS</text>
    </svg>
  );
}

export function XboxIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="#107C10" strokeWidth="2.5" fill="none"/>
      <text x="12" y="17" textAnchor="middle" fontFamily="Arial,Helvetica,sans-serif" fontSize="14" fontWeight="900" fill="#107C10">X</text>
    </svg>
  );
}

export function BattlenetIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="#00AEFF" strokeWidth="1.5" fill="none" opacity=".5"/>
      <text x="12" y="17" textAnchor="middle" fontFamily="Arial,Helvetica,sans-serif" fontSize="12" fontWeight="900" fill="#00AEFF">B</text>
    </svg>
  );
}

export function SteamIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="#1B2838" strokeWidth="1.5" fill="none" opacity=".5"/>
      <text x="12" y="17" textAnchor="middle" fontFamily="Arial,Helvetica,sans-serif" fontSize="14" fontWeight="900" fill="#c6d4df">S</text>
    </svg>
  );
}

export function ActivisionIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="1.5" fill="none" opacity=".5"/>
      <text x="12" y="17" textAnchor="middle" fontFamily="Arial,Helvetica,sans-serif" fontSize="14" fontWeight="900" fill="#fff">A</text>
    </svg>
  );
}
