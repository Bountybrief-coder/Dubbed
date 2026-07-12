import React, { useState, useEffect } from "react";
import { Crown, PenLine, RotateCcw, Sparkles, Check, ExternalLink, Wallet, Zap } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useToast } from "../hooks/useToast.jsx";
import {
  SHOP_CATALOG, purchaseWithWallet, startCheckout, changeUsername,
  performStatReset, getUnusedStatReset, openBillingPortal
} from "../services/shopService";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { money } from "../utils/format";
import { validateUsername } from "../utils/validation";
import { track } from "../utils/analytics";
import wagrEmblem from "../assets/wagr-emblem.png";

const SERVICE_ICON = { username_change: PenLine, stat_reset: RotateCcw, double_xp_token: Zap };

export function ShopPage({ onLogin, onNavigate }) {
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [usernameOpen, setUsernameOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetAvailable, setResetAvailable] = useState(false);
  const [busyItem, setBusyItem] = useState(null);

  const [busyWagr, setBusyWagr] = useState(false);

  const wagr = SHOP_CATALOG.wagr_membership;
  const services = [SHOP_CATALOG.username_change, SHOP_CATALOG.stat_reset, SHOP_CATALOG.double_xp_token];

  const doubleXpActive = profile?.double_xp_active_until && new Date(profile.double_xp_active_until) > new Date();

  const canWalletWagr = profile && Number(profile.balance) >= wagr.price;

  useEffect(() => {
    if (!profile) return;
    getUnusedStatReset(profile.id).then(({ available }) => setResetAvailable(available));
  }, [profile]);

  // Handle Stripe Checkout return.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const c = params.get("checkout");
    if (c === "success") { toast.success("Purchase complete."); refreshProfile(); }
    if (c === "cancel") toast.error("Checkout canceled.");
    if (c) window.history.replaceState({}, "", window.location.pathname);
  }, []); // eslint-disable-line

  async function buyService(item) {
    if (!profile) return onLogin();
    // Wallet if sufficient, otherwise Stripe Checkout.
    if (Number(profile.balance) >= item.price) {
      setBusyItem(item.key);
      const res = await purchaseWithWallet(item.key);
      setBusyItem(null);
      if (res.error) return toast.error(res.error);
      track.shopPurchase(item.key, item.price);
      toast.success(`${item.name} purchased.`);
      refreshProfile();
      if (item.key === "username_change") setUsernameOpen(true);
      if (item.key === "stat_reset") { setResetAvailable(true); }
    } else {
      const res = await startCheckout(item.key, "/shop");
      if (res.error) return toast.error(res.error);
      if (res.url) window.location.href = res.url;
    }
  }

  async function subscribeWagr() {
    if (!profile) return onLogin();
    const res = await startCheckout("wagr_membership", "/shop");
    if (res.error) return toast.error(res.error);
    if (res.url) window.location.href = res.url;
  }

  async function manageMembership() {
    const res = await openBillingPortal("/shop");
    if (res.error) return toast.error(res.error);
    if (res.url) window.location.href = res.url;
  }

  const isMember = profile?.wagr_member;

  return (
    <main className="page">
      <div className="pageHead">
        <div className="eyebrow">SHOP</div>
        <h1>Shop</h1>
        <p className="sub">Memberships and account services. Tournament entries aren't sold here. Those come straight from your wallet at registration.</p>
      </div>

      {/* Memberships */}
      <h2 className="shopSectionH">Memberships</h2>
      <section className="shopMemberGrid">
        <div className={`shopMemberCard ${isMember ? "owned" : ""}`}>
          <div className="shopMemberTop">
            <img src={wagrEmblem} alt="WAGR" className="shopMemberEmblem" loading="lazy" />
            <div>
              <b>{wagr.name}</b>
              <small>{wagr.tagline}</small>
            </div>
            <span className="shopPriceTag">{money(wagr.price)}<em>/mo</em></span>
          </div>
          <ul className="shopBenefits">
            {wagr.benefits.map((b) => (
              <li key={b}><Check size={14} /> {b}</li>
            ))}
          </ul>
          {isMember ? (
            <div className="shopMemberOwned">
              <span className="badge accent"><Crown size={12} /> WAGR Member</span>
              {profile?.subscription_provider === "stripe" && (
                <Button variant="ghost" onClick={manageMembership}><ExternalLink size={14} /> Manage / cancel</Button>
              )}
              {profile?.subscription_end && (
                <small className="subtle">Active until {new Date(profile.subscription_end).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</small>
              )}
            </div>
          ) : (
            <div className="shopMemberActions">
              <Button variant="primary" className="wide" loading={busyWagr} onClick={async () => {
                if (!profile) return onLogin();
                if (canWalletWagr) {
                  setBusyWagr(true);
                  const res = await purchaseWithWallet("wagr_membership");
                  setBusyWagr(false);
                  if (res.error) return toast.error(res.error);
                  track.wagrUpgrade();
                  toast.success("WAGR Membership activated for 30 days.");
                  refreshProfile();
                } else {
                  subscribeWagr();
                }
              }}>
                {canWalletWagr
                  ? <><Wallet size={14} /> Buy 30 days · {money(wagr.price)}</>
                  : <>Subscribe · {money(wagr.price)}/mo</>
                }
              </Button>
              {canWalletWagr && (
                <Button variant="ghost" className="wide" onClick={subscribeWagr}>Or auto-renew with Stripe</Button>
              )}
              {profile && !canWalletWagr && (
                <small className="subtle">Balance {money(profile.balance)}. Pays via Stripe Checkout, or deposit funds first.</small>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Account Services */}
      <h2 className="shopSectionH">Account Services</h2>
      <section className="shopServiceGrid">
        {services.map((item) => {
          const Icon = SERVICE_ICON[item.key] || Sparkles;
          const canWallet = profile && Number(profile.balance) >= item.price;
          return (
            <div className="shopServiceCard" key={item.key}>
              <span className="shopPriceTag corner">{money(item.price)}</span>
              <div className="shopServiceArt"><Icon size={30} /></div>
              <b>{item.name}</b>
              <p>{item.tagline}</p>
              {item.key === "stat_reset" && resetAvailable && (
                <span className="badge accent" style={{ marginBottom: 10 }}>Ready to apply</span>
              )}
              {item.key === "double_xp_token" && doubleXpActive && (
                <span className="badge accent" style={{ marginBottom: 10 }}>Active until {new Date(profile.double_xp_active_until).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
              )}
              <div className="shopServiceActions">
                {item.key === "stat_reset" && resetAvailable ? (
                  <Button variant="primary" className="wide" onClick={() => setResetOpen(true)}>Apply stat reset</Button>
                ) : item.key === "username_change" && profile?.username_change_tokens > 0 ? (
                  <Button variant="primary" className="wide" onClick={() => setUsernameOpen(true)}>Use your change</Button>
                ) : (
                  <Button variant="primary" className="wide" loading={busyItem === item.key} onClick={() => buyService(item)}>
                    {canWallet ? <><Wallet size={14} /> Buy · {money(item.price)}</> : <>Checkout · {money(item.price)}</>}
                  </Button>
                )}
              </div>
              {profile && !canWallet && <small className="subtle">Balance {money(profile.balance)}. Pays via Stripe Checkout.</small>}
            </div>
          );
        })}
      </section>

      <UsernameModal open={usernameOpen} onClose={() => setUsernameOpen(false)} onDone={refreshProfile} />
      <StatResetModal open={resetOpen} onClose={() => setResetOpen(false)} onDone={() => { refreshProfile(); setResetAvailable(false); }} />
    </main>
  );

  function UsernameModal({ open, onClose, onDone }) {
    const [name, setName] = useState("");
    const [busy, setBusy] = useState(false);
    return (
      <Modal open={open} onClose={onClose} eyebrow="USERNAME CHANGE" title="Pick a new username" size="sm">
        <p className="modalNote">1–8 characters, no spaces, must be unique and not reserved. This uses one purchased change.</p>
        <label className="fieldLbl">New username</label>
        <input className="field" maxLength={8} value={name} onChange={(e) => setName(e.target.value)} placeholder="newname" />
        <Button variant="primary" className="wide" loading={busy} onClick={async () => {
          const err = validateUsername(name);
          if (err) return toast.error(err);
          setBusy(true);
          const res = await changeUsername(name);
          setBusy(false);
          if (res.error) return toast.error(res.error);
          toast.success("Username changed.");
          onDone(); onClose();
        }}>Change username</Button>
      </Modal>
    );
  }

  function StatResetModal({ open, onClose, onDone }) {
    const [confirm, setConfirm] = useState("");
    const [busy, setBusy] = useState(false);
    return (
      <Modal open={open} onClose={onClose} eyebrow="STAT RESET" title="Reset your stats?" size="sm">
        <div className="errBanner">This cannot be undone.</div>
        <p className="modalNote">This wipes: wins, losses, win %, average K/D, tournament placements, leaderboard position, XP, rank progress, and ELO/MMR.</p>
        <p className="modalNote">Kept: earnings, trophies, wallet balance, transaction history, purchase history, tournament history, and previous usernames.</p>
        <label className="fieldLbl">Type <b>RESET</b> to confirm</label>
        <input className="field" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="RESET" />
        <Button variant="danger" className="wide" loading={busy} disabled={confirm !== "RESET"} onClick={async () => {
          setBusy(true);
          const res = await performStatReset();
          setBusy(false);
          if (res.error) return toast.error(res.error);
          toast.success("Stats reset.");
          onDone(); onClose();
        }}>Permanently reset my stats</Button>
      </Modal>
    );
  }
}
