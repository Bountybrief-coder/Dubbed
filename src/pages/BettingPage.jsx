import React, { useState, useEffect, useCallback } from "react";
import { usePageMeta } from "../hooks/usePageMeta";
import { Swords, Plus, X, Check, Clock, Trophy, AlertCircle, Shield } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useToast } from "../hooks/useToast.jsx";
import { useAsync } from "../hooks/useAsync.js";
import { useVisibilityRefresh } from "../hooks/useVisibilityRefresh";
import { EmptyState } from "../components/EmptyState";
import { SkeletonRows } from "../components/Skeleton";
import { Button } from "../components/Button";
import { getOpenOffers, getMyOffers, createBetOffer, acceptBetOffer, cancelBetOffer, subscribeToBetOffers } from "../services/p2pBetService";
import { money, timeAgo } from "../utils/format";
import { track } from "../utils/analytics";

const MARKETS = [
  { value: "match_winner", label: "Match Winner" },
  { value: "map_count", label: "Map Count (Over/Under)" },
  { value: "first_blood", label: "First Blood" },
  { value: "ace", label: "Gets an Ace" },
  { value: "clutch", label: "Clutch Round" },
  { value: "custom", label: "Custom" },
];

const CDL_TEAMS = [
  "Boston Breach", "Carolina Royal Ravens", "Cloud9 New York",
  "FaZe Vegas", "G2 Minnesota", "Los Angeles Thieves",
  "Miami Heretics", "OpTic Texas", "Paris Gentle Mates",
  "Riyadh Falcons", "Toronto KOI", "Vancouver Surge",
];

const CDL_MARKETS = [
  { value: "series_winner", label: "Series Winner" },
  { value: "map_count", label: "Map Count (Over/Under)" },
  { value: "first_map", label: "First Map Winner" },
  { value: "mvp", label: "Match MVP" },
  { value: "custom", label: "Custom" },
];

const STAKE_PRESETS = [1, 5, 10, 25, 50, 100];


function StatusBadge({ status }) {
  const cls = { open: "betBadge open", matched: "betBadge matched", settled: "betBadge settled", void: "betBadge voided" };
  return <span className={cls[status] || "betBadge"}>{status}</span>;
}

function OfferCard({ offer, userId, onAccept, onCancel, busyId }) {
  const busy = busyId === offer.id;
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
          <strong>{offer.creator?.username || "-"}</strong>
          <span className="betOfferPick">"{offer.creator_pick}"</span>
        </div>
        <div className="betOfferVs">
          <span className="betOfferStake">{money(offer.stake)}</span>
          <Swords size={16} />
          <span className="betOfferStake">{money(offer.stake)}</span>
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
          <button className="btn btn-primary" onClick={() => onAccept(offer)} disabled={busy}>
            <Check size={14} /> {busy ? "Accepting…" : `Accept · ${money(offer.stake)}`}
          </button>
        )}
        {canCancel && (
          <button className="btn btn-ghost" onClick={() => onCancel(offer)} disabled={busy}>
            <X size={14} /> {busy ? "Canceling…" : "Cancel"}
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
    if (!s || s <= 0 || s > 100) return setErr("Stake must be $0.01 to $100.");
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

function CdlCreateForm({ onCreated, onClose }) {
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [market, setMarket] = useState("series_winner");
  const [pick, setPick] = useState("");
  const [customMarket, setCustomMarket] = useState("");
  const [stake, setStake] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const matchLabel = teamA && teamB ? `${teamA} vs ${teamB}` : "";
  const availableB = CDL_TEAMS.filter(t => t !== teamA);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    if (!teamA || !teamB) return setErr("Select both teams.");
    if (!pick.trim()) return setErr("Enter your pick.");
    const s = parseFloat(stake);
    if (!s || s <= 0 || s > 100) return setErr("Stake must be $0.01 to $100.");
    setBusy(true);
    const m = market === "custom" ? customMarket.trim() || "custom" : market;
    const { error } = await createBetOffer("cdl", matchLabel, m, pick.trim(), s, null);
    setBusy(false);
    if (error) return setErr(error);
    track.betPost(s);
    onCreated();
  }

  return (
    <form className="betCreateForm" onSubmit={handleSubmit}>
      <h3><Shield size={16} /> Bet on a CDL Match</h3>

      <label>Team A</label>
      <select className="field" value={teamA} onChange={e => { setTeamA(e.target.value); setPick(""); }}>
        <option value="">Select team...</option>
        {CDL_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
      </select>

      <label>Team B</label>
      <select className="field" value={teamB} onChange={e => { setTeamB(e.target.value); setPick(""); }}>
        <option value="">Select team...</option>
        {availableB.map(t => <option key={t} value={t}>{t}</option>)}
      </select>

      <label>Market</label>
      <select className="field" value={market} onChange={e => setMarket(e.target.value)}>
        {CDL_MARKETS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
      </select>
      {market === "custom" && (
        <input className="field" type="text" placeholder="Describe the bet..." value={customMarket} onChange={e => setCustomMarket(e.target.value)} maxLength={100} />
      )}

      <label>Your Pick</label>
      {market === "series_winner" && teamA && teamB ? (
        <div className="segRow">
          <button type="button" className={pick === teamA ? "on" : ""} onClick={() => setPick(teamA)}>{teamA}</button>
          <button type="button" className={pick === teamB ? "on" : ""} onClick={() => setPick(teamB)}>{teamB}</button>
        </div>
      ) : (
        <input className="field" type="text" placeholder={market === "map_count" ? 'e.g. "Over 3.5 maps"' : market === "first_map" ? 'e.g. "OpTic Texas wins Map 1"' : 'Your prediction'} value={pick} onChange={e => setPick(e.target.value)} maxLength={80} />
      )}

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
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Posting..." : "Post CDL Bet"}</button>
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
  usePageMeta("Betting", "Place side bets on COD matches. Peer-to-peer wagering with instant settlement.");
  const { user, profile } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState("streamer");
  const [showCreate, setShowCreate] = useState(false);
  const [showCdlCreate, setShowCdlCreate] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const loadOffers = useCallback(() => {
    if (tab === "my" && user) return getMyOffers(user.id);
    if (tab === "cdl") return getOpenOffers("cdl");
    return getOpenOffers("streamer");
  }, [tab, user]);

  const { data: offers, loading, error, reload: refetch } = useAsync(loadOffers, [tab, user?.id]);

  useVisibilityRefresh(refetch, [tab]);

  useEffect(() => {
    try {
      const unsub = subscribeToBetOffers(() => refetch());
      return unsub;
    } catch { /* realtime not available */ }
  }, [refetch]);

  async function handleAccept(offer) {
    if (!user) return onLogin?.();
    if (profile && Number(offer.stake) > (profile.balance ?? 0)) {
      return toast.error(`Not enough balance. You need ${money(offer.stake)} to take this bet — deposit in your wallet.`);
    }
    setBusyId(offer.id);
    const { error } = await acceptBetOffer(offer.id);
    setBusyId(null);
    if (error) { toast.error(error); return; }
    track.betAccept(Number(offer.stake) || 0);
    toast.success(`Bet accepted — ${money(offer.stake)} stake locked. GL.`);
    refetch();
  }

  async function handleCancel(offer) {
    setBusyId(offer.id);
    const { error } = await cancelBetOffer(offer.id);
    setBusyId(null);
    if (error) { toast.error(error); return; }
    toast.success("Bet canceled — stake released.");
    refetch();
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
        {tab !== "cdl" && (user ? (
          <Button variant={showCreate ? "ghost" : "primary"} onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? <><X size={14} /> Close</> : <><Plus size={14} /> Post a Bet</>}
          </Button>
        ) : (
          <Button variant="primary" onClick={onLogin}>Log In to Bet</Button>
        ))}
      </div>

      {showCreate && <CreateOfferForm onCreated={handleCreated} onClose={() => setShowCreate(false)} />}

      <div className="betTabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`betTab${tab === t.key ? " active" : ""}`}
            onClick={() => { setTab(t.key); setShowCreate(false); setShowCdlCreate(false); }}
          >
            {t.label}
            {t.key === "my" && user && offers && tab === "my" ? ` (${offers.length})` : ""}
          </button>
        ))}
      </div>

      {loading && <SkeletonRows rows={4} height={100} />}
      {error && (
        <div className="errorState"><p>{error}</p><button className="btn btn-ghost sm" onClick={refetch}>Retry</button></div>
      )}

      {tab === "cdl" && !loading && !showCdlCreate && (
        <div style={{ marginBottom: 16 }}>
          {user ? (
            <Button variant="primary" onClick={() => setShowCdlCreate(true)}><Plus size={14} /> Bet on a CDL Match</Button>
          ) : (
            <Button variant="primary" onClick={onLogin}>Log In to Bet</Button>
          )}
        </div>
      )}

      {tab === "cdl" && showCdlCreate && <CdlCreateForm onCreated={handleCreated} onClose={() => setShowCdlCreate(false)} />}

      {!loading && offers?.length === 0 && (
        <EmptyState icon={tab === "cdl" ? Trophy : Swords} title={tab === "my" ? "No bets yet" : tab === "cdl" ? "No CDL bets yet" : "No open bets"} action={
          tab === "cdl" && user ? <Button variant="primary" onClick={() => setShowCdlCreate(true)}><Plus size={16} /> Bet on a CDL match</Button> :
          tab !== "my" && tab !== "cdl" && user ? <Button variant="primary" onClick={() => setShowCreate(true)}><Plus size={16} /> Post a bet</Button> : undefined
        }>
          {tab === "my" ? "Your active and past bets show up here." : tab === "cdl" ? "Pick two CDL teams, set your stake, and wait for someone to take the other side." : "Post a bet on any match or event. Set your stake, pick your side, and wait for someone to take the other end."}
        </EmptyState>
      )}

      {!loading && offers?.length > 0 && (
        <div className="betOfferGrid">
          {offers.map(o => (
            <OfferCard
              key={o.id}
              offer={o}
              userId={user?.id}
              onAccept={handleAccept}
              onCancel={handleCancel}
              busyId={busyId}
            />
          ))}
        </div>
      )}

      <div className="betInfo">
        <h4>How it works</h4>
        <ol>
          <li><strong>Post</strong> · Pick a streamer, choose a market, make your prediction, set your stake.</li>
          <li><strong>Match</strong> · Another player takes the opposite side for the same stake.</li>
          <li><strong>Settle</strong> · Admin confirms the result. Winner gets the pot minus 5% rake (WAGR members: 0%).</li>
        </ol>
      </div>
    </main>
  );
}

export default BettingPage;
