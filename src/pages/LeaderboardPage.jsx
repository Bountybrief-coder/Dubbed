import React, { useState, useRef, useEffect, useCallback } from "react";
import { Trophy, Crown, Flame, TrendingUp, DollarSign, Percent, Filter, ChevronRight } from "lucide-react";
import { useAsync, useCountdown } from "../hooks/useAsync";
import { useAuth } from "../hooks/useAuth.jsx";
import { getLeaderboard, getMyRank, getWeeklyRewards } from "../services/leaderboardService";
import { SkeletonRows } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { RankStar } from "../components/RankStar";
import { WagrBadge } from "../components/WagrBadge";
import { rankForXp } from "../utils/ranks";
import { ordinal, money } from "../utils/format";

const BOARDS = [
  { key: "xp",       label: "XP",         Icon: TrendingUp },
  { key: "earnings",  label: "Earnings",   Icon: DollarSign },
  { key: "streak",    label: "Win Streak", Icon: Flame },
  { key: "winpct",    label: "Win %",      Icon: Percent },
];

const SCOPES = [
  { key: "alltime", label: "All-Time" },
  { key: "season",  label: "Season" },
  { key: "weekly",  label: "Weekly" },
];

const REGIONS   = ["NA", "EU"];
const PLATFORMS = ["PC", "Console"];

function metricValue(p, metric) {
  const total = (p.wins || 0) + (p.losses || 0);
  switch (metric) {
    case "earnings": return money(p.earnings);
    case "streak":   return `${p.streak || 0}🔥`;
    case "winpct":   return total ? `${Math.round((p.wins / total) * 100)}%` : "—";
    default:         return `${(p.xp || 0).toLocaleString()} XP`;
  }
}

function metricLabel(metric) {
  switch (metric) {
    case "earnings": return "Earnings";
    case "streak":   return "Streak";
    case "winpct":   return "Win %";
    default:         return "XP";
  }
}

function nextSunday() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7 || 7));
  return d.getTime();
}

function lastWeekStart() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay() - 7);
  return d.toISOString().slice(0, 10);
}

export function LeaderboardPage({ onOpenProfile }) {
  const { profile: me } = useAuth();
  const [metric, setMetric] = useState("xp");
  const [scope, setScope]   = useState("alltime");
  const [region, setRegion]     = useState(null);
  const [platform, setPlatform] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const youRowRef = useRef(null);

  const filters = { region, platform };
  const fetchBoard = useCallback(
    () => getLeaderboard(metric, filters),
    [metric, region, platform]
  );
  const { data, loading, error, reload } = useAsync(fetchBoard, [metric, region, platform]);

  const fetchMyRank = useCallback(
    () => me ? getMyRank(metric, filters) : Promise.resolve({ data: null }),
    [metric, region, platform, me?.id]
  );
  const { data: myRankData } = useAsync(fetchMyRank, [metric, region, platform, me?.id]);

  // Refresh on tab focus
  useEffect(() => {
    const onFocus = () => reload();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reload]);

  const rows = data || [];
  const topVal = rows[0];
  const myIdx = me ? rows.findIndex((r) => r.id === me.id) : -1;
  const myRankPos = myIdx >= 0 ? myIdx + 1 : myRankData?.rank_pos;
  const isWeeklyStub = scope === "weekly";

  function scrollToMe() {
    youRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <main className="page">
      <div className="pageHead">
        <div className="eyebrow">SEASON RANKINGS</div>
        <h1>Leaderboard</h1>
        <p className="sub">Compete, climb, get rewarded. Top weekly players earn credits.</p>
      </div>

      {/* ── Board Tabs ── */}
      <div className="lbControls">
        <div className="lbTabs" role="tablist" aria-label="Leaderboard metric">
          {BOARDS.map((b) => (
            <button
              key={b.key}
              role="tab"
              aria-selected={metric === b.key}
              className={`lbTab ${metric === b.key ? "active" : ""}`}
              onClick={() => setMetric(b.key)}
            >
              <b.Icon size={14} />
              {b.label}
            </button>
          ))}
        </div>

        <div className="lbRight">
          {/* Scope Toggle */}
          <div className="lbScopeTabs" role="tablist" aria-label="Time scope">
            {SCOPES.map((s) => (
              <button
                key={s.key}
                role="tab"
                aria-selected={scope === s.key}
                className={`lbScopeTab ${scope === s.key ? "active" : ""}`}
                onClick={() => setScope(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Filters Toggle */}
          <button
            className={`lbFilterBtn ${showFilters ? "active" : ""}`}
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            aria-controls="lb-filters"
          >
            <Filter size={14} />
            Filters
          </button>
        </div>
      </div>

      {/* ── Filter Chips ── */}
      {showFilters && (
        <div className="lbFilters" id="lb-filters">
          <div className="lbFilterGroup">
            <small>Region</small>
            <div className="lbChips">
              <button className={`lbChip ${!region ? "active" : ""}`} onClick={() => setRegion(null)}>All</button>
              {REGIONS.map((r) => (
                <button key={r} className={`lbChip ${region === r ? "active" : ""}`} onClick={() => setRegion(r)}>{r}</button>
              ))}
            </div>
          </div>
          <div className="lbFilterGroup">
            <small>Platform</small>
            <div className="lbChips">
              <button className={`lbChip ${!platform ? "active" : ""}`} onClick={() => setPlatform(null)}>All</button>
              {PLATFORMS.map((p) => (
                <button key={p} className={`lbChip ${platform === p ? "active" : ""}`} onClick={() => setPlatform(p)}>{p}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Players of the Week ── */}
      <PlayersOfTheWeek />

      {/* ── Weekly Stub ── */}
      {isWeeklyStub ? (
        <EmptyState icon={Trophy} title="Weekly tracking coming soon">
          Weekly leaderboards start next season. Play matches now to build your all-time stats.
        </EmptyState>
      ) : loading ? (
        <SkeletonRows rows={8} />
      ) : error ? (
        <div className="errorState"><p>{error}</p><button className="btn btn-ghost sm" onClick={reload}>Retry</button></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Trophy} title={metric === "winpct" ? "No players with 10+ matches yet" : "No ranked players yet"}>
          {metric === "winpct"
            ? "Play at least 10 matches to qualify for the Win % board."
            : "Play a match to get on the board."}
        </EmptyState>
      ) : (
        <>
          {/* ── Podium ── */}
          {rows.length >= 3 && <Podium players={rows} metric={metric} onOpenProfile={onOpenProfile} />}

          {/* ── Table ── */}
          <div className="lbTable">
            <div className="lbHeader">
              <span>#</span>
              <span>Player</span>
              <span className="lbHideMobile">Tier</span>
              <span>Record</span>
              <span className="lbHideMobile">{metricLabel(metric)}</span>
              <span>{metric === "xp" ? "Earnings" : "XP"}</span>
              <span>{metricLabel(metric)}</span>
            </div>
            {rows.map((p, i) => {
              const rank = rankForXp(p.xp);
              const total = (p.wins || 0) + (p.losses || 0);
              const winPct = total ? Math.round((p.wins / total) * 100) : 0;
              const isMe = me && p.id === me.id;
              const topMetric = topVal ? metricRaw(topVal, metric) : 1;
              const pctBar = topMetric > 0 ? Math.max(5, (metricRaw(p, metric) / topMetric) * 100) : 0;
              return (
                <button
                  ref={isMe ? youRowRef : undefined}
                  className={`lbRow ${i < 3 ? "lbTop" : ""} ${isMe ? "lbYouRow" : ""}`}
                  key={p.id}
                  onClick={() => onOpenProfile?.(p.username)}
                  style={{ "--row-glow": rank.glow }}
                >
                  <span className={`lbRank r${i < 3 ? i + 1 : ""}`}>{ordinal(i + 1)}</span>
                  <span className="lbUser">
                    <div className="lbRowAvatar" style={{ borderColor: rank.glow }}>
                      {p.avatar_url ? <img src={p.avatar_url} alt="" /> : <span>{(p.username || "?").slice(0, 2)}</span>}
                    </div>
                    <b>{p.username}{p.wagr_member && <WagrBadge size={14} />}</b>
                  </span>
                  <span className="lbTier" style={{ color: rank.glow, "--rank-glow": rank.glow }}>
                    <RankStar rank={rank} size={24} />
                    {rank.name}
                  </span>
                  <span className="lbRec">{p.wins}-{p.losses}</span>
                  <span className="lbWin">{winPct}%</span>
                  <span className="lbEarn">{metric === "xp" ? ((p.earnings || 0) > 0 ? money(p.earnings) : "—") : `${(p.xp || 0).toLocaleString()}`}</span>
                  <span className="lbXp">
                    <span className="lbXpBar" style={{ width: `${pctBar}%`, background: rank.glow }} />
                    {metricValue(p, metric)}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* ── "You" Sticky Anchor ── */}
      {me && !isWeeklyStub && !loading && (
        <YouAnchor
          me={me}
          metric={metric}
          myRankPos={myRankPos}
          myIdx={myIdx}
          rows={rows}
          onScroll={scrollToMe}
          onOpenProfile={onOpenProfile}
        />
      )}
    </main>
  );
}

function metricRaw(p, metric) {
  const total = (p.wins || 0) + (p.losses || 0);
  switch (metric) {
    case "earnings": return Number(p.earnings || 0);
    case "streak":   return p.streak || 0;
    case "winpct":   return total >= 10 ? (p.wins / total) : 0;
    default:         return p.xp || 0;
  }
}

/* ── Podium ── */
function Podium({ players, metric, onOpenProfile }) {
  const order = [1, 0, 2];
  return (
    <div className="lbPodium">
      {order.map((idx) => {
        const p = players[idx];
        if (!p) return null;
        const rank = rankForXp(p.xp);
        const place = idx + 1;
        const total = (p.wins || 0) + (p.losses || 0);
        const winPct = total ? Math.round((p.wins / total) * 100) : 0;
        return (
          <button
            className={`lbPodiumCard p${place}`}
            key={p.id}
            onClick={() => onOpenProfile?.(p.username)}
            style={{ "--podium-glow": rank.glow }}
          >
            <span className="lbPodiumPlace">{place === 1 ? <Crown size={20} /> : ordinal(place)}</span>
            <div className="lbPodiumAvatar" style={{ borderColor: rank.glow, boxShadow: `0 0 16px ${rank.glow}30` }}>
              {p.avatar_url ? <img src={p.avatar_url} alt="" /> : <span>{(p.username || "?").slice(0, 2)}</span>}
            </div>
            <b className="lbPodiumName">{p.username}{p.wagr_member && <WagrBadge size={14} />}</b>
            <div className="lbPodiumRank" style={{ "--rank-glow": rank.glow }}><RankStar rank={rank} size={28} /> <span style={{ color: rank.glow }}>{rank.name}</span></div>
            <span className="lbPodiumMetric">{metricValue(p, metric)}</span>
            <span className="lbPodiumRec">{p.wins}W-{p.losses}L · {winPct}%</span>
            {(p.earnings || 0) > 0 && metric !== "earnings" && (
              <span className="lbPodiumEarn">{money(p.earnings)}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ── "You" Anchor ── */
function YouAnchor({ me, metric, myRankPos, myIdx, rows, onScroll, onOpenProfile }) {
  const total = (me.wins || 0) + (me.losses || 0);
  if (total === 0) {
    return (
      <div className="lbYouBar lbYouNudge">
        <span>Play a match to get ranked</span>
        <button className="btn btn-sm btn-primary" onClick={() => onOpenProfile?.(me.username)}>
          Your Profile <ChevronRight size={14} />
        </button>
      </div>
    );
  }
  if (!myRankPos) return null;
  return (
    <div className="lbYouBar">
      <span className="lbYouLabel">You</span>
      <span className="lbYouRank">{ordinal(myRankPos)}</span>
      <span className="lbYouMetric">{metricValue(me, metric)}</span>
      {myIdx >= 0 && (
        <button className="btn btn-sm btn-ghost lbYouJump" onClick={onScroll}>
          Jump to row
        </button>
      )}
    </div>
  );
}

/* ── Players of the Week ── */
function PlayersOfTheWeek() {
  const weekStart = lastWeekStart();
  const { data: rewards } = useAsync(() => getWeeklyRewards(weekStart), [weekStart]);
  const countdown = useCountdown(nextSunday());

  const rows = rewards || [];
  if (rows.length === 0) return null;

  const MEDAL = ["🥇", "🥈", "🥉"];
  return (
    <div className="lbPotw">
      <div className="lbPotwHead">
        <Trophy size={16} />
        <b>Players of the Week</b>
        <span className="lbPotwTimer">
          Resets in {countdown.d > 0 ? `${countdown.d}d ` : ""}{countdown.h}h {countdown.m}m
        </span>
      </div>
      <div className="lbPotwList">
        {rows.map((r, i) => {
          const p = r.profiles;
          const rank = rankForXp(p?.xp || 0);
          return (
            <div className="lbPotwRow" key={r.user_id}>
              <span className="lbPotwMedal">{MEDAL[i]}</span>
              <div className="lbPotwAvatar" style={{ borderColor: rank.glow }}>
                {p?.avatar_url ? <img src={p.avatar_url} alt="" /> : <span>{(p?.username || "?").slice(0, 2)}</span>}
              </div>
              <b>{p?.username || "Player"}</b>
              <span className="lbPotwCredits">+{money(r.credits)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
