import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

// Live count of people currently on the site, via Supabase Realtime Presence.
// Every visitor (logged in or not) joins the "online" channel and tracks itself;
// the count is the number of distinct presences.
export function useOnlineCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const key = Math.random().toString(36).slice(2);
    const channel = supabase.channel("online", { config: { presence: { key } } });
    channel
      .on("presence", { event: "sync" }, () => {
        setCount(Object.keys(channel.presenceState()).length);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") channel.track({ at: Date.now() });
      });
    return () => { supabase.removeChannel(channel); };
  }, []);
  return count;
}
