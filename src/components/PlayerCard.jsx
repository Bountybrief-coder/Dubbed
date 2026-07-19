import React from "react";
import { RankStar } from "./RankStar";
import { XP_RANKS, rankForXp, nextRank, rankProgress } from "../utils/ranks";
import "./PlayerCard.css";

const tierXpLabel = (xp) => (xp === 0 ? "Start" : xp % 1000 === 0 ? `${xp / 1000}k` : `${(xp / 1000).toFixed(1)}k`);

export function PlayerCard({ profile, variant = "full", onClick }) {
  if (!profile) return null;
  const xp = profile.xp || 0;
  const rank = rankForXp(xp);
  const nxt = nextRank(xp);
  const progress = rankProgress(xp);
  const isMaxed = nxt.xp === rank.xp;
  const curIdx = XP_RANKS.findIndex((r) => r.name === rank.name);

  return (
    <div className={`pcCard pcCard--${variant}`} style={{ "--rank-glow": rank.glow }} onClick={onClick}>
      <div className="pcHead">
        <span className="pcHeadLabel">Rank Progression</span>
        <span className="pcHeadXp">{xp.toLocaleString()} XP</span>
      </div>

      {/* ── Tier ladder: Rookie → Elite → Legend → Master ── */}
      <div className="pcLadder">
        {XP_RANKS.map((r, i) => {
          const state = i < curIdx ? "done" : i === curIdx ? "current" : "locked";
          const trackFilled = i <= curIdx;
          return (
            <React.Fragment key={r.name}>
              {i > 0 && (
                <div className={`pcTrack ${trackFilled ? "filled" : ""}`}>
                  {i === curIdx && !isMaxed && <div className="pcTrackFill" style={{ width: `${progress}%` }} />}
                </div>
              )}
              <div className={`pcTier is-${state}`} style={{ "--tier-glow": r.glow }}>
                <div className="pcTierStar"><RankStar rank={r} size={i === curIdx ? 32 : 24} /></div>
                <span className="pcTierName">{r.name}</span>
                <span className="pcTierXp">{tierXpLabel(r.xp)}</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* ── Next-tier line ── */}
      <div className="pcNext" role="progressbar" aria-valuenow={xp} aria-valuemin={rank.xp} aria-valuemax={isMaxed ? rank.xp : nxt.xp} aria-label={`${rank.name} rank progress`}>
        {isMaxed ? (
          <span className="pcNextMax"><b style={{ color: rank.glow }}>{rank.name}</b> — top tier reached. Prestige maxed.</span>
        ) : (
          <>
            <span className="pcNextLead">{progress}% to <b style={{ color: nxt.glow }}>{nxt.name}</b></span>
            <span className="pcNextRemain">{(nxt.xp - xp).toLocaleString()} XP to go</span>
          </>
        )}
      </div>
    </div>
  );
}
