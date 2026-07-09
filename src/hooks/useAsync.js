import { useEffect, useState, useCallback, useRef } from "react";
import { countdownParts } from "../utils/format";

// useAsync(fetcher, deps) → { data, loading, error, reload }
// fetcher returns { data, error } (our service convention).
export function useAsync(fetcher, deps = [], { immediate = true } = {}) {
  const [state, setState] = useState({ data: null, loading: immediate, error: null });
  const mounted = useRef(true);

  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const res = await fetcher();
    if (!mounted.current) return;
    setState({ data: res?.data ?? null, loading: false, error: res?.error ?? null });
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
