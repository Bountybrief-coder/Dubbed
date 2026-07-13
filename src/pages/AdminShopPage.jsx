import React, { useState, useCallback, useEffect } from "react";
import { ShieldCheck, Search, RotateCcw } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useToast } from "../hooks/useToast.jsx";
import { adminListShopPurchases, adminShopStats, adminRefundPurchase } from "../services/shopService";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { SkeletonRows } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { money, shortDate } from "../utils/format";

const FILTERS = ["all", "membership", "account_service"];
const STATUS_CLASS = { completed: "s-paid", pending: "s-pending", failed: "s-rejected", refunded: "s-rejected" };

export function AdminShopPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refundFor, setRefundFor] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, s] = await Promise.all([
      adminListShopPurchases(filter === "all" ? null : filter),
      adminShopStats()
    ]);
    if (p.error) toast.error(p.error);
    setRows(p.data);
    setStats(s.data);
    setLoading(false);
  }, [filter]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  if (!isAdmin) {
    return <main className="page"><EmptyState icon={ShieldCheck} title="Admins only">You don't have access to this page.</EmptyState></main>;
  }

  const filtered = rows.filter((r) =>
    !query.trim() || r.username?.toLowerCase().includes(query.toLowerCase()) || (r.transaction_id || "").includes(query)
  );

  return (
    <main className="page">
      <div className="pageHead"><div className="eyebrow">ADMIN</div><h1>Shop</h1><p className="sub">Purchases, memberships, username changes, stat resets, revenue and refunds. Everything here is auditable.</p></div>

      {stats && (
        <section className="wdStatGrid shopAdminStats">
          <div className="wdStat"><small>TOTAL REVENUE</small><b className="win">{money(stats.revenue_total)}</b><em>{stats.purchases_count} purchases</em></div>
          <div className="wdStat"><small>MEMBERSHIPS</small><b className="gold">{money(stats.revenue_memberships)}</b><em>{stats.active_members} active members</em></div>
          <div className="wdStat"><small>ACCOUNT SERVICES</small><b>{money(stats.revenue_services)}</b><em>{stats.username_changes} names · {stats.stat_resets} resets</em></div>
        </section>
      )}

      <div className="segRow inline">
        {FILTERS.map((f) => (
          <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>{f === "account_service" ? "services" : f}</button>
        ))}
      </div>

      <div className="navSearch adminSearch">
        <Search size={15} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search user or transaction id" />
      </div>

      {loading ? (
        <SkeletonRows rows={5} height={60} />
      ) : filtered.length === 0 ? (
        <EmptyState title="Nothing here">No purchases match this filter.</EmptyState>
      ) : (
        <div className="adminWdList">
          {filtered.map((p) => (
            <div className="adminWdRow" key={p.id}>
              <div className="adminWdMain">
                <b>{p.username}</b>
                <span className="adminWdAmount cash">{money(p.price)}</span>
                <span className="badge">{p.item_name}</span>
                <span className={`statusChip ${STATUS_CLASS[p.status] || "s-pending"}`}>{p.status}</span>
              </div>
              <div className="adminWdMeta">
                <span>{shortDate(p.created_at)}</span>
                <span className="badge">{p.payment_method}</span>
                <small className="txId">#{(p.transaction_id || p.id).slice(0, 8)}</small>
              </div>
              {p.status === "completed" && (
                <div className="adminWdActions">
                  <Button variant="ghost" className="sm" onClick={() => setRefundFor(p)}><RotateCcw size={13} /> Refund</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {refundFor && <RefundModal p={refundFor} onClose={() => setRefundFor(null)} onDone={load} />}
    </main>
  );

  function RefundModal({ p, onClose, onDone }) {
    const [toWallet, setToWallet] = useState(p.payment_method === "wallet");
    const [busy, setBusy] = useState(false);
    return (
      <Modal open onClose={onClose} eyebrow="REFUND" title={`Refund ${p.username}'s ${p.item_name}`} size="sm">
        <p className="modalNote">
          {p.payment_method === "crypto"
            ? "This was paid with crypto. Crypto payments cannot be auto-refunded — issue a manual refund if needed. This action marks it refunded and reverses the entitlement here."
            : "Refund the wallet charge back to the user's balance and reverse the entitlement."}
        </p>
        {p.payment_method === "wallet" && (
          <label className="chkRow"><input type="checkbox" checked={toWallet} onChange={(e) => setToWallet(e.target.checked)} /> Credit {money(p.price)} back to wallet</label>
        )}
        <Button variant="danger" className="wide" loading={busy} onClick={async () => {
          setBusy(true);
          const res = await adminRefundPurchase(p.id, p.payment_method === "wallet" ? toWallet : false);
          setBusy(false);
          if (res.error) return toast.error(res.error);
          toast.success("Purchase refunded.");
          onDone(); onClose();
        }}>Confirm refund</Button>
      </Modal>
    );
  }
}
