import React, { useState, useEffect, useRef } from "react";
import { supabaseConfigured } from "./lib/supabase";
import { useAuth } from "./hooks/useAuth.jsx";
import { TopNav } from "./components/TopNav";
import { Sidebar } from "./components/Sidebar";
import { MobileNav } from "./components/MobileNav";
import { ChatDock } from "./components/ChatDock";
import { AuthModal } from "./components/AuthModal";
import { AuthGate } from "./components/AuthGate";
import { getNotifications, subscribeToNotifications } from "./services/notificationService";
import { checkBanExpiry } from "./services/banService";

import { HomePage } from "./pages/HomePage";
import { MatchfinderPage } from "./pages/MatchfinderPage";
import { MatchRoomPage } from "./pages/MatchRoomPage";
import { GamePage } from "./pages/GamePage";
import { TournamentsPage } from "./pages/TournamentsPage";
import { TeamsPage } from "./pages/TeamsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { WalletPage } from "./pages/WalletPage";
import { ShopPage } from "./pages/ShopPage";
import { RulesPage } from "./pages/RulesPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { SupportPage } from "./pages/SupportPage";
import { AdminWithdrawalsPage } from "./pages/AdminWithdrawalsPage";
import { AdminShopPage } from "./pages/AdminShopPage";
import { AdminBansPage } from "./pages/AdminBansPage";
import { AdminDisputesPage } from "./pages/AdminDisputesPage";
import { AdminTournamentsPage } from "./pages/AdminTournamentsPage";
import { AdminSideBetsPage } from "./pages/AdminSideBetsPage";
import { AdminMatchSupportPage } from "./pages/AdminMatchSupportPage";
import { AdminRevenuePage } from "./pages/AdminRevenuePage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { LivePage } from "./pages/LivePage";

const ROUTE_PATHS = {
  home: "/", matchfinder: "/matches", tournaments: "/tournaments", teams: "/teams",
  leaderboard: "/leaderboard", wallet: "/wallet", shop: "/shop", live: "/live",
  rules: "/rules", privacy: "/privacy", support: "/support", notifications: "/notifications",
  "admin-withdrawals": "/admin/withdrawals", "admin-shop": "/admin/shop",
  "admin-bans": "/admin/bans", "admin-disputes": "/admin/disputes",
  "admin-tournaments": "/admin/tournaments", "admin-sidebets": "/admin/sidebets",
  "admin-support": "/admin/support", "admin-revenue": "/admin/revenue",
};

function routeToPath(name, param) {
  if (name === "match") return `/match/${param}`;
  if (name === "game") return `/game/${param}`;
  if (name === "profile" && param) return `/player/${param}`;
  return ROUTE_PATHS[name] || "/";
}

function pathToRoute(pathname) {
  let m;
  if ((m = pathname.match(/^\/match\/(.+)/))) return { name: "match", param: m[1] };
  if ((m = pathname.match(/^\/game\/(.+)/))) return { name: "game", param: m[1] };
  if ((m = pathname.match(/^\/player\/(.+)/))) return { name: "profile", param: decodeURIComponent(m[1]) };
  for (const [name, path] of Object.entries(ROUTE_PATHS)) {
    if (pathname === path) return { name };
  }
  return { name: "home" };
}

export function App() {
  const { user, profile, loading } = useAuth();
  const [route, setRoute] = useState(() => pathToRoute(window.location.pathname));
  const [authOpen, setAuthOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const pageKey = useRef(0);
  const navigate = (name, param) => {
    pageKey.current++;
    const r = { name, param };
    setRoute(r);
    window.history.pushState(r, "", routeToPath(name, param));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const onPop = (e) => {
      const r = e.state || pathToRoute(window.location.pathname);
      pageKey.current++;
      setRoute(r);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => { if (user) checkBanExpiry(); }, [user]);

  const requireAuth = (node) => (user ? node : <AuthGate onLogin={() => setAuthOpen(true)} />);

  useEffect(() => {
    if (!user) return setNotifications([]);
    getNotifications(user.id).then(({ data }) => setNotifications(data || []));
    const unsub = subscribeToNotifications(user.id, (row) => setNotifications((n) => [row, ...n]));
    return unsub;
  }, [user]);

  if (loading) {
    return <div className="bootScreen"><div className="bootLogo">dubbed</div><span className="spinner" /></div>;
  }

  const sideView = route.name === "game" ? `game-${route.param}` : route.name;

  return (
    <div className={`appShell${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
      {!supabaseConfigured && (
        <div className="configBanner">
          Supabase isn't configured. Copy <code>.env.example</code> to <code>.env</code> and add your project URL + anon key.
        </div>
      )}

      <Sidebar
        view={sideView}
        onNavigate={navigate}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
      />

      <div className="appMain">
        <TopNav
          view={route.name}
          onNavigate={navigate}
          onLogin={() => setAuthOpen(true)}
          onOpenWallet={() => navigate("wallet")}
          onOpenProfile={(username) => navigate("profile", username)}
          onToggleSidebar={() => setSidebarCollapsed((c) => !c)}
          notifications={notifications}
        />

        <div className="appBody" key={pageKey.current}>
          <div className="pageTransition">
          {profile?.banned && (
            <div className="errBanner banBanner" style={{ margin: "0 auto 16px", maxWidth: 700, textAlign: "center" }}>
              <strong>Your account is banned.</strong> Reason: {profile.ban_reason || "policy violation"}.
              {profile.ban_expires_at
                ? <> Expires: {new Date(profile.ban_expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}.</>
                : <> This ban is permanent.</>
              }
              <br /><small>You can still view matches and leaderboards, but you cannot create, join, or wager.</small>
            </div>
          )}

          {route.name === "home" && <HomePage onNavigate={navigate} onLogin={() => setAuthOpen(true)} />}
          {route.name === "matchfinder" && <MatchfinderPage onLogin={() => setAuthOpen(true)} onOpenMatch={(id) => navigate("match", id)} onNavigate={navigate} />}
          {route.name === "match" && requireAuth(<MatchRoomPage matchId={route.param} onBack={() => navigate("matchfinder")} onNavigate={navigate} />)}
          {route.name === "game" && <GamePage slug={route.param} onNavigate={navigate} onLogin={() => setAuthOpen(true)} onOpenMatch={(id) => navigate("match", id)} />}
          {route.name === "tournaments" && <TournamentsPage onLogin={() => setAuthOpen(true)} onNavigate={navigate} />}
          {route.name === "teams" && requireAuth(<TeamsPage />)}
          {route.name === "leaderboard" && <LeaderboardPage onOpenProfile={(u) => navigate("profile", u)} />}
          {route.name === "wallet" && requireAuth(<WalletPage />)}
          {route.name === "shop" && <ShopPage onLogin={() => setAuthOpen(true)} onNavigate={navigate} />}
          {route.name === "live" && <LivePage onOpenProfile={(u) => navigate("profile", u)} />}
          {route.name === "rules" && <RulesPage />}
          {route.name === "privacy" && <PrivacyPage />}
          {route.name === "support" && <SupportPage />}
          {route.name === "admin-withdrawals" && requireAuth(<AdminWithdrawalsPage />)}
          {route.name === "admin-shop" && requireAuth(<AdminShopPage />)}
          {route.name === "admin-bans" && requireAuth(<AdminBansPage />)}
          {route.name === "admin-disputes" && requireAuth(<AdminDisputesPage />)}
          {route.name === "admin-tournaments" && requireAuth(<AdminTournamentsPage />)}
          {route.name === "admin-sidebets" && requireAuth(<AdminSideBetsPage />)}
          {route.name === "admin-support" && requireAuth(<AdminMatchSupportPage onNavigate={navigate} />)}
          {route.name === "admin-revenue" && requireAuth(<AdminRevenuePage />)}
          {route.name === "notifications" && requireAuth(<NotificationsPage onNavigate={navigate} />)}
          {route.name === "profile" && <ProfilePage username={route.param || profile?.username} />}
          </div>
        </div>

        <footer className="appFooter">
          <div className="footerInner">
            <div className="footerCol">
              <b>Play</b>
              <button onClick={() => navigate("matchfinder")}>Matchfinder</button>
              <button onClick={() => navigate("tournaments")}>Tournaments</button>
              <button onClick={() => navigate("teams")}>Teams</button>
              <button onClick={() => navigate("leaderboard")}>Leaderboard</button>
            </div>
            <div className="footerCol">
              <b>Games</b>
              <button onClick={() => navigate("game", "bo7")}>Black Ops 7</button>
              <button onClick={() => navigate("game", "warzone")}>Warzone</button>
              <button onClick={() => navigate("game", "mw4")}>MW4</button>
              <button onClick={() => navigate("game", "bor")}>BO Royale</button>
            </div>
            <div className="footerCol">
              <b>Account</b>
              <button onClick={() => navigate("wallet")}>Wallet</button>
              <button onClick={() => navigate("shop")}>Shop</button>
              <button onClick={() => navigate("rules")}>Rules</button>
            </div>
            <div className="footerCol">
              <b>Dubbed</b>
              <button onClick={() => navigate("rules")}>Terms of Service</button>
              <button onClick={() => navigate("privacy")}>Privacy Policy</button>
              <button onClick={() => navigate("support")}>Support</button>
            </div>
          </div>
          <div className="footerBottom">
            <span>&copy; {new Date().getFullYear()} Dubbed. All rights reserved.</span>
            <small>Competitive wagering &middot; play responsibly &middot; 18+</small>
          </div>
        </footer>
      </div>

      <MobileNav view={route.name} onNavigate={navigate} />
      <ChatDock open={chatOpen} onToggle={() => setChatOpen((o) => !o)} onLogin={() => setAuthOpen(true)} />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
