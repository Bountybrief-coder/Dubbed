import React, { useState, useEffect, useRef, useCallback } from "react";
import { MessageSquare, X, Globe, Users, Dice5, Shield, Send, DollarSign, Trophy, Lock, Clock, Check, TrendingUp, Plus, Swords, ChevronDown } from "lucide-react";
import { WagrBadge } from "./WagrBadge";
import { useAuth } from "../hooks/useAuth.jsx";
import { useToast } from "../hooks/useToast.jsx";
import { useVisibilityRefresh } from "../hooks/useVisibilityRefresh";
import {
  getMessages, sendMessage, subscribeToChannel,
  getOpenBetEvents, placeSideBet, getMySideBets,
  subscribeToBetEvents, subscribeToSideBets
} from "../services/chatService";
import {
  getOpenOffers, getMyOffers, createBetOffer, acceptBetOffer,
  cancelBetOffer, subscribeToBetOffers
} from "../services/p2pBetService";
import { shortTime, money } from "../utils/format";

const CHANNELS = [
  { id: "global", label: "Global", Icon: Globe },
  { id: "lfg", label: "Find Teammates", Icon: Users },
  { id: "betting", label: "Side Bets", Icon: Dice5 },
  { id: "support", label: "Support", Icon: Shield }
];

const MARKETS = [
  { value: "match_winner", label: "Match Winner" },
  { value: "map_count", label: "Map Count" },
  { value: "first_blood", label: "First Blood" },
  { value: "ace", label: "Gets an Ace" },
  { value: "clutch", label: "Clutch Round" },
  { value: "custom", label: "Custom" },
];

const STAKE_PRESETS = [1, 5, 10, 25];

export function ChatDock({ open, onToggle, onLogin }) {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [channel, setChannel] = useState("global");
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [events, setEvents] = useState([]);
  const [myBets, setMyBets] = useState([]);
  const [p2pOffers, setP2pOffers] = useState([]);
  const [myOffers, setMyOffers] = useState([]);
  const bodyRef = useRef(null);
  const stickRef = useRef(true);
  const meta = CHANNELS.find((c) => c.id === channel);

  useEffect(() => {
    if (!open || !profile) return;
    let active = true;
    getMessages(channel).then(({ data }) => { if (active) { setMessages(data); stickRef.current = true; } });
    const unsub = subscribeToChannel(channel, (row) => {
      setMessages((m) => {
        const withoutOptimistic = m.filter((msg) => !msg.id.startsWith("opt-") || msg.user_id !== row.user_id);
        return [...withoutOptimistic.slice(-200), row];
      });
    });
    return () => { active = false; unsub(); };
  }, [channel, open, profile?.id]);

  useEffect(() => {
    if (!open || channel !== "betting" || !profile) return;
    let active = true;
    getOpenBetEvents().then(({ data }) => active && setEvents(data));
    getMySideBets().then(({ data }) => active && setMyBets(data));
    getOpenOffers().then(({ data }) => active && setP2pOffers(data));
    if (user) getMyOffers(user.id).then(({ data }) => active && setMyOffers(data));

    const unsub1 = subscribeToBetEvents((p) => {
      if (p.eventType === "INSERT") setEvents((e) => [p.new, ...e]);
      else if (p.eventType === "UPDATE") {
        setEvents((e) => e.map((x) => x.id === p.new.id ? p.new : x));
        if (p.new.status === "settled") toast.success(`"${p.new.title}" settled. ${p.new.winner_option} wins!`);
      }
      else if (p.eventType === "DELETE") setEvents((e) => e.filter((x) => x.id !== p.old.id));
    });
    const unsub2 = subscribeToSideBets((p) => {
      if (p.new?.user_id === profile.id) {
        setMyBets((b) => {
          const exists = b.find((x) => x.id === p.new.id);
          if (exists) return b.map((x) => x.id === p.new.id ? p.new : x);
          return [p.new, ...b];
        });
        if (p.new.status === "won") toast.success(`You won ${money(p.new.payout)}!`);
      }
    });
    const unsub3 = subscribeToBetOffers((p) => {
      if (p.eventType === "INSERT") {
        setP2pOffers((o) => [p.new, ...o]);
        if (user) setMyOffers((o) => p.new.creator_id === user.id ? [p.new, ...o] : o);
      } else if (p.eventType === "UPDATE") {
        setP2pOffers((o) => o.map((x) => x.id === p.new.id ? p.new : x).filter((x) => x.status === "open" || x.status === "matched"));
        if (user) setMyOffers((o) => o.map((x) => x.id === p.new.id ? p.new : x));
      } else if (p.eventType === "DELETE") {
        setP2pOffers((o) => o.filter((x) => x.id !== p.old.id));
        if (user) setMyOffers((o) => o.filter((x) => x.id !== p.old.id));
      }
    });
    return () => { active = false; unsub1(); unsub2(); unsub3(); };
  }, [open, channel, profile?.id, user]);

  useVisibilityRefresh(() => {
    if (open && profile) {
      getMessages(channel).then(({ data }) => data && setMessages(data));
      if (channel === "betting") {
        getOpenBetEvents().then(({ data }) => data && setEvents(data));
        getMySideBets().then(({ data }) => data && setMyBets(data));
        getOpenOffers().then(({ data }) => data && setP2pOffers(data));
        if (user) getMyOffers(user.id).then(({ data }) => data && setMyOffers(data));
      }
    }
  }, [open, channel, profile?.id]);

  const onScroll = useCallback(() => {
    const el = bodyRef.current;
    if (el) stickRef.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 30;
  }, []);

  useEffect(() => {
    if (stickRef.current && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages.length]);

  async function send() {
    if (!profile) return onLogin();
    if (profile.banned) return;
    if (!text.trim()) return;
    const body = text.trim();
    setText("");
    setMessages((m) => [...m, { id: `opt-${Date.now()}`, channel, user_id: profile.id, username: profile.username, text: body, kind: "msg", created_at: new Date().toISOString() }]);
    stickRef.current = true;
    const { error } = await sendMessage(channel, profile.username, body);
    if (error) toast.error(error);
  }

  function reloadP2p() {
    getOpenOffers().then(({ data }) => data && setP2pOffers(data));
    if (user) getMyOffers(user.id).then(({ data }) => data && setMyOffers(data));
  }

  if (!open) {
    return <button className="chatFab" onClick={onToggle} aria-label="Chat"><MessageSquare size={22} /></button>;
  }

  return (
    <div className="chatDock2">
      <div className="chatDockHead">
        <span><meta.Icon size={17} /> {meta.label}</span>
        <button onClick={onToggle} aria-label="Close chat"><X size={16} /></button>
      </div>
      <div className="chatTabs">
        {CHANNELS.map(({ id, label, Icon }) => (
          <button key={id} className={channel === id ? "on" : ""} onClick={() => setChannel(id)} aria-label={label} title={label}><Icon size={15} /></button>
        ))}
      </div>
      <div className="chatDockBody" ref={bodyRef} onScroll={onScroll}>
        {!profile ? (
          <div className="chatDockGate">
            <Shield size={20} />
            <b>Sign in to view chat</b>
            <button className="btn btn-primary sm" onClick={onLogin}>Log in</button>
          </div>
        ) : channel === "betting" ? (
          <BettingPanel
            events={events}
            myBets={myBets}
            p2pOffers={p2pOffers}
            myOffers={myOffers}
            profile={profile}
            userId={user?.id}
            toast={toast}
            messages={messages}
            onReload={reloadP2p}
            onLogin={onLogin}
          />
        ) : (
          <>
            {messages.length === 0 ? (
              <div className="chatDockEmpty">
                {channel === "lfg" ? "Looking for a squad? Drop your game and region." : channel === "support" ? "Need help with a match? Staff responds here." : "Chat's quiet. Say something."}
              </div>
            ) : messages.map((m) => (
              <div className={`chatLine ${m.kind}`} key={m.id}>
                <div className="chatLineTop"><b>{m.username}</b>{m.profiles?.wagr_member && <WagrBadge size={12} />}<small>{shortTime(m.created_at)}</small></div>
                <p>{m.text}</p>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="chatDockInput">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={profile ? "Message…" : "Log in to chat"} disabled={!profile} />
        <button onClick={send} aria-label="Send"><Send size={16} /></button>
      </div>
    </div>
  );
}

// ── Betting Panel (unified: side events + P2P + chat) ──

function BettingPanel({ events, myBets, p2pOffers, myOffers, profile, userId, toast, messages, onReload, onLogin }) {
  const [tab, setTab] = useState("feed");
  const [showForm, setShowForm] = useState(false);

  const openSideBets = myBets.filter((b) => b.status === "open");
  const wonCount = myBets.filter((b) => b.status === "won").length;
  const lostCount = myBets.filter((b) => b.status === "lost").length;
  const myOpenP2p = myOffers.filter((o) => o.status === "open" || o.status === "matched");
  const mySettledP2p = myOffers.filter((o) => o.status === "settled" || o.status === "void");
  const totalActive = openSideBets.length + myOpenP2p.length;
  const totalWon = wonCount + myOffers.filter(o => o.status === "settled" && o.winner_pick === (o.creator_id === userId ? "creator" : "acceptor")).length;

  return (
    <div className="betPanel">
      {/* Summary */}
      {(totalActive > 0 || totalWon > 0 || lostCount > 0) && (
        <div className="betSummary">
          {totalActive > 0 && <span className="betSumChip open"><Clock size={11} /> {totalActive} active</span>}
          {totalWon > 0 && <span className="betSumChip won"><Check size={11} /> {totalWon}W</span>}
          {lostCount > 0 && <span className="betSumChip lost"><X size={11} /> {lostCount}L</span>}
          <span className="betSumChip bal"><DollarSign size={11} /> {money(profile.balance)}</span>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="betSubTabs">
        <button className={tab === "feed" ? "on" : ""} onClick={() => setTab("feed")}>
          <Dice5 size={13} /> Feed
        </button>
        <button className={tab === "my" ? "on" : ""} onClick={() => setTab("my")}>
          <Trophy size={13} /> My Bets {totalActive > 0 && <span className="betTabCount">{totalActive}</span>}
        </button>
        <button className={`betPostBtn ${showForm ? "on" : ""}`} onClick={() => { setShowForm(!showForm); setTab("feed"); }}>
          <Plus size={13} /> Post
        </button>
      </div>

      {/* Post bet form */}
      {showForm && (
        <PostBetForm
          profile={profile}
          toast={toast}
          onDone={() => { setShowForm(false); onReload(); }}
          onClose={() => setShowForm(false)}
        />
      )}

      {tab === "feed" ? (
        <FeedView
          events={events}
          p2pOffers={p2pOffers}
          myBets={myBets}
          myOffers={myOffers}
          profile={profile}
          userId={userId}
          toast={toast}
          messages={messages}
          onReload={onReload}
        />
      ) : (
        <MyBetsView
          myBets={myBets}
          myOffers={myOffers}
          userId={userId}
          toast={toast}
          onReload={onReload}
        />
      )}
    </div>
  );
}

// ── Feed View: P2P offers + admin events + chat ──

function FeedView({ events, p2pOffers, myBets, myOffers, profile, userId, toast, messages, onReload }) {
  const otherOffers = p2pOffers.filter((o) => o.creator_id !== userId && o.status === "open");

  return (
    <>
      {/* P2P Offers from others */}
      {otherOffers.length > 0 && (
        <div className="betSection">
          <small className="betSectionLabel"><Swords size={11} /> OPEN P2P BETS</small>
          {otherOffers.map((o) => (
            <P2PCard key={o.id} offer={o} userId={userId} toast={toast} onReload={onReload} />
          ))}
        </div>
      )}

      {/* Admin-created events */}
      {events.length > 0 && (
        <div className="betSection">
          <small className="betSectionLabel"><Trophy size={11} /> LIVE EVENTS</small>
          {events.map((ev) => (
            <EventCard key={ev.id} event={ev} profile={profile} toast={toast} myBets={myBets} />
          ))}
        </div>
      )}

      {otherOffers.length === 0 && events.length === 0 && (
        <div className="chatDockEmpty">No active bets. Post one or check back when matches are live.</div>
      )}

      {/* Chat messages */}
      {messages.length > 0 && (
        <div className="betChatSection">
          <small className="betSectionLabel"><MessageSquare size={11} /> CHAT</small>
          {messages.map((m) => (
            <div className={`chatLine ${m.kind}`} key={m.id}>
              <div className="chatLineTop"><b>{m.username}</b>{m.profiles?.wagr_member && <WagrBadge size={12} />}<small>{shortTime(m.created_at)}</small></div>
              <p>{m.text}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── My Bets View ──

function MyBetsView({ myBets, myOffers, userId, toast, onReload }) {
  const activeP2p = myOffers.filter((o) => o.status === "open" || o.status === "matched");
  const pastP2p = myOffers.filter((o) => o.status === "settled" || o.status === "void");
  const activeSide = myBets.filter((b) => b.status === "open");
  const pastSide = myBets.filter((b) => b.status !== "open");

  if (activeP2p.length === 0 && pastP2p.length === 0 && activeSide.length === 0 && pastSide.length === 0) {
    return <div className="chatDockEmpty">No bets yet. Post one or accept someone's bet from the feed.</div>;
  }

  return (
    <>
      {activeP2p.length > 0 && (
        <div className="betSection">
          <small className="betSectionLabel"><Clock size={11} /> YOUR ACTIVE P2P</small>
          {activeP2p.map((o) => (
            <P2PCard key={o.id} offer={o} userId={userId} toast={toast} onReload={onReload} mine />
          ))}
        </div>
      )}

      {activeSide.length > 0 && (
        <div className="betSection">
          <small className="betSectionLabel"><Clock size={11} /> YOUR SIDE BETS</small>
          {activeSide.map((b) => (
            <div className="betMiniCard" key={b.id}>
              <span className="betMiniTitle">{b.bet_events?.title || "Event"}</span>
              <span className="betMiniPick">{b.selection}</span>
              <span className="betMiniStake">{money(b.stake)}</span>
              <span className="betMiniStatus open">Pending</span>
            </div>
          ))}
        </div>
      )}

      {(pastP2p.length > 0 || pastSide.length > 0) && (
        <div className="betSection">
          <small className="betSectionLabel"><Trophy size={11} /> HISTORY</small>
          {pastP2p.map((o) => (
            <P2PCard key={o.id} offer={o} userId={userId} toast={toast} onReload={onReload} mine />
          ))}
          {pastSide.map((b) => (
            <div className={`betMiniCard ${b.status}`} key={b.id}>
              <span className="betMiniTitle">{b.bet_events?.title || "Event"}</span>
              <span className="betMiniPick">{b.selection}</span>
              <span className="betMiniStake">{money(b.stake)}</span>
              <span className={`betMiniStatus ${b.status}`}>
                {b.status === "won" ? `Won ${money(b.payout)}` : b.status === "lost" ? "Lost" : b.status === "void" ? "Refunded" : b.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── P2P Offer Card (compact, chat-sized) ──

function P2PCard({ offer, userId, toast, onReload, mine }) {
  const [busy, setBusy] = useState(false);
  const isMine = offer.creator_id === userId;
  const isAcceptor = offer.acceptor_id === userId;
  const canAccept = offer.status === "open" && !isMine && userId;
  const canCancel = offer.status === "open" && isMine;
  const marketLabel = MARKETS.find(m => m.value === offer.market)?.label || offer.market;

  async function handleAccept() {
    setBusy(true);
    const { error } = await acceptBetOffer(offer.id);
    setBusy(false);
    if (error) return toast.error(error);
    toast.success(`Bet accepted! ${money(offer.stake)} locked.`);
    onReload();
  }

  async function handleCancel() {
    setBusy(true);
    const { error } = await cancelBetOffer(offer.id);
    setBusy(false);
    if (error) return toast.error(error);
    toast.success("Bet cancelled, stake refunded.");
    onReload();
  }

  return (
    <div className={`p2pCard ${offer.status}`}>
      <div className="p2pCardTop">
        <div className="p2pCardEvent">
          <Swords size={12} />
          <b>{offer.event_ref}</b>
        </div>
        <span className={`p2pStatus ${offer.status}`}>{offer.status}</span>
      </div>
      <div className="p2pCardBody">
        <span className="p2pCreator">
          {offer.creator?.username || "?"} picks "{offer.creator_pick}"
        </span>
        <span className="p2pMarket">{marketLabel}</span>
      </div>
      <div className="p2pCardFoot">
        <span className="p2pStake"><DollarSign size={12} /> {money(offer.stake)} ea.</span>
        {canAccept && (
          <button className="btn btn-primary sm" onClick={handleAccept} disabled={busy}>
            {busy ? "…" : <><Check size={13} /> Accept {money(offer.stake)}</>}
          </button>
        )}
        {canCancel && (
          <button className="btn btn-ghost sm" onClick={handleCancel} disabled={busy}>
            <X size={13} /> Cancel
          </button>
        )}
        {offer.status === "matched" && (
          <span className="p2pMatched">
            <Check size={12} /> {isMine ? `vs ${offer.acceptor?.username || "?"}` : isAcceptor ? `vs ${offer.creator?.username || "?"}` : "Matched"}
          </span>
        )}
        {offer.status === "settled" && offer.winner_pick && (
          <span className={`p2pResult ${(offer.winner_pick === "creator" && isMine) || (offer.winner_pick === "acceptor" && isAcceptor) ? "won" : "lost"}`}>
            {(offer.winner_pick === "creator" && isMine) || (offer.winner_pick === "acceptor" && isAcceptor) ? <><Trophy size={12} /> Won {money(offer.stake * 2)}</> : "Lost"}
          </span>
        )}
        {offer.status === "void" && <span className="p2pVoid">Refunded</span>}
      </div>
    </div>
  );
}

// ── Post Bet Form (compact, inline in chat) ──

function PostBetForm({ profile, toast, onDone, onClose }) {
  const [eventRef, setEventRef] = useState("");
  const [market, setMarket] = useState("match_winner");
  const [pick, setPick] = useState("");
  const [stake, setStake] = useState("");
  const [customMarket, setCustomMarket] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const s = parseFloat(stake);
    if (!eventRef.trim()) return toast.error("Enter a streamer or event.");
    if (!pick.trim()) return toast.error("Enter your pick.");
    if (!s || s < 1) return toast.error("Min bet $1.");
    if (s > 100) return toast.error("Max bet $100.");
    if (s > (profile.balance || 0)) return toast.error("Not enough balance.");
    setBusy(true);
    const m = market === "custom" ? customMarket.trim() || "custom" : market;
    const { error } = await createBetOffer("streamer", eventRef.trim(), m, pick.trim(), s, null);
    setBusy(false);
    if (error) return toast.error(error);
    toast.success(`Bet posted! ${money(s)} escrowed.`);
    onDone();
  }

  return (
    <div className="postBetForm">
      <div className="postBetHead">
        <b><Swords size={13} /> Post a Bet</b>
        <button className="postBetClose" onClick={onClose} aria-label="Close"><X size={14} /></button>
      </div>
      <div className="postBetFields">
        <input className="field sm" placeholder="Streamer / event…" value={eventRef} onChange={(e) => setEventRef(e.target.value)} maxLength={80} />
        <div className="postBetRow">
          <select className="field sm" value={market} onChange={(e) => setMarket(e.target.value)}>
            {MARKETS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        {market === "custom" && (
          <input className="field sm" placeholder="Describe bet…" value={customMarket} onChange={(e) => setCustomMarket(e.target.value)} maxLength={100} />
        )}
        <input className="field sm" placeholder='Your pick (e.g. "Scump wins")' value={pick} onChange={(e) => setPick(e.target.value)} maxLength={80} />
        <div className="postBetStakeRow">
          <DollarSign size={13} />
          <input className="field sm postBetStakeInput" type="number" min="1" max="100" step="1" value={stake} onChange={(e) => setStake(e.target.value)} placeholder="0" />
          {STAKE_PRESETS.map(p => (
            <button key={p} type="button" className={`postBetPreset${stake === String(p) ? " on" : ""}`} onClick={() => setStake(String(p))}>${p}</button>
          ))}
        </div>
      </div>
      <button className="btn btn-primary sm postBetSubmit" onClick={submit} disabled={busy}>
        {busy ? "Posting…" : `Post · ${money(parseFloat(stake) || 0)} from balance`}
      </button>
    </div>
  );
}

// ── Event Card (admin-created side bet) ──

function EventCard({ event, profile, toast, myBets }) {
  const [selection, setSelection] = useState("");
  const [stake, setStake] = useState("");
  const [busy, setBusy] = useState(false);
  const options = Array.isArray(event.options) ? event.options : [];
  const isOpen = event.status === "open";
  const isLocked = event.status === "locked";
  const isSettled = event.status === "settled";
  const myBet = myBets.find((b) => b.event_id === event.id);
  const locksIn = event.locks_at ? Math.max(0, Math.floor((new Date(event.locks_at) - Date.now()) / 60000)) : null;

  async function place() {
    if (!selection) return toast.error("Pick an option first.");
    const s = parseFloat(stake);
    if (!s || s < 1) return toast.error("Min bet is $1.");
    if (s > 100) return toast.error("Max bet is $100.");
    if (s > (profile.balance || 0)) return toast.error("Not enough balance.");
    setBusy(true);
    const { error } = await placeSideBet(event.id, selection, s);
    setBusy(false);
    if (error) return toast.error(error);
    toast.success(`Bet placed: ${money(s)} on ${selection}`);
    setSelection("");
    setStake("");
  }

  const potentialPayout = stake ? Math.round(parseFloat(stake || 0) * event.odds * 100) / 100 : 0;
  const potentialProfit = potentialPayout - parseFloat(stake || 0);
  const rakeEst = profile?.wagr_member ? 0 : Math.round(Math.max(potentialProfit, 0) * 0.05 * 100) / 100;

  return (
    <div className={`betEventCard ${isSettled ? "settled" : isLocked ? "locked" : "open"}`}>
      <div className="betEvHead">
        <div className="betEvTitle">
          {isOpen && <Dice5 size={14} />}
          {isLocked && <Lock size={14} />}
          {isSettled && <Trophy size={14} />}
          <b>{event.title}</b>
        </div>
        <span className={`betEvStatus ${event.status}`}>
          {isOpen ? "OPEN" : isLocked ? "LOCKED" : isSettled ? "SETTLED" : event.status.toUpperCase()}
        </span>
      </div>
      {event.description && <p className="betEvDesc">{event.description}</p>}

      <div className="betEvOdds"><TrendingUp size={12} /> {event.odds}x odds · {event.market === "cdl" ? "CDL" : "Streamer"}</div>

      {locksIn !== null && isOpen && (
        <div className="betEvTimer"><Clock size={12} /> Locks in {locksIn > 0 ? `${locksIn}m` : "< 1m"}</div>
      )}

      <div className="betEvOptions">
        {options.map((opt) => (
          <button
            key={opt}
            className={`betEvOpt ${selection === opt ? "selected" : ""} ${isSettled && event.winner_option === opt ? "winner" : ""}`}
            onClick={() => isOpen && !myBet && setSelection(opt === selection ? "" : opt)}
            disabled={!isOpen || !!myBet}
          >
            {opt}
            {isSettled && event.winner_option === opt && <Check size={12} />}
          </button>
        ))}
      </div>

      {isOpen && !myBet && selection && (
        <div className="betEvPlace">
          <div className="betEvStakeRow">
            <DollarSign size={14} />
            <input className="field sm" type="number" min="1" max="100" step="1" value={stake} onChange={(e) => setStake(e.target.value)} placeholder="Stake (1–100)" />
          </div>
          {stake && parseFloat(stake) >= 1 && (
            <div className="betEvPayout">
              Risk {money(parseFloat(stake))} → win {money(potentialPayout - rakeEst)}
              {!profile?.wagr_member && rakeEst > 0 && <small> (5% rake)</small>}
              {profile?.wagr_member && <small className="wagr"> WAGR: 0%</small>}
            </div>
          )}
          <button className="btn btn-primary sm betEvSubmit" onClick={place} disabled={busy}>
            {busy ? "Placing…" : `Bet ${money(parseFloat(stake) || 0)}`}
          </button>
        </div>
      )}

      {myBet && (
        <div className={`betEvMyBet ${myBet.status}`}>
          <span>Your bet: <b>{money(myBet.stake)}</b> on <b>{myBet.selection}</b></span>
          {myBet.status === "open" && <span className="betEvMyStatus"><Clock size={11} /> Pending</span>}
          {myBet.status === "won" && <span className="betEvMyStatus won"><Trophy size={11} /> Won {money(myBet.payout)}</span>}
          {myBet.status === "lost" && <span className="betEvMyStatus lost">Lost</span>}
          {myBet.status === "void" && <span className="betEvMyStatus void">Refunded</span>}
        </div>
      )}

      {isSettled && (
        <div className="betEvWinner">{event.winner_option} wins!</div>
      )}
    </div>
  );
}
