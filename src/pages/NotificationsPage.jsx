import React, { useState, useMemo } from "react";
import { Bell, Check, Trophy, DollarSign, Swords, Users, Shield, AlertTriangle, Gift, Star, ChevronRight, Inbox, Trash2, X } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useAsync } from "../hooks/useAsync";
import { useVisibilityRefresh } from "../hooks/useVisibilityRefresh";
import { getNotifications, markRead, markAllRead, deleteNotification, clearAllNotifications } from "../services/notificationService";
import { SkeletonRows } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { Button } from "../components/Button";
import { timeAgo } from "../utils/format";

function classifyNotif(text) {
  const t = (text || "").toLowerCase();
  if (/trophy|tournament|bracket|1st|2nd|3rd|winner|placed/.test(t))
    return { icon: Trophy, cls: "notifTrophy", label: "Tournament" };
  if (/withdraw|payout|deposit|balance|wallet|cash.*out|crypto/.test(t))
    return { icon: DollarSign, cls: "notifWallet", label: "Wallet" };
  if (/match|lobby|joined|settled|report|dispute|forfeit|no.show/.test(t))
    return { icon: Swords, cls: "notifMatch", label: "Match" };
  if (/team|invite|roster|member|captain|kicked/.test(t))
    return { icon: Users, cls: "notifTeam", label: "Team" };
  if (/ban|warn|suspend|admin|review/.test(t))
    return { icon: Shield, cls: "notifAdmin", label: "Admin" };
  if (/wagr|membership|shop|purchase|refund/.test(t))
    return { icon: Gift, cls: "notifShop", label: "Shop" };
  if (/xp|rank|level|streak|leaderboard|weekly/.test(t))
    return { icon: Star, cls: "notifXP", label: "XP" };
  return { icon: Bell, cls: "notifGeneral", label: "Update" };
}

function groupByDate(items) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const weekStart = todayStart - 6 * 86400000;

  const groups = [];
  let current = null;

  for (const n of items) {
    const ts = new Date(n.created_at).getTime();
    let label;
    if (ts >= todayStart) label = "Today";
    else if (ts >= yesterdayStart) label = "Yesterday";
    else if (ts >= weekStart) label = "This Week";
    else label = "Earlier";

    if (label !== current) {
      current = label;
      groups.push({ label, items: [] });
    }
    groups[groups.length - 1].items.push(n);
  }
  return groups;
}

function routeForNotif(text) {
  const t = (text || "").toLowerCase();
  if (/withdraw|payout|deposit|balance|wallet|cash.*out|crypto/.test(t)) return "wallet";
  if (/tournament|bracket/.test(t)) return "tournaments";
  if (/team|invite|roster/.test(t)) return "teams";
  if (/leaderboard/.test(t)) return "leaderboard";
  return null;
}

export function NotificationsPage({ onNavigate }) {
  const { user } = useAuth();
  const { data, loading, error, reload, setData } = useAsync(() => getNotifications(user.id), [user.id]);
  const [markingAll, setMarkingAll] = useState(false);
  const [clearing, setClearing] = useState(false);

  useVisibilityRefresh(reload, [user.id]);

  const unreadCount = useMemo(() => (data || []).filter((n) => !n.read).length, [data]);
  const groups = useMemo(() => groupByDate(data || []), [data]);

  async function handleMarkAll() {
    setMarkingAll(true);
    await markAllRead();
    setData((data || []).map((n) => ({ ...n, read: true })));
    setMarkingAll(false);
  }

  async function handleClearAll() {
    setClearing(true);
    await clearAllNotifications(user.id);
    setData([]);
    setClearing(false);
  }

  function handleDelete(e, id) {
    e.stopPropagation();
    deleteNotification(id);
    setData((data || []).filter((n) => n.id !== id));
  }

  async function handleClick(n) {
    if (!n.read) {
      markRead(n.id);
      setData((data || []).map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    const route = routeForNotif(n.text);
    if (route) onNavigate?.(route);
  }

  return (
    <main className="page">
      <div className="pageHead rowHead">
        <div>
          <div className="eyebrow">INBOX</div>
          <h1>Notifications{unreadCount > 0 && <span className="notifCountBadge">{unreadCount}</span>}</h1>
          <p className="sub">Match updates, payouts, team invites, and tournament results.</p>
        </div>
        <div className="notifActions">
          {unreadCount > 0 && (
            <Button variant="ghost" onClick={handleMarkAll} loading={markingAll}>
              <Check size={15} /> Mark all read
            </Button>
          )}
          {data?.length > 0 && (
            <Button variant="ghost" onClick={handleClearAll} loading={clearing}>
              <Trash2 size={15} /> Clear all
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="notifSkeleton">
          <SkeletonRows rows={6} height={64} />
        </div>
      ) : error ? (
        <div className="errorState">
          <AlertTriangle size={22} />
          <p>{error}</p>
          <button className="btn btn-ghost sm" onClick={reload}>Retry</button>
        </div>
      ) : !data?.length ? (
        <EmptyState icon={Inbox} title="You're all caught up">
          Match results, wallet activity, team invites, and tournament updates will appear here.
        </EmptyState>
      ) : (
        <div className="notifGroups">
          {groups.map((group) => (
            <div className="notifGroup" key={group.label}>
              <div className="notifGroupLabel">{group.label}</div>
              <div className="notifGroupList">
                {group.items.map((n) => {
                  const { icon: Icon, cls, label } = classifyNotif(n.text);
                  const route = routeForNotif(n.text);
                  return (
                    <button
                      key={n.id}
                      className={`notifCard ${n.read ? "read" : "unread"} ${cls}`}
                      onClick={() => handleClick(n)}
                      aria-label={`${n.read ? "" : "Unread: "}${n.text}`}
                    >
                      <div className={`notifIconWrap ${cls}`}>
                        <Icon size={16} />
                      </div>
                      <div className="notifContent">
                        <div className="notifCardHead">
                          <span className="notifType">{label}</span>
                          <span className="notifTime">{timeAgo(n.created_at)}</span>
                        </div>
                        <p className="notifText">{n.text}</p>
                      </div>
                      {route && <ChevronRight size={14} className="notifArrow" />}
                      <span className="notifDelete" onClick={(e) => handleDelete(e, n.id)} title="Delete"><X size={14} /></span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
