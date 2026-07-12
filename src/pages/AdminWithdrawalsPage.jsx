import React, { useState, useCallback, useEffect } from "react";
import { ShieldCheck, Search, Check, X, Send, ExternalLink, ToggleLeft, ToggleRight } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useToast } from "../hooks/useToast.jsx";
import {
  adminListWithdrawals, adminMarkProcessing, adminApproveWithdrawal, adminRejectWithdrawal,
  adminGetAutoPayoutsEnabled, adminToggleAutoPayouts
} from "../services/walletService";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { SkeletonRows } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { money, shortDate } from "../utils/format";

const FILTERS = ["all", "pending", "processing", "paid", "rejected"];
const STATUS_CLASS = { pending: "s-pending", processing: "s-pending", approved: "s-pending", paid: "s-paid", rejected: "s-rejected" };

export function AdminWithdrawalsPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [filter, setFilter] = useState("pending");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectFor, setRejectFor] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [autoOn, setAutoOn] = useState(null);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await adminListWithdrawals(filter === "all" ? null : filter);
    if (error) toast.error(error);
    setRows(data || []);
    setLoading(false);
  }, [filter]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);
  useEffect(() => { adminGetAutoPayoutsEnabled().then(r => setAutoOn(r.enabled)); }, []);

  if (!isAdmin) {
    return <main className="page"><EmptyState icon={ShieldCheck} title="Admins only">You don't have access to this page.</EmptyState></main>;
  }

  const filtered = rows.filter((r) =>
    !query.trim() || r.username?.toLowerCase().includes(query.toLowerCase()) || (r.transaction_id || "").includes(query)
  );

  async function process(id) {
    setBusyId(id);
    const res = await adminMarkProcessing(id);
    setBusyId(null);
    if (res.error) return toast.error(res.error);
    toast.success("Marked processing.");
    load();
  }

  async function approve(id) {
    setBusyId(id);
    const res = await adminApproveWithdrawal(id);
    setBusyId(null);
    if (res.error) return toast.error(res.error);
    toast.success("Payout sent to Stripe. It'll flip to paid on confirmation.");
    load();
  }

  return (
    <main className="page">
      <div className="pageHead"><div className="eyebrow">ADMIN</div><h1>Withdrawals</h1><p className="sub">Review, approve and pay out withdrawal requests. Every action is logged and reflected in the user's balance server-side.</p></div>

      <div className="adminAutoToggle">
        <span>Auto-payouts</span>
        <Button variant={autoOn ? "primary" : "ghost"} className="sm" loading={toggling} onClick={async () => {
          setToggling(true);
          const next = !autoOn;
          const res = await adminToggleAutoPayouts(next);
          setToggling(false);
          if (res.error) return toast.error(res.error);
          setAutoOn(next);
          toast.success(next ? "Auto-payouts enabled." : "Auto-payouts paused — all withdrawals need manual approval.");
        }}>
          {autoOn ? <><ToggleRight size={15} /> Enabled</> : <><ToggleLeft size={15} /> Paused</>}
        </Button>
        <small className="subtle">≤$500, trusted users auto-approved. Kill switch pauses all auto-approvals.</small>
      </div>

      <div className="segRow inline">
        {FILTERS.map((f) => (
          <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      <div className="navSearch adminSearch">
        <Search size={15} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search user or transaction id" />
      </div>

      {loading ? (
        <SkeletonRows rows={5} height={64} />
      ) : filtered.length === 0 ? (
        <EmptyState title="Nothing here">No withdrawals match this filter.</EmptyState>
      ) : (
        <div className="adminWdList">
          {filtered.map((w) => (
            <div className="adminWdRow" key={w.id}>
              <div className="adminWdMain">
                <b>{w.username}</b>
                <span className="adminWdAmount cash">{money(w.amount)}</span>
                <span className={`statusChip ${STATUS_CLASS[w.status] || "s-pending"}`}>{w.status}</span>
              </div>
              <div className="adminWdMeta">
                <span>Requested {shortDate(w.created_at)}</span>
                {w.meta?.auto_approved && <span className="statusChip s-paid" style={{ fontSize: 10 }}>auto-approved</span>}
                {w.meta?.auto_approved === false && <span className="statusChip s-pending" style={{ fontSize: 10 }}>held: {w.meta?.hold_reason || "review"}</span>}
                <span className={`statusChip ${w.stripe_payouts_enabled ? "s-paid" : "s-pending"}`}>Stripe {w.stripe_payouts_enabled ? "ready" : w.stripe_verification_status || "incomplete"}</span>
                {w.suspended && <span className="statusChip s-rejected">suspended</span>}
                {w.payout_id && <a className="txId" href={`https://dashboard.stripe.com/payouts/${w.payout_id}`} target="_blank" rel="noreferrer">{w.payout_id} <ExternalLink size={11} /></a>}
                <small className="txId">#{(w.transaction_id || w.id).slice(0, 8)}</small>
              </div>
              {(w.status === "pending" || w.status === "processing") && (
                <div className="adminWdActions">
                  {w.status === "pending" && (
                    <Button variant="ghost" className="sm" loading={busyId === w.id} onClick={() => process(w.id)}>Mark processing</Button>
                  )}
                  <Button variant="primary" className="sm" loading={busyId === w.id} disabled={!w.stripe_payouts_enabled} onClick={() => approve(w.id)}><Send size={13} /> Approve & pay</Button>
                  <Button variant="danger" className="sm" onClick={() => setRejectFor(w)}><X size={13} /> Reject</Button>
                </div>
              )}
              {w.status === "rejected" && w.rejected_reason && <div className="adminWdReason">{w.rejected_reason}</div>}
            </div>
          ))}
        </div>
      )}

      {rejectFor && <RejectModal w={rejectFor} onClose={() => setRejectFor(null)} onDone={load} />}
    </main>
  );

  function RejectModal({ w, onClose, onDone }) {
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    return (
      <Modal open onClose={onClose} eyebrow="REJECT WITHDRAWAL" title={`Reject ${w.username}'s ${money(w.amount)}`} size="sm">
        <p className="modalNote">The held funds are returned to the user's available balance and they're notified with this reason.</p>
        <label className="fieldLbl">Reason</label>
        <textarea className="field area" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Stripe verification incomplete" />
        <Button variant="danger" className="wide" loading={busy} onClick={async () => {
          if (!reason.trim()) return toast.error("Add a reason.");
          setBusy(true);
          const res = await adminRejectWithdrawal(w.id, reason.trim());
          setBusy(false);
          if (res.error) return toast.error(res.error);
          toast.success("Rejected and refunded.");
          onDone(); onClose();
        }}>Reject & refund</Button>
      </Modal>
    );
  }
}
