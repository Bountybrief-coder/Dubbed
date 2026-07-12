import React, { useState, useCallback, useEffect } from "react";
import { ShieldCheck, Search, Plus, Play, Calendar } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useToast } from "../hooks/useToast.jsx";
import { useAsync } from "../hooks/useAsync";
import { useVisibilityRefresh } from "../hooks/useVisibilityRefresh";
import { listTournaments, adminCreateTournament, adminGenerateBracket } from "../services/tournamentService";
import { TOURNAMENT_ROTATION } from "../utils/tournamentPresets";
import { GAMES, REGIONS, PLATFORMS, SKILL_TIERS, SERIES_OPTIONS, modesForGame, formatsForGame } from "../utils/games";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { SkeletonRows } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { money, shortDate } from "../utils/format";

export function AdminTournamentsPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => listTournaments(), []);
  useVisibilityRefresh(reload, []);
  const [createOpen, setCreateOpen] = useState(false);

  if (!isAdmin) return <main className="page"><EmptyState icon={ShieldCheck} title="Admins only" /></main>;

  async function generateBracket(id) {
    const res = await adminGenerateBracket(id);
    if (res.error) return toast.error(res.error);
    toast.success("Bracket generated."); reload();
  }

  async function scheduleDailyRotation() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dow = tomorrow.getDay();
    const isWeekend = dow === 5 || dow === 6;
    const toSchedule = TOURNAMENT_ROTATION.filter((t) => !t.weekendOnly || isWeekend);
    let created = 0;
    for (const preset of toSchedule) {
      const startsAt = new Date(tomorrow);
      startsAt.setUTCHours(preset.scheduleHourUTC, 0, 0, 0);
      const { error } = await adminCreateTournament({
        name: preset.name, game: preset.game, mode: preset.mode, format: preset.format,
        series: preset.series, region: preset.region, entry: preset.entry, capacity: preset.capacity,
        platform: preset.platform, skillTier: preset.skillTier, startsAt: startsAt.toISOString(),
        hostRule: preset.hostRule
      });
      if (!error) created++;
    }
    toast.success(`Scheduled ${created} tournaments for ${tomorrow.toLocaleDateString()}.`);
    reload();
  }

  return (
    <main className="page">
      <div className="pageHead"><div className="eyebrow">ADMIN</div><h1>Tournaments</h1></div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <Button variant="primary" onClick={() => setCreateOpen(true)}><Plus size={14} /> Create tournament</Button>
        <Button variant="ghost" onClick={scheduleDailyRotation}><Calendar size={14} /> Schedule tomorrow's rotation</Button>
      </div>

      {loading ? <SkeletonRows rows={4} height={56} /> : error ? (
        <div className="errorState"><p>{error}</p><button className="btn btn-ghost sm" onClick={reload}>Retry</button></div>
      ) : (data || []).length === 0 ? <EmptyState title="No tournaments" /> : (
        <div className="adminWdList">
          {(data || []).map((t) => (
            <div className="adminWdRow" key={t.id}>
              <div className="adminWdMain">
                <b>{t.name}</b>
                <span className={`statusChip ${t.status === "live" ? "s-live" : t.status === "completed" ? "s-paid" : "s-pending"}`}>{t.status}</span>
                <span className="badge">{t.region === "NA" ? "NA Only" : t.region === "EU" ? "EU Only" : t.region}</span>
                <span className="badge">{t.format}</span>
              </div>
              <div className="adminWdMeta">
                <span>{money(t.entry)} entry · {t.entries_count || 0}/{t.capacity} teams · {shortDate(t.starts_at)}</span>
              </div>
              {t.status === "upcoming" && !t.bracket_generated && (t.entries_count || 0) >= 2 && (
                <div className="adminWdActions">
                  <Button variant="primary" className="sm" onClick={() => generateBracket(t.id)}><Play size={13} /> Generate bracket</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {createOpen && <CreateTournamentModal onClose={() => setCreateOpen(false)} onDone={reload} />}
    </main>
  );

  function CreateTournamentModal({ onClose, onDone }) {
    const [name, setName] = useState("");
    const [game, setGame] = useState(GAMES[0].name);
    const [mode, setMode] = useState(GAMES[0].modes[0]);
    const [format, setFormat] = useState("4v4");
    const [series, setSeries] = useState("Best of 1");
    const [region, setRegion] = useState("NA");
    const [entry, setEntry] = useState(10);
    const [capacity, setCapacity] = useState(16);
    const [platform, setPlatform] = useState("PC + Console Mixed");
    const [skillTier, setSkillTier] = useState("Open");
    const [startsAt, setStartsAt] = useState("");
    const [busy, setBusy] = useState(false);

    const modes = modesForGame(game);
    const formats = formatsForGame(game);

    return (
      <Modal open onClose={onClose} eyebrow="CREATE TOURNAMENT" title="New tournament" size="sm">
        <label className="fieldLbl">Name</label>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Daily 4v4 SND BO1 / NA Only" />

        <label className="fieldLbl">Game</label>
        <select className="field" value={game} onChange={(e) => { setGame(e.target.value); setMode(modesForGame(e.target.value)[0]); }}>
          {GAMES.map((g) => <option key={g.name} value={g.name}>{g.short} · {g.name}</option>)}
        </select>

        <label className="fieldLbl">Mode</label>
        <select className="field" value={mode} onChange={(e) => setMode(e.target.value)}>
          {modes.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><label className="fieldLbl">Format</label>
            <select className="field" value={format} onChange={(e) => setFormat(e.target.value)}>
              {formats.map((f) => <option key={f} value={f}>{f}</option>)}
            </select></div>
          <div><label className="fieldLbl">Series</label>
            <select className="field" value={series} onChange={(e) => setSeries(e.target.value)}>
              {SERIES_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select></div>
        </div>

        <label className="fieldLbl">Region</label>
        <div className="chipRow wrap">{REGIONS.map((r) => (
          <button key={r} className={region === r ? "on" : ""} onClick={() => setRegion(r)}>{r === "NA" ? "NA Only" : r === "EU" ? "EU Only" : r}</button>
        ))}</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><label className="fieldLbl">Entry ($)</label>
            <input className="field" type="number" min="1" value={entry} onChange={(e) => setEntry(e.target.value)} /></div>
          <div><label className="fieldLbl">Capacity</label>
            <select className="field" value={capacity} onChange={(e) => setCapacity(e.target.value)}>
              {[4, 8, 16, 32, 64].map((c) => <option key={c} value={c}>{c} teams</option>)}
            </select></div>
        </div>

        <label className="fieldLbl">Platform</label>
        <select className="field" value={platform} onChange={(e) => setPlatform(e.target.value)}>
          {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        <label className="fieldLbl">Start time</label>
        <input className="field" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />

        <Button variant="primary" className="wide" loading={busy} disabled={!name.trim() || !startsAt} onClick={async () => {
          setBusy(true);
          const res = await adminCreateTournament({
            name: name.trim(), game, mode, format, series, region,
            entry: Number(entry), capacity: Number(capacity), platform, skillTier, startsAt: new Date(startsAt).toISOString()
          });
          setBusy(false);
          if (res.error) return toast.error(res.error);
          toast.success("Tournament created.");
          onDone(); onClose();
        }}>Create tournament</Button>
      </Modal>
    );
  }
}
