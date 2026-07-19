import React, { useEffect, useState, useCallback } from "react";
import { DollarSign, Swords, Trophy } from "lucide-react";
import { getPlatformActivity } from "../services/activityService";
import { useOnlineCount } from "../hooks/useOnlineCount";
import { supabase } from "../lib/supabase";
import { clickable } from "../utils/a11y";
import { money, timeAgo } from "../utils/format";
import { shortForGame } from "../utils/games";

const REFRESH_MS = 15000;

function startsIn(ts) {
  if (!ts) return "soon";
  const ms = new Date(ts).getTime() - Date.now();
  if (ms <= 0) return "now";
  const m = Math.round(ms / 60000);
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  return `in ${h}h ${m % 60}m`;
}

function ActivityRow({ it, onNavigate }) {
  if (it.kind === "win") {
    const ctx = it.sub === "tournament" ? "a tournament"
      : it.sub === "bet" ? "a side bet"
      : it.game ? `a ${shortForGame(it.game)} ${it.sub}` : "a match";
    return (
      <li className="pulseRow">
        <span className="pulseIcon win"><DollarSign size={14} /></span>
        <span className="pulseText"><b>{it.actor}</b> won <b className="cash">{money(it.amount)}</b> in {ctx}</span>
        <span className="pulseTime">{timeAgo(it.at)}</span>
      </li>
    );
  }
  if (it.kind === "lobby") {
    return (
      <li className="pulseRow act" {...clickable(() => onNavigate?.("matchfinder"))}>
        <span className="pulseIcon lobby"><Swords size={14} /></span>
        <span className="pulseText">
          <b>{it.actor}</b> posted a <b>{shortForGame(it.game)} {it.sub}</b> {Number(it.amount) > 0 ? <>· <span className="cash">{money(it.amount)}</span></> : "XP"} lobby
        </span>
        <span className="pulseTime">{timeAgo(it.at)}</span>
      </li>
    );
  }
  return (
    <li className="pulseRow act" {...clickable(() => onNavigate?.("tournaments"))}>
      <span className="pulseIcon tourney"><Trophy size={14} /></span>
      <span className="pulseText"><b>{it.sub}</b> starts {startsIn(it.starts)}</span>
      <span className="pulseTime">{Number(it.amount) > 0 ? money(it.amount) : "Free"}</span>
    </li>
  );
}

export function LiveActivity({ onNavigate }) {
  const [items, setItems] = useState([]);
  const online = useOnlineCount();

  const load = useCallback(async () => {
    const { data } = await getPlatformActivity(18);
    setItems(data || []);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    const ch = supabase
      .channel("activity-pulse")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => load())
      .subscribe();
    return () => { clearInterval(id); supabase.removeChannel(ch); };
  }, [load]);

  return (
    <section className="pulse">
      <div className="pulseHead">
        <div className="pulseTitle"><span className="pulseDot" /> LIVE ACTIVITY</div>
        <div className="pulseOnline"><span className="onlineDot" /> {(online || 1).toLocaleString()} online</div>
      </div>
      {items.length === 0 ? (
        <div className="pulseEmpty">
          The arena's quiet right now — <button className="linkBtn" onClick={() => onNavigate?.("matchfinder")}>post the first lobby</button> and get it going.
        </div>
      ) : (
        <ul className="pulseList">
          {items.map((it, i) => <ActivityRow key={i} it={it} onNavigate={onNavigate} />)}
        </ul>
      )}
    </section>
  );
}
