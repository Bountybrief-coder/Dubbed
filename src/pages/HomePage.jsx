import React from "react";
import { usePageMeta } from "../hooks/usePageMeta";
import { Zap, Trophy, ShieldCheck, DollarSign, ChevronRight, Swords, Gamepad2, Wallet, TrendingUp, Target, Users, Crown } from "lucide-react";
import { Button } from "../components/Button";
import { useAuth } from "../hooks/useAuth.jsx";
import { useToast } from "../hooks/useToast.jsx";
import { useAsync } from "../hooks/useAsync";
import { useVisibilityRefresh } from "../hooks/useVisibilityRefresh";
import { listOpenMatches, joinMatch } from "../services/matchService";
import { supabase } from "../lib/supabase";
import { CURRENT_GAMES, shortForGame, formatLabel, calculatePayout, RAKE_CONFIG } from "../utils/games";
import { money } from "../utils/format";
import { clickable } from "../utils/a11y";
import { LiveActivity } from "../components/LiveActivity";
import { RankStar } from "../components/RankStar";
import { WagrBadge } from "../components/WagrBadge";
import { rankForXp, rankProgress, nextRank } from "../utils/ranks";
import { track } from "../utils/analytics";
import bo7Cover from "../assets/black-ops-7.png";
import wzCover from "../assets/warzone.png";
import mw4Cover from "../assets/mw4.png";
import wwiiCover from "../assets/wwii.png";
import bo1Cover from "../assets/bo1.png";
import bo2Cover from "../assets/bo2.png";
import cashMatchLogo from "../assets/cash-match.png";
import tournamentLogo from "../assets/tournament.png";

const COVERS = { bo7: bo7Cover, warzone: wzCover, bor: bo7Cover, mw4: mw4Cover, wwii: wwiiCover, bo1: bo1Cover, bo2: bo2Cover };

export function HomePage({ onNavigate, onLogin }) {
  usePageMeta("Home", "Cash matches, XP ladders, and tournaments for Call of Duty. 1v1 to 4v4 across every COD title. Play for free or wager real money.");
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();
  const { data: matches, reload } = useAsync(() => listOpenMatches({}), []);
  const { data: stats } = useAsync(() => supabase.rpc("platform_stats"), []);
  const openMatches = matches || [];
  const platformStats = stats || { total_matches: 0, total_winnings: 0, open_lobbies: 0 };

  useVisibilityRefresh(reload, []);

  async function acceptMatch(m) {
    if (!profile) return onLogin();
    const res = await joinMatch(m.id);
    if (res.error) return toast.error(res.error);
    track.matchJoin(m.game, m.entry || 0);
    toast.success("Joined. Match is live.");
    refreshProfile();
    reload();
    onNavigate("match", m.id);
  }

  return (
    <main className="page home2">
      {/* ── HERO ── */}
      <section className="heroPanel">
        <div className="heroGlow" />
        <div className="heroInner">
          {profile ? (
            <>
              <div className="heroTag">WELCOME BACK</div>
              <h1>What's good, {profile.username}.</h1>
              <p>Your arena is live. Jump into a match, climb the ranks, or catch a tournament. You already know the vibes.</p>
            </>
          ) : (
            <>
              <div className="heroTag">THE ARENA IS OPEN</div>
              <h1>Where the real ones&nbsp;play.</h1>
              <p>Cash matches. XP ladders. Tournaments with real brackets. This is your home court. Show up, compete, and prove you're that guy. No gatekeeping, no fees to enter XP matches. Just run it.</p>
            </>
          )}
          <div className="heroActions">
            <Button variant="primary" onClick={() => onNavigate("matchfinder")}><Swords size={16} /> Find a match</Button>
            <Button variant="ghost" onClick={() => onNavigate("tournaments")}><Trophy size={15} /> Tournaments</Button>
          </div>
        </div>
        {(platformStats.total_matches > 0 || platformStats.open_lobbies > 0) && (
          <div className="heroStats">
            <div className="heroStat"><b>{platformStats.total_matches.toLocaleString()}</b><small>MATCHES PLAYED</small></div>
            <div className="heroStat"><b>{money(platformStats.total_winnings)}</b><small>PAID OUT</small></div>
            <div className="heroStat"><b>{platformStats.open_lobbies}</b><small>OPEN NOW</small></div>
          </div>
        )}
      </section>

      {/* ── LIVE ACTIVITY PULSE ── */}
      <LiveActivity onNavigate={onNavigate} />

      {/* ── LOGGED-IN USER CARD ── */}
      {profile && <UserQuickCard profile={profile} onNavigate={onNavigate} />}

      {/* ── GAME CARDS ── */}
      <section className="gameCardsSection">
        <div className="sectionHead">
          <div><div className="eyebrow">SELECT YOUR GAME</div><h2>Current Titles</h2></div>
        </div>
        <div className="gameCardsGrid">
          {CURRENT_GAMES.map((g) => {
            const count = openMatches.filter((m) => m.game === g.name).length;
            return (
              <button className="gameCard" key={g.slug} onClick={() => onNavigate("game", g.slug)}>
                <img className="gameCardCover" src={COVERS[g.slug]} alt="" />
                <div className="gameCardOverlay" />
                <div className="gameCardContent">
                  <span className="gameCardShort">{g.short}</span>
                  <span className="gameCardName">{g.name}</span>
                  <div className="gameCardMeta">
                    <span><Gamepad2 size={12} /> {g.formats.length} formats</span>
                    <span><Swords size={12} /> {g.modes.length} modes</span>
                  </div>
                  {count > 0 && <span className="gameCardLive">{count} open</span>}
                </div>
              </button>
            );
          })}
        </div>

      </section>

      {/* ── FEATURED MATCHES ── */}
      {openMatches.length > 0 && (
        <section className="featuredSection">
          <div className="sectionHead">
            <div><div className="eyebrow">READY TO PLAY</div><h2>Open Lobbies</h2></div>
            <Button variant="ghost" onClick={() => onNavigate("matchfinder")}>View all <ChevronRight size={14} /></Button>
          </div>
          <div className="featuredGrid">
            {openMatches.slice(0, 6).map((m) => (
              <div className="featuredMatch" key={m.id}>
                <div className="fmTop">
                  <span className="fmGame">{shortForGame(m.game)}</span>
                  <span className="fmMode">{m.mode}</span>
                  <span className={`fmEntry ${m.kind}`}>{m.kind === "cash" ? money(m.entry) : "XP"}</span>
                </div>
                <div className="fmDetails">
                  <span>{m.format} · {formatLabel(m.format)}</span>
                  <span>{m.region}</span>
                  <span>{m.platform}</span>
                </div>
                <div className="fmBottom">
                  <Button variant="primary" className="btn-sm" onClick={() => acceptMatch(m)}>Accept</Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── HOW IT WORKS ── */}
      <section className="howSection">
        <div className="sectionHead">
          <div><div className="eyebrow">HOW IT WORKS</div><h2>From lobby to payout</h2></div>
        </div>
        <div className="howGrid">
          <div className="howStep">
            <div className="howNum">1</div>
            <b>Post or Accept</b>
            <p>Pick your game, mode, and team size. Want to play for cash? Set your entry. Want free comp? Run XP matches. Either way, lobbies fill fast.</p>
          </div>
          <div className="howStep">
            <div className="howNum">2</div>
            <b>Play & Report</b>
            <p>Play your match on CDL rules. When it's over, both sides report scores with proof. Clean, fair, no drama.</p>
          </div>
          <div className="howStep">
            <div className="howNum">3</div>
            <b>Collect</b>
            <p>Cash hits your wallet instantly. XP climbs your rank. Earn trophies in tournaments. Cash out to crypto whenever you want.</p>
          </div>
        </div>
      </section>

      {/* ── MONETIZATION / RAKE INFO ── */}
      <section className="rakeSection">
        <div className="sectionHead">
          <div><h2>Know exactly what you pay</h2></div>
        </div>
        <div className="rakeGrid">
          <div className="rakeCard">
            <div className="rakeIcon"><DollarSign size={22} /></div>
            <b>Standard</b>
            <span className="rakeRate">{RAKE_CONFIG.standard * 100}% rake</span>
            <p>Free accounts pay {RAKE_CONFIG.standard * 100}% of the pot. On a $20 pot, that's $1. Winner takes {money(calculatePayout(20, false))}.</p>
          </div>
          <div className="rakeCard wagr">
            <div className="rakeIcon gold"><Trophy size={22} /></div>
            <b>WAGR Member</b>
            <span className="rakeRate gold">{RAKE_CONFIG.wagr * 100}% rake</span>
            <p>WAGR members pay zero rake. Same $20 pot, you keep it all. Winner takes {money(calculatePayout(20, true))}.</p>
            <Button variant="primary" className="btn-sm" onClick={() => onNavigate("shop")}>Get WAGR</Button>
          </div>
        </div>
      </section>

      {/* ── TEAM TYPES ── */}
      <section className="teamTypesSection">
        <div className="sectionHead center">
          <div><div className="eyebrow">BUILD YOUR SQUAD</div><h2>Three ways to compete</h2></div>
        </div>
        <div className="teamTypesGrid">
          <div className="teamTypeCard xp" {...clickable(() => onNavigate("teams"))}>
            <div className="teamTypeIcon"><Zap size={24} /></div>
            <h3>XP Teams</h3>
            <p>Grind ranks for free. No entry fee, no risk. Build your record, climb the leaderboard, and prove yourself before going cash.</p>
            <span className="teamTypeAction">Create XP team <ChevronRight size={14} /></span>
          </div>
          <div className="teamTypeCard cash" {...clickable(() => onNavigate("teams"))}>
            <img className="teamTypeLogo" src={cashMatchLogo} alt="Cash Match" />
            <h3>Cash Teams</h3>
            <p>Play for real money. Set your entry, winner takes the pot. WAGR members play rake-free. Cash out to crypto anytime.</p>
            <span className="teamTypeAction">Create cash team <ChevronRight size={14} /></span>
          </div>
          <div className="teamTypeCard tournament" {...clickable(() => onNavigate("teams"))}>
            <img className="teamTypeLogo" src={tournamentLogo} alt="Tournaments" />
            <h3>Tournament Teams</h3>
            <p>Enter brackets with your squad. Compete in organized events with prize pools, trophies, and bragging rights.</p>
            <span className="teamTypeAction">Create tourney team <ChevronRight size={14} /></span>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="featureGrid">
        {[
          { Icon: Swords, t: "Cash & XP Matches", d: "Play for money or grind XP for free. 1v1 to 4v4, any mode, any rules. You set the terms." },
          { Icon: Trophy, t: "Tournaments", d: "Real brackets, real trophies. SnD, Hardpoint, Kill Race. Compete in organized events with prize pools." },
          { Icon: Zap, t: "Rank System", d: "Every match moves your rank. Climb the ladder from Bronze to Legendary and show up on the leaderboard." },
          { Icon: ShieldCheck, t: "Fair Play", d: "CDL rulesets, map veto, host-region logic, and admin review for cash matches. Level playing field, always." }
        ].map(({ Icon, t, d }) => (
          <div className="featureCard" key={t}>
            <div className="featureIcon"><Icon size={20} /></div>
            <b>{t}</b><p>{d}</p>
          </div>
        ))}
      </section>

      {/* ── CTA ── */}
      {!profile && (
        <section className="ctaStrip">
          <div>
            <h2>Pull up.</h2>
            <p>Create your account and post your first match in under a minute. Free XP matches, no deposit needed.</p>
          </div>
          <Button variant="primary" onClick={onLogin}>Create account <ChevronRight size={16} /></Button>
        </section>
      )}
    </main>
  );
}

function UserQuickCard({ profile: p, onNavigate }) {
  const rank = rankForXp(p.xp);
  const next = nextRank(p.xp);
  const pct = rankProgress(p.xp);
  const remaining = next.xp === rank.xp ? 0 : next.xp - (p.xp || 0);
  const total = (p.wins || 0) + (p.losses || 0);
  const winPct = total ? Math.round((p.wins / total) * 100) : 0;

  return (
    <section className="userQuickCard" style={{ "--rank-glow": rank.glow }}>
      <div className="uqcLeft">
        <div className="uqcAvatarWrap">
          <div className="uqcAvatar" style={{ borderColor: rank.glow }}>
            {p.avatar_url ? <img src={p.avatar_url} alt="" /> : <span>{(p.username || "?").slice(0, 2)}</span>}
          </div>
          <div className="uqcStarWrap"><RankStar rank={rank} size={24} /></div>
        </div>
        <div className="uqcInfo">
          <div className="uqcName">
            <b>{p.username}</b>
            {p.wagr_member && <WagrBadge size={14} />}
          </div>
          <div className="uqcTier" style={{ color: rank.glow }}>{rank.name}</div>
          {next && (
            <div className="uqcProgress">
              <div className="uqcBar">
                <div className="uqcBarFill" style={{ width: `${pct}%`, background: rank.glow }} />
              </div>
              <span className="uqcBarLabel">{remaining.toLocaleString()} XP to {next.name}</span>
            </div>
          )}
        </div>
      </div>
      <div className="uqcStats">
        <button className="uqcStat" onClick={() => onNavigate("wallet")}>
          <Wallet size={14} />
          <span className="uqcStatVal cash">{money(p.balance)}</span>
          <span className="uqcStatLbl">Balance</span>
        </button>
        <div className="uqcStat">
          <TrendingUp size={14} />
          <span className="uqcStatVal">{(p.xp || 0).toLocaleString()}</span>
          <span className="uqcStatLbl">XP</span>
        </div>
        <div className="uqcStat">
          <Target size={14} />
          <span className="uqcStatVal">{p.wins || 0}W-{p.losses || 0}L</span>
          <span className="uqcStatLbl">{total >= 1 ? `${winPct}% Win` : "Record"}</span>
        </div>
        {(p.earnings || 0) > 0 && (
          <div className="uqcStat">
            <DollarSign size={14} />
            <span className="uqcStatVal cash">{money(p.earnings)}</span>
            <span className="uqcStatLbl">Earned</span>
          </div>
        )}
      </div>
      <Button variant="ghost" className="uqcAction" onClick={() => onNavigate("profile", p.username)}>
        My Profile <ChevronRight size={14} />
      </Button>
    </section>
  );
}
