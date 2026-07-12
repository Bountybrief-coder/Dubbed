import React, { useState, useEffect, useCallback } from "react";
import { Swords, Plus, X, Check, Clock, Trophy, AlertCircle } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useAsync } from "../hooks/useAsync.js";
import { useVisibilityRefresh } from "../hooks/useVisibilityRefresh";
import { EmptyState } from "../components/EmptyState";
import { SkeletonRows } from "../components/Skeleton";
import { Button } from "../components/Button";
import { getOpenOffers, getMyOffers, createBetOffer, acceptBetOffer, cancelBetOffer, subscribeToBetOffers } from "../services/p2pBetService";
import { track } from "../utils/analytics";

const MARKETS = [
  { value: "match_winner", label: "Match Winner" },
  { value: "map_count", label: "Map Count (Over/Under)" },
  { value: "first_blood", label: "First Blood" },
  { value: "ace", label: "Gets an Ace" },
  { value: "clutch", label: "Clutch Round" },
  { value: "custom", label: "Custom" },
];

const STAKE_PRESETS = [1, 5, 10, 25, 50, 100];

function timeAgo(ts) {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function StatusBadge({ status }) {
  const cls = { open: "betBadge open", matched: "betBadge matched", settled: "betBadge settled", void: "betBadge voided" };
  return <span className={cls[status] || "betBadge"}>{status}</span>;
}

function OfferCard({ offer, userId, onAccept, onCancel, accepting }) {
  const isMine = offer.creator_id === userId;
  const isAcceptor = offer.acceptor_id === userId;
  const canAccept = offer.status === "open" && !isMine && userId;
  const canCancel = offer.status === "open" && isMine;

  return (
    <div className={`betOfferCard${offer.status === "matched" ? " matched" : ""}`}>
      <div className="betOfferTop">
        <div className="betOfferEvent">
          <span className="betOfferRef">{offer.event_ref}</span>
          <span className="betOfferMarket">{MARKETS.find(m => m.value === offer.market)?.label || offer.market}</span>
        </div>
        <StatusBadge status={offer.status} />
      </div>

      <div className="betOfferBody">
        <div className="betOfferSide">
          <small>Posted by</small>
          <strong>{offer.creator?.username || "—"}</strong>
          <span className="betOfferPick">"{offer.creator_pick}"</span>
        </div>
        <div className="betOfferVs">
          <span className="betOfferStake">${Number(offer.stake).toFixed(2)}</span>
          <Swords size={16} />
          <span className="betOfferStake">${Number(offer.stake).toFixed(2)}</span>
        </div>
        <div className="betOfferSide">
          <small>{offer.status === "open" ? "Waiting for opponent" : "Accepted by"}</small>
          <strong>{offer.acceptor?.username || "???"}</strong>
          {offer.winner_pick && <span className="betOfferPick winner">{offer.winner_pick === "creator" ? "Creator won" : "Acceptor won"}</span>}
        </div>
      </div>

      <div className="betOfferFoot">
        <span className="betOfferTime"><Clock size={12} /> {timeAgo(offer.created_at)}</span>
        {canAccept && (
          <button className="btn btn-primary" onClick={() => onAccept(offer.id)} disabled={accepting}>
            <Check size={14} /> Accept — ${Number(offer.stake).toFixed(2)}
          </button>
        )}
        {canCancel && (
          <button className="btn btn-ghost" onClick={() => onCancel(offer.id)}>
            <X size={14} /> Cancel
          </button>
        )}
        {isMine && offer.status !== "open" && <span className="betOfferMine">Your bet</span>}
        {isAcceptor && <span className="betOfferMine">You accepted</span>}
      </div>
    </div>
  );
}

function CreateOfferForm({ onCreated, onClose }) {
  const [eventRef, setEventRef] = useState("");
  const [market, setMarket] = useState("match_winner");
  const [pick, setPick] = useState("");
  const [stake, setStake] = useState("");
  const [customMarket, setCustomMarket] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    const s = parseFloat(stake);
    if (!eventRef.trim()) return setErr("Enter a streamer or event name.");
    if (!pick.trim()) return setErr("Enter your pick / prediction.");
    if (!s || s <= 0 || s > 100) return setErr("Stake must be $0.01 — $100.");
    setBusy(true);
    const m = market === "custom" ? customMarket.trim() || "custom" : market;
    const { error } = await createBetOffer("streamer", eventRef.trim(), m, pick.trim(), s, null);
    setBusy(false);
    if (error) return setErr(error);
    track.betPost(s);
    onCreated();
  }

  return (
    <form className="betCreateForm" onSubmit={handleSubmit}>
      <h3><Plus size={16} /> Post a Bet</h3>

      <label>Streamer / Event</label>
      <input type="text" placeholder='e.g. "Scump", "OpTic scrims"' value={eventRef} onChange={e => setEventRef(e.target.value)} maxLength={80} />

      <label>Market</label>
      <select value={market} onChange={e => setMarket(e.target.value)}>
        {MARKETS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
      </select>
      {market === "custom" && (
        <input type="text" placeholder="Describe the bet…" value={customMarket} onChange={e => setCustomMarket(e.target.value)} maxLength={100} />
      )}

      <label>Your Pick</label>
      <input type="text" placeholder='e.g. "Scump wins", "Over 3 maps"' value={pick} onChange={e => setPick(e.target.value)} maxLength={80} />

      <label>Stake</label>
      <div className="betStakeRow">
        <input type="number" step="0.01" min="0.01" max="100" placeholder="0.00" value={stake} onChange={e => setStake(e.target.value)} />
        <div className="betStakePresets">
          {STAKE_PRESETS.map(p => (
            <button type="button" key={p} className="btn btn-ghost betStakeChip" onClick={() => setStake(String(p))}>${p}</button>
          ))}
        </div>
      </div>

      {err && <p className="betErr"><AlertCircle size={14} /> {err}</p>}

      <div className="betFormActions">
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Posting…" : "Post Bet"}</button>
      </div>
    </form>
  );
}

const TABS = [
  { key: "streamer", label: "Streamer Bets" },
  { key: "cdl", label: "CDL Matches" },
  { key: "my", label: "My Bets" },
];

export function BettingPage({ onLogin }) {
  const { user, profile } = useAuth();
  const [tab, setTab] = useState("streamer");
  const [showCreate, setShowCreate] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const loadOffers = useCallback(() => {
    if (tab === "my" && user) return getMyOffers(user.id);
    if (tab === "cdl") return getOpenOffers("cdl");
    return getOpenOffers("streamer");
  }, [tab, user]);

  const { data: offers, loading, error, reload: refetch } = useAsync(loadOffers, [tab, user?.id]);

  useVisibilityRefresh(refetch, [tab]);

  useEffect(() => {
    const unsub = subscribeToBetOffers(() => refetch());
    return unsub;
  }, [refetch]);

  async function handleAccept(offerId) {
    if (!user) return onLogin?.();
    setAccepting(true);
    const { error } = await acceptBetOffer(offerId);
    setAccepting(false);
    if (error) { alert(error); return; }
    track.betAccept(0);
    refetch();
  }

  async function handleCancel(offerId) {
    const { error } = await cancelBetOffer(offerId);
    if (error) alert(error);
    else refetch();
  }

  function handleCreated() {
    setShowCreate(false);
    refetch();
  }

  return (
    <main className="page betPage">
      <div className="pageHead rowHead">
        <div>
          <div className="eyebrow">PLAYER VS PLAYER</div>
          <h1>Side Betting</h1>
          <p className="sub">Post a bet on a streamer or CDL match. Someone takes the other side. Winner takes the pot.</p>
        </div>
        {user ? (
          <Button variant={showCreate ? "ghost" : "primary"} onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? <><X size={14} /> Close</> : <><Plus size={14} /> Post a Bet</>}
          </Button>
        ) : (
          <Button variant="primary" onClick={onLogin}>Log In to Bet</Button>
        )}
      </div>

      {showCreate && <CreateOfferForm onCreated={handleCreated} onClose={() => setShowCreate(false)} />}

      <div className="betTabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`betTab${tab === t.key ? " active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key === "my" && user && offers && tab === "my" ? ` (${offers.length})` : ""}
          </button>
        ))}
      </div>

      {tab === "cdl" && (
        <EmptyState icon={Trophy} title="CDL Match Betting">
          Coming soon. CDL series betting will appear here once the season is live.
        </EmptyState>
      )}

      {tab !== "cdl" && loading && <SkeletonRows rows={4} height={100} />}
      {tab !== "cdl" && error && (
        <div className="errorState"><p>{error}</p><button className="btn btn-ghost sm" onClick={refetch}>Retry</button></div>
      )}

      {tab !== "cdl" && !loading && offers?.length === 0 && (
        <EmptyState icon={Swords} title={tab === "my" ? "No bets yet" : "No open bets"} action={
          tab !== "my" && user ? <Button variant="primary" onClick={() => setShowCreate(true)}><Plus size={16} /> Post a bet</Button> : undefined
        }>
          {tab === "my" ? "Your active and past bets show up here." : "Post a bet on any match or event. Set your stake, pick your side, and wait for someone to take the other end."}
        </EmptyState>
      )}

      {tab !== "cdl" && !loading && offers?.length > 0 && (
        <div className="betOfferGrid">
          {offers.map(o => (
            <OfferCard
              key={o.id}
              offer={o}
              userId={user?.id}
              onAccept={handleAccept}
              onCancel={handleCancel}
              accepting={accepting}
            />
          ))}
        </div>
      )}

      <div className="betInfo">
        <h4>How it works</h4>
        <ol>
          <li><strong>Post</strong> — Pick a streamer, choose a market, make your prediction, set your stake.</li>
          <li><strong>Match</strong> — Another player takes the opposite side for the same stake.</li>
          <li><strong>Settle</strong> — Admin confirms the result. Winner gets the pot minus 5% rake (WAGR members: 0%).</li>
        </ol>
      </div>
    </main>
  );
}

export default BettingPage;
