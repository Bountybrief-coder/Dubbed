import React, { useState, useEffect } from "react";
import { Wallet, ArrowDownToLine, ArrowUpFromLine, Receipt, ShieldCheck, Clock, ShoppingBag, Copy, Check } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useAsync } from "../hooks/useAsync";
import { useVisibilityRefresh } from "../hooks/useVisibilityRefresh";
import { useToast } from "../hooks/useToast.jsx";
import { useConfirm } from "../hooks/useConfirm.jsx";
import { useWithdrawals } from "../hooks/useWithdrawals";
import { getLedger, deposit, saveCryptoWallet } from "../services/walletService";
import { getPurchaseHistory } from "../services/shopService";
import { Modal } from "../components/Modal";
import { Button } from "../components/Button";
import { Skeleton, SkeletonRows } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { money, timeAgo, shortDate, estimatedArrival, WITHDRAWAL_PROCESSING_COPY } from "../utils/format";
import { validateEntry } from "../utils/validation";
import { track } from "../utils/analytics";
import { calculateWithdrawalFee, calculateWithdrawalNet, WITHDRAWAL_FEE } from "../utils/games";

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
const WD_STATUS_CLASS = { pending: "s-pending", processing: "s-pending", approved: "s-pending", paid: "s-paid", rejected: "s-rejected" };

const CRYPTO_NETWORKS = [
  { value: "usdttrc20", label: "USDT (TRC-20)" },
  { value: "usdterc20", label: "USDT (ERC-20)" },
  { value: "btc", label: "Bitcoin (BTC)" },
  { value: "eth", label: "Ethereum (ETH)" },
  { value: "ltc", label: "Litecoin (LTC)" },
  { value: "sol", label: "Solana (SOL)" },
];

export function WalletPage() {
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const profileId = profile?.id;
  const { data: ledger, loading, error, reload } = useAsync(
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
  const [walletSetupOpen, setWalletSetupOpen] = useState(false);

  useVisibilityRefresh(reload, [profileId]);

  const cryptoReady = !!profile?.crypto_wallet_address;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const d = params.get("deposit");
    if (d === "success") { toast.success("Deposit complete! Balance updated."); reload(); refreshProfile(); }
    if (d === "cancel") toast.error("Deposit canceled.");
    if (d) window.history.replaceState({}, "", window.location.pathname);
  }, []); // eslint-disable-line

  if (!profile) {
    return <main className="page"><Skeleton w="40%" h={28} /><div style={{ height: 16 }} /><SkeletonRows rows={3} height={60} /></main>;
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

      {/* Crypto wallet gate */}
      {!cryptoReady && (
        <section className="panel2 payoutGate">
          <h2><ShieldCheck size={16} /> Payout wallet</h2>
          <p className="modalNote">
            Add your crypto wallet address to enable withdrawals. Payouts are sent directly to your wallet.
          </p>
          <div className="walletActions" style={{ marginTop: 14 }}>
            <Button variant="primary" onClick={() => setWalletSetupOpen(true)}>
              Set up payout wallet
            </Button>
          </div>
        </section>
      )}

      {cryptoReady && (
        <section className="panel2 payoutGate">
          <h2><ShieldCheck size={16} /> Payout wallet</h2>
          <div className="cryptoWalletInfo">
            <span className="badge accent">{(profile.crypto_wallet_currency || "usdttrc20").toUpperCase()}</span>
            <code className="walletAddr">{profile.crypto_wallet_address}</code>
            <Button variant="ghost" className="sm" onClick={() => setWalletSetupOpen(true)}>Change</Button>
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
                  {w.meta?.auto_approved && w.status === "processing" && <span className="statusChip s-paid" style={{ fontSize: 10 }}>auto</span>}
                  {w.meta?.auto_approved === false && w.status === "pending" && <span className="statusChip" style={{ fontSize: 10 }}>under review</span>}
                </div>
                <div className="wdHistMeta">
                  <span>{shortDate(w.created_at)}</span>
                  {w.status === "processing" && w.meta?.auto_approved ? (
                    <span className="wdEta"><Clock size={12} /> On its way · est. {estimatedArrival(w.processing_at || w.created_at)}</span>
                  ) : w.status === "pending" || w.status === "processing" ? (
                    <span className="wdEta"><Clock size={12} /> {w.status === "pending" ? "Under review" : WITHDRAWAL_PROCESSING_COPY} · est. {estimatedArrival(w.created_at)}</span>
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
        ) : error ? (
          <div className="errorState"><p>{error}</p><button className="btn btn-ghost sm" onClick={reload}>Retry</button></div>
        ) : ledger.length === 0 ? (
          <EmptyState>No transactions yet. Deposits, entries and payouts show up here.</EmptyState>
        ) : (
          <div className="ledgerList">
            {ledger.filter((e) => Number(e.delta) !== 0 || e.reason === "withdrawal_paid").map((e) => (
              <div className="ledgerRow" key={e.id}>
                <span className="ledgerReason">{REASON_LABEL[e.reason] || e.reason}</span>
                <span className={`ledgerDelta ${e.delta >= 0 ? "pos" : "neg"}`}>
                  {e.delta === 0 ? "—" : `${e.delta > 0 ? "+" : ""}${money(e.delta)}`}
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
        cryptoReady={cryptoReady}
        onSetupWallet={() => { setWdOpen(false); setWalletSetupOpen(true); }}
        onDone={() => { reload(); refreshProfile(); }}
      />
      <WalletSetupModal
        open={walletSetupOpen}
        onClose={() => setWalletSetupOpen(false)}
        current={profile.crypto_wallet_address}
        currentCurrency={profile.crypto_wallet_currency}
        onDone={() => { refreshProfile(); setWalletSetupOpen(false); }}
      />
    </main>
  );

  function DepositModal({ open, onClose, onDone }) {
    const [amount, setAmount] = useState(25);
    const [busy, setBusy] = useState(false);
    return (
      <Modal open={open} onClose={onClose} eyebrow="DEPOSIT" title="Add funds" size="sm">
        <p className="modalNote">Pay with crypto. You'll be redirected to a secure checkout where you can choose your coin. Funds appear in your balance once the transaction confirms on-chain.</p>
        <label className="fieldLbl">Amount (USD)</label>
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
          track.deposit(Number(amount));
          toast.success(`Redirecting to payment...`);
          onDone(); onClose();
        }}>Deposit {money(Number(amount) || 0)}</Button>
      </Modal>
    );
  }

  function WithdrawModal({ open, onClose, wd, cryptoReady, onSetupWallet, onDone }) {
    const [amount, setAmount] = useState("");
    const [busy, setBusy] = useState(false);
    const max = wd.available;
    const blocked = wd.block;

    return (
      <Modal open={open} onClose={onClose} eyebrow="WITHDRAW" title="Request a withdrawal" size="sm">
        {!cryptoReady ? (
          <>
            <p className="modalNote">You need a crypto wallet address before you can withdraw.</p>
            <Button variant="primary" className="wide" onClick={onSetupWallet}>
              Set up payout wallet
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
              Most withdrawals are auto-approved and sent instantly. Crypto payouts typically confirm within minutes. Higher amounts or first-time withdrawals go through a quick manual review.
            </p>
            <p className="modalNote" style={{ fontSize: 12, color: "var(--text2)" }}>
              Fee: {WITHDRAWAL_FEE.percent * 100}% + {money(WITHDRAWAL_FEE.flat)} per withdrawal.
            </p>
            <label className="fieldLbl">Amount (available {money(max)})</label>
            <input className="field" type="number" min="5" max={max} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Minimum $5" />
            <div className="chipRow">
              {[25, 50, 100].filter((a) => a <= max).map((a) => (
                <button key={a} className={Number(amount) === a ? "on" : ""} onClick={() => setAmount(a)}>{money(a)}</button>
              ))}
              {max >= 5 && <button className={Number(amount) === max ? "on" : ""} onClick={() => setAmount(max)}>Max</button>}
            </div>
            {Number(amount) >= 5 && (
              <div className="wdFeeBreakdown">
                <div className="wdFeeRow"><span>Withdrawal</span><b>{money(amount)}</b></div>
                <div className="wdFeeRow"><span>Fee ({WITHDRAWAL_FEE.percent * 100}% + {money(WITHDRAWAL_FEE.flat)})</span><b className="danger">-{money(calculateWithdrawalFee(amount))}</b></div>
                <div className="wdFeeRow total"><span>You receive</span><b className="win">{money(calculateWithdrawalNet(amount))}</b></div>
              </div>
            )}
            <Button variant="primary" className="wide" loading={busy} onClick={async () => {
              const n = Number(amount);
              if (!Number.isFinite(n) || n < 5) return toast.error("Minimum withdrawal is $5.");
              if (n > max) return toast.error("Amount exceeds available balance.");
              setBusy(true);
              const res = await wd.submit(n, `crypto:${profile.crypto_wallet_address}`);
              setBusy(false);
              if (res.error) return toast.error(res.error);
              track.withdraw(n);
              toast.success(res.data?.auto_approved
                ? "Auto-approved. On its way!"
                : "Withdrawal submitted for review.");
              onDone(); onClose();
            }}>Request {money(Number(amount) || 0)} (receive {money(calculateWithdrawalNet(Number(amount) || 0))})</Button>
          </>
        )}
      </Modal>
    );
  }

  function WalletSetupModal({ open, onClose, current, currentCurrency, onDone }) {
    const [address, setAddress] = useState(current || "");
    const [currency, setCurrency] = useState(currentCurrency || "usdttrc20");
    const [busy, setBusy] = useState(false);
    return (
      <Modal open={open} onClose={onClose} eyebrow="PAYOUT SETUP" title="Crypto wallet address" size="sm">
        <p className="modalNote">Enter the wallet address where you want to receive withdrawals. Make sure it matches the selected network.</p>
        <label className="fieldLbl">Network</label>
        <select className="field" value={currency} onChange={(e) => setCurrency(e.target.value)}>
          {CRYPTO_NETWORKS.map((n) => (
            <option key={n.value} value={n.value}>{n.label}</option>
          ))}
        </select>
        <label className="fieldLbl">Wallet address</label>
        <input className="field" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Enter your wallet address" />
        <Button variant="primary" className="wide" loading={busy} onClick={async () => {
          if (!address.trim() || address.trim().length < 10) return toast.error("Enter a valid wallet address.");
          if (current && address.trim() !== current) {
            const ok = await confirm({
              title: "Change payout wallet?",
              message: "All future withdrawals will be sent to this new address. Crypto payouts are irreversible — double-check it's correct.",
              confirmLabel: "Change wallet",
            });
            if (!ok) return;
          }
          setBusy(true);
          const res = await saveCryptoWallet(address.trim(), currency);
          setBusy(false);
          if (res.error) return toast.error(res.error);
          toast.success("Payout wallet saved.");
          onDone();
        }}>Save wallet address</Button>
      </Modal>
    );
  }
}
