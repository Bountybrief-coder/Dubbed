import React, { useState, useCallback, useEffect } from "react";
import { ShieldCheck, Search, MessageSquare, AlertTriangle, Eye, Award, RotateCcw, XCircle, ArrowRight } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useToast } from "../hooks/useToast.jsx";
import { supabase } from "../lib/supabase";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { SkeletonRows } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { money, shortDate } from "../utils/format";

const FILTERS = ["live", "disputed", "reported", "settled", "cancelled", "all"];
const STATUS_TARGETS = ["open", "live", "reported", "disputed", "cancelled"];

export function AdminMatchSupportPage({ onNavigate }) {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [filter, setFilter] = useState("live");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settleFor, setSettleFor] = useState(null);
  const [revertFor, setRevertFor] = useState(null);
  const [statusFor, setStatusFor] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("matches")
      .select("id, code, game, mode, format, region, entry, kind, status, winner_id, created_at, match_players(user_id, profiles(username))")
      .order("created_at", { ascending: false })
      .limit(100);
    if (filter !== "all") q = q.eq("status", filter);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows(data || []);
    setLoading(false);
  }, [filter]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const sub = supabase
      .channel("admin-matches-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => load())
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, [load]);

  if (!isAdmin) return <main className="page"><EmptyState icon={ShieldCheck} title="Admins only" /></main>;

  const filtered = rows.filter((r) =>
    !query.trim() ||
    r.code?.toLowerCase().includes(query.toLowerCase()) ||
    r.match_players?.some((p) => p.profiles?.username?.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <main className="page">
      <div className="pageHead">
        <div className="eyebrow">ADMIN</div>
        <h1><MessageSquare size={24} /> Match Support</h1>
        <p className="sub">Manage matches. Join rooms, settle, revert, cancel, or advance status.</p>
      </div>

      <div className="segRow inline">
        {FILTERS.map((f) => (
          <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      <div className="navSearch adminSearch">
        <Search size={15} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by match code or player" />
      </div>

      {loading ? <SkeletonRows rows={4} height={70} /> : filtered.length === 0 ? (
        <EmptyState title="No matches">No matches with this status right now.</EmptyState>
      ) : (
        <div className="adminWdList">
          {filtered.map((m) => {
            const players = (m.match_players || []).map((p) => ({ id: p.user_id, name: p.profiles?.username || "?" }));
            const winnerName = m.winner_id ? players.find((p) => p.id === m.winner_id)?.name : null;
            return (
              <div className="adminWdRow" key={m.id}>
                <div className="adminWdMain">
                  <b>{m.code}</b>
                  <span className="badge">{m.game}</span>
                  <span className="badge">{m.mode}</span>
                  <span className="badge">{m.format}</span>
                  <span className="badge">{money(m.entry)}</span>
                  <span className={`statusChip ${m.status === "disputed" ? "s-rejected" : m.status === "live" ? "s-active" : m.status === "settled" ? "s-paid" : "s-pending"}`}>
                    {m.status}
                  </span>
                </div>
                <div className="adminWdMeta">
                  <span>{players.map((p) => p.name).join(" vs ") || "Waiting"}</span>
                  <span>{m.region} · {m.kind}</span>
                  <span>{shortDate(m.created_at)}</span>
                  {winnerName && <span>Winner: {winnerName}</span>}
                </div>
                <div className="adminWdActions">
                  <Button variant="primary" className="sm" onClick={() => onNavigate("match", m.id)}>
                    <Eye size={13} /> Join Room
                  </Button>

                  {["live", "reported", "disputed"].includes(m.status) && players.length >= 2 && (
                    <Button variant="primary" className="sm" onClick={() => setSettleFor({ ...m, players })}>
                      <Award size={13} /> Settle
                    </Button>
                  )}

                  {m.status === "settled" && (
                    <Button variant="ghost" className="sm" onClick={() => setRevertFor(m)}>
                      <RotateCcw size={13} /> Revert
                    </Button>
                  )}

                  {!["settled", "cancelled"].includes(m.status) && (
                    <Button variant="ghost" className="sm" onClick={() => setStatusFor(m)}>
                      <ArrowRight size={13} /> Change Status
                    </Button>
                  )}

                  {m.status === "disputed" && (
                    <span style={{ color: "var(--gold)", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                      <AlertTriangle size={12} /> Needs attention
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {settleFor && <SettleModal match={settleFor} onClose={() => setSettleFor(null)} onDone={load} />}
      {revertFor && <RevertModal match={revertFor} onClose={() => setRevertFor(null)} onDone={load} />}
      {statusFor && <StatusModal match={statusFor} onClose={() => setStatusFor(null)} onDone={load} />}
    </main>
  );

  function SettleModal({ match, onClose, onDone }) {
    const [winner, setWinner] = useState(match.players[0]?.id || "");
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const winnerName = match.players.find((p) => p.id === winner)?.name;

    return (
      <Modal open onClose={onClose} eyebrow="SETTLE MATCH" title={`Settle ${match.code}`} size="sm">
        <label className="fieldLbl">Pick winner</label>
        <div className="chipRow wrap">
          {match.players.map((p) => (
            <button key={p.id} className={winner === p.id ? "on" : ""} onClick={() => setWinner(p.id)}>{p.name}</button>
          ))}
        </div>
        <label className="fieldLbl">Note (optional)</label>
        <textarea className="field area" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason" />
        <Button variant="primary" className="wide" loading={busy} onClick={async () => {
          setBusy(true);
          const { error } = await supabase.rpc("settle_match_admin", { p_match: match.id, p_winner: winner, p_note: note.trim() || null });
          setBusy(false);
          if (error) return toast.error(error.message);
          toast.success(`${winnerName} wins match ${match.code}.`);
          onDone(); onClose();
        }}>Award win to {winnerName}</Button>
      </Modal>
    );
  }

  function RevertModal({ match, onClose, onDone }) {
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);

    return (
      <Modal open onClose={onClose} eyebrow="REVERT MATCH" title={`Revert ${match.code}?`} size="sm">
        <p className="modalNote">This undoes the payout, reverses wins/losses, and sets the match back to <b>live</b>. The wallet ledger records the reversal.</p>
        <label className="fieldLbl">Reason</label>
        <textarea className="field area" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why are you reverting?" />
        <Button variant="danger" className="wide" loading={busy} onClick={async () => {
          setBusy(true);
          const { error } = await supabase.rpc("admin_revert_match", { p_match: match.id, p_note: note.trim() || null });
          setBusy(false);
          if (error) return toast.error(error.message);
          toast.success(`Match ${match.code} reverted to live.`);
          onDone(); onClose();
        }}>Revert Match</Button>
      </Modal>
    );
  }

  function StatusModal({ match, onClose, onDone }) {
    const [target, setTarget] = useState("");
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const available = STATUS_TARGETS.filter((s) => s !== match.status);

    return (
      <Modal open onClose={onClose} eyebrow="CHANGE STATUS" title={`${match.code} · currently ${match.status}`} size="sm">
        <label className="fieldLbl">New status</label>
        <div className="chipRow wrap">
          {available.map((s) => (
            <button key={s} className={target === s ? "on" : ""} onClick={() => setTarget(s)}>{s}</button>
          ))}
        </div>
        {target === "cancelled" && match.kind === "cash" && (
          <p className="modalNote" style={{ color: "var(--gold)" }}>Cancelling a cash match refunds all players their entry fee.</p>
        )}
        <label className="fieldLbl">Note (optional)</label>
        <textarea className="field area" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for status change" />
        <Button variant="primary" className="wide" loading={busy} disabled={!target} onClick={async () => {
          setBusy(true);
          const { error } = await supabase.rpc("admin_set_match_status", { p_match: match.id, p_status: target, p_note: note.trim() || null });
          setBusy(false);
          if (error) return toast.error(error.message);
          toast.success(`Match ${match.code} → ${target}.`);
          onDone(); onClose();
        }}>Set to {target || "…"}</Button>
      </Modal>
    );
  }
}
