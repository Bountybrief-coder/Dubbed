// Supported titles. BR titles (WZ, BOR) cap at 2v2; everything else is 1v1–4v4.
// Kill Race modes are always capped at 2v2 regardless of game.

export const GAMES = [
  // --- CURRENT TITLES ---
  {
    name: "Call of Duty: Black Ops 7",
    short: "BO7",
    slug: "bo7",
    category: "current",
    description: "The latest Black Ops. CDL-ready competitive multiplayer with ranked play, map veto, and weapon restrictions.",
    formats: ["1v1", "2v2", "3v3", "4v4"],
    modes: [
      "Search & Destroy", "Hardpoint", "Gunfight", "HP/Dom Kill Race",
      "Nuketown 24/7 Kill Race", "Nuketown Only SND", "CDL Maps SND",
      "Raid Only SND", "Standoff Only SND", "Fringe Only SND",
      "Sake 24/7", "Overload", "Variant"
    ]
  },
  {
    name: "Warzone",
    short: "WZ",
    slug: "warzone",
    category: "current",
    description: "Battle Royale and Resurgence. Kill races and survival brackets on the big map.",
    formats: ["1v1", "2v2"],
    modes: ["Resurgence Kill Race", "Resurgence Survival", "Battle Royale Big Map Kill Race", "Battle Royale Big Map Survival"]
  },
  {
    name: "Black Ops Royale",
    short: "BOR",
    slug: "bor",
    category: "current",
    description: "Classic Black Ops Battle Royale. Fast-paced kill races and last-team-standing survival.",
    formats: ["1v1", "2v2"],
    modes: ["Kill Race", "Survival"]
  },
  {
    name: "Call of Duty: Modern Warfare 4",
    short: "MW4",
    slug: "mw4",
    category: "current",
    description: "Modern Warfare returns with SND, Hardpoint, and competitive kill races.",
    formats: ["1v1", "2v2", "3v3", "4v4"],
    modes: ["Search & Destroy", "Hardpoint", "Kill Race", "Variant"]
  },
  {
    name: "Call of Duty: WWII",
    short: "WWII",
    slug: "wwii",
    category: "current",
    description: "Boots-on-the-ground classic. Search & Destroy and Hardpoint on CWL maps. PSN and Xbox only — no PC.",
    formats: ["1v1", "2v2", "3v3", "4v4"],
    platforms: ["PlayStation Only", "Xbox Only"],
    modes: ["Search & Destroy", "Hardpoint", "Variant"]
  },
];

export const GAME_NAMES = GAMES.map((g) => g.name);
export const CURRENT_GAMES = GAMES.filter((g) => g.category === "current");
export const THROWBACK_GAMES = GAMES.filter((g) => g.category === "throwback");
export const ALL_FORMATS = ["1v1", "2v2", "3v3", "4v4"];
export const REGIONS = ["NA", "EU", "NA + EU", "Latin America", "Worldwide"];

export const PLATFORMS = ["Console Only", "PC Only", "PC + Console Mixed"];
export const SKILL_TIERS = ["Open", "Rookie Only", "Elite+", "Legend+", "Master Only"];
export const SERIES_OPTIONS = ["Best of 1", "Best of 3", "1 and Done"];

export const WEAPON_RESTRICTIONS = ["None", "M15 / Dravec Only"];
export const WEAPON_RESTRICTION_RULE =
  "Only the M15 and Dravec may be used. If any player is caught using any other weapon, that team forfeits the round.";

// ---------------------------------------------------------------------------
// Format labels — friendly names for team sizes
// ---------------------------------------------------------------------------
export const FORMAT_LABELS = {
  "1v1": "Solo",
  "2v2": "Duos",
  "3v3": "Trios",
  "4v4": "Squads"
};

export const formatLabel = (fmt) => FORMAT_LABELS[fmt] || fmt;

// ---------------------------------------------------------------------------
// Mode-specific format caps — Kill Race modes are always 1v1/2v2 max
// ---------------------------------------------------------------------------
const KILL_RACE_MODES = [
  "Kill Race", "HP/Dom Kill Race", "Nuketown 24/7 Kill Race",
  "Resurgence Kill Race", "Battle Royale Big Map Kill Race"
];

export const isKillRaceMode = (mode) => KILL_RACE_MODES.includes(mode);

export const formatsForGame = (name) =>
  GAMES.find((g) => g.name === name)?.formats || ["1v1", "2v2"];

export const formatsForGameMode = (name, mode) => {
  if (isKillRaceMode(mode)) return ["1v1", "2v2"];
  return GAMES.find((g) => g.name === name)?.formats || ["1v1", "2v2"];
};

export const modesForGame = (name) =>
  GAMES.find((g) => g.name === name)?.modes || [];

export const shortForGame = (name) =>
  GAMES.find((g) => g.name === name)?.short || "";

export const slugForGame = (name) =>
  GAMES.find((g) => g.name === name)?.slug || "";

export const gameBySlug = (slug) =>
  GAMES.find((g) => g.slug === slug);

export const categoryForGame = (name) =>
  GAMES.find((g) => g.name === name)?.category || "current";

// Battle-royale titles (map-based veto does not apply — one drop, one result).
export const isBattleRoyaleGame = (name) => name === "Warzone" || name === "Black Ops Royale";

// Single-map modes auto-complete with the locked map — no veto needed.
const SINGLE_MAP_MODES = [
  "Nuketown 24/7 Kill Race", "Nuketown Only SND", "Raid Only SND",
  "Standoff Only SND", "Fringe Only SND", "Sake 24/7"
];
export const isSingleMapMode = (mode) => SINGLE_MAP_MODES.includes(mode);

// Veto only runs for multi-map CDL modes on non-BR games.
export const usesMapVeto = (name, mode) =>
  !isBattleRoyaleGame(name) && !isSingleMapMode(mode);

// ---------------------------------------------------------------------------
// Per-game, per-mode map pools
// ---------------------------------------------------------------------------
export const GAME_MAP_POOLS = {
  "Call of Duty: Black Ops 7": {
    "Search & Destroy":        ["Den", "Raid", "Standoff", "Gridlock", "Hacienda"],
    "Hardpoint":               ["Colossus", "Den", "Scar", "Sake", "Gridlock", "Hacienda"],
    "Overload":                ["Den", "Scar", "Gridlock"],
    "HP/Dom Kill Race":        ["Colossus", "Den", "Scar", "Sake", "Gridlock", "Hacienda"],
    "CDL Maps SND":            ["Den", "Raid", "Standoff", "Gridlock", "Hacienda"],
    "Gunfight":                ["Abyss", "Liminal", "Paranoia", "Blackheart", "Nexus"],
    "Nuketown 24/7 Kill Race": ["Nuketown"],
    "Nuketown Only SND":       ["Nuketown"],
    "Raid Only SND":           ["Raid"],
    "Standoff Only SND":       ["Standoff"],
    "Fringe Only SND":         ["Fringe"],
    "Sake 24/7":               ["Sake"],
    "Variant":                 ["Den", "Raid", "Standoff", "Gridlock", "Hacienda", "Scar", "Sake", "Colossus"]
  },
  "Call of Duty: Modern Warfare 4": {
    "Search & Destroy": ["Compound", "Terminal", "Borderline", "District", "Salvage", "Depot"],
    "Hardpoint":        ["Compound", "Terminal", "Borderline", "District", "Salvage", "Depot"],
    "Kill Race":        ["Terminal", "Compound", "Depot"],
    "Variant":          ["Compound", "Terminal", "Borderline", "District", "Salvage", "Depot"]
  },
  "Call of Duty: WWII": {
    "Search & Destroy": ["Ardennes Forest", "Flak Tower", "Gibraltar", "London Docks", "Sainte Marie du Mont", "USS Texas"],
    "Hardpoint":        ["Ardennes Forest", "Gibraltar", "London Docks", "Sainte Marie du Mont"],
    "Variant":          ["Ardennes Forest", "Flak Tower", "Gibraltar", "London Docks", "Sainte Marie du Mont", "USS Texas"]
  },
};

export const mapsForGameMode = (game, mode) => GAME_MAP_POOLS[game]?.[mode] || [];

// Backward compat — old code references MAP_POOL flat array.
export const MAP_POOL = ["Den", "Raid", "Scar", "Gridlock", "Hacienda", "Vault", "Skyline"];

export const mapsNeededForSeries = (series) => (series === "Best of 3" ? 3 : 1);

// ---------------------------------------------------------------------------
// Mode rules — shown in the create flow, match room, and rules page.
// ---------------------------------------------------------------------------
export const MODE_RULES = {
  "Search & Destroy":
    "CDL ruleset. Standard bomb timers, restricted equipment banned. First team to the required round wins the map.",
  "Hardpoint":
    "CDL Hardpoint rotation. First team to the score limit wins the map.",
  "Overload":
    "CDL Overload ruleset. Capture and hold the objective; first team to the score limit wins the map.",
  "Gunfight":
    "2v2 or 1v1 arena rounds. Preset loadouts, fast rounds, first to the win limit takes the map.",
  "HP/Dom Kill Race":
    "Hardpoint or Domination. Whoever has the most kills when the game ends wins. Only confirmed kills count.",
  "Nuketown 24/7 Kill Race":
    "Nuketown only. Most kills wins. Assists don't count.",
  "Nuketown Only SND":
    "CDL Search & Destroy rules, Nuketown map only.",
  "CDL Maps SND":
    "CDL Search & Destroy rules across the full CDL map rotation.",
  "Raid Only SND":
    "CDL Search & Destroy rules, Raid map only.",
  "Standoff Only SND":
    "CDL Search & Destroy rules, Standoff map only.",
  "Fringe Only SND":
    "CDL Search & Destroy rules, Fringe map only.",
  "Sake 24/7":
    "Sake map only. SND or Hardpoint (agreed in lobby). CDL rules apply.",
  "Variant":
    "Alternating modes per map. Best of 3: HP / SND / Overload. Best of 5: HP / SND / OVL / HP / SND.",
  "Resurgence Kill Race":
    "Resurgence rules, unlimited respawns while your squad is alive. Most confirmed kills when the match ends wins. Assists don't count.",
  "Resurgence Survival":
    "Resurgence rules. Last team standing when respawns run out wins the map.",
  "Battle Royale Big Map Kill Race":
    "Full Battle Royale, one life per circle. Most confirmed kills wins. Assists don't count.",
  "Battle Royale Big Map Survival":
    "Full Battle Royale, one life per circle. Last team alive wins.",
  "Kill Race":
    "Most actual kills wins the map. Kills only, assists do not count.",
  "Survival":
    "Last alive wins. Survive the longest without being fully dead."
};

export const modeRule = (mode) => MODE_RULES[mode] || "";

export const SERIES_RULES = {
  "Best of 1": "One map. Whoever wins it wins the match.",
  "Best of 3": "First team to win 2 maps takes the match.",
  "1 and Done": "Single map, sudden-death elimination — no rematch, no map 2."
};

export const seriesRule = (series) => SERIES_RULES[series] || "";

// ---------------------------------------------------------------------------
// Mode categories — used to organize modes on game pages
// ---------------------------------------------------------------------------
export const MODE_CATEGORIES = {
  "Search & Destroy": "snd",
  "CDL Maps SND": "snd",
  "Nuketown Only SND": "snd",
  "Raid Only SND": "snd",
  "Standoff Only SND": "snd",
  "Fringe Only SND": "snd",
  "Hardpoint": "respawn",
  "Overload": "respawn",
  "Gunfight": "respawn",
  "Sake 24/7": "respawn",
  "Variant": "variant",
  "Kill Race": "killrace",
  "HP/Dom Kill Race": "killrace",
  "Nuketown 24/7 Kill Race": "killrace",
  "Resurgence Kill Race": "killrace",
  "Battle Royale Big Map Kill Race": "killrace",
  "Resurgence Survival": "br",
  "Battle Royale Big Map Survival": "br",
  "Survival": "br"
};

export const CATEGORY_LABELS = {
  snd: "Search & Destroy",
  respawn: "Respawn",
  killrace: "Kill Race",
  variant: "Variant",
  br: "Battle Royale"
};

export const modeCategory = (mode) => MODE_CATEGORIES[mode] || "other";

export const modesForGameByCategory = (gameName) => {
  const modes = modesForGame(gameName);
  const grouped = {};
  for (const m of modes) {
    const cat = modeCategory(m);
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(m);
  }
  return grouped;
};

// ---------------------------------------------------------------------------
// Rake / monetization
// ---------------------------------------------------------------------------
export const RAKE_CONFIG = {
  standard: 0.05,
  wagr: 0.02,
  tournament: 0.02,
  sideBet: 0.05,
  minimum: 0.25,
};

export const calculateRake = (pot, isWagrMember = false) => {
  const rate = isWagrMember ? RAKE_CONFIG.wagr : RAKE_CONFIG.standard;
  const rake = Math.max(RAKE_CONFIG.minimum, Math.round(pot * rate * 100) / 100);
  return rake >= pot ? 0 : rake;
};

export const calculatePayout = (pot, isWagrMember = false) => {
  const rake = calculateRake(pot, isWagrMember);
  return Math.round((pot - rake) * 100) / 100;
};

// ---------------------------------------------------------------------------
// Region + host resolution
// ---------------------------------------------------------------------------
export function resolveHostRegion(region, { naCount = 0, euCount = 0, latamCount = 0, tieRule = "random" } = {}) {
  if (region === "NA") return { host: "NA", reason: "NA Only lobby, NA always hosts." };
  if (region === "EU") return { host: "EU", reason: "EU Only lobby, EU always hosts." };
  if (region === "Latin America") return { host: "Latin America", reason: "Latin America lobby, Latin America always hosts." };

  // For NA + EU, compare NA vs EU
  if (region === "NA + EU") {
    if (naCount > euCount) return { host: "NA", reason: `NA has more players in the lobby (${naCount} NA vs ${euCount} EU).` };
    if (euCount > naCount) return { host: "EU", reason: `EU has more players in the lobby (${euCount} EU vs ${naCount} NA).` };
    if (tieRule === "NA" || tieRule === "EU") {
      return { host: tieRule, reason: `Lobby is tied ${naCount}-${euCount}, tournament host rule assigns ${tieRule}.` };
    }
    const host = Math.random() < 0.5 ? "NA" : "EU";
    return { host, reason: `Lobby is tied ${naCount}-${euCount}, host randomly assigned.` };
  }

  // Worldwide — majority across all three regions
  if (region === "Worldwide") {
    const counts = { NA: naCount, EU: euCount, "Latin America": latamCount };
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (sorted[0][1] > sorted[1][1]) {
      return { host: sorted[0][0], reason: `${sorted[0][0]} has the most players (${sorted[0][1]}) in a Worldwide lobby.` };
    }
    // Tie — pick randomly among the tied leaders
    const max = sorted[0][1];
    const tied = sorted.filter(([, c]) => c === max).map(([r]) => r);
    const host = tied[Math.floor(Math.random() * tied.length)];
    return { host, reason: `Worldwide lobby is tied, host randomly assigned to ${host}.` };
  }

  // Fallback (shouldn't happen)
  return { host: "NA", reason: "Default host." };
}

export const ROOKIE_XP_CEILING = 25000;
export const isRookieEligible = (xp = 0) => xp < ROOKIE_XP_CEILING;

// ---------------------------------------------------------------------------
// Linked-account + team gate  (client-side convenience — server is authoritative)
// ---------------------------------------------------------------------------
const ACTIVISION_GAMES = new Set([
  "Call of Duty: Black Ops 7", "Warzone", "Black Ops Royale",
  "Call of Duty: Modern Warfare 4",
]);
const CONSOLE_ONLY_GAMES = new Set(["Call of Duty: WWII"]);
const ACTIVISION_RE = /^\S+#\d{4,10}$/;

export function requiredAccountForGame(game) {
  if (ACTIVISION_GAMES.has(game)) return "activision";
  if (CONSOLE_ONLY_GAMES.has(game)) return "console";
  return null;
}

export const isConsoleOnlyGame = (game) => CONSOLE_ONLY_GAMES.has(game);
export const WWII_PLATFORMS = ["PlayStation Only", "Xbox Only"];

export function checkGameEligibility(game, profile, teams, { platform, type } = {}) {
  if (!profile) return { eligible: false, reason: "Log in to play", cta: "login" };

  const teamList = teams || [];
  let hasTeam;
  if (isConsoleOnlyGame(game) && platform) {
    hasTeam = teamList.some((t) => t.game === game && t.platform === platform && (!type || t.type === type));
  } else {
    hasTeam = teamList.some((t) => t.game === game && (!type || t.type === type));
  }
  if (!hasTeam) return { eligible: false, reason: `Create a team for ${shortForGame(game) || game} first`, cta: "team", game };

  const req = requiredAccountForGame(game);
  if (req === "activision") {
    const id = (profile.activision_id || "").trim();
    if (!id || !ACTIVISION_RE.test(id))
      return { eligible: false, reason: "Link your Activision ID to play", cta: "account" };
  } else if (req === "console") {
    if (isConsoleOnlyGame(game) && platform) {
      if (platform === "PlayStation Only" && !(profile.psn || "").trim())
        return { eligible: false, reason: "Link your PSN account to play WWII on PlayStation", cta: "account" };
      if (platform === "Xbox Only" && !(profile.xbox || "").trim())
        return { eligible: false, reason: "Link your Xbox account to play WWII on Xbox", cta: "account" };
    } else {
      if (!(profile.psn || "").trim() && !(profile.xbox || "").trim())
        return { eligible: false, reason: "Link an Xbox or PSN account to play", cta: "account" };
    }
  }

  return { eligible: true, reason: null, cta: null };
}

export function getEligibleTeam(game, teams, { platform, type } = {}) {
  const list = teams || [];
  if (isConsoleOnlyGame(game) && platform) {
    return list.find((t) => t.game === game && t.platform === platform && (!type || t.type === type));
  }
  return list.find((t) => t.game === game && (!type || t.type === type));
}
