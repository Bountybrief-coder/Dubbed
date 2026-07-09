import React, { useState, useEffect } from "react";
import { UserPlus, Users, LogOut, Trash2, ChevronLeft, Swords, Trophy, ArrowRight, Zap, DollarSign, Target, TrendingUp } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useToast } from "../hooks/useToast.jsx";
import { useAsync } from "../hooks/useAsync";
import { useVisibilityRefresh } from "../hooks/useVisibilityRefresh";
import { getMyTeams, getMyInvites, createTeam, inviteToTeam, acceptInvite, declineInvite, leaveTeam, disbandTeam, getTeamActiveMatches, getTeamMatchHistory, subscribeToTeamMatches } from "../services/teamService";
import { Modal } from "../components/Modal";
import { Button } from "../components/Button";
import { SkeletonRows } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { GAME_NAMES, isConsoleOnlyGame, WWII_PLATFORMS, shortForGame } from "../utils/games";
import { money } from "../utils/format";
import { supabase } from "../lib/supabase";

export function TeamsPage({ onNavigate }) {
  const { user, profile } = useAuth();
  const toast = useToast();
  const { data: teams, loading, error, reload } = useAsync(() => getMyTeams(user.id), [user.id]);
  const { data: invites, reload: reloadInv } = useAsync(() => getMyInvites(user.id), [user.id]);
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteFor, setInviteFor] = useState(null);
  const [detail, setDetail] = useState(null);

  if (detail) {
    return <TeamDetailPage team={detail} onBack={() => setDetail(null)} onNavigate={onNavigate} onReload={reload} />;
  }

  return (
    <main className="page">
      <div className="pageHead rowHead">
        <div><div className="eyebrow">YOUR CREW</div><h1>Teams</h1><p className="sub">Build XP or cash squads and invite teammates.</p></div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}><UserPlus size={16} /> Create team</Button>
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
        <EmptyState icon={Users} title="No teams yet">Create a team and invite teammates to run duos, trios or squads.</EmptyState>
      ) : (
        <div className="teamGrid2">
          {teams.map((t) => {
            const members = t.team_members || [];
            const totalW = (t.wins || 0) + (t.tourney_wins || 0);
            const totalL = (t.losses || 0) + (t.tourney_losses || 0);
            return (
              <div className="teamCard2" key={t.id} onClick={() => setDetail(t)} style={{ cursor: "pointer" }}>
                <div className="teamCardTop">
                  <span className="teamTag big">{t.tag}</span>
                  <div>
                    <b>{t.name}</b>
                    <small>{shortForGame(t.game) || t.game} · {t.type}{t.platform ? ` · ${t.platform}` : ""}</small>
                  </div>
                </div>
                <div className="teamStatRow">
                  <span>{totalW}W - {totalL}L</span>
                  {t.earnings > 0 && <span className="cash">{money(t.earnings)}</span>}
                  <span>{t.xp || 0} XP</span>
                </div>
                <div className="memberChips">
                  {members.map((m) => <span key={m.user_id} className="memberChip">{m.profiles?.username}{m.role === "owner" && <em>owner</em>}</span>)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateTeamModal open={createOpen} onClose={() => setCreateOpen(false)} onDone={reload} />
      {inviteFor && <InviteModal team={inviteFor} onClose={() => setInviteFor(null)} onDone={reload} />}
    </main>
  );

  function CreateTeamModal({ open, onClose, onDone }) {
    const [name, setName] = useState(""); const [tag, setTag] = useState("");
    const [type, setType] = useState("xp"); const [game, setGame] = useState(GAME_NAMES[0]);
    const [platform, setPlatform] = useState("PlayStation Only");
    const [busy, setBusy] = useState(false);
    const wwii = isConsoleOnlyGame(game);
    return (
      <Modal open={open} onClose={onClose} eyebrow="CREATE TEAM" title="New team" size="sm">
        <label className="fieldLbl">Team name</label>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Night Owls" />
        <label className="fieldLbl">Tag</label>
        <input className="field" value={tag} maxLength={4} onChange={(e) => setTag(e.target.value)} placeholder="OWL" />
        <label className="fieldLbl">Game</label>
        <select className="field" value={game} onChange={(e) => setGame(e.target.value)}>
          {GAME_NAMES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        {wwii && (
          <>
            <label className="fieldLbl">Platform</label>
            <div className="segRow">
              {WWII_PLATFORMS.map((p) => (
                <button key={p} className={platform === p ? "on" : ""} onClick={() => setPlatform(p)}>
                  {p === "PlayStation Only" ? "PSN" : "Xbox"}
                </button>
              ))}
            </div>
          </>
        )}
        <label className="fieldLbl">Type</label>
        <div className="segRow"><button className={type === "xp" ? "on" : ""} onClick={() => setType("xp")}>XP</button><button className={type === "cash" ? "on" : ""} onClick={() => setType("cash")}>Cash</button></div>
        <Button variant="primary" className="wide" loading={busy} onClick={async () => {
          if (!name.trim()) return toast.error("Team name required.");
          setBusy(true);
          const res = await createTeam({ name, tag, type, game, platform: wwii ? platform : null });
          setBusy(false);
          if (res.error) return toast.error(res.error);
          toast.success("Team created.");
          onDone(); onClose();
        }}>Create team</Button>
      </Modal>
    );
  }

  function InviteModal({ team, onClose, onDone }) {
    const [uname, setUname] = useState(""); const [busy, setBusy] = useState(false);
    return (
      <Modal open onClose={onClose} eyebrow={`INVITE · ${team.name}`} title="Invite a teammate" size="sm">
        <label className="fieldLbl">Username</label>
        <input className="field" value={uname} onChange={(e) => setUname(e.target.value)} placeholder="their username" />
        <Button variant="primary" className="wide" loading={busy} onClick={async () => {
          setBusy(true);
          const res = await inviteToTeam(team.id, uname);
          setBusy(false);
          if (res.error) return toast.error(res.error);
          toast.success("Invite sent.");
          onDone(); onClose();
        }}>Send invite</Button>
      </Modal>
    );
  }
}

// ── Team Detail Page ──
function TeamDetailPage({ team, onBack, onNavigate, onReload }) {
  const { user } = useAuth();
  const toast = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const { data: activeMatches, reload: reloadActive } = useAsync(() => getTeamActiveMatches(team.id), [team.id]);
  const { data: history, reload: reloadHistory } = useAsync(() => getTeamMatchHistory(team.id), [team.id]);

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
    return () => { supabase.removeChannel(channel); unsub(); };
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
        <span className="teamTag big">{team.tag}</span>
        <h1>{team.name}</h1>
        <p className="sub">{shortForGame(team.game) || team.game} · {team.type}{team.platform ? ` · ${team.platform}` : ""}</p>
      </div>

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

      {/* Match History */}
      {history && history.length > 0 && (
        <section className="panel2">
          <h2><Target size={16} /> Recent Results</h2>
          <div className="teamHistoryList">
            {history.map((h) => (
              <div key={h.id} className={`historyRow ${h.result}`}>
                <span className={`historyResult ${h.result}`}>{h.result === "win" ? "W" : "L"}</span>
                <span className="historyOpp">vs {h.opponent?.name || h.opponent?.tag || "—"}</span>
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
        <div className="memberChips">
          {members.map((m) => (
            <span key={m.user_id} className="memberChip" onClick={() => onNavigate?.("profile", m.profiles?.username)} style={{ cursor: "pointer" }}>
              {m.profiles?.username}{m.role === "owner" && <em>owner</em>}
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {isOwner ? (
            <Button variant="danger" className="sm" onClick={async () => {
              if (!confirm("Disband this team? This cannot be undone.")) return;
              const res = await disbandTeam(team.id);
              if (res.error) return toast.error(res.error);
              toast.success("Team disbanded.");
              onReload(); onBack();
            }}><Trash2 size={14} /> Disband</Button>
          ) : (
            <Button variant="ghost" className="sm" onClick={async () => {
              if (!confirm("Leave this team?")) return;
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
        if (res.error) return toast.error(res.error);
        toast.success("Invite sent.");
        onDone();
      }}>Send invite</Button>
    </>
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
        <small>{m.format} · {m.mode} · {m.series}</small>
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
