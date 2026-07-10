import React, { useState, useEffect, useRef } from "react";
import { Flag, AlertTriangle, Upload, ChevronLeft, Crosshair, Send, XCircle, Check, X, Gamepad2, Monitor, Tv, ExternalLink, Shield, Copy, ChevronDown, UserX, Headphones, Paperclip, Scale, Link as LinkIcon } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useToast } from "../hooks/useToast.jsx";
import {
  getMatch, reportMatch, openDispute, subscribeToMatch,
  submitVeto, requestMatchCancel, respondMatchCancel, getCancelRequest,
  subscribeToCancelRequests, getTournamentContext,
  getMatchDispute, submitDisputeProof, adminAwardMatch
} from "../services/matchService";
import { getMatchMessages, sendMatchMessage, subscribeToMatchMessages } from "../services/matchChatService";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { Skeleton } from "../components/Skeleton";
import { WagrBadge } from "../components/WagrBadge";
import { RankStar } from "../components/RankStar";
import { TrophyIcon } from "../components/TrophyIcon";
import { money, shortTime } from "../utils/format";
import { modeRule, seriesRule, formatLabel, RAKE_CONFIG, mapsForGameMode, mapsNeededForSeries, seriesLabel, pcPlayersFromPlatform, isConsoleOnlyGame } from "../utils/games";
import { uploadEvidence } from "../utils/storage";
import { MapCard } from "../components/MapCard";
import { mapHue as getMapHue } from "../utils/mapImages";
import { rankForXp } from "../utils/ranks";
import { supabase } from "../lib/supabase";

function deriveClanTags(code) {
  const raw = (code || "DUBBED").replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const a = raw.slice(0, 3).padEnd(3, "X");
  const b = raw.slice(3, 6).padEnd(3, "Y");
  return [a, b];
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function MatchRoomPage({ matchId, onBack, onNavigate }) {
  const { user, profile, isAdmin } = useAuth();
  const toast = useToast();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tournamentCtx, setTournamentCtx] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReq, setCancelReq] = useState(null);
  const [trophyCounts, setTrophyCounts] = useState({});
  const [dispute, setDispute] = useState(null);

  async function loadDispute() {
    const { data } = await getMatchDispute(matchId);
    setDispute(data);
  }

  async function load() {
    try {
      setError(null);
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("Request timed out")), 12000));
      const { data } = await Promise.race([getMatch(matchId), timeout]);
      setMatch(data);
      setLoading(false);
      if (data?.match_players) {
        const ids = data.match_players.map((p) => p.user_id);
        const { data: trophies } = await supabase
          .from("trophies")
          .select("user_id, tone, place")
          .in("user_id", ids);
        const counts = {};
        for (const id of ids) counts[id] = { gold: 0, silver: 0, bronze: 0 };
        for (const t of trophies || []) {
          const tone = t.tone || (t.place === 1 ? "gold" : t.place === 2 ? "silver" : t.place === 3 ? "bronze" : null);
          if (tone && counts[t.user_id]?.[tone] != null) counts[t.user_id][tone] += 1;
        }
        setTrophyCounts(counts);
      }
    } catch (err) {
      setError(err.message || "Failed to load match");
      setLoading(false);
    }
  }
  async function loadCancel() {
    const { data } = await getCancelRequest(matchId);
    setCancelReq(data || null);
  }
  async function loadTournamentCtx() {
    const { data } = await getTournamentContext(matchId);
    setTournamentCtx(data);
  }

  useEffect(() => { load(); loadCancel(); loadTournamentCtx(); loadDispute(); }, [matchId]); // eslint-disable-line
  useEffect(() => subscribeToMatch(matchId, () => { load(); loadDispute(); }), [matchId]); // eslint-disable-line
  useEffect(() => subscribeToCancelRequests(matchId, loadCancel), [matchId]); // eslint-disable-line

  if (loading) return <main className="page"><Skeleton w="40%" h={28} /><div style={{ height: 16 }} /><Skeleton h={180} r={14} /></main>;
  if (error) return <main className="page"><div className="errorState"><AlertTriangle size={22} /><p>{error}</p><button className="btn btn-ghost sm" onClick={load}><span>Retry</span></button></div></main>;
  if (!match) return <main className="page"><p className="sub">Match not found.</p></main>;

  const players = (match.match_players || []).map((p) => ({
    id: p.user_id,
    name: p.profiles?.username || "Player",
    region: p.region,
    wagr: p.profiles?.wagr_member,
    teamName: p.team_name,
    xp: p.profiles?.xp || 0,
    wins: p.profiles?.wins || 0,
    losses: p.profiles?.losses || 0,
    earnings: p.profiles?.earnings || 0,
    psn: p.profiles?.psn,
    xbox: p.profiles?.xbox,
    activision_id: p.profiles?.activision_id,
    twitter: p.profiles?.twitter,
    youtube: p.profiles?.youtube,
    twitch: p.profiles?.twitch_username,
    avatar_url: p.profiles?.avatar_url,
    trophies: trophyCounts[p.user_id] || { gold: 0, silver: 0, bronze: 0 }
  }));
  const isParticipant = players.some((p) => p.id === user?.id);
  const inVeto = match.veto_status === "pending";
  const statusLabel = {
    open: "Waiting for opponent", live: inVeto ? "Map veto" : "In progress",
    reported: "Result reported", settled: "Settled", disputed: "Under review", cancelled: "Cancelled"
  }[match.status];
  const naCount = players.filter((p) => p.region === "NA").length;
  const euCount = players.filter((p) => p.region === "EU").length;
  const pot = match.kind === "cash" ? match.entry * (parseInt(match.format) || 1) * 2 : 0;
  const winner = match.winner_id ? players.find((p) => p.id === match.winner_id) : null;
  const clanTags = deriveClanTags(match.code);
  const teamSize = parseInt(match.format) || 1;
  const mapHue = match.map ? getMapHue(match.map, match.game) : 200;

  return (
    <main className="page matchRoomPage" aria-label="Match room">
      {/* §1 — Context strip */}
      <ContextStrip
        tournamentCtx={tournamentCtx}
        onBack={onBack}
        onNavigate={onNavigate}
      />

      {/* §2a — Map hero (when map is locked) */}
      {match.map && (
        <section className="mrMapHero" style={{ background: `linear-gradient(135deg, hsla(${mapHue}, 60%, 8%, 1) 0%, hsla(${mapHue}, 80%, 4%, 1) 100%)` }}>
          <div className="mrMapHeroInner">
            <div className="mrMapHeroCard">
              <MapCard map={match.map} game={match.game} size="lg" />
            </div>
            <div className="mrMapHeroInfo">
              <small className="mrMapLabel">MAP 1</small>
              <div className="mrMapName">{match.map}</div>
              <div className="mrMapHeroStatus">
                <span className={`roomStatus s-${match.status}`} aria-live="polite">{statusLabel}</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* §2b — Match header */}
      <MatchHeader
        match={match}
        statusLabel={statusLabel}
        pot={pot}
        naCount={naCount}
        euCount={euCount}
      />

      {!match.map && match.veto_status !== "pending" && (
        <section className="mrInfoBar">
          <div className="mrInfoItem"><Crosshair size={14} /><span>Map: <b>TBD (veto)</b></span></div>
        </section>
      )}

      {/* Clan tags */}
      {match.status !== "open" && match.status !== "cancelled" && (
        <ClanTagSection clanTags={clanTags} />
      )}

      {/* Info bar */}
      <section className="mrInfoBar">
        <div className="mrInfoItem"><small>{seriesLabel(match.series)} · {match.platform}</small></div>
        {!isConsoleOnlyGame(match.game) && (
          <div className="mrInfoItem"><small>PC: {pcPlayersFromPlatform(match.platform)} · Input: {match.allowed_input || "Controller + M&K"}</small></div>
        )}
        <div className="mrInfoItem">
          <small>Created {new Date(match.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</small>
        </div>
        {match.region === "NA + EU" && (
          <div className="mrInfoItem">
            <small>Host: {match.host_region || "TBD"} · {naCount} NA / {euCount} EU</small>
          </div>
        )}
      </section>

      {/* Weapon restriction banner */}
      {match.weapon_restriction && (
        <div className="errBanner weaponBanner">
          <AlertTriangle size={14} /> {match.weapon_restriction}: only the M15 and Dravec may be used. Any other weapon = forfeit for that team's round.
        </div>
      )}

      {/* Cancel request banner */}
      {cancelReq && (
        <CancelBanner req={cancelReq} isParticipant={isParticipant} onDone={() => { loadCancel(); load(); }} />
      )}

      {/* §5 — Map veto */}
      {isParticipant && inVeto && (
        <VetoPanel match={match} players={players} userId={user.id} onDone={load} />
      )}

      {/* §3 — Teams VS panel */}
      <TeamsVsPanel
        match={match}
        players={players}
        teamSize={teamSize}
        clanTags={clanTags}
        winner={winner}
        onNavigate={onNavigate}
        showGamertags={isParticipant}
      />

      {/* §4 — Per-map host table (step 2) */}
      <HostMapTable match={match} players={players} teamSize={teamSize} />

      {/* §8 — Rules / proof strip */}
      <RulesStrip match={match} />

      {/* §6 — Actions */}
      {isParticipant && (match.status === "live" || match.status === "reported") && !inVeto && (
        <div className="roomActions">
          <Button variant="primary" onClick={() => setReportOpen(true)}><Flag size={15} /> Report result</Button>
          <Button variant="ghost" onClick={() => setDisputeOpen(true)}><AlertTriangle size={15} /> Contest result</Button>
          {!cancelReq && <Button variant="ghost" onClick={() => setCancelOpen(true)}><XCircle size={15} /> Request cancel</Button>}
        </div>
      )}

      {/* §6b — Dispute panel (when match is disputed) */}
      {match.status === "disputed" && dispute && (
        <DisputePanel
          dispute={dispute}
          match={match}
          players={players}
          userId={user?.id}
          isAdmin={isAdmin}
          isParticipant={isParticipant}
          onDone={() => { load(); loadDispute(); }}
        />
      )}

      {/* §7 — Chat dock */}
      {(isParticipant || isAdmin) && (
        <ChatDock
          matchId={matchId}
          userId={user?.id}
          username={profile?.username}
          isAdmin={isAdmin}
          isParticipant={isParticipant}
          matchStatus={match.status}
          inVeto={inVeto}
          onNoShow={() => {
            openDispute(match.id, { reason: "No-show: opponent did not join within the 10-minute window." });
            toast.success("No-show reported. An admin will review.");
          }}
          onRequestAdmin={async () => {
            const res = await openDispute(match.id, { reason: "Admin requested from chat.", evidenceUrl: null });
            if (res.error) return toast.error(res.error);
            toast.success("Admin assigned. Check the dispute panel.");
            load(); loadDispute();
          }}
        />
      )}

      {/* Modals */}
      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} match={match} players={players} onDone={load} toast={toast} />
      <DisputeModal open={disputeOpen} onClose={() => setDisputeOpen(false)} match={match} onDone={() => { load(); loadDispute(); }} toast={toast} />
      <CancelModal open={cancelOpen} onClose={() => setCancelOpen(false)} match={match} onDone={() => { loadCancel(); load(); }} toast={toast} />
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// §1 — CONTEXT STRIP
// ═══════════════════════════════════════════════════════════════════════════

function ContextStrip({ tournamentCtx, onBack, onNavigate }) {
  if (tournamentCtx) {
    return (
      <div className="mrContextStrip">
        <button className="backLink" onClick={() => onNavigate?.("tournament", tournamentCtx.tournamentId)}>
          <ChevronLeft size={16} /> Back to bracket
        </button>
        <div className="mrContextInfo">
          <span className="mrContextName">{tournamentCtx.tournamentName}</span>
          <span className="mrContextDot">·</span>
          <span>{tournamentCtx.roundName || `Round ${tournamentCtx.roundNumber}`}</span>
          <span className="mrContextDot">·</span>
          <span>Match #{tournamentCtx.matchNumber}</span>
        </div>
      </div>
    );
  }
  return <button className="backLink" onClick={onBack}><ChevronLeft size={16} /> Back to matchfinder</button>;
}

// ═══════════════════════════════════════════════════════════════════════════
// §2 — MATCH HEADER
// ═══════════════════════════════════════════════════════════════════════════

function MatchHeader({ match, statusLabel, pot, naCount, euCount }) {
  return (
    <section className="mrHead">
      <div className="mrHeadLeft">
        <div className="mrId">MATCH #{match.match_number || "?"}</div>
        <h1>{match.game}</h1>
        <p className="mrSub">{formatLabel(match.format)} · {match.mode} · {seriesLabel(match.series)}</p>
        <div className="matchBadges">
          <span className="badge">{match.platform}</span>
          {match.skill_tier !== "Open" && <span className="badge accent">{match.skill_tier}</span>}
          {match.weapon_restriction && <span className="badge warn">{match.weapon_restriction}</span>}
          <span className="badge">{match.region}</span>
        </div>
      </div>
      <div className="mrHeadRight">
        {!match.map && <span className={`roomStatus s-${match.status}`} aria-live="polite">{statusLabel}</span>}
        {match.kind === "cash" && (
          <div className="mrPrize">
            <small>POT</small>
            <b className="cash">{money(pot)}</b>
          </div>
        )}
        <div className="mrCode">
          <small>TICKET</small>
          <span>{match.code}</span>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// §3 — TEAMS VS PANEL
// ═══════════════════════════════════════════════════════════════════════════

function TeamsVsPanel({ match, players, teamSize, clanTags, winner, onNavigate, showGamertags }) {
  if (teamSize === 1) {
    if (players.length >= 2) {
      return (
        <section className="mrPlayers">
          <PlayerCard player={players[0]} isWinner={match.winner_id === players[0].id} settled={match.status === "settled"} clanTag={clanTags[0]} onNavigate={onNavigate} showGamertags={showGamertags} />
          <div className="mrVs">
            <span>VS</span>
            {match.status === "settled" && winner && <div className="mrVerdict">{winner.name} wins</div>}
          </div>
          <PlayerCard player={players[1]} isWinner={match.winner_id === players[1].id} settled={match.status === "settled"} clanTag={clanTags[1]} onNavigate={onNavigate} showGamertags={showGamertags} />
        </section>
      );
    }
    return (
      <section className="mrPlayers">
        {players[0] ? <PlayerCard player={players[0]} isWinner={false} settled={false} clanTag={clanTags[0]} onNavigate={onNavigate} showGamertags={showGamertags} /> : <div className="mrPlayerCard empty"><div className="mrPcAvatar"><span>?</span></div><b>Waiting...</b></div>}
        <div className="mrVs"><span>VS</span></div>
        <div className="mrPlayerCard empty"><div className="mrPcAvatar"><span>?</span></div><b>Waiting for opponent...</b></div>
      </section>
    );
  }

  const teams = {};
  players.forEach(p => { const t = p.teamName || "Team"; (teams[t] = teams[t] || []).push(p); });
  const sides = Object.entries(teams);
  const sideA = sides[0] || ["Team 1", []];
  const sideB = sides[1] || ["Waiting...", []];
  const aWon = sideA[1].some(p => match.winner_id === p.id);
  const bWon = sideB[1].some(p => match.winner_id === p.id);

  return (
    <section className="mrPlayers">
      <div className="mrTeamSide">
        <div className="mrTeamHeader">
          <h3 className="mrTeamName">{sideA[0]}</h3>
          <span className="mrTeamTag">[{clanTags[0]}]</span>
        </div>
        {sideA[1].map(p => <PlayerCard key={p.id} player={p} isWinner={aWon} settled={match.status === "settled"} onNavigate={onNavigate} showGamertags={showGamertags} />)}
      </div>
      <div className="mrVs">
        <span>VS</span>
        {match.status === "settled" && (aWon || bWon) && <div className="mrVerdict">{aWon ? sideA[0] : sideB[0]} wins</div>}
      </div>
      <div className="mrTeamSide">
        {sideB[1].length > 0 ? <>
          <div className="mrTeamHeader">
            <h3 className="mrTeamName">{sideB[0]}</h3>
            <span className="mrTeamTag">[{clanTags[1]}]</span>
          </div>
          {sideB[1].map(p => <PlayerCard key={p.id} player={p} isWinner={bWon} settled={match.status === "settled"} onNavigate={onNavigate} showGamertags={showGamertags} />)}
        </> : <div className="mrPlayerCard empty"><div className="mrPcAvatar"><span>?</span></div><b>Waiting for opponents...</b></div>}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// §4 — PER-MAP HOST TABLE
// ═══════════════════════════════════════════════════════════════════════════

function HostMapTable({ match, players, teamSize }) {
  const mapsNeeded = mapsNeededForSeries(match.series);
  if (mapsNeeded <= 1 && !match.map) return null;

  const veto = match.veto || {};
  const lockedMaps = veto.locked || (match.map ? [match.map] : []);
  const teamSize1 = teamSize === 1;

  const teamAPlayers = [];
  const teamBPlayers = [];
  players.forEach((p, i) => {
    if (teamSize1) {
      (i === 0 ? teamAPlayers : teamBPlayers).push(p);
    } else {
      const firstTeam = players[0]?.teamName || "Team";
      ((p.teamName || "Team") === firstTeam ? teamAPlayers : teamBPlayers).push(p);
    }
  });

  const teamALabel = teamSize1 ? (teamAPlayers[0]?.name || "Team A") : (teamAPlayers[0]?.teamName || "Team A");
  const teamBLabel = teamSize1 ? (teamBPlayers[0]?.name || "Team B") : (teamBPlayers[0]?.teamName || "Team B");
  const teamAXp = teamAPlayers.reduce((s, p) => s + p.xp, 0);
  const teamBXp = teamBPlayers.reduce((s, p) => s + p.xp, 0);
  const higherRankTeam = teamAXp >= teamBXp ? teamALabel : teamBLabel;
  const lowerRankTeam = teamAXp >= teamBXp ? teamBLabel : teamALabel;

  const rows = [];
  for (let i = 0; i < mapsNeeded; i++) {
    const mapName = lockedMaps[i] || "TBD";
    let host, rule;
    if (mapsNeeded === 1) {
      host = match.host_region || higherRankTeam;
      rule = "Match host";
    } else if (i === 0) {
      host = higherRankTeam;
      rule = "Higher rank hosts";
    } else if (i === 1) {
      host = lowerRankTeam;
      rule = "Lower rank hosts";
    } else {
      host = "TBD";
      rule = "Most combined kills/rounds";
    }
    if (match.region === "NA + EU" && match.host_region) {
      host = `${host} (${match.host_region})`;
    }
    rows.push({ num: i + 1, map: mapName, host, rule });
  }

  return (
    <section className="roomCard mrHostTable">
      <h3>Map & Host Schedule</h3>
      <div className="mrHostTableWrap">
        <table className="mrHostGrid" aria-label="Per-map host assignments">
          <thead>
            <tr>
              <th>Map #</th>
              <th>Map</th>
              <th>Host</th>
              <th>Rule</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.num}>
                <td>{r.num}</td>
                <td>{r.map}</td>
                <td>{r.host}</td>
                <td className="mrHostRule">{r.rule}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// §8 — RULES / PROOF STRIP
// ═══════════════════════════════════════════════════════════════════════════

function RulesStrip({ match }) {
  return (
    <section className="roomCard mrRulesStrip">
      <details>
        <summary className="mrRulesSummary">
          <Shield size={14} />
          <span>Ruleset & Proof Requirements</span>
          <ChevronDown size={14} className="mrRulesChevron" />
        </summary>
        <div className="mrRulesBody">
          <p className="ruleNote inline">{modeRule(match.mode)}</p>
          <p className="ruleNote inline">{seriesRule(match.series)}</p>
          <ul className="roomRules">
            <li>{match.platform === "PC + Console Mixed" ? "PC and console players share this lobby." : match.platform === "Console Only" ? "Console only — PC players not allowed." : `${match.platform} lobby.`}{match.allowed_input === "Controller Only" ? " Controller only — M&K not allowed." : ""}</li>
            <li>All proof must be <b>video format</b> (VOD, clip, DVR recording). Screenshots alone are insufficient.</li>
            <li>Proof must show the <b>full scoreboard with gamertags</b> clearly visible.</li>
            <li>PC players must stream with past broadcasts enabled. VOD must stay up for 24 hours.</li>
            <li>Conversations outside Dubbed (DMs, Xbox/PSN messages) are not valid proof.</li>
            <li>Match ticket: <b>#{match.match_number || match.code}</b>. Reference this in any dispute.</li>
            {match.kind === "cash" && <li>Rake: {RAKE_CONFIG.standard * 100}% standard / {RAKE_CONFIG.wagr * 100}% WAGR members (min {money(RAKE_CONFIG.minimum)}).</li>}
            <li>If one team reports a result and the opponent does not respond within <b>2 hours</b>, the reported result stands.</li>
          </ul>
        </div>
      </details>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CLAN TAGS
// ═══════════════════════════════════════════════════════════════════════════

function ClanTagSection({ clanTags }) {
  return (
    <section className="mrClanTags">
      <div className="mrClanTagHead">
        <Shield size={14} />
        <b>Clan Tags — Use These In-Game</b>
      </div>
      <p className="mrClanTagNote">Both teams must set their in-game clan tag before playing. Screenshots or clips without the correct clan tag will not be accepted as proof.</p>
      <div className="mrClanTagRow">
        <ClanTagBox label="TEAM A" tag={clanTags[0]} />
        <span className="mrClanTagVs">VS</span>
        <ClanTagBox label="TEAM B" tag={clanTags[1]} />
      </div>
    </section>
  );
}

function ClanTagBox({ label, tag }) {
  const toast = useToast();
  return (
    <div className="mrClanTagBox">
      <small>{label}</small>
      <b>[{tag}]</b>
      <button className="mrClanCopy" onClick={() => { navigator.clipboard.writeText(tag); toast.success("Copied!"); }} title="Copy tag">
        <Copy size={12} />
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PLAYER CARD
// ═══════════════════════════════════════════════════════════════════════════

function PlayerCard({ player, isWinner, settled, clanTag, onNavigate, showGamertags = true }) {
  const rank = rankForXp(player.xp);
  const total = player.wins + player.losses;
  const winRate = total ? Math.round((player.wins / total) * 100) : 0;
  const tc = player.trophies || { gold: 0, silver: 0, bronze: 0 };
  const hasTrophies = tc.gold + tc.silver + tc.bronze > 0;

  return (
    <div className={`mrPlayerCard ${isWinner ? "winner" : ""} ${settled && !isWinner ? "loser" : ""}`}>
      {settled && <div className={`mrWL ${isWinner ? "w" : "l"}`}>{isWinner ? "W" : "L"}</div>}
      <div className="mrPcTop">
        <div className="mrPcAvatar" style={{ borderColor: rank.glow }}>
          {player.avatar_url ? <img src={player.avatar_url} alt="" /> : <span>{player.name.slice(0, 2)}</span>}
        </div>
        <div className="mrPcIdent">
          <b className="mrPcName" onClick={() => onNavigate?.("profile", player.name)} style={{ cursor: "pointer" }}>
            {player.name}{player.wagr && <WagrBadge size={14} />}
          </b>
          {player.teamName && <small className="mrPcTeam">{player.teamName}</small>}
          <small className="mrPcRank" style={{ color: rank.glow }}>{rank.name}</small>
        </div>
        <RankStar rank={rank} size={48} />
      </div>

      {(hasTrophies || player.wagr) && (
        <div className="mrPcTrophyRow">
          {player.wagr && (
            <div className="mrPcTrophyItem wagr" title="WAGR Member"><TrophyIcon tone="wagr" size={28} /><span>WAGR</span></div>
          )}
          {tc.gold > 0 && (
            <div className="mrPcTrophyItem" title={`${tc.gold} Gold`}><TrophyIcon tone="gold" size={28} /><span>{tc.gold}</span></div>
          )}
          {tc.silver > 0 && (
            <div className="mrPcTrophyItem" title={`${tc.silver} Silver`}><TrophyIcon tone="silver" size={28} /><span>{tc.silver}</span></div>
          )}
          {tc.bronze > 0 && (
            <div className="mrPcTrophyItem" title={`${tc.bronze} Bronze`}><TrophyIcon tone="bronze" size={28} /><span>{tc.bronze}</span></div>
          )}
        </div>
      )}

      <div className="mrPcStats">
        <div><small>Record</small><b>{player.wins}-{player.losses}</b></div>
        <div><small>Win %</small><b>{winRate}%</b></div>
        <div><small>Earnings</small><b className="cash">{money(player.earnings)}</b></div>
      </div>

      {showGamertags && (player.activision_id || player.psn || player.xbox) && (
        <div className="mrPcTags">
          {player.activision_id && <div className="mrTag"><Crosshair size={12} /> <span>{player.activision_id}</span></div>}
          {player.psn && <div className="mrTag"><Gamepad2 size={12} /> <span>PSN: {player.psn}</span></div>}
          {player.xbox && <div className="mrTag"><Monitor size={12} /> <span>Xbox: {player.xbox}</span></div>}
        </div>
      )}

      {(player.twitch || player.twitter || player.youtube) && (
        <div className="mrPcSocials">
          {player.twitch && <a href={`https://twitch.tv/${player.twitch}`} target="_blank" rel="noopener noreferrer" title="Twitch"><Tv size={14} /></a>}
          {player.twitter && <a href={`https://twitter.com/${player.twitter}`} target="_blank" rel="noopener noreferrer" title="Twitter/X"><ExternalLink size={14} /></a>}
          {player.youtube && <a href={`https://youtube.com/${player.youtube.startsWith("@") ? player.youtube : `@${player.youtube}`}`} target="_blank" rel="noopener noreferrer" title="YouTube"><ExternalLink size={14} /></a>}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CANCEL BANNER
// ═══════════════════════════════════════════════════════════════════════════

function CancelBanner({ req, isParticipant, onDone }) {
  const toast = useToast();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const isRequester = req.requested_by === user?.id;

  async function respond(accept) {
    setBusy(true);
    const res = await respondMatchCancel(req.id, accept);
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success(accept ? "Match cancelled." : "Cancel request declined.");
    onDone();
  }

  return (
    <div className="errBanner cancelBanner">
      <div>
        <XCircle size={15} />
        <span>{isRequester ? "You requested to cancel this match." : "The other side requested to cancel this match."}{req.reason ? `: "${req.reason}"` : ""}</span>
      </div>
      {isParticipant && !isRequester && (
        <div className="cancelBannerActions">
          <Button variant="primary" className="sm" loading={busy} onClick={() => respond(true)}><Check size={14} /> Accept</Button>
          <Button variant="ghost" className="sm" loading={busy} onClick={() => respond(false)}><X size={14} /> Decline</Button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// §5 — VETO PANEL
// ═══════════════════════════════════════════════════════════════════════════

function VetoPanel({ match, players, userId, onDone }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const veto = match.veto || {};
  const order = veto.order || [];
  const remaining = veto.remaining || [];
  const actions = veto.actions || [];
  const turn = veto.turn || 0;
  const needed = veto.needed || 1;
  const myTurn = order[turn % (order.length || 1)] === userId;
  const nameFor = (id) => players.find((p) => p.id === id)?.name || "Player";

  async function ban(map) {
    setBusy(true);
    const res = await submitVeto(match.id, map);
    setBusy(false);
    if (res.error) return toast.error(res.error);
    onDone();
  }

  return (
    <section className="roomCard vetoCard">
      <div className="vetoHead">
        <Crosshair size={16} />
        <h3>Map veto / {seriesLabel(match.series)}</h3>
        <span className="subtle">{remaining.length} left, need {needed}</span>
      </div>
      <p className="ruleNote inline">
        {myTurn ? "Your turn. Ban a map." : `Waiting on ${nameFor(order[turn % (order.length || 1)])} to ban.`}
      </p>
      <div className="mapGrid" style={{ marginTop: 8 }}>
        {remaining.map((m) => (
          <MapCard key={m} map={m} game={match.game} size="sm" onClick={() => myTurn && !busy && ban(m)} />
        ))}
      </div>
      {actions.length > 0 && (
        <div className="vetoLog">
          {actions.map((a, i) => (
            <span key={i} className="vetoLogItem"><b>{nameFor(a.by)}</b> banned <em>{a.map}</em></span>
          ))}
        </div>
      )}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// §7 — CHAT DOCK
// ═══════════════════════════════════════════════════════════════════════════

function ChatDock({ matchId, userId, username, isAdmin, isParticipant, matchStatus, inVeto, onNoShow, onRequestAdmin }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const bodyRef = useRef(null);
  const showActions = isParticipant && (matchStatus === "live" || matchStatus === "reported") && !inVeto;

  useEffect(() => {
    let active = true;
    getMatchMessages(matchId).then(({ data }) => active && setMessages(data));
    const unsub = subscribeToMatchMessages(matchId, (row) => setMessages((m) => [...m, row]));
    return () => { active = false; unsub(); };
  }, [matchId]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages.length]);

  async function send() {
    if (!text.trim()) return;
    const body = text.trim();
    setText("");
    await sendMatchMessage(matchId, userId, isAdmin ? `[ADMIN] ${username}` : username, body);
  }

  return (
    <section className="roomCard matchChatCard">
      <div className="mrChatHeader">
        <h3>{isAdmin ? "Match Support Chat" : "Team chat"}</h3>
        {showActions && (
          <div className="mrChatActions">
            <button className="mrChatAction noshow" onClick={onNoShow} title="Report no-show">
              <UserX size={14} /> No Show
            </button>
            <button className="mrChatAction admin" onClick={onRequestAdmin} title="Request an admin">
              <Headphones size={14} /> Request Admin
            </button>
          </div>
        )}
      </div>
      <div className="matchChatBody" ref={bodyRef}>
        {messages.length === 0 ? (
          <div className="chatDockEmpty">Say GLHF. Everyone in this lobby can see it.</div>
        ) : messages.map((m) => (
          <div className={`chatLine ${m.kind}`} key={m.id}>
            <div className="chatLineTop"><b>{m.username}</b>{m.profiles?.wagr_member && <WagrBadge size={12} />}<small>{shortTime(m.created_at)}</small></div>
            <p>{m.text}</p>
          </div>
        ))}
      </div>
      <div className="chatDockInput matchChatInput">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Message your lobby..." />
        <button onClick={send} aria-label="Send"><Send size={16} /></button>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// §6b — DISPUTE PANEL
// ═══════════════════════════════════════════════════════════════════════════

function DisputePanel({ dispute, match, players, userId, isAdmin, isParticipant, onDone }) {
  const toast = useToast();
  const [proofUrl, setProofUrl] = useState("");
  const [proofNotes, setProofNotes] = useState("");
  const [proofFile, setProofFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [awardWinner, setAwardWinner] = useState(players[0]?.id || "");
  const [awardNote, setAwardNote] = useState("");
  const [busy, setBusy] = useState(false);

  const isAssignedAdmin = isAdmin && dispute.assigned_admin_id === userId;
  const canAward = isAssignedAdmin || (isAdmin && !dispute.assigned_admin_id);

  async function handleSubmitProof() {
    let url = proofUrl.trim();
    if (proofFile) {
      setUploading(true);
      const { url: uploaded, error } = await uploadEvidence(match.id, userId, proofFile);
      setUploading(false);
      if (error) return toast.error("Upload failed: " + error);
      url = uploaded;
    }
    if (!url) return toast.error("Provide a proof URL or upload a file.");
    setBusy(true);
    const res = await submitDisputeProof(match.id, url, proofNotes.trim());
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success("Proof submitted.");
    setProofUrl(""); setProofNotes(""); setProofFile(null);
    onDone();
  }

  async function handleAward() {
    if (!awardWinner) return toast.error("Select a winner.");
    setBusy(true);
    const res = await adminAwardMatch(match.id, awardWinner, awardNote.trim());
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success("Match settled. Winner awarded.");
    onDone();
  }

  return (
    <section className="roomCard mrDisputePanel">
      <div className="mrDisputeHead">
        <Scale size={18} />
        <h3>Dispute in progress</h3>
        <span className="roomStatus s-disputed">Under review</span>
      </div>

      <div className="mrDisputeInfo">
        <div className="mrDisputeRow">
          <span className="mrDisputeLabel">Opened by</span>
          <span>{dispute.opened_by_name}</span>
        </div>
        <div className="mrDisputeRow">
          <span className="mrDisputeLabel">Reason</span>
          <span>{dispute.reason}</span>
        </div>
        {dispute.evidence_url && (
          <div className="mrDisputeRow">
            <span className="mrDisputeLabel">Evidence</span>
            <a href={dispute.evidence_url} target="_blank" rel="noopener noreferrer" className="mrDisputeLink">
              <LinkIcon size={12} /> View evidence
            </a>
          </div>
        )}
        <div className="mrDisputeRow">
          <span className="mrDisputeLabel">Assigned admin</span>
          <span className="mrDisputeAdmin">{dispute.assigned_admin_name || "Pending assignment"}</span>
        </div>
      </div>

      {/* Proof submission — participants only */}
      {isParticipant && (
        <div className="mrDisputeProof">
          <h4>Submit proof</h4>
          <div className="evidenceInputGroup">
            <input className="field" value={proofUrl} onChange={(e) => { setProofUrl(e.target.value); setProofFile(null); }} placeholder="Paste VOD / clip URL" disabled={!!proofFile} />
            <span className="evidenceOr">or</span>
            <label className="btn btn-ghost sm evidenceUploadBtn">
              <Paperclip size={14} /> {proofFile ? proofFile.name.slice(0, 20) : "Upload"}
              <input type="file" accept="video/*,image/*" style={{ display: "none" }} onChange={(e) => { setProofFile(e.target.files?.[0] || null); setProofUrl(""); }} />
            </label>
            {proofFile && <button className="btn btn-ghost sm" onClick={() => setProofFile(null)}><X size={12} /></button>}
          </div>
          <input className="field" value={proofNotes} onChange={(e) => setProofNotes(e.target.value)} placeholder="Notes (optional)" style={{ marginTop: 6 }} />
          <Button variant="primary" className="sm" loading={busy || uploading} onClick={handleSubmitProof} style={{ marginTop: 8 }}>
            <Upload size={14} /> Submit proof
          </Button>
        </div>
      )}

      {/* Admin award controls — assigned admin only */}
      {canAward && (
        <div className="mrDisputeAward">
          <h4>Award winner</h4>
          <div className="chipRow wrap">
            {players.map((p) => (
              <button key={p.id} className={awardWinner === p.id ? "on" : ""} onClick={() => setAwardWinner(p.id)}>
                {p.name}
              </button>
            ))}
          </div>
          <textarea className="field area" rows={2} value={awardNote} onChange={(e) => setAwardNote(e.target.value)} placeholder="Resolution note (optional)" style={{ marginTop: 6 }} />
          <Button variant="primary" loading={busy} onClick={handleAward} style={{ marginTop: 8 }}>
            <Scale size={14} /> Award winner & settle
          </Button>
          {!isAssignedAdmin && isAdmin && (
            <p className="modalNote" style={{ marginTop: 6, fontSize: 11 }}>You are not the assigned admin. Supervisor override active.</p>
          )}
        </div>
      )}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════════════════════════════════════

function ReportModal({ open, onClose, match, players, onDone, toast }) {
  const { user } = useAuth();
  const [winner, setWinner] = useState(players[0]?.id || "");
  const [score, setScore] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  const mapsNeeded = mapsNeededForSeries(match.series);
  const [mapScores, setMapScores] = useState(() => Array.from({ length: mapsNeeded }, () => ({ a: "", b: "" })));

  function updateMapScore(idx, side, val) {
    setMapScores(prev => prev.map((s, i) => i === idx ? { ...s, [side]: val } : s));
  }

  function buildScoreString() {
    if (mapsNeeded <= 1) return score;
    return mapScores.map((s, i) => `Map ${i + 1}: ${s.a || "?"}-${s.b || "?"}`).join(", ");
  }

  async function resolveEvidenceUrl() {
    if (evidenceFile) {
      setUploading(true);
      const { url, error } = await uploadEvidence(match.id, user.id, evidenceFile);
      setUploading(false);
      if (error) { toast.error("Upload failed: " + error); return null; }
      return url;
    }
    return evidenceUrl || null;
  }

  return (
    <Modal open={open} onClose={onClose} eyebrow="REPORT RESULT" title="Who won?" size="sm">
      <div className="chipRow wrap">
        {players.map((p) => (
          <button key={p.id} className={winner === p.id ? "on" : ""} onClick={() => setWinner(p.id)}>{p.name}</button>
        ))}
      </div>

      {mapsNeeded > 1 ? (
        <>
          <label className="fieldLbl" id="score-per-map-label">Score per map</label>
          {mapScores.map((s, i) => (
            <div key={i} className="mrScoreRow">
              <span className="mrScoreLabel">Map {i + 1}</span>
              <input className="field mrScoreInput" value={s.a} onChange={(e) => updateMapScore(i, "a", e.target.value)} placeholder="0" aria-label={`Map ${i + 1} team A score`} />
              <span className="mrScoreDash">—</span>
              <input className="field mrScoreInput" value={s.b} onChange={(e) => updateMapScore(i, "b", e.target.value)} placeholder="0" aria-label={`Map ${i + 1} team B score`} />
            </div>
          ))}
        </>
      ) : (
        <>
          <label className="fieldLbl">Score (optional)</label>
          <input className="field" value={score} onChange={(e) => setScore(e.target.value)} placeholder="e.g. 6-4" />
        </>
      )}

      <label className="fieldLbl">Evidence</label>
      <div className="evidenceInputGroup">
        <input className="field" value={evidenceUrl} onChange={(e) => { setEvidenceUrl(e.target.value); setEvidenceFile(null); }} placeholder="Paste VOD / clip URL" disabled={!!evidenceFile} />
        <span className="evidenceOr">or</span>
        <label className="btn btn-ghost sm evidenceUploadBtn">
          <Paperclip size={14} /> {evidenceFile ? evidenceFile.name.slice(0, 20) : "Upload file"}
          <input type="file" accept="video/*,image/*" style={{ display: "none" }} onChange={(e) => { setEvidenceFile(e.target.files?.[0] || null); setEvidenceUrl(""); }} />
        </label>
        {evidenceFile && <button className="btn btn-ghost sm" onClick={() => setEvidenceFile(null)}><X size={12} /></button>}
      </div>
      <p className="modalNote" style={{ marginTop: 4, fontSize: 12 }}>If your opponent doesn't respond within 2 hours, this result stands.</p>

      <Button variant="primary" className="wide" loading={busy || uploading} onClick={async () => {
        setBusy(true);
        const finalUrl = await resolveEvidenceUrl();
        if (evidenceFile && !finalUrl) { setBusy(false); return; }
        const res = await reportMatch(match.id, { winnerId: winner, score: buildScoreString(), evidenceUrl: finalUrl });
        setBusy(false);
        if (res.error) return toast.error(res.error);
        toast.success("Result reported.");
        onDone(); onClose();
      }}>Submit result</Button>
    </Modal>
  );
}

function DisputeModal({ open, onClose, match, onDone, toast }) {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  async function resolveEvidenceUrl() {
    if (evidenceFile) {
      setUploading(true);
      const { url, error } = await uploadEvidence(match.id, user.id, evidenceFile);
      setUploading(false);
      if (error) { toast.error("Upload failed: " + error); return null; }
      return url;
    }
    return evidenceUrl || null;
  }

  return (
    <Modal open={open} onClose={onClose} eyebrow="CONTEST RESULT" title="Contest this match result" size="sm">
      <p className="modalNote">Our team will review both sides. Add as much detail as you can.{match.weapon_restriction ? " Include timestamps if this is a weapon-restriction forfeit claim." : ""}</p>
      <p className="modalNote">Match ticket: <b>#{match.match_number}</b></p>
      <label className="fieldLbl" htmlFor="dispute-reason">What happened?</label>
      <textarea id="dispute-reason" className="field area" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Describe the issue..." />
      <label className="fieldLbl">Evidence</label>
      <div className="evidenceInputGroup">
        <input className="field" value={evidenceUrl} onChange={(e) => { setEvidenceUrl(e.target.value); setEvidenceFile(null); }} placeholder="Paste VOD / clip URL" disabled={!!evidenceFile} />
        <span className="evidenceOr">or</span>
        <label className="btn btn-ghost sm evidenceUploadBtn">
          <Paperclip size={14} /> {evidenceFile ? evidenceFile.name.slice(0, 20) : "Upload file"}
          <input type="file" accept="video/*,image/*" style={{ display: "none" }} onChange={(e) => { setEvidenceFile(e.target.files?.[0] || null); setEvidenceUrl(""); }} />
        </label>
        {evidenceFile && <button className="btn btn-ghost sm" onClick={() => setEvidenceFile(null)}><X size={12} /></button>}
      </div>
      <Button variant="danger" className="wide" loading={busy || uploading} onClick={async () => {
        if (!reason.trim()) return toast.error("Add a reason.");
        setBusy(true);
        const finalUrl = await resolveEvidenceUrl();
        if (evidenceFile && !finalUrl) { setBusy(false); return; }
        const res = await openDispute(match.id, { reason, evidenceUrl: finalUrl });
        setBusy(false);
        if (res.error) return toast.error(res.error);
        toast.success("Result contested. Our team will review it.");
        onDone(); onClose();
      }}>Submit</Button>
    </Modal>
  );
}

function CancelModal({ open, onClose, match, onDone, toast }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onClose} eyebrow="REQUEST CANCEL" title="Request to cancel this match" size="sm">
      <p className="modalNote">The other side has to accept before anything closes.{match.kind === "cash" ? " If accepted, entries are refunded to both balances." : ""}</p>
      <label className="fieldLbl">Reason (optional)</label>
      <textarea className="field area" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="No-show, connection issues, mutual agreement..." />
      <Button variant="danger" className="wide" loading={busy} onClick={async () => {
        setBusy(true);
        const res = await requestMatchCancel(match.id, reason);
        setBusy(false);
        if (res.error) return toast.error(res.error);
        toast.success("Cancel request sent.");
        onDone(); onClose();
      }}>Send cancel request</Button>
    </Modal>
  );
}
