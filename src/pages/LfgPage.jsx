import React, { useState, useCallback } from "react";
import { clickable } from "../utils/a11y";
import { usePageMeta } from "../hooks/usePageMeta";
import { Users, Plus, Mic, MicOff, Clock, Gamepad2, Monitor, Globe, X, Trash2, UserPlus, UserMinus, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useToast } from "../hooks/useToast.jsx";
import { useConfirm } from "../hooks/useConfirm.jsx";
import { useAsync } from "../hooks/useAsync";
import { useVisibilityRefresh } from "../hooks/useVisibilityRefresh";
import { listLfgPosts, createLfgPost, fillLfgPost, deleteLfgPost, respondToLfg, withdrawLfgResponse, getLfgResponses } from "../services/lfgService";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { SkeletonRows } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { WagrBadge } from "../components/WagrBadge";
import { RankStar } from "../components/RankStar";
import { rankForXp } from "../utils/ranks";
import { CURRENT_GAMES } from "../utils/games";
import { timeAgo } from "../utils/format";

const REGIONS   = ["NA", "EU"];
const PLATFORMS = ["PC", "Console"];

function expiresIn(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m left`;
  return `${Math.floor(m / 60)}h ${m % 60}m left`;
}

export function LfgPage({ onLogin, onNavigate }) {
  usePageMeta("Find Teammates", "Looking for teammates? Post an LFG listing or browse players looking for a squad in Call of Duty.");
  const { user, profile } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [gameFilter, setGameFilter] = useState(null);
  const [platFilter, setPlatFilter] = useState(null);
  const [regionFilter, setRegionFilter] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [expandedPost, setExpandedPost] = useState(null);
  const [responding, setResponding] = useState(null);

  const filters = { game: gameFilter, platform: platFilter, region: regionFilter };
  const fetchPosts = useCallback(() => listLfgPosts(filters), [gameFilter, platFilter, regionFilter]);
  const { data, loading, error, reload } = useAsync(fetchPosts, [gameFilter, platFilter, regionFilter]);
  useVisibilityRefresh(reload, [gameFilter, platFilter, regionFilter]);

  const posts = data || [];

  async function handleFill(postId) {
    const res = await fillLfgPost(postId);
    if (res.error) return toast.error(res.error);
    toast.success("Post marked as filled.");
    reload();
  }

  async function handleDelete(post) {
    const postId = typeof post === "object" ? post.id : post;
    const responses = typeof post === "object" ? (post.response_count || 0) : 0;
    if (responses > 0) {
      const ok = await confirm({
        title: "Delete this post?",
        message: `${responses} player${responses === 1 ? " has" : "s have"} shown interest. Deleting removes it for everyone.`,
        confirmLabel: "Delete post",
      });
      if (!ok) return;
    }
    const res = await deleteLfgPost(postId);
    if (res.error) return toast.error(res.error);
    toast.success("Post deleted.");
    reload();
  }

  async function handleJoin(postId) {
    if (!user) return onLogin?.();
    setResponding(postId);
    const res = await respondToLfg(postId);
    setResponding(null);
    if (res.error) return toast.error(res.error);
    toast.success("You're in! The poster has been notified.");
    reload();
  }

  async function handleWithdraw(postId) {
    setResponding(postId);
    const res = await withdrawLfgResponse(postId);
    setResponding(null);
    if (res.error) return toast.error(res.error);
    reload();
  }

  function copyGamertag(tag) {
    if (!tag) return;
    if (!navigator.clipboard) return toast.info(`Copy it manually: ${tag}`);
    navigator.clipboard.writeText(tag).then(
      () => toast.success("Gamertag copied!"),
      () => toast.info(`Couldn't copy — copy it manually: ${tag}`)
    );
  }

  return (
    <main className="page">
      <div className="pageHead">
        <div className="eyebrow">FIND TEAMMATES</div>
        <h1>Looking for Group</h1>
        <p className="sub">Post or browse to find players for your next match.</p>
      </div>

      <div className="lfgControls">
        <div className="lfgFilters">
          <div className="lfgFilterGroup">
            <select className="lfgSelect" value={gameFilter || ""} onChange={e => setGameFilter(e.target.value || null)}>
              <option value="">All Games</option>
              {CURRENT_GAMES.map(g => <option key={g.slug} value={g.slug}>{g.name}</option>)}
            </select>
          </div>
          <div className="lfgFilterGroup">
            <select className="lfgSelect" value={platFilter || ""} onChange={e => setPlatFilter(e.target.value || null)}>
              <option value="">All Platforms</option>
              {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="lfgFilterGroup">
            <select className="lfgSelect" value={regionFilter || ""} onChange={e => setRegionFilter(e.target.value || null)}>
              <option value="">All Regions</option>
              {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <Button
          icon={Plus}
          onClick={() => user ? setCreateOpen(true) : onLogin?.()}
        >
          Post LFG
        </Button>
      </div>

      {loading ? <SkeletonRows rows={5} /> : error ? (
        <div className="errorState"><p>{error}</p><button className="btn btn-ghost sm" onClick={reload}>Retry</button></div>
      ) : posts.length === 0 ? (
        <EmptyState icon={Users} title="No active LFG posts">
          {gameFilter || platFilter || regionFilter
            ? "Try removing a filter or post your own."
            : "Be the first. Post an LFG and find your squad."}
        </EmptyState>
      ) : (
        <div className="lfgGrid">
          {posts.map(post => {
            const rank = rankForXp(post.xp || 0);
            const isMine = user && post.user_id === user.id;
            const gameObj = CURRENT_GAMES.find(g => g.slug === post.game);
            const isExpanded = expandedPost === post.id;
            return (
              <div key={post.id} className={`lfgCard ${isMine ? "mine" : ""}`}>
                <div className="lfgCardTop">
                  <div className="lfgCardUser" {...clickable(() => onNavigate?.("profile", post.username))}>
                    <div className="lfgAvatar" style={{ borderColor: rank.glow }}>
                      {post.avatar_url ? <img src={post.avatar_url} alt="" /> : <span>{(post.username || "?").slice(0, 2)}</span>}
                    </div>
                    <div>
                      <b>{post.username}{post.wagr_member && <WagrBadge size={12} />}</b>
                      <div className="lfgRank" style={{ color: rank.glow }}>
                        <RankStar rank={rank} size={14} /> {rank.name}
                      </div>
                    </div>
                  </div>
                  <div className="lfgCardMeta">
                    <span className="lfgTime"><Clock size={12} /> {timeAgo(post.created_at)}</span>
                    <span className="lfgExpires">{expiresIn(post.expires_at)}</span>
                  </div>
                </div>

                {post.activision_id && (
                  <div className="lfgGamertag" {...clickable(() => copyGamertag(post.activision_id))}>
                    <Gamepad2 size={12} /> {post.activision_id} <Copy size={10} />
                  </div>
                )}

                <div className="lfgCardTags">
                  {gameObj && <span className="lfgTag game"><Gamepad2 size={12} /> {gameObj.short}</span>}
                  {post.mode && <span className="lfgTag">{post.mode}</span>}
                  {post.platform && <span className="lfgTag"><Monitor size={12} /> {post.platform}</span>}
                  {post.region && <span className="lfgTag"><Globe size={12} /> {post.region}</span>}
                  <span className="lfgTag"><Users size={12} /> {post.team_size}v{post.team_size}</span>
                  <span className={`lfgTag ${post.mic_required ? "mic-on" : "mic-off"}`}>
                    {post.mic_required ? <><Mic size={12} /> Mic</>: <><MicOff size={12} /> No mic</>}
                  </span>
                  {post.response_count > 0 && (
                    <span className="lfgTag interested"><UserPlus size={12} /> {post.response_count} interested</span>
                  )}
                </div>

                {post.message && <p className="lfgMessage">{post.message}</p>}

                <div className="lfgCardActions">
                  {isMine ? (
                    <>
                      <Button size="sm" variant="primary" onClick={() => handleFill(post.id)}>Mark Filled</Button>
                      {post.response_count > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setExpandedPost(isExpanded ? null : post.id)}
                        >
                          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          {post.response_count} {post.response_count === 1 ? "Player" : "Players"}
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" aria-label="Delete LFG post" onClick={() => handleDelete(post)}><Trash2 size={13} /></Button>
                    </>
                  ) : user ? (
                    post.my_response ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={UserMinus}
                        loading={responding === post.id}
                        onClick={() => handleWithdraw(post.id)}
                      >Withdraw</Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="primary"
                        icon={UserPlus}
                        loading={responding === post.id}
                        onClick={() => handleJoin(post.id)}
                      >I'm Interested</Button>
                    )
                  ) : (
                    <Button size="sm" variant="primary" icon={UserPlus} onClick={() => onLogin?.()}>I'm Interested</Button>
                  )}
                </div>

                {isMine && isExpanded && (
                  <InterestedList postId={post.id} onNavigate={onNavigate} onCopy={copyGamertag} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {createOpen && (
        <CreateLfgModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => { setCreateOpen(false); reload(); }}
          profile={profile}
        />
      )}
    </main>
  );
}

function InterestedList({ postId, onNavigate, onCopy }) {
  const fetchResponses = useCallback(() => getLfgResponses(postId), [postId]);
  const { data, loading } = useAsync(fetchResponses, [postId]);
  const players = data || [];

  if (loading) return <div className="lfgInterestedList"><span className="spinner" style={{ width: 16, height: 16 }} /></div>;
  if (!players.length) return <div className="lfgInterestedList"><span className="lfgInterestedEmpty">No responses yet</span></div>;

  return (
    <div className="lfgInterestedList">
      {players.map(p => {
        const rank = rankForXp(p.xp || 0);
        return (
          <div key={p.id} className="lfgInterestedRow">
            <div className="lfgInterestedUser" {...clickable(() => onNavigate?.("profile", p.username))}>
              <div className="lfgAvatar" style={{ borderColor: rank.glow, width: 28, height: 28, fontSize: 10 }}>
                {p.avatar_url ? <img src={p.avatar_url} alt="" /> : <span>{(p.username || "?").slice(0, 2)}</span>}
              </div>
              <span>{p.username}</span>
              {p.wagr_member && <WagrBadge size={10} />}
            </div>
            {p.activision_id && (
              <button className="lfgGamertagCopy" onClick={() => onCopy(p.activision_id)} title="Copy gamertag">
                <Gamepad2 size={11} /> {p.activision_id} <Copy size={9} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CreateLfgModal({ onClose, onCreated, profile }) {
  const toast = useToast();
  const [form, setForm] = useState({
    game: CURRENT_GAMES[0]?.slug || "bo7",
    mode: "",
    platform: profile?.platform || "",
    region: profile?.region || "",
    mic: false,
    teamSize: "2",
    message: "",
  });
  const [saving, setSaving] = useState(false);

  function set(k, v) { setForm(p => ({ ...p, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.game) return toast.error("Select a game");
    setSaving(true);
    const res = await createLfgPost({
      game: form.game,
      mode: form.mode || null,
      platform: form.platform || null,
      region: form.region || null,
      mic: form.mic,
      teamSize: parseInt(form.teamSize) || 2,
      message: form.message.trim(),
    });
    setSaving(false);
    if (res.error) return toast.error(res.error);
    toast.success("LFG post created! Expires in 4 hours.");
    onCreated();
  }

  return (
    <Modal open title="Post LFG" onClose={onClose}>
      <form onSubmit={handleSubmit} className="lfgForm">
        <label>
          <span>Game</span>
          <select value={form.game} onChange={e => set("game", e.target.value)}>
            {CURRENT_GAMES.map(g => <option key={g.slug} value={g.slug}>{g.name}</option>)}
          </select>
        </label>
        <div className="lfgFormRow">
          <label>
            <span>Platform</span>
            <select value={form.platform} onChange={e => set("platform", e.target.value)}>
              <option value="">Any</option>
              {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label>
            <span>Region</span>
            <select value={form.region} onChange={e => set("region", e.target.value)}>
              <option value="">Any</option>
              {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
        </div>
        <div className="lfgFormRow">
          <label>
            <span>Team Size</span>
            <select value={form.teamSize} onChange={e => set("teamSize", e.target.value)}>
              <option value="1">1v1</option>
              <option value="2">2v2</option>
              <option value="3">3v3</option>
              <option value="4">4v4</option>
            </select>
          </label>
          <label className="lfgMicLabel">
            <span>Mic Required</span>
            <button type="button" className={`lfgMicToggle ${form.mic ? "on" : ""}`} onClick={() => set("mic", !form.mic)}>
              {form.mic ? <><Mic size={14} /> Yes</> : <><MicOff size={14} /> No</>}
            </button>
          </label>
        </div>
        <label>
          <span>Message (optional)</span>
          <textarea
            value={form.message}
            onChange={e => set("message", e.target.value)}
            placeholder="Looking for cracked teammates for ranked 8s..."
            maxLength={280}
            rows={3}
          />
        </label>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
          <Button variant="ghost" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" loading={saving}>Post LFG</Button>
        </div>
      </form>
    </Modal>
  );
}
