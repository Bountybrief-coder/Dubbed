import React, { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";

export function ConnectionBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOff = () => setOffline(true);
    const goOn = () => setOffline(false);
    window.addEventListener("offline", goOff);
    window.addEventListener("online", goOn);
    return () => {
      window.removeEventListener("offline", goOff);
      window.removeEventListener("online", goOn);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="connectionBanner">
      <WifiOff size={14} />
      <span>You're offline. Reconnecting…</span>
    </div>
  );
}
