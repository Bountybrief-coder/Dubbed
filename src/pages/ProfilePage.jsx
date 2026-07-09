import React, { useState, useEffect } from "react";
import { ImagePlus, Trophy, Check, Crosshair, Gamepad2, Monitor, ExternalLink, Award, Swords, Flame, Shield, Target, Crown, Star, DollarSign, Wallet, Users, Zap, Settings, Mail, Lock, AtSign } from "lucide-react";
import { TwitchIcon, TwitterIcon, YouTubeIcon, PSNIcon, XboxIcon, ActivisionIcon } from "../components/PlatformIcons";
import { WagerIcon } from "../components/WagerIcon";
import { WagrBadge } from "../components/WagrBadge";
import { TrophyIcon } from "../components/TrophyIcon";
import { useAuth } from "../hooks/useAuth.jsx";
import { useAsync } from "../hooks/useAsync";
import { useToast } from "../hooks/useToast.jsx";
import { getProfileByUsername, getRecords, getTrophies, getTrophyCounts, getRecentMatches, subscribeToTrophies, updateProfile, changeUsername, isUsernameTaken } from "../services/profileService";
import { supabase } from "../lib/supabase";
import { getAchievements } from "../services/achievementService";
import { uploadAvatar } from "../utils/storage";
import { RankStar } from "../components/RankStar";
import { PlayerCard } from "../components/PlayerCard";
import { Skeleton } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { rankForXp, nextRank, rankProgress } from "../utils/ranks";
import { GAMES } from "../utils/games";
import bo7Cover from "../assets/black-ops-7.png";
import wzCover from "../assets/warzone.png";
import mw4Cover from "../assets/mw4.png";

const GAME_COVERS = {
  "Call of Duty: Black Ops 7": bo7Cover, "Warzone": wzCover, "Black Ops Royale": wzCover,
  "Call of Duty: Modern Warfare 4": mw4Cover,
};
import { money } from "../utils/format";

export function ProfilePage({ username }) {
  const { user, profile: me, refreshProfile } = useAuth();
  const toast = useToast();
  const { data: profile, loading, reload } = useAsync(() => getProfileByUsername(username), [username]);

  if (loading) return <main className="page"><Skeleton h={160} r={14} /></main>;
  if (!profile) return <main className="page"><EmptyState title="Player not found" /></main>;

  const isMe = user?.id === profile.id;
  const rank = rankForXp(profile.xp);
  const nxt = nextRank(profile.xp);
  const progress = rankProgress(profile.xp);
  const isMaxed = nxt.xp === rank.xp;
  const total = profile.wins + profile.losses;

  async function onAvatar(e) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const { url, error } = await uploadAvatar(profile.id, file);
    if (error) {
      toast.error("Upload failed. Try a smaller image.");
      return;
    }
    await updateProfile(profile.id, { avatar_url: url });
    refreshProfile();
    reload();
  }

  return (
    <main className="page">
      {/* ── HERO HEADER ── */}
      <section className="profileHero2" style={{ "--rank-glow": rank.glow }}>
        <div className="phAvatarCol">
          <div className="phAvatar" style={{ borderColor: rank.glow, boxShadow: `0 0 28px ${rank.glow}30, 0 4px 16px rgba(0,0,0,.4)` }}>
            {profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span>{profile.username.slice(0, 2)}</span>}
          </div>
          {isMe && <label className="avatarUp"><ImagePlus size={13} /> Change<input type="file" accept="image/*" onChange={onAvatar} /></label>}
        </div>
        <div className="phInfo">
          <h1>{profile.username}{profile.wagr_member && <WagrBadge size={24} />}</h1>
          <p className="sub">{profile.region || "NA"} · Joined {new Date(profile.member_since).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })}</p>
          <div className="xpBar"><div className="xpFill" style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${rank.glow}, ${rank.glow}cc)` }} /></div>
          <small className="subtle">{nxt.xp === rank.xp ? "Max tier reached" : `${(nxt.xp - profile.xp).toLocaleString()} XP to ${nxt.name}`}</small>
        </div>
        {/* ── Rank Medallion ── */}
        <div className={`phMedallion ${isMaxed ? "phMedallion--max" : ""}`}>
          <div className="phMedHalo" />
          <RankStar rank={rank} size={260} />
          <span className="phMedTier">{rank.name.toUpperCase()}</span>
          {isMaxed
            ? <span className="phMedMax">MAX PRESTIGE</span>
            : <span className="phMedXp">{(nxt.xp - profile.xp).toLocaleString()} to {nxt.name}</span>
          }
        </div>
      </section>

      {/* ── RANK PROGRESSION ── */}
      <PlayerCard profile={profile} variant="full" />

      {/* ── CMG-STYLE STAT CARD ── */}
      <PlayerStatCard profile={profile} rank={rank} total={total} />

      {/* ── Gamertags + Socials ── */}
      <GamertagsPanel profile={profile} isMe={isMe} onUpdate={() => { refreshProfile(); reload(); }} />

      {/* ── Account Settings (own profile only) ── */}
      {isMe && <AccountSettingsPanel profile={profile} onUpdate={() => { refreshProfile(); reload(); }} />}

      <AchievementsPanel userId={profile.id} />
      <RecordsPanel userId={profile.id} />
      <TrophiesPanel userId={profile.id} />
    </main>
  );
}

function PlayerStatCard({ profile, rank, total }) {
  const { data: counts, reload: reloadCounts } = useAsync(() => getTrophyCounts(profile.id), [profile.id]);
  const { data: recent } = useAsync(() => getRecentMatches(profile.id), [profile.id]);

  useEffect(() => {
    return subscribeToTrophies(profile.id, () => reloadCounts());
  }, [profile.id, reloadCounts]);

  const winRate = total ? Math.round((profile.wins / total) * 100) : 0;
  const tc = counts || { gold: 0, silver: 0, bronze: 0 };
  const rows = recent || [];

  return (
    <section className="pscCard">
      <div className="pscCol">
        <small>EARNINGS</small>
        <b className="pscBig cash">{money(profile.earnings)}</b>
        <span className="pscSub">{profile.wagr_member ? "WAGR Member" : "Standard"}</span>
      </div>
      <div className="pscDivider" />
      <div className="pscCol">
        <small>RECORD</small>
        <b className="pscBig">{profile.wins}<span className="wl">W</span> - {profile.losses}<span className="wl">L</span></b>
        <span className="pscSub">{winRate}% WIN RATE</span>
      </div>
      <div className="pscDivider" />
      <div className="pscCol wide">
        <small>RECENT MATCHES</small>
        <div className="pscRecent">
          {rows.length === 0 ? (
            <span className="pscSub">No matches yet</span>
          ) : (
            rows.map((m, i) => (
              <div key={i} className={`pscForm ${m.won ? "w" : "l"}`}>
                <span className="pscFormLetter">{m.won ? "W" : "L"}</span>
                <span className="pscFormXp">{m.xp > 0 ? `+${m.xp}` : m.xp}XP</span>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="pscTrophies">
        {profile.wagr_member && (
          <div className="pscTrophy" title="WAGR Member">
            <TrophyIcon tone="wagr" size={56} />
            <span className="pscTrophyN" style={{ color: "#7c5cff" }}>WAGR</span>
          </div>
        )}
        <div className={`pscTrophy ${tc.gold === 0 ? "empty" : ""}`} title={`${tc.gold} Gold`}>
          <TrophyIcon tone="gold" size={56} />
          <span className="pscTrophyN">{tc.gold}</span>
        </div>
        <div className={`pscTrophy ${tc.silver === 0 ? "empty" : ""}`} title={`${tc.silver} Silver`}>
          <TrophyIcon tone="silver" size={56} />
          <span className="pscTrophyN">{tc.silver}</span>
        </div>
        <div className={`pscTrophy ${tc.bronze === 0 ? "empty" : ""}`} title={`${tc.bronze} Bronze`}>
          <TrophyIcon tone="bronze" size={56} />
          <span className="pscTrophyN">{tc.bronze}</span>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }) {
  return <div className="statBox2"><small>{label}</small><b>{value}</b></div>;
}

const GAMERTAG_FIELDS = [
  { key: "activision_id", label: "Activision ID", Icon: ActivisionIcon, placeholder: "Player#1234567" },
  { key: "psn", label: "PSN", Icon: PSNIcon, placeholder: "PSN gamertag" },
  { key: "xbox", label: "Xbox", Icon: XboxIcon, placeholder: "Xbox gamertag" },
];

const SOCIAL_FIELDS = [
  { key: "twitch_username", label: "Twitch", Icon: TwitchIcon, prefix: "twitch.tv/", urlFn: (v) => `https://twitch.tv/${v}`, placeholder: "your_twitch" },
  { key: "twitter", label: "Twitter / X", Icon: TwitterIcon, prefix: "x.com/", urlFn: (v) => `https://twitter.com/${v}`, placeholder: "@handle" },
  { key: "youtube", label: "YouTube", Icon: YouTubeIcon, prefix: "youtube.com/", urlFn: (v) => `https://youtube.com/${v.startsWith("@") ? v : `@${v}`}`, placeholder: "@channel" },
];

function GamertagsPanel({ profile, isMe, onUpdate }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [vals, setVals] = useState({});
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setVals({
      activision_id: profile.activision_id || "",
      psn: profile.psn || "",
      xbox: profile.xbox || "",
      twitch_username: profile.twitch_username || "",
      twitter: profile.twitter || "",
      youtube: profile.youtube || "",
    });
    setEditing(true);
  }

  function clean(key, val) {
    let v = val.trim();
    if (key === "twitter") v = v.replace(/^@/, "").replace(/^https?:\/\/(www\.)?(twitter|x)\.com\//, "");
    if (key === "twitch_username") v = v.replace(/^@/, "").replace(/^https?:\/\/(www\.)?twitch\.tv\//, "");
    if (key === "youtube") v = v.replace(/^https?:\/\/(www\.)?youtube\.com\//, "");
    return v || null;
  }

  async function save() {
    setSaving(true);
    const patch = {};
    for (const k of Object.keys(vals)) patch[k] = clean(k, vals[k]);
    const { error } = await updateProfile(profile.id, patch);
    setSaving(false);
    if (error) return toast.error(error);
    toast.success("Profile updated.");
    setEditing(false);
    onUpdate?.();
  }

  const hasAny = profile.activision_id || profile.psn || profile.xbox || profile.twitch_username || profile.twitter || profile.youtube;

  return (
    <section className="panel2 gamertagsPanel">
      <div className="panelHead">
        <h2><Gamepad2 size={16} /> Gamertags & Socials</h2>
        {isMe && !editing && <button className="btn btn-ghost sm" onClick={startEdit}>{hasAny ? "Edit" : "Add gamertags"}</button>}
      </div>

      {editing ? (
        <div className="gtEditGrid">
          {GAMERTAG_FIELDS.map(({ key, label, Icon, placeholder }) => (
            <div className="gtEditRow" key={key}>
              <label><Icon size={14} /> {label}</label>
              <input className="field sm" value={vals[key]} onChange={(e) => setVals({ ...vals, [key]: e.target.value })} placeholder={placeholder} />
            </div>
          ))}
          <div className="gtEditDivider" />
          {SOCIAL_FIELDS.map(({ key, label, Icon, placeholder }) => (
            <div className="gtEditRow" key={key}>
              <label><Icon size={14} /> {label}</label>
              <input className="field sm" value={vals[key]} onChange={(e) => setVals({ ...vals, [key]: e.target.value })} placeholder={placeholder} />
            </div>
          ))}
          <div className="gtEditActions">
            <button className="btn btn-primary sm" onClick={save} disabled={saving}><Check size={13} /> Save</button>
            <button className="btn btn-ghost sm" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="gtDisplay">
          {GAMERTAG_FIELDS.map(({ key, label, Icon }) => {
            const val = profile[key];
            if (!val && !isMe) return null;
            return (
              <div className="gtRow" key={key}>
                <Icon size={14} />
                <span className="gtLabel">{label}</span>
                <span className={`gtVal ${val ? "" : "empty"}`}>{val || "Not set"}</span>
              </div>
            );
          })}
          {SOCIAL_FIELDS.map(({ key, label, Icon, urlFn }) => {
            const val = profile[key];
            if (!val && !isMe) return null;
            return (
              <div className="gtRow" key={key}>
                <Icon size={14} />
                <span className="gtLabel">{label}</span>
                {val ? (
                  <a className="gtVal link" href={urlFn(val)} target="_blank" rel="noopener noreferrer">{val}</a>
                ) : (
                  <span className="gtVal empty">Not set</span>
                )}
              </div>
            );
          })}
          {!hasAny && !isMe && <p className="subtle">No gamertags or socials set.</p>}
        </div>
      )}
    </section>
  );
}

function AccountSettingsPanel({ profile, onUpdate }) {
  const toast = useToast();

  const [emailOpen, setEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);

  async function handleChangeEmail() {
    if (!newEmail.trim() || !newEmail.includes("@")) return toast.error("Enter a valid email.");
    setEmailBusy(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setEmailBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Confirmation email sent. Check your inbox to verify the new address.");
    setEmailOpen(false);
    setNewEmail("");
  }

  const [pwOpen, setPwOpen] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  async function handleChangePassword() {
    if (newPw.length < 8) return toast.error("Password must be at least 8 characters.");
    if (newPw !== confirmPw) return toast.error("Passwords don't match.");
    setPwBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated.");
    setPwOpen(false);
    setNewPw("");
    setConfirmPw("");
  }

  const [unOpen, setUnOpen] = useState(false);
  const [newUn, setNewUn] = useState("");
  const [unBusy, setUnBusy] = useState(false);

  async function handleChangeUsername() {
    if (!newUn.trim()) return toast.error("Enter a username.");
    if (newUn.trim().toLowerCase() === profile.username.toLowerCase()) return toast.error("That's already your username.");
    setUnBusy(true);
    const taken = await isUsernameTaken(newUn.trim());
    if (taken) { setUnBusy(false); return toast.error("Username is taken."); }
    const { error } = await changeUsername(newUn.trim());
    setUnBusy(false);
    if (error) return toast.error(error);
    toast.success("Username changed to " + newUn.trim() + ".");
    setUnOpen(false);
    setNewUn("");
    onUpdate?.();
  }

  return (
    <section className="panel2">
      <h2><Settings size={16} /> Account Settings</h2>
      <div className="gtDisplay">
        <div className="gtRow" style={{ cursor: "pointer" }} onClick={() => setEmailOpen(!emailOpen)}>
          <Mail size={14} />
          <span className="gtLabel">Change Email</span>
          <span className="gtVal subtle">Update your login email</span>
        </div>
        {emailOpen && (
          <div className="gtEditGrid" style={{ padding: "8px 0 12px" }}>
            <div className="gtEditRow">
              <label>New email</label>
              <input className="field sm" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="new@email.com" />
            </div>
            <div className="gtEditActions">
              <button className="btn btn-primary sm" onClick={handleChangeEmail} disabled={emailBusy}><Check size={13} /> {emailBusy ? "Sending..." : "Update email"}</button>
              <button className="btn btn-ghost sm" onClick={() => { setEmailOpen(false); setNewEmail(""); }}>Cancel</button>
            </div>
          </div>
        )}

        <div className="gtRow" style={{ cursor: "pointer" }} onClick={() => setPwOpen(!pwOpen)}>
          <Lock size={14} />
          <span className="gtLabel">Change Password</span>
          <span className="gtVal subtle">Set a new password</span>
        </div>
        {pwOpen && (
          <div className="gtEditGrid" style={{ padding: "8px 0 12px" }}>
            <div className="gtEditRow">
              <label>New password</label>
              <input className="field sm" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Min 8 characters" />
            </div>
            <div className="gtEditRow">
              <label>Confirm password</label>
              <input className="field sm" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Repeat new password" />
            </div>
            <div className="gtEditActions">
              <button className="btn btn-primary sm" onClick={handleChangePassword} disabled={pwBusy}><Check size={13} /> {pwBusy ? "Updating..." : "Update password"}</button>
              <button className="btn btn-ghost sm" onClick={() => { setPwOpen(false); setNewPw(""); setConfirmPw(""); }}>Cancel</button>
            </div>
          </div>
        )}

        <div className="gtRow" style={{ cursor: "pointer" }} onClick={() => setUnOpen(!unOpen)}>
          <AtSign size={14} />
          <span className="gtLabel">Change Username</span>
          <span className="gtVal subtle">{profile.username_change_tokens > 0 ? `${profile.username_change_tokens} change${profile.username_change_tokens > 1 ? "s" : ""} available` : "Requires a token from the Shop"}</span>
        </div>
        {unOpen && (
          <div className="gtEditGrid" style={{ padding: "8px 0 12px" }}>
            <div className="gtEditRow">
              <label>New username</label>
              <input className="field sm" value={newUn} onChange={(e) => setNewUn(e.target.value)} placeholder="new_username" maxLength={20} />
            </div>
            <div className="gtEditActions">
              <button className="btn btn-primary sm" onClick={handleChangeUsername} disabled={unBusy || !profile.username_change_tokens}><Check size={13} /> {unBusy ? "Changing..." : "Change username"}</button>
              <button className="btn btn-ghost sm" onClick={() => { setUnOpen(false); setNewUn(""); }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

const ACH_ICONS = {
  swords: Swords, flame: Flame, shield: Shield, target: Target, crown: Crown,
  star: Star, dollar: DollarSign, wallet: Wallet, users: Users,
  crosshair: Crosshair, gamepad: Gamepad2, trophy: Trophy, zap: Zap
};
const TIER_COLORS = { bronze: "#cd7f32", silver: "#c0c0c0", gold: "#ffc23c", diamond: "#b9f2ff" };

function AchievementsPanel({ userId }) {
  const { data: achievements, loading } = useAsync(() => getAchievements(userId), [userId]);
  if (loading) return null;
  if (!achievements || achievements.length === 0) return null;
  return (
    <section className="panel2">
      <h2><Award size={16} /> Achievements</h2>
      <div className="achGrid">
        {achievements.map((a) => {
          const Icon = ACH_ICONS[a.icon] || Trophy;
          const color = TIER_COLORS[a.tier] || TIER_COLORS.bronze;
          return (
            <div className={`achCard ach-${a.tier}`} key={a.id} title={a.description}>
              <div className="achIcon" style={{ background: `${color}18`, color }}><Icon size={20} /></div>
              <div className="achInfo">
                <b>{a.title}</b>
                <small>{a.description}</small>
              </div>
              {a.xp_reward > 0 && <span className="achXp">+{a.xp_reward} XP</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function gameRankForWins(w) {
  const xpEstimate = w * 100;
  return rankForXp(xpEstimate);
}

function RecordsPanel({ userId }) {
  const { data: records, loading } = useAsync(() => getRecords(userId), [userId]);

  if (loading) return <section className="panel2"><h2><Swords size={16} /> Game Records</h2><Skeleton h={200} /></section>;
  if (!records || records.length === 0) return (
    <section className="panel2"><h2><Swords size={16} /> Game Records</h2>
      <EmptyState>No matches played yet. Records fill in as you play.</EmptyState>
    </section>
  );

  const byGame = {};
  for (const r of records) {
    if (!byGame[r.game]) byGame[r.game] = { w: 0, l: 0 };
    byGame[r.game].w += r.w;
    byGame[r.game].l += r.l;
  }

  const gameNames = GAMES.map((g) => g.name);
  const sorted = Object.entries(byGame).sort((a, b) => {
    const ia = gameNames.indexOf(a[0]);
    const ib = gameNames.indexOf(b[0]);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  return (
    <section className="panel2">
      <h2><Swords size={16} /> Game Records</h2>
      <div className="gbGrid">
        {sorted.map(([game, { w, l }]) => {
          const total = w + l;
          const pct = total ? Math.round((w / total) * 100) : 0;
          const rank = gameRankForWins(w);
          const gameObj = GAMES.find((g) => g.name === game);
          const cover = GAME_COVERS[game];
          const short = gameObj?.short || game;

          return (
            <div className="gbCard" key={game}>
              <div className="gbCover">
                {cover ? <img src={cover} alt={short} /> : <span className="gbCoverFallback">{short}</span>}
              </div>
              <div className="gbBody">
                <div className="gbStatRow">
                  <span className="gbLabel">Skill Level</span>
                  <div className="gbRankCell">
                    <RankStar rank={rank} size={20} />
                    <span className="gbRankName" style={{ color: rank.glow }}>{rank.name}</span>
                  </div>
                </div>
                <div className="gbStatRow">
                  <span className="gbLabel">Record</span>
                  <span className="gbVal">{w} / {l}</span>
                </div>
                <div className="gbStatRow">
                  <span className="gbLabel">Win Percentage</span>
                  <span className="gbVal">{total ? `${pct}%` : "N/A"}</span>
                </div>
                <div className="gbStatRow">
                  <span className="gbLabel">Best Streak</span>
                  <span className="gbVal">{w > 0 ? Math.min(w, 5) : "N/A"}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TrophiesPanel({ userId }) {
  const { data: trophies, loading } = useAsync(() => getTrophies(userId), [userId]);
  const placeLabel = { 1: "1st", 2: "2nd", 3: "3rd" };
  if (loading) return null;
  if (!trophies.length) return null;
  return (
    <section className="panel2">
      <h2><Trophy size={16} /> Trophies</h2>
      <div className="trophyList">
        {trophies.map((t) => {
          const tone = t.tone || (t.place === 1 ? "gold" : t.place === 2 ? "silver" : "bronze");
          return (
            <div className="trophyRow" key={t.id}>
              <TrophyIcon tone={tone} size={42} />
              <div className="trophyInfo">
                <b>{t.title}</b>
                <small>{t.game}{t.bracket_size ? ` · ${t.bracket_size} teams` : ""}{t.prize ? ` · ${money(t.prize)}` : ""}</small>
              </div>
              <span className={`trophyPlace p${t.place}`}>{placeLabel[t.place] || `${t.place}th`}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

