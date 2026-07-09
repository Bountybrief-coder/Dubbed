import React, { useState, useEffect } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { MapCard } from "./MapCard";
import { useToast } from "../hooks/useToast.jsx";
import { useAuth } from "../hooks/useAuth.jsx";
import { useAsync } from "../hooks/useAsync";
import { createMatch } from "../services/matchService";
import { getMyTeams } from "../services/teamService";
import {
  GAME_NAMES, CURRENT_GAMES, REGIONS, PLATFORMS, SKILL_TIERS,
  SERIES_OPTIONS, WEAPON_RESTRICTIONS, FORMAT_LABELS,
  formatsForGameMode, modesForGame, modeRule, seriesRule, shortForGame, formatLabel,
  usesMapVeto, isSingleMapMode, isBattleRoyaleGame, isKillRaceMode, isRookieEligible,
  calculateRake, calculatePayout, RAKE_CONFIG, mapsForGameMode, checkGameEligibility,
  isConsoleOnlyGame, WWII_PLATFORMS, getEligibleTeam
} from "../utils/games";
import { validateEntry } from "../utils/validation";
import { money } from "../utils/format";
import { Zap, DollarSign, Trophy, Swords, Shield, AlertTriangle } from "lucide-react";

export function CreateMatchModal({ open, onClose, defaultKind = null, defaultGame, defaultMode, onCreated, onNavigate }) {
  const toast = useToast();
  const { profile, refreshProfile } = useAuth();
  const { data: myTeams } = useAsync(
    () => profile ? getMyTeams(profile.id) : Promise.resolve({ data: [] }),
    [profile?.id]
  );
  const initGame = defaultGame || GAME_NAMES[0];
  const initMode = defaultMode || modesForGame(initGame)[0];

  const [kind, setKind] = useState(defaultKind);
  const [game, setGame] = useState(initGame);
  const [format, setFormat] = useState(formatsForGameMode(initGame, initMode)[0]);
  const [mode, setMode] = useState(initMode);
  const [region, setRegion] = useState(REGIONS[2]);
  const [platform, setPlatform] = useState(PLATFORMS[2]);
  const [skillTier, setSkillTier] = useState(SKILL_TIERS[0]);
  const [series, setSeries] = useState(SERIES_OPTIONS[0]);
  const [weapon, setWeapon] = useState(WEAPON_RESTRICTIONS[0]);
  const [entry, setEntry] = useState(5);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedMap, setSelectedMap] = useState("");
  const [bannedMap, setBannedMap] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      const g = defaultGame || GAME_NAMES[0];
      const m = defaultMode || modesForGame(g)[0];
      setGame(g);
      setMode(m);
      const f = formatsForGameMode(g, m);
      if (!f.includes(format)) setFormat(f[0]);
      if (defaultKind) setKind(defaultKind);
      else setKind(null);
    }
  }, [open, defaultGame, defaultMode]);

  const formats = formatsForGameMode(game, mode);
  const modes = modesForGame(game);
  const showVeto = usesMapVeto(game, mode);
  const singleMap = isSingleMapMode(mode);
  const availableMaps = mapsForGameMode(game, mode);
  const showWeaponToggle = game === "Call of Duty: Black Ops 7";
  const rookieBlocked = skillTier === "Rookie Only" && profile && !isRookieEligible(profile.xp);
  const isWagr = profile?.wagr_member;
  const wwii = isConsoleOnlyGame(game);
  const matchPlatform = wwii ? (WWII_PLATFORMS.includes(platform) ? platform : WWII_PLATFORMS[0]) : platform;
  const elig = checkGameEligibility(game, profile, myTeams, { platform: wwii ? matchPlatform : undefined, type: kind || undefined });
  const gateBlocked = !elig.eligible && elig.cta !== "login";
  const eligibleTeam = getEligibleTeam(game, myTeams, { platform: wwii ? matchPlatform : undefined, type: kind || undefined });

  const pot = kind === "cash" ? Number(entry) * (parseInt(format) || 1) * 2 : 0;
  const rake = pot > 0 ? calculateRake(pot, isWagr) : 0;
  const payout = pot > 0 ? calculatePayout(pot, isWagr) : 0;

  function pickGame(g) {
    setGame(g);
    const m = modesForGame(g);
    const newMode = m.includes(mode) ? mode : m[0];
    setMode(newMode);
    const f = formatsForGameMode(g, newMode);
    if (!f.includes(format)) setFormat(f[0]);
    if (isBattleRoyaleGame(g) || isSingleMapMode(newMode)) setSeries("Best of 1");
    if (g !== "Call of Duty: Black Ops 7") setWeapon(WEAPON_RESTRICTIONS[0]);
  }

  function pickMode(m) {
    setMode(m);
    const f = formatsForGameMode(game, m);
    if (!f.includes(format)) setFormat(f[0]);
    if (isBattleRoyaleGame(game) || isSingleMapMode(m)) setSeries("Best of 1");
  }

  async function submit() {
    if (kind === "cash") {
      const err = validateEntry(entry, { min: 1 });
      if (err) return toast.error(err);
      if (Number(entry) > (profile?.balance ?? 0)) return toast.error("Entry exceeds your balance.");
    }
    if (rookieBlocked) return toast.error("Your rank is above Rookie. Pick Open or Mixed Skill instead.");
    setBusy(true);
    const finalMap = singleMap ? availableMaps[0] : null;
    const res = await createMatch({
      game, mode, format, region, entry: kind === "cash" ? entry : 0, kind,
      platform: wwii ? matchPlatform : platform,
      skillTier, series: "Best of 1",
      weaponRestriction: showWeaponToggle && weapon !== "None" ? weapon : null,
      hostRule: "auto",
      teamId: eligibleTeam?.id || null,
      map: finalMap,
      vetoBan: bannedMap || null,
      mapPool: bannedMap ? availableMaps : null
    });
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success(`Match posted · ticket ${res.data?.code || ""}`);
    refreshProfile();
    onCreated?.(res.data?.id);
    onClose();
  }

  if (!kind) {
    return (
      <Modal open={open} onClose={onClose} eyebrow="NEW MATCH" title="What are you playing for?">
        <div className="cmKindPicker">
          <button className="cmKindCard xp" onClick={() => setKind("xp")}>
            <div className="cmKindIcon xp"><Zap size={28} /></div>
            <div className="cmKindInfo">
              <b>XP Match</b>
              <p>Play for experience points and rank up. No money on the line, just pure competition and bragging rights.</p>
            </div>
            <div className="cmKindPerks">
              <span><Zap size={12} /> Earn XP & rank up</span>
              <span><Trophy size={12} /> Leaderboard eligible</span>
              <span><Shield size={12} /> No entry fee</span>
            </div>
          </button>
          <button className="cmKindCard cash" onClick={() => setKind("cash")}>
            <div className="cmKindIcon cash"><DollarSign size={28} /></div>
            <div className="cmKindInfo">
              <b>Cash Match</b>
              <p>Put real money on the line. Entry fee from your wallet, winner takes the pot minus a small platform rake.</p>
            </div>
            <div className="cmKindPerks">
              <span><DollarSign size={12} /> Win real cash</span>
              <span><Swords size={12} /> Higher stakes</span>
              <span><Zap size={12} /> XP + cash rewards</span>
            </div>
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} eyebrow={kind === "cash" ? "CASH MATCH" : "XP MATCH"} title={kind === "cash" ? "Create a Cash Match" : "Create an XP Match"}>
      <button className="cmKindSwitch" onClick={() => setKind(null)}>
        {kind === "cash" ? <><DollarSign size={13} /> Cash Match</> : <><Zap size={13} /> XP Match</>}
        <span className="cmKindSwitchHint">change</span>
      </button>

      <label className="fieldLbl">Game</label>
      <div className="chipRow wrap">{CURRENT_GAMES.map((g) => (
        <button key={g.name} className={game === g.name ? "on" : ""} onClick={() => pickGame(g.name)}>{g.short}</button>
      ))}</div>

      {gateBlocked && (
        <div className="cmGate">
          <AlertTriangle size={14} />
          <span>{elig.reason}</span>
          {elig.cta === "account" && (
            <button className="btn btn-sm btn-primary" onClick={() => { onClose(); onNavigate?.("profile"); }}>Link Account</button>
          )}
          {elig.cta === "team" && (
            <button className="btn btn-sm btn-primary" onClick={() => { onClose(); onNavigate?.("teams"); }}>Create Team</button>
          )}
        </div>
      )}

      <label className="fieldLbl">Mode</label>
      <div className="chipRow wrap">{modes.map((m) => (
        <button key={m} className={mode === m ? "on" : ""} onClick={() => pickMode(m)}>{m}</button>
      ))}</div>
      <div className="ruleNote">{modeRule(mode)}</div>

      <label className="fieldLbl">Team Size</label>
      <div className="chipRow">{formats.map((f) => (
        <button key={f} className={format === f ? "on" : ""} onClick={() => setFormat(f)}>
          {f} <small style={{ opacity: 0.7, marginLeft: 4 }}>{formatLabel(f)}</small>
        </button>
      ))}</div>
      {(isKillRaceMode(mode) || isBattleRoyaleGame(game)) && (
        <small className="subtle">{isKillRaceMode(mode) ? "Kill Race" : game} is capped at Duos (2v2).</small>
      )}

      {wwii && (
        <>
          <label className="fieldLbl">WWII Platform</label>
          <div className="segRow">{WWII_PLATFORMS.map((p) => (
            <button key={p} className={matchPlatform === p ? "on" : ""} onClick={() => setPlatform(p)}>{p === "PlayStation Only" ? "PSN" : "Xbox"}</button>
          ))}</div>
        </>
      )}

      {eligibleTeam && (
        <p className="modalNote">Playing as <b>{eligibleTeam.name}</b> [{eligibleTeam.tag}]</p>
      )}

      {singleMap && <small className="subtle">Single-map mode. {availableMaps[0]} is locked in automatically.</small>}

      {!singleMap && availableMaps.length >= 3 && (
        <>
          <label className="fieldLbl">Ban a map <small className="lblHint">(your opponent bans one too, then a random map is picked)</small></label>
          <div className="mapGrid">
            {availableMaps.map((m) => (
              <MapCard key={m} map={m} game={game} size="sm" selected={bannedMap === m} onClick={() => setBannedMap(bannedMap === m ? "" : m)} banned={bannedMap === m} />
            ))}
          </div>
          {bannedMap ? <small className="subtle">Banning <b>{bannedMap}</b>. Your opponent will ban another, then a random map is chosen from the rest.</small>
            : <small className="subtle">Pick a map to ban. Your opponent bans one too. Match plays on a random remaining map.</small>}
        </>
      )}

      <label className="fieldLbl">Platform</label>
      <div className="chipRow wrap">{PLATFORMS.map((p) => (
        <button key={p} className={platform === p ? "on" : ""} onClick={() => setPlatform(p)}>{p}</button>
      ))}</div>

      <label className="fieldLbl">Skill tier</label>
      <div className="chipRow wrap">{SKILL_TIERS.filter((t) => t !== "Advanced/Elite").map((t) => (
        <button key={t} className={skillTier === t ? "on" : ""} onClick={() => setSkillTier(t)}>{t}</button>
      ))}</div>
      {skillTier === "Rookie Only" && (
        <small className={rookieBlocked ? "subtle danger" : "subtle"}>
          {rookieBlocked ? "Your rank is above Rookie. You can't post this lobby." : "Only Rookie-ranked players (under 25,000 XP) can join."}
        </small>
      )}

      {showWeaponToggle && (
        <>
          <label className="fieldLbl">Weapon restriction</label>
          <div className="chipRow wrap">{WEAPON_RESTRICTIONS.map((w) => (
            <button key={w} className={weapon === w ? "on" : ""} onClick={() => setWeapon(w)}>{w}</button>
          ))}</div>
          {weapon !== "None" && (
            <div className="ruleNote">Only M15 and Dravec may be used. Any other weapon = forfeit for that team's round.</div>
          )}
        </>
      )}

      <label className="fieldLbl">Region</label>
      <div className="chipRow wrap">{REGIONS.map((r) => (
        <button key={r} className={region === r ? "on" : ""} onClick={() => setRegion(r)}>{r}</button>
      ))}</div>
      {region === "NA + EU" && <small className="subtle">Host goes to whichever region has more players in the lobby. Tied lobbies get a random host.</small>}

      {kind === "cash" && (
        <>
          <label className="fieldLbl">Entry per player</label>
          <input className="field" type="number" min="1" value={entry} onChange={(e) => setEntry(e.target.value)} />
          <small className="subtle">Held from your balance ({money(profile?.balance)}) when the match settles.</small>

          <div className="breakBox" style={{ marginTop: 10 }}>
            <div><span>Pot ({format})</span><b>{money(pot)}</b></div>
            <div><span>Rake ({isWagr ? "WAGR " : ""}{(isWagr ? RAKE_CONFIG.wagr : RAKE_CONFIG.standard) * 100}%)</span><b className="neg">−{money(rake)}</b></div>
            <div className="total"><span>Winner payout</span><b className="cash">{money(payout)}</b></div>
          </div>
        </>
      )}

      {kind === "xp" && (
        <div className="cmXpInfo">
          <Zap size={16} />
          <div>
            <b>XP Match, no entry fee</b>
            <p>Winner earns XP toward their next rank. Loser still gets participation XP.</p>
          </div>
        </div>
      )}

      <Button variant="primary" className="wide" loading={busy} disabled={rookieBlocked || gateBlocked} onClick={submit}>
        {kind === "cash" ? <><DollarSign size={14} /> Post Cash Match</> : <><Zap size={14} /> Post XP Match</>}
      </Button>
    </Modal>
  );
}
