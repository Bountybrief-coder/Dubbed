import React from "react";
import { RankStar } from "./RankStar";
import { WagrBadge } from "./WagrBadge";
import { rankForXp, nextRank, rankProgress } from "../utils/ranks";
import { money } from "../utils/format";
import "./PlayerCard.css";

export function PlayerCard({ profile, variant = "full", onClick }) {
  if (!profile) return null;
  const rank = rankForXp(profile.xp || 0);
  const nxt = nextRank(profile.xp || 0);
  const progress = rankProgress(profile.xp || 0);
  const xp = profile.xp || 0;
  const isMaxed = nxt.xp === rank.xp;

  return (
    <div
      className={`pcCard pcCard--${variant}`}
      style={{ "--rank-glow": rank.glow }}
      onClick={onClick}
    >
      {/* ── Rank Progression Bar ── */}
      <div className="pcProgress">
        <div className="pcProgressLabels">
          <div className="pcRankCurrent">
            <RankStar rank={rank} size={20} />
            <span className="pcRankName">{rank.name}</span>
          </div>
          <span className="pcRankNext">
            {isMaxed ? "MAX" : nxt.name}
          </span>
        </div>
        <div className="pcBar">
          <div
            className="pcBarFill"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={xp}
            aria-valuemin={rank.xp}
            aria-valuemax={isMaxed ? rank.xp : nxt.xp}
            aria-label={`${rank.name} rank progress`}
          />
        </div>
        <div className="pcProgressXp">
          <span className="pcXpCount">
            {xp.toLocaleString()}
            {!isMaxed && <span className="pcXpTotal"> / {nxt.xp.toLocaleString()}</span>}
            {" XP"}
          </span>
          {!isMaxed && (
            <span className="pcXpRemain">
              {(nxt.xp - xp).toLocaleString()} to go
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
