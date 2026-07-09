import React from "react";
import { Crosshair } from "lucide-react";
import { mapCardStyle, gameTag } from "../utils/mapImages";

export function MapCard({ map, game, size = "md", selected, onClick, showTag = false }) {
  const style = mapCardStyle(map, game);
  const tag = gameTag(game);

  return (
    <button
      className={`mapCard mapCard-${size} ${selected ? "selected" : ""}`}
      onClick={onClick}
      type="button"
      style={{
        background: style.background,
        "--map-accent": style.accent,
        "--map-glow": style.glow,
      }}
    >
      <div className="mapCardOverlay" />
      <div className="mapCardContent">
        <Crosshair size={size === "sm" ? 12 : size === "lg" ? 20 : 16} className="mapCardIcon" />
        <span className="mapCardName">{map}</span>
        {showTag && <span className="mapCardTag">{tag}</span>}
      </div>
      {selected && <div className="mapCardCheck" />}
    </button>
  );
}

export function MapBadge({ map, game }) {
  const style = mapCardStyle(map, game);
  return (
    <span
      className="mapBadge"
      style={{
        background: style.background,
        "--map-accent": style.accent,
      }}
    >
      <Crosshair size={11} />
      {map}
    </span>
  );
}
