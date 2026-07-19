import React, { useState, useCallback, useEffect } from "react";
import { clickable } from "../utils/a11y";
import { ShieldCheck, Search, Award, XCircle, Dice5, Plus, Lock, Trophy, Clock } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useToast } from "../hooks/useToast.jsx";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { SkeletonRows } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { money, shortDate } from "../utils/format";
import {
  getBetEvents, createBetEvent, lockBetEvent, settleBetEvent, voidBetEvent
} from "../services/chatService";
import { getAllOffers, settleBetOffer, voidBetOffer } from "../services/p2pBetService";
import { supabase } from "../lib/supabase";

const FILTERS = ["open", "locked", "settled", "void", "all"];
const CDL_TEAMS = [
  "Boston Breach", "Carolina Royal Ravens", "Cloud9 New York",
  "FaZe Vegas", "G2 Minnesota", "Los Angeles Thieves",
  "Miami Heretics", "OpTic Texas", "Paris Gentle Mates",
  "Riyadh Falcons", "Toronto KOI", "Vancouver Surge",
];

export function AdminSideBetsPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState("pool");
  const [filter, setFilter] = useState("open");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [settleFor, setSettleFor] = useState(null);
  const [voidFor, setVoidFor] = useState(null);

  // P2P state
  const [p2pFilter, setP2pFilter] = useState("matched");
  const [p2pRows, setP2pRows] = useState([]);
  const [p2pLoading, setP2pLoading] = useState(false);
  const [p2pSettleFor, setP2pSettleFor] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const status = filter === "all" ? null : filter;
    const { data } = await getBetEvents(status);
    setRows(data);
    setLoading(false);
  }, [filter]);

  const loadP2p = useCallback(async () => {
    setP2pLoading(true);
    const status = p2pFilter === "all" ? null : p2pFilter;
    const { data } = await getAllOffers(status);
    setP2pRows(data);
    setP2pLoading(false);
  }, [p2pFilter]);

  useEffect(() => { if (mode === "pool") load(); else loadP2p(); }, [mode, load, loadP2p]);

  if (!isAdmin) return <main className="page"><EmptyState icon={ShieldCheck} title="Admins only" /></main>;

  const filtered = rows.filter((r) =>
    !query.trim() || r.title?.toLowerCase().includes(query.toLowerCase())
  );
  const openCount = rows.filter((r) => r.status === "open").length;
  const lockedCount = rows.filter((r) => r.status === "locked").length;
  const p2pMatchedCount = p2pRows.filter((r) => r.status === "matched").length;

  return (
    <main className="page">
      <div className="pageHead rowHead">
        <div>
          <div className="eyebrow">ADMIN</div>
          <h1><Dice5 size={24} /> Bet Management</h1>
          <p className="sub">
            {mode === "pool" ? "Pool events: create, lock, settle." : `P2P offers: settle matched bets.`}
            {mode === "pool" && lockedCount > 0 && <strong style={{ color: "var(--gold)", marginLeft: 8 }}>{lockedCount} awaiting settlement</strong>}
            {mode === "p2p" && p2pMatchedCount > 0 && <strong style={{ color: "var(--gold)", marginLeft: 8 }}>{p2pMatchedCount} awaiting settlement</strong>}
          </p>
        </div>
        {mode === "pool" && (
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus size={16} /> New Event
          </Button>
        )}
      </div>

      <div className="segRow inline" style={{ marginBottom: 12 }}>
        <button className={mode === "pool" ? "on" : ""} onClick={() => setMode("pool")}>Pool Events</button>
        <button className={mode === "p2p" ? "on" : ""} onClick={() => setMode("p2p")}>P2P Offers{p2pMatchedCount > 0 ? ` (${p2pMatchedCount})` : ""}</button>
      </div>

      {mode === "pool" && (
        <>
          <div className="segRow inline">
            {FILTERS.map((f) => (
              <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
                {f}{f === "open" && openCount > 0 ? ` (${openCount})` : f === "locked" && lockedCount > 0 ? ` (${lockedCount})` : ""}
              </button>
            ))}
          </div>

          <div className="navSearch adminSearch">
            <Search size={15} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search events" />
          </div>

          {loading ? <SkeletonRows rows={4} height={90} /> : filtered.length === 0 ? (
            <EmptyState title="No events">Nothing matches this filter.</EmptyState>
          ) : (
            <div className="adminWdList">
              {filtered.map((ev) => (
                <EventRow key={ev.id} ev={ev} onSettle={setSettleFor} onVoid={setVoidFor} onLock={async () => {
                  const { error } = await lockBetEvent(ev.id);
                  if (error) toast.error(error); else { toast.success("Event locked."); load(); }
                }} />
              ))}
            </div>
          )}

          {createOpen && <CreateEventModal onClose={() => setCreateOpen(false)} onDone={load} toast={toast} />}
          {settleFor && <SettleModal ev={settleFor} onClose={() => setSettleFor(null)} onDone={load} toast={toast} />}
          {voidFor && <VoidModal ev={voidFor} onClose={() => setVoidFor(null)} onDone={load} toast={toast} />}
        </>
      )}

      {mode === "p2p" && (
        <>
          <div className="segRow inline">
            {["matched", "open", "settled", "void", "all"].map((f) => (
              <button key={f} className={p2pFilter === f ? "on" : ""} onClick={() => setP2pFilter(f)}>{f}</button>
            ))}
          </div>

          {p2pLoading ? <SkeletonRows rows={4} height={90} /> : p2pRows.length === 0 ? (
            <EmptyState title="No P2P offers">Nothing matches this filter.</EmptyState>
          ) : (
            <div className="adminWdList">
              {p2pRows.map((off) => (
                <P2POfferRow key={off.id} offer={off} onSettle={setP2pSettleFor} onVoid={async () => {
                  const { error } = await voidBetOffer(off.id);
                  if (error) toast.error(error); else { toast.success("Offer voided, stakes refunded."); loadP2p(); }
                }} />
              ))}
            </div>
          )}

          {p2pSettleFor && <P2PSettleModal offer={p2pSettleFor} onClose={() => setP2pSettleFor(null)} onDone={loadP2p} toast={toast} />}
        </>
      )}
    </main>
  );
}

function P2POfferRow({ offer, onSettle, onVoid }) {
  return (
    <div className="adminWdRow">
      <div className="adminWdMain">
        <b>{offer.event_ref}</b>
        <span className={`statusChip ${offer.status === "open" ? "s-active" : offer.status === "matched" ? "s-pending" : offer.status === "settled" ? "s-paid" : "s-rejected"}`}>
          {offer.status}
        </span>
        <span style={{ color: "var(--muted)", fontSize: 12 }}>{money(offer.stake)} each</span>
      </div>
      <div className="adminWdMeta">
        <span>Creator: {offer.creator?.username || "?"} · "{offer.creator_pick}"</span>
        {offer.acceptor?.username && <span>Acceptor: {offer.acceptor.username}</span>}
        <span>{offer.section} · {offer.market}</span>
        {offer.winner_pick && <span><Trophy size={11} /> Winner: {offer.winner_pick}</span>}
      </div>
      <div className="adminWdActions">
        {offer.status === "matched" && (
          <>
            <Button variant="primary" className="sm" onClick={() => onSettle(offer)}>
              <Award size={13} /> Settle
            </Button>
            <Button variant="ghost" className="sm" onClick={onVoid}>
              <XCircle size={13} /> Void
            </Button>
          </>
        )}
        {offer.status === "open" && (
          <Button variant="ghost" className="sm" onClick={onVoid}>
            <XCircle size={13} /> Void
          </Button>
        )}
      </div>
    </div>
  );
}

function P2PSettleModal({ offer, onClose, onDone, toast }) {
  const [winner, setWinner] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Modal open onClose={onClose} eyebrow="SETTLE P2P BET" title={`Settle: ${offer.event_ref}`} size="sm">
      <div style={{ marginBottom: 12 }}>
        <p style={{ color: "var(--muted)", fontSize: 13 }}>
          <strong>{offer.creator?.username}</strong> picked "{offer.creator_pick}" · <strong>{offer.acceptor?.username}</strong> took the other side.
          <br />Pot: {money(offer.stake * 2)} (each put up {money(offer.stake)}).
        </p>
      </div>
      <label className="fieldLbl">Who won?</label>
      <div className="chipRow wrap" style={{ marginBottom: 12 }}>
        <button className={winner === "creator" ? "on" : ""} onClick={() => setWinner("creator")}>
          {offer.creator?.username || "Creator"} (posted)
        </button>
        <button className={winner === "acceptor" ? "on" : ""} onClick={() => setWinner("acceptor")}>
          {offer.acceptor?.username || "Acceptor"}
        </button>
      </div>
      <Button variant="primary" className="wide" loading={busy} disabled={!winner} onClick={async () => {
        setBusy(true);
        const { error } = await settleBetOffer(offer.id, winner);
        setBusy(false);
        if (error) return toast.error(error);
        toast.success(`Settled! ${winner === "creator" ? offer.creator?.username : offer.acceptor?.username} wins.`);
        onDone(); onClose();
      }}>Settle · {winner ? (winner === "creator" ? offer.creator?.username : offer.acceptor?.username) : "..."} wins</Button>
    </Modal>
  );
}

function EventRow({ ev, onSettle, onVoid, onLock }) {
  const options = Array.isArray(ev.options) ? ev.options : [];
  const [betCount, setBetCount] = useState(null);

  useEffect(() => {
    supabase.from("side_bets").select("id", { count: "exact", head: true }).eq("event_id", ev.id)
      .then(({ count }) => setBetCount(count || 0));
  }, [ev.id]);

  return (
    <div className="adminWdRow">
      <div className="adminWdMain">
        <b>{ev.title}</b>
        <span className={`statusChip ${ev.status === "open" ? "s-active" : ev.status === "locked" ? "s-pending" : ev.status === "settled" ? "s-paid" : "s-rejected"}`}>
          {ev.status}
        </span>
        {betCount !== null && <span style={{ color: "var(--muted)", fontSize: 12 }}>{betCount} bet{betCount !== 1 ? "s" : ""}</span>}
      </div>
      <div className="adminWdMeta">
        <span>Market: {ev.market === "cdl" ? "CDL" : "Streamer"} · {ev.odds}x odds</span>
        <span>Options: {options.join(", ")}</span>
        <span>{shortDate(ev.created_at)}</span>
        {ev.locks_at && <span><Clock size={11} /> Locks: {new Date(ev.locks_at).toLocaleString()}</span>}
        {ev.winner_option && <span><Trophy size={11} /> Winner: {ev.winner_option}</span>}
      </div>
      <div className="adminWdActions">
        {ev.status === "open" && (
          <Button variant="ghost" className="sm" onClick={onLock}><Lock size={13} /> Lock</Button>
        )}
        {(ev.status === "open" || ev.status === "locked") && (
          <>
            <Button variant="primary" className="sm" onClick={() => onSettle(ev)}>
              <Award size={13} /> Settle
            </Button>
            <Button variant="ghost" className="sm" onClick={() => onVoid(ev)}>
              <XCircle size={13} /> Void
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function CreateEventModal({ onClose, onDone, toast }) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [market, setMarket] = useState("cdl");
  const [options, setOptions] = useState([]);
  const [customOption, setCustomOption] = useState("");
  const [odds, setOdds] = useState("2.0");
  const [locksAt, setLocksAt] = useState("");
  const [busy, setBusy] = useState(false);

  function addOption(opt) {
    if (opt && !options.includes(opt)) setOptions([...options, opt]);
  }

  async function submit() {
    if (!title.trim()) return toast.error("Title required.");
    if (options.length < 2) return toast.error("Need at least 2 options.");
    setBusy(true);
    const { error } = await createBetEvent(
      title.trim(), desc.trim(), market, options,
      parseFloat(odds) || 2.0, locksAt || null
    );
    setBusy(false);
    if (error) return toast.error(error);
    toast.success("Event created!");
    onDone();
    onClose();
  }

  return (
    <Modal open onClose={onClose} eyebrow="NEW EVENT" title="Create Bet Event" size="md">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label className="fieldLbl">Title</label>
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. CDL Major 3 Grand Final" />
        </div>
        <div>
          <label className="fieldLbl">Description <small className="lblHint">(optional)</small></label>
          <input className="field" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Who wins the series?" />
        </div>
        <div>
          <label className="fieldLbl">Market</label>
          <div className="chipRow">
            <button className={market === "cdl" ? "on" : ""} onClick={() => { setMarket("cdl"); setOptions([]); }}>CDL</button>
            <button className={market === "streamer" ? "on" : ""} onClick={() => { setMarket("streamer"); setOptions([]); }}>Streamer</button>
          </div>
        </div>
        <div>
          <label className="fieldLbl">Options ({options.length})</label>
          {market === "cdl" ? (
            <div className="chipRow wrap">
              {CDL_TEAMS.map((t) => (
                <button key={t} className={options.includes(t) ? "on" : ""} onClick={() => {
                  setOptions((o) => o.includes(t) ? o.filter((x) => x !== t) : [...o, t]);
                }}>{t}</button>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", gap: 6 }}>
              <input className="field sm" value={customOption} onChange={(e) => setCustomOption(e.target.value)} placeholder="Add option" onKeyDown={(e) => { if (e.key === "Enter") { addOption(customOption.trim()); setCustomOption(""); } }} />
              <button className="btn btn-ghost sm" onClick={() => { addOption(customOption.trim()); setCustomOption(""); }}>Add</button>
            </div>
          )}
          {options.length > 0 && (
            <div className="chipRow wrap" style={{ marginTop: 6 }}>
              {options.map((o) => (
                <span key={o} className="badge" {...clickable(() => setOptions((ops) => ops.filter((x) => x !== o)))}>{o} ×</span>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label className="fieldLbl">Odds multiplier</label>
            <input className="field" type="number" step="0.1" min="1.1" value={odds} onChange={(e) => setOdds(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="fieldLbl">Auto-lock at <small className="lblHint">(optional)</small></label>
            <input className="field" type="datetime-local" value={locksAt} onChange={(e) => setLocksAt(e.target.value)} />
          </div>
        </div>
        <Button variant="primary" className="wide" loading={busy} onClick={submit}>Create Event</Button>
      </div>
    </Modal>
  );
}

function SettleModal({ ev, onClose, onDone, toast }) {
  const [winner, setWinner] = useState("");
  const [busy, setBusy] = useState(false);
  const options = Array.isArray(ev.options) ? ev.options : [];

  return (
    <Modal open onClose={onClose} eyebrow="SETTLE EVENT" title={`Settle: ${ev.title}`} size="sm">
      <label className="fieldLbl">Pick the winner</label>
      <div className="chipRow wrap" style={{ marginBottom: 12 }}>
        {options.map((o) => (
          <button key={o} className={winner === o ? "on" : ""} onClick={() => setWinner(o)}>{o}</button>
        ))}
      </div>
      <p className="modalNote">Winners get stake × {ev.odds} minus 5% rake on profit (WAGR members exempt). Losers lose their stake.</p>
      <Button variant="primary" className="wide" loading={busy} disabled={!winner} onClick={async () => {
        setBusy(true);
        const { error } = await settleBetEvent(ev.id, winner);
        setBusy(false);
        if (error) return toast.error(error);
        toast.success(`Settled! ${winner} wins.`);
        onDone(); onClose();
      }}>Settle · {winner || "..."} wins</Button>
    </Modal>
  );
}

function VoidModal({ ev, onClose, onDone, toast }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal open onClose={onClose} eyebrow="VOID EVENT" title={`Void: ${ev.title}?`} size="sm">
      <p className="modalNote">All bets on this event will be refunded. This cannot be undone.</p>
      <Button variant="danger" className="wide" loading={busy} onClick={async () => {
        setBusy(true);
        const { error } = await voidBetEvent(ev.id);
        setBusy(false);
        if (error) return toast.error(error);
        toast.success("Event voided, all stakes refunded.");
        onDone(); onClose();
      }}>Void & Refund All</Button>
    </Modal>
  );
}
