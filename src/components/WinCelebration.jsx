import React, { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { money } from "../utils/format";

const COLORS = ["#22c5fb", "#7c5cff", "#ffc23c", "#3ecf6e", "#ff4d5e", "#ff8c42"];

const LABELS = {
  match_payout: "Cash match win",
  tournament_payout: "Tournament payout",
  bet_offer_payout: "Side bet won",
  side_bet_payout: "Side bet won",
  bet_payout: "Bet won",
};

function makeConfetti(n = 46) {
  return Array.from({ length: n }, (_, i) => {
    const angle = Math.random() * Math.PI * 2;
    const dist = 120 + Math.random() * 280;
    return {
      x: Math.round(Math.cos(angle) * dist),
      y: Math.round(Math.sin(angle) * dist),
      color: COLORS[i % COLORS.length],
      delay: Math.round(Math.random() * 120),
      size: 5 + Math.round(Math.random() * 7),
      rot: Math.round(Math.random() * 540 - 270),
    };
  });
}

// Short ascending arpeggio via Web Audio — no asset, no CSP concerns. Browser
// autoplay policy may block it if the user hasn't interacted recently; the
// visual still fires regardless.
function playWinSound() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.085;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.22, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + 0.4);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1600);
  } catch { /* audio blocked — visual still shows */ }
}

export function WinCelebration({ amount, reason, onClose }) {
  const [confetti] = useState(() => makeConfetti());

  useEffect(() => {
    playWinSound();
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="winOverlay" onClick={onClose} role="dialog" aria-label={`You won ${money(amount)}`}>
      <div className="confetti" aria-hidden="true">
        {confetti.map((c, i) => (
          <span key={i} className="confettiPiece" style={{
            "--x": `${c.x}px`, "--y": `${c.y}px`, "--rot": `${c.rot}deg`,
            width: c.size, height: c.size, background: c.color, animationDelay: `${c.delay}ms`,
          }} />
        ))}
      </div>
      <div className="winCard" onClick={(e) => e.stopPropagation()}>
        <div className="winTrophy"><Trophy size={30} /></div>
        <div className="winEyebrow">YOU WON</div>
        <div className="winAmount">{money(amount)}</div>
        <div className="winSub">{LABELS[reason] || "Payout"} · added to your balance</div>
        <button className="btn btn-primary sm winClose" onClick={onClose}>Let's go</button>
      </div>
    </div>
  );
}
