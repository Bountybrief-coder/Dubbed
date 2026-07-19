import React, { useState, useCallback, useEffect } from "react";
import { ShieldCheck, Search, Ban, UserCheck, AlertTriangle, DollarSign, Globe } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useToast } from "../hooks/useToast.jsx";
import { adminListBans, adminBanUser, adminUnbanUser, lookupUser } from "../services/banService";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { SkeletonRows } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { shortDate, money } from "../utils/format";

const FILTERS = ["active", "expired", "all"];
const DURATIONS = ["24h", "7d", "30d", "permanent"];
const DURATION_LABEL = { "24h": "24 hours", "7d": "7 days", "30d": "30 days", "permanent": "Permanent" };

const BAN_TYPES = [
  { id: "cheating", label: "Cheating", color: "var(--danger)", desc: "Player caught cheating. Login blocked, withdrawal blocked. One-time $100 redemption available." },
  { id: "toxic", label: "Toxic Behavior", color: "var(--gold)", desc: "Toxic conduct, hate speech, harassment. Login blocked, withdrawal blocked until ban is lifted." },
  { id: "ringing", label: "Ringing / Boosting", color: "var(--gold)", desc: "Using a higher-skilled player or alt to boost. Same as toxic. Blocked until lifted." },
  { id: "fake_proof", label: "Fake Proof", color: "var(--danger)", desc: "Submitting fake/edited screenshots or clips. Treated as cheating. $100 redemption available." },
  { id: "self_ban", label: "Self-Ban (Player Request)", color: "var(--neon)", desc: "Player requested a break. Login blocked. Admin can still process their withdrawal. No funds locked." },
  { id: "other", label: "Other", color: "var(--muted)", desc: "Custom reason. Specify below." },
];

const REASONS = ["Cheating", "Ringing", "Hacking", "Boosting", "Toxic behavior", "Fake proof", "Smurfing/Alt account", "Self-ban request", "Other"];

export function AdminBansPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [filter, setFilter] = useState("active");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [banOpen, setBanOpen] = useState(false);
  const [unbanFor, setUnbanFor] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const activeOnly = filter === "active";
    const { data, error } = await adminListBans(filter === "all" ? false : activeOnly);
    if (error) toast.error(error);
    if (filter === "expired") setRows((data || []).filter((b) => !b.active));
    else setRows(data || []);
    setLoading(false);
  }, [filter]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  if (!isAdmin) {
    return <main className="page"><EmptyState icon={ShieldCheck} title="Admins only">You don't have access to this page.</EmptyState></main>;
  }

  const filtered = rows.filter((r) =>
    !query.trim() || r.username?.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <main className="page">
      <div className="pageHead">
        <div className="eyebrow">ADMIN</div>
        <h1>Bans</h1>
        <p className="sub">Ban, unban, and review account restrictions. Every action is logged to audit_logs.</p>
      </div>

      {/* Ban policy summary */}
      <section className="banPolicyBox">
        <h3><AlertTriangle size={14} /> Ban Policy</h3>
        <ul>
          <li><b style={{ color: "var(--danger)" }}>Cheating / Fake Proof:</b> Login + withdrawal blocked. One chance to redeem for a flat $100 fee. Second offense = permanent, no appeal.</li>
          <li><b style={{ color: "var(--gold)" }}>Toxic / Ringing / Boosting:</b> Login + withdrawal blocked until ban expires or is manually lifted.</li>
          <li><b style={{ color: "var(--neon)" }}>Self-Ban:</b> Player requested it. Login blocked but admin can still process their withdrawal on request.</li>
        </ul>
      </section>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <Button variant="danger" onClick={() => setBanOpen(true)}><Ban size={14} /> Ban a user</Button>
      </div>

      <div className="segRow inline">
        {FILTERS.map((f) => (
          <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      <div className="navSearch adminSearch">
        <Search size={15} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by username" />
      </div>

      {loading ? (
        <SkeletonRows rows={4} height={60} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No bans">Nothing matches this filter.</EmptyState>
      ) : (
        <div className="adminWdList">
          {filtered.map((b) => {
            const banType = BAN_TYPES.find((t) => t.id === b.ban_type) || BAN_TYPES[5];
            const isCheating = b.ban_type === "cheating" || b.ban_type === "fake_proof";
            const isSelfBan = b.ban_type === "self_ban";
            return (
              <div className={`adminWdRow ${b.active ? "" : "expired"}`} key={b.id}>
                <div className="adminWdMain">
                  <b>{b.username}</b>
                  <span className={`statusChip ${b.active ? "s-rejected" : "s-pending"}`}>{b.active ? "BANNED" : "expired"}</span>
                  <span className="badge" style={{ borderColor: banType.color, color: banType.color }}>{banType.label}</span>
                  <span className="badge">{DURATION_LABEL[b.duration] || b.duration}</span>
                </div>
                <div className="adminWdMeta">
                  <span>Reason: {b.reason}</span>
                  {b.ip_address && <span><Globe size={11} /> IP: {b.ip_address}</span>}
                  <span>Banned {shortDate(b.created_at)}</span>
                  {b.expires_at ? <span>Expires {shortDate(b.expires_at)}</span> : <span>Permanent</span>}
                  {b.banned_by_name && <span>By: {b.banned_by_name}</span>}
                  {b.unban_note && <span>Unban note: {b.unban_note}</span>}
                  {b.active && isCheating && !b.redeemed && (
                    <span style={{ color: "var(--gold)" }}>Redemption available ($100)</span>
                  )}
                  {b.redeemed && (
                    <span style={{ color: "var(--neon)" }}>Redeemed {b.redeemed_at ? shortDate(b.redeemed_at) : ""}</span>
                  )}
                  {b.active && isSelfBan && (
                    <span style={{ color: "var(--neon)" }}>Withdrawal: can be processed by admin on request</span>
                  )}
                  {b.active && !isSelfBan && (
                    <span style={{ color: "var(--danger)" }}>Withdrawal: BLOCKED</span>
                  )}
                </div>
                {b.active && (
                  <div className="adminWdActions">
                    <Button variant="ghost" className="sm" onClick={() => setUnbanFor(b)}><UserCheck size={13} /> Unban</Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {banOpen && <BanModal onClose={() => setBanOpen(false)} onDone={load} />}
      {unbanFor && <UnbanModal ban={unbanFor} onClose={() => setUnbanFor(null)} onDone={load} />}
    </main>
  );

  function BanModal({ onClose, onDone }) {
    const [search, setSearch] = useState("");
    const [results, setResults] = useState([]);
    const [target, setTarget] = useState(null);
    const [banType, setBanType] = useState("cheating");
    const [reason, setReason] = useState(REASONS[0]);
    const [customReason, setCustomReason] = useState("");
    const [duration, setDuration] = useState("permanent");
    const [ipAddress, setIpAddress] = useState("");
    const [busy, setBusy] = useState(false);

    const selectedType = BAN_TYPES.find((t) => t.id === banType);

    async function doSearch() {
      if (!search.trim()) return;
      const { data } = await lookupUser(search.trim());
      setResults(data);
    }

    return (
      <Modal open onClose={onClose} eyebrow="BAN USER" title="Ban a user" size="md">
        <label className="fieldLbl">Find user</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="field" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doSearch()} placeholder="Username" style={{ flex: 1 }} />
          <Button variant="ghost" onClick={doSearch}>Search</Button>
        </div>
        {results.length > 0 && (
          <div className="chipRow wrap" style={{ margin: "8px 0" }}>
            {results.map((u) => (
              <button key={u.id} className={target?.id === u.id ? "on" : ""} onClick={() => setTarget(u)}>
                {u.username} {u.banned ? "(banned)" : ""}
              </button>
            ))}
          </div>
        )}

        {target && (
          <>
            <label className="fieldLbl">Ban Type</label>
            <div className="banTypeGrid">
              {BAN_TYPES.map((bt) => (
                <button
                  key={bt.id}
                  className={`banTypeBtn ${banType === bt.id ? "on" : ""}`}
                  onClick={() => setBanType(bt.id)}
                  style={{ "--bt-color": bt.color }}
                >
                  <b>{bt.label}</b>
                  <small>{bt.desc}</small>
                </button>
              ))}
            </div>

            <label className="fieldLbl">Reason</label>
            <div className="chipRow wrap">{REASONS.map((r) => (
              <button key={r} className={reason === r ? "on" : ""} onClick={() => setReason(r)}>{r}</button>
            ))}</div>
            {reason === "Other" && (
              <input className="field" value={customReason} onChange={(e) => setCustomReason(e.target.value)} placeholder="Custom reason" style={{ marginTop: 8 }} />
            )}

            <label className="fieldLbl">Duration</label>
            <div className="chipRow">{DURATIONS.map((d) => (
              <button key={d} className={duration === d ? "on" : ""} onClick={() => setDuration(d)}>{DURATION_LABEL[d]}</button>
            ))}</div>

            <label className="fieldLbl">IP Address (optional)</label>
            <input className="field" value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} placeholder="e.g. 192.168.1.100" />
            <small className="subtle">If provided, this IP will also be blocked from logging in.</small>

            {/* Impact preview */}
            <div className="banImpactBox">
              <h4>Impact</h4>
              <ul>
                <li>Login: <b style={{ color: "var(--danger)" }}>BLOCKED</b></li>
                <li>Withdrawal: <b style={{ color: banType === "self_ban" ? "var(--neon)" : "var(--danger)" }}>
                  {banType === "self_ban" ? "ADMIN CAN PROCESS" : "BLOCKED"}
                </b></li>
                {(banType === "cheating" || banType === "fake_proof") && (
                  <li>Redemption: <b style={{ color: "var(--gold)" }}>$100 fee, one-time only</b></li>
                )}
                {ipAddress && <li>IP block: <b>{ipAddress}</b></li>}
              </ul>
            </div>

            <Button variant="danger" className="wide" loading={busy} onClick={async () => {
              const finalReason = reason === "Other" ? (customReason.trim() || "Other") : reason;
              setBusy(true);
              const res = await adminBanUser(target.id, finalReason, duration, banType, ipAddress.trim() || null);
              setBusy(false);
              if (res.error) return toast.error(res.error);
              toast.success(`${target.username} banned (${DURATION_LABEL[duration]}).`);
              onDone(); onClose();
            }}>Ban {target.username}</Button>
          </>
        )}
      </Modal>
    );
  }

  function UnbanModal({ ban, onClose, onDone }) {
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const isCheating = ban.ban_type === "cheating" || ban.ban_type === "fake_proof";

    return (
      <Modal open onClose={onClose} eyebrow="UNBAN" title={`Unban ${ban.username}?`} size="sm">
        <p className="modalNote">This removes the active ban and restores full account access. The ban record stays in the audit log.</p>
        {isCheating && !ban.redeemed && (
          <div className="errBanner" style={{ borderColor: "var(--gold)", background: "rgba(255,158,61,.08)" }}>
            <AlertTriangle size={14} /> This user was banned for {ban.ban_type === "fake_proof" ? "fake proof" : "cheating"}. If this is a redemption, collect the $100 fee first. They only get one chance. Next offense is permanent.
          </div>
        )}
        {ban.redeemed && (
          <div className="errBanner" style={{ borderColor: "var(--danger)", background: "rgba(255,77,94,.08)" }}>
            <AlertTriangle size={14} /> This user already used their one-time redemption. If unbanning again, this is purely at admin discretion. There are no more second chances.
          </div>
        )}
        <label className="fieldLbl">Note (optional)</label>
        <textarea className="field area" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Appeal approved / $100 redemption collected / Self-ban lifted on request" />
        <Button variant="primary" className="wide" loading={busy} onClick={async () => {
          setBusy(true);
          const res = await adminUnbanUser(ban.user_id, note.trim(), isCheating && !ban.redeemed);
          setBusy(false);
          if (res.error) return toast.error(res.error);
          toast.success(`${ban.username} unbanned.`);
          onDone(); onClose();
        }}>Unban</Button>
      </Modal>
    );
  }
}
