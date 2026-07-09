import { WEAPON_RESTRICTION_RULE } from "./games";

export const TOURNAMENT_ROTATION = [
 // SND
  { key:"daily-snd-4v4-na-10", name:"Daily 4v4 SND BO1 / NA Only", game:"Call of Duty: Black Ops 7", mode:"Search & Destroy", format:"4v4", series:"Best of 1", platform:"PC + Console Mixed", skillTier:"Open", region:"NA", entry:10, capacity:16, scheduleHourUTC:0, hostRule:"auto" },
  { key:"daily-snd-4v4-naeu-10", name:"Daily 4v4 SND BO1 / NA + EU", game:"Call of Duty: Black Ops 7", mode:"Search & Destroy", format:"4v4", series:"Best of 1", platform:"PC + Console Mixed", skillTier:"Open", region:"NA + EU", entry:10, capacity:16, scheduleHourUTC:19, hostRule:"auto" },
  { key:"daily-snd-2v2-na-5", name:"Daily 2v2 SND BO1 / NA Only", game:"Call of Duty: Black Ops 7", mode:"Search & Destroy", format:"2v2", series:"Best of 1", platform:"PC + Console Mixed", skillTier:"Open", region:"NA", entry:5, capacity:16, scheduleHourUTC:22, hostRule:"auto" },
  { key:"daily-snd-1v1-na-5", name:"Daily 1v1 SND / NA Only", game:"Call of Duty: Black Ops 7", mode:"Search & Destroy", format:"1v1", series:"Best of 1", platform:"PC + Console Mixed", skillTier:"Open", region:"NA", entry:5, capacity:16, scheduleHourUTC:1, hostRule:"auto" },
  { key:"daily-snd-1v1-naeu-5", name:"Daily 1v1 SND / NA + EU", game:"Call of Duty: Black Ops 7", mode:"Search & Destroy", format:"1v1", series:"Best of 1", platform:"PC + Console Mixed", skillTier:"Open", region:"NA + EU", entry:5, capacity:16, scheduleHourUTC:20, hostRule:"auto" },
  { key:"weekend-snd-4v4-na-25", name:"Weekend 4v4 SND BO3 / NA Only", game:"Call of Duty: Black Ops 7", mode:"Search & Destroy", format:"4v4", series:"Best of 3", platform:"PC + Console Mixed", skillTier:"Open", region:"NA", entry:25, capacity:32, scheduleHourUTC:23, weekendOnly:true, hostRule:"auto" },
 // HP
  { key:"daily-hp-4v4-na-10", name:"Daily 4v4 Hardpoint / NA Only", game:"Call of Duty: Black Ops 7", mode:"Hardpoint", format:"4v4", series:"Best of 3", platform:"PC + Console Mixed", skillTier:"Open", region:"NA", entry:10, capacity:16, scheduleHourUTC:23, hostRule:"auto" },
  { key:"daily-hp-4v4-naeu-10", name:"Daily 4v4 Hardpoint / NA + EU", game:"Call of Duty: Black Ops 7", mode:"Hardpoint", format:"4v4", series:"Best of 3", platform:"PC + Console Mixed", skillTier:"Open", region:"NA + EU", entry:10, capacity:8, scheduleHourUTC:20, hostRule:"auto" },
  { key:"daily-hp-2v2-na-5", name:"Daily 2v2 Hardpoint / NA Only", game:"Call of Duty: Black Ops 7", mode:"Hardpoint", format:"2v2", series:"Best of 3", platform:"PC + Console Mixed", skillTier:"Open", region:"NA", entry:5, capacity:16, scheduleHourUTC:2, hostRule:"auto" },
 // WZ Resurgence
  { key:"daily-wz-res-2v2-na-5", name:"Daily 2v2 Resurgence Kill Race / NA Only", game:"Warzone", mode:"Resurgence Kill Race", format:"2v2", series:"Best of 1", platform:"PC + Console Mixed", skillTier:"Open", region:"NA", entry:5, capacity:16, scheduleHourUTC:1, hostRule:"auto" },
  { key:"daily-wz-res-2v2-naeu-5", name:"Daily 2v2 Resurgence Kill Race / NA + EU", game:"Warzone", mode:"Resurgence Kill Race", format:"2v2", series:"Best of 1", platform:"PC + Console Mixed", skillTier:"Open", region:"NA + EU", entry:5, capacity:16, scheduleHourUTC:21, hostRule:"auto" },
  { key:"daily-wz-res-1v1-na-5", name:"Daily 1v1 Resurgence Kill Race / NA Only", game:"Warzone", mode:"Resurgence Kill Race", format:"1v1", series:"Best of 1", platform:"PC + Console Mixed", skillTier:"Open", region:"NA", entry:5, capacity:16, scheduleHourUTC:0, hostRule:"auto" },
 // BOR
  { key:"daily-bor-2v2-na-5", name:"Daily 2v2 Black Ops Royale Kill Race / NA Only", game:"Black Ops Royale", mode:"Kill Race", format:"2v2", series:"Best of 1", platform:"PC + Console Mixed", skillTier:"Open", region:"NA", entry:5, capacity:8, scheduleHourUTC:2, hostRule:"auto" },
  { key:"daily-bor-2v2-naeu-5", name:"Daily 2v2 Black Ops Royale Kill Race / NA + EU", game:"Black Ops Royale", mode:"Kill Race", format:"2v2", series:"Best of 1", platform:"PC + Console Mixed", skillTier:"Open", region:"NA + EU", entry:5, capacity:8, scheduleHourUTC:21, hostRule:"auto" },
  { key:"daily-bor-1v1-na-5", name:"Daily 1v1 Black Ops Royale Survival / NA Only", game:"Black Ops Royale", mode:"Survival", format:"1v1", series:"Best of 1", platform:"PC + Console Mixed", skillTier:"Open", region:"NA", entry:5, capacity:16, scheduleHourUTC:23, hostRule:"auto" },
 // Worldwide
  { key:"daily-snd-4v4-ww-10", name:"Daily 4v4 SND BO1 / Worldwide", game:"Call of Duty: Black Ops 7", mode:"Search & Destroy", format:"4v4", series:"Best of 1", platform:"PC + Console Mixed", skillTier:"Open", region:"Worldwide", entry:10, capacity:16, scheduleHourUTC:18, hostRule:"auto" },
  { key:"daily-hp-4v4-ww-10", name:"Daily 4v4 Hardpoint / Worldwide", game:"Call of Duty: Black Ops 7", mode:"Hardpoint", format:"4v4", series:"Best of 3", platform:"PC + Console Mixed", skillTier:"Open", region:"Worldwide", entry:10, capacity:16, scheduleHourUTC:17, hostRule:"auto" },
  { key:"daily-snd-1v1-ww-5", name:"Daily 1v1 SND / Worldwide", game:"Call of Duty: Black Ops 7", mode:"Search & Destroy", format:"1v1", series:"Best of 1", platform:"PC + Console Mixed", skillTier:"Open", region:"Worldwide", entry:5, capacity:16, scheduleHourUTC:16, hostRule:"auto" },
  { key:"daily-wz-res-2v2-ww-5", name:"Daily 2v2 Resurgence Kill Race / Worldwide", game:"Warzone", mode:"Resurgence Kill Race", format:"2v2", series:"Best of 1", platform:"PC + Console Mixed", skillTier:"Open", region:"Worldwide", entry:5, capacity:16, scheduleHourUTC:15, hostRule:"auto" },
 // Latin America
  { key:"daily-snd-4v4-latam-10", name:"Daily 4v4 SND BO1 / Latin America", game:"Call of Duty: Black Ops 7", mode:"Search & Destroy", format:"4v4", series:"Best of 1", platform:"PC + Console Mixed", skillTier:"Open", region:"Latin America", entry:10, capacity:16, scheduleHourUTC:1, hostRule:"auto" },
  { key:"daily-snd-1v1-latam-5", name:"Daily 1v1 SND / Latin America", game:"Call of Duty: Black Ops 7", mode:"Search & Destroy", format:"1v1", series:"Best of 1", platform:"PC + Console Mixed", skillTier:"Open", region:"Latin America", entry:5, capacity:16, scheduleHourUTC:2, hostRule:"auto" },
  { key:"daily-wz-res-2v2-latam-5", name:"Daily 2v2 Resurgence Kill Race / Latin America", game:"Warzone", mode:"Resurgence Kill Race", format:"2v2", series:"Best of 1", platform:"PC + Console Mixed", skillTier:"Open", region:"Latin America", entry:5, capacity:16, scheduleHourUTC:3, hostRule:"auto" }
];

export const presetByKey = (key) => TOURNAMENT_ROTATION.find((p) => p.key === key);
export const weaponRestrictionNote = (wr) => wr && wr !== "None" ? WEAPON_RESTRICTION_RULE : "";
