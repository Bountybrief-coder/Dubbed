import React, { useState, useEffect, useRef } from "react";
import { Wallet, ChevronDown, ChevronRight, Bell, LogOut, Search, Menu, User, Users, Swords, CreditCard, TicketCheck, Settings } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import { money } from "../utils/format";
import { rankForXp } from "../utils/ranks";
import { RankStar } from "./RankStar";
import { searchUsers } from "../services/profileService";
import logoMark from "../assets/dubbed-mark.png";

const MENU_ITEMS = [
  { key: "profile", label: "Profile", icon: User, self: true },
  { key: "teams", label: "Teams", icon: Users },
  { key: "matchfinder", label: "My Matches", icon: Swords },
  { key: "wallet", label: "Wallet", icon: CreditCard },
  { key: "support", label: "Tickets", icon: TicketCheck },
  { key: "settings", label: "Settings", icon: Settings, settings: true },
];

export function TopNav({ view, onNavigate, onLogin, onOpenWallet, onOpenProfile, onToggleSidebar, notifications = [] }) {
  const { profile, isAdmin, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const menuRef = useRef(null);
  const rank = profile ? rankForXp(profile.xp) : null;
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  async function onSearch(v) {
    setQ(v);
    if (!v.trim()) return setResults([]);
    const { data } = await searchUsers(v);
    setResults(data || []);
  }

  return (
    <header className="topbar">
      <button className="topbarMenu" onClick={onToggleSidebar} aria-label="Toggle menu">
        <Menu size={20} />
      </button>

      <button className="brand" onClick={() => onNavigate("home")}>
        <img src={logoMark} alt="Dubbed" /> <span>dubbed</span>
      </button>

      <div className="navSearch">
        <Search size={16} />
        <input value={q} onChange={(e) => onSearch(e.target.value)} placeholder="Search players" />
        {results.length > 0 && (
          <div className="searchDrop">
            {results.map((u) => (
              <button key={u.id} className="searchItem" onClick={() => { setQ(""); setResults([]); onOpenProfile?.(u.username); }}>
                <span className="searchAvatar">{u.username.slice(0, 2)}</span>
                <b>{u.username}</b><small>{u.xp?.toLocaleString()} XP</small>
              </button>
            ))}
          </div>
        )}
      </div>

      {profile ? (
        <div className="navRight">
          <button className="navIcon" onClick={() => onNavigate("notifications")} aria-label="Notifications">
            <Bell size={19} />
            {unread > 0 && <span className="navBadge">{unread}</span>}
          </button>
          <button className="balChip" onClick={onOpenWallet}>
            <span className="balChipIcon"><Wallet size={14} /></span>
            <span><small>BALANCE</small><b>{money(profile.balance)}</b></span>
          </button>
          <div className="rankWrap" ref={menuRef}>
            <button className="rankChip" onClick={() => setMenuOpen((o) => !o)}>
              <RankStar rank={rank} size={30} />
              <span><b>{profile.username}</b><small>{rank.name}</small></span>
              <ChevronDown size={14} className={`rankChev ${menuOpen ? "open" : ""}`} />
            </button>
            {menuOpen && (
              <div className="rankMenu">
                <div className="rankMenuHead">
                  <RankStar rank={rank} size={36} />
                  <div>
                    <b>{profile.username}</b>
                    <small style={{ color: rank.glow }}>{rank.name}</small>
                  </div>
                </div>
                <div className="rankMenuDivider" />
                {MENU_ITEMS.map(({ key, label, icon: Icon, self, settings }) => (
                  <button
                    key={key}
                    onClick={() => {
                      setMenuOpen(false);
                      if (self || settings) onOpenProfile?.(profile.username);
                      else onNavigate(key);
                    }}
                  >
                    <Icon size={16} />
                    <span>{label}</span>
                    <ChevronRight size={14} className="rankMenuChev" />
                  </button>
                ))}
                <div className="rankMenuDivider" />
                <button className="danger" onClick={() => { setMenuOpen(false); signOut(); onNavigate("home"); }}>
                  <LogOut size={16} /> <span>Log out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="navRight">
          <button className="btn btn-ghost" onClick={onLogin}>Log in</button>
          <button className="btn btn-primary" onClick={onLogin}>Join free</button>
        </div>
      )}
    </header>
  );
}
