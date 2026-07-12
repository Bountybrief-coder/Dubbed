import React, { useState, useEffect, useMemo } from "react";
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
  isConsoleOnlyGame, WWII_PLATFORMS, platformsForGame, getEligibleTeam,
  seriesLabel, INPUT_OPTIONS, pcPlayersFromPlatform
} from "../utils/games";
import { validateEntry } from "../utils/validation";
import { money } from "../utils/format";
import { track } from "../utils/analytics";
import { Zap, DollarSign, Trophy, Swords, Shield, AlertTriangle, Info, Users, ToggleLeft, ToggleRight } from "lucide-react";

// Section 3: grouped team-size categories
const SIZE_CATEGORIES = [
  { key: "solo", label: "Solo", formats: ["1v1"] },
  { key: "duo",  label: "Duo",  formats: ["2v2"] },
  { key: "squads", label: "Squads", formats: ["3v3", "4v4"] },
];

function sizeCategory(fmt) {
  for (const c of SIZE_CATEGORIES) if (c.formats.includes(fmt)) return c.key;
  return "solo";
}

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
  const [bannedMap, setBannedMap] = useState("");
  const [allowedInput, setAllowedInput] = useState(INPUT_OPTIONS[0]);
  const [roster, setRoster] = useState([]);
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
      setRoster([]);
    }
  }, [open, defaultGame, defaultMode]);

  const formats = formatsForGameMode(game, mode);
  const modes = modesForGame(game);
  const singleMap = isSingleMapMode(mode);
  const availableMaps = mapsForGameMode(game, mode);
  const showWeaponToggle = game === "Call of Duty: Black Ops 7";
  const rookieBlocked = skillTier === "Rookie Only" && profile && !isRookieEligible(profile.xp);
  const isWagr = profile?.wagr_member;
  const wwii = isConsoleOnlyGame(game);
  const gamePlatforms = platformsForGame(game) || WWII_PLATFORMS;
  const matchPlatform = wwii ? (gamePlatforms.includes(platform) ? platform : gamePlatforms[0]) : platform;
  const elig = checkGameEligibility(game, profile, myTeams, { platform: wwii ? matchPlatform : undefined, type: kind || undefined });
  const gateBlocked = !elig.eligible && elig.cta !== "login";
  const eligibleTeam = getEligibleTeam(game, myTeams, { platform: wwii ? matchPlatform : undefined, type: kind || undefined });

  const teamSize = parseInt(format) || 1;
  const isSquad = teamSize >= 3;
  const pot = kind === "cash" ? Number(entry) * teamSize * 2 : 0;
  const rake = pot > 0 ? calculateRake(pot, isWagr) : 0;
  const payout = pot > 0 ? calculatePayout(pot, isWagr) : 0;

  // Section 4: squad members available for roster toggle
  const squadMembers = useMemo(() => {
    if (!isSquad || !eligibleTeam) return [];
    const members = eligibleTeam.team_members || [];
    return members.map(m => ({
      id: m.user_id,
      name: m.profiles?.username || "?",
      avatar: m.profiles?.avatar_url,
      role: m.role,
      isMe: m.user_id === profile?.id
    }));
  }, [isSquad, eligibleTeam, profile?.id]);

  // Auto-add self to roster when switching to squads
  useEffect(() => {
    if (isSquad && profile?.id && roster.length === 0) {
      setRoster([profile.id]);
    }
    if (!isSquad) setRoster([]);
  }, [isSquad, profile?.id]);

  const rosterValid = !isSquad || roster.length === teamSize;

  // Section 3: available size categories based on game/mode
  const availableCategories = useMemo(() => {
    const brOrKr = isBattleRoyaleGame(game) || isKillRaceMode(mode);
    return SIZE_CATEGORIES.filter(c => {
      if (brOrKr && c.key === "squads") return false;
      return c.formats.some(f => formats.includes(f));
    });
  }, [game, mode, formats]);

  const activeCat = sizeCategory(format);

  function pickCategory(cat) {
    const c = SIZE_CATEGORIES.find(x => x.key === cat);
    if (!c) return;
    const available = c.formats.filter(f => formats.includes(f));
    if (available.length > 0 && !available.includes(format)) {
      setFormat(available[available.length - 1]);
    }
  }

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

  function toggleRoster(uid) {
    setRoster(prev => {
      if (prev.includes(uid)) return prev.filter(x => x !== uid);
      if (prev.length >= teamSize + 2) return prev;
      return [...prev, uid];
    });
  }

  async function submit() {
    if (kind === "cash") {
      const err = validateEntry(entry, { min: 1 });
      if (err) return toast.error(err);
      if (Number(entry) > (profile?.balance ?? 0)) return toast.error("Entry exceeds your balance.");
    }
    if (rookieBlocked) return toast.error("Your rank is above Rookie. Pick Open or Mixed Skill instead.");
    if (isSquad && !rosterValid) return toast.error(`Select exactly ${teamSize} players for your lineup.`);
    setBusy(true);
    const finalMap = singleMap ? availableMaps[0] : null;
    const res = await createMatch({
      game, mode, format, region, entry: kind === "cash" ? entry : 0, kind,
      platform: wwii ? matchPlatform : platform,
      skillTier, series,
      weaponRestriction: showWeaponToggle && weapon !== "None" ? weapon : null,
      hostRule: "auto",
      teamId: eligibleTeam?.id || null,
      map: finalMap,
      vetoBan: bannedMap || null,
      mapPool: bannedMap ? availableMaps : null,
      allowedInput,
      roster: isSquad ? roster.slice(0, teamSize) : null
    });
    setBusy(false);
    if (res.error) return toast.error(res.error);
    track.matchCreate(game, kind === "cash" ? Number(entry) : 0);
    toast.success(`Match posted · ticket ${res.data?.code || ""}`);
    refreshProfile();
    onCreated?.(res.data?.id);
    onClose();
  }

  // ── Kind picker (step 0) ──
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

  // ── Section 7: reordered single-column flow ──
  return (
    <Modal open={open} onClose={onClose} eyebrow={kind === "cash" ? "CASH MATCH" : "XP MATCH"} title={kind === "cash" ? "Create a Cash Match" : "Create an XP Match"}>
      <button className="cmKindSwitch" onClick={() => setKind(null)}>
        {kind === "cash" ? <><DollarSign size={13} /> Cash Match</> : <><Zap size={13} /> XP Match</>}
        <span className="cmKindSwitchHint">change</span>
      </button>

      {/* ① Team Size — Solo / Duo / Squads */}
      <label className="fieldLbl">Team Size</label>
      <div className="cmSizePicker">
        {availableCategories.map((c) => (
          <button key={c.key} className={`cmSizeBtn ${activeCat === c.key ? "on" : ""}`} onClick={() => pickCategory(c.key)}>
            {c.key === "squads" ? <Users size={14} /> : null}
            {c.label}
          </button>
        ))}
      </div>
      {activeCat === "squads" && (
        <div className="cmSquadSub">
          {SIZE_CATEGORIES.find(c => c.key === "squads").formats.filter(f => formats.includes(f)).map(f => (
            <button key={f} className={format === f ? "on" : ""} onClick={() => setFormat(f)}>
              {f} <small>{formatLabel(f)}</small>
            </button>
          ))}
        </div>
      )}
      {(isKillRaceMode(mode) || isBattleRoyaleGame(game)) && (
        <small className="subtle">{isKillRaceMode(mode) ? "Kill Race" : game} is capped at Duos.</small>
      )}

      {/* ② Game */}
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

      {/* ③ Mode */}
      <label className="fieldLbl">Mode</label>
      <div className="chipRow wrap">{modes.map((m) => (
        <button key={m} className={mode === m ? "on" : ""} onClick={() => pickMode(m)}>{m}</button>
      ))}</div>
      <div className="ruleNote">{modeRule(mode)}</div>

      {/* ④ Series (1nD / Bo3) */}
      <label className="fieldLbl">Series</label>
      <div className="chipRow">{SERIES_OPTIONS.map((s) => (
        <button key={s} className={series === s ? "on" : ""} onClick={() => { if (!isBattleRoyaleGame(game) && !isSingleMapMode(mode)) setSeries(s); }}
          disabled={isBattleRoyaleGame(game) || isSingleMapMode(mode)}
        >
          {seriesLabel(s)} <small style={{ opacity: 0.7, marginLeft: 4 }}>{s === "Best of 1" ? "One map" : "First to 2"}</small>
        </button>
      ))}</div>
      <div className="ruleNote">{seriesRule(series)}</div>

      {/* ⑤ Region */}
      <label className="fieldLbl">Region</label>
      <div className="chipRow wrap">{REGIONS.map((r) => (
        <button key={r} className={region === r ? "on" : ""} onClick={() => setRegion(r)}>{r}</button>
      ))}</div>
      {region === "NA + EU" && <small className="subtle">Host goes to whichever region has more players in the lobby. Tied lobbies get a random host.</small>}

      {/* ⑥ Platform + PC_Players + Input */}
      {wwii ? (
        gamePlatforms.length === 1 ? (
          <>
            <label className="fieldLbl">Platform</label>
            <div className="segRow"><button className="on">{gamePlatforms[0] === "PlayStation Only" ? "PlayStation (PS5)" : gamePlatforms[0]}</button></div>
          </>
        ) : (
          <>
            <label className="fieldLbl">Platform</label>
            <div className="segRow">{gamePlatforms.map((p) => (
              <button key={p} className={matchPlatform === p ? "on" : ""} onClick={() => setPlatform(p)}>{p === "PlayStation Only" ? "PSN" : "Xbox"}</button>
            ))}</div>
          </>
        )
      ) : (
        <>
          <label className="fieldLbl">Platform</label>
          <div className="chipRow wrap">{PLATFORMS.map((p) => (
            <button key={p} className={platform === p ? "on" : ""} onClick={() => setPlatform(p)}>{p}</button>
          ))}</div>
          <label className="fieldLbl">Allowed Input</label>
          <div className="chipRow">{INPUT_OPTIONS.map((inp) => (
            <button key={inp} className={allowedInput === inp ? "on" : ""} onClick={() => setAllowedInput(inp)}>{inp}</button>
          ))}</div>
        </>
      )}

      {/* ⑦ Map veto */}
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

      {/* Skill tier */}
      <label className="fieldLbl">Skill tier</label>
      <div className="chipRow wrap">{SKILL_TIERS.filter((t) => t !== "Advanced/Elite").map((t) => (
        <button key={t} className={skillTier === t ? "on" : ""} onClick={() => setSkillTier(t)}>{t}</button>
      ))}</div>
      {skillTier === "Rookie Only" && (
        <small className={rookieBlocked ? "subtle danger" : "subtle"}>
          {rookieBlocked ? "Your rank is above Rookie. You can't post this lobby." : "Only Rookie-ranked players (under 25,000 XP) can join."}
        </small>
      )}

      {/* Weapon restriction (BO7 only) */}
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

      {/* Team info */}
      {eligibleTeam && !isSquad && (
        <p className="modalNote">Playing as <b>{eligibleTeam.name}</b> [{eligibleTeam.tag}]</p>
      )}

      {/* Section 4: Squad roster toggle */}
      {isSquad && eligibleTeam && (
        <div className="cmRosterSection">
          <label className="fieldLbl"><Users size={13} /> Lineup — select {teamSize} players</label>
          <p className="modalNote">Playing as <b>{eligibleTeam.name}</b> [{eligibleTeam.tag}]. Toggle who plays this match.</p>
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
            {roster.length}/{teamSize} selected{!rosterValid ? ` — need exactly ${teamSize}` : ""}
          </small>
        </div>
      )}

      {/* ⑧ Entry */}
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

      {/* Info bar preview */}
      <div className="cmInfoBarPreview">
        <div className="cmInfoBarLabel"><Info size={13} /> Opponents will see</div>
        <div className="cmInfoBarItems">
          <span>{shortForGame(game)} · {mode}</span>
          <span>{format} {formatLabel(format)}</span>
          <span>{seriesLabel(series)}</span>
          <span>{wwii ? matchPlatform : platform}</span>
          {!wwii && <span>PC: {pcPlayersFromPlatform(platform)}</span>}
          {!wwii && <span>Input: {allowedInput}</span>}
          <span>{region}</span>
          {skillTier !== "Open" && <span>{skillTier}</span>}
          {showWeaponToggle && weapon !== "None" && <span>{weapon}</span>}
          {kind === "cash" && <span>Entry: {money(entry)}</span>}
        </div>
      </div>

      <Button variant="primary" className="wide" loading={busy} disabled={rookieBlocked || gateBlocked || (isSquad && !rosterValid)} onClick={submit}>
        {kind === "cash" ? <><DollarSign size={14} /> Post Cash Match</> : <><Zap size={14} /> Post XP Match</>}
      </Button>
    </Modal>
  );
}
