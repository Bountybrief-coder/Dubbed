import React, { useState, useCallback, useEffect } from "react";
import { ShieldCheck, Search, Award, XCircle, Dice5 } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useToast } from "../hooks/useToast.jsx";
import { supabase } from "../lib/supabase";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { SkeletonRows } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { money, shortDate } from "../utils/format";

const FILTERS = ["matched", "open", "settled", "void", "all"];

export function AdminSideBetsPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [filter, setFilter] = useState("matched");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settleFor, setSettleFor] = useState(null);
  const [voidFor, setVoidFor] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("side_bets").select("*").order("created_at", { ascending: false }).limit(200);
    if (filter !== "all") q = q.eq("status", filter);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows(data || []);
    setLoading(false);
  }, [filter]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  if (!isAdmin) return <main className="page"><EmptyState icon={ShieldCheck} title="Admins only" /></main>;

  const filtered = rows.filter((r) =>
    !query.trim() ||
    r.proposer_name?.toLowerCase().includes(query.toLowerCase()) ||
    r.acceptor_name?.toLowerCase().includes(query.toLowerCase()) ||
    r.pick_a?.toLowerCase().includes(query.toLowerCase()) ||
    r.pick_b?.toLowerCase().includes(query.toLowerCase())
  );

  const matchedCount = rows.filter((r) => r.status === "matched").length;

  return (
    <main className="page">
      <div className="pageHead">
        <div className="eyebrow">ADMIN</div>
        <h1><Dice5 size={24} /> Side Bets</h1>
        <p className="sub">
          Settle matched bets, void unfair ones, and monitor activity.
          {matchedCount > 0 && <strong style={{ color: "var(--gold)", marginLeft: 8 }}>{matchedCount} awaiting settlement</strong>}
        </p>
      </div>

      <div className="segRow inline">
        {FILTERS.map((f) => (
          <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
            {f}{f === "matched" && matchedCount > 0 ? ` (${matchedCount})` : ""}
          </button>
        ))}
      </div>

      <div className="navSearch adminSearch">
        <Search size={15} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search player or pick" />
      </div>

      {loading ? <SkeletonRows rows={4} height={90} /> : filtered.length === 0 ? (
        <EmptyState title="No side bets">Nothing matches this filter.</EmptyState>
      ) : (
        <div className="adminWdList">
          {filtered.map((b) => (
            <div className="adminWdRow" key={b.id}>
              <div className="adminWdMain">
                <b>{b.proposer_name}</b>
                <span className="betPick">{b.pick_a}</span>
                {b.acceptor_name && (
                  <>
                    <span style={{ color: "var(--muted)", margin: "0 4px" }}>vs</span>
                    <b>{b.acceptor_name}</b>
                    <span className="betPick">{b.pick_b}</span>
                  </>
                )}
                <span className={`statusChip ${b.status === "matched" ? "s-pending" : b.status === "settled" ? "s-paid" : b.status === "open" ? "s-active" : "s-rejected"}`}>
                  {b.status}
                </span>
              </div>
              <div className="adminWdMeta">
                <span>Market: {b.market === "cdl" ? "CDL" : "Streamer"}</span>
                <span>Stake: {money(b.stake)} each · Pot: {money(b.stake * 2)}</span>
                <span>{shortDate(b.created_at)}</span>
                {b.winner_id && <span>Winner: {b.winner_id === b.proposer_id ? b.proposer_name : b.acceptor_name}</span>}
              </div>
              {b.status === "matched" && (
                <div className="adminWdActions">
                  <Button variant="primary" className="sm" onClick={() => setSettleFor({ ...b, awardTo: "proposer" })}>
                    <Award size={13} /> {b.proposer_name} wins
                  </Button>
                  <Button variant="primary" className="sm" onClick={() => setSettleFor({ ...b, awardTo: "acceptor" })}>
                    <Award size={13} /> {b.acceptor_name} wins
                  </Button>
                  <Button variant="ghost" className="sm" onClick={() => setVoidFor(b)}>
                    <XCircle size={13} /> Void
                  </Button>
                </div>
              )}
              {b.status === "open" && (
                <div className="adminWdActions">
                  <Button variant="ghost" className="sm" onClick={() => setVoidFor(b)}>
                    <XCircle size={13} /> Void & refund
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {settleFor && <SettleModal bet={settleFor} onClose={() => setSettleFor(null)} onDone={load} />}
      {voidFor && <VoidModal bet={voidFor} onClose={() => setVoidFor(null)} onDone={load} />}
    </main>
  );

  function SettleModal({ bet, onClose, onDone }) {
    const [busy, setBusy] = useState(false);
    const winnerName = bet.awardTo === "proposer" ? bet.proposer_name : bet.acceptor_name;
    const winnerId = bet.awardTo === "proposer" ? bet.proposer_id : bet.acceptor_id;
    const pot = bet.stake * 2;
    const rake = Math.max(pot * 0.05, 0.25);
    const payout = pot - (rake >= pot ? 0 : rake);

    return (
      <Modal open onClose={onClose} eyebrow="SETTLE SIDE BET" title={`Award win to ${winnerName}?`} size="sm">
        <div className="breakBox" style={{ margin: "12px 0" }}>
          <div><span>Pot</span><b>{money(pot)}</b></div>
          <div><span>Platform rake (5%)</span><b>{money(rake >= pot ? 0 : rake)}</b></div>
          <div><span>Winner payout</span><b style={{ color: "var(--gold)" }}>{money(payout)}</b></div>
        </div>
        <p className="modalNote">{winnerName} picked <b>{bet.awardTo === "proposer" ? bet.pick_a : bet.pick_b}</b>. The loser's stake goes to the pot.</p>
        <Button variant="primary" className="wide" loading={busy} onClick={async () => {
          setBusy(true);
          const { error } = await supabase.rpc("settle_side_bet", { p_bet: bet.id, p_winner_id: winnerId });
          setBusy(false);
          if (error) return toast.error(error.message);
          toast.success(`${winnerName} wins ${money(payout)}!`);
          onDone(); onClose();
        }}>Award win to {winnerName}</Button>
      </Modal>
    );
  }

  function VoidModal({ bet, onClose, onDone }) {
    const [busy, setBusy] = useState(false);
    return (
      <Modal open onClose={onClose} eyebrow="VOID SIDE BET" title="Void this bet?" size="sm">
        <p className="modalNote">Both players get their {money(bet.stake)} stake refunded. The bet is marked void.</p>
        <Button variant="danger" className="wide" loading={busy} onClick={async () => {
          setBusy(true);
          const { error } = await supabase.rpc("void_side_bet", { p_bet: bet.id });
          setBusy(false);
          if (error) return toast.error(error.message);
          toast.success("Bet voided, stakes refunded.");
          onDone(); onClose();
        }}>Void & refund</Button>
      </Modal>
    );
  }
}
