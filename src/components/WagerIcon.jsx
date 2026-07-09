import React from "react";
import wager from "../assets/wager-icon.png";

// The coin/lightning wager mark — replaces the crossed-swords icon everywhere.
export function WagerIcon({ size = 18, className = "" }) {
  return (
    <img
      src={wager}
      alt=""
      width={size}
      height={size}
      className={`wagerIcon ${className}`}
      style={{ display: "inline-block", verticalAlign: "middle", objectFit: "contain" }}
    />
  );
}
