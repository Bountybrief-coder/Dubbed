import React from "react";
import { Ghost, ChevronRight } from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";

export function NotFoundPage({ onNavigate }) {
  usePageMeta("Page not found", "That page doesn't exist. Head back and find a match.");
  return (
    <main className="page">
      <EmptyState
        icon={Ghost}
        title="404 — nothing here"
        action={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 4 }}>
            <Button variant="primary" onClick={() => onNavigate("home")}>Back to home <ChevronRight size={14} /></Button>
            <Button variant="ghost" onClick={() => onNavigate("matchfinder")}>Find a match</Button>
          </div>
        }
      >
        This page moved, closed out, or never existed. The lobbies are still running though.
      </EmptyState>
    </main>
  );
}
