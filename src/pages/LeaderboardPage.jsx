import React, { useState, useRef, useCallback } from "react";
import { usePageMeta } from "../hooks/usePageMeta";
import { Trophy, Crown, Flame, TrendingUp, DollarSign, Percent, Filter, ChevronRight, Calendar } from "lucide-react";
import { useAsync, useCountdown } from "../hooks/useAsync";
import { useVisibilityRefresh } from "../hooks/useVisibilityRefresh";
import { useAuth } from "../hooks/useAuth.jsx";
import { getLeaderboard, getMyRank, getWeeklyRewards, getTimedLeaderboard, getMyTimedRank } from "../services/leaderboardService";
import { getCurrentSeason, getSeasonLeaderboard, getMySeasonRank, listSeasons } from "../services/seasonService";
import { SkeletonRows } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { RankStar } from "../components/RankStar";
import { WagrBadge } from "../components/WagrBadge";
import { rankForXp } from "../utils/ranks";
import { ordinal, money } from "../utils/format";
import { countryFlag } from "../utils/games";

const BOARDS = [
  { key: "xp",       label: "XP",         Icon: TrendingUp },
  { key: "earnings",  label: "Earnings",   Icon: DollarSign },
  { key: "streak",    label: "Win Streak", Icon: Flame },
  { key: "winpct",    label: "Win %",      Icon: Percent },
];

const SCOPES = [
  { key: "alltime", label: "All-Time" },
  { key: "season",  label: "Season" },
  { key: "30d",     label: "30 Days" },
  { key: "7d",      label: "7 Days" },
];

const REGIONS   = ["NA", "EU"];
const PLATFORMS = ["PC", "Console"];

function metricValue(p, metric) {
  const total = (p.wins || 0) + (p.losses || 0);
  switch (metric) {
    case "earnings": return money(p.earnings);
    case "streak":   return `${p.streak || 0}🔥`;
    case "winpct":   return total ? `${Math.round((p.wins / total) * 100)}%` : "-";
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

function sinceDate(scope) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  if (scope === "7d") {
    d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  } else {
    d.setUTCDate(d.getUTCDate() - 30);
  }
  return d.toISOString().slice(0, 10);
}

export function LeaderboardPage({ onOpenProfile }) {
  usePageMeta("Leaderboard", "See who's on top. Global COD leaderboard ranked by XP, wins, earnings, and win rate across all titles.");
  const { profile: me } = useAuth();
  const [metric, setMetric] = useState("xp");
  const [scope, setScope]   = useState("alltime");
  const [region, setRegion]     = useState(null);
  const [platform, setPlatform] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const youRowRef = useRef(null);

  const weeklyCountdown = useCountdown(nextSunday());
  const { data: currentSeason } = useAsync(() => getCurrentSeason(), []);
  const { data: allSeasons } = useAsync(() => listSeasons(), []);
  const [selectedSeasonId, setSelectedSeasonId] = useState(null);
  const activeSeason = currentSeason || null;
  const seasonId = selectedSeasonId || activeSeason?.id;

  const filters = { region, platform };
  const isTimed = scope === "7d" || scope === "30d";
  const isSeason = scope === "season";
  const boardMetric = (isTimed || isSeason) && metric === "streak" ? "xp" : metric;
  const since = isTimed ? sinceDate(scope) : null;
  const fetchBoard = useCallback(
    () => {
      if (isSeason && seasonId) return getSeasonLeaderboard(seasonId, boardMetric, filters);
      if (isTimed) return getTimedLeaderboard(boardMetric, since, filters);
      return getLeaderboard(boardMetric, filters);
    },
    [boardMetric, region, platform, scope, seasonId]
  );
  const { data, loading, error, reload } = useAsync(fetchBoard, [boardMetric, region, platform, scope, seasonId]);

  const fetchMyRank = useCallback(
    () => {
      if (!me) return Promise.resolve({ data: null });
      if (isSeason && seasonId) return getMySeasonRank(seasonId, boardMetric);
      if (isTimed) return getMyTimedRank(boardMetric, since, filters);
      return getMyRank(boardMetric, filters);
    },
    [boardMetric, region, platform, me?.id, scope, seasonId]
  );
  const { data: myRankData } = useAsync(fetchMyRank, [boardMetric, region, platform, me?.id, scope, seasonId]);

  useVisibilityRefresh(reload, [boardMetric, region, platform, scope, seasonId]);

  const rows = data || [];
  const topVal = rows[0];
  const myIdx = me ? rows.findIndex((r) => r.id === me.id) : -1;
  const myRankPos = myIdx >= 0 ? myIdx + 1 : myRankData?.rank_pos;

  function scrollToMe() {
    youRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <main className="page lbPage">
      <div className="lbHero">
        <div className="lbHeroBg" />
        <div className="pageHead">
          <div className="eyebrow">{activeSeason ? activeSeason.name.toUpperCase() : "RANKINGS"}</div>
          <h1>Leaderboard</h1>
          <p className="sub">Compete, climb, get rewarded. Top weekly players earn credits.</p>
        </div>
      </div>

      {/* ── Board Tabs ── */}
      <div className="lbControls">
        <div className="lbTabs" role="tablist" aria-label="Leaderboard metric">
          {BOARDS.map((b) => {
            const unavailable = b.key === "streak" && (isTimed || isSeason);
            return (
              <button
                key={b.key}
                role="tab"
                aria-selected={metric === b.key}
                disabled={unavailable}
                title={unavailable ? "Win streak is only ranked all-time" : undefined}
                className={`lbTab ${metric === b.key ? "active" : ""}`}
                onClick={() => setMetric(b.key)}
              >
                <b.Icon size={14} />
                {b.label}
              </button>
            );
          })}
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

      {/* ── Season banner ── */}
      {isSeason && activeSeason && (
        <SeasonBanner season={activeSeason} allSeasons={allSeasons || []} selectedId={seasonId} onSelectSeason={setSelectedSeasonId} />
      )}
      {isSeason && !activeSeason && (
        <div className="lbWeeklyBanner">
          <Calendar size={14} />
          <span>No active season right now. Check back soon!</span>
        </div>
      )}

      {/* ── Timed info banner ── */}
      {isTimed && (
        <div className="lbWeeklyBanner">
          <Trophy size={14} />
          {scope === "7d" ? (
            <>
              <span>This week's standings. Top 3 earn <b>$3 / $2 / $1</b> credits every Monday.</span>
              <span className="lbPotwTimer">
                Resets in {weeklyCountdown.d > 0 ? `${weeklyCountdown.d}d ` : ""}{weeklyCountdown.h}h {weeklyCountdown.m}m
              </span>
            </>
          ) : (
            <span>Last 30 days of match activity.</span>
          )}
        </div>
      )}

      {/* ── Board ── */}
      {loading ? (
        <SkeletonRows rows={8} />
      ) : error ? (
        <div className="errorState"><p>{error}</p><button className="btn btn-ghost sm" onClick={reload}>Retry</button></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Trophy} title={
          isSeason ? "No season activity yet"
          : isTimed ? `No matches in the last ${scope === "7d" ? "7 days" : "30 days"}`
          : boardMetric === "winpct" ? "No players with 10+ matches yet"
          : "No ranked players yet"
        }>
          {isSeason
            ? "Play matches during the season to climb the standings and qualify for playoffs."
            : isTimed
              ? scope === "7d"
                ? "Play a match this week to get on the board. Top 3 earn credits every Monday."
                : "No match activity in the last 30 days. Play a match to appear here."
              : boardMetric === "winpct"
                ? "Play at least 10 matches to qualify for the Win % board."
                : "Play a match to get on the board."}
        </EmptyState>
      ) : (
        <>
          {/* ── Podium ── */}
          {rows.length >= 3 && <Podium players={rows} metric={boardMetric} onOpenProfile={onOpenProfile} />}

          {/* ── Table ── */}
          <div className="lbTableLabel">
            <Trophy size={14} />
            <span>Full Rankings</span>
            <span className="lbTableCount">{rows.length} players</span>
          </div>
          <div className="lbTable">
            <div className="lbHeader">
              <span>#</span>
              <span>Player</span>
              <span className="lbHideMobile">Tier</span>
              <span>Record</span>
              <span className="lbHideMobile">Win %</span>
              <span>{boardMetric === "xp" ? "Earnings" : "XP"}</span>
              <span>{metricLabel(boardMetric)}</span>
            </div>
            {rows.map((p, i) => {
              const rank = rankForXp(p.xp);
              const total = (p.wins || 0) + (p.losses || 0);
              const winPct = total ? Math.round((p.wins / total) * 100) : 0;
              const isMe = me && p.id === me.id;
              const topMetric = topVal ? metricRaw(topVal, boardMetric) : 1;
              const pctBar = topMetric > 0 ? Math.max(5, (metricRaw(p, boardMetric) / topMetric) * 100) : 0;
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
                    <b>{p.username}{p.country && <img className="countryFlag" src={countryFlag(p.country)} alt={p.country} />}{p.wagr_member && <WagrBadge size={14} />}</b>
                  </span>
                  <span className="lbTier" style={{ color: rank.glow, "--rank-glow": rank.glow }}>
                    <RankStar rank={rank} size={24} />
                    {rank.name}
                  </span>
                  <span className="lbRec">{p.wins}-{p.losses}</span>
                  <span className="lbWin">{winPct}%</span>
                  <span className="lbEarn">{boardMetric === "xp" ? ((p.earnings || 0) > 0 ? money(p.earnings) : "-") : `${(p.xp || 0).toLocaleString()}`}</span>
                  <span className="lbXp">
                    <span className="lbXpBar" style={{ width: `${pctBar}%`, background: rank.glow }} />
                    {metricValue(p, boardMetric)}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* ── "You" Sticky Anchor ── */}
      {me && !loading && (
        <YouAnchor
          me={me}
          metric={boardMetric}
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
            <b className="lbPodiumName">{p.username}{p.country && <img className="countryFlag" src={countryFlag(p.country)} alt={p.country} />}{p.wagr_member && <WagrBadge size={14} />}</b>
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

/* ── Season Banner ── */
function SeasonBanner({ season, allSeasons, selectedId, onSelectSeason }) {
  const isViewing = selectedId && selectedId !== season.id;
  const viewedSeason = isViewing ? allSeasons.find(s => s.id === selectedId) : season;
  const pastSeasons = allSeasons.filter(s => s.status === "completed");

  return (
    <div className="seasonBanner">
      <div className="seasonBannerTop">
        <Calendar size={16} />
        <div className="seasonBannerInfo">
          <b>{viewedSeason?.name || season.name}</b>
          {viewedSeason && (
            <span className="seasonDates">
              {new Date(viewedSeason.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              {" - "}
              {new Date(viewedSeason.end_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
        </div>
        {!isViewing && season.status === "active" && (
          <span className="seasonDaysLeft">
            {season.days_remaining}d left
          </span>
        )}
        {isViewing && viewedSeason?.status === "completed" && (
          <span className="seasonCompleted">Completed</span>
        )}
      </div>

      {!isViewing && season.status === "active" && (
        <div className="seasonProgress">
          <div className="seasonProgressBar">
            <div className="seasonProgressFill" style={{ width: `${season.progress_pct}%` }} />
          </div>
          <span className="seasonProgressLabel">{Math.round(season.progress_pct)}%</span>
        </div>
      )}

      <div className="seasonBannerBottom">
        <span className="seasonQualify">Top {season.playoff_size} qualify for playoffs</span>
        {pastSeasons.length > 0 && (
          <select
            className="seasonPicker"
            value={selectedId || season.id}
            onChange={(e) => onSelectSeason(e.target.value === season.id ? null : e.target.value)}
          >
            {season.status === "active" && <option value={season.id}>{season.name} (Current)</option>}
            {pastSeasons.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>
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
              <b>{p?.username || "Player"}{p?.country && <img className="countryFlag" src={countryFlag(p.country)} alt={p.country} />}</b>
              <span className="lbPotwCredits">+{money(r.credits)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
