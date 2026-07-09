import React, { useState } from "react";
import { Trophy, ChevronLeft, Users, Swords, BookOpen, Crown } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useToast } from "../hooks/useToast.jsx";
import { useAsync } from "../hooks/useAsync";
import { listTournaments, getTournament, joinTournament, pooledPrize, getTournamentBracket, adminGenerateBracket, startTournamentMatch, subscribeToTournamentMatches } from "../services/tournamentService";
import { getMyTeams } from "../services/teamService";
import { Countdown } from "../components/Countdown";
import { Bracket } from "../components/Bracket";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { SkeletonRows } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { money } from "../utils/format";
import { modeRule, seriesRule, shortForGame, RAKE_CONFIG } from "../utils/games";
import bo7 from "../assets/black-ops-7.png";
import wz from "../assets/warzone.png";
import mw4Img from "../assets/mw4.png";

const GAME_COVERS = {
  "Call of Duty: Black Ops 7": bo7, "Warzone": wz, "Black Ops Royale": wz,
  "Call of Duty: Modern Warfare 4": mw4Img,
};
const cover = (g) => GAME_COVERS[g] || bo7;

export function TournamentsPage({ onLogin, onNavigate }) {
  const { profile, isAdmin } = useAuth();
  const { data, loading, error, reload } = useAsync(() => listTournaments(), []);
  const [joinT, setJoinT] = useState(null);
  const [regionFilter, setRegionFilter] = useState("All");
  const [detailId, setDetailId] = useState(null);

  const REGION_FILTERS = ["All", "NA", "EU", "NA + EU", "Latin America", "Worldwide"];
  const filtered = !data ? [] : regionFilter === "All" ? data
    : data.filter((t) => t.region === regionFilter);

  if (detailId) {
    const initial = data?.find((t) => t.id === detailId);
    return (
      <TournamentDetail
        initialT={initial || { id: detailId }}
        onBack={() => setDetailId(null)}
        onNavigate={onNavigate}
        onLogin={onLogin}
        reload={reload}
      />
    );
  }

  return (
    <main className="page">
      <div className="pageHead">
        <div className="eyebrow">HOSTED · COMMUNITY-FUNDED</div>
        <h1>Tournaments</h1>
        <p className="sub">The pot is built by who shows up. Entry times teams joined. 2% keeps the lights on, rest goes to the winners.</p>
      </div>

      <div className="chipRow" style={{ marginBottom: 16 }}>
        {REGION_FILTERS.map((r) => (
          <button key={r} className={regionFilter === r ? "on" : ""} onClick={() => setRegionFilter(r)}>{r}</button>
        ))}
      </div>

      {loading ? (
        <SkeletonRows rows={4} height={72} />
      ) : error ? (
        <div className="errorState"><p>{error}</p><button className="btn btn-ghost sm" onClick={reload}>Retry</button></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Trophy} title="No tournaments scheduled">Check back soon. Hosted brackets appear here.</EmptyState>
      ) : (
        <div className="tourList">
          {filtered.map((t) => {
            const pz = pooledPrize(t.entry, t.entries_count);
            const full = t.entries_count >= t.capacity;
            const started = new Date(t.starts_at).getTime() <= Date.now();
            const done = t.status === "completed";
            return (
              <div className="tourTile" key={t.id} onClick={() => setDetailId(t.id)} role="button" style={{ cursor: "pointer" }}>
                <img className="tourCover" src={cover(t.game)} alt="" loading="lazy" />
                <div className="tourMeta">
                  <b>{t.name}</b>
                  <small>{shortForGame(t.game)} · {t.format} {t.mode} · {t.series} · {t.region}</small>
                  <div className="matchBadges">
                    <span className="badge">{t.platform}</span>
                    {t.skill_tier !== "Open" && <span className="badge accent">{t.skill_tier}</span>}
                    {t.weapon_restriction && <span className="badge warn">{t.weapon_restriction}</span>}
                  </div>
                  {done && t.winner_name && <span className="tourWinner"><Trophy size={12} /> {t.winner_name}</span>}
                </div>
                <div className="tourStat"><small>CURRENT POT</small><b className="cash">{money(pz.pot)}</b></div>
                <div className="tourStat"><small>ENTRY</small><b>{money(t.entry)}</b></div>
                <div className="tourStat"><small>TEAMS</small><b>{t.entries_count}/{t.capacity}</b></div>
                <div className="tourStat wide"><small>STARTS</small><b>{done ? <em className="doneTag">ENDED</em> : started ? <em className="liveTag">● LIVE</em> : <Countdown to={new Date(t.starts_at).getTime()} />}</b></div>
                <div onClick={(e) => e.stopPropagation()}>
                  {done
                    ? <Button variant="ghost" onClick={() => setDetailId(t.id)}>View</Button>
                    : started
                    ? <Button variant="ghost" onClick={() => setDetailId(t.id)}>View</Button>
                    : <Button variant="primary" disabled={full} onClick={() => (profile ? setJoinT(t) : onLogin())}>{full ? "Full" : "Join"}</Button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {joinT && <JoinModal t={joinT} onClose={() => setJoinT(null)} onDone={reload} onLogin={onLogin} />}
    </main>
  );
}

function JoinModal({ t, onClose, onDone, onLogin }) {
  const toast = useToast();
  const { profile, refreshProfile } = useAuth();
  const { data: teams } = useAsync(() => getMyTeams(profile.id), [profile.id]);
  const cashTeams = (teams || []).filter((x) => x.type === "cash");
  const [entrant, setEntrant] = useState("");
  const [busy, setBusy] = useState(false);
  const potNow = pooledPrize(t.entry, t.entries_count);
  const potAfter = pooledPrize(t.entry, t.entries_count + 1);
  const needsTeam = t.format !== "1v1" && cashTeams.length === 0;
  const entrantName = t.format === "1v1" ? profile.username : (entrant || cashTeams[0]?.name || "");

  return (
    <Modal open onClose={onClose} eyebrow="JOIN TOURNAMENT" title={t.name} size="sm">
      <p className="sub">{t.format} · {t.mode} · {t.series} · {t.region}</p>
      <div className="matchBadges">
        <span className="badge">{t.platform}</span>
        {t.skill_tier !== "Open" && <span className="badge accent">{t.skill_tier}</span>}
        {t.weapon_restriction && <span className="badge warn">{t.weapon_restriction}</span>}
      </div>
      <div className="ruleNote">{modeRule(t.mode)}</div>
      <div className="ruleNote">{seriesRule(t.series)}</div>
      {t.region !== "NA + EU" && t.region !== "Worldwide" && profile.region !== t.region && (
        <div className="errBanner">This tournament is {t.region} Only. Your profile region is set to "{profile.region || "not set"}". Update your region in your profile to join.</div>
      )}
      {(t.region === "NA + EU" || t.region === "Worldwide") && (
        <p className="modalNote">{t.region === "Worldwide" ? "Open to all regions." : ""} Host goes to whichever region has more players once the bracket locks. Ties fall back to the tournament's host rule{t.host_rule && t.host_rule !== "auto" ? ` (${t.host_rule})` : " or a random pick"}.</p>
      )}
      <div className="breakBox">
        <div><span>Entry</span><b>{money(t.entry)}</b></div>
        <div><span>Your balance</span><b>{money(profile.balance)}</b></div>
        <div><span>Pot now ({t.entries_count} teams)</span><b className="cash">{money(potNow.pot)}</b></div>
        <div><span>Pot after you join</span><b className="cash">{money(potAfter.pot)}</b></div>
        {potAfter.first > 0 && <div className="total"><span>1st{t.entries_count + 1 <= 2 ? " · winner takes all" : t.entries_count + 1 < 8 ? " · 85%" : " · 80%"}</span><b className="cash">{money(potAfter.first)}</b></div>}
        {potAfter.second > 0 && <div className="total"><span>2nd · 15%</span><b className="cash">{money(potAfter.second)}</b></div>}
        {potAfter.third > 0 && <div className="total"><span>3rd · 5%</span><b className="cash">{money(potAfter.third)}</b></div>}
      </div>
      <small className="subtle">Platform takes 2% of the pot. {t.entries_count + 1 < 8 ? "3rd place pays out at 8+ teams." : ""}</small>
      <p className="modalNote">Winner also earns a permanent gold trophy with the tournament title on their profile.</p>
      {needsTeam ? (
        <div className="errBanner">You need a cash team for {t.format}. Create one on the Teams page first.</div>
      ) : t.format !== "1v1" && (
        <>
          <label className="fieldLbl">Enter as team</label>
          <select className="field" value={entrantName} onChange={(e) => setEntrant(e.target.value)}>
            {cashTeams.map((x) => <option key={x.id} value={x.name}>{x.name}</option>)}
          </select>
        </>
      )}
      <Button variant="primary" className="wide" disabled={needsTeam || profile.balance < t.entry} loading={busy} onClick={async () => {
        setBusy(true);
        const res = await joinTournament(t.id, entrantName);
        setBusy(false);
        if (res.error) return toast.error(res.error);
        toast.success("Entered. Good luck.");
        refreshProfile(); onDone(); onClose();
      }}>
        {profile.balance < t.entry ? "Insufficient balance" : `Pay ${money(t.entry)} & join`}
      </Button>
    </Modal>
  );
}

const DETAIL_TABS = [
  { id: "overview", label: "Overview", Icon: BookOpen },
  { id: "bracket", label: "Bracket", Icon: Swords },
  { id: "teams", label: "Teams", Icon: Users },
];

function TournamentDetail({ initialT, onBack, onNavigate, onLogin, reload: parentReload }) {
  const toast = useToast();
  const { profile, isAdmin } = useAuth();
  const { data: liveT, reload: reloadT } = useAsync(() => getTournament(initialT.id), [initialT.id]);
  const { data: bracket, reload: reloadBracket } = useAsync(() => getTournamentBracket(initialT.id), [initialT.id]);
  const [tab, setTab] = useState("overview");
  const [busy, setBusy] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const t = liveT || initialT;
  const pz = pooledPrize(t.entry, t.tournament_entries?.length || t.entries_count || 0);
  const entryCount = t.tournament_entries?.length || t.entries_count || 0;
  const started = new Date(t.starts_at).getTime() <= Date.now();
  const done = t.status === "completed";
  const full = entryCount >= t.capacity;
  const rounds = bracket?.rounds || [];
  const matches = bracket?.matches || [];
  const entries = t.tournament_entries || [];

  React.useEffect(() => {
    return subscribeToTournamentMatches(initialT.id, () => { reloadBracket(); reloadT(); });
  }, [initialT.id]); // eslint-disable-line

  async function generateBracket() {
    setBusy(true);
    const res = await adminGenerateBracket(initialT.id);
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success("Bracket generated. Matches auto-started.");
    reloadBracket(); reloadT(); parentReload?.();
  }

  async function startMatch(tmId) {
    const res = await startTournamentMatch(tmId);
    if (res.error) return toast.error(res.error);
    toast.success("Match room created.");
    if (res.matchId && onNavigate) onNavigate("match", res.matchId);
  }

  return (
    <main className="page tourDetailPage">
      <button className="backLink" onClick={onBack}><ChevronLeft size={16} /> All tournaments</button>

      {/* ── Hero ── */}
      <section className="tourHero">
        <img className="tourHeroCover" src={cover(t.game)} alt="" loading="lazy" />
        <div className="tourHeroInfo">
          <div className="eyebrow">{shortForGame(t.game)} · {t.format} · {t.mode}</div>
          <h1>{t.name}</h1>
          <p className="mrSub">{t.series} · {t.region} · {t.platform}</p>
          <div className="matchBadges">
            {t.skill_tier !== "Open" && <span className="badge accent">{t.skill_tier}</span>}
            {t.weapon_restriction && <span className="badge warn">{t.weapon_restriction}</span>}
            <span className={`roomStatus ${done ? "s-settled" : started ? "s-live" : ""}`}>
              {done ? "COMPLETED" : started ? "● LIVE" : "REGISTRATION"}
            </span>
          </div>
        </div>
        <div className="tourHeroStats">
          <div className="tourHeroStat"><small>POT</small><b className="cash">{money(pz.pot)}</b></div>
          <div className="tourHeroStat"><small>ENTRY</small><b>{money(t.entry)}</b></div>
          <div className="tourHeroStat"><small>TEAMS</small><b>{entryCount}/{t.capacity}</b></div>
          <div className="tourHeroStat">
            <small>STARTS</small>
            <b>{done ? <em className="doneTag">ENDED</em> : started ? <em className="liveTag">● LIVE</em> : <Countdown to={new Date(t.starts_at).getTime()} />}</b>
          </div>
        </div>
      </section>

      {/* Winner banner */}
      {done && t.winner_name && (
        <div className="tourneyWinnerBanner">
          <Trophy size={18} /> <b>{t.winner_name}</b> wins!
          {t.second_name && <span> · 2nd: {t.second_name}</span>}
          {t.third_name && <span> · 3rd: {t.third_name}</span>}
        </div>
      )}

      {/* Join button */}
      {!done && !started && !full && (
        <div style={{ marginBottom: 16 }}>
          <Button variant="primary" onClick={() => profile ? setJoinOpen(true) : onLogin()}>Join Tournament · {money(t.entry)}</Button>
        </div>
      )}

      {/* Admin bracket gen */}
      {isAdmin && t.status === "upcoming" && !t.bracket_generated && (
        <Button variant="primary" loading={busy} onClick={generateBracket} style={{ marginBottom: 14 }}>Generate bracket</Button>
      )}

      {/* ── Tabs ── */}
      <div className="tourTabs">
        {DETAIL_TABS.map(({ id, label, Icon }) => (
          <button key={id} className={`tourTab ${tab === id ? "on" : ""}`} onClick={() => setTab(id)}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      {tab === "overview" && (
        <section className="tourTabContent">
          <div className="tourOverviewGrid">
            <div className="roomCard">
              <h3><Crown size={15} /> Prize Breakdown</h3>
              <div className="breakBox">
                <div><span>Total pot ({entryCount} teams × {money(t.entry)})</span><b className="cash">{money(pz.pot)}</b></div>
                <div className="total"><span>1st place{entryCount <= 2 ? " · winner takes all" : entryCount < 8 ? " · 85%" : " · 80%"}</span><b className="cash">{money(pz.first)}</b></div>
                {pz.second > 0 && <div><span>2nd place · 15%</span><b className="cash">{money(pz.second)}</b></div>}
                {pz.third > 0 && <div><span>3rd place · 5%</span><b className="cash">{money(pz.third)}</b></div>}
                <div><span>Platform rake</span><b>{money(pz.houseCut)}</b></div>
              </div>
              <small className="subtle">3rd place pays out at 8+ teams. Winner earns a gold trophy.</small>
            </div>
            <div className="roomCard">
              <h3>Rules</h3>
              <p className="ruleNote inline">{modeRule(t.mode)}</p>
              <p className="ruleNote inline">{seriesRule(t.series)}</p>
              <ul className="roomRules">
                <li>Single-elimination bracket. Lose and you're out.</li>
                <li>{t.platform === "PC + Console Mixed" ? "PC and console players share the lobby." : `${t.platform} only.`}</li>
                <li>Platform rake: {RAKE_CONFIG.tournament * 100}% of the total pot.</li>
                {t.weapon_restriction && <li>Weapon restriction: {t.weapon_restriction}.</li>}
              </ul>
            </div>
          </div>
        </section>
      )}

      {tab === "bracket" && (
        <section className="tourTabContent">
          {rounds.length === 0 ? (
            <EmptyState title="No bracket yet">{t.status === "upcoming" ? "The bracket is generated when the tournament starts." : "No bracket data found."}</EmptyState>
          ) : (
            <Bracket
              rounds={rounds}
              matches={matches}
              isAdmin={isAdmin}
              onClickMatch={(matchId) => onNavigate?.("match", matchId)}
              onStartMatch={startMatch}
            />
          )}
        </section>
      )}

      {tab === "teams" && (
        <section className="tourTabContent">
          {entries.length === 0 ? (
            <EmptyState icon={Users} title="No teams registered yet">Be the first to join.</EmptyState>
          ) : (
            <div className="tourTeamsGrid">
              {entries.map((e, i) => (
                <div className="tourTeamCard" key={e.user_id || i}>
                  <div className="tourTeamRank">#{i + 1}</div>
                  <div className="tourTeamInfo">
                    <b>{e.entrant_name}</b>
                    {e.placed && <span className="tourTeamPlaced">
                      {e.placed === 1 ? "🥇 1st" : e.placed === 2 ? "🥈 2nd" : e.placed === 3 ? "🥉 3rd" : `${e.placed}th`}
                    </span>}
                  </div>
                  <span className={`badge ${e.paid ? "accent" : ""}`}>{e.paid ? "PAID" : "PENDING"}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {joinOpen && <JoinModal t={t} onClose={() => setJoinOpen(false)} onDone={() => { reloadT(); parentReload?.(); }} onLogin={onLogin} />}
    </main>
  );
}
