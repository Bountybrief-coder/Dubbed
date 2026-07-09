import React, { useState, useCallback, useEffect } from "react";
import { ShieldCheck, Search, Award, XCircle, ExternalLink } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useToast } from "../hooks/useToast.jsx";
import { adminListDisputes, adminSettleDispute, adminCancelDispute } from "../services/disputeService";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { SkeletonRows } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { shortDate } from "../utils/format";

const FILTERS = ["open", "resolved", "all"];

export function AdminDisputesPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [filter, setFilter] = useState("open");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settleFor, setSettleFor] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await adminListDisputes(filter);
    if (error) toast.error(error);
    setRows(data || []);
    setLoading(false);
  }, [filter]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  if (!isAdmin) return <main className="page"><EmptyState icon={ShieldCheck} title="Admins only" /></main>;

  const filtered = rows.filter((r) =>
    !query.trim() || r.player_a_name?.toLowerCase().includes(query.toLowerCase()) ||
    r.player_b_name?.toLowerCase().includes(query.toLowerCase()) || (r.match_code || "").includes(query)
  );

  return (
    <main className="page">
      <div className="pageHead"><div className="eyebrow">ADMIN</div><h1>Disputes</h1><p className="sub">Review disputed matches, examine evidence, and settle or cancel.</p></div>

      <div className="segRow inline">{FILTERS.map((f) => (
        <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>{f}</button>
      ))}</div>

      <div className="navSearch adminSearch"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search player or match code" /></div>

      {loading ? <SkeletonRows rows={4} height={80} /> : filtered.length === 0 ? <EmptyState title="No disputes">Nothing matches this filter.</EmptyState> : (
        <div className="adminWdList">
          {filtered.map((d) => (
            <div className="adminWdRow" key={d.dispute_id}>
              <div className="adminWdMain">
                <b>{d.match_code}</b>
                <span className="badge">{d.game}</span>
                <span className="badge">{d.mode}</span>
                <span className="badge">{d.format}</span>
                <span className={`statusChip ${d.status === "open" ? "s-rejected" : "s-paid"}`}>{d.status}</span>
              </div>
              <div className="adminWdMeta">
                <span>{d.player_a_name} vs {d.player_b_name}</span>
                <span>Filed by: {d.dispute_by_name}</span>
                <span>{shortDate(d.created_at)}</span>
                {d.tournament_name && <span className="badge accent">{d.tournament_name}</span>}
              </div>
              <div className="adminWdMeta" style={{ marginTop: 6 }}>
                <span>Reason: {d.dispute_reason}</span>
                {d.dispute_evidence && /^https?:\/\//i.test(d.dispute_evidence) && <a href={d.dispute_evidence} target="_blank" rel="noreferrer" className="txId"><ExternalLink size={11} /> Evidence</a>}
              </div>
              {d.status === "open" && (
                <div className="adminWdActions">
                  <Button variant="primary" className="sm" onClick={() => setSettleFor({ ...d, awardTo: "a" })}><Award size={13} /> Award {d.player_a_name}</Button>
                  <Button variant="primary" className="sm" onClick={() => setSettleFor({ ...d, awardTo: "b" })}><Award size={13} /> Award {d.player_b_name}</Button>
                  <Button variant="ghost" className="sm" onClick={() => setSettleFor({ ...d, awardTo: "cancel" })}><XCircle size={13} /> Cancel & refund</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {settleFor && <SettleModal d={settleFor} onClose={() => setSettleFor(null)} onDone={load} />}
    </main>
  );

  function SettleModal({ d, onClose, onDone }) {
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const isCancel = d.awardTo === "cancel";
    const winnerName = d.awardTo === "a" ? d.player_a_name : d.awardTo === "b" ? d.player_b_name : null;
    const winnerId = d.awardTo === "a" ? d.player_a_id : d.awardTo === "b" ? d.player_b_id : null;
    return (
      <Modal open onClose={onClose} eyebrow="RESOLVE DISPUTE" title={isCancel ? "Cancel & refund both?" : `Award win to ${winnerName}?`} size="sm">
        <p className="modalNote">{isCancel ? "Both players get their entries back. The match is marked cancelled." : `${winnerName} gets the payout. The other player loses their entry.`}</p>
        <label className="fieldLbl">Admin note (optional)</label>
        <textarea className="field area" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for decision" />
        <Button variant={isCancel ? "danger" : "primary"} className="wide" loading={busy} onClick={async () => {
          setBusy(true);
          const res = isCancel
            ? await adminCancelDispute(d.match_id, note.trim())
            : await adminSettleDispute(d.match_id, winnerId, note.trim());
          setBusy(false);
          if (res.error) return toast.error(res.error);
          toast.success(isCancel ? "Match cancelled and refunded." : `Win awarded to ${winnerName}.`);
          onDone(); onClose();
        }}>{isCancel ? "Cancel & refund" : `Award win to ${winnerName}`}</Button>
      </Modal>
    );
  }
}
