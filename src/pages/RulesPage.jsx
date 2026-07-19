import React from "react";
import { usePageMeta } from "../hooks/usePageMeta";
import { THROWBACK_RULESETS, THROWBACK_SHARED_RULES } from "../utils/games";

export function RulesPage() {
  usePageMeta("Rules", "Official Dubbed match rules, CDL rulesets, map pools, and dispute resolution policies for all Call of Duty titles.");
  return (
    <main className="page">
      <style>{`
        .rulesAccordion{margin-top:24px}
        .rulesAccordion details{background:var(--panel2);border:1px solid var(--line);border-radius:10px;margin-bottom:10px;overflow:hidden}
        .rulesAccordion summary{padding:16px 20px;cursor:pointer;font-weight:700;font-size:16px;color:var(--text);list-style:none;display:flex;align-items:center;gap:10px;user-select:none}
        .rulesAccordion summary::-webkit-details-marker{display:none}
        .rulesAccordion summary::before{content:"▸";font-size:14px;color:var(--muted);transition:transform .15s}
        .rulesAccordion details[open] summary::before{transform:rotate(90deg)}
        .rulesAccordion summary .badge{font-size:11px;padding:2px 8px;border-radius:6px;background:var(--panel3);color:var(--muted);font-weight:600;margin-left:auto}
        .rulesAccordion .ruleBody{padding:0 20px 20px;color:var(--muted);line-height:1.7;font-size:14px}
        .rulesAccordion .ruleBody h3{color:var(--text);font-size:14px;margin:18px 0 6px;text-transform:uppercase;letter-spacing:.5px}
        .rulesAccordion .ruleBody h3:first-child{margin-top:0}
        .rulesAccordion .ruleBody p{margin:4px 0}
        .rulesAccordion .ruleBody ul{margin:4px 0 12px 18px;padding:0}
        .rulesAccordion .ruleBody li{margin:3px 0}
        .rulesAccordion .ruleBody .restrictedGrid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        @media(max-width:700px){.rulesAccordion .ruleBody .restrictedGrid{grid-template-columns:1fr}}
        .rulesAccordion .ruleBody .restrictedBox{background:var(--panel3);border-radius:8px;padding:12px 14px}
        .rulesAccordion .ruleBody .restrictedBox b{color:var(--text);display:block;margin-bottom:4px}
        .rulesAccordion .ruleBody .tag-allowed{color:var(--green);font-weight:600}
        .rulesAccordion .ruleBody .tag-banned{color:#ff4d5e;font-weight:600}
        .rulesAccordion .ruleBody .warn{color:#ff9e3d;font-weight:600}
        .rulesAccordion .ruleBody .settingTable{width:100%;border-collapse:collapse;margin:8px 0 16px;font-size:13px}
        .rulesAccordion .ruleBody .settingTable th{text-align:left;color:var(--text);padding:6px 10px;border-bottom:1px solid var(--line)}
        .rulesAccordion .ruleBody .settingTable td{padding:6px 10px;border-bottom:1px solid var(--line)}
      `}</style>

      <div className="pageHead">
        <div className="eyebrow">COMPETITIVE RULES</div>
        <h1>Rules</h1>
        <p className="sub">You agree to these the moment you accept a match. Read them.</p>
      </div>

      {/* ── GENERAL RULES (always visible) ── */}
      <section className="panel2 rulesSection">
        <h2>General Rules</h2>
        <p>These apply to every game and every match on Dubbed. Game-specific rules are listed below.</p>
      </section>

      <div className="rulesAccordion">
        <GeneralRules />
        <WarzoneRules />
        <BO7Rules />
        <WWIIRules />
        <BO1Rules />
        <BO2Rules />
      </div>
    </main>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */

function GeneralRules() {
  return (
    <details open>
      <summary>General Platform Rules <span className="badge">All Games</span></summary>
      <div className="ruleBody">
        <h3>1. No-Show</h3>
        <p>You have 10 minutes from the scheduled start to join. If your opponent hasn't joined within 10 minutes, screenshot the empty lobby with the match timer visible, then click "No Show" in the match room. An admin will contact your opponent and may grant a brief extension at their discretion. Failure to show results in a map or match forfeit.</p>
        <p>For multi-map series: if your opponent forfeits Map 1, you must still attempt Map 2 or provide proof of waiting the full 10-minute window for that map as well.</p>

        <h3>2. Host Selection</h3>
        <p><b>Best of 1:</b> The match creator hosts.</p>
        <p><b>Best of 3:</b> Creator hosts Map 1. Opponent hosts Map 2. Map 3 host goes to whoever had the most combined kills across Maps 1 and 2. If tied, the creator hosts.</p>
        <p><b>Best of 5:</b> Creator hosts Maps 1, 3, and 5. Opponent hosts Maps 2 and 4.</p>

        <h3>3. Gamertag / Activision ID</h3>
        <p>You must play on the exact Activision ID or gamertag linked to your Dubbed account, including the "#1234" suffix if present. Playing on the wrong account is an automatic forfeit. If a match is played to completion on incorrect IDs, the result stands.</p>

        <h3>4. No Substitutions</h3>
        <p>Once a match is accepted, the roster is locked. No swapping players, no ringers, no mid-series subs. If a teammate can't play, request a cancel through the match room.</p>

        <h3>5. Recording & Proof</h3>
        <p>Recording your matches is strongly encouraged. All proof must be in video format — screenshots alone are weak evidence. Clip kills, clip the scoreboard, clip anything you might need later. Video beats screenshots every time. If you didn't record it, it didn't happen.</p>
        <p>Conversations outside of Dubbed (Twitter DMs, Xbox/PSN messages, Discord) are not considered valid proof.</p>

        <h3>6. PC Streaming Requirement</h3>
        <p>PC players must stream every match with VOD/past broadcasts enabled. The VOD must stay publicly accessible for at least 24 hours. Accepted platforms: Twitch, YouTube, Kick, Facebook. TikTok is not accepted (no stored VODs).</p>
        <p>If a PC player cannot produce a VOD when a result is reviewed, the ruling goes against them. No stream, no defense.</p>

        <h3>7. Cheating & Hacking</h3>
        <p>Dubbed has a zero-tolerance policy. Using any third-party software or device to cheat results in a permanent ban. Admins may request additional proof from any player suspected of cheating — failure to provide it may result in a ban or match forfeit.</p>

        <h3>8. Glitches & Exploits</h3>
        <p>Using map glitches, out-of-map spots, wall breaches, or any exploit that gives an unfair advantage is prohibited. First offense: forfeit of the match. Second offense: account ban. If you're unsure whether something is a glitch, don't do it.</p>

        <h3>9. Contesting Results</h3>
        <p>Hit "Contest Result" in the match room within 30 minutes of the match ending. Upload video proof (VOD link, YouTube, or direct upload). An admin reviews every contest within 24 hours. Decisions are final unless new video evidence is submitted within 12 hours of the ruling.</p>
        <p className="warn">Fake or doctored proof results in a permanent ban and forfeiture of all funds.</p>

        <h3>10. Conduct</h3>
        <p>The following are prohibited and carry escalating penalties (warning → 24h ban → 7-day ban → permanent):</p>
        <ul>
          <li>DDoS or booting</li>
          <li>Queue sniping in Battle Royale</li>
          <li>Smurfing or alt accounts to dodge bans / manipulate rank</li>
          <li>Harassment or threats of any kind</li>
          <li>Intentional disconnecting to avoid a loss</li>
          <li>Collusion or match-fixing</li>
        </ul>
        <p>Dubbed reserves the right to ban any account at any time for behavior that undermines fair competition.</p>
      </div>
    </details>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */

function WarzoneRules() {
  return (
    <details>
      <summary>Warzone / Black Ops Royale <span className="badge">Battle Royale</span></summary>
      <div className="ruleBody">
        <h3>Game Modes & Playlists</h3>
        <ul>
          <li>1v1 matches are played in <b>Duos</b></li>
          <li>2v2 matches are played in <b>Quads</b></li>
          <li>1v1 Resurgence is played in Resurgence Duos. If Duos isn't available, use the next lowest team size with <b>Fill OFF</b></li>
          <li>2v2 Resurgence is played in Resurgence Quads</li>
        </ul>

        <h3>How to Win</h3>
        <ul>
          <li><b>Best of 1:</b> Win the map to win the match</li>
          <li><b>Best of 3:</b> Win two maps to win the match</li>
          <li><b>Kill Race:</b> The team with the most kills at the end of each map wins that map. Only <b>Operator Kills</b> count</li>
          <li><b>Survival:</b> The team that survives the longest wins each map</li>
        </ul>

        <h3>Player Count</h3>
        <p>All Battle Royale games must have a minimum of <b>80 players</b> to start (does not apply to Resurgence). If the lobby won't fill, back out and re-search.</p>

        <h3>Ties</h3>
        <ul>
          <li>Kill Race tie: replay the map until a winner is determined</li>
          <li>Survival tie: team with more kills wins the map</li>
        </ul>

        <h3>Challenge Options</h3>
        <p>In a <b>"Buy Backs Not Allowed"</b> match, you may not purchase a teammate's redeploy. Doing so forfeits the map.</p>
        <p>If a PC player accepts a match marked "PC Players Not Allowed," the match must be cancelled immediately. If the match is played out, the result stands.</p>

        <h3>Hosting (Map 3)</h3>
        <p>Map 3 host goes to whichever team had the most combined kills over Maps 1 and 2.</p>

        <h3>Restricted Items</h3>
        <ul>
          <li className="tag-banned">Gulag Kit — Banned</li>
          <li className="tag-banned">Redeploy Kit — Banned</li>
          <li className="tag-banned">Reinforcement Flare — Banned</li>
        </ul>
        <p>If you pick up a restricted item by accident, you must lose your gulag and/or down yourself on respawn. The free redeploy at match start <b>is allowed</b> — only additional picked-up tokens are banned.</p>

        <h3>Redeploy Towers (Black Ops Royale)</h3>
        <ul>
          <li>Reviving teammates via redeploy tower is <b className="tag-allowed">allowed</b></li>
          <li>If both players on your team are dead and your opponent uses a redeploy tower, you must immediately down yourself after respawning. Attempting kills after your team is fully dead risks a forfeit</li>
        </ul>

        <h3>Helicopters</h3>
        <p>Helicopters are <b className="tag-allowed">allowed by default</b> unless the match is marked "Helicopters Not Allowed." Using one in a heli-banned match forfeits the map regardless of outcome.</p>

        <h3>Kills After Death</h3>
        <p>30 seconds after the last player on a team is fully eliminated (not just knocked), that score is final. Pulling your opponent out of the game within 30 seconds of them knocking someone risks a forfeit.</p>

        <h3>Resets / Replays</h3>
        <p>Players who did not use their gulag/respawn token in the original match get <b>+1 kill</b> added to their score in the replay.</p>

        <h3>Jailbreak Events</h3>
        <p>Once all members of your team are fully dead (no gulag remaining), that is your final score. If a jailbreak respawns you, immediately down yourself by hitting the ground — no parachuting, no kills. Getting kills after a jailbreak when your team was eliminated risks a forfeit.</p>

        <h3>Go Again Events</h3>
        <p>You may not use more than one gulag per match. If a Go Again event fires, you must intentionally die. Any kills earned must be followed by immediately downing yourself — the kill does not count.</p>

        <h3>Sabotage / Griefing</h3>
        <p>Sabotage is any action that intentionally harms your opponent's gameplay. A forfeit can only be issued if it directly affects the outcome. Examples:</p>
        <ul>
          <li>Excessive pinging to block opponent's audio</li>
          <li>Shooting near your opponent's position to reveal them</li>
          <li>Calling out opponent locations in proximity chat</li>
          <li>Destroying an opponent's zipline/balloon while they're on it</li>
          <li>When riding in your opponent's vehicle, you accept any actions by the driver</li>
        </ul>
        <p>Stay away from your opponents to avoid issues.</p>

        <h3>Killing AFKs</h3>
        <p>Waiting until the end of the plane path to hunt AFK players is not allowed. Provide proof if you suspect this — admin discretion applies.</p>

        <h3>Taking Knocks Hostage</h3>
        <p>Holding your opponent's downed players hostage to steal kills is not allowed.</p>

        <h3>Loadout Glitches</h3>
        <p>Dropping weapons in the pre-game lobby and landing on them at match start is <b className="tag-banned">banned in all Warzone matches</b>. Landing on random weapons from other players is fine.</p>

        <h3>Disconnections</h3>
        <p><b>2v2:</b> If your teammate disconnects and you can still mathematically win, you must immediately leave the game. Replays require valid disconnect proof.</p>
        <p>If your team is ahead in kills when a server-side disconnect happens, the match replays from the kill count at the time of disconnect. Take a screenshot of the scoreboard immediately.</p>
        <p><b>Dev Error / Scan and Repair:</b> Game-caused errors warrant a replay from the kill count at disconnect. Your remaining teammate must leave immediately.</p>
        <p>Intentionally disconnecting to force a replay results in a forfeit and platform ban.</p>

        <h3>Lag / Packet Loss</h3>
        <p>You have until the plane finishes its path to leave the lobby due to server lag. Provide proof to an admin — you cannot leave mid-game without cause.</p>

        <h3>Death to Hackers</h3>
        <p>If you suspect a player is hacking, play the match to completion and provide proof afterward. Leaving early because you suspect hacking can result in a forfeit if the player isn't found to be cheating.</p>

        <h3>Leaving Early</h3>
        <p>Leaving while dead for no reason, or to hinder your opponent, may result in a replay or forfeit at admin discretion.</p>
      </div>
    </details>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */

function BO7Rules() {
  return (
    <details>
      <summary>Black Ops 7 <span className="badge">Multiplayer</span></summary>
      <div className="ruleBody">
        <h3>Effective Rule Changes</h3>
        <ul>
          <li><b>June 1, 2026:</b> ALL Pistol Attachments banned</li>
          <li><b>June 1, 2026:</b> MPC banned attachments: All Muzzles, 14.5" VAS Ashe Barrel, 10.4" Hydra Barrel, Flowguard Foregrip, Racer-T Fast Mag II, Quickshift Grip</li>
          <li><b>Apr 13, 2025:</b> MPC-25 unbanned</li>
          <li><b>Apr 13, 2025:</b> VAS Convergence Foregrip banned</li>
        </ul>

        <h3>Maps</h3>
        <div className="restrictedGrid">
          <div className="restrictedBox">
            <b>Search & Destroy</b>
            <p>Den, Gridlock, Raid, Scar, Standoff, Hacienda</p>
          </div>
          <div className="restrictedBox">
            <b>CDL Search & Destroy</b>
            <p>Den, Fringe, Gridlock, Hacienda, Raid, Sake</p>
          </div>
          <div className="restrictedBox">
            <b>Hardpoint</b>
            <p>Colossus, Den, Gridlock, Sake, Scar</p>
          </div>
          <div className="restrictedBox">
            <b>Overload</b>
            <p>Den, Exposure, Scar</p>
          </div>
          <div className="restrictedBox">
            <b>Gunfight</b>
            <p>Abyss, Cortex, Flagship, Nexus, Odysseus, Onsen, Paranoia, Torque, Yakei</p>
          </div>
        </div>

        <h3>Variant Mode</h3>
        <p>The "Variant" mode is always a Best of 3 or Best of 5 played in this order:</p>
        <ul>
          <li><b>BO3:</b> Hardpoint → Search & Destroy → Overload</li>
          <li><b>BO5:</b> Hardpoint → S&D → Overload → Hardpoint → S&D</li>
        </ul>
        <p>The non-hosting team picks the map for each mode. The team that wins the S&D hosts Map 3 (Overload).</p>

        <h3>Settings — Search & Destroy (CDL)</h3>
        <p>Use the CDL Search and Destroy game mode. Unlock the rules and make these changes. <b>Rehost/reset rules after each map</b> — keeping host may cause rules to reset.</p>
        <table className="settingTable">
          <thead><tr><th>Setting</th><th>Value</th></tr></thead>
          <tbody>
            <tr><td>Killcams</td><td>On</td></tr>
            <tr><td>Team Assignment</td><td>On</td></tr>
            <tr><td>Scorestreaks</td><td className="tag-banned">Off</td></tr>
            <tr><td>Equipment Delay</td><td>5 Seconds</td></tr>
            <tr><td>Automatic Doors</td><td>On</td></tr>
          </tbody>
        </table>

        <h3>Settings — Hardpoint (CDL)</h3>
        <p>Use the CDL game mode. Unlock rules and adjust:</p>
        <table className="settingTable">
          <thead><tr><th>Setting</th><th>Value</th></tr></thead>
          <tbody>
            <tr><td>Allow Callout Pings</td><td className="tag-banned">Off</td></tr>
            <tr><td>Killcams</td><td>On</td></tr>
            <tr><td>Respawn Delay</td><td>3 Seconds</td></tr>
            <tr><td>Team Assignment</td><td>On</td></tr>
            <tr><td>Scorestreaks</td><td className="tag-banned">Off</td></tr>
            <tr><td>Automatic Doors</td><td className="tag-banned">Off</td></tr>
          </tbody>
        </table>

        <h3>Settings — Overload</h3>
        <p>Use the DEFAULT Overload mode with these changes:</p>
        <table className="settingTable">
          <thead><tr><th>Setting</th><th>Value</th></tr></thead>
          <tbody>
            <tr><td>Input Swap Allowed</td><td className="tag-banned">Off</td></tr>
            <tr><td>Allow Callout Pings</td><td className="tag-banned">Off</td></tr>
            <tr><td>Carrier Personal Radar</td><td className="tag-banned">Off</td></tr>
            <tr><td>Sudden Death H.A.R.P</td><td className="tag-banned">Off</td></tr>
            <tr><td>Weapon Mounting</td><td className="tag-banned">Off</td></tr>
            <tr><td>Respawn Delay</td><td>3.5 Seconds</td></tr>
            <tr><td>Suicide Respawn Delay</td><td>1 Second</td></tr>
            <tr><td>Team Assignment</td><td>On</td></tr>
            <tr><td>Friendly Fire</td><td>On</td></tr>
            <tr><td>Scorestreaks</td><td className="tag-banned">Off</td></tr>
            <tr><td>Automatic Doors</td><td className="tag-banned">Off</td></tr>
            <tr><td>Scorestreak Delay</td><td>10 Seconds</td></tr>
            <tr><td>Equipment Protection</td><td>0 Seconds</td></tr>
            <tr><td>Battle Chatter</td><td className="tag-banned">Off</td></tr>
            <tr><td>Dynamic Map Elements</td><td className="tag-banned">Off</td></tr>
          </tbody>
        </table>
        <p className="warn">Check that scorestreaks are disabled at the start of round 1. Leave immediately if they're on. No forfeits will be issued for scorestreaks being enabled — it's your responsibility to check.</p>

        <h3>Gunfight</h3>
        <p>No settings changes needed. No restricted items in Gunfight.</p>

        <h3>Hosting</h3>
        <ul>
          <li>Host for each map is shown on the match details page</li>
          <li>Non-hosting team picks which side they start on</li>
          <li>Last map host: team with the most combined rounds/points from prior maps. If tied, Map 1 host gets it</li>
          <li>Variant last map: the team that won the S&D hosts</li>
        </ul>

        <h3>Restricted Items</h3>
        <p>Using 3rd-person gestures or emotes to exploit lines of sight is strictly prohibited and results in a map forfeit.</p>

        <div className="restrictedGrid">
          <div className="restrictedBox">
            <b>Allowed Primaries</b>
            <p className="tag-allowed">M15, Dravec 45, MPC-25</p>
            <p className="tag-banned">Tracer Rounds — Banned</p>
          </div>
          <div className="restrictedBox">
            <b>Allowed Secondary</b>
            <p className="tag-allowed">Jager 45</p>
            <p className="tag-banned">ALL Pistol Attachments — Banned</p>
          </div>
        </div>

        <p style={{ marginTop: 12 }}><b>Attachments:</b></p>
        <ul>
          <li className="tag-banned">Iron Sights on Assault Rifles — Banned (must equip an optic)</li>
          <li className="tag-banned">All magnification optics — Banned</li>
          <li className="tag-banned">All launcher underbarrels, lasers, silencers, headshot multiplier barrels — Banned</li>
          <li className="tag-banned">All prestige attachments — Banned</li>
          <li className="tag-banned">Rapid Fire, FMJ, Akimbo — Banned</li>
          <li className="tag-banned">LTI Target Finder v.2, Millimeter Scanner, 9.6" MFS Vital Ace — Banned</li>
          <li className="tag-banned">FANG HoverPoint ELO Optic, VAS Convergence Foregrip — Banned</li>
          <li className="tag-banned">MPC only: All Muzzles, 14.5" VAS Ashe Barrel, 10.4" Hydra Barrel, Flowguard Foregrip, Racer-T Fast Mag II, Quickshift Grip</li>
        </ul>
        <p><small>The MOBILE Quickdraw Grip is NOT the same as the Quickdraw Grip — if it says "MOBILE" before it, it's allowed.</small></p>

        <p><b>Melee:</b> <span className="tag-allowed">Knife — Allowed</span>. <span className="tag-banned">Ballistic Knife, Flatline MK.II — Banned</span>. Knife variant skins are fine.</p>

        <div className="restrictedGrid" style={{ marginTop: 12 }}>
          <div className="restrictedBox">
            <b>Allowed Lethals</b>
            <p className="tag-allowed">Frag, Semtex</p>
          </div>
          <div className="restrictedBox">
            <b>Allowed Tacticals</b>
            <p className="tag-allowed">Stun Grenade</p>
          </div>
          <div className="restrictedBox">
            <b>Allowed Field Upgrades</b>
            <p className="tag-allowed">Trophy System</p>
          </div>
          <div className="restrictedBox">
            <b>Allowed Wildcard</b>
            <p className="tag-allowed">Perk Greed</p>
          </div>
        </div>

        <p style={{ marginTop: 12 }}><b>Perks:</b></p>
        <ul>
          <li><b>Perk 1:</b> <span className="tag-allowed">Lightweight, Ninja, Flak Jacket</span></li>
          <li><b>Perk 2:</b> <span className="tag-allowed">Tech Mask, Fast Hands</span></li>
          <li><b>Perk 3:</b> <span className="tag-allowed">Dexterity</span></li>
        </ul>
        <p className="warn">Flak Jacket and Tech Mask CANNOT be equipped at the same time. One per class only.</p>

        <p><b>Scorestreaks:</b> <span className="tag-banned">ALL scorestreaks are banned</span></p>
        <p><b>Specialty Perks:</b> <span className="tag-banned">All CORE Combat Specialty Perks are banned</span>. <span className="tag-allowed">Hybrid Combat Specialty Perks are allowed</span></p>
        <p><b>Operators:</b> <span className="tag-banned">All Blackcell Operators, Reaper EWR-3, T.E.D.D — Banned</span></p>

        <p style={{ marginTop: 8 }}><small>If a player's killcam shows "4 attachments + <b>+2</b>", it's a known visual glitch — not Gunfighter. Do not dispute for this.</small></p>

        <h3>Usage of Restricted Items</h3>
        <p>Using a restricted item results in a <b>map forfeit</b> regardless of whether it affected the outcome. If you spot your opponent using a restricted item, play out the match for proof, then dispute. Leaving early without proof may count as a no-show forfeit.</p>

        <h3>Glitches (BO7 Specific)</h3>
        <ul>
          <li className="tag-banned">Planting/defusing through walls or structures</li>
          <li className="tag-banned">All glitch spots (wall-bouncing, diving out of bounds)</li>
          <li className="tag-banned">Hiding inside objects making your model invisible (bushes/tall grass don't count)</li>
          <li className="tag-banned">Slide/sprint defusing the bomb — if the "Hold Square to defuse" text isn't on screen, it's a forfeit</li>
          <li className="tag-banned">Seeing names/diamonds through walls</li>
          <li className="tag-banned">Snaking — going from prone to sprint 3+ times rapidly</li>
          <li className="tag-banned">Stair glitching</li>
          <li className="tag-banned">Laying beside a ledge/curb to see over it while being invisible to others</li>
        </ul>

        <h3>Wrong Rules</h3>
        <p>If the host sets wrong rules, the hosting team forfeits 1 round (or the map in a dispute). If a match is played to completion with wrong rules, the result stands unless the wrong rule only affected the final round. Always check settings before starting.</p>

        <h3>Disconnections</h3>
        <p><b>Search & Destroy:</b> If the host crashes the dedicated server after 15 seconds OR after first blood, the hosting team forfeits the round.</p>
        <p><b>Hardpoint:</b> Complete the game. The disconnected player may rejoin.</p>
        <p>Server lag only warrants a cancel if <b>everyone</b> in the lobby was affected. Proof from multiple perspectives is required.</p>

        <h3>Quick Play Mode</h3>
        <p>The hosting team invites opponents and starts the match on the correct mode. The team with the most combined <b>eliminations</b> at the end wins.</p>
        <ul>
          <li>If you join a match already in progress, leave and restart immediately (both teams' responsibility)</li>
          <li>Once in a lobby, do not back out. Repeatedly backing out (3-strike rule) may result in a forfeit</li>
          <li>If random players leave the public lobby, continue playing</li>
          <li>If all players leave, replay — but kills, damage, and deaths carry over</li>
        </ul>

        <h3>Allowed Scorestreaks (Quick Play Only)</h3>
        <ul>
          <li className="tag-allowed">Scout Pulse</li>
          <li className="tag-allowed">UAV</li>
          <li className="tag-allowed">Counter UAV</li>
          <li className="tag-allowed">HARP</li>
        </ul>

        <h3>Death to Hackers</h3>
        <p>If you suspect hacking, play the match out and submit proof afterward. Leaving early because you suspect hacking can result in a forfeit if the player isn't found to be cheating.</p>
      </div>
    </details>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */

function WWIIRules() {
  return (
    <details>
      <summary>Call of Duty: WWII <span className="badge">PSN / Xbox Only</span></summary>
      <div className="ruleBody">
        <p className="warn">WWII matches are restricted to PlayStation and Xbox. PC is not supported for this title.</p>

        <h3>Game Modes</h3>
        <ul>
          <li><b>Search & Destroy</b> — Best of 1, Best of 3, or Best of 5</li>
          <li><b>Hardpoint</b> — Best of 1, Best of 3, or Best of 5</li>
          <li><b>Variant (HP → S&D → HP):</b> Non-hosting team picks the map each round. Map 3 host goes to the team that won the S&D</li>
        </ul>

        <h3>Formats</h3>
        <ul>
          <li>1v1, 2v2, 3v3, 4v4</li>
        </ul>

        <h3>Maps</h3>
        <div className="restrictedGrid">
          <div className="restrictedBox">
            <b>Search & Destroy</b>
            <p>Ardennes Forest, Flak Tower, Gibraltar, London Docks, Sainte Marie du Mont, USS Texas</p>
          </div>
          <div className="restrictedBox">
            <b>Hardpoint</b>
            <p>Ardennes Forest, Gibraltar, London Docks, Sainte Marie du Mont</p>
          </div>
        </div>

        <h3>Settings — Search & Destroy</h3>
        <p>Use the <b>CWL Search & Destroy</b> game mode (Ranked Play variant). If unavailable, use Custom Game with these settings:</p>
        <table className="settingTable">
          <thead><tr><th>Setting</th><th>Value</th></tr></thead>
          <tbody>
            <tr><td>Game Mode</td><td>Search & Destroy</td></tr>
            <tr><td>Time Limit</td><td>1.5 Minutes</td></tr>
            <tr><td>Round Limit</td><td>11</td></tr>
            <tr><td>Round Win Limit</td><td>6</td></tr>
            <tr><td>Scorestreaks</td><td className="tag-banned">Off</td></tr>
            <tr><td>Killcam</td><td>On</td></tr>
            <tr><td>Team Assignment</td><td>On</td></tr>
          </tbody>
        </table>

        <h3>Settings — Hardpoint</h3>
        <table className="settingTable">
          <thead><tr><th>Setting</th><th>Value</th></tr></thead>
          <tbody>
            <tr><td>Game Mode</td><td>Hardpoint</td></tr>
            <tr><td>Score Limit</td><td>250</td></tr>
            <tr><td>Time Limit</td><td>10 Minutes</td></tr>
            <tr><td>Scorestreaks</td><td className="tag-banned">Off</td></tr>
            <tr><td>Respawn Delay</td><td>3 Seconds</td></tr>
            <tr><td>Killcam</td><td>On</td></tr>
            <tr><td>Team Assignment</td><td>On</td></tr>
          </tbody>
        </table>

        <h3>Hosting</h3>
        <ul>
          <li>Host for each map is shown on the match details page</li>
          <li>Non-hosting team picks which side they start on</li>
          <li>Last map host: team with the most combined rounds/score from prior maps. If tied, Map 1 host gets it</li>
        </ul>

        <h3>Restricted Items</h3>
        <div className="restrictedGrid">
          <div className="restrictedBox">
            <b>Allowed Primaries</b>
            <p className="tag-allowed">BAR, FG 42, STG44, M1 Garand, SVT-40, PPSh-41, Type 100, Grease Gun, MP-40, Thompson</p>
          </div>
          <div className="restrictedBox">
            <b>Banned Primaries</b>
            <p className="tag-banned">All LMGs, Shotguns, Snipers (except in S&D), Launchers</p>
          </div>
        </div>

        <p style={{ marginTop: 12 }}><b>Attachments:</b></p>
        <ul>
          <li className="tag-banned">Rapid Fire — Banned</li>
          <li className="tag-banned">FMJ / Armor Piercing — Banned</li>
          <li className="tag-banned">All Silencers / Suppressors — Banned</li>
          <li className="tag-banned">4x Optic / any magnification optic — Banned</li>
          <li className="tag-banned">Incendiary Shells — Banned</li>
        </ul>

        <p><b>Lethals:</b></p>
        <ul>
          <li className="tag-allowed">Frag — Allowed</li>
          <li className="tag-allowed">Semtex — Allowed</li>
          <li className="tag-banned">Satchel Charge, Bouncing Betty, C4, Throwing Knife — Banned</li>
        </ul>

        <p><b>Tacticals:</b></p>
        <ul>
          <li className="tag-allowed">Stun Grenade — Allowed</li>
          <li className="tag-banned">Smoke, Stim, Gas, Flashbang — Banned</li>
        </ul>

        <p><b>Basic Trainings (Perks):</b></p>
        <ul>
          <li className="tag-allowed">Lookout, Hustle, Hunker, Flanker, Energetic, Scoped — Allowed</li>
          <li className="tag-banned">Primed, Instincts, Espionage, Launched, Saboteur, Requisitions, Undercover, Duelist, Rifleman — Banned</li>
        </ul>

        <p><b>Divisions:</b></p>
        <ul>
          <li className="tag-allowed">Infantry, Airborne, Armored, Expeditionary — Allowed</li>
          <li className="tag-banned">Mountain — Banned (silent movement exploit)</li>
        </ul>

        <p><b>Scorestreaks:</b> <span className="tag-banned">ALL scorestreaks are banned</span></p>

        <h3>Glitches</h3>
        <ul>
          <li className="tag-banned">All out-of-map spots and wall breaches</li>
          <li className="tag-banned">Head glitch exploits (intentionally abusing geometry to make your model invisible while shooting)</li>
          <li className="tag-banned">Planting/defusing through walls</li>
          <li className="tag-banned">Emote/gesture camera exploits to peek around corners</li>
        </ul>

        <h3>Disconnections</h3>
        <p><b>Search & Destroy:</b> If a player disconnects, the round continues. The disconnected player may rejoin if possible. If they cannot rejoin, continue playing short-handed.</p>
        <p><b>Hardpoint:</b> Complete the game. The disconnected player may rejoin during the match.</p>
        <p>Server lag only warrants a cancel if everyone in the lobby is affected with proof from multiple perspectives.</p>

        <h3>Proof & Disputes</h3>
        <p>Same rules as General — video proof required, DVR recordings strongly encouraged. Full scoreboard with gamertags must be visible.</p>
      </div>
    </details>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */

function ThrowbackSharedRules() {
  return THROWBACK_SHARED_RULES.map((r) => (
    <div key={r.title}>
      <h3>{r.title}</h3>
      <p>{r.text}</p>
    </div>
  ));
}

function ThrowbackSettings({ ruleset }) {
  return (
    <table className="settingTable">
      <thead><tr><th>Setting</th><th>Value</th></tr></thead>
      <tbody>
        {ruleset.settings.map((s) => (
          <tr key={s.label}><td>{s.label}</td><td>{s.value}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */

function BO1Rules() {
  const r = THROWBACK_RULESETS["Call of Duty: Black Ops"];
  return (
    <details>
      <summary>Black Ops 1 <span className="badge">Throwback · PS5 Only</span></summary>
      <div className="ruleBody">
        <h3>Platform</h3>
        <p>{r.platform}</p>

        <h3>Series Scoring</h3>
        <p>{r.scoring}</p>

        <h3>Gameplay Settings</h3>
        <p>Anything not listed stays at default.</p>
        <ThrowbackSettings ruleset={r} />

        <h3>Maps (Search & Destroy)</h3>
        <p className="tag-allowed">{r.maps.join(", ")}</p>

        <h3>Restricted Items</h3>
        <div className="restrictedGrid">
          <div className="restrictedBox">
            <b>Banned Weapons</b>
            <p className="tag-banned">{r.restrictions.bannedWeapons}</p>
          </div>
          <div className="restrictedBox">
            <b>Banned Attachments</b>
            <p className="tag-banned">{r.restrictions.bannedAttachments}</p>
          </div>
        </div>

        <p style={{ marginTop: 12 }}><b>Lethals:</b></p>
        <ul>
          <li className="tag-allowed">Allowed: {r.restrictions.allowedLethals}</li>
          <li className="tag-banned">Banned: {r.restrictions.bannedLethals}</li>
        </ul>

        <p><b>Tacticals:</b></p>
        <ul>
          <li className="tag-allowed">Allowed: {r.restrictions.allowedTacticals}</li>
          <li className="tag-banned">Banned: {r.restrictions.bannedTacticals}</li>
        </ul>

        <p><b>Equipment:</b> <span className="tag-banned">{r.restrictions.equipment}</span></p>

        <p><b>Perks (only these allowed — rest banned):</b></p>
        <ul>
          {r.restrictions.allowedPerks.map((p) => (
            <li key={p.slot} className="tag-allowed">{p.slot}: {p.perks}</li>
          ))}
        </ul>

        <ThrowbackSharedRules />
      </div>
    </details>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */

function BO2Rules() {
  const r = THROWBACK_RULESETS["Call of Duty: Black Ops II"];
  return (
    <details>
      <summary>Black Ops 2 <span className="badge">Throwback · PS5 Only</span></summary>
      <div className="ruleBody">
        <h3>Platform</h3>
        <p>{r.platform}</p>

        <h3>Series Scoring</h3>
        <p>{r.scoring}</p>

        <h3>Gameplay Settings</h3>
        <ThrowbackSettings ruleset={r} />

        <h3>Maps (Search & Destroy)</h3>
        <p className="tag-allowed">{r.maps.join(", ")}</p>

        <h3>Restricted Items</h3>
        <div className="restrictedGrid">
          <div className="restrictedBox">
            <b>Allowed Primaries</b>
            <p className="tag-allowed">{r.restrictions.allowedPrimaries}</p>
          </div>
          <div className="restrictedBox">
            <b>Allowed Secondary</b>
            <p className="tag-allowed">{r.restrictions.allowedSecondary}</p>
          </div>
        </div>

        <p style={{ marginTop: 12 }}><b>Perks (only these allowed):</b></p>
        <ul>
          {r.restrictions.allowedPerks.map((p) => (
            <li key={p.slot} className="tag-allowed">{p.slot}: {p.perks}</li>
          ))}
        </ul>

        <p><b>Lethals:</b> <span className="tag-allowed">{r.restrictions.allowedLethals}</span></p>
        <p><b>Tacticals:</b> <span className="tag-allowed">{r.restrictions.allowedTacticals}</span></p>
        <p><b>Wildcards:</b> <span className="tag-allowed">{r.restrictions.allowedWildcards}</span></p>
        <p><b>Attachments:</b> <span className="tag-allowed">{r.restrictions.allowedAttachments}</span></p>

        <ThrowbackSharedRules />
      </div>
    </details>
  );
}
