import React, { useState, useMemo, useEffect } from "react";
import { Plus, Crosshair, AlertTriangle, Info, Users, ToggleLeft, ToggleRight } from "lucide-react";
import { WagerIcon } from "../components/WagerIcon";
import { useAuth } from "../hooks/useAuth.jsx";
import { useToast } from "../hooks/useToast.jsx";
import { useAsync } from "../hooks/useAsync";
import { useVisibilityRefresh } from "../hooks/useVisibilityRefresh";
import { listOpenMatches, joinMatch, subscribeToOpenMatches } from "../services/matchService";
import { getMyTeams } from "../services/teamService";
import { CreateMatchModal } from "../components/CreateMatchModal";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { SkeletonRows } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { money } from "../utils/format";
import {
  shortForGame, formatLabel, mapsForGameMode, checkGameEligibility,
  seriesLabel, pcPlayersFromPlatform, isConsoleOnlyGame, getEligibleTeam, seriesRule
} from "../utils/games";
import { MapBadge, MapCard } from "../components/MapCard";
import { track } from "../utils/analytics";
import bo7 from "../assets/black-ops-7.png";
import wz from "../assets/warzone.png";
import mw4Img from "../assets/mw4.png";
import wwiiImg from "../assets/wwii.png";
import bo1Img from "../assets/bo1.png";
import bo2Img from "../assets/bo2.png";

const GAME_COVERS = {
  "Call of Duty: Black Ops 7": bo7, "Warzone": wz, "Black Ops Royale": wz,
  "Call of Duty: Modern Warfare 4": mw4Img, "Call of Duty: WWII": wwiiImg,
  "Call of Duty: Black Ops": bo1Img, "Call of Duty: Black Ops II": bo2Img,
};
const cover = (game) => GAME_COVERS[game] || bo7;

export function MatchfinderPage({ onLogin, onOpenMatch, onNavigate }) {
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [kind, setKind] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [acceptMatch, setAcceptMatch] = useState(null);
  const [joiningId, setJoiningId] = useState(null);
  const { data, loading, error, reload } = useAsync(
    () => listOpenMatches(kind === "all" ? {} : { kind }),
    [kind]
  );
  const { data: myTeams } = useAsync(
    () => profile ? getMyTeams(profile.id) : Promise.resolve({ data: [] }),
    [profile?.id]
  );

  useVisibilityRefresh(reload, [kind]);

  useEffect(() => {
    const unsub = subscribeToOpenMatches(() => reload());
    return unsub;
  }, [reload]);

  function handleAccept(m) {
    if (!profile) return onLogin();
    setAcceptMatch(m);
  }

  async function doJoin(matchId, vetoBan, roster) {
    setJoiningId(matchId);
    const res = await joinMatch(matchId, vetoBan, roster);
    setJoiningId(null);
    if (res.error) {
      const msg = res.error.toLowerCase();
      if (msg.includes("not open") || msg.includes("already joined") || msg.includes("not found")) {
        toast.error("Match already taken — someone beat you to it.");
      } else if (msg.includes("insufficient balance")) {
        toast.error("Insufficient balance. Deposit to play.");
      } else {
        toast.error(res.error);
      }
      reload();
      return;
    }
    track.matchJoin("match", 0);
    toast.success("Joined! Match is live — GL.");
    refreshProfile();
    reload();
    onOpenMatch?.(matchId);
  }

  return (
    <main className="page">
      <div className="pageHead rowHead">
        <div>
          <div className="eyebrow">OPEN LOBBIES</div>
          <h1>Matchfinder</h1>
          <p className="sub">Jump into an open lobby or post your own. Cash and XP matches across every current CoD title.</p>
        </div>
        <Button variant="primary" onClick={() => (profile ? setCreateOpen(true) : onLogin())}>
          <Plus size={16} /> Create match
        </Button>
      </div>

      <div className="segRow inline">
        {["all", "cash", "xp"].map((k) => (
          <button key={k} className={kind === k ? "on" : ""} onClick={() => setKind(k)}>
            {k === "all" ? "All" : k === "cash" ? "Cash" : "XP"}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonRows rows={5} />
      ) : error ? (
        <div className="errorState"><p>{error}</p><button className="btn btn-ghost sm" onClick={reload}>Retry</button></div>
      ) : !data || data.length === 0 ? (
        <EmptyState icon={() => <WagerIcon size={26} />} title="No open matches" action={
          <Button variant="primary" onClick={() => (profile ? setCreateOpen(true) : onLogin())}>Create the first one</Button>
        }>
          Be the first to post a lobby. It'll appear here instantly with its own ticket.
        </EmptyState>
      ) : (
        <div className="matchList">
          {data.map((m) => {
            const isMine = profile && m.created_by === profile.id;
            const mElig = profile ? checkGameEligibility(m.game, profile, myTeams) : { eligible: true };
            return (
            <div className="matchTile" key={m.id} onClick={() => isMine ? onOpenMatch?.(m.id) : handleAccept(m)} style={{ cursor: "pointer" }}>
              <img className="matchCover" src={cover(m.game)} alt="" loading="lazy" />
              <div className="matchMeta">
                <b>{m.game}</b>
                <small>{shortForGame(m.game)} · {m.format} {formatLabel(m.format)} · {m.mode} · {seriesLabel(m.series)} · {m.region}</small>
                <div className="matchBadges">
                  <span className="badge">{m.platform}</span>
                  {!isConsoleOnlyGame(m.game) && <span className="badge">PC: {pcPlayersFromPlatform(m.platform)}</span>}
                  {m.allowed_input && m.allowed_input !== "Controller + M&K" && <span className="badge accent">{m.allowed_input}</span>}
                  {m.skill_tier !== "Open" && <span className="badge accent">{m.skill_tier}</span>}
                  {m.weapon_restriction && <span className="badge warn">{m.weapon_restriction}</span>}
                </div>
                {m.map && <MapBadge map={m.map} game={m.game} />}
                <span className="matchTicket">#{m.match_number || m.code}</span>
                <MatchInfoTooltip match={m} />
              </div>
              <div className="matchStakeCol">
                <span className="matchStakeLbl">{m.kind === "cash" ? "ENTRY" : "MODE"}</span>
                <b className={m.kind === "cash" ? "cash" : "xp"}>{m.kind === "cash" ? money(m.entry) : "XP"}</b>
              </div>
              {isMine
                ? <Button variant="ghost" onClick={(e) => { e.stopPropagation(); onOpenMatch?.(m.id); }}>View</Button>
                : !mElig.eligible
                  ? <span className="matchGateHint" title={mElig.reason}><AlertTriangle size={14} /> {mElig.cta === "account" ? "Link acct" : "Need team"}</span>
                  : <Button variant="primary" loading={joiningId === m.id} onClick={(e) => { e.stopPropagation(); handleAccept(m); }}>{joiningId === m.id ? "Joining…" : "Accept"}</Button>
              }
            </div>
            );
          })}
        </div>
      )}

      {acceptMatch && (
        <AcceptMatchModal
          match={acceptMatch}
          teams={myTeams}
          onClose={() => setAcceptMatch(null)}
          onConfirm={(vetoBan, roster) => {
            const mid = acceptMatch.id;
            setAcceptMatch(null);
            doJoin(mid, vetoBan, roster);
          }}
        />
      )}

      <CreateMatchModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={(matchId) => { reload(); if (matchId) onOpenMatch?.(matchId); }} onNavigate={onNavigate} />
    </main>
  );
}

// ─── Info tooltip on match rows ───

function MatchInfoTooltip({ match }) {
  const [show, setShow] = useState(false);
  const wwii = isConsoleOnlyGame(match.game);
  return (
    <span className="matchInfoTip" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)} onBlur={() => setShow(false)} tabIndex={0} role="button"
      aria-label="Match details" onClick={(e) => { e.stopPropagation(); setShow(!show); }}>
      <Info size={14} />
      {show && (
        <div className="matchInfoPopover" role="tooltip">
          <div className="mipRow"><span>Game</span><b>{shortForGame(match.game)} · {match.mode}</b></div>
          <div className="mipRow"><span>Team Size</span><b>{match.format} {formatLabel(match.format)}</b></div>
          <div className="mipRow"><span>Series</span><b>{seriesLabel(match.series)}</b></div>
          <div className="mipRow"><span>Platform</span><b>{match.platform}</b></div>
          {!wwii && <div className="mipRow"><span>PC Players</span><b>{pcPlayersFromPlatform(match.platform)}</b></div>}
          {!wwii && <div className="mipRow"><span>Input</span><b>{match.allowed_input || "Controller + M&K"}</b></div>}
          <div className="mipRow"><span>Region</span><b>{match.region}</b></div>
          {match.skill_tier !== "Open" && <div className="mipRow"><span>Skill</span><b>{match.skill_tier}</b></div>}
          {match.weapon_restriction && <div className="mipRow"><span>Weapon</span><b>{match.weapon_restriction}</b></div>}
          {match.kind === "cash" && <div className="mipRow"><span>Entry</span><b className="cash">{money(match.entry)}</b></div>}
        </div>
      )}
    </span>
  );
}

// ─── Section 7: Accept confirmation modal (info bar + veto + roster) ───

function AcceptMatchModal({ match, teams, onClose, onConfirm }) {
  const { profile } = useAuth();
  const wwii = isConsoleOnlyGame(match.game);
  const teamSize = parseInt(match.format) || 1;
  const isSquad = teamSize >= 3;
  const pool = mapsForGameMode(match.game, match.mode);
  const creatorBan = match.veto?.creator_ban;
  const needsVeto = pool.length >= 3 && creatorBan;
  const available = needsVeto ? pool.filter((m) => m !== creatorBan) : [];

  const [banned, setBanned] = useState(null);
  const [roster, setRoster] = useState(profile ? [profile.id] : []);

  const eligibleTeam = getEligibleTeam(match.game, teams, {
    platform: wwii ? match.platform : undefined,
    type: match.kind || undefined
  });

  const squadMembers = useMemo(() => {
    if (!isSquad || !eligibleTeam) return [];
    return (eligibleTeam.team_members || []).map(m => ({
      id: m.user_id,
      name: m.profiles?.username || "?",
      avatar: m.profiles?.avatar_url,
      isMe: m.user_id === profile?.id
    }));
  }, [isSquad, eligibleTeam, profile?.id]);

  const rosterValid = !isSquad || roster.length === teamSize;
  const vetoValid = !needsVeto || banned;

  function toggleRoster(uid) {
    setRoster(prev => {
      if (prev.includes(uid)) return prev.filter(x => x !== uid);
      if (prev.length >= teamSize) return prev;
      return [...prev, uid];
    });
  }

  return (
    <Modal open onClose={onClose} eyebrow="ACCEPT MATCH" title="Confirm & join" size="sm">
      {/* Full info bar */}
      <div className="acceptInfoBar">
        <div className="mipRow"><span>Game</span><b>{shortForGame(match.game)} · {match.mode}</b></div>
        <div className="mipRow"><span>Team Size</span><b>{match.format} {formatLabel(match.format)}</b></div>
        <div className="mipRow"><span>Series</span><b>{seriesLabel(match.series)}</b></div>
        <div className="mipRow"><span>Platform</span><b>{match.platform}</b></div>
        {!wwii && <div className="mipRow"><span>PC Players</span><b>{pcPlayersFromPlatform(match.platform)}</b></div>}
        {!wwii && <div className="mipRow"><span>Input</span><b>{match.allowed_input || "Controller + M&K"}</b></div>}
        <div className="mipRow"><span>Region</span><b>{match.region}</b></div>
        {match.skill_tier !== "Open" && <div className="mipRow"><span>Skill</span><b>{match.skill_tier}</b></div>}
        {match.weapon_restriction && <div className="mipRow"><span>Weapon</span><b className="warn">{match.weapon_restriction}</b></div>}
        {match.kind === "cash" && <div className="mipRow"><span>Entry</span><b className="cash">{money(match.entry)}</b></div>}
      </div>
      <div className="ruleNote">{seriesRule(match.series)}</div>

      {/* Squad roster toggle */}
      {isSquad && eligibleTeam && squadMembers.length > 0 && (
        <div className="cmRosterSection">
          <label className="fieldLbl"><Users size={13} /> Your lineup — select {teamSize}</label>
          <p className="modalNote">Playing as <b>{eligibleTeam.name}</b></p>
          <div className="cmRosterGrid">
            {squadMembers.map(m => {
              const active = roster.includes(m.id);
              const full = roster.length >= teamSize && !active;
              return (
                <button key={m.id} className={`cmRosterPlayer ${active ? "active" : ""} ${full ? "disabled" : ""}`}
                  onClick={() => toggleRoster(m.id)} disabled={full && !active}>
                  <div className="cmRosterAvatar">
                    {m.avatar ? <img src={m.avatar} alt="" /> : <span>{m.name.slice(0, 2)}</span>}
                  </div>
                  <span className="cmRosterName">{m.name}{m.isMe ? " (you)" : ""}</span>
                  {active ? <ToggleRight size={18} className="cmRosterToggleOn" /> : <ToggleLeft size={18} className="cmRosterToggleOff" />}
                </button>
              );
            })}
          </div>
          <small className={rosterValid ? "subtle" : "subtle danger"}>
            {roster.length}/{teamSize} selected
          </small>
        </div>
      )}

      {/* Map veto (if needed) */}
      {needsVeto && (
        <>
          <label className="fieldLbl">Ban a map</label>
          <p className="modalNote">Your opponent banned a map. Pick one to ban — match plays on a random remaining map.</p>
          <div className="mapGrid" style={{ marginTop: 8 }}>
            {available.map((m) => (
              <MapCard key={m} map={m} game={match.game} size="sm" selected={banned === m} onClick={() => setBanned(banned === m ? null : m)} />
            ))}
          </div>
          {banned && <p className="modalNote" style={{ marginTop: 8 }}>Banning <b>{banned}</b> — {available.length - 1} map{available.length - 1 !== 1 ? "s" : ""} remain.</p>}
        </>
      )}

      {eligibleTeam && !isSquad && (
        <p className="modalNote">Playing as <b>{eligibleTeam.name}</b> [{eligibleTeam.tag}]</p>
      )}

      <Button variant="primary" className="wide" disabled={!vetoValid || !rosterValid}
        onClick={() => onConfirm(banned || null, isSquad ? roster.slice(0, teamSize) : null)}
        style={{ marginTop: 12 }}>
        <Crosshair size={14} /> {needsVeto ? `Ban ${banned || "..."} & ` : ""}Accept Match
      </Button>
    </Modal>
  );
}
