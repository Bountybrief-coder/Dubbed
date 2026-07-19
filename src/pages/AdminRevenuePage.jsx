import React, { useState, useCallback, useEffect } from "react";
import { ShieldCheck, DollarSign, TrendingUp, Wallet, ArrowDownRight, ArrowUpRight, PiggyBank } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useToast } from "../hooks/useToast.jsx";
import { supabase } from "../lib/supabase";
import { SkeletonRows, Skeleton } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { money, shortDate } from "../utils/format";

const SOURCE_LABELS = {
  match_rake: "Match Rake",
  tournament_fee: "Tournament Fee",
  side_bet_rake: "Side Bet Rake",
};
const SOURCE_COLORS = {
  match_rake: "var(--neon)",
  tournament_fee: "var(--gold)",
  side_bet_rake: "var(--violet)",
};

export function AdminRevenuePage() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: d, error } = await supabase.rpc("get_revenue_dashboard");
    if (error) toast.error(error.message);
    else setData(d);
    setLoading(false);
  }, []); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  if (!isAdmin) return <main className="page"><EmptyState icon={ShieldCheck} title="Admins only" /></main>;

  return (
    <main className="page">
      <div className="pageHead">
        <div className="eyebrow">ADMIN</div>
        <h1><DollarSign size={22} style={{ verticalAlign: "middle" }} /> Revenue</h1>
        <p className="sub">Every dollar the platform earns from match rake, tournament fees, and side bet cuts. Tracked automatically.</p>
      </div>

      {loading ? <Skeleton h={200} r={14} /> : !data ? <EmptyState title="No data" /> : (
        <>
          <section className="wdStatGrid revStats">
            <div className="wdStat">
              <small>ALL TIME</small>
              <b className="win">{money(data.total)}</b>
              <em>Total platform revenue</em>
            </div>
            <div className="wdStat">
              <small>TODAY</small>
              <b className="win">{money(data.today)}</b>
            </div>
            <div className="wdStat">
              <small>7 DAYS</small>
              <b className="win">{money(data.week)}</b>
            </div>
            <div className="wdStat">
              <small>30 DAYS</small>
              <b className="win">{money(data.month)}</b>
            </div>
          </section>

          <section className="revSection">
            <h2>Revenue by source</h2>
            <div className="revSourceGrid">
              {(data.by_source || []).map((s) => (
                <div className="revSourceCard" key={s.source}>
                  <div className="revSourceDot" style={{ background: SOURCE_COLORS[s.source] || "var(--muted)" }} />
                  <div className="revSourceInfo">
                    <b>{SOURCE_LABELS[s.source] || s.source}</b>
                    <span className="revSourceAmount">{money(s.total)}</span>
                  </div>
                  <span className="badge">{s.count} txn{s.count !== 1 ? "s" : ""}</span>
                </div>
              ))}
              {(data.by_source || []).length === 0 && <p className="subtle">No revenue yet. Revenue is tracked as matches and tournaments settle.</p>}
            </div>
          </section>

          <section className="revSection">
            <h2><PiggyBank size={16} /> Platform Financial Summary</h2>
            <div className="wdStatGrid">
              <div className="wdStat">
                <small><ArrowDownRight size={12} /> DEPOSITS IN</small>
                <b className="win">{money(data.deposits)}</b>
              </div>
              <div className="wdStat">
                <small><ArrowUpRight size={12} /> PAYOUTS OUT</small>
                <b>{money(data.payouts)}</b>
              </div>
              <div className="wdStat">
                <small><ArrowUpRight size={12} /> WITHDRAWALS</small>
                <b>{money(data.withdrawals)}</b>
              </div>
              <div className="wdStat">
                <small><Wallet size={12} /> USER BALANCES</small>
                <b>{money(data.user_balances)}</b>
              </div>
            </div>
          </section>

          <section className="revSection">
            <h2><TrendingUp size={16} /> Recent Revenue</h2>
            {(data.recent || []).length === 0 ? (
              <p className="subtle">No transactions yet.</p>
            ) : (
              <div className="adminWdList">
                {(data.recent || []).map((r) => (
                  <div className="adminWdRow" key={r.id}>
                    <div className="adminWdMain">
                      <div className="revSourceDot" style={{ background: SOURCE_COLORS[r.source] || "var(--muted)", width: 8, height: 8 }} />
                      <span className="badge">{SOURCE_LABELS[r.source] || r.source}</span>
                      <span className="adminWdAmount cash">{money(r.amount)}</span>
                    </div>
                    <div className="adminWdMeta">
                      <span>{shortDate(r.created_at)}</span>
                      {r.note && <small className="revNote">{r.note}</small>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
