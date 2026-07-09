import React, { useState } from "react";
import { Plus, Crosshair } from "lucide-react";
import { WagerIcon } from "../components/WagerIcon";
import { useAuth } from "../hooks/useAuth.jsx";
import { useToast } from "../hooks/useToast.jsx";
import { useAsync } from "../hooks/useAsync";
import { listOpenMatches, joinMatch } from "../services/matchService";
import { CreateMatchModal } from "../components/CreateMatchModal";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { SkeletonRows } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { money } from "../utils/format";
import { shortForGame, formatLabel, mapsForGameMode } from "../utils/games";
import { MapBadge, MapCard } from "../components/MapCard";
import bo7 from "../assets/black-ops-7.png";
import wz from "../assets/warzone.png";
import mw4Img from "../assets/mw4.png";

const GAME_COVERS = {
  "Call of Duty: Black Ops 7": bo7, "Warzone": wz, "Black Ops Royale": wz,
  "Call of Duty: Modern Warfare 4": mw4Img,
};
const cover = (game) => GAME_COVERS[game] || bo7;

export function MatchfinderPage({ onLogin, onOpenMatch }) {
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [kind, setKind] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [vetoMatch, setVetoMatch] = useState(null);
  const { data, loading, reload } = useAsync(
    () => listOpenMatches(kind === "all" ? {} : { kind }),
    [kind]
  );

  function handleAccept(m) {
    if (!profile) return onLogin();
    const pool = mapsForGameMode(m.game, m.mode);
    const creatorBan = m.veto?.creator_ban;
    if (pool.length >= 3 && creatorBan) {
      setVetoMatch(m);
    } else {
      doJoin(m.id);
    }
  }

  async function doJoin(matchId, vetoBan) {
    const res = await joinMatch(matchId, vetoBan);
    if (res.error) return toast.error(res.error);
    toast.success("Joined. Match is live.");
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
            return (
            <div className="matchTile" key={m.id} onClick={() => onOpenMatch?.(m.id)} style={{ cursor: "pointer" }}>
              <img className="matchCover" src={cover(m.game)} alt="" />
              <div className="matchMeta">
                <b>{m.game}</b>
                <small>{shortForGame(m.game)} · {m.format} {formatLabel(m.format)} · {m.mode} · {m.region}</small>
                <div className="matchBadges">
                  <span className="badge">{m.platform}</span>
                  {m.skill_tier !== "Open" && <span className="badge accent">{m.skill_tier}</span>}
                  {m.weapon_restriction && <span className="badge warn">{m.weapon_restriction}</span>}
                </div>
                {m.map && <MapBadge map={m.map} game={m.game} />}
                <span className="matchTicket">#{m.match_number || m.code}</span>
              </div>
              <div className="matchStakeCol">
                <span className="matchStakeLbl">{m.kind === "cash" ? "ENTRY" : "MODE"}</span>
                <b className={m.kind === "cash" ? "cash" : "xp"}>{m.kind === "cash" ? money(m.entry) : "XP"}</b>
              </div>
              {isMine
                ? <Button variant="ghost" onClick={(e) => { e.stopPropagation(); onOpenMatch?.(m.id); }}>View</Button>
                : <Button variant="primary" onClick={(e) => { e.stopPropagation(); handleAccept(m); }}>Accept</Button>
              }
            </div>
            );
          })}
        </div>
      )}

      {vetoMatch && (
        <PreAcceptVetoModal
          match={vetoMatch}
          onClose={() => setVetoMatch(null)}
          onConfirm={(ban) => { setVetoMatch(null); doJoin(vetoMatch.id, ban); }}
        />
      )}

      <CreateMatchModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={(matchId) => { reload(); if (matchId) onOpenMatch?.(matchId); }} />
    </main>
  );
}

function PreAcceptVetoModal({ match, onClose, onConfirm }) {
  const [banned, setBanned] = useState(null);
  const pool = mapsForGameMode(match.game, match.mode);
  const creatorBan = match.veto?.creator_ban;
  const available = pool.filter((m) => m !== creatorBan);

  return (
    <Modal open onClose={onClose} eyebrow="MAP VETO" title="Ban a map" size="sm">
      <p className="modalNote">The opponent already banned a map. Pick one to ban — the match will play on a random map from what's left.</p>
      <div className="mapGrid" style={{ marginTop: 8 }}>
        {available.map((m) => (
          <MapCard key={m} map={m} game={match.game} size="sm" selected={banned === m} onClick={() => setBanned(banned === m ? null : m)} />
        ))}
      </div>
      {banned && <p className="modalNote" style={{ marginTop: 8 }}>Banning <b>{banned}</b> — {available.length - 1} map{available.length - 1 !== 1 ? "s" : ""} remain.</p>}
      <Button variant="primary" className="wide" disabled={!banned} onClick={() => onConfirm(banned)} style={{ marginTop: 12 }}>
        <Crosshair size={14} /> Ban {banned || "..."} & Accept Match
      </Button>
    </Modal>
  );
}
