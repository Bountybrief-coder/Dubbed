import React from "react";
import { HelpCircle, ExternalLink } from "lucide-react";

export function SupportPage() {
  return (
    <main className="page">
      <div className="pageHead">
        <div className="eyebrow">HELP CENTER</div>
        <h1>Support</h1>
        <p className="sub">Check the FAQ below or hit us up on X for a faster response.</p>
      </div>

      <section className="panel2" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <HelpCircle size={20} />
          Contact Us
        </h2>
        <p>DM us on X — it's the fastest way to get a response. We're usually on it.</p>
        <p style={{ marginTop: "0.75rem" }}>
          <a
            href="https://x.com/dubbedgg"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              color: "var(--neon)",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            @dubbedgg <ExternalLink size={14} />
          </a>
        </p>
      </section>

      <section className="panel2 rulesSection">
        <h2>How do I deposit or withdraw funds?</h2>
        <p>Go to your Wallet. Deposit with any card through Stripe. To withdraw, hit "Request Payout" — minimum is $5, and it typically lands in 1-3 business days.</p>
      </section>

      <section className="panel2 rulesSection">
        <h2>How does the rake work?</h2>
        <p>Dubbed takes a small cut from cash match winnings — 5% standard, 2% for WAGR members. The fee only comes from the winner's payout. If you lose, you pay nothing extra.</p>
      </section>

      <section className="panel2 rulesSection">
        <h2>What if we disagree on who won?</h2>
        <p>Either player can contest the result directly from the match room. Both sides submit proof — clips of the final scoreboard work best. Our team reviews the evidence and makes a final call, usually within 24 hours.</p>
      </section>

      <section className="panel2 rulesSection">
        <h2>How do I earn XP?</h2>
        <p>Every completed match gives XP — more for a win, less for a loss. XP determines your rank (Rookie → Elite → Legend → Master) and your leaderboard position.</p>
      </section>

      <section className="panel2 rulesSection">
        <h2>What are the rank tiers?</h2>
        <p>There are four rank tiers: Rookie (0 XP, blue), Elite (25,000 XP, purple), Legend (75,000 XP, red), and Master (150,000 XP, gold). Each tier comes with a unique star badge displayed on your profile and in matches.</p>
      </section>

      <section className="panel2 rulesSection">
        <h2>How do tournaments work?</h2>
        <p>Single-elimination brackets. Join before it starts, play your matches, win to advance. The prize pool grows with each entry. Same rules as regular wagers.</p>
      </section>

      <p style={{ textAlign: "center", marginTop: "2rem", opacity: 0.6, fontSize: "0.9rem" }}>
        Looking for the rules? <a href="/rules" style={{ color: "var(--neon)" }}>Read our Rules page</a>
      </p>
    </main>
  );
}
