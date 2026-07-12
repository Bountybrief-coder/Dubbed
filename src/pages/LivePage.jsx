import React, { useState } from "react";
import { Tv, ExternalLink } from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import { useVisibilityRefresh } from "../hooks/useVisibilityRefresh";
import { getStreamers } from "../services/profileService";
import { RankStar } from "../components/RankStar";
import { WagrBadge } from "../components/WagrBadge";
import { SkeletonRows } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { rankForXp } from "../utils/ranks";
import { money } from "../utils/format";

export function LivePage({ onOpenProfile }) {
  const { data: streamers, loading, error, reload } = useAsync(() => getStreamers(), []);
  const [active, setActive] = useState(null);

  useVisibilityRefresh(reload, []);

  return (
    <main className="page">
      <div className="pageHead">
        <div className="eyebrow">COMMUNITY</div>
        <h1>Live Streams</h1>
        <p className="sub">Watch Dubbed players compete live. Link your Twitch in your profile to appear here.</p>
      </div>

      {loading ? (
        <SkeletonRows rows={4} height={80} />
      ) : error ? (
        <div className="errorState"><p>{error}</p><button className="btn btn-ghost sm" onClick={reload}>Retry</button></div>
      ) : !streamers.length ? (
        <EmptyState icon={Tv} title="No streamers yet">Be the first. Add your Twitch username in your profile settings.</EmptyState>
      ) : (
        <>
          {active && (
            <div className="liveEmbed">
              <div className="liveEmbedHeader">
                <span><Tv size={14} /> {active}</span>
                <button className="btn btn-ghost sm" onClick={() => setActive(null)}>Close</button>
              </div>
              <iframe
                src={`https://player.twitch.tv/?channel=${encodeURIComponent(active)}&parent=${window.location.hostname}`}
                allowFullScreen
                className="liveIframe"
              />
              <iframe
                src={`https://www.twitch.tv/embed/${encodeURIComponent(active)}/chat?parent=${window.location.hostname}&darkpopout`}
                className="liveChatIframe"
              />
            </div>
          )}

          <div className="streamerGrid">
            {streamers.map((s) => {
              const rank = rankForXp(s.xp);
              const isActive = active === s.twitch_username;
              return (
                <div className={`streamerCard ${isActive ? "watching" : ""}`} key={s.id}>
                  <div className="streamerTop">
                    <div className="streamerAvatar" style={{ borderColor: rank.glow }}>
                      {s.avatar_url ? <img src={s.avatar_url} alt="" /> : <span>{s.username.slice(0, 2)}</span>}
                    </div>
                    <div className="streamerInfo">
                      <b onClick={() => onOpenProfile?.(s.username)} className="streamerName">
                        {s.username}{s.wagr_member && <WagrBadge size={14} />}
                      </b>
                      <small><RankStar rank={rank} size={16} inline /> {rank.name} · {s.wins}W-{s.losses}L · {money(s.earnings)} earned</small>
                    </div>
                  </div>
                  <div className="streamerActions">
                    <button
                      className={`btn ${isActive ? "btn-ghost" : "btn-primary"} sm`}
                      onClick={() => setActive(isActive ? null : s.twitch_username)}
                    >
                      <Tv size={13} /> {isActive ? "Watching" : "Watch"}
                    </button>
                    <a
                      className="btn btn-ghost sm"
                      href={`https://twitch.tv/${encodeURIComponent(s.twitch_username)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink size={13} /> Twitch
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
