import React, { useState } from "react";
import { Swords } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { TeamCrest } from "./TeamCrest";
import { useToast } from "../hooks/useToast.jsx";
import { sendChallenge } from "../services/teamService";
import { challengeError } from "../utils/errors";
import { modesForGame, formatForSize, teamCategoryLabel } from "../utils/games";

// Shared team-challenge modal. `target` is the team being challenged
// ({ id, name, game }); `myTeams` are the challenger's eligible teams.
export function ChallengeModal({ target, myTeams, onClose, onDone }) {
  const toast = useToast();
  const eligible = (myTeams || []).filter((t) => t.id !== target.id);
  const [fromId, setFromId] = useState(eligible[0]?.id || "");
  const [mode, setMode] = useState("Search and Destroy");
  const [kind, setKind] = useState("xp");
  const [entry, setEntry] = useState("");
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);

  const fromTeam = eligible.find((t) => t.id === fromId);
  const game = target.game || fromTeam?.game || "Call of Duty: Black Ops 7";
  const modes = modesForGame(game) || ["Search and Destroy"];

  async function submit() {
    if (!fromId) return toast.error("Select your team.");
    if (fromId === target.id) return toast.error("You can't challenge your own team.");
    if (kind === "cash" && (!entry || Number(entry) <= 0)) return toast.error("Set an entry amount.");
    setSending(true);
    const { error } = await sendChallenge(fromId, target.id, msg.trim(), {
      game,
      mode,
      format: formatForSize(fromTeam?.size),
      kind,
      entry: kind === "cash" ? Number(entry) : 0,
    });
    setSending(false);
    if (error) return toast.error(challengeError(error));
    toast.success(`Challenge sent to ${target.name}!`);
    onDone?.();
    onClose();
  }

  if (eligible.length === 0) {
    return (
      <Modal open onClose={onClose} eyebrow="TEAM CHALLENGE" title={`Challenge ${target.name}`} size="sm">
        <p className="modalNote">You need your own team to send a challenge. Create one first, then challenge from the ladder.</p>
        <Button variant="ghost" className="wide" onClick={onClose}>Close</Button>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} eyebrow="TEAM CHALLENGE" title={`Challenge ${target.name}`} size="sm">
      <div className="challVs">
        <div className="challVsSide">
          <TeamCrest team={fromTeam || {}} size={48} />
          <b>{fromTeam ? `[${fromTeam.tag}] ${fromTeam.name}` : "Your team"}</b>
        </div>
        <span className="challVsMark"><Swords size={18} /> VS</span>
        <div className="challVsSide">
          <TeamCrest team={target} size={48} />
          <b>[{target.tag}] {target.name}</b>
        </div>
      </div>

      <label className="fieldLbl">Your team</label>
      <select className="field" value={fromId} onChange={(e) => setFromId(e.target.value)}>
        {eligible.map((t) => <option key={t.id} value={t.id}>[{t.tag}] {t.name} · {teamCategoryLabel(t.size)}</option>)}
      </select>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
        <div>
          <label className="fieldLbl">Mode</label>
          <select className="field" value={mode} onChange={(e) => setMode(e.target.value)}>
            {modes.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="fieldLbl">Format</label>
          <div className="field" style={{ background: "var(--panel3)", cursor: "default" }}>{formatForSize(fromTeam?.size)}</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
        <div>
          <label className="fieldLbl">Type</label>
          <select className="field" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="xp">XP</option>
            <option value="cash">Cash</option>
          </select>
        </div>
        {kind === "cash" && (
          <div>
            <label className="fieldLbl">Entry ($)</label>
            <input className="field" type="number" min="1" step="1" value={entry} onChange={(e) => setEntry(e.target.value)} placeholder="10" />
          </div>
        )}
      </div>
      <label className="fieldLbl" style={{ marginTop: 8 }}>Message (optional)</label>
      <input className="field" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Let's run it" maxLength={100} />
      <Button variant="primary" className="wide" loading={sending} onClick={submit} style={{ marginTop: 12 }}>
        <Swords size={14} /> Send Challenge
      </Button>
    </Modal>
  );
}
