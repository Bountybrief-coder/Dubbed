import React, { useState, useMemo } from "react";
import { Crosshair, Users, ToggleLeft, ToggleRight } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { MapCard } from "./MapCard";
import { useAuth } from "../hooks/useAuth.jsx";
import {
  isConsoleOnlyGame, mapsForGameMode, getEligibleTeam,
  shortForGame, formatLabel, seriesLabel, seriesRule, pcPlayersFromPlatform,
} from "../utils/games";
import { money } from "../utils/format";

// Shared accept-confirmation modal (info bar + squad roster + map veto).
// Used by both Matchfinder and the per-game page so joining always goes
// through the same validated flow.
export function AcceptMatchModal({ match, teams, onClose, onConfirm }) {
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
          <label className="fieldLbl"><Users size={13} /> Your lineup: select {teamSize}</label>
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
          <p className="modalNote">Your opponent banned a map. Pick one to ban. Match plays on a random remaining map.</p>
          <div className="mapGrid" style={{ marginTop: 8 }}>
            {available.map((m) => (
              <MapCard key={m} map={m} game={match.game} size="sm" selected={banned === m} onClick={() => setBanned(banned === m ? null : m)} />
            ))}
          </div>
          {banned && <p className="modalNote" style={{ marginTop: 8 }}>Banning <b>{banned}</b>. {available.length - 1} map{available.length - 1 !== 1 ? "s" : ""} remain.</p>}
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
