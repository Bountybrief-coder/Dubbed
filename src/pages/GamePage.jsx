import React, { useState } from "react";
import { Plus, Crosshair, Gamepad2, ChevronRight, Users } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useToast } from "../hooks/useToast.jsx";
import { useAsync } from "../hooks/useAsync";
import { useVisibilityRefresh } from "../hooks/useVisibilityRefresh";
import { listOpenMatches, joinMatch } from "../services/matchService";
import { CreateMatchModal } from "../components/CreateMatchModal";
import { Button } from "../components/Button";
import { SkeletonRows } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { money } from "../utils/format";
import {
  gameBySlug, shortForGame, formatLabel, formatsForGameMode,
  modesForGameByCategory, CATEGORY_LABELS, modeRule, isKillRaceMode,
  isBattleRoyaleGame, FORMAT_LABELS, seriesLabel
} from "../utils/games";
import bo7Cover from "../assets/black-ops-7.png";
import wzCover from "../assets/warzone.png";
import mw4Cover from "../assets/mw4.png";
import bo4Cover from "../assets/bo4.png";
import bo3Cover from "../assets/bo3.png";
import mwCover from "../assets/mw-2019.png";
import mw2Cover from "../assets/mw2.png";
import wawCover from "../assets/waw.png";

import bo1Cover from "../assets/bo1.png";
import bo2Cover from "../assets/bo2.png";
import wwiiCover from "../assets/wwii.png";

const COVERS = {
  bo7: bo7Cover, warzone: wzCover, bor: wzCover, mw4: mw4Cover,
  bo4: bo4Cover, bo3: bo3Cover, mw: mwCover, mw2: mw2Cover, waw: wawCover,
  bo1: bo1Cover, bo2: bo2Cover, wwii: wwiiCover
};

export function GamePage({ slug, onNavigate, onLogin, onOpenMatch }) {
  const game = gameBySlug(slug);
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState(null);
  const [activeCat, setActiveCat] = useState("all");

  const { data, loading, error, reload } = useAsync(
    () => game ? listOpenMatches({ game: game.name }) : Promise.resolve([]),
    [slug]
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

  async function accept(m) {
    if (!profile) return onLogin();
    const res = await joinMatch(m.id);
    if (res.error) return toast.error(res.error);
    toast.success("Joined. Match is live.");
    refreshProfile();
    reload();
    onOpenMatch?.(m.id);
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
            {matches.map((m) => (
              <div className="matchTile" key={m.id}>
                <img className="matchCover" src={COVERS[game.slug]} alt="" loading="lazy" />
                <div className="matchMeta">
                  <b>{m.mode}</b>
                  <small>{m.format} {formatLabel(m.format)} · {seriesLabel(m.series || "Best of 1")} · {m.region}</small>
                  <div className="matchBadges">
                    <span className="badge">{m.platform}</span>
                    {m.skill_tier !== "Open" && <span className="badge accent">{m.skill_tier}</span>}
                    {m.weapon_restriction && <span className="badge warn">{m.weapon_restriction}</span>}
                  </div>
                  <span className="matchTicket">{m.code}</span>
                </div>
                <div className="matchStakeCol">
                  <span className="matchStakeLbl">{m.kind === "cash" ? "ENTRY" : "MODE"}</span>
                  <b className={m.kind === "cash" ? "cash" : "xp"}>{m.kind === "cash" ? money(m.entry) : "XP"}</b>
                </div>
                <Button variant="primary" onClick={() => accept(m)}>Accept</Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <CreateMatchModal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setSelectedMode(null); }}
        onCreated={reload}
        defaultGame={game.name}
        defaultMode={selectedMode}
        onNavigate={onNavigate}
      />
    </main>
  );
}
