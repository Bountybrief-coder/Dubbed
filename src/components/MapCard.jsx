import React from "react";
import { Crosshair } from "lucide-react";
import { mapCardStyle, gameTag, mapImage } from "../utils/mapImages";

export function MapCard({ map, game, size = "md", selected, onClick, showTag = false }) {
  const style = mapCardStyle(map, game);
  const tag = gameTag(game);
  const img = mapImage(map);

  return (
    <button
      className={`mapCard mapCard-${size} ${selected ? "selected" : ""}`}
      onClick={onClick}
      type="button"
      style={{
        "--map-accent": style.accent,
        "--map-glow": style.glow,
      }}
    >
      {img ? (
        <img className="mapCardImg" src={img} alt={map} loading="lazy" />
      ) : null}
      <div className="mapCardOverlay" style={img ? undefined : { background: style.background }} />
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
  const img = mapImage(map);
  return (
    <span
      className="mapBadge"
      style={{
        background: img ? undefined : style.background,
        "--map-accent": style.accent,
      }}
    >
      {img && <img className="mapBadgeImg" src={img} alt="" loading="lazy" />}
      <Crosshair size={11} />
      {map}
    </span>
  );
}
