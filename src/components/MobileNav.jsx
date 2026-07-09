import React from "react";
import { Home, Crosshair, Trophy, BarChart3, Wallet } from "lucide-react";

const TABS = [
  { key: "home", label: "Home", Icon: Home },
  { key: "matchfinder", label: "Matches", Icon: Crosshair },
  { key: "tournaments", label: "Tourneys", Icon: Trophy },
  { key: "leaderboard", label: "Rankings", Icon: BarChart3 },
  { key: "wallet", label: "Wallet", Icon: Wallet },
];

export function MobileNav({ view, onNavigate }) {
  return (
    <nav className="mobileNav">
      <div className="mobileNavInner">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            className={`mobileNavBtn${view === key ? " active" : ""}`}
            onClick={() => onNavigate(key)}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
