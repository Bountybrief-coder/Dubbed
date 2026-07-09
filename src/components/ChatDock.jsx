import React, { useState, useEffect, useRef, useCallback } from "react";
import { MessageSquare, X, Globe, Users, Dice5, Shield, Send, DollarSign, Trophy, XCircle } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useToast } from "../hooks/useToast.jsx";
import { getMessages, sendMessage, subscribeToChannel, getOpenBets, proposeSideBet, acceptSideBet, cancelSideBet, subscribeToBets } from "../services/chatService";
import { shortTime, money } from "../utils/format";

const CHANNELS = [
  { id: "global", label: "Global", Icon: Globe },
  { id: "lfg", label: "Find Teammates", Icon: Users },
  { id: "betting", label: "Side Bets", Icon: Dice5 },
  { id: "support", label: "Support", Icon: Shield }
];

const CDL_TEAMS = [
  "Boston Breach", "Carolina Royal Ravens", "Cloud9 New York",
  "FaZe Vegas", "G2 Minnesota", "Los Angeles Thieves",
  "Miami Heretics", "OpTic Texas", "Paris Gentle Mates",
  "Riyadh Falcons", "Toronto KOI", "Vancouver Surge"
];

export function ChatDock({ open, onToggle, onLogin }) {
  const { profile } = useAuth();
  const toast = useToast();
  const [channel, setChannel] = useState("global");
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [bets, setBets] = useState([]);
  const [showBetForm, setShowBetForm] = useState(false);
  const bodyRef = useRef(null);
  const stickRef = useRef(true);
  const meta = CHANNELS.find((c) => c.id === channel);

  useEffect(() => {
    if (!open) return;
    let active = true;
    getMessages(channel).then(({ data }) => { if (active) { setMessages(data); stickRef.current = true; } });
    const unsub = subscribeToChannel(channel, (row) => {
      setMessages((m) => {
        const withoutOptimistic = m.filter((msg) => !msg.id.startsWith("opt-") || msg.user_id !== row.user_id);
        return [...withoutOptimistic.slice(-200), row];
      });
    });
    return () => { active = false; unsub(); };
  }, [channel, open]);

  useEffect(() => {
    if (!open || channel !== "betting") return;
    let active = true;
    getOpenBets().then(({ data }) => active && setBets(data));
    const unsub = subscribeToBets((payload) => {
      if (payload.eventType === "INSERT") {
        setBets((b) => [payload.new, ...b]);
      } else if (payload.eventType === "UPDATE") {
        setBets((b) => b.map((x) => x.id === payload.new.id ? payload.new : x).filter((x) => x.status === "open" || x.status === "matched"));
      } else if (payload.eventType === "DELETE") {
        setBets((b) => b.filter((x) => x.id !== payload.old.id));
      }
    });
    return () => { active = false; unsub(); };
  }, [open, channel]);

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

  return (
    <div className="chatDock2">
      <div className="chatDockHead">
        <span><meta.Icon size={17} /> {meta.label}</span>
        <button onClick={onToggle} aria-label="Close chat"><X size={16} /></button>
      </div>
      <div className="chatTabs">
        {CHANNELS.map(({ id, Icon }) => (
          <button key={id} className={channel === id ? "on" : ""} onClick={() => { setChannel(id); setShowBetForm(false); }}><Icon size={15} /></button>
        ))}
      </div>
      <div className="chatDockBody" ref={bodyRef} onScroll={onScroll}>
        {channel === "betting" && bets.length > 0 && (
          <div className="betCards">
            {bets.map((b) => (
              <BetCard key={b.id} bet={b} profile={profile} onLogin={onLogin} toast={toast} />
            ))}
          </div>
        )}
        {messages.length === 0 && !(channel === "betting" && bets.length > 0) ? (
          <div className="chatDockEmpty">
            {channel === "lfg" ? "Looking for a squad? Drop your game and region." : channel === "betting" ? "No active bets. Post one and see who bites." : channel === "support" ? "Need help with a match? Staff responds here." : "Chat's quiet. Say something."}
          </div>
        ) : messages.map((m) => (
          <div className={`chatLine ${m.kind}`} key={m.id}>
            <div className="chatLineTop"><b>{m.username}</b><small>{shortTime(m.created_at)}</small></div>
            <p>{m.text}</p>
          </div>
        ))}
      </div>

      {channel === "betting" && showBetForm && (
        <BetForm profile={profile} onLogin={onLogin} toast={toast} onClose={() => setShowBetForm(false)} />
      )}

      <div className="chatDockInput">
        {channel === "betting" && (
          <button className="betToggle" onClick={() => { if (!profile) return onLogin(); setShowBetForm((o) => !o); }} title="Propose a bet">
            <DollarSign size={16} />
          </button>
        )}
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={profile ? "Message…" : "Log in to chat"} disabled={!profile} />
        <button onClick={send} aria-label="Send"><Send size={16} /></button>
      </div>
    </div>
  );
}

function BetCard({ bet, profile, onLogin, toast }) {
  const [pick, setPick] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const isOwner = profile?.id === bet.proposer_id;
  const isOpen = bet.status === "open";
  const isMatched = bet.status === "matched";
  const opposingTeams = bet.market === "cdl" ? CDL_TEAMS.filter((t) => t !== bet.pick_a) : [];

  async function accept() {
    if (!profile) return onLogin();
    if (!pick.trim()) return toast.error("Pick a team or streamer first.");
    if (pick.trim().toLowerCase() === bet.pick_a.toLowerCase()) return toast.error("You can't pick the same side as the proposer.");
    setAccepting(true);
    const { error } = await acceptSideBet(bet.id, pick.trim());
    setAccepting(false);
    if (error) toast.error(error);
    else { toast.success("Bet accepted! Your stake has been deducted."); setPick(""); }
  }

  async function cancel() {
    setCancelling(true);
    const { error } = await cancelSideBet(bet.id);
    setCancelling(false);
    if (error) toast.error(error);
    else toast.success("Bet cancelled, stake refunded.");
  }

  return (
    <div className={`betCard ${isMatched ? "matched" : ""}`}>
      <div className="betCardHead">
        <span className={`betStatus ${bet.status}`}>{isOpen ? "OPEN" : isMatched ? "LOCKED IN" : (bet.status || "").toUpperCase()}</span>
        <span className="betMarket">{bet.market === "cdl" ? "CDL" : "Streamer"}</span>
        <b className="betStake">{money(bet.stake)}</b>
      </div>
      <div className="betCardBody">
        <div className="betPlayer">
          <small>{isOpen ? "Posted by" : "Side A"}</small>
          <b>{bet.proposer_name}</b>
          <span className="betPick">{bet.pick_a}</span>
        </div>
        {isMatched && (
          <>
            <span className="betVs">VS</span>
            <div className="betPlayer">
              <small>Side B</small>
              <b>{bet.acceptor_name}</b>
              <span className="betPick">{bet.pick_b}</span>
            </div>
          </>
        )}
      </div>
      {isOpen && !isOwner && profile && (
        <div className="betAccept">
          {bet.market === "cdl" ? (
            <select className="field sm" value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Pick your team</option>
              {opposingTeams.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          ) : (
            <input className="field sm" value={pick} onChange={(e) => setPick(e.target.value)} placeholder="Your streamer pick" />
          )}
          <button className="btn btn-primary sm" onClick={accept} disabled={accepting}>{accepting ? "…" : `Accept · ${money(bet.stake)}`}</button>
        </div>
      )}
      {isOpen && !isOwner && !profile && (
        <button className="btn btn-primary sm" style={{ marginTop: 8, width: "100%" }} onClick={onLogin}>Log in to accept</button>
      )}
      {isOpen && isOwner && (
        <button className="btn btn-ghost sm betCancel" onClick={cancel} disabled={cancelling}><XCircle size={13} /> Cancel</button>
      )}
      {isMatched && (
        <div className="betFooter">Locked in · Pot: {money(bet.stake * 2)} · Admin settles the winner</div>
      )}
    </div>
  );
}

function BetForm({ profile, onLogin, toast, onClose }) {
  const [market, setMarket] = useState("cdl");
  const [pick, setPick] = useState("");
  const [stake, setStake] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!profile) return onLogin();
    const s = parseFloat(stake);
    if (!s || s < 1) return toast.error("Min bet is $1.");
    if (s > 100) return toast.error("Max bet is $100.");
    if (!pick.trim()) return toast.error("Pick a team or streamer.");
    setSubmitting(true);
    const { error } = await proposeSideBet(pick.trim(), market, s);
    setSubmitting(false);
    if (error) return toast.error(error);
    toast.success("Bet posted!");
    setPick("");
    setStake("");
    onClose();
  }

  return (
    <form className="betForm" onSubmit={submit}>
      <div className="betFormHead">
        <Trophy size={14} /> <b>New Side Bet</b>
        <button type="button" className="btn btn-ghost sm" onClick={onClose}><X size={12} /></button>
      </div>
      <div className="betFormRow">
        <label>Market</label>
        <div className="betMarketToggle">
          <button type="button" className={market === "cdl" ? "on" : ""} onClick={() => { setMarket("cdl"); setPick(""); }}>CDL Team</button>
          <button type="button" className={market === "streamer" ? "on" : ""} onClick={() => { setMarket("streamer"); setPick(""); }}>Streamer</button>
        </div>
      </div>
      {market === "cdl" ? (
        <div className="betFormRow">
          <label>Pick a team</label>
          <select className="field sm" value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Select…</option>
            {CDL_TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      ) : (
        <div className="betFormRow">
          <label>Streamer name</label>
          <input className="field sm" value={pick} onChange={(e) => setPick(e.target.value)} placeholder="e.g. Scump" />
        </div>
      )}
      <div className="betFormRow">
        <label>Stake ($1–$100)</label>
        <input className="field sm" type="number" min="1" max="100" step="1" value={stake} onChange={(e) => setStake(e.target.value)} placeholder="5" />
      </div>
      <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? "Posting…" : "Post Bet"}</button>
    </form>
  );
}
