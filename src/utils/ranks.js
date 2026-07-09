import starRookie from "../assets/ranks/star-rookie.png";
import starElite from "../assets/ranks/star-elite.png";
import starLegend from "../assets/ranks/star-legend.png";
import starMaster from "../assets/ranks/star-master.png";

// XP tiers use the custom star art: Blue -> Purple -> Red -> Gold.
export const XP_RANKS = [
  { name: "Rookie", xp: 0,      img: starRookie, glow: "#3aa0ff" },
  { name: "Elite",  xp: 25000,  img: starElite,  glow: "#a15cff" },
  { name: "Legend", xp: 75000,  img: starLegend, glow: "#ff3b5c" },
  { name: "Master", xp: 150000, img: starMaster, glow: "#ffc23c" }
];

export const rankForXp = (xp = 0) =>
  XP_RANKS.slice().reverse().find((r) => xp >= r.xp) || XP_RANKS[0];

export const nextRank = (xp = 0) =>
  XP_RANKS.find((r) => r.xp > xp) || XP_RANKS[XP_RANKS.length - 1];

export const rankProgress = (xp = 0) => {
  const cur = rankForXp(xp);
  const nxt = nextRank(xp);
  if (nxt.xp === cur.xp) return 100;
  return Math.min(100, Math.round(((xp - cur.xp) / (nxt.xp - cur.xp)) * 100));
};
