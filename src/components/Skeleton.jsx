import React from "react";

// Shimmer placeholder. Use for loading states before data arrives.
export function Skeleton({ w = "100%", h = 16, r = 8, style }) {
  return <span className="skeleton" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

export function SkeletonRows({ rows = 4, height = 64 }) {
  return (
    <div className="skeletonRows">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeletonRow" style={{ height }}>
          <Skeleton w={44} h={44} r={10} />
          <div className="skeletonRowText">
            <Skeleton w="40%" h={13} />
            <Skeleton w="24%" h={11} />
          </div>
          <Skeleton w={70} h={30} r={8} />
        </div>
      ))}
    </div>
  );
}
