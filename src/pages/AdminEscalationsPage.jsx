import React, { useState } from "react";
import { clickable } from "../utils/a11y";
import { ShieldCheck, AlertTriangle, CheckCircle, XCircle, Clock, DollarSign, Zap } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useToast } from "../hooks/useToast.jsx";
import { useAsync } from "../hooks/useAsync";
import { listEscalationTickets, resolveEscalation } from "../services/escalationService";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { SkeletonRows } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { money, shortDate } from "../utils/format";

const STATUS_ICON = {
  open: Clock,
  reviewing: AlertTriangle,
  resolved: CheckCircle,
  rejected: XCircle,
};
const STATUS_COLOR = {
  open: "var(--gold)",
  reviewing: "var(--neon)",
  resolved: "var(--win)",
  rejected: "var(--muted)",
};

export function AdminEscalationsPage({ onNavigate }) {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState("open");
  const { data, loading, error, reload } = useAsync(
    () => listEscalationTickets(tab === "all" ? null : tab), [tab]
  );
  const [resolveTarget, setResolveTarget] = useState(null);

  if (!isAdmin) return <main className="page"><EmptyState icon={ShieldCheck} title="Admins only" /></main>;

  const tickets = data || [];
  const TABS = [
    { key: "open", label: "Open" },
    { key: "reviewing", label: "Reviewing" },
    { key: "resolved", label: "Resolved" },
    { key: "rejected", label: "Rejected" },
    { key: "all", label: "All" },
  ];

  return (
    <main className="page">
      <div className="pageHead">
        <div className="eyebrow">ADMIN</div>
        <h1>Escalation Tickets</h1>
        <p className="sub">Review and resolve player-submitted escalation tickets for cash matches.</p>
      </div>

      <div className="lbScopeTabs" style={{ marginBottom: 20, width: "fit-content" }}>
        {TABS.map(t => (
          <button
            key={t.key}
            className={`lbScopeTab ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <SkeletonRows rows={4} /> : error ? (
        <div className="errorState"><p>{error}</p><button className="btn btn-ghost sm" onClick={reload}>Retry</button></div>
      ) : tickets.length === 0 ? (
        <EmptyState icon={AlertTriangle} title={`No ${tab} tickets`}>
          {tab === "open" ? "All clear. No pending escalations." : "No tickets match this filter."}
        </EmptyState>
      ) : (
        <div className="escList">
          {tickets.map(t => {
            const Icon = STATUS_ICON[t.status] || Clock;
            return (
              <div key={t.id} className="escCard">
                <div className="escHead">
                  <Icon size={16} style={{ color: STATUS_COLOR[t.status] }} />
                  <span className="escStatus" style={{ color: STATUS_COLOR[t.status] }}>{t.status.toUpperCase()}</span>
                  <b className="escUser">{t.username}</b>
                  <span className="escMatch" {...clickable(() => onNavigate?.("match", t.match_id))}>
                    Match #{t.match_code || t.match_id.slice(0, 8)}
                  </span>
                  {t.match_entry > 0 && (
                    <span className="escEntry"><DollarSign size={12} /> {money(t.match_entry)}</span>
                  )}
                  {t.priority && <span style={{ background: "rgba(255,194,60,.15)", color: "var(--gold)", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 3 }}><Zap size={10} /> PRIORITY</span>}
                  <span className="escTime">{shortDate(t.created_at)}</span>
                </div>
                <p className="escReason">{t.reason}</p>
                {t.admin_notes && <p className="escNotes">Admin: {t.admin_notes}</p>}
                {t.status === "open" || t.status === "reviewing" ? (
                  <div className="escActions">
                    <Button size="sm" variant="primary" onClick={() => setResolveTarget(t)}>Resolve</Button>
                    <Button size="sm" variant="danger" onClick={async () => {
                      const res = await resolveEscalation(t.id, "rejected", "Rejected by admin.");
                      if (res.error) return toast.error(res.error);
                      toast.success("Ticket rejected."); reload();
                    }}>Reject</Button>
                    <Button size="sm" variant="ghost" onClick={() => onNavigate?.("match", t.match_id)}>View Match</Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {resolveTarget && (
        <ResolveModal
          ticket={resolveTarget}
          onClose={() => setResolveTarget(null)}
          onDone={() => { setResolveTarget(null); reload(); }}
        />
      )}
    </main>
  );
}

function ResolveModal({ ticket, onClose, onDone }) {
  const toast = useToast();
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleResolve(e) {
    e.preventDefault();
    setSaving(true);
    const res = await resolveEscalation(ticket.id, "resolved", notes.trim() || null);
    setSaving(false);
    if (res.error) return toast.error(res.error);
    toast.success("Ticket resolved. Player notified.");
    onDone();
  }

  return (
    <Modal open title="Resolve Escalation" onClose={onClose}>
      <form onSubmit={handleResolve} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>
          <b style={{ color: "var(--text)" }}>{ticket.username}</b> · Match #{ticket.match_code || ticket.match_id.slice(0, 8)}
        </div>
        <div style={{ fontSize: 13, color: "var(--text)", background: "var(--panel2)", padding: "10px 14px", borderRadius: 8 }}>
          {ticket.reason}
        </div>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em" }}>Resolution Notes</span>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Describe what action was taken..."
            rows={3}
            style={{ background: "var(--panel2)", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px", color: "var(--text)", fontSize: 14, resize: "vertical" }}
          />
        </label>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" loading={saving}>Resolve & Notify</Button>
        </div>
      </form>
    </Modal>
  );
}
