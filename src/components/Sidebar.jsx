import React from "react";
import {
  Home, Crosshair, Trophy, Users, BarChart3, Radio, ShoppingBag,
  BookOpen, Wallet, ChevronLeft, ChevronRight, Gamepad2, Shield,
  AlertTriangle, Ban, CreditCard, Swords, Gavel, DollarSign,
  HelpCircle, FileText, Calendar
} from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import { CURRENT_GAMES, THROWBACK_GAMES } from "../utils/games";
import logoMark from "../assets/dubbed-mark.png";

const MAIN_NAV = [
  { key: "home", label: "Home", icon: Home },
  { key: "matchfinder", label: "Matchfinder", icon: Crosshair },
  { key: "tournaments", label: "Tournaments", icon: Trophy },
  { key: "teams", label: "Teams", icon: Users },
];

const COMMUNITY_NAV = [
  { key: "leaderboard", label: "Leaderboard", icon: BarChart3 },
  { key: "betting", label: "Betting", icon: Swords },
  { key: "live", label: "Live", icon: Radio },
];

const ACCOUNT_NAV = [
  { key: "wallet", label: "Wallet", icon: Wallet },
  { key: "shop", label: "Shop", icon: ShoppingBag },
  { key: "rules", label: "Rules", icon: BookOpen },
  { key: "support", label: "Support", icon: HelpCircle },
  { key: "privacy", label: "Privacy", icon: FileText },
];

const ADMIN_NAV = [
  { key: "admin-revenue", label: "Revenue", icon: DollarSign },
  { key: "admin-withdrawals", label: "Withdrawals", icon: CreditCard },
  { key: "admin-shop", label: "Shop", icon: ShoppingBag },
  { key: "admin-bans", label: "Bans", icon: Ban },
  { key: "admin-disputes", label: "Disputes", icon: AlertTriangle },
  { key: "admin-tournaments", label: "Tournaments", icon: Trophy },
  { key: "admin-sidebets", label: "Side Bets", icon: Swords },
  { key: "admin-support", label: "Support", icon: Gavel },
  { key: "admin-seasons", label: "Seasons", icon: Calendar },
];

export function Sidebar({ view, onNavigate, collapsed, onToggle, onHoverRoute, inviteCount = 0 }) {
  const { isAdmin } = useAuth();

  function NavItem({ item, active, badge }) {
    const Icon = item.icon;
    return (
      <button
        className={`sideItem${active ? " active" : ""}`}
        onClick={() => onNavigate(item.key)}
        onMouseEnter={() => onHoverRoute?.(item.key)}
        title={collapsed ? item.label : undefined}
      >
        <Icon size={18} />
        {!collapsed && <span>{item.label}</span>}
        {badge > 0 && <span className="sideBadge">{badge}</span>}
        {active && <div className="sideActiveBar" />}
      </button>
    );
  }

  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      <div className="sideTop">
        <button className="sideBrand" onClick={() => onNavigate("home")}>
          <img src={logoMark} alt="Dubbed" />
          {!collapsed && <span>dubbed</span>}
        </button>
      </div>

      <nav className="sideNav">
        {!collapsed && <div className="sideSection">PLAY</div>}
        {MAIN_NAV.map((item) => (
          <NavItem key={item.key} item={item} active={view === item.key} badge={item.key === "teams" ? inviteCount : 0} />
        ))}

        {!collapsed && <div className="sideSection">GAMES</div>}
        {(collapsed ? CURRENT_GAMES.slice(0, 4) : CURRENT_GAMES).map((g) => (
          <button
            key={g.slug}
            className={`sideItem sideGame${view === `game-${g.slug}` ? " active" : ""}`}
            onClick={() => onNavigate("game", g.slug)}
            title={collapsed ? g.short : undefined}
          >
            <Gamepad2 size={16} />
            {!collapsed && <span>{g.short}</span>}
            {view === `game-${g.slug}` && <div className="sideActiveBar" />}
          </button>
        ))}

        {!collapsed && THROWBACK_GAMES.length > 0 && <div className="sideSection">THROWBACK</div>}
        {(!collapsed ? THROWBACK_GAMES : THROWBACK_GAMES.slice(0, 2)).map((g) => (
          <button
            key={g.slug}
            className={`sideItem sideGame${view === `game-${g.slug}` ? " active" : ""}`}
            onClick={() => onNavigate("game", g.slug)}
            title={collapsed ? g.short : undefined}
          >
            <Gamepad2 size={16} />
            {!collapsed && <span>{g.short}</span>}
            {view === `game-${g.slug}` && <div className="sideActiveBar" />}
          </button>
        ))}

        {!collapsed && <div className="sideSection">COMMUNITY</div>}
        {COMMUNITY_NAV.map((item) => (
          <NavItem key={item.key} item={item} active={view === item.key} />
        ))}

        {!collapsed && <div className="sideSection">ACCOUNT</div>}
        {ACCOUNT_NAV.map((item) => (
          <NavItem key={item.key} item={item} active={view === item.key} />
        ))}

        {isAdmin && (
          <>
            {!collapsed && <div className="sideSection admin">ADMIN</div>}
            {ADMIN_NAV.map((item) => (
              <NavItem key={item.key} item={item} active={view === item.key} />
            ))}
          </>
        )}
      </nav>

      <button className="sideToggle" onClick={onToggle} title={collapsed ? "Expand" : "Collapse"}>
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  );
}
