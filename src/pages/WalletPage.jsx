import React, { useState, useEffect } from "react";
import { Wallet, ArrowDownToLine, ArrowUpFromLine, Receipt, ShieldCheck, RefreshCw, ExternalLink, Clock, ShoppingBag } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useAsync } from "../hooks/useAsync";
import { useToast } from "../hooks/useToast.jsx";
import { useWithdrawals } from "../hooks/useWithdrawals";
import { getLedger, deposit, startStripeOnboarding, refreshStripeStatus } from "../services/walletService";
import { getPurchaseHistory } from "../services/shopService";
import { Modal } from "../components/Modal";
import { Button } from "../components/Button";
import { Skeleton, SkeletonRows } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { money, timeAgo, shortDate, estimatedArrival, WITHDRAWAL_PROCESSING_COPY } from "../utils/format";
import { validateEntry } from "../utils/validation";

const REASON_LABEL = {
  deposit: "Deposit", match_entry: "Match entry", match_payout: "Match payout",
  tournament_entry: "Tournament entry", tournament_payout: "Tournament payout",
  bet: "Side bet", withdrawal_hold: "Withdrawal (held)", withdrawal_refund: "Withdrawal refunded",
  withdrawal_paid: "Withdrawal paid", match_cancel_refund: "Match cancel refund",
  shop_username_change: "Shop · Username change", shop_stat_reset: "Shop · Stat reset",
  shop_wagr_membership: "Shop · WAGR membership", shop_refund: "Shop refund",
  shop_double_xp_token: "Shop · Double XP token", wagr_monthly_topup: "WAGR · $1 monthly top-up"
};

const WD_STATUS_LABEL = { pending: "pending", processing: "processing", paid: "paid", rejected: "rejected", approved: "processing" };
// Map every status onto an existing statusChip color class.
const WD_STATUS_CLASS = { pending: "s-pending", processing: "s-pending", approved: "s-pending", paid: "s-paid", rejected: "s-rejected" };

export function WalletPage() {
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();

  // Profile can be null briefly after auth — guard everything downstream.
  const profileId = profile?.id;
  const { data: ledger, loading, reload } = useAsync(
    () => profileId ? getLedger(profileId) : Promise.resolve({ data: [] }),
    [profileId]
  );
  const { data: purchases } = useAsync(
    () => profileId ? getPurchaseHistory(profileId) : Promise.resolve({ data: [] }),
    [profileId]
  );
  const wd = useWithdrawals(profileId);
  const [depOpen, setDepOpen] = useState(false);
  const [wdOpen, setWdOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const stripeReady = profile?.stripe_onboarding_complete && profile?.stripe_payouts_enabled;

  // On return from Stripe onboarding or deposit, handle the URL param.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("stripe") === "return") {
      (async () => {
        setSyncing(true);
        const res = await refreshStripeStatus();
        setSyncing(false);
        if (!res.error) { refreshProfile(); wd.reload(); toast.success("Payout account updated."); }
        window.history.replaceState({}, "", window.location.pathname);
      })();
    }
    const d = params.get("deposit");
    if (d === "success") { toast.success("Deposit complete! Balance updated."); reload(); refreshProfile(); }
    if (d === "cancel") toast.error("Deposit canceled.");
    if (d) window.history.replaceState({}, "", window.location.pathname);
  }, []); // eslint-disable-line

  // While profile is loading, show a skeleton — don't render the page.
  if (!profile) {
    return <main className="page"><Skeleton w="40%" h={28} /><div style={{ height: 16 }} /><SkeletonRows rows={3} height={60} /></main>;
  }

  async function connectStripe() {
    const res = await startStripeOnboarding("/wallet");
    if (res.error) return toast.error(res.error);
    if (res.url) window.location.href = res.url;
  }

  async function syncStripe() {
    setSyncing(true);
    const res = await refreshStripeStatus();
    setSyncing(false);
    if (res.error) return toast.error(res.error);
    refreshProfile(); wd.reload();
    toast.success("Payout account status refreshed.");
  }

  return (
    <main className="page">
      <div className="pageHead"><div className="eyebrow">WALLET</div><h1>Your balance</h1></div>

      <section className="walletTop2">
        <div className="walletBalCard">
          <span className="walletBalIcon"><Wallet size={22} /></span>
          <div><small>AVAILABLE BALANCE</small><b>{money(profile.balance)}</b></div>
        </div>
        <div className="walletActions">
          <Button variant="primary" onClick={() => setDepOpen(true)}><ArrowDownToLine size={16} /> Deposit</Button>
          <Button variant="ghost" onClick={() => setWdOpen(true)}><ArrowUpFromLine size={16} /> Withdraw</Button>
        </div>
      </section>

      {/* Withdrawal dashboard */}
      <section className="wdStatGrid">
        <div className="wdStat"><small>PENDING WITHDRAWALS</small><b className="gold">{money(wd.summary.pendingTotal)}</b><em>{wd.summary.pendingCount} in flight</em></div>
        <div className="wdStat"><small>LIFETIME WITHDRAWN</small><b className="win">{money(wd.summary.lifetime)}</b><em>paid out</em></div>
        <div className="wdStat"><small>LAST WITHDRAWAL</small><b>{wd.summary.last ? money(wd.summary.last.amount) : "-"}</b><em>{wd.summary.last ? shortDate(wd.summary.last.completed_at || wd.summary.last.created_at) : "no payouts yet"}</em></div>
      </section>

      {/* Stripe Connect gate */}
      {!stripeReady && (
        <section className="panel2 stripeGate">
          <h2><ShieldCheck size={16} /> Payout account</h2>
          <p className="modalNote">
            {profile.stripe_account_id
              ? "Your payout account isn't fully verified yet. Finish onboarding to enable withdrawals."
              : "Connect a payout account (Stripe Express) to withdraw. Onboarding takes a minute and is handled securely by Stripe."}
          </p>
          <div className="stripeGateStatus">
            <span className={`statusChip ${profile.stripe_onboarding_complete ? "s-paid" : "s-pending"}`}>Onboarding {profile.stripe_onboarding_complete ? "complete" : "incomplete"}</span>
            <span className={`statusChip ${profile.stripe_payouts_enabled ? "s-paid" : "s-pending"}`}>Payouts {profile.stripe_payouts_enabled ? "enabled" : "disabled"}</span>
            <span className="statusChip">{profile.stripe_verification_status || "unverified"}</span>
          </div>
          <div className="walletActions" style={{ marginTop: 14 }}>
            <Button variant="primary" onClick={connectStripe}>
              <ExternalLink size={15} /> {profile.stripe_account_id ? "Finish onboarding" : "Connect payout account"}
            </Button>
            {profile.stripe_account_id && (
              <Button variant="ghost" loading={syncing} onClick={syncStripe}><RefreshCw size={15} /> Refresh status</Button>
            )}
          </div>
        </section>
      )}

      {/* Withdrawal history */}
      <section className="panel2">
        <h2><ArrowUpFromLine size={16} /> Withdrawal history</h2>
        {wd.loading ? (
          <SkeletonRows rows={3} height={54} />
        ) : wd.requests.length === 0 ? (
          <EmptyState>No withdrawals yet. Once you request one, its status and arrival estimate show up here.</EmptyState>
        ) : (
          <div className="wdList">
            {wd.requests.map((w) => (
              <div className="wdHistRow" key={w.id}>
                <div className="wdHistMain">
                  <b>{money(w.amount)}</b>
                  <span className={`statusChip ${WD_STATUS_CLASS[w.status] || "s-pending"}`}>{WD_STATUS_LABEL[w.status] || w.status}</span>
                </div>
                <div className="wdHistMeta">
                  <span>{shortDate(w.created_at)}</span>
                  {w.status === "pending" || w.status === "processing" ? (
                    <span className="wdEta"><Clock size={12} /> {WITHDRAWAL_PROCESSING_COPY} · est. {estimatedArrival(w.created_at)}</span>
                  ) : w.status === "paid" ? (
                    <span className="win">Paid {shortDate(w.completed_at)}</span>
                  ) : w.status === "rejected" ? (
                    <span className="danger">{w.rejected_reason || "Rejected"}, refunded</span>
                  ) : null}
                  <small className="txId">#{(w.transaction_id || w.id).slice(0, 8)}</small>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel2">
        <h2><ShoppingBag size={16} /> Purchase history</h2>
        {(purchases || []).length === 0 ? (
          <EmptyState>No shop purchases yet. Memberships and account services show up here.</EmptyState>
        ) : (
          <div className="wdList">
            {(purchases || []).map((p) => (
              <div className="wdHistRow" key={p.id}>
                <div className="wdHistMain">
                  <b>{p.item_name}</b>
                  <span className={`statusChip ${p.status === "completed" ? "s-paid" : p.status === "refunded" || p.status === "failed" ? "s-rejected" : "s-pending"}`}>{p.status}</span>
                </div>
                <div className="wdHistMeta">
                  <span>{money(p.price)}</span>
                  <span className="badge">{p.payment_method}</span>
                  <span>{shortDate(p.created_at)}</span>
                  <small className="txId">#{(p.transaction_id || p.id).slice(0, 8)}</small>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel2">
        <h2><Receipt size={16} /> Transaction history</h2>
        {loading ? (
          <SkeletonRows rows={5} height={48} />
        ) : ledger.length === 0 ? (
          <EmptyState>No transactions yet. Deposits, entries and payouts show up here.</EmptyState>
        ) : (
          <div className="ledgerList">
            {ledger.filter((e) => Number(e.delta) !== 0 || e.reason === "withdrawal_paid").map((e) => (
              <div className="ledgerRow" key={e.id}>
                <span className="ledgerReason">{REASON_LABEL[e.reason] || e.reason}</span>
                <span className={`ledgerDelta ${e.delta >= 0 ? "pos" : "neg"}`}>
                  {e.delta > 0 ? "+" : ""}{e.delta === 0 ? "" : money(e.delta)}
                </span>
                <small>{timeAgo(e.created_at)}</small>
              </div>
            ))}
          </div>
        )}
      </section>

      <DepositModal open={depOpen} onClose={() => setDepOpen(false)} onDone={() => { reload(); refreshProfile(); }} />
      <WithdrawModal
        open={wdOpen}
        onClose={() => setWdOpen(false)}
        wd={wd}
        stripeReady={stripeReady}
        onConnect={connectStripe}
        onDone={() => { reload(); refreshProfile(); }}
      />
    </main>
  );

  function DepositModal({ open, onClose, onDone }) {
    const [amount, setAmount] = useState(25);
    const [busy, setBusy] = useState(false);
    return (
      <Modal open={open} onClose={onClose} eyebrow="DEPOSIT" title="Add funds" size="sm">
        <p className="modalNote">Card payments processed securely by Stripe. Funds appear in your balance immediately after checkout.</p>
        <label className="fieldLbl">Amount</label>
        <input className="field" type="number" min="5" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <div className="chipRow">{[10, 25, 50, 100].map((a) => (
          <button key={a} className={Number(amount) === a ? "on" : ""} onClick={() => setAmount(a)}>{money(a)}</button>
        ))}</div>
        <Button variant="primary" className="wide" loading={busy} onClick={async () => {
          const err = validateEntry(amount, { min: 5 });
          if (err) return toast.error(err);
          setBusy(true);
          const res = await deposit(amount);
          setBusy(false);
          if (res.error) return toast.error(res.error);
          toast.success(`Deposited ${money(amount)}.`);
          onDone(); onClose();
        }}>Deposit {money(Number(amount) || 0)}</Button>
      </Modal>
    );
  }

  function WithdrawModal({ open, onClose, wd, stripeReady, onConnect, onDone }) {
    const [amount, setAmount] = useState("");
    const [busy, setBusy] = useState(false);
    const max = wd.available;
    const blocked = wd.block;

    return (
      <Modal open={open} onClose={onClose} eyebrow="WITHDRAW" title="Request a withdrawal" size="sm">
        {!stripeReady ? (
          <>
            <p className="modalNote">You need a verified payout account before you can withdraw.</p>
            <Button variant="primary" className="wide" onClick={() => { onClose(); onConnect(); }}>
              <ExternalLink size={15} /> Connect payout account
            </Button>
          </>
        ) : blocked ? (
          <>
            <div className="errBanner">Withdrawals are on hold: {blocked}.</div>
            <p className="modalNote">Resolve the above and this will unlock automatically.</p>
          </>
        ) : (
          <>
            <p className="modalNote">
              Funds move to <b>pending</b> while Stripe processes the payout ({WITHDRAWAL_PROCESSING_COPY}). If a request is rejected, the money returns to your balance automatically.
            </p>
            <label className="fieldLbl">Amount (available {money(max)})</label>
            <input className="field" type="number" min="10" max={max} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Minimum $10" />
            <div className="chipRow">
              {[25, 50, 100].filter((a) => a <= max).map((a) => (
                <button key={a} className={Number(amount) === a ? "on" : ""} onClick={() => setAmount(a)}>{money(a)}</button>
              ))}
              {max >= 10 && <button className={Number(amount) === max ? "on" : ""} onClick={() => setAmount(max)}>Max</button>}
            </div>
            <Button variant="primary" className="wide" loading={busy} onClick={async () => {
              const n = Number(amount);
              if (!Number.isFinite(n) || n < 10) return toast.error("Minimum withdrawal is $10.");
              if (n > max) return toast.error("Amount exceeds available balance.");
              setBusy(true);
              const res = await wd.submit(n, `stripe:${profile.stripe_account_id}`);
              setBusy(false);
              if (res.error) return toast.error(res.error);
              toast.success("Withdrawal requested. Track it in your history.");
              onDone(); onClose();
            }}>Request {money(Number(amount) || 0)}</Button>
          </>
        )}
      </Modal>
    );
  }
}
