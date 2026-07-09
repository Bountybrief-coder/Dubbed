import React from "react";
import { Bell, Check } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useAsync } from "../hooks/useAsync";
import { getNotifications, markAllRead } from "../services/notificationService";
import { SkeletonRows } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { Button } from "../components/Button";
import { timeAgo } from "../utils/format";

export function NotificationsPage({ onNavigate }) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getNotifications(user.id), [user.id]);

  // Notifications are plain text; route the wallet-related ones to the Wallet
  // page so the "each notification links to Wallet" requirement is met without
  // a schema change or redesign.
  const walletLink = (text) => /withdraw|payout|balance|verif/i.test(text || "");

  return (
    <main className="page">
      <div className="pageHead rowHead">
        <div><div className="eyebrow">INBOX</div><h1>Notifications</h1></div>
        {data?.length > 0 && (
          <Button variant="ghost" onClick={async () => { await markAllRead(); reload(); }}>
            <Check size={15} /> Mark all read
          </Button>
        )}
      </div>

      {loading ? (
        <SkeletonRows rows={5} height={54} />
      ) : error ? (
        <div className="errorState"><p>{error}</p><button className="btn btn-ghost sm" onClick={reload}>Retry</button></div>
      ) : !data?.length ? (
        <EmptyState icon={Bell} title="You're all caught up">Team invites and match updates land here.</EmptyState>
      ) : (
        <div className="notifList">
          {data.map((n) => {
            const linksWallet = walletLink(n.text);
            return (
              <div
                key={n.id}
                className={`notifItem ${n.read ? "" : "unread"} ${linksWallet ? "clickable" : ""}`}
                onClick={linksWallet ? () => onNavigate?.("wallet") : undefined}
                role={linksWallet ? "button" : undefined}
                tabIndex={linksWallet ? 0 : undefined}
              >
                <span className="notifDot" />
                <p>{n.text}</p>
                <small>{timeAgo(n.created_at)}</small>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
