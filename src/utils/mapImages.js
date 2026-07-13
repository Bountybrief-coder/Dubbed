// Map visual metadata — each map gets a real thumbnail + accent color for its card.
// Game series determine the base hue, individual maps shift within that range.

import imgAbyss from "../assets/maps/abyss.jpg";
import imgArdennesForest from "../assets/maps/ardennes-forest.jpg";
import imgBlackheart from "../assets/maps/blackheart.jpg";
import imgBorderline from "../assets/maps/borderline.jpg";
import imgCargo from "../assets/maps/cargo.jpg";
import imgColossus from "../assets/maps/colossus.jpg";
import imgCompound from "../assets/maps/compound.jpg";
import imgDen from "../assets/maps/den.jpg";
import imgDepot from "../assets/maps/depot.jpg";
import imgDistrict from "../assets/maps/district.jpg";
import imgExpress from "../assets/maps/express.jpg";
import imgFiringRange from "../assets/maps/firing-range.jpg";
import imgFlakTower from "../assets/maps/flak-tower.jpg";
import imgFringe from "../assets/maps/fringe.jpg";
import imgGibraltar from "../assets/maps/gibraltar.jpg";
import imgGrid from "../assets/maps/grid.jpg";
import imgGridlock from "../assets/maps/gridlock.jpg";
import imgHacienda from "../assets/maps/hacienda.jpg";
import imgHanoi from "../assets/maps/hanoi.jpg";
import imgHavana from "../assets/maps/havana.jpg";
import imgLiminal from "../assets/maps/liminal.jpg";
import imgLondonDocks from "../assets/maps/london-docks.jpg";
import imgMeltdown from "../assets/maps/meltdown.jpg";
import imgNexus from "../assets/maps/nexus.jpg";
import imgNuketown from "../assets/maps/nuketown.jpg";
import imgParanoia from "../assets/maps/paranoia.jpg";
import imgRaid from "../assets/maps/raid.jpg";
import imgSainteMarie from "../assets/maps/sainte-marie-du-mont.jpg";
import imgSake from "../assets/maps/sake.jpg";
import imgSalvage from "../assets/maps/salvage.jpg";
import imgScar from "../assets/maps/scar.jpg";
import imgSlums from "../assets/maps/slums.jpg";
import imgStandoff from "../assets/maps/standoff.jpg";
import imgSummit from "../assets/maps/summit.jpg";
import imgTerminal from "../assets/maps/terminal.jpg";
import imgUssTex from "../assets/maps/uss-texas.jpg";
import imgVilla from "../assets/maps/villa.jpg";
import imgYemen from "../assets/maps/yemen.jpg";

const MAP_IMAGES = {
  Abyss: imgAbyss, "Ardennes Forest": imgArdennesForest, Blackheart: imgBlackheart,
  Borderline: imgBorderline, Cargo: imgCargo, Colossus: imgColossus, Compound: imgCompound,
  Den: imgDen, Depot: imgDepot, District: imgDistrict, Express: imgExpress,
  "Firing Range": imgFiringRange, "Flak Tower": imgFlakTower, Fringe: imgFringe,
  Gibraltar: imgGibraltar, Grid: imgGrid, Gridlock: imgGridlock, Hacienda: imgHacienda,
  Hanoi: imgHanoi, Havana: imgHavana, Liminal: imgLiminal, "London Docks": imgLondonDocks,
  Meltdown: imgMeltdown, Nexus: imgNexus, Nuketown: imgNuketown, Paranoia: imgParanoia,
  Raid: imgRaid, "Sainte Marie du Mont": imgSainteMarie, Sake: imgSake, Salvage: imgSalvage,
  Scar: imgScar, Slums: imgSlums, Standoff: imgStandoff, Summit: imgSummit,
  Terminal: imgTerminal, "USS Texas": imgUssTex, Villa: imgVilla, Yemen: imgYemen,
};

export function mapImage(mapName) {
  return MAP_IMAGES[mapName] || null;
}

const GAME_THEMES = {
  "Call of Duty: Black Ops 7":       { h: 15,  s: 85, tag: "BO7" },
  "Call of Duty: Modern Warfare 4":  { h: 150, s: 60, tag: "MW4" },
  "Call of Duty: Black Ops 4":       { h: 25,  s: 80, tag: "BO4" },
  "Call of Duty: Black Ops 3":       { h: 260, s: 70, tag: "BO3" },
  "Call of Duty: Modern Warfare":    { h: 120, s: 45, tag: "MW" },
  "Call of Duty: Modern Warfare 2":  { h: 210, s: 55, tag: "MW2" },
  "Call of Duty: World at War":      { h: 35,  s: 50, tag: "WaW" },
  "Call of Duty: WWII":              { h: 40,  s: 40, tag: "WWII" },
  "Call of Duty: Black Ops":         { h: 10,  s: 70, tag: "BO1" },
  "Call of Duty: Black Ops II":      { h: 30,  s: 75, tag: "BO2" },
  "Warzone":                         { h: 90,  s: 50, tag: "WZ" },
  "Black Ops Royale":                { h: 0,   s: 75, tag: "BOR" },
};

// Per-map overrides for hue shift (so maps within the same game look distinct)
const MAP_HUE_OFFSETS = {
  Den: 0, Raid: 30, Standoff: -20, Gridlock: 15, Hacienda: 45,
  Colossus: -10, Scar: 25, Sake: 50, Nuketown: -30, Fringe: 35,
  Abyss: -40, Liminal: 55, Paranoia: -35, Blackheart: 60, Nexus: -45,
  Compound: 0, Terminal: 20, Borderline: -15, District: 40, Salvage: -25, Depot: 10,
  "Firing Range": -20, Frequency: 30, Seaside: 50, Arsenal: -10,
  Hunted: 0, Stronghold: 20, Breach: -15, Evac: 35, Infection: -30, Redwood: 45, Combine: 15,
  Crash: 0, Backlot: 25, Strike: -20, Crossfire: 40, Overgrown: -10, Vacant: 30, Broadcast: 15,
  Highrise: 0, Scrapyard: -20, Favela: 30, Invasion: -15, Karachi: 45, Afghan: 20, "Sub Base": -25,
  Castle: 0, Dome: -20, Courtyard: 25, Cliffside: 40, Upheaval: -10, Asylum: 15, Roundhouse: -30,
  // WWII
  "Ardennes Forest": 0, "Flak Tower": 20, Gibraltar: -15, "London Docks": 35, "Sainte Marie du Mont": -25, "USS Texas": 45,
  // BO1
  Hanoi: 0, Grid: -20, Havana: 30, Villa: 45, Summit: -15,
  // BO2
  Cargo: 0, Express: 20, Slums: -15, Yemen: 35, Meltdown: -25,
};

// Map "vibe" — affects pattern overlay
const MAP_VIBES = {
  // Urban
  Den: "urban", Raid: "estate", Standoff: "urban", Gridlock: "urban", Terminal: "urban",
  Compound: "urban", District: "urban", Backlot: "urban", Highrise: "urban", Favela: "urban",
  Karachi: "urban", Depot: "urban", Borderline: "urban",
  // Nature / Outdoor
  Hacienda: "estate", Colossus: "ancient", Sake: "temple", Overgrown: "nature",
  Redwood: "nature", Cliffside: "nature", Afghan: "desert", Courtyard: "ancient",
  Seaside: "nature", Castle: "ancient", Hunted: "nature",
  // Industrial
  Scar: "industrial", Scrapyard: "industrial", Salvage: "industrial", Roundhouse: "industrial",
  "Firing Range": "industrial", Frequency: "industrial", Broadcast: "industrial",
  // Arena / Military
  Nuketown: "arena", Combine: "arena", Evac: "military", Breach: "military",
  Stronghold: "military", Infection: "military", Arsenal: "military",
  Crash: "military", Strike: "military", Crossfire: "military", Vacant: "military",
  "Sub Base": "military", Invasion: "military", Dome: "military",
  Upheaval: "military", Asylum: "military",
  Fringe: "nature",
  Abyss: "ancient", Liminal: "arena", Paranoia: "urban", Blackheart: "temple", Nexus: "industrial",
  // WWII
  "Ardennes Forest": "nature", "Flak Tower": "military", Gibraltar: "military",
  "London Docks": "industrial", "Sainte Marie du Mont": "urban", "USS Texas": "military",
  // BO1
  Hanoi: "urban", Grid: "industrial", Havana: "urban", Villa: "estate", Summit: "military",
  // BO2
  Cargo: "industrial", Express: "urban", Slums: "urban", Yemen: "desert", Meltdown: "industrial",
};

const VIBE_PATTERNS = {
  urban:      { angle: 135, stops: [0.0, 0.4, 1.0], opacities: [0.25, 0.08, 0.15] },
  estate:     { angle: 160, stops: [0.0, 0.5, 1.0], opacities: [0.20, 0.05, 0.12] },
  ancient:    { angle: 45,  stops: [0.0, 0.3, 1.0], opacities: [0.30, 0.10, 0.18] },
  temple:     { angle: 180, stops: [0.0, 0.6, 1.0], opacities: [0.22, 0.06, 0.14] },
  nature:     { angle: 120, stops: [0.0, 0.5, 1.0], opacities: [0.18, 0.04, 0.10] },
  industrial: { angle: 90,  stops: [0.0, 0.4, 1.0], opacities: [0.28, 0.12, 0.20] },
  arena:      { angle: 0,   stops: [0.0, 0.3, 1.0], opacities: [0.35, 0.15, 0.25] },
  military:   { angle: 110, stops: [0.0, 0.5, 1.0], opacities: [0.22, 0.08, 0.16] },
  desert:     { angle: 150, stops: [0.0, 0.6, 1.0], opacities: [0.20, 0.05, 0.12] },
};

export function mapCardStyle(mapName, gameName) {
  const theme = GAME_THEMES[gameName] || { h: 200, s: 50, tag: "COD" };
  const offset = MAP_HUE_OFFSETS[mapName] || 0;
  const h = (theme.h + offset + 360) % 360;
  const vibe = MAP_VIBES[mapName] || "urban";
  const pat = VIBE_PATTERNS[vibe];

  const h2 = (h + 25) % 360;
  const h3 = (h + 50) % 360;
  const bg = `linear-gradient(${pat.angle}deg,
    hsla(${h}, ${theme.s}%, 22%, 1) 0%,
    hsla(${h2}, ${Math.max(theme.s - 8, 20)}%, 14%, 1) 45%,
    hsla(${h3}, ${Math.max(theme.s - 15, 15)}%, 8%, 1) 100%)`;

  const accent = `hsl(${h}, ${Math.min(theme.s + 5, 95)}%, 58%)`;
  const glow = `hsla(${h}, ${theme.s}%, 50%, 0.35)`;

  return { background: bg, accent, glow, tag: theme.tag };
}

export function gameTag(gameName) {
  return GAME_THEMES[gameName]?.tag || "COD";
}

export function mapHue(mapName, gameName) {
  const theme = GAME_THEMES[gameName] || { h: 200, s: 50 };
  return (theme.h + (MAP_HUE_OFFSETS[mapName] || 0) + 360) % 360;
}

// Get all unique maps for a game (pass the pools object to avoid circular import)
export function allMapsFromPools(pools) {
  const set = new Set();
  for (const maps of Object.values(pools || {})) {
    for (const m of maps) set.add(m);
  }
  return [...set].sort();
}
