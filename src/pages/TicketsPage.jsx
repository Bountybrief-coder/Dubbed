import React from "react";
import {
  TicketCheck,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  Shield,
  HelpCircle,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useAsync } from "../hooks/useAsync";
import { supabase } from "../lib/supabase";
import { SkeletonRows } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { shortDate } from "../utils/format";

/* ── status badge config ─────────────────────────────────────── */

const STATUS_STYLE = {
  open:      { bg: "var(--neon, #22c5fb)",   color: "#000" },
  reviewing: { bg: "var(--gold, #ffc23c)",   color: "#000" },
  resolved:  { bg: "var(--green, #3ecf6e)",  color: "#000" },
  rejected:  { bg: "var(--danger, #ff4d5e)", color: "#fff" },
};

const STATUS_ICON = {
  open:      Clock,
  reviewing: AlertTriangle,
  resolved:  CheckCircle,
  rejected:  XCircle,
};

/* ── inline styles ───────────────────────────────────────────── */

const styles = {
  sectionTitle: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    fontSize: "1.05rem",
    fontWeight: 600,
    marginBottom: "0.75rem",
    marginTop: "1.5rem",
  },
  card: {
    padding: "0.85rem 1rem",
    marginBottom: "0.5rem",
    borderRadius: 10,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  cardTop: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "0.5rem",
  },
  matchLink: {
    fontWeight: 600,
    color: "var(--neon, #22c5fb)",
    cursor: "pointer",
    background: "none",
    border: "none",
    padding: 0,
    fontSize: "inherit",
    textDecoration: "none",
  },
  badge: (status) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: "0.3rem",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    padding: "0.18rem 0.55rem",
    borderRadius: 6,
    background: (STATUS_STYLE[status] || STATUS_STYLE.open).bg,
    color: (STATUS_STYLE[status] || STATUS_STYLE.open).color,
  }),
  meta: {
    fontSize: "0.82rem",
    opacity: 0.55,
    marginTop: "0.35rem",
  },
  reason: {
    fontSize: "0.88rem",
    marginTop: "0.3rem",
    lineHeight: 1.45,
  },
  resolution: {
    fontSize: "0.84rem",
    marginTop: "0.4rem",
    padding: "0.5rem 0.65rem",
    borderRadius: 8,
    background: "rgba(255,255,255,0.04)",
    borderLeft: "3px solid var(--green, #3ecf6e)",
  },
  evidenceLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.3rem",
    fontSize: "0.82rem",
    color: "var(--neon, #22c5fb)",
    textDecoration: "none",
    marginTop: "0.3rem",
  },
  faqSection: {
    marginBottom: "0.75rem",
  },
  faqTitle: {
    fontSize: "0.92rem",
    fontWeight: 600,
    marginBottom: "0.3rem",
  },
  faqBody: {
    fontSize: "0.84rem",
    opacity: 0.7,
    lineHeight: 1.5,
  },
};

/* ── ticket card ─────────────────────────────────────────────── */

function TicketCard({ ticket, type, onNavigate }) {
  const StatusIcon = STATUS_ICON[ticket.status] || Clock;
  const match = ticket.matches;
  const matchLabel = match?.code || `#${ticket.match_id}`;
  const resolutionNote = type === "dispute" ? ticket.resolution_note : ticket.admin_notes;

  return (
    <div style={styles.card}>
      <div style={styles.cardTop}>
        <button
          style={styles.matchLink}
          onClick={() => onNavigate("match", ticket.match_id)}
          title="Go to match"
        >
          {matchLabel}
        </button>

        {match?.game && <span className="badge">{match.game}</span>}
        {match?.mode && <span className="badge">{match.mode}</span>}

        <span style={styles.badge(ticket.status)}>
          <StatusIcon size={11} />
          {ticket.status}
        </span>
      </div>

      <div style={styles.meta}>{shortDate(ticket.created_at)}</div>

      {ticket.reason && <div style={styles.reason}>{ticket.reason}</div>}

      {type === "dispute" && ticket.evidence_url && /^https?:\/\//i.test(ticket.evidence_url) && (
        <a
          href={ticket.evidence_url}
          target="_blank"
          rel="noopener noreferrer"
          style={styles.evidenceLink}
        >
          <ExternalLink size={12} /> Evidence
        </a>
      )}

      {ticket.resolution && (
        <div style={styles.resolution}>
          <strong>Outcome:</strong> {ticket.resolution}
          {resolutionNote && (
            <div style={{ marginTop: "0.2rem", opacity: 0.8 }}>{resolutionNote}</div>
          )}
          {ticket.resolved_at && (
            <div style={{ marginTop: "0.15rem", fontSize: "0.78rem", opacity: 0.5 }}>
              Resolved {shortDate(ticket.resolved_at)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── main page ───────────────────────────────────────────────── */

export function TicketsPage({ onNavigate }) {
  const { user } = useAuth();
  const userId = user?.id;

  const {
    data: disputes,
    loading: dLoading,
    error: dError,
    reload: dReload,
  } = useAsync(
    () =>
      userId
        ? supabase
            .from("match_disputes")
            .select(
              "id, match_id, reason, evidence_url, status, resolution, resolution_note, created_at, resolved_at, matches(code, game, mode)"
            )
            .eq("opened_by", userId)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
    [userId]
  );

  const {
    data: escalations,
    loading: eLoading,
    error: eError,
    reload: eReload,
  } = useAsync(
    () =>
      userId
        ? supabase
            .from("escalation_tickets")
            .select(
              "id, match_id, reason, status, resolution, admin_notes, created_at, resolved_at, matches(code, game, mode)"
            )
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
    [userId]
  );

  const loading = dLoading || eLoading;
  const error = dError || eError;
  const hasDisputes = (disputes || []).length > 0;
  const hasEscalations = (escalations || []).length > 0;
  const empty = !loading && !hasDisputes && !hasEscalations;

  return (
    <main className="page">
      <div className="pageHead">
        <div className="eyebrow">SUPPORT</div>
        <h1>Your Tickets</h1>
        <p className="sub">Track your match disputes and escalations.</p>
      </div>

      {error && (
        <div className="errorState">
          <p>{error}</p>
          <button className="btn btn-ghost sm" onClick={() => { dReload(); eReload(); }}>Retry</button>
        </div>
      )}

      {loading && <SkeletonRows rows={4} height={72} />}

      {!loading && !error && empty && (
        <EmptyState icon={TicketCheck} title="No tickets yet">
          When you dispute a match or escalate an issue, it will show up here.
        </EmptyState>
      )}

      {/* ── Disputes ──────────────────────────────────────────── */}
      {hasDisputes && (
        <>
          <div style={styles.sectionTitle}>
            <AlertTriangle size={18} /> Disputes
          </div>
          {disputes.map((d) => (
            <TicketCard
              key={`d-${d.id}`}
              ticket={d}
              type="dispute"
              onNavigate={onNavigate}
            />
          ))}
        </>
      )}

      {/* ── Escalations ───────────────────────────────────────── */}
      {hasEscalations && (
        <>
          <div style={styles.sectionTitle}>
            <Shield size={18} /> Escalations
          </div>
          {escalations.map((e) => (
            <TicketCard
              key={`e-${e.id}`}
              ticket={e}
              type="escalation"
              onNavigate={onNavigate}
            />
          ))}
        </>
      )}

      {/* ── FAQ ───────────────────────────────────────────────── */}
      <section className="panel2" style={{ marginTop: "2rem" }}>
        <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "1rem", marginBottom: "0.75rem" }}>
          <HelpCircle size={18} /> Quick Help
        </h2>

        <div style={styles.faqSection}>
          <div style={styles.faqTitle}>How do disputes work?</div>
          <div style={styles.faqBody}>
            Either player can contest a result from the match room. Both sides submit proof (clips of the final scoreboard work best). Our team reviews and makes a final call, usually within 24 hours.
          </div>
        </div>

        <div style={styles.faqSection}>
          <div style={styles.faqTitle}>How do I deposit or withdraw?</div>
          <div style={styles.faqBody}>
            Go to your Wallet. Deposit with crypto via secure checkout. To withdraw, add your wallet address and hit "Request Payout." Minimum $5, crypto payouts confirm within minutes.
          </div>
        </div>

        <div style={styles.faqSection}>
          <div style={styles.faqTitle}>What about the rake?</div>
          <div style={styles.faqBody}>
            5% standard, 0% for WAGR members. Only taken from the winner's payout.
          </div>
        </div>

        <div style={{ marginTop: "0.75rem" }}>
          <span style={{ fontSize: "0.84rem", opacity: 0.6 }}>Need more help? DM us on X: </span>
          <a
            href="https://x.com/dubbedgg"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.3rem",
              color: "var(--neon, #22c5fb)",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "0.84rem",
            }}
          >
            @dubbedgg <ExternalLink size={12} />
          </a>
        </div>
      </section>
    </main>
  );
}
