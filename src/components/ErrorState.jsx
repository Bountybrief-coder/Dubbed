import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export function ErrorState({ error, onRetry }) {
  return (
    <div className="errorState">
      <AlertTriangle size={22} />
      <p>{typeof error === "string" ? error : "Failed to load. Please try again."}</p>
      {onRetry && (
        <button className="btn btn-ghost sm" onClick={onRetry}>
          <RefreshCw size={14} /> Retry
        </button>
      )}
    </div>
  );
}
