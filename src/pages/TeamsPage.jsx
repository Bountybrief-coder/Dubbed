import React, { useState, useEffect } from "react";
import { usePageMeta } from "../hooks/usePageMeta";
import { UserPlus, Users, LogOut, Trash2, ChevronLeft, Swords, Trophy, ArrowRight, Zap, DollarSign, Target, TrendingUp, ImagePlus } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useToast } from "../hooks/useToast.jsx";
import { useConfirm } from "../hooks/useConfirm.jsx";
import { clickable } from "../utils/a11y";
import { inviteError } from "../utils/errors";
import { useAsync } from "../hooks/useAsync";
import { useVisibilityRefresh } from "../hooks/useVisibilityRefresh";
import { getMyTeams, getMyInvites, createTeam, inviteToTeam, acceptInvite, declineInvite, leaveTeam, disbandTeam, getTeamActiveMatches, getTeamMatchHistory, subscribeToTeamMatches, subscribeToInvites, getTeamChallenges, respondChallenge, subscribeToChallenges, browseTeams, updateTeamCrest } from "../services/teamService";
import { uploadTeamCrest } from "../utils/storage";
import { Modal } from "../components/Modal";
import { ChallengeModal } from "../components/ChallengeModal";
import { TeamCrest } from "../components/TeamCrest";
import { Button } from "../components/Button";
import { SkeletonRows } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { WagrBadge } from "../components/WagrBadge";
import { RankStar } from "../components/RankStar";
import { GAME_NAMES, isConsoleOnlyGame, WWII_PLATFORMS, platformsForGame, shortForGame, seriesLabel, countryFlag, regionTag, teamCategoryLabel, formatForSize } from "../utils/games";
import { money } from "../utils/format";
import { rankForXp } from "../utils/ranks";
import { supabase } from "../lib/supabase";
import cashMatchLogo from "../assets/cash-match.png";
import tournamentLogo from "../assets/tournament.png";

const TEAM_TYPES = [
  { key: "all", label: "All Teams" },
  { key: "xp", label: "XP" },
  { key: "cash", label: "Cash" },
  { key: "tournament", label: "Tournament" },
];

export function TeamsPage({ onNavigate }) {
  usePageMeta("Teams", "Build XP, cash, or tournament squads. Invite teammates, track team records, and compete together.");
  const { user, profile } = useAuth();
  const toast = useToast();
  const { data: teams, loading, error, reload } = useAsync(() => getMyTeams(user.id), [user.id]);
  const { data: invites, reload: reloadInv } = useAsync(() => getMyInvites(user.id), [user.id]);
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteFor, setInviteFor] = useState(null);
  const [detail, setDetail] = useState(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [view, setView] = useState("mine");

  useEffect(() => {
    const unsub = subscribeToInvites(user.id, () => reloadInv());
    return unsub;
  }, [user.id, reloadInv]);

  if (detail) {
    return <TeamDetailPage team={detail} onBack={() => setDetail(null)} onNavigate={onNavigate} onReload={reload} />;
  }

  const filteredTeams = teams?.filter((t) => typeFilter === "all" || t.type === typeFilter) || [];

  return (
    <main className="page">
      <div className="pageHead rowHead">
        <div><div className="eyebrow">YOUR CREW</div><h1>Teams</h1><p className="sub">Build XP, cash, or tournament squads and invite teammates.</p></div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}><UserPlus size={16} /> Create team</Button>
      </div>

      <div className="segRow inline" style={{ marginBottom: 16 }}>
        <button className={view === "mine" ? "on" : ""} onClick={() => setView("mine")}><Users size={14} /> My Teams</button>
        <button className={view === "ladder" ? "on" : ""} onClick={() => setView("ladder")}><Swords size={14} /> Find Opponents</button>
      </div>

      {view === "ladder" ? (
        <TeamLadder myTeams={teams || []} userId={user.id} onCreate={() => setCreateOpen(true)} />
      ) : (
      <>
      <div className="lbTabs" style={{ marginBottom: 16 }}>
        {TEAM_TYPES.map((tt) => {
          const count = tt.key === "all" ? (teams?.length || 0) : (teams?.filter((t) => t.type === tt.key).length || 0);
          return (
            <button key={tt.key} className={`lbTab${typeFilter === tt.key ? " active" : ""}`} onClick={() => setTypeFilter(tt.key)}>
              {tt.key === "xp" && <Zap size={14} />}
              {tt.key === "cash" && <DollarSign size={14} />}
              {tt.key === "tournament" && <Trophy size={14} />}
              {tt.label}{count > 0 ? ` (${count})` : ""}
            </button>
          );
        })}
      </div>

      {invites?.length > 0 && (
        <section className="panel2">
          <h2>Pending invites</h2>
          {invites.map((iv) => (
            <div className="inviteLine2" key={iv.team_id}>
              <span className="teamTag">{iv.teams?.tag}</span>
              <b>{iv.teams?.name}</b>
              <small>from {iv.teams?.profiles?.username}</small>
              <div className="inviteBtns">
                <Button variant="primary" onClick={async () => { await acceptInvite(iv.team_id, user.id); toast.success("Joined team."); reload(); reloadInv(); }}>Accept</Button>
                <Button variant="ghost" onClick={async () => { await declineInvite(iv.team_id, user.id); reloadInv(); }}>Decline</Button>
              </div>
            </div>
          ))}
        </section>
      )}

      {loading ? (
        <SkeletonRows rows={3} height={90} />
      ) : error ? (
        <div className="errorState"><p>{error}</p><button className="btn btn-ghost sm" onClick={reload}>Retry</button></div>
      ) : !teams || teams.length === 0 ? (
        <EmptyState icon={Users} title="No teams yet" action={
          <Button variant="primary" onClick={() => setCreateOpen(true)}><UserPlus size={16} /> Create your first team</Button>
        }>Squad up with your crew. Create a team, invite teammates, and compete together in matches and tournaments.</EmptyState>
      ) : filteredTeams.length === 0 ? (
        <EmptyState icon={Users} title={`No ${typeFilter} teams`} action={
          <Button variant="primary" onClick={() => setCreateOpen(true)}><UserPlus size={16} /> Create a {typeFilter} team</Button>
        }>You don't have any {typeFilter} teams yet. Create one to get started.</EmptyState>
      ) : (
        <div className="teamGrid2">
          {filteredTeams.map((t) => {
            const members = t.team_members || [];
            const totalW = (t.wins || 0) + (t.tourney_wins || 0);
            const totalL = (t.losses || 0) + (t.tourney_losses || 0);
            return (
              <div className="teamCard2" key={t.id} {...clickable(() => setDetail(t))}>
                <div className="teamCardTop">
                  {t.logo_url ? <TeamCrest team={t} size={44} /> :
                   t.type === "cash" ? <img className="teamCardTypeLogo" src={cashMatchLogo} alt="" /> :
                   t.type === "tournament" ? <img className="teamCardTypeLogo" src={tournamentLogo} alt="" /> :
                   <TeamCrest team={t} size={44} />}
                  <div>
                    <b>{t.name}</b>
                    <small>{shortForGame(t.game) || t.game} · {teamCategoryLabel(t.size)} · <span className={`teamTypeBadge ${t.type}`}>{t.type === "tournament" ? "TOURNEY" : t.type.toUpperCase()}</span>{t.platform ? ` · ${t.platform}` : ""}</small>
                  </div>
                </div>
                <div className="teamStatRow">
                  <span>{totalW}W - {totalL}L</span>
                  {t.earnings > 0 && <span className="cash">{money(t.earnings)}</span>}
                  <span>{t.xp || 0} XP</span>
                </div>
                <div className="teamRoster">
                  {members.map((m) => <PlayerCard key={m.user_id} member={m} compact />)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      </>
      )}

      <CreateTeamModal open={createOpen} onClose={() => setCreateOpen(false)} onDone={reload} />
      {inviteFor && <InviteModal team={inviteFor} onClose={() => setInviteFor(null)} onDone={reload} />}
    </main>
  );
}

// ── Ladder: browse & challenge other teams ──
function TeamLadder({ myTeams, userId, onCreate }) {
  const [game, setGame] = useState("");
  const [size, setSize] = useState("");
  const [challengeTarget, setChallengeTarget] = useState(null);
  const { data: teams, loading, error, reload } = useAsync(
    () => browseTeams({ game: game || undefined, size: size || undefined, excludeUserId: userId }),
    [game, size, userId]
  );
  const list = teams || [];
  const hasOwnTeam = (myTeams || []).length > 0;

  return (
    <>
      <div className="ladderFilters">
        <select className="field" value={game} onChange={(e) => setGame(e.target.value)} aria-label="Filter by game">
          <option value="">All games</option>
          {GAME_NAMES.map((g) => <option key={g} value={g}>{shortForGame(g) || g}</option>)}
        </select>
        <select className="field" value={size} onChange={(e) => setSize(e.target.value)} aria-label="Filter by team size">
          <option value="">All sizes</option>
          <option value="1">Solos · 1v1</option>
          <option value="2">Dubs · 2v2</option>
          <option value="4">Squads · 4v4</option>
        </select>
        {!hasOwnTeam && (
          <Button variant="ghost" className="sm" onClick={onCreate}><UserPlus size={14} /> Create a team to challenge</Button>
        )}
      </div>

      {loading ? (
        <SkeletonRows rows={5} height={76} />
      ) : error ? (
        <div className="errorState"><p>{error}</p><button className="btn btn-ghost sm" onClick={reload}>Retry</button></div>
      ) : list.length === 0 ? (
        <EmptyState icon={Swords} title="No teams to challenge">No teams match these filters yet. Widen your search or be the one others come looking for.</EmptyState>
      ) : (
        <div className="ladderList">
          {list.map((t, i) => {
            const w = (t.wins || 0) + (t.tourney_wins || 0);
            const l = (t.losses || 0) + (t.tourney_losses || 0);
            const total = w + l;
            const pct = total ? Math.round((w / total) * 100) : 0;
            const members = t.team_members || [];
            return (
              <div className="ladderRow" key={t.id}>
                <span className="ladderRank">{i + 1}</span>
                <TeamCrest team={t} size={40} />
                <div className="ladderInfo">
                  <b>{t.name}</b>
                  <small>{shortForGame(t.game) || t.game} · {teamCategoryLabel(t.size)} · <span className={`teamTypeBadge ${t.type}`}>{t.type === "tournament" ? "TOURNEY" : t.type.toUpperCase()}</span></small>
                </div>
                <div className="ladderRoster">
                  {members.slice(0, 4).map((m) => (
                    <div className="ladderAvatar" key={m.user_id} title={m.profiles?.username}>
                      {m.profiles?.avatar_url ? <img src={m.profiles.avatar_url} alt="" /> : <span>{(m.profiles?.username || "?").slice(0, 2).toUpperCase()}</span>}
                    </div>
                  ))}
                  {members.length > 4 && <span className="ladderMore">+{members.length - 4}</span>}
                </div>
                <div className="ladderStat"><b>{w}-{l}</b><small>{total ? `${pct}% W` : "New"}</small></div>
                <Button variant="primary" className="sm" onClick={() => setChallengeTarget(t)}><Swords size={13} /> Challenge</Button>
              </div>
            );
          })}
        </div>
      )}

      {challengeTarget && (
        <ChallengeModal
          target={challengeTarget}
          myTeams={myTeams}
          onClose={() => setChallengeTarget(null)}
        />
      )}
    </>
  );
}

// Hoisted to module scope so realtime reloads on the parent don't remount the
// modal and wipe whatever the user is typing.
function CreateTeamModal({ open, onClose, onDone }) {
  const toast = useToast();
  const [name, setName] = useState(""); const [tag, setTag] = useState("");
  const [type, setType] = useState("xp"); const [game, setGame] = useState("All Games");
  const [teamSize, setTeamSize] = useState("dubs");
  const [platform, setPlatform] = useState("PlayStation Only");
  const [color, setColor] = useState(null);
  const [busy, setBusy] = useState(false);
  const wwii = game !== "All Games" && isConsoleOnlyGame(game);
  const sizeMap = { solos: 1, dubs: 2, squads: 4 };
  return (
    <Modal open={open} onClose={onClose} eyebrow="CREATE TEAM" title="New team" size="sm">
      <label className="fieldLbl">Team category</label>
      <div className="segRow">
        <button className={teamSize === "solos" ? "on" : ""} onClick={() => setTeamSize("solos")}>Solos</button>
        <button className={teamSize === "dubs" ? "on" : ""} onClick={() => setTeamSize("dubs")}>Dubs</button>
        <button className={teamSize === "squads" ? "on" : ""} onClick={() => setTeamSize("squads")}>Squads</button>
      </div>
      <label className="fieldLbl">Team name</label>
      <input className="field" value={name} onChange={(e) => setName(e.target.value.replace(/[^a-zA-Z0-9 ]/g, ""))} maxLength={24} placeholder="e.g. Night Owls" />
      <label className="fieldLbl">Tag</label>
      <input className="field" value={tag} maxLength={4} onChange={(e) => setTag(e.target.value.replace(/[^a-zA-Z0-9]/g, ""))} placeholder="OWL" />
      <label className="fieldLbl">Tag color <small className="lblHint">(you can upload a logo later)</small></label>
      <div className="crestColors" style={{ marginBottom: 4, justifyContent: "flex-start" }}>
        <TeamCrest team={{ tag: (tag || name || "?").slice(0, 4), color }} size={34} />
        {CREST_COLORS.map((c) => (
          <button key={c} className={`crestSwatch${color === c ? " on" : ""}`} style={{ background: c }} onClick={() => setColor(color === c ? null : c)} aria-label={`Accent color ${c}`} title="Accent color" />
        ))}
      </div>
      <label className="fieldLbl">Game (optional)</label>
      <select className="field" value={game} onChange={(e) => setGame(e.target.value)}>
        <option value="All Games">All Games</option>
        {GAME_NAMES.map((g) => <option key={g} value={g}>{g}</option>)}
      </select>
      {wwii && (
        <>
          <label className="fieldLbl">Platform</label>
          <div className="segRow">
            {(platformsForGame(game) || WWII_PLATFORMS).map((p) => (
              <button key={p} className={platform === p ? "on" : ""} onClick={() => setPlatform(p)}>
                {p === "PlayStation Only" ? "PSN" : "Xbox"}
              </button>
            ))}
          </div>
        </>
      )}
      <label className="fieldLbl">Type</label>
      <div className="segRow">
        <button className={type === "xp" ? "on" : ""} onClick={() => setType("xp")}><Zap size={14} /> XP</button>
        <button className={type === "cash" ? "on" : ""} onClick={() => setType("cash")}><DollarSign size={14} /> Cash</button>
        <button className={type === "tournament" ? "on" : ""} onClick={() => setType("tournament")}><Trophy size={14} /> Tournament</button>
      </div>
      <Button variant="primary" className="wide" loading={busy} onClick={async () => {
        if (!name.trim()) return toast.error("Team name required.");
        setBusy(true);
        const res = await createTeam({ name, tag, type, game, platform: wwii ? platform : null, size: sizeMap[teamSize], color });
        setBusy(false);
        if (res.error) return toast.error(res.error);
        toast.success("Team created.");
        onDone(); onClose();
      }}>Create team</Button>
    </Modal>
  );
}

function InviteModal({ team, onClose, onDone }) {
  const toast = useToast();
  const [uname, setUname] = useState(""); const [busy, setBusy] = useState(false);
  return (
    <Modal open onClose={onClose} eyebrow={`INVITE · ${team.name}`} title="Invite a teammate" size="sm">
      <label className="fieldLbl">Username</label>
      <input className="field" value={uname} onChange={(e) => setUname(e.target.value)} placeholder="their username" />
      <Button variant="primary" className="wide" loading={busy} onClick={async () => {
        setBusy(true);
        const res = await inviteToTeam(team.id, uname);
        setBusy(false);
        if (res.error) return toast.error(inviteError(res.error));
        toast.success("Invite sent.");
        onDone(); onClose();
      }}>Send invite</Button>
    </Modal>
  );
}

// ── Team Detail Page ──
const CREST_COLORS = ["#22c5fb", "#7c5cff", "#ffc23c", "#3ecf6e", "#ff4d5e", "#ff8c42", "#ff5ca8", "#c0c0c0"];

// Owner-only crest editor: upload a logo and/or pick an accent color.
function CrestEditor({ team, onSaved }) {
  const toast = useToast();
  const [logo, setLogo] = useState(team.logo_url || null);
  const [color, setColor] = useState(team.color || null);
  const [busy, setBusy] = useState(false);

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const { url, error } = await uploadTeamCrest(team.id, file);
    if (error) { setBusy(false); return toast.error(error); }
    const { error: saveErr } = await updateTeamCrest(team.id, { logo_url: url });
    setBusy(false);
    if (saveErr) return toast.error("Couldn't save crest. Try again.");
    setLogo(url); team.logo_url = url;
    toast.success("Crest updated.");
    onSaved?.();
  }

  async function removeLogo() {
    setBusy(true);
    const { error } = await updateTeamCrest(team.id, { logo_url: null });
    setBusy(false);
    if (error) return toast.error("Couldn't remove crest.");
    setLogo(null); team.logo_url = null;
    toast.success("Crest removed.");
    onSaved?.();
  }

  async function pickColor(c) {
    const next = color === c ? null : c;
    setColor(next); team.color = next;
    const { error } = await updateTeamCrest(team.id, { color: next });
    if (error) { setColor(color); team.color = color; return toast.error("Couldn't save color."); }
    onSaved?.();
  }

  return (
    <div className="crestEditor">
      <div className="crestEditorMain">
        <TeamCrest team={{ ...team, logo_url: logo, color }} size={48} />
        <div className="crestEditorInfo">
          <b>Team crest</b>
          <small>{logo ? "Shown across the app" : "Upload a logo, or pick an accent color for your tag"}</small>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <label className="btn btn-ghost sm crestUpload">
          <ImagePlus size={14} /> {logo ? "Replace" : "Upload"}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={onFile} disabled={busy} />
        </label>
        {logo && <Button variant="ghost" className="sm" onClick={removeLogo} disabled={busy}>Remove</Button>}
      </div>
      <div className="crestColors">
        {CREST_COLORS.map((c) => (
          <button key={c} className={`crestSwatch${color === c ? " on" : ""}`} style={{ background: c }} onClick={() => pickColor(c)} aria-label={`Accent color ${c}`} title="Accent color" />
        ))}
      </div>
    </div>
  );
}

function TeamDetailPage({ team, onBack, onNavigate, onReload }) {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [inviteOpen, setInviteOpen] = useState(false);
  const { data: activeMatches, reload: reloadActive } = useAsync(() => getTeamActiveMatches(team.id), [team.id]);
  const { data: history, reload: reloadHistory } = useAsync(() => getTeamMatchHistory(team.id), [team.id]);
  const { data: challenges, reload: reloadChallenges } = useAsync(() => getTeamChallenges(team.id), [team.id]);

  // Realtime: active matches update via match status changes
  useEffect(() => {
    const channel = supabase
      .channel(`team-active:${team.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "matches" }, (payload) => {
        if (["open", "live", "reported", "disputed", "settled", "cancelled"].includes(payload.new?.status)) {
          reloadActive();
        }
      })
      .subscribe();
    const unsub = subscribeToTeamMatches(team.id, () => { reloadActive(); reloadHistory(); });
    const unsubChall = subscribeToChallenges(team.id, () => reloadChallenges());
    return () => { supabase.removeChannel(channel); unsub(); unsubChall(); };
  }, [team.id]);

  // Fallback: refresh on tab focus
  useVisibilityRefresh(() => { reloadActive(); reloadHistory(); });

  const members = team.team_members || [];
  const isOwner = team.owner_id === user.id;
  const ladderW = team.wins || 0;
  const ladderL = team.losses || 0;
  const tourneyW = team.tourney_wins || 0;
  const tourneyL = team.tourney_losses || 0;
  const totalW = ladderW + tourneyW;
  const totalL = ladderL + tourneyL;
  const winPct = totalW + totalL > 0 ? Math.round((totalW / (totalW + totalL)) * 100) : 0;

  const recentForm = (history || []).slice(0, 5).map((h) => h.result === "win" ? "W" : "L");

  return (
    <main className="page">
      <button className="backLink" onClick={onBack}><ChevronLeft size={16} /> Back to teams</button>

      <div className="pageHead">
        <TeamCrest team={team} size={56} />
        <h1>{team.name}</h1>
        <p className="sub">{shortForGame(team.game) || team.game} · {teamCategoryLabel(team.size)} · <span className={`teamTypeBadge ${team.type}`}>{team.type === "tournament" ? "TOURNEY" : team.type.toUpperCase()}</span>{team.platform ? ` · ${team.platform}` : ""}</p>
      </div>

      {isOwner && <CrestEditor team={team} onSaved={onReload} />}

      {/* Record slab */}
      <section className="panel2 teamRecordSlab">
        <h2><Trophy size={16} /> Team Record</h2>
        <div className="teamStatGrid">
          <RecordStat label="Overall" value={`${totalW}W - ${totalL}L`} sub={`${winPct}% win rate`} />
          <RecordStat label="Ladder" value={`${ladderW}W - ${ladderL}L`} />
          <RecordStat label="Tournament" value={`${tourneyW}W - ${tourneyL}L`} />
          <RecordStat label="Earnings" value={money(team.earnings || 0)} accent />
          <RecordStat label="Team XP" value={String(team.xp || 0)} />
          {recentForm.length > 0 && (
            <div className="statBox2">
              <small>Recent</small>
              <div className="formStreak">
                {recentForm.map((r, i) => <span key={i} className={r === "W" ? "formW" : "formL"}>{r}</span>)}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Active Matches — the never-lose-a-match panel */}
      <section className="panel2">
        <h2><Swords size={16} /> Active Matches</h2>
        {!activeMatches || activeMatches.length === 0 ? (
          <p className="sub" style={{ padding: "12px 0" }}>No active matches right now.</p>
        ) : (
          <div className="activeMatchList">
            {activeMatches.map((m) => (
              <ActiveMatchCard key={m.id} match={m} onGo={() => onNavigate?.("match", m.id)} />
            ))}
          </div>
        )}
      </section>

      {/* Challenges */}
      <ChallengesPanel challenges={challenges || []} teamId={team.id} isOwner={isOwner} onReload={reloadChallenges} onNavigate={onNavigate} />

      {/* Match History */}
      {history && history.length > 0 && (
        <section className="panel2">
          <h2><Target size={16} /> Recent Results</h2>
          <div className="teamHistoryList">
            {history.map((h) => (
              <div key={h.id} className={`historyRow ${h.result}`}>
                <span className={`historyResult ${h.result}`}>{h.result === "win" ? "W" : "L"}</span>
                <span className="historyOpp">vs {h.opponent?.name || h.opponent?.tag || "-"}</span>
                {h.earnings > 0 && <span className="cash">+{money(h.earnings)}</span>}
                <span className="historyXp">+{h.xp_earned} XP</span>
                {h.tournament_id && <span className="badge sm">Tourney</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Roster */}
      <section className="panel2">
        <div className="panelHead">
          <h2><Users size={16} /> Roster ({members.length})</h2>
          {isOwner && <Button variant="ghost" onClick={() => setInviteOpen(true)}><UserPlus size={14} /> Invite</Button>}
        </div>
        <div className="teamRosterDetail">
          {members.map((m) => <PlayerCard key={m.user_id} member={m} onClick={() => onNavigate?.("profile", m.profiles?.username)} />)}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {isOwner ? (
            <Button variant="danger" className="sm" onClick={async () => {
              if (!await confirm({ title: "Disband team?", message: "This will permanently delete the team and remove all members. This cannot be undone.", confirmLabel: "Disband" })) return;
              const res = await disbandTeam(team.id);
              if (res.error) return toast.error(res.error);
              toast.success("Team disbanded.");
              onReload(); onBack();
            }}><Trash2 size={14} /> Disband</Button>
          ) : (
            <Button variant="ghost" className="sm" onClick={async () => {
              if (!await confirm({ title: "Leave team?", message: "You can rejoin later if the captain invites you back.", confirmLabel: "Leave", variant: "ghost" })) return;
              const res = await leaveTeam(team.id, user.id);
              if (res.error) return toast.error(res.error);
              toast.success("Left team.");
              onReload(); onBack();
            }}><LogOut size={14} /> Leave</Button>
          )}
        </div>
      </section>

      {inviteOpen && (
        <Modal open onClose={() => setInviteOpen(false)} eyebrow={`INVITE · ${team.name}`} title="Invite a teammate" size="sm">
          <InlineInviteForm teamId={team.id} onDone={() => { setInviteOpen(false); onReload(); }} />
        </Modal>
      )}
    </main>
  );
}

function ChallengesPanel({ challenges, teamId, isOwner, onReload, onNavigate }) {
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const pending = challenges.filter(c => c.status === "pending");
  const incoming = pending.filter(c => c.to_team_id === teamId);
  const outgoing = pending.filter(c => c.from_team_id === teamId);
  const past = challenges.filter(c => c.status !== "pending").slice(0, 5);

  async function handleRespond(id, accept) {
    setBusy(id);
    const { data: matchId, error } = await respondChallenge(id, accept);
    setBusy(null);
    if (error) return toast.error(error);
    if (accept && matchId) {
      toast.success("Challenge accepted! Match is live.");
      onNavigate?.("match", matchId);
    } else {
      toast.success("Challenge declined.");
    }
    onReload();
  }

  if (pending.length === 0 && past.length === 0) return null;

  return (
    <section className="panel2">
      <h2><Swords size={16} /> Challenges</h2>

      {incoming.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <small className="eyebrow" style={{ marginBottom: 6, display: "block" }}>INCOMING</small>
          {incoming.map(c => (
            <div className="challengeRow incoming" key={c.id}>
              <div className="challengeInfo">
                <span className="teamTag">{c.from_team?.tag}</span>
                <b>{c.from_team?.name}</b>
                <small>{c.from_team?.wins || 0}W - {c.from_team?.losses || 0}L</small>
                <small>{c.mode} · {c.format} · {c.kind === "cash" ? money(c.entry) : "XP"}</small>
                {c.message && <span className="challengeMsg">"{c.message}"</span>}
              </div>
              <span className="badge pending">Pending</span>
              {isOwner && (
                <div className="challengeActions">
                  <button className="btn btn-primary sm" disabled={busy === c.id} onClick={() => handleRespond(c.id, true)}>Accept</button>
                  <button className="btn btn-ghost sm" disabled={busy === c.id} onClick={() => handleRespond(c.id, false)}>Decline</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {outgoing.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <small className="eyebrow" style={{ marginBottom: 6, display: "block" }}>SENT</small>
          {outgoing.map(c => (
            <div className="challengeRow outgoing" key={c.id}>
              <div className="challengeInfo">
                <span className="teamTag">{c.to_team?.tag}</span>
                <b>{c.to_team?.name}</b>
                {c.message && <span className="challengeMsg">"{c.message}"</span>}
              </div>
              <span className="badge pending">Waiting for response</span>
            </div>
          ))}
        </div>
      )}

      {past.length > 0 && (
        <div>
          <small className="eyebrow" style={{ marginBottom: 6, display: "block" }}>RECENT</small>
          {past.map(c => {
            const isIncoming = c.to_team_id === teamId;
            const other = isIncoming ? c.from_team : c.to_team;
            return (
              <div className={`challengeRow ${c.status}`} key={c.id}>
                <div className="challengeInfo">
                  <span className="teamTag">{other?.tag}</span>
                  <b>{other?.name}</b>
                </div>
                <span className={`badge ${c.status}`}>{c.status === "accepted" ? "Accepted" : "Declined"}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function InlineInviteForm({ teamId, onDone }) {
  const toast = useToast();
  const [uname, setUname] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <label className="fieldLbl">Username</label>
      <input className="field" value={uname} onChange={(e) => setUname(e.target.value)} placeholder="their username" />
      <Button variant="primary" className="wide" loading={busy} onClick={async () => {
        setBusy(true);
        const res = await inviteToTeam(teamId, uname);
        setBusy(false);
        if (res.error) return toast.error(inviteError(res.error));
        toast.success("Invite sent.");
        onDone();
      }}>Send invite</Button>
    </>
  );
}

function PlayerCard({ member: m, compact, onClick }) {
  const p = m.profiles || {};
  const rank = rankForXp(p.xp || 0);
  const w = p.wins || 0;
  const l = p.losses || 0;
  const initials = (p.username || "?").slice(0, 2).toUpperCase();

  if (compact) {
    return (
      <div className="playerCardCompact">
        <div className="playerCardAvatar" style={{ borderColor: rank.glow }}>
          {p.avatar_url ? <img src={p.avatar_url} alt="" /> : <span>{initials}</span>}
        </div>
        <span className="playerCardName">
          {p.username}{p.wagr_member && <WagrBadge size={10} />}
          {p.country && <img className="countryFlag" src={countryFlag(p.country)} alt={p.country} />}
          {regionTag(p.country) && <span className="regionTag">{regionTag(p.country)}</span>}
          <small style={{ display: "block", color: rank.glow, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em" }}>{rank.name} · {w}-{l}</small>
        </span>
        {m.role === "owner" && <span className="playerCardRole">CAPT</span>}
      </div>
    );
  }

  return (
    <div className="playerCard" {...(onClick ? clickable(onClick) : {})}>
      <div className="playerCardAvatar lg" style={{ borderColor: rank.glow, boxShadow: `0 0 12px ${rank.glow}33` }}>
        {p.avatar_url ? <img src={p.avatar_url} alt="" /> : <span>{initials}</span>}
      </div>
      <div className="playerCardInfo">
        <div className="playerCardName">
          {p.username}
          {p.wagr_member && <WagrBadge size={12} />}
          {p.country && <img className="countryFlag" src={countryFlag(p.country)} alt={p.country} />}
          {regionTag(p.country) && <span className="regionTag">{regionTag(p.country)}</span>}
          {m.role === "owner" && <span className="playerCardRole">CAPT</span>}
        </div>
        <div className="playerCardRank" style={{ color: rank.glow }}>
          <RankStar rank={rank} size={14} /> {rank.name}
        </div>
        <div className="playerCardRecord">{w}W – {l}L</div>
      </div>
    </div>
  );
}

function RecordStat({ label, value, sub, accent }) {
  return (
    <div className="statBox2">
      <small>{label}</small>
      <b className={accent ? "cash" : ""}>{value}</b>
      {sub && <small className="subtle">{sub}</small>}
    </div>
  );
}

function ActiveMatchCard({ match, onGo }) {
  const m = match;
  const players = m.match_players || [];
  const statusLabel = { open: "Waiting", live: "LIVE", reported: "Reporting", disputed: "Disputed" };
  const statusClass = m.status === "live" ? "live" : m.status === "disputed" ? "warn" : "";

  return (
    <div className="activeMatchCard">
      <div className="activeMatchTop">
        <span className={`matchStatusBadge ${statusClass}`}>{statusLabel[m.status] || m.status}</span>
        <span className="matchTicket">#{m.code}</span>
      </div>
      <div className="activeMatchMeta">
        <b>{shortForGame(m.game) || m.game}</b>
        <small>{m.format} · {m.mode} · {seriesLabel(m.series)}</small>
        <small>{m.platform} · {m.region}</small>
      </div>
      <div className="activeMatchPlayers">
        {players.map((p) => (
          <span key={p.user_id} className="memberChip">{p.profiles?.username || "?"}</span>
        ))}
      </div>
      {m.kind === "cash" && <div className="activeMatchEntry"><small>Entry</small><b className="cash">{money(m.entry)}</b></div>}
      <Button variant="primary" className="wide sm" onClick={onGo}><ArrowRight size={14} /> Go to match</Button>
    </div>
  );
}
