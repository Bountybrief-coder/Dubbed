import React, { useState, useEffect, useRef, useCallback } from "react";
import { MessageSquare, X, Globe, Users, Dice5, Shield, Send, DollarSign, Trophy, Lock, Clock, Check, TrendingUp } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useToast } from "../hooks/useToast.jsx";
import { useVisibilityRefresh } from "../hooks/useVisibilityRefresh";
import {
  getMessages, sendMessage, subscribeToChannel,
  getOpenBetEvents, placeSideBet, getMySideBets,
  subscribeToBetEvents, subscribeToSideBets
} from "../services/chatService";
import { shortTime, money } from "../utils/format";

const CHANNELS = [
  { id: "global", label: "Global", Icon: Globe },
  { id: "lfg", label: "Find Teammates", Icon: Users },
  { id: "betting", label: "Side Bets", Icon: Dice5 },
  { id: "support", label: "Support", Icon: Shield }
];

export function ChatDock({ open, onToggle, onLogin }) {
  const { profile } = useAuth();
  const toast = useToast();
  const [channel, setChannel] = useState("global");
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [events, setEvents] = useState([]);
  const [myBets, setMyBets] = useState([]);
  const bodyRef = useRef(null);
  const stickRef = useRef(true);
  const meta = CHANNELS.find((c) => c.id === channel);

  // Chat messages
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

  // Bet events + my bets (betting channel)
  useEffect(() => {
    if (!open || channel !== "betting" || !profile) return;
    let active = true;
    getOpenBetEvents().then(({ data }) => active && setEvents(data));
    getMySideBets().then(({ data }) => active && setMyBets(data));
    const unsub1 = subscribeToBetEvents((p) => {
      if (p.eventType === "INSERT") setEvents((e) => [p.new, ...e]);
      else if (p.eventType === "UPDATE") {
        setEvents((e) => e.map((x) => x.id === p.new.id ? p.new : x));
        if (p.new.status === "settled") {
          toast.success(`🏆 "${p.new.title}" settled — ${p.new.winner_option} wins!`);
        }
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
        if (p.new.status === "won") toast.success(`💰 You won ${money(p.new.payout)}!`);
      }
    });
    return () => { active = false; unsub1(); unsub2(); };
  }, [open, channel, profile?.id]);

  useVisibilityRefresh(() => {
    if (open && profile) {
      getMessages(channel).then(({ data }) => data && setMessages(data));
      if (channel === "betting") {
        getOpenBetEvents().then(({ data }) => data && setEvents(data));
        getMySideBets().then(({ data }) => data && setMyBets(data));
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

  if (!open) {
    return <button className="chatFab" onClick={onToggle} aria-label="Chat"><MessageSquare size={22} /></button>;
  }

  const openBets = myBets.filter((b) => b.status === "open");
  const wonCount = myBets.filter((b) => b.status === "won").length;
  const lostCount = myBets.filter((b) => b.status === "lost").length;

  return (
    <div className="chatDock2">
      <div className="chatDockHead">
        <span><meta.Icon size={17} /> {meta.label}</span>
        <button onClick={onToggle} aria-label="Close chat"><X size={16} /></button>
      </div>
      <div className="chatTabs">
        {CHANNELS.map(({ id, Icon }) => (
          <button key={id} className={channel === id ? "on" : ""} onClick={() => setChannel(id)}><Icon size={15} /></button>
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
          <BettingPanel events={events} myBets={myBets} openBets={openBets} wonCount={wonCount} lostCount={lostCount} profile={profile} toast={toast} messages={messages} />
        ) : (
          <>
            {messages.length === 0 ? (
              <div className="chatDockEmpty">
                {channel === "lfg" ? "Looking for a squad? Drop your game and region." : channel === "support" ? "Need help with a match? Staff responds here." : "Chat's quiet. Say something."}
              </div>
            ) : messages.map((m) => (
              <div className={`chatLine ${m.kind}`} key={m.id}>
                <div className="chatLineTop"><b>{m.username}</b><small>{shortTime(m.created_at)}</small></div>
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

// ── Betting Panel ──

function BettingPanel({ events, myBets, openBets, wonCount, lostCount, profile, toast, messages }) {
  return (
    <div className="betPanel">
      {/* Summary strip */}
      {(openBets.length > 0 || wonCount > 0 || lostCount > 0) && (
        <div className="betSummary">
          {openBets.length > 0 && <span className="betSumChip open"><Clock size={11} /> {openBets.length} open</span>}
          {wonCount > 0 && <span className="betSumChip won"><Check size={11} /> {wonCount}W</span>}
          {lostCount > 0 && <span className="betSumChip lost"><X size={11} /> {lostCount}L</span>}
        </div>
      )}

      {/* Active events */}
      {events.length > 0 ? (
        <div className="betEventCards">
          {events.map((ev) => (
            <EventCard key={ev.id} event={ev} profile={profile} toast={toast} myBets={myBets} />
          ))}
        </div>
      ) : (
        <div className="chatDockEmpty">No active betting events. Check back when matches are live.</div>
      )}

      {/* Chat messages in betting channel */}
      {messages.length > 0 && (
        <div className="betChatSection">
          <small className="betChatLabel">BETTING CHAT</small>
          {messages.map((m) => (
            <div className={`chatLine ${m.kind}`} key={m.id}>
              <div className="chatLineTop"><b>{m.username}</b><small>{shortTime(m.created_at)}</small></div>
              <p>{m.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Event Card ──

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

      {/* Options */}
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

      {/* Place bet form */}
      {isOpen && !myBet && selection && (
        <div className="betEvPlace">
          <div className="betEvStakeRow">
            <DollarSign size={14} />
            <input className="field sm" type="number" min="1" max="100" step="1" value={stake} onChange={(e) => setStake(e.target.value)} placeholder="Stake (1–100)" />
          </div>
          {stake && parseFloat(stake) >= 1 && (
            <div className="betEvPayout">
              Risk {money(parseFloat(stake))} → win {money(potentialPayout - rakeEst)} after rake
              {!profile?.wagr_member && rakeEst > 0 && <small> (5% = {money(rakeEst)})</small>}
              {profile?.wagr_member && <small className="wagr"> WAGR: no rake</small>}
            </div>
          )}
          <button className="btn btn-primary sm betEvSubmit" onClick={place} disabled={busy}>
            {busy ? "Placing…" : `Bet ${money(parseFloat(stake) || 0)} on ${selection}`}
          </button>
        </div>
      )}

      {/* My bet on this event */}
      {myBet && (
        <div className={`betEvMyBet ${myBet.status}`}>
          <span>Your bet: <b>{money(myBet.stake)}</b> on <b>{myBet.selection}</b></span>
          {myBet.status === "open" && <span className="betEvMyStatus"><Clock size={11} /> Pending</span>}
          {myBet.status === "won" && <span className="betEvMyStatus won"><Trophy size={11} /> Won {money(myBet.payout)}</span>}
          {myBet.status === "lost" && <span className="betEvMyStatus lost">Lost</span>}
          {myBet.status === "void" && <span className="betEvMyStatus void">Refunded {money(myBet.payout)}</span>}
        </div>
      )}

      {/* Settled winner announcement */}
      {isSettled && (
        <div className="betEvWinner">🏆 {event.winner_option} wins!</div>
      )}
    </div>
  );
}
