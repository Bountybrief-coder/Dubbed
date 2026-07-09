import React from "react";
import { Lock } from "lucide-react";
import { Button } from "./Button";

export function AuthGate({ onLogin, title = "Log in to continue", children }) {
  return (
    <div className="authGate">
      <div className="authGateIcon"><Lock size={26} /></div>
      <h2>{title}</h2>
      <p>{children || "This area is only available to signed-in members."}</p>
      <Button variant="primary" onClick={onLogin}>Log in / Sign up</Button>
    </div>
  );
}
