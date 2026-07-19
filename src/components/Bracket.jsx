import React from "react";
import { Check, Swords, Crown, MapPin } from "lucide-react";

export function Bracket({ rounds = [], matches = [], onClickMatch }) {
  if (rounds.length === 0) return null;
  const sortedRounds = [...rounds].sort((a, b) => a.round_number - b.round_number);
  const total = sortedRounds.length;

  const r1Count = matches.filter((m) => m.round_id === sortedRounds[0]?.id).length;
  const expectedCount = (ri) => Math.max(1, Math.ceil(r1Count / Math.pow(2, ri)));

  return (
    <div className="bk">
      {sortedRounds.map((round, ri) => {
        const roundMatches = matches
          .filter((m) => m.round_id === round.id)
          .sort((a, b) => a.match_number - b.match_number);
        const isFinal = ri === total - 1;
        const isFirst = ri === 0;
        const expected = expectedCount(ri);
        const placeholders = Math.max(0, expected - roundMatches.length);

        return (
          <div className={`bkRound${isFinal ? " bkFinalRound" : ""}`} key={round.id}>
            <div className="bkRoundH">
              {isFinal && <Crown size={11} />}
              <span>{round.round_name}</span>
              {round.series_format && <span className="bkSeries">{round.series_format}</span>}
            </div>
            <div className="bkMatchCol">
              {roundMatches.map((m, mi) => (
                <MatchSlot
                  key={m.id}
                  m={m}
                  idx={mi}
                  isFinal={isFinal}
                  isFirst={isFirst}
                  isLast={isFinal}
                  onClickMatch={onClickMatch}
                />
              ))}
              {Array.from({ length: placeholders }, (_, pi) => (
                <div
                  key={`ph-${pi}`}
                  className={`bkSlot ${(roundMatches.length + pi) % 2 === 0 ? "bkTop" : "bkBot"} ${!isFirst ? "bkIn" : ""} ${!isFinal ? "bkOut" : ""}`}
                >
                  <div className="bkMatch pending">
                    <TeamRow />
                    <div className="bkVs" />
                    <TeamRow />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MatchSlot({ m, idx, isFinal, isFirst, isLast, onClickMatch }) {
  const isLive = m.status === "live";
  const isDone = m.status === "completed" || m.status === "advanced";
  const isBye = m.status === "bye";
  const clickable = !!m.match_id;
  const hasPlayers = !!m.entrant_a && !!m.entrant_b;

  const slotCls = [
    "bkSlot",
    idx % 2 === 0 ? "bkTop" : "bkBot",
    !isFirst && "bkIn",
    !isLast && "bkOut",
  ].filter(Boolean).join(" ");

  const matchCls = [
    "bkMatch",
    isLive && "live",
    isDone && "done",
    isBye && "bye",
    isFinal && "final",
    clickable && "clickable",
    !hasPlayers && !isBye && "pending",
  ].filter(Boolean).join(" ");

  return (
    <div className={slotCls}>
      <div
        className={matchCls}
        onClick={clickable ? () => onClickMatch?.(m.match_id) : undefined}
        role={clickable ? "button" : undefined}
      >
        {isLive && <div className="bkPulse" />}
        <TeamRow
          name={m.entrant_a}
          seed={m.seed_a}
          isWinner={m.winner_entrant && m.winner_entrant === m.entrant_a}
          isLoser={m.winner_entrant && m.winner_entrant !== m.entrant_a && !!m.entrant_a}
        />
        <div className="bkVs" />
        <TeamRow
          name={m.entrant_b || (isBye ? "BYE" : null)}
          seed={m.seed_b}
          isWinner={m.winner_entrant && m.winner_entrant === m.entrant_b}
          isLoser={m.winner_entrant && m.winner_entrant !== m.entrant_b && !!m.entrant_b}
          isBye={isBye}
        />
        {isLive && <div className="bkLiveTag"><Swords size={10} /> LIVE</div>}
        {m.match?.map && <div className="bkMapTag"><MapPin size={10} /> {m.match.map}</div>}
      </div>
    </div>
  );
}

function TeamRow({ name, seed, isWinner, isLoser, isBye }) {
  const cls = [
    "bkTeam",
    isWinner && "w",
    isLoser && "l",
    isBye && "bye",
    !name && "empty",
  ].filter(Boolean).join(" ");

  return (
    <div className={cls}>
      {seed != null && <span className="bkSeed">{seed}</span>}
      <span className="bkName">{name || "TBD"}</span>
      {isWinner && <Check size={14} className="bkCheck" />}
    </div>
  );
}
