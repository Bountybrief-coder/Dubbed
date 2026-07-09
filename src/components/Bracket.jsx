import React from "react";
import { Check, Swords } from "lucide-react";

export function Bracket({ rounds = [], matches = [], onClickMatch, isAdmin, onStartMatch }) {
  return (
    <div className="bracketGrid">
      {rounds.map((round) => {
        const roundMatches = matches.filter((m) => m.round_id === round.id);
        return (
          <div className="bracketRound" key={round.id}>
            <div className="bracketRoundH">{round.round_name}</div>
            {roundMatches.length === 0 ? (
              <div className="bracketMatch pending"><div className="bracketTeam"><span className="tbd">TBD</span></div><div className="bracketTeam"><span className="tbd">TBD</span></div></div>
            ) : roundMatches.map((m) => (
              <div
                key={m.id}
                className={`bracketMatch ${m.status === "live" ? "active" : ""} ${m.status === "completed" || m.status === "advanced" ? "completed" : ""} ${m.status === "bye" ? "bye" : ""} ${m.match_id ? "clickable" : ""}`}
                onClick={() => m.match_id && onClickMatch?.(m.match_id)}
                role={m.match_id ? "button" : undefined}
              >
                <div className={`bracketTeam ${m.winner_entrant === m.entrant_a ? "winner" : ""}`}>
                  <span>{m.entrant_a || "TBD"}</span>
                  {m.winner_entrant === m.entrant_a && <Check size={13} />}
                </div>
                <div className={`bracketTeam ${m.winner_entrant === m.entrant_b ? "winner" : ""}`}>
                  <span>{m.entrant_b || (m.status === "bye" ? "BYE" : "TBD")}</span>
                  {m.winner_entrant === m.entrant_b && <Check size={13} />}
                </div>
                {m.status === "live" && m.match_id && (
                  <span className="bracketLive"><Swords size={11} /> LIVE</span>
                )}
                {isAdmin && m.status === "ready" && !m.match_id && (
                  <button className="bracketStart" onClick={(e) => { e.stopPropagation(); onStartMatch?.(m.id); }}>Start</button>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
