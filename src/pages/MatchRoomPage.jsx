import React, { useState, useEffect, useRef } from "react";
import { clickable } from "../utils/a11y";
import { Flag, AlertTriangle, Upload, ChevronLeft, Crosshair, Send, XCircle, Check, X, Gamepad2, Monitor, Tv, ExternalLink, Shield, Copy, ChevronDown, UserX, Headphones, Paperclip, Scale, Link as LinkIcon, TicketCheck, Clock, Hash, Users, Globe, MapPin, Zap, Trophy, Swords } from "lucide-react";
import { PSNIcon, XboxIcon } from "../components/PlatformIcons";
import { useAuth } from "../hooks/useAuth.jsx";
import { useToast } from "../hooks/useToast.jsx";
import {
  getMatch, reportMatch, openDispute, subscribeToMatch,
  submitVeto, requestMatchCancel, respondMatchCancel, getCancelRequest,
  subscribeToCancelRequests, getTournamentContext,
  getMatchDispute, submitDisputeProof, adminAwardMatch, getMatchReports
} from "../services/matchService";
import { useCountdown } from "../hooks/useAsync";
import { getMatchMessages, sendMatchMessage, subscribeToMatchMessages } from "../services/matchChatService";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { Skeleton } from "../components/Skeleton";
import { WagrBadge } from "../components/WagrBadge";
import { RankStar } from "../components/RankStar";
import { TrophyIcon } from "../components/TrophyIcon";
import { money, shortTime } from "../utils/format";
import { modeRule, seriesRule, formatLabel, RAKE_CONFIG, mapsForGameMode, mapsNeededForSeries, seriesLabel, pcPlayersFromPlatform, isConsoleOnlyGame, NO_SHOW_MINUTES, getMatchSetup, countryFlag } from "../utils/games";
import { uploadEvidence } from "../utils/storage";
import { canEscalateMatch, escalateMatch } from "../services/escalationService";
import { MapCard } from "../components/MapCard";
import { mapHue as getMapHue } from "../utils/mapImages";
import { rankForXp } from "../utils/ranks";
import { supabase } from "../lib/supabase";


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
  const [reports, setReports] = useState([]);
  const [escalation, setEscalation] = useState({ can: false, reason: "" });
  const [escOpen, setEscOpen] = useState(false);

  async function loadReports() {
    const { data } = await getMatchReports(matchId);
    setReports(data || []);
  }

  async function loadEscalation() {
    if (!user) return;
    const { data } = await canEscalateMatch(matchId);
    setEscalation(data || { can_escalate: false, reason: "" });
  }

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

  useEffect(() => { load(); loadCancel(); loadTournamentCtx(); loadDispute(); loadEscalation(); loadReports(); }, [matchId]); // eslint-disable-line
  useEffect(() => subscribeToMatch(matchId, () => { load(); loadDispute(); loadReports(); }), [matchId]); // eslint-disable-line
  useEffect(() => subscribeToCancelRequests(matchId, loadCancel), [matchId]); // eslint-disable-line

  if (loading) return <main className="page"><Skeleton w="40%" h={28} /><div style={{ height: 16 }} /><Skeleton h={180} r={14} /></main>;
  if (error) return <main className="page"><div className="errorState"><AlertTriangle size={22} /><p>{error}</p><button className="btn btn-ghost sm" onClick={load}><span>Retry</span></button></div></main>;
  if (!match) return <main className="page"><p className="sub">Match not found.</p></main>;

  const players = (match.match_players || []).map((p) => ({
    id: p.user_id,
    name: p.profiles?.username || "Player",
    country: p.profiles?.country,
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
  const pot = match.kind === "cash" ? match.entry * 2 : 0;
  const winner = match.winner_id ? players.find((p) => p.id === match.winner_id) : null;
  const teamSize = parseInt(match.format) || 1;
  const mapHue = match.map ? getMapHue(match.map, match.game) : 200;
  const needsAdmin = match.kind === "cash" || !!tournamentCtx;

  return (
    <main className="page matchRoomPage" aria-label="Match room">
      {/* §1 -- Context strip */}
      <ContextStrip
        tournamentCtx={tournamentCtx}
        onBack={onBack}
        onNavigate={onNavigate}
      />

      {/* §2 -- Banner */}
      <MatchBanner
        match={match}
        statusLabel={statusLabel}
        pot={pot}
        mapHue={mapHue}
        tournamentCtx={tournamentCtx}
      />

      {/* §3 -- Detail grid */}
      <DetailGrid match={match} naCount={naCount} euCount={euCount} />

      {/* §4 -- Quick tools row */}
      <QuickTools match={match} tournamentCtx={tournamentCtx} onNavigate={onNavigate} />

      {/* Weapon restriction banner */}
      {match.weapon_restriction && (
        <div className="errBanner weaponBanner">
          <AlertTriangle size={14} /> {match.weapon_restriction}: only the M15 and Dravec may be used. Any other weapon = forfeit for that team's round.
        </div>
      )}

      {/* Cancel request banner (not for tournament matches) */}
      {cancelReq && !tournamentCtx && (
        <CancelBanner req={cancelReq} isParticipant={isParticipant} onDone={() => { loadCancel(); load(); }} />
      )}

      {/* Map veto */}
      {isParticipant && inVeto && (
        <VetoPanel match={match} players={players} userId={user.id} onDone={load} />
      )}

      {/* §5 -- Map schedule cards */}
      <MapScheduleCards match={match} players={players} teamSize={teamSize} />

      {/* §6 -- Rosters */}
      <RosterSection
        match={match}
        players={players}
        teamSize={teamSize}
        winner={winner}
        onNavigate={onNavigate}
        showGamertags={isParticipant}
      />

      {/* Reported result — who claimed what + auto-resolve countdown */}
      {(match.status === "reported" || match.status === "disputed") && reports.length > 0 && (
        <ReportedResultPanel
          reports={reports}
          players={players}
          userId={user?.id}
          isParticipant={isParticipant}
          status={match.status}
          onConfirm={() => setReportOpen(true)}
          onContest={() => setDisputeOpen(true)}
        />
      )}

      {/* No-show timer */}
      {isParticipant && match.status === "live" && !inVeto && (
        <NoShowTimer match={match} userId={user.id} onClaim={async () => {
          const res = await openDispute(match.id, { reason: `No-show: opponent did not join within the ${NO_SHOW_MINUTES}-minute window.` });
          if (res?.error) return toast.error(res.error);
          toast.success("No-show claimed. Match will be reviewed.");
          load();
        }} />
      )}

      {/* Actions (live only — once reported, the ReportedResultPanel drives confirm/contest) */}
      {isParticipant && match.status === "live" && !inVeto && (
        <div className="roomActions">
          <Button variant="primary" onClick={() => setReportOpen(true)}><Flag size={15} /> Report result</Button>
          <Button variant="ghost" onClick={() => setDisputeOpen(true)}><AlertTriangle size={15} /> Contest result</Button>
          {!cancelReq && !tournamentCtx && <Button variant="ghost" onClick={() => setCancelOpen(true)}><XCircle size={15} /> Request cancel</Button>}
        </div>
      )}

      {/* Dispute panel */}
      {match.status === "disputed" && dispute && (
        <DisputePanel
          dispute={dispute}
          match={match}
          players={players}
          userId={user?.id}
          isAdmin={isAdmin && needsAdmin}
          isParticipant={isParticipant}
          onDone={() => { load(); loadDispute(); }}
        />
      )}

      {/* Escalation — cash + tournament only */}
      {needsAdmin && isParticipant && escalation.can_escalate && (match.status === "settled" || match.status === "disputed") && (
        <div className="mrEscalation">
          <div className="mrEscInfo">
            <TicketCheck size={16} />
            <span>Unhappy with the outcome? You can escalate this match for an admin review within 24 hours.</span>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setEscOpen(true)}>
            <TicketCheck size={14} /> Escalate
          </Button>
        </div>
      )}

      {/* Chat dock — admin only joins for cash/tournament */}
      {(isParticipant || (isAdmin && needsAdmin)) && (
        <ChatDock
          matchId={matchId}
          userId={user?.id}
          username={profile?.username}
          isAdmin={isAdmin && needsAdmin}
          isParticipant={isParticipant}
          matchStatus={match.status}
          needsAdmin={needsAdmin}
          inVeto={inVeto}
          onNoShow={async () => {
            const res = await openDispute(match.id, { reason: `No-show: opponent did not join within the ${NO_SHOW_MINUTES}-minute window.` });
            if (res?.error) return toast.error(res.error);
            toast.success(needsAdmin ? "No-show reported. An admin will review." : "No-show reported. Match will be reviewed.");
          }}
          onRequestAdmin={needsAdmin ? async () => {
            const res = await openDispute(match.id, { reason: "Admin requested from chat.", evidenceUrl: null });
            if (res.error) return toast.error(res.error);
            toast.success("Admin assigned. Check the dispute panel.");
            load(); loadDispute();
          } : null}
        />
      )}

      {/* Modals */}
      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} match={match} players={players} onDone={load} toast={toast} />
      <DisputeModal open={disputeOpen} onClose={() => setDisputeOpen(false)} match={match} onDone={() => { load(); loadDispute(); }} toast={toast} />
      <CancelModal open={cancelOpen} onClose={() => setCancelOpen(false)} match={match} onDone={() => { loadCancel(); load(); }} toast={toast} />
      <EscalateModal open={escOpen} onClose={() => setEscOpen(false)} matchId={matchId} onDone={() => { setEscOpen(false); loadEscalation(); }} />
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// NO-SHOW TIMER
// ═══════════════════════════════════════════════════════════════════════════

function AutoResolveTimer({ deadline }) {
  const { h, m, s } = useCountdown(deadline);
  if (h <= 0 && m <= 0 && s <= 0) return <b>moments</b>;
  return <b>{h > 0 ? `${h}h ` : ""}{m}m {String(s).padStart(2, "0")}s</b>;
}

function ReportedResultPanel({ reports, players, userId, isParticipant, status, onConfirm, onContest }) {
  const nameOf = (id) => players.find((p) => p.id === id)?.name || "Player";
  const winnerName = (r) => (r.winner_id ? nameOf(r.winner_id) : "Draw / unclear");
  const reporterName = (r) => r.reporter?.username || nameOf(r.reported_by);

  const myReport = reports.find((r) => r.reported_by === userId);
  const winnersClaimed = new Set(reports.map((r) => r.winner_id));
  const conflict = reports.length >= 2 && winnersClaimed.size > 1;
  const single = reports.length === 1;
  const deadline = single ? new Date(reports[0].created_at).getTime() + 2 * 60 * 60 * 1000 : null;

  return (
    <section className="roomCard reportPanel">
      <h3><Flag size={15} /> Reported Result</h3>

      <div className="reportClaims">
        {reports.map((r) => (
          <div className={`reportClaim ${conflict ? "conflict" : ""}`} key={r.id}>
            <div className="reportClaimTop">
              <span className="reportClaimWho">{reporterName(r)}{r.reported_by === userId ? " (you)" : ""}</span>
              <span className="reportClaimTime"><Clock size={11} /> {shortTime(r.created_at)}</span>
            </div>
            <div className="reportClaimBody">
              <span className="reportClaimWinner"><Trophy size={13} /> {winnerName(r)} <small>won</small></span>
              {r.score && <span className="reportClaimScore">{r.score}</span>}
              {r.evidence_url && (
                <a className="reportClaimProof" href={r.evidence_url} target="_blank" rel="noreferrer">
                  <Paperclip size={12} /> Evidence
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {status === "reported" && conflict && (
        <div className="reportNotice conflict">
          <AlertTriangle size={15} />
          <span>Both sides reported different winners. This won't auto-settle — open a dispute to get an admin to review the evidence.</span>
        </div>
      )}

      {status === "reported" && single && (
        <div className="reportNotice">
          <Clock size={15} />
          {myReport ? (
            <span>You submitted your result. Waiting on your opponent to confirm — if they don't respond, your result stands in <AutoResolveTimer deadline={deadline} />.</span>
          ) : (
            <span><b>{reporterName(reports[0])}</b> reported <b>{winnerName(reports[0])}</b> as the winner. Confirm if that's right, or contest it — it auto-settles in <AutoResolveTimer deadline={deadline} /> if you don't respond.</span>
          )}
        </div>
      )}

      {status === "disputed" && (
        <div className="reportNotice"><Scale size={15} /><span>This match is under admin review. The submitted results above are what each side claimed.</span></div>
      )}

      {isParticipant && status === "reported" && (
        <div className="reportActions">
          {!myReport && !conflict && (
            <Button variant="primary" onClick={onConfirm}><Check size={15} /> Confirm result</Button>
          )}
          <Button variant="ghost" onClick={onContest}><AlertTriangle size={15} /> Contest result</Button>
        </div>
      )}
    </section>
  );
}

function NoShowTimer({ match, userId, onClaim }) {
  const [secsLeft, setSecsLeft] = useState(() => {
    const start = match.accepted_at ? new Date(match.accepted_at).getTime() : Date.now();
    const deadline = start + NO_SHOW_MINUTES * 60 * 1000;
    return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  });

  useEffect(() => {
    const start = match.accepted_at ? new Date(match.accepted_at).getTime() : Date.now();
    const deadline = start + NO_SHOW_MINUTES * 60 * 1000;
    const tick = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecsLeft(left);
      if (left <= 0) clearInterval(tick);
    }, 1000);
    return () => clearInterval(tick);
  }, [match.accepted_at]);

  const mins = Math.floor(secsLeft / 60);
  const secs = secsLeft % 60;
  const expired = secsLeft <= 0;
  const pct = Math.max(0, Math.min(100, (secsLeft / (NO_SHOW_MINUTES * 60)) * 100));

  return (
    <section className="noShowTimer">
      <div className="nstHead">
        <UserX size={16} />
        <span>{expired ? "No-show window expired" : "No-show timer"}</span>
      </div>
      <div className="nstBar"><div className="nstFill" style={{ width: `${pct}%` }} /></div>
      <div className="nstRow">
        <span className={`nstTime ${expired ? "expired" : ""}`}>
          {expired ? "00:00" : `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`}
        </span>
        {expired && (
          <button className="btn btn-warn sm" onClick={onClaim}>
            Claim No-Show Win
          </button>
        )}
      </div>
      {!expired && <p className="nstHint">If your opponent doesn't show, you can claim a free win once this timer runs out.</p>}
    </section>
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
// §2 — BANNER
// ═══════════════════════════════════════════════════════════════════════════

function MatchBanner({ match, statusLabel, pot, mapHue, tournamentCtx }) {
  const eyebrow = tournamentCtx ? "TOURNAMENT MATCH" : match.kind === "cash" ? "CASH MATCH" : "XP MATCH";
  const isCash = match.kind === "cash";

  return (
    <section className="dbHead" style={{ "--db-accent": isCash ? "var(--gold)" : "var(--neon)" }}>
      <div className="dbHeadStripe" />
      <div className="dbHeadBody">
        <div className="dbHeadTop">
          <span className={`dbKind ${isCash ? "cash" : "xp"}`}>
            {!isCash && <Zap size={11} />}{eyebrow}
          </span>
          <span className={`roomStatus s-${match.status}`} aria-live="polite">{statusLabel}</span>
        </div>
        <h1 className="dbHeadTitle">{match.game}</h1>
        <p className="dbHeadSub">
          {formatLabel(match.format)} &middot; {match.mode} &middot; {seriesLabel(match.series)}
        </p>
        <div className="dbHeadPills">
          <span className="dbPill">{match.platform}</span>
          <span className="dbPill">{match.region}</span>
          {match.skill_tier !== "Open" && <span className="dbPill hi">{match.skill_tier}</span>}
          {match.weapon_restriction && <span className="dbPill warn">{match.weapon_restriction}</span>}
        </div>
      </div>
      {isCash && pot > 0 && (
        <div className="dbHeadPot">
          <small>POT</small>
          <b className="cash">{money(pot)}</b>
        </div>
      )}
      {match.map && (
        <div className="dbHeadMap">
          <MapCard map={match.map} game={match.game} size="lg" />
        </div>
      )}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// §3 — DETAIL GRID
// ═══════════════════════════════════════════════════════════════════════════

function DetailGrid({ match, naCount, euCount }) {
  const items = [
    [Clock, new Date(match.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })],
    [Hash, match.code],
    [Users, formatLabel(match.format)],
    [Crosshair, match.mode],
    [Gamepad2, seriesLabel(match.series)],
  ];
  if (match.region === "NA + EU") items.push([Globe, `${match.host_region || "TBD"} · ${naCount}NA / ${euCount}EU`]);
  if (!isConsoleOnlyGame(match.game)) items.push([Monitor, match.allowed_input || "Controller + M&K"]);
  if (match.map) items.push([MapPin, match.map]);
  else if (match.veto_status !== "pending") items.push([MapPin, "TBD (veto)"]);

  return (
    <section className="dbInfoStrip">
      {items.map(([Icon, label], i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="dbInfoDot">·</span>}
          <div className="dbInfoItem">
            <Icon size={13} />
            <span>{label}</span>
          </div>
        </React.Fragment>
      ))}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// §4 — QUICK TOOLS
// ═══════════════════════════════════════════════════════════════════════════

function QuickTools({ match, tournamentCtx, onNavigate }) {
  const toast = useToast();
  const [panel, setPanel] = useState(null);
  const toggle = (p) => setPanel(panel === p ? null : p);
  const setup = getMatchSetup(match.game, match.mode);

  return (
    <section className="dbTools">
      <div className="dbToolRow">
        <button className={`dbToolBtn ${panel === "rules" ? "active" : ""}`} onClick={() => toggle("rules")}>
          <Shield size={14} />
          <span>Rules</span>
          <ChevronDown size={12} className={`dbToolChev ${panel === "rules" ? "open" : ""}`} />
        </button>
        {setup && (
          <button className={`dbToolBtn ${panel === "setup" ? "active" : ""}`} onClick={() => toggle("setup")}>
            <Gamepad2 size={14} />
            <span>Match Setup</span>
            <ChevronDown size={12} className={`dbToolChev ${panel === "setup" ? "open" : ""}`} />
          </button>
        )}
        <button className="dbToolBtn" onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Match link copied!"); }}>
          <Copy size={14} />
          <span>Copy Link</span>
        </button>
        {tournamentCtx && (
          <button className="dbToolBtn" onClick={() => onNavigate?.("tournament", tournamentCtx.tournamentId)}>
            <ExternalLink size={14} />
            <span>Bracket</span>
          </button>
        )}
      </div>

      {panel === "rules" && (
        <div className="dbRulesBody">
          <p className="ruleNote inline">{modeRule(match.mode)}</p>
          <p className="ruleNote inline">{seriesRule(match.series)}</p>
          <ul className="roomRules">
            <li>{match.platform === "PC + Console Mixed" ? "PC and console players share this lobby." : match.platform === "Console Only" ? "Console only. No PC." : `${match.platform} lobby.`}{match.allowed_input === "Controller Only" ? " Controller only. No M&K." : ""}</li>
            <li>All proof must be <b>video format</b> (VOD, clip, DVR recording). Screenshots alone are insufficient.</li>
            <li>Proof must show the <b>full scoreboard with gamertags</b> clearly visible.</li>
            <li>PC players must stream with past broadcasts enabled. VOD must stay up for 24 hours.</li>
            <li>Conversations outside Dubbed (DMs, Xbox/PSN messages) are not valid proof.</li>
            <li>Match ticket: <b>#{match.match_number || match.code}</b>. Reference this in any dispute.</li>
            {match.kind === "cash" && <li>Rake: {RAKE_CONFIG.standard * 100}% standard / {RAKE_CONFIG.wagr * 100}% WAGR members (min {money(RAKE_CONFIG.minimum)}).</li>}
            <li>If your opponent doesn't show within <b>{NO_SHOW_MINUTES} minutes</b>, you can claim a no-show forfeit.</li>
            <li>If one team reports a result and the opponent does not respond within <b>2 hours</b>, the reported result stands.</li>
          </ul>
        </div>
      )}

      {panel === "setup" && setup && <MatchSetupPanel setup={setup} />}
    </section>
  );
}

function MatchSetupPanel({ setup }) {
  return (
    <div className="dbRulesBody dbSetupBody">
      <div className="dbSetupHead">
        <Gamepad2 size={14} />
        <b>{setup.gameMode}</b>
      </div>
      {setup.note && <p className="ruleNote inline">{setup.note}</p>}

      {setup.settings?.length > 0 && (
        <table className="dbSetupTable">
          <thead><tr><th>Setting</th><th>Value</th></tr></thead>
          <tbody>
            {setup.settings.map((r) => (
              <tr key={r.s}><td>{r.s}</td><td className={r.ban ? "dbSetupBan" : ""}>{r.v}</td></tr>
            ))}
          </tbody>
        </table>
      )}

      {setup.weapons && typeof setup.weapons === "object" && (
        <div className="dbSetupSection">
          <b>Weapons</b>
          {setup.weapons.allowed && <p className="dbSetupAllowed">Allowed: {setup.weapons.allowed.join(", ")}</p>}
          {setup.weapons.secondary && <p className="dbSetupAllowed">Secondary: {setup.weapons.secondary.join(", ")}</p>}
          {setup.weapons.banned && <p className="dbSetupBanned">Banned: {setup.weapons.banned}</p>}
          {setup.weapons.bannedAttachments && <p className="dbSetupBanned">Banned attachments: {setup.weapons.bannedAttachments}</p>}
        </div>
      )}
      {setup.weapons && typeof setup.weapons === "string" && (
        <div className="dbSetupSection"><b>Weapons</b><p className="ruleNote inline">{setup.weapons}</p></div>
      )}

      {setup.equipment && typeof setup.equipment === "object" && (
        <div className="dbSetupSection">
          <b>Equipment</b>
          {setup.equipment.lethals && <p className="dbSetupAllowed">Lethals: {setup.equipment.lethals.join(", ")}</p>}
          {setup.equipment.tacticals && <p className="dbSetupAllowed">Tacticals: {setup.equipment.tacticals.join(", ")}</p>}
          {setup.equipment.fieldUpgrades && <p className="dbSetupAllowed">Field Upgrades: {setup.equipment.fieldUpgrades.join(", ")}</p>}
          {setup.equipment.wildcard && <p className="dbSetupAllowed">Wildcard: {setup.equipment.wildcard}</p>}
        </div>
      )}
      {setup.equipment && typeof setup.equipment === "string" && (
        <div className="dbSetupSection"><b>Equipment</b><p className="ruleNote inline">{setup.equipment}</p></div>
      )}

      {setup.perks && Array.isArray(setup.perks) && (
        <div className="dbSetupSection">
          <b>Perks</b>
          {setup.perks.map((p) => (
            <p key={p.slot} className="dbSetupAllowed"><span className="dbSetupPerkSlot">{p.slot}:</span> {p.allowed}</p>
          ))}
        </div>
      )}
      {setup.perks && typeof setup.perks === "string" && (
        <div className="dbSetupSection"><b>Perks</b><p className="ruleNote inline">{setup.perks}</p></div>
      )}

      {setup.extra && <p className="dbSetupExtra">{setup.extra}</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// §6 — ROSTERS
// ═══════════════════════════════════════════════════════════════════════════

function RosterSection({ match, players, teamSize, winner, onNavigate, showGamertags }) {
  const settled = match.status === "settled";

  if (teamSize === 1) {
    /* 1v1 — face-off card (tale of the tape) */
    if (players.length >= 2) {
      const [p1, p2] = players;
      const r1 = rankForXp(p1.xp), r2 = rankForXp(p2.xp);
      const t1 = p1.wins + p1.losses, t2 = p2.wins + p2.losses;
      const wr1 = t1 ? Math.round((p1.wins / t1) * 100) : 0;
      const wr2 = t2 ? Math.round((p2.wins / t2) * 100) : 0;
      const w1 = match.winner_id === p1.id, w2 = match.winner_id === p2.id;

      return (
        <section className="dbRosters">
          <div className="dbSectionHead"><Swords size={15} /><h3>Rosters</h3></div>
          {settled && winner && (
            <div className="dbResult">
              <Trophy size={18} />
              <span><b>{winner.name}</b> {match.kind === "cash" ? `takes ${money(match.entry * 2)}` : "earns the W"}</span>
            </div>
          )}
          <div className="dbFaceoff">
            <div className="dbFoPlayers">
              <FoSide player={p1} rank={r1} won={w1} settled={settled} onNavigate={onNavigate} showGamertags={showGamertags} />
              <div className="dbFoCenter">
                <div className="dbFoCenterLine" />
                <span className="dbFoVs">VS</span>
                <div className="dbFoCenterLine" />
              </div>
              <FoSide player={p2} rank={r2} won={w2} settled={settled} onNavigate={onNavigate} showGamertags={showGamertags} />
            </div>
            <div className="dbFoStats">
              <div className="dbFoStatRow">
                <span className={w1 ? "hi" : ""}>{p1.wins}W-{p1.losses}L</span>
                <small>RECORD</small>
                <span className={w2 ? "hi" : ""}>{p2.wins}W-{p2.losses}L</span>
              </div>
              <div className="dbFoStatRow">
                <span className={w1 ? "hi" : ""}>{wr1}%</span>
                <small>WIN %</small>
                <span className={w2 ? "hi" : ""}>{wr2}%</span>
              </div>
              <div className="dbFoStatRow">
                <span className={w1 ? "hi" : ""}>{money(p1.earnings)}</span>
                <small>EARNINGS</small>
                <span className={w2 ? "hi" : ""}>{money(p2.earnings)}</span>
              </div>
            </div>
          </div>
        </section>
      );
    }

    /* 1v1 waiting for opponent */
    const p = players[0];
    const pRank = p ? rankForXp(p.xp) : null;
    return (
      <section className="dbRosters">
        <div className="dbSectionHead"><Swords size={15} /><h3>Rosters</h3></div>
        <div className="dbFaceoff">
          <div className="dbFoPlayers">
            {p ? (
              <FoSide player={p} rank={pRank} won={false} settled={false} onNavigate={onNavigate} showGamertags={showGamertags} />
            ) : (
              <div className="dbFoSide empty"><div className="dbFoAvatar"><span>?</span></div><b className="dbFoName">Waiting...</b></div>
            )}
            <div className="dbFoCenter">
              <div className="dbFoCenterLine" />
              <span className="dbFoVs">VS</span>
              <div className="dbFoCenterLine" />
            </div>
            <div className="dbFoSide empty"><div className="dbFoAvatar"><span>?</span></div><b className="dbFoName">Waiting...</b></div>
          </div>
        </div>
      </section>
    );
  }

  /* Team matches (2v2+) — stacked roster cards */
  const teams = {};
  players.forEach(p => { const t = p.teamName || "Team"; (teams[t] = teams[t] || []).push(p); });
  const sides = Object.entries(teams);
  const sideA = sides[0] || ["Team 1", []];
  const sideB = sides[1] || ["Waiting...", []];
  const aWon = sideA[1].some(p => match.winner_id === p.id);
  const bWon = sideB[1].some(p => match.winner_id === p.id);

  function TeamRosterCard({ teamName, teamPlayers, won }) {
    const totalWins = teamPlayers.reduce((s, p) => s + p.wins, 0);
    const totalLosses = teamPlayers.reduce((s, p) => s + p.losses, 0);
    const totalGames = totalWins + totalLosses;
    const winPct = totalGames ? Math.round((totalWins / totalGames) * 100) : 0;
    return (
      <div className={`dbTeamCard ${won ? "winner" : ""} ${settled && !won ? "loser" : ""}`}>
        <div className="dbTeamHead">
          <div className="dbTeamAvatar">{teamName.slice(0, 2)}</div>
          <div className="dbTeamInfo">
            <b>{teamName}</b>
            <small>{winPct}% Win &middot; {totalWins}W-{totalLosses}L</small>
          </div>
          {settled && <span className={`dbFoBadge ${won ? "w" : "l"}`}>{won ? "W" : "L"}</span>}
        </div>
        <div className="dbTeamPlayers">
          {teamPlayers.map(p => {
            const rank = rankForXp(p.xp);
            return (
              <div key={p.id} className="dbTeamPlayer" {...clickable(() => onNavigate?.("profile", p.name))}>
                <div className="dbTeamPlayerAvatar" style={{ borderColor: rank.glow }}>
                  {p.avatar_url ? <img src={p.avatar_url} alt="" /> : <span>{p.name.slice(0,2)}</span>}
                </div>
                <div className="dbTeamPlayerInfo">
                  <b>{p.name}{p.country && <img className="countryFlag" src={countryFlag(p.country)} alt={p.country} />}{p.wagr && <WagrBadge size={11} />}</b>
                  <small style={{ color: rank.glow }}>{rank.name} &middot; {p.wins}W-{p.losses}L</small>
                </div>
                {showGamertags && p.psn && <span className="dbTeamPlayerTag"><PSNIcon size={11} /> {p.psn}</span>}
                {showGamertags && p.xbox && <span className="dbTeamPlayerTag"><XboxIcon size={11} /> {p.xbox}</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <section className="dbRosters">
      <div className="dbSectionHead"><Swords size={15} /><h3>Rosters</h3></div>
      {settled && (aWon || bWon) && (
        <div className="dbResult">
          <Trophy size={18} />
          <span><b>{aWon ? sideA[0] : sideB[0]}</b> {match.kind === "cash" ? `takes ${money(match.entry * 2)}` : "earns the W"}</span>
        </div>
      )}
      <div className="dbTeamVs">
        <TeamRosterCard teamName={sideA[0]} teamPlayers={sideA[1]} won={aWon} />
        <div className="dbTeamVsDivider"><span>VS</span></div>
        {sideB[1].length > 0 ? (
          <TeamRosterCard teamName={sideB[0]} teamPlayers={sideB[1]} won={bWon} />
        ) : (
          <div className="dbTeamCard empty"><div className="dbTeamHead"><div className="dbTeamAvatar">?</div><b>Waiting for opponents...</b></div></div>
        )}
      </div>
    </section>
  );
}

function FoSide({ player, rank, won, settled, onNavigate, showGamertags }) {
  return (
    <div className={`dbFoSide ${settled && won ? "winner" : ""} ${settled && !won ? "loser" : ""}`}>
      {settled && <span className={`dbFoBadge ${won ? "w" : "l"}`}>{won ? "W" : "L"}</span>}
      <div className="dbFoAvatar" style={{ borderColor: rank.glow }} {...clickable(() => onNavigate?.("profile", player.name))}>
        {player.avatar_url ? <img src={player.avatar_url} alt="" /> : <span>{player.name.slice(0, 2)}</span>}
      </div>
      <b className="dbFoName" {...clickable(() => onNavigate?.("profile", player.name))}>
        {player.name}{player.country && <img className="countryFlag" src={countryFlag(player.country)} alt={player.country} />}{player.wagr && <WagrBadge size={12} />}
      </b>
      <small className="dbFoRank" style={{ color: rank.glow }}>
        <RankStar rank={rank} size={16} /> {rank.name}
      </small>
      {showGamertags && (player.psn || player.xbox || player.activision_id) && (
        <div className="dbFoTags">
          {player.activision_id && <span><Crosshair size={11} /> {player.activision_id}</span>}
          {player.psn && <span><PSNIcon size={12} /> {player.psn}</span>}
          {player.xbox && <span><XboxIcon size={12} /> {player.xbox}</span>}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// §5 — MAP SCHEDULE CARDS
// ═══════════════════════════════════════════════════════════════════════════

function MapScheduleCards({ match, players, teamSize }) {
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

  const cards = [];
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
    cards.push({ num: i + 1, map: mapName, host, rule });
  }

  const isTbd = (name) => name === "TBD";

  return (
    <section className="dbMapSchedule">
      <div className="dbSectionHead">
        <MapPin size={15} />
        <h3>Map & Host Schedule</h3>
      </div>
      <div className="dbMapGrid" style={{ gridTemplateColumns: `repeat(${Math.min(cards.length, 3)}, 1fr)` }}>
        {cards.map((c) => (
          <div key={c.num} className="dbMapCard">
            <span className="dbMapBadge">MAP {c.num}</span>
            <div className="dbMapCardBody">
              {c.map !== "TBD" && <div className="dbMapCardThumb"><MapCard map={c.map} game={match.game} size="sm" /></div>}
              <div className="dbMapCardName">{c.map}</div>
              <div className="dbMapCardRule">{c.rule}</div>
            </div>
            <div className="dbMapCardHost">
              <Headphones size={14} />
              <span className="dbMapHostLabel">Host</span>
              <span className={`dbMapHostName ${isTbd(c.host) ? "tbd" : ""}`}>{c.host}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
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

function ChatDock({ matchId, userId, username, isAdmin, isParticipant, matchStatus, needsAdmin, inVeto, onNoShow, onRequestAdmin }) {
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
            {needsAdmin && onRequestAdmin && (
              <button className="mrChatAction admin" onClick={onRequestAdmin} title="Request an admin">
                <Headphones size={14} /> Request Admin
              </button>
            )}
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
              <span className="mrScoreDash">-</span>
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

function EscalateModal({ open, onClose, matchId, onDone }) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!open) return null;
  return (
    <Modal open={open} title="Escalate Match" onClose={onClose}>
      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
        This creates a ticket that an admin will manually review. You can only escalate once per match, within 24 hours of settlement. Cash matches only.
      </p>
      <textarea
        className="field area"
        placeholder="Explain why you're escalating this match..."
        value={reason}
        onChange={e => setReason(e.target.value)}
        rows={4}
        maxLength={1000}
        style={{ marginBottom: 12, width: "100%", resize: "vertical" }}
      />
      <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, background: priority ? "rgba(255,194,60,.08)" : "rgba(255,255,255,.03)", border: `1px solid ${priority ? "rgba(255,194,60,.3)" : "rgba(255,255,255,.06)"}`, cursor: "pointer", marginBottom: 12, transition: "all .15s" }}>
        <input type="checkbox" checked={priority} onChange={e => setPriority(e.target.checked)} style={{ accentColor: "var(--gold)" }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>
            <Zap size={12} style={{ color: "var(--gold)", marginRight: 4 }} />
            Priority Review — $1.00
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Jump the queue. Your ticket gets reviewed first.</div>
        </div>
      </label>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={busy} disabled={!reason.trim()} onClick={async () => {
          setBusy(true);
          const res = await escalateMatch(matchId, reason.trim(), priority);
          setBusy(false);
          if (res.error) return toast.error(res.error);
          toast.success(priority ? "Priority escalation created. An admin will review your case ASAP." : "Escalation ticket created. An admin will review your case.");
          onDone();
        }}>
          <TicketCheck size={14} /> {priority ? "Submit Priority ($1)" : "Submit Escalation"}
        </Button>
      </div>
    </Modal>
  );
}
