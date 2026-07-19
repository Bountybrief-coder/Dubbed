import React, { useState } from "react";
import { usePageMeta } from "../hooks/usePageMeta";
import { Plus, Crosshair, Gamepad2, ChevronRight, Users } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useToast } from "../hooks/useToast.jsx";
import { useAsync } from "../hooks/useAsync";
import { useVisibilityRefresh } from "../hooks/useVisibilityRefresh";
import { listOpenMatches, joinMatch } from "../services/matchService";
import { getMyTeams } from "../services/teamService";
import { CreateMatchModal } from "../components/CreateMatchModal";
import { AcceptMatchModal } from "../components/AcceptMatchModal";
import { Button } from "../components/Button";
import { SkeletonRows } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { AlertTriangle } from "lucide-react";
import { money } from "../utils/format";
import { track } from "../utils/analytics";
import {
  gameBySlug, shortForGame, formatLabel, formatsForGameMode,
  modesForGameByCategory, CATEGORY_LABELS, modeRule, isKillRaceMode,
  isBattleRoyaleGame, FORMAT_LABELS, seriesLabel, checkGameEligibility
} from "../utils/games";
import bo7Cover from "../assets/black-ops-7.png";
import wzCover from "../assets/warzone.png";
import mw4Cover from "../assets/mw4.png";
import bo1Cover from "../assets/bo1.png";
import bo2Cover from "../assets/bo2.png";
import wwiiCover from "../assets/wwii.png";

const COVERS = {
  bo7: bo7Cover, warzone: wzCover, bor: bo7Cover, mw4: mw4Cover,
  bo1: bo1Cover, bo2: bo2Cover, wwii: wwiiCover
};

export function GamePage({ slug, onNavigate, onLogin, onOpenMatch }) {
  const game = gameBySlug(slug);
  usePageMeta(game ? `${game.short} Matches` : "Game", game ? `Find ${game.name} cash matches and XP lobbies. Browse open games, check formats, and jump in.` : "Game page on Dubbed.");
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState(null);
  const [activeCat, setActiveCat] = useState("all");
  const [acceptMatch, setAcceptMatch] = useState(null);
  const [joiningId, setJoiningId] = useState(null);

  const { data, loading, error, reload } = useAsync(
    () => game ? listOpenMatches({ game: game.name }) : Promise.resolve([]),
    [slug]
  );
  const { data: myTeams } = useAsync(
    () => profile ? getMyTeams(profile.id) : Promise.resolve({ data: [] }),
    [profile?.id]
  );
  const matches = data || [];

  useVisibilityRefresh(reload, [slug]);

  if (!game) {
    return (
      <main className="page">
        <EmptyState icon={Gamepad2} title="Game not found">
          This game doesn't exist or isn't supported yet.
        </EmptyState>
      </main>
    );
  }

  const categories = modesForGameByCategory(game.name);
  const catKeys = Object.keys(categories);
  const filteredModes = activeCat === "all"
    ? game.modes
    : (categories[activeCat] || []);

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
        toast.error("Match already taken. Someone beat you to it.");
      } else if (msg.includes("insufficient balance")) {
        toast.error("Insufficient balance. Deposit to play.");
      } else {
        toast.error(res.error);
      }
      reload();
      return;
    }
    track.matchJoin(game.name, 0);
    toast.success("Joined! Match is live. GL.");
    refreshProfile();
    reload();
    onOpenMatch?.(matchId);
  }

  return (
    <main className="page gamePage">
      {/* ── GAME HEADER ── */}
      <div className="gameHero">
        <img className="gameHeroCover" src={COVERS[game.slug]} alt="" />
        <div className="gameHeroOverlay" />
        <div className="gameHeroContent">
          <div className="gameHeroTag">{game.category === "throwback" ? "THROWBACK TITLE" : "CURRENT TITLE"}</div>
          <h1>{game.name}</h1>
          <p>{game.description}</p>
          <div className="gameHeroMeta">
            <span><Gamepad2 size={14} /> {game.formats.map((f) => formatLabel(f)).join(" · ")}</span>
            <span><Crosshair size={14} /> {game.modes.length} modes</span>
            <span><Users size={14} /> {matches.length} open</span>
          </div>
          <div className="heroActions" style={{ marginTop: 16 }}>
            <Button variant="primary" onClick={() => profile ? setCreateOpen(true) : onLogin()}>
              <Plus size={16} /> Create match
            </Button>
          </div>
        </div>
      </div>

      {/* ── MODE CARDS ── */}
      <section style={{ marginTop: 24 }}>
        <div className="sectionHead">
          <div><div className="eyebrow">GAME MODES</div><h2>{game.modes.length === 1 ? game.modes[0] : "Choose how you play"}</h2></div>
        </div>

        {catKeys.length > 1 && game.modes.length > 1 && (
          <div className="modeCatTabs">
            <button className={activeCat === "all" ? "on" : ""} onClick={() => setActiveCat("all")}>All</button>
            {catKeys.map((cat) => (
              <button key={cat} className={activeCat === cat ? "on" : ""} onClick={() => setActiveCat(cat)}>
                {CATEGORY_LABELS[cat] || cat}
              </button>
            ))}
          </div>
        )}

        <div className="modeCardsGrid">
          {filteredModes.map((mode) => {
            const formats = formatsForGameMode(game.name, mode);
            const modeMatches = matches.filter((m) => m.mode === mode).length;
            return (
              <button
                className={`modeCard${selectedMode === mode ? " selected" : ""}`}
                key={mode}
                onClick={() => {
                  setSelectedMode(mode);
                  if (profile) setCreateOpen(true);
                  else onLogin();
                }}
              >
                <div className="modeCardTop">
                  <b>{mode}</b>
                  {modeMatches > 0 && <span className="modeCardLive">{modeMatches} open</span>}
                </div>
                <p className="modeCardRule">{modeRule(mode)}</p>
                <div className="modeCardFormats">
                  {formats.map((f) => (
                    <span key={f} className="modeFormat">{f} {formatLabel(f)}</span>
                  ))}
                </div>
                {(isKillRaceMode(mode) || isBattleRoyaleGame(game.name)) && (
                  <small className="modeCardCap">Capped at 2v2</small>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── OPEN MATCHES FOR THIS GAME ── */}
      <section style={{ marginTop: 28 }}>
        <div className="sectionHead">
          <div><div className="eyebrow">OPEN LOBBIES</div><h2>{game.short} Matchfinder</h2></div>
          <Button variant="ghost" onClick={() => onNavigate("matchfinder")}>All games <ChevronRight size={14} /></Button>
        </div>

        {loading ? (
          <SkeletonRows rows={4} />
        ) : error ? (
          <div className="errorState"><p>{error}</p><button className="btn btn-ghost sm" onClick={reload}>Retry</button></div>
        ) : matches.length === 0 ? (
          <EmptyState icon={() => <Crosshair size={26} />} title={`No open ${game.short} matches`} action={
            <Button variant="primary" onClick={() => profile ? setCreateOpen(true) : onLogin()}>Create the first one</Button>
          }>
            Be the first to post a {game.short} lobby.
          </EmptyState>
        ) : (
          <div className="matchList">
            {matches.map((m) => {
              const isMine = profile && m.created_by === profile.id;
              const mElig = profile ? checkGameEligibility(m.game, profile, myTeams) : { eligible: true };
              return (
              <div className="matchTile" key={m.id} role="button" tabIndex={0}
                onClick={() => isMine ? onOpenMatch?.(m.id) : mElig.eligible ? handleAccept(m) : toast.error(mElig.reason)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); isMine ? onOpenMatch?.(m.id) : mElig.eligible ? handleAccept(m) : toast.error(mElig.reason); } }}
                style={{ cursor: "pointer" }}>
                <img className="matchCover" src={COVERS[game.slug]} alt="" loading="lazy" />
                <div className="matchMeta">
                  <b>{m.mode}</b>
                  <small>{m.format} {formatLabel(m.format)} · {seriesLabel(m.series || "Best of 1")} · {m.region}</small>
                  <div className="matchBadges">
                    <span className="badge">{m.platform}</span>
                    {m.skill_tier !== "Open" && <span className="badge accent">{m.skill_tier}</span>}
                    {m.weapon_restriction && <span className="badge warn">{m.weapon_restriction}</span>}
                  </div>
                  <span className="matchTicket">#{m.match_number || m.code}</span>
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
      </section>

      <CreateMatchModal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setSelectedMode(null); }}
        onCreated={(matchId) => { reload(); if (matchId) onOpenMatch?.(matchId); }}
        defaultGame={game.name}
        defaultMode={selectedMode}
        onNavigate={onNavigate}
      />

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
    </main>
  );
}
