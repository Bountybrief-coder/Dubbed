import React from "react";
import { useCountdown } from "../hooks/useAsync";

export function Countdown({ to }) {
  const { d, h, m, s } = useCountdown(to);
  const p = (n) => String(n).padStart(2, "0");
  return <span className="countdown">{d}d {p(h)}h {p(m)}m {p(s)}s</span>;
}
