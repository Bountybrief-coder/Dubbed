import React from "react";
import trophyGold from "../assets/trophy-gold.png";
import trophySilver from "../assets/trophy-silver.png";
import trophyBronze from "../assets/trophy-bronze.png";
import trophyWagr from "../assets/trophy-wagr.png";

const IMAGES = {
  gold: trophyGold,
  silver: trophySilver,
  bronze: trophyBronze,
  wagr: trophyWagr,
};

export function TrophyIcon({ tone = "gold", size = 48 }) {
  const src = IMAGES[tone] || IMAGES.gold;
  return (
    <img
      src={src}
      alt={`${tone} trophy`}
      width={size}
      height={size}
      className="trophyImg"
      draggable={false}
    />
  );
}
