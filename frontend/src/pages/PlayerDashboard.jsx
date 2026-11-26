import { useEffect, useState } from "react";
import { useAuth, useClerk, useUser } from "@clerk/clerk-react";
import PlayerProfileSetup from "../components/PlayerProfileSetup";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

function PlayerDashboard() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) return <p className="p-6 text-white">Loading your profile...</p>;
  return <PlayerDashboardContent key={user.id} />;
}

function PlayerDashboardContent() {
  const { getToken } = useAuth();
  const [profile, setProfile] = useState(undefined);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const token = await getToken();
        if (!token) throw new Error("Your session has expired. Please sign in again.");
        const response = await fetch(`${API_URL}/api/player/profile`, {
          headers: { Authorization: "Bearer " + token },
        });
        if (response.status === 404) {
          if (active) setProfile(null);
          return;
        }
        if (!response.ok) throw new Error("We could not load your profile. Please try again.");
        const savedProfile = await response.json();
        if (active) setProfile(savedProfile);
      } catch (error) {
        if (active) setLoadError(error.message);
      }
    }

    loadProfile();
    return () => {
      active = false;
    };
  }, [getToken]);

  if (loadError) return <p className="p-6 text-red-200">{loadError}</p>;
  if (profile === undefined) return <p className="p-6 text-white">Loading your profile...</p>;

  if (!profile) {
    return <PlayerProfileSetup onComplete={(savedProfile) => {
      setProfile(savedProfile);
    }} />;
  }

  return <Dashboard profile={profile} />;
}

function Dashboard({ profile }) {
  const { signOut } = useClerk();
  const firstName = profile.fullName?.split(" ")[0] || "Player";
  const [activeView, setActiveView] = useState("dashboard");
  const [viewHistory, setViewHistory] = useState(["dashboard"]);
  const stats = [
    ["⚽", "0", "Matches Played", "View Details"],
    ["▥", "0", "Goals", "View Stats"],
    ["★", "0", "Player Rating", "View Stats"],
    ["♜", "0", "Man of the Match", "View Achievements"],
  ];
  const navigate = (view) => (event) => {
    event.preventDefault();
    goTo(view);
  };
  const goTo = (view) => {
    if (view === activeView) return;
    setViewHistory((history) => [...history, view]);
    setActiveView(view);
  };
  const back = () => {
    setViewHistory((history) => {
      if (history.length <= 1) {
        setActiveView("dashboard");
        return ["dashboard"];
      }
      const previous = history[history.length - 2];
      setActiveView(previous);
      return history.slice(0, -1);
    });
  };

  return (
    <div className="player-dashboard">
      <aside className="dashboard-sidebar">
        <div className="dashboard-logo"><b>A</b><strong>PRO<span>ELEVN</span></strong></div>
        <div className="sidebar-player">
          <Avatar profile={profile} large />
          <strong>{profile.fullName}</strong>
          <small>{profile.primaryPosition || "Player"} · {profile.ageGroup || "Academy"}</small>
        </div>
        <nav className="dashboard-nav">
          <a className={activeView === "dashboard" ? "selected" : ""} href="#dashboard" onClick={navigate("dashboard")}>⌂ <span>Dashboard</span></a>
          <a className={activeView === "profile" ? "selected" : ""} href="#profile" onClick={navigate("profile")}>♙ <span>My Profile</span></a>
          <a className={activeView === "matches" ? "selected" : ""} href="#matches" onClick={navigate("matches")}>⚽ <span>My Matches</span></a>
          <a href="#training" onClick={navigate("training")}>♟ <span>Training</span></a>
          <a href="#statistics" onClick={navigate("statistics")}>▥ <span>Statistics</span></a>
          <a href="#attendance" onClick={navigate("attendance")}>✓ <span>My Attendance</span></a>
          <a href="#community" onClick={navigate("community")}>♧ <span>Community</span></a>
          <a href="#messages" onClick={navigate("messages")}>✉ <span>Messages</span></a>
          <a href="#settings" onClick={navigate("settings")}>⚙ <span>Settings</span></a>
        </nav>
        <button className="dashboard-logout" type="button" onClick={() => {
          sessionStorage.setItem("elevn_logout_pending", "true");
          signOut({ redirectUrl: "/account" });
        }}>↪ <span>Log Out</span></button>
        <div className="sidebar-footer"><b>PRO<span>ELEVN</span></b><small>Play · Improve · Achieve</small></div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-header">
          {activeView !== "dashboard" && <button className="mobile-back-button" type="button" onClick={back} aria-label="Go back">‹</button>}
          <button className="header-menu" type="button" aria-label="Go to dashboard home" onClick={() => goTo("dashboard")}>☰</button>
          <button className="dashboard-search" type="button" onClick={() => goTo("search")}>⌕ <span>Search teams and players...</span></button>
          <div className="header-account"><button type="button" className="header-bell" aria-label="Open messages" onClick={() => goTo("messages")}>♧<i>3</i></button><button type="button" className="header-profile-button" aria-label="Open profile" onClick={() => goTo("profile")}><Avatar profile={profile} /><strong>{firstName}</strong><span>⌄</span></button></div>
        </header>
        <div className="dashboard-body">
          {activeView === "dashboard" && <><section className="dashboard-welcome"><div><h1>Welcome back, <em>{firstName}!</em> 👋</h1><p>Your coach will add your football stats here.</p></div><div className="welcome-football">⚽</div></section>
          <section className="dashboard-stats">{stats.map(([icon, value, label, action]) => <article className="dashboard-stat" key={label}><b>{icon}</b><div><strong>{value}</strong><span>{label}</span><a href="#statistics" onClick={navigate("statistics")}>{action} →</a></div></article>)}</section>
          <div className="dashboard-panels">
            <section className="dashboard-panel"><PanelTitle icon="▣" title="Upcoming Activities" action="View All" onAction={() => goTo("training")} /><EmptyState text="Your coach has not added an activity yet." /></section>
            <section className="dashboard-panel"><PanelTitle icon="ϟ" title="Recent Activity" action="View" onAction={() => goTo("attendance")} /><EmptyState text="Your activity will appear here after your coach adds it." /></section>
            <section className="dashboard-panel"><PanelTitle icon="♜" title="Your Next Match" action="View" onAction={() => goTo("matches")} /><EmptyState text="Your coach has not added a match yet." /></section>
            <section className="dashboard-panel"><PanelTitle icon="⌁" title="Your Performance" action="View Stats" onAction={() => goTo("statistics")} /><EmptyState text="Your performance will appear after your coach adds stats." /></section>
          </div></>}
          {activeView === "profile" && <ProfileDetails profile={profile} onSettings={() => goTo("settings")} />}
          {activeView === "community" && <CommunityView profile={profile} />}
          {activeView === "settings" && <SettingsView profile={profile} onSaved={() => goTo("profile")} />}
          {activeView === "search" && <SearchView />}
          {activeView === "messages" && <MessagesView />}
          {activeView === "statistics" && <EmptyPage title="Statistics" text="Your coach will add goals, ratings, matches, and achievements here." />}
          {activeView === "matches" && <EmptyPage title="My Matches" text="Matches assigned by your coach will appear here." />}
          {activeView === "training" && <EmptyPage title="Training" text="Training sessions added by your coach will appear here." />}
          {activeView === "attendance" && <EmptyPage title="My Attendance" text="Your attendance record will appear here." />}
        </div>
        <nav className="mobile-dashboard-nav" aria-label="Mobile navigation">
          <a className={activeView === "dashboard" ? "active" : ""} href="#dashboard" onClick={navigate("dashboard")}>⌂<span>Home</span></a><a className={activeView === "profile" ? "active" : ""} href="#profile" onClick={navigate("profile")}>♙<span>Profile</span></a><a className={activeView === "community" ? "active" : ""} href="#community" onClick={navigate("community")}>⚽<span>Community</span></a><a className={activeView === "messages" ? "active" : ""} href="#messages" onClick={navigate("messages")}>✉<span>Chat</span></a><a className={activeView === "settings" ? "active" : ""} href="#settings" onClick={navigate("settings")}>⚙<span>Settings</span></a>
        </nav>
      </main>
    </div>
  );
}

function Avatar({ profile, large = false }) {
  return profile.avatarUrl ? <img className={`dashboard-avatar${large ? " large" : ""}`} src={profile.avatarUrl} alt="" /> : <div className={`dashboard-avatar placeholder${large ? " large" : ""}`}>{profile.fullName?.charAt(0)}</div>;
}

function PanelTitle({ icon, title, action, onAction }) {
  return <div className="panel-title"><h2><b>{icon}</b>{title}</h2>{action && (onAction ? <button type="button" className="panel-action" onClick={onAction}>{action} →</button> : <span>{action} →</span>)}</div>;
}

function EmptyState({ text }) {
  return <div className="dashboard-empty"><strong>0</strong><p>{text}</p></div>;
}

function EmptyPage({ title, text }) {
  return <section className="feature-page dashboard-panel"><h1>{title}</h1><EmptyState text={text} /></section>;
}

function ProfileDetails({ profile, onSettings }) {
  const details = [
    ["Full name", profile.fullName], ["Nickname", profile.nickname || "Not provided"],
    ["Phone", profile.phoneNumber || "Not provided"], ["Date of birth", profile.dateOfBirth || "Not provided"],
    ["Position", profile.primaryPosition], ["Preferred foot", profile.preferredFoot],
    ["Age group", profile.ageGroup], ["Gender", profile.gender],
    ["Location", `${profile.city}, ${profile.country}`], ["Playing level", profile.playingLevel],
    ["Years playing", profile.yearsPlaying], ["Languages", profile.languages?.join(", ") || "Not provided"],
  ];
  return <section className="feature-page dashboard-panel"><PanelTitle icon="♙" title="My Profile" action="Edit in Settings" onAction={onSettings} /><p className="feature-intro">The details you provided during onboarding are shown here.</p><div className="profile-details">{details.map(([label, value]) => <div key={label}><small>{label}</small><strong>{value || "Not provided"}</strong></div>)}</div>{profile.bio && <div className="profile-copy"><small>Bio</small><p>{profile.bio}</p></div>}{profile.ambitions && <div className="profile-copy"><small>Ambitions</small><p>{profile.ambitions}</p></div>}</section>;
}

function CommunityView({ profile }) {
  const { getToken } = useAuth();
  const [posts, setPosts] = useState([]);
  const [caption, setCaption] = useState("");
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaDuration, setMediaDuration] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const authHeaders = async () => {
    const token = await getToken();
    return token ? { Authorization: "Bearer " + token } : {};
  };
  const load = async () => {
    try {
      const headers = await authHeaders();
      const response = await fetch(`${API_URL}/api/posts/feed`, { headers });
      if (response.ok) setPosts(await response.json());
    } catch {
      setError("The community feed could not be loaded.");
    }
  };
  useEffect(() => { load(); }, []);

  const selectMedia = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith("video/")) {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        setMediaDuration(Math.ceil(video.duration));
        if (video.duration > 300) setError("Videos must be 5 minutes or shorter.");
        else setError("");
      };
      video.src = URL.createObjectURL(file);
    }
    setMediaFile(file);
  };

  const publish = async () => {
    setLoading(true);
    setError("");
    try {
      if (!caption.trim() && !mediaFile) throw new Error("Add a caption or choose a photo/video.");
      if (mediaDuration > 300) throw new Error("Videos must be 5 minutes or shorter.");
      const headers = await authHeaders();
      let media = [];
      if (mediaFile) {
        const form = new FormData();
        form.append("media", mediaFile);
        form.append("mediaType", mediaFile.type.startsWith("video/") ? "video" : "image");
        form.append("durationSeconds", String(mediaDuration));
        const upload = await fetch(`${API_URL}/api/posts/media`, { method: "POST", headers, body: form });
        if (!upload.ok) throw new Error(await upload.text());
        const uploaded = await upload.json();
        media = [{ key: uploaded.key, mediaType: uploaded.mediaType, durationSeconds: uploaded.durationSeconds }];
      }
      const response = await fetch(`${API_URL}/api/posts`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ caption: caption.trim(), visibility: "public", media }),
      });
      if (!response.ok) throw new Error(await response.text());
      setCaption("");
      setMediaFile(null);
      setMediaDuration(0);
      await load();
    } catch (caught) {
      setError(caught.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleLike = async (post) => {
    const headers = await authHeaders();
    await fetch(`${API_URL}/api/posts/like/${post.id}`, { method: post.liked ? "DELETE" : "POST", headers });
    await load();
  };

  return (
    <section className="community-feed">
      <div className="post-composer dashboard-panel">
        <Avatar profile={profile} />
        <div>
          <textarea value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={1000} placeholder="Share your football journey..." />
          <div className="composer-actions">
            <label>📷 Photo / video<input type="file" accept="image/*,video/mp4,video/webm" onChange={selectMedia} /></label>
            <button type="button" onClick={publish} disabled={loading}>{loading ? "Posting..." : "Post"}</button>
          </div>
          {mediaFile && <small className="media-selected">{mediaFile.name}</small>}
        </div>
      </div>
      {error && <p className="feed-error">{error}</p>}
      <div className="feed-list">
        {posts.length === 0 && <div className="empty-community"><strong>✦</strong><h2>No posts yet</h2><p>Share the first ELEVN moment.</p></div>}
        {posts.map((post) => (
          <article className="feed-post dashboard-panel" key={post.id}>
            <header><div className="post-avatar">{post.authorName?.charAt(0)}</div><div><strong>{post.authorName}</strong><small>{post.nickname || "ELEVN player"}</small></div>{post.authorId !== profile.userId && <button type="button" onClick={async () => { const headers=await authHeaders(); await fetch(`${API_URL}/api/follows/${post.authorId}`, {method:"POST",headers}); }}>Follow</button>}</header>
            {post.caption && <p>{post.caption}</p>}
            {post.media?.map((item, index) => item.type === "video"
              ? <video key={index} src={item.url} controls />
              : <img key={index} src={item.url} alt="Player post" />)}
            <footer><button type="button" onClick={() => toggleLike(post)}>{post.liked ? "♥" : "♡"} {post.likeCount}</button><button type="button" onClick={() => document.getElementById(`comment-${post.id}`)?.focus()}>💬 {post.commentCount}</button></footer>
            <CommentBox post={post} authHeaders={authHeaders} onChanged={load} />
          </article>
        ))}
      </div>
    </section>
  );
}

function CommentBox({ post, authHeaders, onChanged }) {
  const [body, setBody] = useState("");
  const send = async (event) => {
    event.preventDefault();
    if (!body.trim()) return;
    const headers = await authHeaders();
    await fetch(`${API_URL}/api/posts/comment/${post.id}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ body: body.trim() }),
    });
    setBody("");
    await onChanged();
  };
  return <form className="comment-box" onSubmit={send}><input id={`comment-${post.id}`} value={body} onChange={(event) => setBody(event.target.value)} maxLength={500} placeholder="Write a comment..." /><button type="submit">Send</button></form>;
}

function SearchView() {
  const { getToken } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/search?q=${encodeURIComponent(query.trim())}`, { headers: token ? { Authorization: "Bearer " + token } : {} });
      if (response.ok) setResults(await response.json());
    }, 250);
    return () => clearTimeout(timer);
  }, [query, getToken]);
  return <section className="feature-page dashboard-panel"><PanelTitle icon="⌕" title="Search" /><div className="search-box"><input value={query} onChange={(event) => { setQuery(event.target.value); setSelected(null); }} placeholder="Search players or teams..." /></div>{selected && <div className="search-selection"><small>{selected.kind}</small><strong>{selected.name}</strong><p>{selected.detail || selected.nickname || "ELEVN member"}</p></div>}<div className="search-results">{results.map((result) => <button type="button" key={`${result.kind}-${result.id}`} onClick={() => setSelected(result)}><strong>{result.name}</strong><small>{result.kind} · {result.detail || result.nickname}</small></button>)}</div></section>;
}

function SettingsView({ profile, onSaved }) {
  const { getToken } = useAuth();
  const [draft, setDraft] = useState({ ...profile });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/player/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify(draft),
      });
      if (!response.ok) throw new Error(await response.text());
      setMessage("Profile updated.");
      onSaved();
    } catch (caught) {
      setMessage(caught.message);
    } finally {
      setSaving(false);
    }
  };
  const update = (key) => (event) => setDraft((current) => ({ ...current, [key]: event.target.value }));
  return <form className="feature-page dashboard-panel settings-form" onSubmit={save}><PanelTitle icon="⚙" title="Profile Settings" /><div className="settings-grid"><label>Full name<input value={draft.fullName || ""} onChange={update("fullName")} maxLength={80} /></label><label>Nickname<input value={draft.nickname || ""} onChange={update("nickname")} maxLength={40} /></label><label>Phone number<input type="tel" value={draft.phoneNumber || ""} onChange={update("phoneNumber")} maxLength={30} /></label><label>Date of birth<input type="date" value={draft.dateOfBirth || ""} onChange={update("dateOfBirth")} /></label><label>Position<select value={draft.primaryPosition || ""} onChange={update("primaryPosition")}><option>Forward</option><option>Midfielder</option><option>Defender</option><option>Goalkeeper</option></select></label><label>Preferred foot<select value={draft.preferredFoot || ""} onChange={update("preferredFoot")}><option>Left</option><option>Right</option><option>Both</option></select></label><label>City<input value={draft.city || ""} onChange={update("city")} maxLength={80} /></label><label>Country<input value={draft.country || ""} onChange={update("country")} maxLength={60} /></label></div>{draft.dateOfBirth && (() => { const year = new Date().getFullYear() - new Date(draft.dateOfBirth).getFullYear(); return year < 18 ? <div className="guardian-settings"><h3>Guardian/parent access</h3><label>Guardian name<input value={draft.guardianName || ""} onChange={update("guardianName")} /></label><label>Guardian phone<input type="tel" value={draft.guardianPhone || ""} onChange={update("guardianPhone")} /></label><label className="consent"><input type="checkbox" checked={Boolean(draft.guardianConsent)} onChange={(event) => setDraft((current) => ({ ...current, guardianConsent: event.target.checked }))} /> Guardian consent confirmed</label></div> : null; })()}<label>Bio<textarea value={draft.bio || ""} onChange={update("bio")} maxLength={200} /></label><label>Ambitions<textarea value={draft.ambitions || ""} onChange={update("ambitions")} maxLength={320} /></label>{message && <p className="settings-message">{message}</p>}<button className="settings-save" type="submit" disabled={saving}>{saving ? "Saving..." : "Save changes"}</button></form>;
}

function MessagesView() {
  return <section className="feature-page dashboard-panel"><PanelTitle icon="✉" title="Messages" /><div className="message-tabs"><button className="active" type="button">Players</button><button type="button">Squad group</button></div><div className="empty-community"><strong>✉</strong><h2>No conversations yet</h2><p>Chat with players from your squad or other squads. Coach, assistant coach, and captain messages will appear in the squad group.</p></div></section>;
}

export default PlayerDashboard;
