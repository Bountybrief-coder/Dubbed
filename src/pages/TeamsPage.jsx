import React, { useState } from "react";
import { UserPlus, Users, LogOut, Trash2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useToast } from "../hooks/useToast.jsx";
import { useAsync } from "../hooks/useAsync";
import { getMyTeams, getMyInvites, createTeam, inviteToTeam, acceptInvite, declineInvite, leaveTeam, disbandTeam } from "../services/teamService";
import { Modal } from "../components/Modal";
import { Button } from "../components/Button";
import { SkeletonRows } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { GAME_NAMES } from "../utils/games";

export function TeamsPage() {
  const { user, profile } = useAuth();
  const toast = useToast();
  const { data: teams, loading, reload } = useAsync(() => getMyTeams(user.id), [user.id]);
  const { data: invites, reload: reloadInv } = useAsync(() => getMyInvites(user.id), [user.id]);
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteFor, setInviteFor] = useState(null);

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
      ) : !teams || teams.length === 0 ? (
        <EmptyState icon={Users} title="No teams yet">Create a team and invite teammates to run duos, trios or squads.</EmptyState>
      ) : (
        <div className="teamGrid2">
          {teams.map((t) => {
            const members = t.team_members || [];
            return (
              <div className="teamCard2" key={t.id}>
                <div className="teamCardTop"><span className="teamTag big">{t.tag}</span><div><b>{t.name}</b><small>{t.type} team</small></div></div>
                <div className="memberChips">
                  {members.map((m) => <span key={m.user_id} className="memberChip">{m.profiles?.username}{m.role === "owner" && <em>owner</em>}</span>)}
                </div>
                {t.owner_id === user.id && <Button variant="ghost" className="wide" onClick={() => setInviteFor(t)}><UserPlus size={14} /> Invite teammate</Button>}
                {t.owner_id === user.id ? (
                  <Button variant="danger" className="wide sm" onClick={async () => {
                    if (!confirm("Disband this team? This cannot be undone.")) return;
                    const res = await disbandTeam(t.id);
                    if (res.error) return toast.error(res.error);
                    toast.success("Team disbanded.");
                    reload();
                  }}><Trash2 size={14} /> Disband team</Button>
                ) : (
                  <Button variant="ghost" className="wide sm" onClick={async () => {
                    if (!confirm("Leave this team?")) return;
                    const res = await leaveTeam(t.id, user.id);
                    if (res.error) return toast.error(res.error);
                    toast.success("Left team.");
                    reload();
                  }}><LogOut size={14} /> Leave team</Button>
                )}
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
    const [busy, setBusy] = useState(false);
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
        <label className="fieldLbl">Type</label>
        <div className="segRow"><button className={type === "xp" ? "on" : ""} onClick={() => setType("xp")}>XP</button><button className={type === "cash" ? "on" : ""} onClick={() => setType("cash")}>Cash</button></div>
        <Button variant="primary" className="wide" loading={busy} onClick={async () => {
          if (!name.trim()) return toast.error("Team name required.");
          setBusy(true);
          const res = await createTeam({ name, tag, type, game });
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
