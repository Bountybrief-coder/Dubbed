// Supported titles. BR titles (WZ, BOR) cap at 2v2; everything else is 1v1–4v4.
// Kill Race modes are always capped at 2v2 regardless of game.

export function teamCategoryLabel(size) {
  if (size === 1) return "Solos";
  if (size === 2) return "Dubs";
  if (size === 4) return "Squads";
  return `${size}v${size}`;
}

export function formatForSize(size) {
  return `${size || 1}v${size || 1}`;
}

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
    modes: ["Search & Destroy", "Hardpoint"]
  },

  // --- THROWBACK TITLES (PS5 only) ---
  {
    name: "Call of Duty: Black Ops",
    short: "BO1",
    slug: "bo1",
    category: "throwback",
    description: "The original Black Ops. Competitive Search & Destroy and Hardpoint on PS5 with restricted loadouts.",
    formats: ["1v1", "2v2", "3v3", "4v4"],
    platforms: ["PlayStation Only"],
    modes: ["Search & Destroy", "Hardpoint", "Domination", "Capture the Flag"]
  },
  {
    name: "Call of Duty: Black Ops II",
    short: "BO2",
    slug: "bo2",
    category: "throwback",
    description: "Black Ops 2 throwback. Competitive Search & Destroy, Hardpoint, Domination, and CTF on PS5 with strict loadout restrictions.",
    formats: ["1v1", "2v2", "3v3", "4v4"],
    platforms: ["PlayStation Only"],
    modes: ["Search & Destroy", "Hardpoint", "Domination", "Capture the Flag"]
  },
];

export const GAME_NAMES = GAMES.map((g) => g.name);
export const CURRENT_GAMES = GAMES.filter((g) => g.category === "current");
export const THROWBACK_GAMES = GAMES.filter((g) => g.category === "throwback");
export const ALL_FORMATS = ["1v1", "2v2", "3v3", "4v4"];
export const REGIONS = ["NA", "EU", "NA + EU", "Latin America", "Worldwide"];

export const PLATFORMS = ["Console Only", "PC Only", "PC + Console Mixed"];
export const SKILL_TIERS = ["Open", "Rookie Only", "Elite+", "Legend+", "Master Only"];
export const SERIES_OPTIONS = ["Best of 1", "Best of 3"];

export const SERIES_LABELS = { "Best of 1": "1nD", "Best of 3": "Bo3", "1 and Done": "1nD" };
export const seriesLabel = (s) => SERIES_LABELS[s] || s;
export const SERIES_HELPTEXT = { "Best of 1": "One map, winner takes it", "Best of 3": "First to 2 maps" };

export const INPUT_OPTIONS = ["Controller + M&K", "Controller Only"];
export const pcPlayersFromPlatform = (p) => p === "Console Only" ? "Not Allowed" : "Allowed";

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
  "Call of Duty: Black Ops": {
    "Search & Destroy": ["Hanoi", "Firing Range", "Grid", "Havana", "Villa"],
    "Hardpoint":        ["Firing Range", "Grid", "Havana", "Villa", "Summit"],
    "Domination":       ["Firing Range", "Grid", "Havana", "Villa", "Summit", "Nuketown"],
    "Capture the Flag": ["Firing Range", "Grid", "Havana", "Villa", "Summit"]
  },
  "Call of Duty: Black Ops II": {
    "Search & Destroy": ["Cargo", "Express", "Raid", "Slums", "Standoff"],
    "Hardpoint":        ["Raid", "Slums", "Standoff", "Yemen", "Meltdown"],
    "Domination":       ["Raid", "Slums", "Standoff", "Yemen", "Meltdown", "Nuketown 2025"],
    "Capture the Flag": ["Raid", "Slums", "Standoff", "Yemen", "Meltdown"]
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
  "Domination":
    "Capture and hold flags to earn points. First team to the score limit or highest score when time expires wins.",
  "Capture the Flag":
    "Grab the enemy flag and return it to your base to score. Most captures when time runs out wins.",
  "Kill Race":
    "Most actual kills wins the map. Kills only, assists do not count.",
  "Survival":
    "Last alive wins. Survive the longest without being fully dead."
};

export const modeRule = (mode) => MODE_RULES[mode] || "";

export const SERIES_RULES = {
  "Best of 1": "One map, whoever wins it wins the match. No rematch.",
  "Best of 3": "First team to win 2 maps takes the match.",
  "1 and Done": "One map, whoever wins it wins the match. No rematch."
};

export const seriesRule = (series) => SERIES_RULES[series] || "";

// ---------------------------------------------------------------------------
// Match setup settings per game per mode. Shown in match room "Match Setup".
// ---------------------------------------------------------------------------
export const MATCH_SETUP = {
  "Call of Duty: Black Ops 7": {
    "Search & Destroy": {
      gameMode: "CDL Search and Destroy",
      note: "Unlock the rules and apply the changes below. Rehost/reset rules after each map.",
      settings: [
        { s: "Killcams", v: "On" },
        { s: "Team Assignment", v: "On" },
        { s: "Scorestreaks", v: "Off", ban: true },
        { s: "Equipment Delay", v: "5 Seconds" },
        { s: "Automatic Doors", v: "On" },
      ],
      weapons: {
        allowed: ["M15", "Dravec 45", "MPC-25"],
        secondary: ["Jager 45"],
        bannedAttachments: "Iron sights on ARs, magnification optics, launcher underbarrels, lasers, silencers, headshot barrels, prestige attachments, Rapid Fire, FMJ, Akimbo",
      },
      equipment: {
        lethals: ["Frag", "Semtex"],
        tacticals: ["Stun Grenade"],
        fieldUpgrades: ["Trophy System"],
        wildcard: "Perk Greed",
      },
      perks: [
        { slot: "Perk 1", allowed: "Lightweight, Ninja, Flak Jacket" },
        { slot: "Perk 2", allowed: "Tech Mask, Fast Hands" },
        { slot: "Perk 3", allowed: "Dexterity" },
      ],
      extra: "Flak Jacket and Tech Mask cannot be equipped together. Scorestreaks, Specialty Perks (Core), Blackcell Operators, Reaper EWR-3, T.E.D.D all banned.",
    },
    "Hardpoint": {
      gameMode: "CDL Hardpoint",
      note: "Unlock rules and adjust. Same weapon/perk restrictions as SND.",
      settings: [
        { s: "Allow Callout Pings", v: "Off", ban: true },
        { s: "Killcams", v: "On" },
        { s: "Respawn Delay", v: "3 Seconds" },
        { s: "Team Assignment", v: "On" },
        { s: "Scorestreaks", v: "Off", ban: true },
        { s: "Automatic Doors", v: "Off", ban: true },
      ],
      weapons: "Same as Search & Destroy",
      equipment: "Same as Search & Destroy",
      perks: "Same as Search & Destroy",
    },
    "Overload": {
      gameMode: "Default Overload",
      note: "Use the DEFAULT Overload mode with these changes.",
      settings: [
        { s: "Input Swap Allowed", v: "Off", ban: true },
        { s: "Allow Callout Pings", v: "Off", ban: true },
        { s: "Carrier Personal Radar", v: "Off", ban: true },
        { s: "Sudden Death H.A.R.P", v: "Off", ban: true },
        { s: "Weapon Mounting", v: "Off", ban: true },
        { s: "Respawn Delay", v: "3.5 Seconds" },
        { s: "Suicide Respawn Delay", v: "1 Second" },
        { s: "Team Assignment", v: "On" },
        { s: "Friendly Fire", v: "On" },
        { s: "Scorestreaks", v: "Off", ban: true },
        { s: "Automatic Doors", v: "Off", ban: true },
        { s: "Scorestreak Delay", v: "10 Seconds" },
        { s: "Equipment Protection", v: "0 Seconds" },
        { s: "Battle Chatter", v: "Off", ban: true },
        { s: "Dynamic Map Elements", v: "Off", ban: true },
      ],
      weapons: "Same as Search & Destroy",
      equipment: "Same as Search & Destroy",
      perks: "Same as Search & Destroy",
      extra: "Check that scorestreaks are OFF at the start of round 1. If they're on, leave immediately.",
    },
    "Gunfight": {
      gameMode: "Gunfight",
      note: "No settings changes needed. No restricted items in Gunfight. Preset loadouts, fast rounds.",
      settings: [],
    },
    "Variant": {
      gameMode: "Alternating modes per map",
      note: "Bo3: HP / SND / Overload. Bo5: HP / SND / OVL / HP / SND. Non-hosting team picks the map each mode. SND winner hosts Map 3.",
      settings: [],
      extra: "Use the corresponding mode's settings for each map (HP settings for HP maps, SND settings for SND maps, etc.)",
    },
  },
  "Call of Duty: Modern Warfare 4": {
    "Search & Destroy": {
      gameMode: "CDL Search and Destroy",
      note: "Use CDL rules. Apply the same competitive settings structure as BO7 SND.",
      settings: [
        { s: "Killcams", v: "On" },
        { s: "Team Assignment", v: "On" },
        { s: "Scorestreaks", v: "Off", ban: true },
      ],
    },
    "Hardpoint": {
      gameMode: "CDL Hardpoint",
      note: "Standard CDL Hardpoint settings.",
      settings: [
        { s: "Killcams", v: "On" },
        { s: "Respawn Delay", v: "3 Seconds" },
        { s: "Scorestreaks", v: "Off", ban: true },
      ],
    },
  },
  "Call of Duty: WWII": {
    "Search & Destroy": {
      gameMode: "CWL Search & Destroy (or Custom Game)",
      note: "Use the CWL Search & Destroy game mode. If unavailable, use Custom Game with these settings.",
      settings: [
        { s: "Time Limit", v: "1.5 Minutes" },
        { s: "Round Limit", v: "11" },
        { s: "Round Win Limit", v: "6" },
        { s: "Scorestreaks", v: "Off", ban: true },
        { s: "Killcam", v: "On" },
        { s: "Team Assignment", v: "On" },
      ],
      weapons: {
        allowed: ["BAR", "FG 42", "STG44", "M1 Garand", "SVT-40", "PPSh-41", "Type 100", "Grease Gun", "MP-40", "Thompson"],
        banned: "All LMGs, Shotguns, Snipers (except in SND), Launchers",
        bannedAttachments: "Rapid Fire, FMJ, Silencers, 4x/magnification optics, Incendiary Shells",
      },
      equipment: {
        lethals: ["Frag", "Semtex"],
        tacticals: ["Stun Grenade"],
      },
      perks: [
        { slot: "Basic Trainings", allowed: "Lookout, Hustle, Hunker, Flanker, Energetic, Scoped" },
        { slot: "Divisions", allowed: "Infantry, Airborne, Armored, Expeditionary" },
      ],
      extra: "Mountain division is banned (silent movement). All scorestreaks banned.",
    },
    "Hardpoint": {
      gameMode: "Hardpoint",
      note: "Custom Game Hardpoint with these settings.",
      settings: [
        { s: "Score Limit", v: "250" },
        { s: "Time Limit", v: "10 Minutes" },
        { s: "Scorestreaks", v: "Off", ban: true },
        { s: "Respawn Delay", v: "3 Seconds" },
        { s: "Killcam", v: "On" },
        { s: "Team Assignment", v: "On" },
      ],
      weapons: "Same as Search & Destroy",
      equipment: "Same as Search & Destroy",
      perks: "Same as Search & Destroy",
    },
  },
  "Call of Duty: Black Ops": {
    "Search & Destroy": {
      gameMode: "Custom Search & Destroy",
      note: "PS5 only. Anything not listed stays at default.",
      settings: [
        { s: "Round Timer", v: "1:30" },
        { s: "Defuse Time", v: "7.5s" },
        { s: "Side Switching", v: "Every round" },
        { s: "Round Win Limit", v: "6" },
        { s: "Friendly Fire", v: "On" },
        { s: "Killstreaks", v: "Disabled" },
        { s: "Game Recording", v: "On" },
      ],
      weapons: {
        banned: "All shotguns, LMGs, snipers, FN FAL, G11, M14",
        bannedAttachments: "All under-barrel attachments, dual wield, rapid fire",
      },
      equipment: {
        lethals: ["Frag", "Semtex"],
        tacticals: ["Stun"],
      },
      perks: [
        { slot: "Perk 1", allowed: "Lightweight Pro" },
        { slot: "Perk 2", allowed: "Sleight of Hand Pro, Steady Aim Pro" },
        { slot: "Perk 3", allowed: "Marathon Pro, Ninja Pro, Tac Mask Pro" },
      ],
      extra: "All equipment banned. Everything not listed above is restricted.",
    },
    "Hardpoint": {
      gameMode: "Custom Hardpoint",
      note: "PS5 only. Anything not listed stays at default.",
      settings: [
        { s: "Score Limit", v: "250" },
        { s: "Time Limit", v: "10 Minutes" },
        { s: "Respawn Delay", v: "3 Seconds" },
        { s: "Friendly Fire", v: "On" },
        { s: "Killstreaks", v: "Disabled", ban: true },
        { s: "Game Recording", v: "On" },
      ],
      weapons: "Same as Search & Destroy",
      equipment: "Same as Search & Destroy",
      perks: "Same as Search & Destroy",
    },
    "Domination": {
      gameMode: "Custom Domination",
      note: "PS5 only. Preset classes are allowed but both required loadouts must be set. Back out and rebuild if they are missing. Anything not listed stays at default.",
      settings: [
        { s: "Time Limit", v: "10 Minutes" },
        { s: "Score Limit", v: "200 Points" },
        { s: "Rounds", v: "2" },
        { s: "Flag Capture Time", v: "7.5 Seconds" },
        { s: "Respawn Delay", v: "5 Seconds" },
        { s: "Friendly Fire", v: "On" },
        { s: "Killstreaks", v: "Disabled", ban: true },
        { s: "Game Recording", v: "On" },
      ],
      weapons: "Same as Search & Destroy",
      equipment: "Same as Search & Destroy",
      perks: "Same as Search & Destroy",
    },
    "Capture the Flag": {
      gameMode: "Custom Capture the Flag",
      note: "PS5 only. Preset classes are allowed but both required loadouts must be set. Back out and rebuild if they are missing. Anything not listed stays at default.",
      settings: [
        { s: "Time Limit", v: "10 Minutes" },
        { s: "Enemy Carrier On Radar", v: "Delayed" },
        { s: "Round Win Limit", v: "1 Round" },
        { s: "Capture Limit", v: "10 Flags" },
        { s: "Respawn Delay", v: "7.5 Seconds" },
        { s: "Force Respawn", v: "On" },
        { s: "Wave Respawn Delay", v: "None" },
        { s: "Friendly Fire", v: "On" },
        { s: "Killstreaks", v: "Disabled", ban: true },
        { s: "Game Recording", v: "On" },
      ],
      weapons: "Same as Search & Destroy",
      equipment: "Same as Search & Destroy",
      perks: "Same as Search & Destroy",
    },
  },
  "Call of Duty: Black Ops II": {
    "Search & Destroy": {
      gameMode: "Custom Search & Destroy",
      note: "PS5 only. Anything not listed stays at default.",
      settings: [
        { s: "Round Timer", v: "1:30" },
        { s: "Round Limit", v: "6" },
        { s: "Defuse Time", v: "7.5s" },
        { s: "Side Switching", v: "Every round" },
        { s: "Silent Plant", v: "On" },
        { s: "Scorestreaks", v: "Off", ban: true },
        { s: "In-Game Team Change", v: "Off" },
        { s: "Dynamic Map Elements", v: "Off" },
        { s: "3rd-Person Spectating", v: "Off" },
        { s: "Revenge Voice", v: "Off" },
        { s: "Battlechatter", v: "Off" },
        { s: "Explosive Delay", v: "0s" },
        { s: "Friendly Fire", v: "On" },
      ],
      weapons: {
        allowed: ["M8A1", "MSMC"],
        secondary: ["B23R"],
        bannedAttachments: "Rapid Fire, FMJ, Silencers, magnification optics",
      },
      equipment: {
        lethals: ["Semtex", "Grenade"],
        tacticals: ["Concussion (max 1)"],
      },
      perks: [
        { slot: "Perk 1", allowed: "Lightweight" },
        { slot: "Perk 2", allowed: "Toughness" },
        { slot: "Perk 3", allowed: "Dexterity, Extreme Conditioning, Dead Silence" },
      ],
      extra: "Allowed wildcards: Perk 1/2/3 Greed, Primary Gunfighter, Secondary Gunfighter.",
    },
    "Hardpoint": {
      gameMode: "Custom Hardpoint",
      note: "PS5 only. Anything not listed stays at default.",
      settings: [
        { s: "Score Limit", v: "250" },
        { s: "Time Limit", v: "10 Minutes" },
        { s: "Respawn Delay", v: "3 Seconds" },
        { s: "Scorestreaks", v: "Off", ban: true },
        { s: "In-Game Team Change", v: "Off" },
        { s: "Dynamic Map Elements", v: "Off" },
        { s: "3rd-Person Spectating", v: "Off" },
        { s: "Revenge Voice", v: "Off" },
        { s: "Battlechatter", v: "Off" },
        { s: "Friendly Fire", v: "On" },
      ],
      weapons: "Same as Search & Destroy",
      equipment: "Same as Search & Destroy",
      perks: "Same as Search & Destroy",
    },
    "Domination": {
      gameMode: "Custom Domination",
      note: "PS5 only. Preset classes are allowed but you must have both required loadouts built. Anything not listed stays at default.",
      settings: [
        { s: "Time Limit", v: "10 Minutes" },
        { s: "Score Limit", v: "200 Points" },
        { s: "Round Limit", v: "2 Rounds" },
        { s: "Flag Capture Time", v: "7.5 Seconds" },
        { s: "Respawn Delay", v: "5 Seconds" },
        { s: "Friendly Fire", v: "On" },
        { s: "Scorestreaks", v: "Off", ban: true },
        { s: "In-Game Team Change", v: "Off" },
        { s: "Dynamic Map Elements", v: "Off" },
        { s: "3rd-Person Spectating", v: "Off" },
        { s: "Revenge Voice", v: "Off" },
        { s: "Battlechatter", v: "Off" },
      ],
      weapons: "Same as Search & Destroy",
      equipment: "Same as Search & Destroy",
      perks: "Same as Search & Destroy",
    },
    "Capture the Flag": {
      gameMode: "Custom Capture the Flag",
      note: "PS5 only. Preset classes are allowed but you must have both required loadouts built. Anything not listed stays at default.",
      settings: [
        { s: "Time Limit", v: "10 Minutes" },
        { s: "Enemy Carrier On Radar", v: "Delayed" },
        { s: "Round Win Limit", v: "1 Round" },
        { s: "Capture Limit", v: "10 Flags" },
        { s: "Respawn Delay", v: "7.5 Seconds" },
        { s: "Force Respawn", v: "On" },
        { s: "Wave Respawn Delay", v: "None" },
        { s: "Friendly Fire", v: "On" },
        { s: "Scorestreaks", v: "Off", ban: true },
        { s: "In-Game Team Change", v: "Off" },
        { s: "Dynamic Map Elements", v: "Off" },
        { s: "3rd-Person Spectating", v: "Off" },
        { s: "Revenge Voice", v: "Off" },
        { s: "Battlechatter", v: "Off" },
      ],
      weapons: "Same as Search & Destroy",
      equipment: "Same as Search & Destroy",
      perks: "Same as Search & Destroy",
    },
  },
};

// Kill Race / BR modes share the same simple setup
const KILL_RACE_SETUP = {
  gameMode: "Standard game mode",
  note: "No custom settings needed. Play on the standard mode. Most confirmed kills wins. Assists do not count.",
  settings: [],
};

const SURVIVAL_SETUP = {
  gameMode: "Standard game mode",
  note: "No custom settings needed. Last team alive wins.",
  settings: [],
};

export function getMatchSetup(game, mode) {
  if (MATCH_SETUP[game]?.[mode]) return MATCH_SETUP[game][mode];
  if (/Kill Race/i.test(mode)) return KILL_RACE_SETUP;
  if (/Survival/i.test(mode)) return SURVIVAL_SETUP;
  // Modes that inherit from SND (single-map SND variants)
  if (/Only SND|CDL Maps SND/i.test(mode) && MATCH_SETUP[game]?.["Search & Destroy"]) {
    return { ...MATCH_SETUP[game]["Search & Destroy"], note: `Same settings as Search & Destroy. ${mode} map only.` };
  }
  // Sake 24/7 or similar
  if (MATCH_SETUP[game]?.["Search & Destroy"]) {
    return { ...MATCH_SETUP[game]["Search & Destroy"], note: `Use SND or HP settings depending on the mode agreed in lobby.` };
  }
  return null;
}

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
  "Survival": "br",
  "Domination": "respawn",
  "Capture the Flag": "respawn"
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
  wagr: 0,
  tournament: 0.02,
  sideBet: 0.05,
  minimum: 0.25,
};

export const WITHDRAWAL_FEE = {
  percent: 0.02,
  flat: 0.25,
};

export const calculateWithdrawalFee = (amount) => {
  const n = Number(amount) || 0;
  return Math.round((n * WITHDRAWAL_FEE.percent + WITHDRAWAL_FEE.flat) * 100) / 100;
};

export const calculateWithdrawalNet = (amount) => {
  const n = Number(amount) || 0;
  return Math.round((n - calculateWithdrawalFee(n)) * 100) / 100;
};

export const NO_SHOW_MINUTES = 5;

// Restricted regions — cash wagering not permitted
export const RESTRICTED_US_STATES = [
  "AZ", "AR", "CT", "DE", "LA", "MD", "MT", "SC", "SD", "TN"
];
export const RESTRICTED_CA_PROVINCES = ["QC"];

export const US_STATES = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" }, { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" }, { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" }, { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" }, { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" }, { code: "IN", name: "Indiana" }, { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" }, { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" }, { code: "MD", name: "Maryland" }, { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" }, { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" }, { code: "MT", name: "Montana" }, { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" }, { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" }, { code: "NY", name: "New York" }, { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" }, { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" }, { code: "PA", name: "Pennsylvania" }, { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" }, { code: "SD", name: "South Dakota" }, { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" }, { code: "UT", name: "Utah" }, { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" }, { code: "WA", name: "Washington" }, { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" }, { code: "WY", name: "Wyoming" }, { code: "DC", name: "Washington DC" },
];
export const CA_PROVINCES = [
  { code: "AB", name: "Alberta" }, { code: "BC", name: "British Columbia" }, { code: "MB", name: "Manitoba" },
  { code: "NB", name: "New Brunswick" }, { code: "NL", name: "Newfoundland" }, { code: "NS", name: "Nova Scotia" },
  { code: "NT", name: "Northwest Territories" }, { code: "NU", name: "Nunavut" }, { code: "ON", name: "Ontario" },
  { code: "PE", name: "Prince Edward Island" }, { code: "QC", name: "Quebec" }, { code: "SK", name: "Saskatchewan" },
  { code: "YT", name: "Yukon" },
];

export function countryFlag(countryCode) {
  if (!countryCode) return "";
  return `https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`;
}

export function isRegionRestricted(country, stateCode) {
  if (!country || !stateCode) return false;
  if (country === "US" && RESTRICTED_US_STATES.includes(stateCode)) return true;
  if (country === "CA" && RESTRICTED_CA_PROVINCES.includes(stateCode)) return true;
  return false;
}

const LATAM_CODES = new Set(["BR","MX","CO","AR","CL","PE","EC","VE","UY","PY","BO","CR","PA","GT","HN","SV","NI","DO","PR","JM","CU","TT"]);
const EU_CODES = new Set(["DE","FR","IT","ES","NL","BE","AT","SE","NO","DK","FI","PL","PT","IE","CZ","RO","HU","GR","CH","BG","HR","SK","SI","LT","LV","EE","LU","MT","CY"]);

export function regionTag(countryCode) {
  if (!countryCode) return "";
  if (countryCode === "US") return "US";
  if (countryCode === "CA") return "CAN";
  if (countryCode === "GB") return "UK";
  if (countryCode === "AU") return "AU";
  if (LATAM_CODES.has(countryCode)) return "LATAM";
  if (EU_CODES.has(countryCode)) return "EU";
  return "";
}

export const calculateRake = (pot, isWagrMember = false) => {
  const rate = isWagrMember ? RAKE_CONFIG.wagr : RAKE_CONFIG.standard;
  if (rate === 0) return 0;
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
const CONSOLE_ONLY_GAMES = new Set([
  "Call of Duty: WWII", "Call of Duty: Black Ops", "Call of Duty: Black Ops II"
]);
const ACTIVISION_RE = /^\S+#\d{4,10}$/;

export function requiredAccountForGame(game) {
  if (ACTIVISION_GAMES.has(game)) return "activision";
  if (CONSOLE_ONLY_GAMES.has(game)) return "console";
  return null;
}

export const isConsoleOnlyGame = (game) => CONSOLE_ONLY_GAMES.has(game);
export const WWII_PLATFORMS = ["PlayStation Only", "Xbox Only"];
export const platformsForGame = (game) => GAMES.find((g) => g.name === game)?.platforms || null;

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
      const gShort = shortForGame(game) || game;
      if (platform === "PlayStation Only" && !(profile.psn || "").trim())
        return { eligible: false, reason: `Link your PSN account to play ${gShort} on PlayStation`, cta: "account" };
      if (platform === "Xbox Only" && !(profile.xbox || "").trim())
        return { eligible: false, reason: `Link your Xbox account to play ${gShort} on Xbox`, cta: "account" };
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

// ---------------------------------------------------------------------------
// Throwback game rulesets (Section 2 — stored as data)
// ---------------------------------------------------------------------------

export const THROWBACK_RULESETS = {
  "Call of Duty: Black Ops": {
    platform: "PlayStation matches run on the PS5 version only.",
    scoring: "1nD = one map decides it; Bo3 = first to 2 maps.",
    settings: [
      { label: "Round Timer", value: "1:30" },
      { label: "Defuse Time", value: "7.5s" },
      { label: "Side Switching", value: "Every round" },
      { label: "Round Win Limit", value: "6" },
      { label: "Friendly Fire", value: "On" },
      { label: "Killstreaks", value: "Disabled (Killstreak Editor → none)" },
      { label: "Game Recording", value: "On" },
    ],
    maps: ["Hanoi", "Firing Range", "Grid", "Havana", "Villa"],
    restrictions: {
      bannedWeapons: "All shotguns, all LMGs, all sniper rifles, FN FAL, G11, M14",
      bannedAttachments: "All under-barrel attachments, dual wield, rapid fire",
      allowedLethals: "Frag, Semtex",
      bannedLethals: "Everything else",
      allowedTacticals: "Stun",
      bannedTacticals: "Everything else",
      equipment: "All banned",
      allowedPerks: [
        { slot: "Perk 1", perks: "Lightweight Pro" },
        { slot: "Perk 2", perks: "Sleight of Hand Pro, Steady Aim Pro" },
        { slot: "Perk 3", perks: "Marathon Pro, Ninja Pro, Tac Mask Pro" },
      ],
    },
  },
  "Call of Duty: Black Ops II": {
    platform: "PlayStation matches run on the PS5 version only.",
    scoring: "1nD = one map decides it; Bo3 = first to 2 maps.",
    settings: [
      { label: "Round Timer", value: "1:30" },
      { label: "Round Limit", value: "6" },
      { label: "Defuse Time", value: "7.5s" },
      { label: "Side Switching", value: "Every round" },
      { label: "Silent Plant", value: "On" },
      { label: "Scorestreaks", value: "Off" },
      { label: "In-Game Team Change", value: "Off" },
      { label: "Dynamic Map Elements", value: "Off" },
      { label: "3rd-Person Spectating", value: "Off" },
      { label: "Revenge Voice", value: "Off" },
      { label: "Battlechatter", value: "Off" },
      { label: "Explosive Delay", value: "0s" },
      { label: "Friendly Fire", value: "On" },
    ],
    maps: ["Cargo", "Express", "Raid", "Slums", "Standoff"],
    restrictions: {
      allowedPrimaries: "M8A1, MSMC",
      allowedSecondary: "B23R",
      allowedPerks: [
        { slot: "Perk 1", perks: "Lightweight" },
        { slot: "Perk 2", perks: "Toughness" },
        { slot: "Perk 3", perks: "Dexterity, Extreme Conditioning, Dead Silence" },
      ],
      allowedLethals: "Semtex, Grenade",
      allowedTacticals: "Concussion (max 1 — two concussions not allowed)",
      allowedWildcards: "Perk 1/2/3 Greed, Primary Gunfighter, Secondary Gunfighter",
      allowedAttachments: "Ballistic CPU, EOTech, Reflex, Quickdraw, Fore Grip, Adjustable Stock, Long Barrel, Extended Mag, FMJ, Laser Sight",
    },
  },
};

// ---------------------------------------------------------------------------
// Shared throwback rules (Section 3 — applies to BO1 + BO2)
// ---------------------------------------------------------------------------

export const THROWBACK_SHARED_RULES = [
  {
    title: "Host",
    text: "Each map's host is shown on the match details page; the non-hosting team picks its starting side. In Bo3/Bo5 the team with more total rounds won across prior maps hosts the last map; if tied, whoever hosted map 1 hosts the decider."
  },
  {
    title: "Gamertags",
    text: "Your PSN tag must match exactly what's on your match details page. Admins may approve a mismatch in some cases (opponents notified in match chat). If a match is completed on a wrong tag, the result stands."
  },
  {
    title: "Proof",
    text: "Video only; console DVR strongly recommended. Valid proof shows the full scoreboard with gamertags and game info, legible. Outside-platform messages (Twitter, PSN DMs, etc.) don't count. No valid proof of a win risks a loss or replay."
  },
  {
    title: "No-Shows / Timers",
    text: "10 minutes from scheduled start to join or host. Live-supported: mark \"no show\" then \"request an administrator.\" Ticket-supported: submit timestamped video proof covering the wait window (per-map for multi-map series)."
  },
  {
    title: "Disconnects",
    text: "A disconnected player must be re-invited; a game can't be ended unless there's proof they can't rejoin. Ending or forcing an end without proof forfeits 1 round."
  },
  {
    title: "Glitches / Exploits",
    text: "Using a glitch forfeits the round or map by severity; if you see one, leave the next round and request an admin. Banned: plant/defuse through walls, out-of-map or wall-bounce spots, hiding your model inside objects, see-through-wall name or diamond spots, snaking, stair glitching, and ledge-peek prone spots that hide you."
  },
  {
    title: "Wrong Rules",
    text: "If the host sets wrong rules and it's proven, penalties apply (live: round forfeit; ticket: map forfeit) at admin discretion."
  },
  {
    title: "Controller Adapters",
    text: "Only the Brook Wingman is approved; any other adapter forfeits."
  },
  {
    title: "Handcams",
    text: "If enabled: must be approved by an admin in match chat before play; VODs saved after, including the full lobby with all players."
  },
];
