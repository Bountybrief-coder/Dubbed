import { useEffect } from "react";

export function useWebVitals() {
  useEffect(() => {
    if (typeof PerformanceObserver === "undefined") return;

    const observers = [];

    try {
      const lcp = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) performance.mark("dubbed:lcp", { detail: Math.round(last.startTime) });
      });
      lcp.observe({ type: "largest-contentful-paint", buffered: true });
      observers.push(lcp);
    } catch {}

    try {
      const cls = new PerformanceObserver((list) => {
        let shift = 0;
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) shift += entry.value;
        }
        if (shift > 0) performance.mark("dubbed:cls", { detail: Math.round(shift * 1000) / 1000 });
      });
      cls.observe({ type: "layout-shift", buffered: true });
      observers.push(cls);
    } catch {}

    try {
      const inp = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 0) {
            performance.mark("dubbed:inp", { detail: Math.round(entry.duration) });
          }
        }
      });
      inp.observe({ type: "event", buffered: true, durationThreshold: 16 });
      observers.push(inp);
    } catch {}

    return () => observers.forEach((o) => o.disconnect());
  }, []);
}
