import { useEffect, useRef } from "react";

export function useVisibilityRefresh(callback, deps = []) {
  const cb = useRef(callback);
  cb.current = callback;

  useEffect(() => {
    let staleTimer;
    const STALE_MS = 30000;

    const onVisible = () => {
      if (document.visibilityState === "visible" && staleTimer) {
        cb.current();
        staleTimer = null;
      }
    };

    const onHidden = () => {
      if (document.visibilityState === "hidden") {
        staleTimer = Date.now();
      }
    };

    const onChange = () => {
      if (document.visibilityState === "hidden") {
        staleTimer = Date.now();
      } else if (staleTimer && Date.now() - staleTimer > STALE_MS) {
        cb.current();
        staleTimer = null;
      }
    };

    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}
