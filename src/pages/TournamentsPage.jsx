import React, { useState } from "react";
import { usePageMeta } from "../hooks/usePageMeta";
import { Trophy, ChevronLeft, Users, Swords, BookOpen, Crown, Clock, CheckCircle, AlertCircle, Info } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useToast } from "../hooks/useToast.jsx";
import { useAsync } from "../hooks/useAsync";
import { listTournaments, getTournament, joinTournament, fundTournamentEntry, pooledPrize, getTournamentBracket, adminGenerateBracket, subscribeToTournament } from "../services/tournamentService";
import { getMyTeams } from "../services/teamService";
import { useVisibilityRefresh } from "../hooks/useVisibilityRefresh";
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
import wwiiImg from "../assets/wwii.png";
import bo1Img from "../assets/bo1.png";
import bo2Img from "../assets/bo2.png";

const GAME_COVERS = {
  "Call of Duty: Black Ops 7": bo7, "Warzone": wz, "Black Ops Royale": bo7,
  "Call of Duty: Modern Warfare 4": mw4Img, "Call of Duty: WWII": wwiiImg,
  "Call of Duty: Black Ops": bo1Img, "Call of Duty: Black Ops II": bo2Img,
};
const cover = (g) => GAME_COVERS[g] || bo7;

const LIST_TABS = [
  { key: "open",     label: "Open Now" },
  { key: "upcoming", label: "Upcoming" },
  { key: "results",  label: "Recent Results" },
];
const MAX_VISIBLE = 8;
const MAX_RESULTS = 5;

function bucketTournaments(all) {
  const now = Date.now();
  const open = [];
  const upcoming = [];
  const results = [];
  for (const t of all) {
    if (t.status === "completed") { results.push(t); continue; }
    const started = new Date(t.starts_at).getTime() <= now;
    if (t.status === "live" || started) open.push(t);
    else upcoming.push(t);
  }
  results.sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at));
  return { open, upcoming, results: results.slice(0, MAX_RESULTS) };
}

export function TournamentsPage({ onLogin, onNavigate }) {
  usePageMeta("Tournaments", "Compete in organized COD tournaments with real brackets, prize pools, and trophies. SnD, Hardpoint, Kill Race events.");
  const { profile, isAdmin } = useAuth();
  const { data, loading, error, reload } = useAsync(() => listTournaments(), []);
  const [joinT, setJoinT] = useState(null);
  const [regionFilter, setRegionFilter] = useState("All");
  const [listTab, setListTab] = useState("open");
  const [detailId, setDetailId] = useState(null);

  const REGION_FILTERS = ["All", "NA", "EU", "NA + EU", "Latin America", "Worldwide"];
  const byRegion = !data ? [] : regionFilter === "All" ? data
    : data.filter((t) => t.region === regionFilter);
  const buckets = bucketTournaments(byRegion);
  const visible = (buckets[listTab] || buckets.open).slice(0, MAX_VISIBLE);
  const totalInBucket = (buckets[listTab] || buckets.open).length;

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

      {/* ── List Tabs ── */}
      <div className="tourListTabs" role="tablist" aria-label="Tournament filter">
        {LIST_TABS.map(({ key, label }) => {
          const count = (buckets[key] || []).length;
          return (
            <button key={key} role="tab" aria-selected={listTab === key}
              className={`tourListTab ${listTab === key ? "on" : ""}`}
              onClick={() => setListTab(key)}>
              {label}{count > 0 && <span className="tourTabCount">{count}</span>}
            </button>
          );
        })}
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
      ) : visible.length === 0 ? (
        <EmptyState icon={Trophy} title={listTab === "results" ? "No recent results" : "No upcoming tournaments"}>
          {listTab === "results" ? "Completed tournaments and final standings show up here." : "No tournaments scheduled right now. Check back soon for SND, Hardpoint, Kill Race, and BR brackets."}
        </EmptyState>
      ) : (
        <>
          <div className="tourList">
            {visible.map((t) => {
              const pz = pooledPrize(t.entry, t.entries_count);
              const full = t.entries_count >= t.capacity;
              const started = new Date(t.starts_at).getTime() <= Date.now();
              const done = t.status === "completed";
              return (
                <div className="tourTile" key={t.id} onClick={() => setDetailId(t.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDetailId(t.id); } }} style={{ cursor: "pointer" }}>
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
          {totalInBucket > MAX_VISIBLE && (
            <p className="subtle" style={{ textAlign: "center", marginTop: 12 }}>
              Showing {MAX_VISIBLE} of {totalInBucket}. Older tournaments are auto-archived.
            </p>
          )}
        </>
      )}

      {joinT && <JoinModal t={joinT} onClose={() => setJoinT(null)} onDone={reload} onLogin={onLogin} />}
    </main>
  );
}

function JoinModal({ t, onClose, onDone, onLogin }) {
  const toast = useToast();
  const { profile, refreshProfile } = useAuth();
  const { data: teams } = useAsync(() => getMyTeams(profile.id), [profile.id]);
  const { data: fullT } = useAsync(() => getTournament(t.id), [t.id]);
  const eligibleTeams = (teams || []).filter((x) => x.game === t.game);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [busy, setBusy] = useState(false);
  const [coverUser, setCoverUser] = useState(null);
  const potNow = pooledPrize(t.entry, t.entries_count, t.capacity);
  const potAfter = pooledPrize(t.entry, t.entries_count + 1, t.capacity);
  const needsTeam = eligibleTeams.length === 0;

  const selectedTeam = eligibleTeams.find((x) => x.id === selectedTeamId) || eligibleTeams[0];
  const entrantName = t.format === "1v1" ? profile.username : (selectedTeam?.name || "");

  const teammates = (selectedTeam?.team_members || []).filter(m => m.user_id !== profile.id);
  const enteredIds = (fullT?.tournament_entries || t.tournament_entries || []).map(e => e.user_id);
  const coverableTeammates = teammates.filter(m => !enteredIds.includes(m.user_id));
  const totalCost = coverUser ? t.entry * 2 : t.entry;

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
        {potAfter.first > 0 && <div className="total"><span>1st{potAfter.pct.first === 1 ? " · winner takes all" : ` · ${Math.round(potAfter.pct.first * 100)}%`}</span><b className="cash">{money(potAfter.first)}</b></div>}
        {potAfter.second > 0 && <div className="total"><span>2nd · {Math.round(potAfter.pct.second * 100)}%</span><b className="cash">{money(potAfter.second)}</b></div>}
        {potAfter.third > 0 && <div className="total"><span>3rd · {Math.round(potAfter.pct.third * 100)}%</span><b className="cash">{money(potAfter.third)}</b></div>}
      </div>
      <small className="subtle">Platform takes 2% of the pot. {Number(t.capacity) < 8 ? "3rd place pays out in 8+ team brackets." : "Top 3 teams paid."}</small>
      <p className="modalNote">Winner also earns a permanent gold trophy with the tournament title on their profile.</p>
      {needsTeam ? (
        <div className="errBanner">You need a {t.game} team to enter. Create one on the Teams page first.</div>
      ) : eligibleTeams.length > 1 && (
        <>
          <label className="fieldLbl">Enter as team</label>
          <select className="field" value={selectedTeam?.id || ""} onChange={(e) => setSelectedTeamId(e.target.value)}>
            {eligibleTeams.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.type}{x.platform ? ` · ${x.platform}` : ""})</option>)}
          </select>
        </>
      )}
      {!needsTeam && eligibleTeams.length === 1 && (
        <p className="modalNote">Entering as <b>{selectedTeam?.name}</b></p>
      )}

      {/* Section 5: Cover a teammate's entry */}
      {t.entry > 0 && coverableTeammates.length > 0 && (
        <div className="cmCoverSection">
          <label className="fieldLbl"><Users size={13} /> Cover a teammate's entry</label>
          <p className="modalNote">Pay their entry fee from your wallet. They still need a linked account and team membership.</p>
          <div className="cmCoverList">
            <button className={`cmCoverOption ${!coverUser ? "on" : ""}`} onClick={() => setCoverUser(null)}>
              Just me
            </button>
            {coverableTeammates.map(m => (
              <button key={m.user_id} className={`cmCoverOption ${coverUser === m.user_id ? "on" : ""}`}
                onClick={() => setCoverUser(coverUser === m.user_id ? null : m.user_id)}>
                Cover {m.profiles?.username || "teammate"}
              </button>
            ))}
          </div>
          {coverUser && (
            <small className="subtle">You'll pay <b>{money(totalCost)}</b> total: {money(t.entry)} for you + {money(t.entry)} for {coverableTeammates.find(m => m.user_id === coverUser)?.profiles?.username}.</small>
          )}
        </div>
      )}

      <Button variant="primary" className="wide" disabled={needsTeam || profile.balance < totalCost} loading={busy} onClick={async () => {
        setBusy(true);
        const res = await joinTournament(t.id, entrantName, selectedTeam?.id);
        if (res.error) { setBusy(false); return toast.error(res.error); }
        if (coverUser) {
          const coveredName = coverableTeammates.find(m => m.user_id === coverUser)?.profiles?.username || "teammate";
          const fundRes = await fundTournamentEntry(t.id, coverUser, t.format === "1v1" ? coveredName : entrantName, selectedTeam?.id);
          if (fundRes.error) { setBusy(false); return toast.error(`Entered, but failed to cover teammate: ${fundRes.error}`); }
          toast.success(`Entered and covered ${coveredName}'s entry.`);
        } else {
          toast.success("Entered. Good luck.");
        }
        setBusy(false);
        refreshProfile(); onDone(); onClose();
      }}>
        {profile.balance < totalCost ? "Insufficient balance" : coverUser ? `Pay ${money(totalCost)} & join (covering teammate)` : `Pay ${money(t.entry)} & join`}
      </Button>
    </Modal>
  );
}

const DETAIL_TABS = [
  { id: "overview", label: "Overview", Icon: BookOpen },
  { id: "bracket", label: "Bracket", Icon: Swords },
  { id: "participants", label: "Participants", Icon: Users },
];

function phaseLabel(t, entryCount, started, done, full) {
  if (done) return { text: "COMPLETED", cls: "s-settled" };
  if (t.status === "cancelled" || t.status === "archived") return { text: "CANCELLED", cls: "s-cancelled" };
  if (started || t.status === "live") return { text: "LIVE", cls: "s-live" };
  if (full) return { text: "REGISTRATION FULL", cls: "s-full" };
  const minutesLeft = (new Date(t.starts_at).getTime() - Date.now()) / 60000;
  if (minutesLeft <= 5) return { text: "STARTING SOON", cls: "s-starting" };
  if (entryCount >= t.capacity * 0.8) return { text: "FILLING FAST", cls: "s-filling" };
  return { text: "REGISTRATION OPEN", cls: "" };
}

function TournamentDetail({ initialT, onBack, onNavigate, onLogin, reload: parentReload }) {
  const toast = useToast();
  const { profile, isAdmin } = useAuth();
  const { data: liveT, reload: reloadT } = useAsync(() => getTournament(initialT.id), [initialT.id]);
  const { data: bracket, reload: reloadBracket } = useAsync(() => getTournamentBracket(initialT.id), [initialT.id]);
  const [tab, setTab] = useState("overview");
  const [busy, setBusy] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const t = liveT || initialT;
  const entryCount = t.tournament_entries?.length || t.entries_count || 0;
  const pz = pooledPrize(t.entry, entryCount, t.capacity);
  const started = new Date(t.starts_at).getTime() <= Date.now();
  const done = t.status === "completed";
  const cancelled = t.status === "cancelled" || t.status === "archived";
  const full = entryCount >= t.capacity;
  const spotsLeft = Math.max(0, t.capacity - entryCount);
  const rounds = bracket?.rounds || [];
  const matches = bracket?.matches || [];
  const entries = t.tournament_entries || [];
  const phase = phaseLabel(t, entryCount, started, done, full);
  const myEntry = profile && entries.find((e) => e.user_id === profile.id);
  const isRegistered = !!myEntry;
  const preStart = !done && !started && !cancelled;
  const isFree = Number(t.entry) === 0;
  const activeTab = (!t.bracket_generated && (tab === "bracket" || tab === "participants")) ? "overview" : tab;

  React.useEffect(() => {
    return subscribeToTournament(initialT.id, () => { reloadBracket(); reloadT(); });
  }, [initialT.id]); // eslint-disable-line

  useVisibilityRefresh(() => { reloadT(); reloadBracket(); }, [initialT.id]);

  async function generateBracket() {
    setBusy(true);
    const res = await adminGenerateBracket(initialT.id);
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success("Bracket generated. Matches auto-started.");
    reloadBracket(); reloadT(); parentReload?.();
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
            <span className={`roomStatus ${phase.cls}`}>{phase.text}</span>
          </div>
        </div>
        <div className="tourHeroStats">
          <div className="tourHeroStat"><small>POT</small><b className="cash">{money(pz.pot)}</b></div>
          <div className="tourHeroStat"><small>ENTRY</small><b>{isFree ? "FREE" : money(t.entry)}</b></div>
          <div className="tourHeroStat"><small>TEAMS</small><b>{entryCount}/{t.capacity}</b></div>
          <div className="tourHeroStat">
            <small>STARTS</small>
            <b>{done ? <em className="doneTag">ENDED</em> : cancelled ? <em className="doneTag">CANCELLED</em> : started ? <em className="liveTag">● LIVE</em> : <Countdown to={new Date(t.starts_at).getTime()} />}</b>
          </div>
        </div>
      </section>

      {/* ── Pre-start info panel ── */}
      {preStart && (
        <section className="tourPreStart" aria-live="polite">
          {/* Countdown banner */}
          <div className="tourCountdownBanner">
            <Clock size={18} />
            <div className="tourCountdownInfo">
              <small>{started ? "TOURNAMENT STARTS" : "REGISTRATION CLOSES & TOURNAMENT STARTS IN"}</small>
              <b><Countdown to={new Date(t.starts_at).getTime()} /></b>
            </div>
            {spotsLeft > 0 && spotsLeft <= 4 && (
              <span className="tourSpotsUrgent"><AlertCircle size={14} /> {spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left</span>
            )}
          </div>

          {/* Registered status */}
          {isRegistered && (
            <div className="tourRegisteredBanner">
              <CheckCircle size={16} /> You're registered. Your spot is locked in.
            </div>
          )}

          {/* Key facts row */}
          <div className="tourFactsRow">
            <div className="tourFact"><small>GAME</small><b>{shortForGame(t.game)}</b></div>
            <div className="tourFact"><small>FORMAT</small><b>{t.format}</b></div>
            <div className="tourFact"><small>MODE</small><b>{t.mode}</b></div>
            <div className="tourFact"><small>SERIES</small><b>{t.series}</b></div>
            <div className="tourFact"><small>REGION</small><b>{t.region}</b></div>
            <div className="tourFact"><small>PLATFORM</small><b>{t.platform}</b></div>
            <div className="tourFact"><small>ENTRY</small><b className={isFree ? "cash" : ""}>{isFree ? "FREE" : money(t.entry)}</b></div>
            <div className="tourFact"><small>SPOTS LEFT</small><b className={spotsLeft <= 4 ? "urgentNum" : ""}>{full ? "FULL" : spotsLeft}</b></div>
          </div>

          {/* Prize split preview */}
          <div className="tourPrizeSplit">
            <h4><Crown size={14} /> Prize Split</h4>
            <div className="tourPrizeCols">
              <div className="tourPrizeCol first">
                <small>1ST PLACE</small>
                <b className="cash">{money(pz.first)}</b>
                <span>{pz.pct.first === 1 ? "Winner takes all" : `${Math.round(pz.pct.first * 100)}% of pot`}</span>
              </div>
              {pz.pct.second > 0 && (
                <div className="tourPrizeCol second">
                  <small>2ND PLACE</small>
                  <b className="cash">{money(pz.second)}</b>
                  <span>{Math.round(pz.pct.second * 100)}% of pot</span>
                </div>
              )}
              {pz.pct.third > 0 && (
                <div className="tourPrizeCol third">
                  <small>3RD PLACE</small>
                  <b className="cash">{money(pz.third)}</b>
                  <span>{Math.round(pz.pct.third * 100)}% of pot</span>
                </div>
              )}
              <div className="tourPrizeCol rake">
                <small>PLATFORM</small>
                <b>{money(pz.houseCut)}</b>
                <span>2% rake</span>
              </div>
            </div>
            <small className="subtle">
              {pz.pct.third > 0
                ? "Top 3 paid. Prize pool grows as teams register."
                : "Top 2 paid — 3rd place unlocks in 8+ team brackets. Prize pool grows as teams register."}
            </small>
          </div>

          {/* Join CTA */}
          {!isRegistered && !full && (
            <div className="tourJoinCta">
              <Button variant="primary" size="lg" onClick={() => profile ? setJoinOpen(true) : onLogin()}>
                {isFree ? "Join Tournament · Free Entry" : `Join Tournament · ${money(t.entry)}`}
              </Button>
              {full ? null : spotsLeft <= 4 ? (
                <small className="subtle">{spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} remaining</small>
              ) : null}
            </div>
          )}
          {!isRegistered && full && (
            <div className="tourFullBanner">
              <AlertCircle size={16} /> Registration is full ({t.capacity}/{t.capacity}). Check back for the next one.
            </div>
          )}

          {/* What happens next */}
          <div className="tourNextInfo">
            <Info size={15} />
            <p>When the countdown hits zero, the bracket auto-generates and your first match starts automatically. Single-elimination. Lose and you're out.{isFree ? " This is a free-entry WAGR tournament." : ""}</p>
          </div>
        </section>
      )}

      {/* Cancelled/archived state */}
      {cancelled && (
        <div className="tourCancelledBanner">
          <AlertCircle size={16} /> This tournament was cancelled. Entry fees have been refunded.
        </div>
      )}

      {/* Winner banner */}
      {done && t.winner_name && (
        <div className="tourneyWinnerBanner">
          <Trophy size={18} /> <b>{t.winner_name}</b> wins!
          {t.second_name && <span> · 2nd: {t.second_name}</span>}
          {t.third_name && <span> · 3rd: {t.third_name}</span>}
        </div>
      )}

      {/* Admin bracket gen */}
      {isAdmin && t.status === "upcoming" && !t.bracket_generated && (
        <Button variant="primary" loading={busy} onClick={generateBracket} style={{ marginBottom: 14 }}>Generate bracket</Button>
      )}

      {/* ── Tabs ── */}
      <div className="tourTabs">
        {DETAIL_TABS.filter(({ id }) => {
          if (id === "bracket" || id === "participants") return !!t.bracket_generated;
          return true;
        }).map(({ id, label, Icon }) => (
          <button key={id} className={`tourTab ${activeTab === id ? "on" : ""}`} onClick={() => setTab(id)}>
            <Icon size={15} /> {label}
            {id === "participants" && <span className="tourTabCount">{entryCount}</span>}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      {activeTab === "overview" && (
        <section className="tourTabContent">
          <div className="tourOverviewGrid">
            <div className="roomCard">
              <h3><Crown size={15} /> Prize Breakdown</h3>
              <div className="breakBox">
                <div><span>Total pot ({entryCount} teams × {isFree ? "Free" : money(t.entry)})</span><b className="cash">{money(pz.pot)}</b></div>
                <div className="total"><span>1st place{pz.pct.first === 1 ? " · winner takes all" : ` · ${Math.round(pz.pct.first * 100)}%`}</span><b className="cash">{money(pz.first)}</b></div>
                {pz.pct.second > 0 && <div><span>2nd place · {Math.round(pz.pct.second * 100)}%</span><b className="cash">{money(pz.second)}</b></div>}
                {pz.pct.third > 0 && <div><span>3rd place · {Math.round(pz.pct.third * 100)}%</span><b className="cash">{money(pz.third)}</b></div>}
                <div><span>Platform rake</span><b>{money(pz.houseCut)}</b></div>
              </div>
              <small className="subtle">{pz.pct.third === 0 ? "3rd place pays out in 8+ team brackets. " : ""}Winner earns a {isFree ? "WAGR" : "gold"} trophy.</small>
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
                <li>10-minute no-show window per match. Report via match chat.</li>
              </ul>
            </div>
          </div>
        </section>
      )}

      {activeTab === "bracket" && (
        <section className="tourTabContent">
          {rounds.length === 0 ? (
            <EmptyState title={preStart ? "Bracket generates at start" : "No bracket yet"}>
              {preStart
                ? `${entryCount} team${entryCount !== 1 ? "s" : ""} registered. The bracket locks when the countdown hits zero.`
                : "No bracket data found."}
            </EmptyState>
          ) : (
            <Bracket
              rounds={rounds}
              matches={matches}
              onClickMatch={(matchId) => onNavigate?.("match", matchId)}
            />
          )}
        </section>
      )}

      {activeTab === "participants" && (
        <section className="tourTabContent" aria-live="polite">
          <div className="tourParticipantHeader">
            <b>{entryCount} / {t.capacity} registered</b>
            {preStart && spotsLeft > 0 && <span className="subtle">{spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} remaining</span>}
          </div>
          {entries.length === 0 ? (
            <EmptyState icon={Users} title="No teams registered yet">Be the first to join.</EmptyState>
          ) : (
            <div className="tourTeamsGrid">
              {entries.map((e, i) => {
                const isMe = profile && e.user_id === profile.id;
                return (
                  <div className={`tourTeamCard ${isMe ? "isMe" : ""}`} key={e.user_id || i}>
                    <div className="tourTeamRank">#{i + 1}</div>
                    <div className="tourTeamInfo">
                      <b>{e.entrant_name}{isMe && " (you)"}</b>
                      {e.placed && <span className="tourTeamPlaced">
                        {e.placed === 1 ? "1st" : e.placed === 2 ? "2nd" : e.placed === 3 ? "3rd" : `${e.placed}th`}
                      </span>}
                    </div>
                    <span className={`badge ${e.paid ? "accent" : ""}`}>{e.paid ? "PAID" : "PENDING"}</span>
                  </div>
                );
              })}
              {/* Empty slots visualization */}
              {preStart && spotsLeft > 0 && spotsLeft <= 8 && Array.from({ length: spotsLeft }).map((_, i) => (
                <div className="tourTeamCard empty" key={`empty-${i}`}>
                  <div className="tourTeamRank" style={{ opacity: 0.3 }}>#{entryCount + i + 1}</div>
                  <div className="tourTeamInfo"><b style={{ opacity: 0.3 }}>Open slot</b></div>
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
