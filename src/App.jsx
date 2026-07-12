import React, { useState, useEffect, useRef, Suspense, lazy } from "react";
import { supabaseConfigured } from "./lib/supabase";
import { useAuth } from "./hooks/useAuth.jsx";
import { TopNav } from "./components/TopNav";
import { Sidebar } from "./components/Sidebar";
import { MobileNav } from "./components/MobileNav";
import { ChatDock } from "./components/ChatDock";
import { AuthModal } from "./components/AuthModal";
import { AuthGate } from "./components/AuthGate";
import { Skeleton } from "./components/Skeleton";
import { ConnectionBanner } from "./components/ConnectionBanner";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";
import { BannedScreen } from "./components/BannedScreen";
import { getNotifications, subscribeToNotifications } from "./services/notificationService";
import { getMyInvites, subscribeToInvites } from "./services/teamService";
import { checkBanExpiry } from "./services/banService";
import { useWebVitals } from "./hooks/useWebVitals";
import { track } from "./utils/analytics";

// Eager: homepage (first paint)
import { HomePage } from "./pages/HomePage";

// Lazy: everything else — split into chunks on demand
const MatchfinderPage = lazy(() => import("./pages/MatchfinderPage").then(m => ({ default: m.MatchfinderPage })));
const MatchRoomPage = lazy(() => import("./pages/MatchRoomPage").then(m => ({ default: m.MatchRoomPage })));
const GamePage = lazy(() => import("./pages/GamePage").then(m => ({ default: m.GamePage })));
const TournamentsPage = lazy(() => import("./pages/TournamentsPage").then(m => ({ default: m.TournamentsPage })));
const TeamsPage = lazy(() => import("./pages/TeamsPage").then(m => ({ default: m.TeamsPage })));
const ProfilePage = lazy(() => import("./pages/ProfilePage").then(m => ({ default: m.ProfilePage })));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage").then(m => ({ default: m.LeaderboardPage })));
const WalletPage = lazy(() => import("./pages/WalletPage").then(m => ({ default: m.WalletPage })));
const ShopPage = lazy(() => import("./pages/ShopPage").then(m => ({ default: m.ShopPage })));
const RulesPage = lazy(() => import("./pages/RulesPage").then(m => ({ default: m.RulesPage })));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage").then(m => ({ default: m.PrivacyPage })));
const SupportPage = lazy(() => import("./pages/SupportPage").then(m => ({ default: m.SupportPage })));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage").then(m => ({ default: m.NotificationsPage })));
const LivePage = lazy(() => import("./pages/LivePage").then(m => ({ default: m.LivePage })));
const BettingPage = lazy(() => import("./pages/BettingPage").then(m => ({ default: m.BettingPage })));

// Admin pages — most users never hit these
const AdminWithdrawalsPage = lazy(() => import("./pages/AdminWithdrawalsPage").then(m => ({ default: m.AdminWithdrawalsPage })));
const AdminShopPage = lazy(() => import("./pages/AdminShopPage").then(m => ({ default: m.AdminShopPage })));
const AdminBansPage = lazy(() => import("./pages/AdminBansPage").then(m => ({ default: m.AdminBansPage })));
const AdminDisputesPage = lazy(() => import("./pages/AdminDisputesPage").then(m => ({ default: m.AdminDisputesPage })));
const AdminTournamentsPage = lazy(() => import("./pages/AdminTournamentsPage").then(m => ({ default: m.AdminTournamentsPage })));
const AdminSideBetsPage = lazy(() => import("./pages/AdminSideBetsPage").then(m => ({ default: m.AdminSideBetsPage })));
const AdminMatchSupportPage = lazy(() => import("./pages/AdminMatchSupportPage").then(m => ({ default: m.AdminMatchSupportPage })));
const AdminRevenuePage = lazy(() => import("./pages/AdminRevenuePage").then(m => ({ default: m.AdminRevenuePage })));

function PageSkeleton() {
  return <main className="page"><Skeleton w="40%" h={28} /><div style={{ height: 16 }} /><Skeleton h={200} r={14} /></main>;
}

const ROUTE_PATHS = {
  home: "/", matchfinder: "/matches", tournaments: "/tournaments", teams: "/teams",
  leaderboard: "/leaderboard", betting: "/betting", wallet: "/wallet", shop: "/shop", live: "/live",
  rules: "/rules", privacy: "/privacy", support: "/support", notifications: "/notifications",
  "admin-withdrawals": "/admin/withdrawals", "admin-shop": "/admin/shop",
  "admin-bans": "/admin/bans", "admin-disputes": "/admin/disputes",
  "admin-tournaments": "/admin/tournaments", "admin-sidebets": "/admin/sidebets",
  "admin-support": "/admin/support", "admin-revenue": "/admin/revenue",
};

// Prefetch map: route name → dynamic import thunk
const PREFETCH_MAP = {
  matchfinder: () => import("./pages/MatchfinderPage"),
  match: () => import("./pages/MatchRoomPage"),
  game: () => import("./pages/GamePage"),
  tournaments: () => import("./pages/TournamentsPage"),
  teams: () => import("./pages/TeamsPage"),
  profile: () => import("./pages/ProfilePage"),
  leaderboard: () => import("./pages/LeaderboardPage"),
  wallet: () => import("./pages/WalletPage"),
  shop: () => import("./pages/ShopPage"),
  live: () => import("./pages/LivePage"),
  betting: () => import("./pages/BettingPage"),
  notifications: () => import("./pages/NotificationsPage"),
};
const prefetched = new Set();
function prefetchRoute(name) {
  if (prefetched.has(name) || !PREFETCH_MAP[name]) return;
  prefetched.add(name);
  PREFETCH_MAP[name]();
}

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
  const { user, profile, loading, bootError } = useAuth();
  const [route, setRoute] = useState(() => pathToRoute(window.location.pathname));
  const [authOpen, setAuthOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [inviteCount, setInviteCount] = useState(0);

  const pageKey = useRef(0);
  const navigate = (name, param) => {
    pageKey.current++;
    const r = { name, param };
    setRoute(r);
    window.history.pushState(r, "", routeToPath(name, param));
    window.scrollTo({ top: 0, behavior: "smooth" });
    track.pageView(name);
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
  useWebVitals();

  const requireAuth = (node) => (user ? node : <AuthGate onLogin={() => setAuthOpen(true)} />);

  useEffect(() => {
    if (!user) return setNotifications([]);
    getNotifications(user.id).then(({ data }) => setNotifications(data || []));
    const unsub = subscribeToNotifications(user.id, (row) => setNotifications((n) => [row, ...n]));
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) return setInviteCount(0);
    getMyInvites(user.id).then(({ data }) => setInviteCount((data || []).length));
    const unsub = subscribeToInvites(user.id, () => {
      getMyInvites(user.id).then(({ data }) => setInviteCount((data || []).length));
    });
    return unsub;
  }, [user]);

  // Prefetch likely-next routes after idle
  useEffect(() => {
    const id = requestIdleCallback(() => {
      prefetchRoute("matchfinder");
      prefetchRoute("game");
      prefetchRoute("profile");
    }, { timeout: 3000 });
    return () => cancelIdleCallback(id);
  }, []);

  if (loading) {
    return <div className="bootScreen"><div className="bootLogo">dubbed</div><span className="spinner" /></div>;
  }

  if (profile?.banned === true) {
    return <BannedScreen />;
  }

  const sideView = route.name === "game" ? `game-${route.param}` : route.name;

  return (
    <div className={`appShell${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
      <ConnectionBanner />
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
        onHoverRoute={prefetchRoute}
        inviteCount={inviteCount}
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

          <ErrorBoundary key={pageKey.current}>
          <Suspense fallback={<PageSkeleton />}>
          {route.name === "home" && <HomePage onNavigate={navigate} onLogin={() => setAuthOpen(true)} />}
          {route.name === "matchfinder" && <MatchfinderPage onLogin={() => setAuthOpen(true)} onOpenMatch={(id) => navigate("match", id)} onNavigate={navigate} />}
          {route.name === "match" && requireAuth(<MatchRoomPage matchId={route.param} onBack={() => navigate("matchfinder")} onNavigate={navigate} />)}
          {route.name === "game" && <GamePage slug={route.param} onNavigate={navigate} onLogin={() => setAuthOpen(true)} onOpenMatch={(id) => navigate("match", id)} />}
          {route.name === "tournaments" && <TournamentsPage onLogin={() => setAuthOpen(true)} onNavigate={navigate} />}
          {route.name === "betting" && <BettingPage onLogin={() => setAuthOpen(true)} />}
          {route.name === "teams" && requireAuth(<TeamsPage onNavigate={navigate} />)}
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
          </Suspense>
          </ErrorBoundary>
          </div>
        </div>

        <footer className="appFooter">
          <div className="footerInner">
            <div className="footerCol">
              <b>Play</b>
              <button onClick={() => navigate("matchfinder")} onMouseEnter={() => prefetchRoute("matchfinder")}>Matchfinder</button>
              <button onClick={() => navigate("tournaments")} onMouseEnter={() => prefetchRoute("tournaments")}>Tournaments</button>
              <button onClick={() => navigate("teams")} onMouseEnter={() => prefetchRoute("teams")}>Teams</button>
              <button onClick={() => navigate("leaderboard")} onMouseEnter={() => prefetchRoute("leaderboard")}>Leaderboard</button>
            </div>
            <div className="footerCol">
              <b>Games</b>
              <button onClick={() => navigate("game", "bo7")} onMouseEnter={() => prefetchRoute("game")}>Black Ops 7</button>
              <button onClick={() => navigate("game", "warzone")} onMouseEnter={() => prefetchRoute("game")}>Warzone</button>
              <button onClick={() => navigate("game", "mw4")} onMouseEnter={() => prefetchRoute("game")}>MW4</button>
              <button onClick={() => navigate("game", "bor")} onMouseEnter={() => prefetchRoute("game")}>BO Royale</button>
            </div>
            <div className="footerCol">
              <b>Account</b>
              <button onClick={() => navigate("wallet")} onMouseEnter={() => prefetchRoute("wallet")}>Wallet</button>
              <button onClick={() => navigate("shop")} onMouseEnter={() => prefetchRoute("shop")}>Shop</button>
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
