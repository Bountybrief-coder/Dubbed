import React, { useState, useCallback } from "react";
import { ShieldCheck, Plus, Trophy, Calendar, Flag, Users } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useToast } from "../hooks/useToast.jsx";
import { useConfirm } from "../hooks/useConfirm.jsx";
import { useAsync } from "../hooks/useAsync";
import { listSeasons, adminCreateSeason, adminEndSeason } from "../services/seasonService";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { SkeletonRows } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { money } from "../utils/format";

const STATUS_COLORS = { upcoming: "var(--neon)", active: "var(--win)", completed: "var(--muted)" };
const STATUS_LABELS = { upcoming: "Upcoming", active: "Active", completed: "Completed" };

export function AdminSeasonsPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, loading, error, reload } = useAsync(() => listSeasons(), []);
  const [createOpen, setCreateOpen] = useState(false);

  if (!isAdmin) return <main className="page"><EmptyState icon={ShieldCheck} title="Admins only" /></main>;

  async function handleEndSeason(season) {
    if (!await confirm({ title: "End season?", message: `This will end "${season.name}" and create the playoff tournament from the top ${season.playoff_size} players.`, confirmLabel: "End Season" })) return;
    const res = await adminEndSeason(season.id);
    if (res.error) return toast.error(res.error);
    toast.success(`Season ended. Playoff tournament created.`);
    reload();
  }

  const seasons = data || [];

  return (
    <main className="page">
      <div className="pageHead">
        <div className="eyebrow">ADMIN</div>
        <h1>Seasons</h1>
        <p className="sub">Create and manage competitive seasons with playoff tournaments.</p>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <Button icon={Plus} onClick={() => setCreateOpen(true)}>New Season</Button>
      </div>

      {loading ? <SkeletonRows rows={4} /> : error ? (
        <div className="errorState"><p>{error}</p><button className="btn btn-ghost sm" onClick={reload}>Retry</button></div>
      ) : seasons.length === 0 ? (
        <EmptyState icon={Calendar} title="No seasons yet">Create your first season to start tracking seasonal rankings.</EmptyState>
      ) : (
        <div className="adminSeasonsList">
          {seasons.map(s => (
            <div key={s.id} className="adminSeasonCard">
              <div className="adminSeasonHead">
                <span className="adminSeasonStatus" style={{ color: STATUS_COLORS[s.status] }}>
                  {STATUS_LABELS[s.status]}
                </span>
                <b className="adminSeasonName">{s.name}</b>
                <span className="adminSeasonDates">
                  {new Date(s.start_date).toLocaleDateString()} - {new Date(s.end_date).toLocaleDateString()}
                </span>
              </div>
              <div className="adminSeasonStats">
                <div className="adminSeasonStat">
                  <Users size={14} />
                  <span>{s.player_count || 0} players</span>
                </div>
                <div className="adminSeasonStat">
                  <Trophy size={14} />
                  <span>Top {s.playoff_size} → playoffs</span>
                </div>
                {s.prize_pool > 0 && (
                  <div className="adminSeasonStat">
                    <span>{money(s.prize_pool)} prize pool</span>
                  </div>
                )}
              </div>
              <div className="adminSeasonActions">
                {s.status === "active" && (
                  <Button size="sm" variant="danger" icon={Flag} onClick={() => handleEndSeason(s)}>
                    End Season & Create Playoffs
                  </Button>
                )}
                {s.playoff_tournament_id && (
                  <span className="adminSeasonPlayoff">
                    Playoff tournament created
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {createOpen && <CreateSeasonModal onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); reload(); }} />}
    </main>
  );
}

function CreateSeasonModal({ onClose, onCreated }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
    playoffSize: "8",
    prizePool: "0",
  });
  const [saving, setSaving] = useState(false);

  function set(k, v) { setForm(p => ({ ...p, [k]: v })); }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Name required");
    if (!form.endDate) return toast.error("End date required");
    setSaving(true);
    const res = await adminCreateSeason({
      name: form.name.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      playoffSize: parseInt(form.playoffSize) || 8,
      prizePool: parseFloat(form.prizePool) || 0,
    });
    setSaving(false);
    if (res.error) return toast.error(res.error);
    toast.success(`Season "${form.name}" created.`);
    onCreated();
  }

  return (
    <Modal open title="Create Season" onClose={onClose}>
      <form onSubmit={handleCreate} className="adminSeasonForm">
        <label>
          <span>Season Name</span>
          <input type="text" value={form.name} onChange={e => set("name", e.target.value)} placeholder="Season 1" />
        </label>
        <div className="adminSeasonFormRow">
          <label>
            <span>Start Date</span>
            <input type="date" value={form.startDate} onChange={e => set("startDate", e.target.value)} />
          </label>
          <label>
            <span>End Date</span>
            <input type="date" value={form.endDate} onChange={e => set("endDate", e.target.value)} />
          </label>
        </div>
        <div className="adminSeasonFormRow">
          <label>
            <span>Playoff Size</span>
            <select value={form.playoffSize} onChange={e => set("playoffSize", e.target.value)}>
              <option value="4">Top 4</option>
              <option value="8">Top 8</option>
              <option value="16">Top 16</option>
              <option value="32">Top 32</option>
            </select>
          </label>
          <label>
            <span>Prize Pool ($)</span>
            <input type="number" step="0.01" min="0" value={form.prizePool} onChange={e => set("prizePool", e.target.value)} />
          </label>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <Button variant="ghost" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" loading={saving}>Create Season</Button>
        </div>
      </form>
    </Modal>
  );
}
