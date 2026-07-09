import React from "react";

export function RankStar({ rank, size = 64 }) {
  return (
    <div className="rankStar" style={{ width: size, height: size }}>
      <img src={rank.img} alt={rank.name} />
    </div>
  );
}
