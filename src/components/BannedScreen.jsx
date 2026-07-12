import React from "react";
import { ShieldAlert, LogOut } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";

function formatCountdown(expiresAt) {
  const now = Date.now();
  const exp = new Date(expiresAt).getTime();
  const diff = exp - now;
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `${days} day${days !== 1 ? "s" : ""}, ${hours} hour${hours !== 1 ? "s" : ""} remaining`;
  if (hours > 0) return `${hours} hour${hours !== 1 ? "s" : ""} remaining`;
  return "Less than an hour remaining";
}

function formatDate(expiresAt) {
  return new Date(expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function BannedScreen() {
  const { profile, signOut } = useAuth();
  const reason = profile?.ban_reason || "Violation of platform rules";
  const expiresAt = profile?.ban_expires_at;
  const countdown = expiresAt ? formatCountdown(expiresAt) : null;

  return (
    <div className="bannedScreen">
      <div className="bannedCard">
        <div className="bannedIcon">
          <ShieldAlert size={48} />
        </div>
        <h1>Account Banned</h1>
        <div className="bannedInfo">
          <div className="bannedRow">
            <span className="bannedLabel">Reason</span>
            <span className="bannedValue">{reason}</span>
          </div>
          <div className="bannedRow">
            <span className="bannedLabel">Duration</span>
            <span className="bannedValue">
              {expiresAt ? (
                <>
                  {countdown ? <strong>{countdown}</strong> : <span>Expired — refreshing...</span>}
                  <small>Ban lifts: {formatDate(expiresAt)}</small>
                </>
              ) : (
                <strong>This ban is permanent.</strong>
              )}
            </span>
          </div>
        </div>
        <p className="bannedNote">You cannot create, join, or wager on matches while banned. If you believe this is an error, contact support.</p>
        <button className="btn btn-ghost bannedSignOut" onClick={signOut}>
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </div>
  );
}
