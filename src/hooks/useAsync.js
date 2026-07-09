import { useEffect, useState, useCallback, useRef } from "react";
import { countdownParts } from "../utils/format";

function raceTimeout(promise, ms) {
  if (!ms || ms <= 0) return promise;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Request timed out")), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

// useAsync(fetcher, deps, opts) → { data, loading, error, reload, setData }
// fetcher returns { data, error } (our service convention).
// opts.timeout: ms before auto-fail (default 12000). opts.keepStale: show previous data while re-fetching.
export function useAsync(fetcher, deps = [], { immediate = true, timeout = 12000, keepStale = false } = {}) {
  const [state, setState] = useState({ data: null, loading: immediate, error: null });
  const mounted = useRef(true);

  const run = useCallback(async () => {
    setState((s) => ({
      data: keepStale ? s.data : null,
      loading: true,
      error: null,
    }));
    try {
      const res = await raceTimeout(fetcher(), timeout);
      if (!mounted.current) return;
      setState({ data: res?.data ?? null, loading: false, error: res?.error ?? null });
    } catch (err) {
      if (!mounted.current) return;
      setState((s) => ({ data: keepStale ? s.data : null, loading: false, error: err.message || "Something went wrong" }));
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    mounted.current = true;
    if (immediate) run();
    return () => { mounted.current = false; };
  }, [run, immediate]);

  return { ...state, reload: run, setData: (d) => setState((s) => ({ ...s, data: d })) };
}

// Ticking countdown that re-renders every second.
export function useCountdown(toMs) {
  const [parts, setParts] = useState(() => countdownParts(toMs));
  useEffect(() => {
    const id = setInterval(() => setParts(countdownParts(toMs)), 1000);
    return () => clearInterval(id);
  }, [toMs]);
  return parts;
}
