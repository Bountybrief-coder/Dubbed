import React, { useState, useEffect } from "react";
import { usePageMeta } from "../hooks/usePageMeta";
import { ImagePlus, Trophy, Check, Crosshair, Gamepad2, Monitor, ExternalLink, Award, Swords, Flame, Shield, Target, Crown, Star, DollarSign, Wallet, Users, Zap, Settings, Mail, Lock, AtSign, ChevronRight, MapPin } from "lucide-react";
import { TwitchIcon, TwitterIcon, YouTubeIcon, PSNIcon, XboxIcon, ActivisionIcon, BattlenetIcon, SteamIcon } from "../components/PlatformIcons";
import { WagerIcon } from "../components/WagerIcon";
import { WagrBadge } from "../components/WagrBadge";
import { TrophyIcon } from "../components/TrophyIcon";
import { useAuth } from "../hooks/useAuth.jsx";
import { useAsync } from "../hooks/useAsync";
import { useVisibilityRefresh } from "../hooks/useVisibilityRefresh";
import { useToast } from "../hooks/useToast.jsx";
import { getProfileByUsername, getRecords, getTrophies, getTrophyCounts, getRecentMatches, subscribeToTrophies, updateProfile, changeUsername, isUsernameTaken, hasActiveMatches } from "../services/profileService";
import { supabase } from "../lib/supabase";
import { getAchievements } from "../services/achievementService";
import { getUserTeams, getMyTeams, sendChallenge, getTeamActiveMatches, getTeamMatchHistory } from "../services/teamService";
import { getMyRank } from "../services/leaderboardService";
import { challengeError } from "../utils/errors";
import { Modal } from "../components/Modal";
import { Button } from "../components/Button";
import { uploadAvatar } from "../utils/storage";
import { RankStar } from "../components/RankStar";
import { PlayerCard } from "../components/PlayerCard";
import { TeamCrest } from "../components/TeamCrest";
import { Skeleton } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { rankForXp, nextRank, rankProgress } from "../utils/ranks";
import { GAMES, shortForGame, modesForGame, formatsForGame, US_STATES, CA_PROVINCES, isRegionRestricted, countryFlag, regionTag, teamCategoryLabel, formatForSize } from "../utils/games";
import bo7Cover from "../assets/black-ops-7.png";
import wzCover from "../assets/warzone.png";
import mw4Cover from "../assets/mw4.png";
import wwiiCover2 from "../assets/wwii.png";
import bo1Cover from "../assets/bo1.png";
import bo2Cover from "../assets/bo2.png";

const GAME_COVERS = {
  "Call of Duty: Black Ops 7": bo7Cover, "Warzone": wzCover, "Black Ops Royale": bo7Cover,
  "Call of Duty: Modern Warfare 4": mw4Cover, "Call of Duty: WWII": wwiiCover2,
  "Call of Duty: Black Ops": bo1Cover, "Call of Duty: Black Ops II": bo2Cover,
};
import { money } from "../utils/format";
import { clickable } from "../utils/a11y";

export function ProfilePage({ username, onNavigate }) {
  usePageMeta(username ? `${username}'s Profile` : "Profile", username ? `View ${username}'s stats, rank, match history, and teams on Dubbed.` : "Player profile on Dubbed.");
  const { user, profile: me, refreshProfile } = useAuth();
  const toast = useToast();
  const { data: profile, loading, error, reload } = useAsync(() => getProfileByUsername(username), [username]);
  const { data: myRank } = useAsync(() => user ? getMyRank("xp") : Promise.resolve({ data: null }), [user?.id]);

  useVisibilityRefresh(reload, [username]);

  if (loading) return <main className="page"><Skeleton h={160} r={14} /></main>;
  if (error) return <main className="page"><div className="errorState"><p>{error}</p><button className="btn btn-ghost sm" onClick={reload}>Retry</button></div></main>;
  if (!profile) return <main className="page"><EmptyState title="Player not found" /></main>;

  const isMe = user?.id === profile.id;
  const rank = rankForXp(profile.xp);
  const nxt = nextRank(profile.xp);
  const progress = rankProgress(profile.xp);
  const isMaxed = nxt.xp === rank.xp;
  const total = profile.wins + profile.losses;
  const winRate = total ? Math.round((profile.wins / total) * 100) : 0;
  const memberSince = new Date(profile.member_since).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const gamertag = profile.activision_id || profile.psn || profile.xbox || profile.battlenet || profile.steam;

  async function onAvatar(e) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const { url, error } = await uploadAvatar(profile.id, file);
    if (error) {
      toast.error("Upload failed. Try a smaller image.");
      return;
    }
    const { error: saveErr } = await updateProfile(profile.id, { avatar_url: url });
    if (saveErr) return toast.error("Couldn't save your new avatar. Try again.");
    toast.success("Avatar updated.");
    refreshProfile();
    reload();
  }

  return (
    <main className="page gbProfile">
      <section className="gbProfileCard" style={{ "--rank-glow": rank.glow }}>
      {/* ── HERO HEADER ── */}
      <div className="gbHero gbCardHead">
        <div className="gbHeroLeft">
          <div className="gbHeroAvatarCol">
            <div className="gbHeroAvatar" style={{ borderColor: rank.glow }}>
              {profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span>{profile.username.slice(0, 2)}</span>}
            </div>
            {isMe && <label className="avatarUp sm"><ImagePlus size={11} /> Change<input type="file" accept="image/*" onChange={onAvatar} /></label>}
          </div>
          <div className="gbHeroId">
            <h1>{profile.username}{profile.country && <img className="countryFlag" src={countryFlag(profile.country)} alt={profile.country} title={profile.country} />}{regionTag(profile.country) && <span className="regionTag">{regionTag(profile.country)}</span>}{profile.wagr_member && <WagrBadge size={22} />}</h1>
            <div className="gbHeroStatline">
              <div><small>MEMBER SINCE</small><b>{memberSince}</b></div>
              <div><small>GLOBAL RANK</small><b>{myRank?.rank_pos ? `#${myRank.rank_pos.toLocaleString()}` : "Unranked"}</b></div>
              <div><small>RECORD</small><b>{profile.wins}-{profile.losses} <em>{winRate}%</em></b></div>
              <div><small>EARNINGS</small><b className="cash">{money(profile.earnings)}</b></div>
            </div>
            <ProfileSocials profile={profile} />
          </div>
        </div>
        <div className="gbHeroRight">
          {gamertag && <div className="gbGamertag"><small>GAMERTAG</small><b>{gamertag}</b></div>}
          <ProfileTrophyStrip userId={profile.id} />
        </div>
      </div>

      {/* ── BODY (inside the card) ── */}
      <div className="gbBody gbCardBody">
        <div className="gbCol gbColLeft">
          <div className="gbRankPanel">
            <div className={`gbMedallion ${isMaxed ? "max" : ""}`}>
              <div className="phMedHalo" />
              <RankStar rank={rank} size={180} />
            </div>
            <div className="gbRankTier" style={{ color: rank.glow }}>{rank.name.toUpperCase()}</div>
            <div className="gbRankLabel">GLOBAL RANK</div>
            <div className="gbRankNum">{myRank?.rank_pos ? ordinal(myRank.rank_pos) : "—"}</div>
            <div className="gbRankPts">{(profile.xp || 0).toLocaleString()} XP</div>
            {!isMaxed && (
              <div className="gbRankProg">
                <div className="xpBar"><div className="xpFill" style={{ width: `${progress}%`, background: rank.glow }} /></div>
                <small className="subtle">{(nxt.xp - profile.xp).toLocaleString()} XP to {nxt.name}</small>
              </div>
            )}
          </div>
        </div>

        <div className="gbCol gbColCenter">
          <TrophyShelf userId={profile.id} />
          <ProfileTeamsPanel userId={profile.id} isMe={isMe} onNavigate={onNavigate} />
          <RecentMatchesPanel userId={profile.id} onNavigate={onNavigate} />
        </div>

        <div className="gbCol gbColRight">
          <RecordsTable userId={profile.id} />
          <AchievementsPanel userId={profile.id} />
        </div>
      </div>

      {/* ── Gamertags & settings (inside the card) ── */}
      <div className="gbCardFoot">
        <GamertagsPanel profile={profile} isMe={isMe} onUpdate={() => { refreshProfile(); reload(); }} />
        {isMe && <AccountSettingsPanel profile={profile} onUpdate={() => { refreshProfile(); reload(); }} />}
      </div>
      </section>
    </main>
  );
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n.toLocaleString() + (s[(v - 20) % 10] || s[v] || s[0]);
}

function ProfileSocials({ profile }) {
  const items = [
    profile.twitch_username && { Icon: TwitchIcon, url: `https://twitch.tv/${profile.twitch_username}` },
    profile.twitter && { Icon: TwitterIcon, url: `https://twitter.com/${profile.twitter}` },
    profile.youtube && { Icon: YouTubeIcon, url: `https://youtube.com/${profile.youtube.startsWith("@") ? profile.youtube : "@" + profile.youtube}` },
  ].filter(Boolean);
  if (!items.length) return null;
  return (
    <div className="gbHeroSocials">
      {items.map((s, i) => (
        <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="gbSocial" aria-label="social link"><s.Icon size={14} /></a>
      ))}
    </div>
  );
}

function ProfileTrophyStrip({ userId }) {
  const { data: counts, reload } = useAsync(() => getTrophyCounts(userId), [userId]);
  useEffect(() => subscribeToTrophies(userId, () => reload()), [userId, reload]);
  const tc = counts || { wagr: 0, gold: 0, silver: 0, bronze: 0 };
  return (
    <div className="gbHeroTrophies">
      {tc.wagr > 0 && <div className="gbHt"><TrophyIcon tone="wagr" size={30} /><b>{tc.wagr}</b></div>}
      <div className="gbHt"><TrophyIcon tone="gold" size={30} /><b>{tc.gold}</b></div>
      <div className="gbHt"><TrophyIcon tone="silver" size={30} /><b>{tc.silver}</b></div>
      <div className="gbHt"><TrophyIcon tone="bronze" size={30} /><b>{tc.bronze}</b></div>
    </div>
  );
}

function TrophyShelf({ userId }) {
  const { data: trophies, loading } = useAsync(() => getTrophies(userId), [userId]);
  if (loading) return <section className="panel2"><h2><Trophy size={16} /> Trophies</h2><Skeleton h={70} /></section>;
  const list = trophies || [];
  const placeLbl = (p) => { const n = Number(p); return n === 1 ? "1ST" : n === 2 ? "2ND" : n === 3 ? "3RD" : n ? `${n}TH` : "—"; };
  return (
    <section className="panel2 gbShelfPanel">
      <h2><Trophy size={16} /> Trophies <span className="gbCount">{list.length}</span></h2>
      {list.length === 0 ? (
        <EmptyState>No trophies yet. Win tournaments to earn them.</EmptyState>
      ) : (
        <div className="gbShelf">
          {list.map((t) => {
            const tone = t.tone || (t.place === 1 ? "gold" : t.place === 2 ? "silver" : "bronze");
            return (
              <div className="gbShelfItem" key={t.id} title={`${t.title}${t.game ? " · " + t.game : ""}${t.prize ? " · " + money(t.prize) : ""}`}>
                <TrophyIcon tone={tone} size={46} />
                <span className="gbShelfLbl">{placeLbl(t.place)}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function RecentMatchesPanel({ userId, onNavigate }) {
  const { data: recent, loading } = useAsync(() => getRecentMatches(userId, 6), [userId]);
  if (loading) return <section className="panel2"><h2><Swords size={16} /> Recent Matches</h2><Skeleton h={80} /></section>;
  const rows = recent || [];
  return (
    <section className="panel2">
      <h2><Swords size={16} /> Recent Matches</h2>
      {rows.length === 0 ? (
        <EmptyState>No matches played yet. Records fill in as you play.</EmptyState>
      ) : (
        <div className="gbMatchList">
          {rows.map((m, i) => (
            <div className={`gbMatchRow ${m.won ? "w" : "l"}`} key={i} {...clickable(() => onNavigate?.("match", m.matchId))}>
              <span className={`gbMatchResult ${m.won ? "w" : "l"}`}>{m.won ? "WIN" : "LOSS"}</span>
              <div className="gbMatchInfo">
                <b>{m.game ? shortForGame(m.game) : "Match"}{m.mode ? ` · ${m.mode}` : ""}</b>
                {m.at && <small>{new Date(m.at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</small>}
              </div>
              <span className={`gbMatchXp ${m.won ? "pos" : "neg"}`}>{m.xp > 0 ? `+${m.xp}` : m.xp} XP</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function RecordsTable({ userId }) {
  const { data: records, loading } = useAsync(() => getRecords(userId), [userId]);
  if (loading) return <section className="panel2"><h2><Crosshair size={16} /> Records</h2><Skeleton h={200} /></section>;
  const list = records || [];
  const byGame = {};
  for (const r of list) { if (!byGame[r.game]) byGame[r.game] = { w: 0, l: 0 }; byGame[r.game].w += r.w; byGame[r.game].l += r.l; }
  const gameNames = GAMES.map((g) => g.name);
  const sorted = Object.entries(byGame).sort((a, b) => {
    const ia = gameNames.indexOf(a[0]), ib = gameNames.indexOf(b[0]);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
  const totW = sorted.reduce((s, [, v]) => s + v.w, 0);
  const totL = sorted.reduce((s, [, v]) => s + v.l, 0);
  return (
    <section className="panel2">
      <h2><Crosshair size={16} /> Records</h2>
      {sorted.length === 0 ? (
        <EmptyState>No matches played yet.</EmptyState>
      ) : (
        <table className="gbRecords">
          <thead><tr><th>Arena</th><th>W</th><th>L</th></tr></thead>
          <tbody>
            {sorted.map(([game, v]) => {
              const short = GAMES.find((g) => g.name === game)?.short || game;
              return (
                <tr key={game}>
                  <td className="gbRecGame"><span className="gbRecTag">{short}</span><span className="gbRecName">{game}</span></td>
                  <td className="gbRecW">{v.w}</td>
                  <td className="gbRecL">{v.l}</td>
                </tr>
              );
            })}
            <tr className="gbRecTotal"><td>Total</td><td>{totW}</td><td>{totL}</td></tr>
          </tbody>
        </table>
      )}
    </section>
  );
}

function PlayerStatCard({ profile, rank, total }) {
  const { data: counts, reload: reloadCounts } = useAsync(() => getTrophyCounts(profile.id), [profile.id]);
  const { data: recent } = useAsync(() => getRecentMatches(profile.id), [profile.id]);

  useEffect(() => {
    return subscribeToTrophies(profile.id, () => reloadCounts());
  }, [profile.id, reloadCounts]);

  const winRate = total ? Math.round((profile.wins / total) * 100) : 0;
  const tc = counts || { wagr: 0, gold: 0, silver: 0, bronze: 0 };
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
        <div className={`pscTrophy${tc.wagr === 0 ? " empty" : ""}`} title={`${tc.wagr} WAGR`}>
          <TrophyIcon tone="wagr" size={56} />
          <span className="pscTrophyN" style={tc.wagr > 0 ? { color: "var(--violet)" } : undefined}>{tc.wagr}</span>
        </div>
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
  { key: "battlenet", label: "Battle.net", Icon: BattlenetIcon, placeholder: "Player#1234" },
  { key: "psn", label: "PSN", Icon: PSNIcon, placeholder: "PSN gamertag" },
  { key: "xbox", label: "Xbox Live", Icon: XboxIcon, placeholder: "Xbox gamertag" },
  { key: "steam", label: "Steam", Icon: SteamIcon, placeholder: "Steam username" },
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
  const [gamertagLocked, setGamertagLocked] = useState(false);

  useEffect(() => {
    if (!isMe) return;
    let cancelled = false;
    hasActiveMatches(profile.id).then((active) => { if (!cancelled) setGamertagLocked(active); });
    return () => { cancelled = true; };
  }, [isMe, profile.id, editing]);

  function startEdit() {
    setVals({
      activision_id: profile.activision_id || "",
      battlenet: profile.battlenet || "",
      psn: profile.psn || "",
      xbox: profile.xbox || "",
      steam: profile.steam || "",
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

  const hasAny = profile.activision_id || profile.battlenet || profile.psn || profile.xbox || profile.steam || profile.twitch_username || profile.twitter || profile.youtube;

  return (
    <section className="panel2 gamertagsPanel">
      <div className="panelHead">
        <h2><Gamepad2 size={16} /> Gamertags & Socials</h2>
        {isMe && !editing && <button className="btn btn-ghost sm" onClick={startEdit}>{hasAny ? "Edit" : "Add gamertags"}</button>}
      </div>

      {editing ? (
        <div className="gtEditGrid">
          {gamertagLocked && <p className="gtLockNotice"><Lock size={13} /> Gamertag changes locked. You have an active match.</p>}
          {GAMERTAG_FIELDS.map(({ key, label, Icon, placeholder }) => (
            <div className="gtEditRow" key={key}>
              <label>{label}{gamertagLocked && <Lock size={11} />}</label>
              <div className="gtFieldWrap">
                <span className="gtFieldIcon"><Icon size={14} /></span>
                <input className="field sm" value={vals[key]} onChange={(e) => { if (!gamertagLocked) setVals({ ...vals, [key]: e.target.value }); }} placeholder={placeholder} disabled={gamertagLocked} />
              </div>
            </div>
          ))}
          <div className="gtEditDivider" />
          {SOCIAL_FIELDS.map(({ key, label, Icon, placeholder }) => (
            <div className="gtEditRow" key={key}>
              <label>{label}</label>
              <div className="gtFieldWrap">
                <span className="gtFieldIcon"><Icon size={14} /></span>
                <input className="field sm" value={vals[key]} onChange={(e) => setVals({ ...vals, [key]: e.target.value })} placeholder={placeholder} />
              </div>
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

function LocationPicker({ profile, onUpdate }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [country, setCountry] = useState(profile.country || "");
  const [stateCode, setStateCode] = useState(profile.state_code || "");
  const [busy, setBusy] = useState(false);
  const states = statesForCountry(country);

  async function handleSave() {
    if (!country) return toast.error("Select your country.");
    if (states && !stateCode) return toast.error("Select your state/province.");
    setBusy(true);
    const { error } = await updateProfile(profile.id, { country, state_code: states ? stateCode : null });
    setBusy(false);
    if (error) return toast.error(error || "Failed to save.");
    const restricted = isRegionRestricted(country, stateCode);
    toast.success(restricted ? "Location saved. Cash wagering is not available in your region." : "Location saved.");
    setOpen(false);
    onUpdate?.();
  }

  const currentLabel = profile.country
    ? `${COUNTRIES.find(c => c.code === profile.country)?.label || profile.country}${profile.state_code ? `, ${profile.state_code}` : ""}`
    : "Not set — required for cash play";

  return (
    <>
      <div className="gtRow" {...clickable(() => setOpen(!open))}>
        <MapPin size={14} />
        <span className="gtLabel">Location</span>
        <span className="gtVal subtle">{currentLabel}</span>
      </div>
      {open && (
        <div className="gtEditGrid" style={{ padding: "8px 0 12px" }}>
          <div className="gtEditRow">
            <label>Country</label>
            <select className="field sm" value={country} onChange={e => { setCountry(e.target.value); setStateCode(""); }}>
              <option value="">Select country</option>
              {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </div>
          {states && (
            <div className="gtEditRow">
              <label>{country === "CA" ? "Province" : "State"}</label>
              <select className="field sm" value={stateCode} onChange={e => setStateCode(e.target.value)}>
                <option value="">Select {country === "CA" ? "province" : "state"}</option>
                {states.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
              </select>
            </div>
          )}
          {country && stateCode && isRegionRestricted(country, stateCode) && (
            <p style={{ color: "var(--danger)", fontSize: 13, margin: "4px 0 0" }}>Cash wagering is not available in your state/province.</p>
          )}
          <div className="gtEditActions">
            <button className="btn btn-primary sm" onClick={handleSave} disabled={busy}><Check size={13} /> {busy ? "Saving..." : "Save location"}</button>
            <button className="btn btn-ghost sm" onClick={() => { setOpen(false); setCountry(profile.country || ""); setStateCode(profile.state_code || ""); }}>Cancel</button>
          </div>
        </div>
      )}
    </>
  );
}

const COUNTRIES = [
  { code: "US", label: "United States" },
  { code: "CA", label: "Canada" },
  { code: "GB", label: "United Kingdom" },
  { code: "AU", label: "Australia" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "BR", label: "Brazil" },
  { code: "MX", label: "Mexico" },
  { code: "OTHER", label: "Other" },
];

function statesForCountry(code) {
  if (code === "US") return US_STATES;
  if (code === "CA") return CA_PROVINCES;
  return null;
}

function AccountSettingsPanel({ profile, onUpdate }) {
  const toast = useToast();

  const [emailOpen, setEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailPw, setEmailPw] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);

  async function handleChangeEmail() {
    if (!emailPw) return toast.error("Enter your current password to confirm.");
    if (!newEmail.trim() || !newEmail.includes("@")) return toast.error("Enter a valid email.");
    setEmailBusy(true);
    const { data: session } = await supabase.auth.getSession();
    const currentEmail = session?.session?.user?.email;
    if (!currentEmail) { setEmailBusy(false); return toast.error("Session expired. Please log in again."); }
    const { error: reAuthErr } = await supabase.auth.signInWithPassword({ email: currentEmail, password: emailPw });
    if (reAuthErr) { setEmailBusy(false); return toast.error("Password is incorrect."); }
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setEmailBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Confirmation email sent. Check your inbox to verify the new address.");
    setEmailOpen(false);
    setNewEmail("");
    setEmailPw("");
  }

  const [pwOpen, setPwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  async function handleChangePassword() {
    if (!currentPw) return toast.error("Enter your current password.");
    if (newPw.length < 8) return toast.error("Password must be at least 8 characters.");
    if (newPw !== confirmPw) return toast.error("Passwords don't match.");
    setPwBusy(true);
    const { data: session } = await supabase.auth.getSession();
    const email = session?.session?.user?.email;
    if (!email) { setPwBusy(false); return toast.error("Session expired. Please log in again."); }
    const { error: reAuthErr } = await supabase.auth.signInWithPassword({ email, password: currentPw });
    if (reAuthErr) { setPwBusy(false); return toast.error("Current password is incorrect."); }
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated.");
    setPwOpen(false);
    setCurrentPw("");
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
        <div className="gtRow" {...clickable(() => setEmailOpen(!emailOpen))}>
          <Mail size={14} />
          <span className="gtLabel">Change Email</span>
          <span className="gtVal subtle">Update your login email</span>
        </div>
        {emailOpen && (
          <div className="gtEditGrid" style={{ padding: "8px 0 12px" }}>
            <div className="gtEditRow">
              <label>Current password</label>
              <input className="field sm" type="password" value={emailPw} onChange={(e) => setEmailPw(e.target.value)} placeholder="Verify your identity" />
            </div>
            <div className="gtEditRow">
              <label>New email</label>
              <input className="field sm" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="new@email.com" />
            </div>
            <div className="gtEditActions">
              <button className="btn btn-primary sm" onClick={handleChangeEmail} disabled={emailBusy}><Check size={13} /> {emailBusy ? "Sending..." : "Update email"}</button>
              <button className="btn btn-ghost sm" onClick={() => { setEmailOpen(false); setNewEmail(""); setEmailPw(""); }}>Cancel</button>
            </div>
          </div>
        )}

        <div className="gtRow" {...clickable(() => setPwOpen(!pwOpen))}>
          <Lock size={14} />
          <span className="gtLabel">Change Password</span>
          <span className="gtVal subtle">Set a new password</span>
        </div>
        {pwOpen && (
          <div className="gtEditGrid" style={{ padding: "8px 0 12px" }}>
            <div className="gtEditRow">
              <label>Current password</label>
              <input className="field sm" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="Verify your identity" />
            </div>
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
              <button className="btn btn-ghost sm" onClick={() => { setPwOpen(false); setCurrentPw(""); setNewPw(""); setConfirmPw(""); }}>Cancel</button>
            </div>
          </div>
        )}

        <div className="gtRow" {...clickable(() => setUnOpen(!unOpen))}>
          <AtSign size={14} />
          <span className="gtLabel">Change Username</span>
          <span className="gtVal subtle">{profile.username_change_tokens > 0 ? `${profile.username_change_tokens} change${profile.username_change_tokens > 1 ? "s" : ""} available` : "Requires a token from the Shop"}</span>
        </div>
        {unOpen && (
          <div className="gtEditGrid" style={{ padding: "8px 0 12px" }}>
            <div className="gtEditRow">
              <label>New username</label>
              <input className="field sm" value={newUn} onChange={(e) => setNewUn(e.target.value)} placeholder="new_username" maxLength={12} />
            </div>
            <div className="gtEditActions">
              <button className="btn btn-primary sm" onClick={handleChangeUsername} disabled={unBusy || !profile.username_change_tokens}><Check size={13} /> {unBusy ? "Changing..." : "Change username"}</button>
              <button className="btn btn-ghost sm" onClick={() => { setUnOpen(false); setNewUn(""); }}>Cancel</button>
            </div>
          </div>
        )}

        <LocationPicker profile={profile} onUpdate={onUpdate} />
      </div>
    </section>
  );
}

function ProfileTeamsPanel({ userId, isMe, onNavigate }) {
  const { user } = useAuth();
  const toast = useToast();
  const { data: teams, loading } = useAsync(() => getUserTeams(userId), [userId]);
  const { data: myTeams } = useAsync(() => user && !isMe ? getMyTeams(user.id) : Promise.resolve({ data: [] }), [user?.id, isMe]);
  const [expanded, setExpanded] = useState(null);
  const [challModal, setChallModal] = useState(null);
  const [challMsg, setChallMsg] = useState("");
  const [challFrom, setChallFrom] = useState("");
  const [challKind, setChallKind] = useState("xp");
  const [challEntry, setChallEntry] = useState("");
  const [challMode, setChallMode] = useState("Search and Destroy");
  const [sending, setSending] = useState(false);

  if (loading) return <section className="panel2"><h2><Users size={16} /> Teams</h2><Skeleton h={90} /></section>;
  if (!teams || teams.length === 0) return (
    <section className="panel2"><h2><Users size={16} /> Teams</h2>
      <EmptyState>{isMe ? "You're not on any teams yet. Head to the Teams page to create or join one." : "Not on any teams yet."}</EmptyState>
    </section>
  );

  const myAvailableTeams = (myTeams || []).filter(t => t.owner_id === user?.id);
  const canChallenge = !isMe && !!user;

  async function handleSendChallenge() {
    if (!challFrom) return toast.error("Select your team.");
    if (challFrom === challModal.id) return toast.error("You can't challenge your own team.");
    if (challKind === "cash" && (!challEntry || Number(challEntry) <= 0)) return toast.error("Set an entry amount.");
    setSending(true);
    const fromTeam = myAvailableTeams.find(t => t.id === challFrom);
    const challGame = challModal.game || fromTeam?.game || "Call of Duty: Black Ops 7";
    const { error } = await sendChallenge(challFrom, challModal.id, challMsg.trim(), {
      game: challGame,
      mode: challMode,
      format: formatForSize(fromTeam?.size),
      kind: challKind,
      entry: challKind === "cash" ? Number(challEntry) : 0,
    });
    setSending(false);
    if (error) return toast.error(challengeError(error));
    toast.success(`Challenge sent to ${challModal.name}!`);
    setChallModal(null);
    setChallMsg("");
    setChallFrom("");
    setChallKind("xp");
    setChallEntry("");
  }

  return (
    <section className="panel2">
      <h2><Users size={16} /> Teams</h2>
      <div className="profileTeamGrid">
        {teams.map(t => {
          const isOpen = expanded === t.id;
          return (
            <div className={`profileTeamCard${isOpen ? " expanded" : ""}`} key={t.id}>
              <div className="profileTeamTop" {...clickable(() => setExpanded(isOpen ? null : t.id))}>
                <TeamCrest team={t} size={44} />
                <div style={{ flex: 1 }}>
                  <b>{t.name}</b>
                  <small>{shortForGame(t.game) || t.game} · {teamCategoryLabel(t.size)} · {t.type}</small>
                </div>
                <ChevronRight size={16} className={`profileTeamChev${isOpen ? " open" : ""}`} />
              </div>
              {isOpen && (
                <ProfileTeamDetail
                  team={t}
                  canChallenge={canChallenge}
                  hasOwnTeam={myAvailableTeams.length > 0}
                  onChallenge={() => { setChallModal(t); setChallFrom(myAvailableTeams[0]?.id || ""); }}
                  onNavigate={onNavigate}
                />
              )}
            </div>
          );
        })}
      </div>

      {challModal && (() => {
        const fromTeam = myAvailableTeams.find(t => t.id === challFrom);
        const challGame = challModal.game || fromTeam?.game || "Call of Duty: Black Ops 7";
        const modes = modesForGame(challGame) || ["Search and Destroy"];
        return (
          <Modal open onClose={() => setChallModal(null)} eyebrow="TEAM CHALLENGE" title={`Challenge ${challModal.name}`} size="sm">
            <label className="fieldLbl">Your team</label>
            <select className="field" value={challFrom} onChange={e => setChallFrom(e.target.value)}>
              {myAvailableTeams.map(t => <option key={t.id} value={t.id}>[{t.tag}] {t.name} · {teamCategoryLabel(t.size)}</option>)}
            </select>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              <div>
                <label className="fieldLbl">Mode</label>
                <select className="field" value={challMode} onChange={e => setChallMode(e.target.value)}>
                  {modes.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="fieldLbl">Format</label>
                <div className="field" style={{ background: "var(--panel3)", cursor: "default" }}>{formatForSize(fromTeam?.size)}</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              <div>
                <label className="fieldLbl">Type</label>
                <select className="field" value={challKind} onChange={e => setChallKind(e.target.value)}>
                  <option value="xp">XP</option>
                  <option value="cash">Cash</option>
                </select>
              </div>
              {challKind === "cash" && (
                <div>
                  <label className="fieldLbl">Entry ($)</label>
                  <input className="field" type="number" min="1" step="1" value={challEntry} onChange={e => setChallEntry(e.target.value)} placeholder="10" />
                </div>
              )}
            </div>
            <label className="fieldLbl" style={{ marginTop: 8 }}>Message (optional)</label>
            <input className="field" value={challMsg} onChange={e => setChallMsg(e.target.value)} placeholder="Let's run it" maxLength={100} />
            <Button variant="primary" className="wide" loading={sending} onClick={handleSendChallenge} style={{ marginTop: 12 }}>
              <Swords size={14} /> Send Challenge
            </Button>
          </Modal>
        );
      })()}
    </section>
  );
}

function ProfileTeamDetail({ team, canChallenge, hasOwnTeam, onChallenge, onNavigate }) {
  const { data: activeMatches, loading: loadingMatches } = useAsync(() => getTeamActiveMatches(team.id), [team.id]);
  const { data: history, loading: loadingHistory } = useAsync(() => getTeamMatchHistory(team.id, 5), [team.id]);
  const members = team.team_members || [];
  const totalW = team.wins || 0;
  const totalL = team.losses || 0;
  const winPct = totalW + totalL > 0 ? Math.round((totalW / (totalW + totalL)) * 100) : 0;

  return (
    <div className="profileTeamBody">
      <div className="ptDetailGrid">
        <div className="ptStat"><small>Record</small><b>{totalW}W - {totalL}L</b></div>
        <div className="ptStat"><small>Win Rate</small><b>{winPct}%</b></div>
        <div className="ptStat"><small>XP</small><b>{team.xp || 0}</b></div>
        {(team.earnings || 0) > 0 && <div className="ptStat"><small>Earnings</small><b className="cash">{money(team.earnings)}</b></div>}
      </div>

      <div style={{ marginTop: 10 }}>
        <small className="eyebrow">ROSTER</small>
        <div className="memberChips" style={{ marginTop: 4 }}>
          {members.map(m => <span key={m.user_id} className="memberChip">{m.profiles?.username}{m.role === "owner" && <em>owner</em>}</span>)}
        </div>
      </div>

      {loadingMatches ? <Skeleton h={40} /> : activeMatches && activeMatches.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <small className="eyebrow">ACTIVE MATCHES</small>
          {activeMatches.map(m => (
            <div className="ptMatchRow" key={m.id}>
              <span className={`matchStatusBadge ${m.status === "live" ? "live" : ""}`}>{m.status === "live" ? "LIVE" : m.status === "open" ? "Waiting" : m.status}</span>
              <span>{shortForGame(m.game)} · {m.mode} · {m.format}</span>
              {m.kind === "cash" && <span className="cash">{money(m.entry)}</span>}
            </div>
          ))}
        </div>
      )}

      {loadingHistory ? <Skeleton h={40} /> : history && history.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <small className="eyebrow">RECENT RESULTS</small>
          <div className="ptHistoryStrip">
            {history.map((h, i) => (
              <span key={i} className={`ptFormBadge ${h.result}`}>{h.result === "win" ? "W" : "L"}{h.xp_earned > 0 ? ` +${h.xp_earned}XP` : ""}</span>
            ))}
          </div>
        </div>
      )}

      {canChallenge && (
        hasOwnTeam ? (
          <button className="btn btn-primary sm wide" style={{ marginTop: 12 }} onClick={onChallenge}>
            <Swords size={13} /> Challenge this team
          </button>
        ) : (
          <button className="btn btn-ghost sm wide" style={{ marginTop: 12 }} onClick={() => onNavigate?.("teams")}>
            <Users size={13} /> Create a team to challenge
          </button>
        )
      )}
    </div>
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
                {cover ? <img src={cover} alt={short} loading="lazy" /> : <span className="gbCoverFallback">{short}</span>}
              </div>
              <div className="gbBody">
                <div className="gbStatRow">
                  <span className="gbLabel">Est. Skill Level</span>
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
                  <span className="gbLabel">Total Matches</span>
                  <span className="gbVal">{total || "N/A"}</span>
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
  if (!trophies || !trophies.length) return null;
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
                <small>{t.game}{t.bracket_size ? ` · ${t.bracket_size} teams` : ""}{t.prize ? ` · ${money(t.prize)}` : ""}{t.earned_at ? ` · ${new Date(t.earned_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}</small>
              </div>
              <span className={`trophyPlace p${t.place}`}>{placeLabel[t.place] || `${t.place}th`}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

