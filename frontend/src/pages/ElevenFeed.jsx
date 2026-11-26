import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export default function ElevenFeed() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("CLIP");
  const [posts, setPosts] = useState([]);
  const [cursor, setCursor] = useState("");
  const [loading, setLoading] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [toast, setToast] = useState("");
  const sentinel = useRef(null);

  const headers = async (json = false) => {
    const token = await getToken();
    const value = token ? { Authorization: "Bearer " + token } : {};
    return json ? { ...value, "Content-Type": "application/json" } : value;
  };

  const load = async (nextCursor = "") => {
    if (loading) return;
    setLoading(true);
    try {
      const auth = await headers();
      const query = nextCursor ? `?cursor=${encodeURIComponent(nextCursor)}` : "";
      const response = await fetch(`${API_URL}/api/posts/feed${query}`, { headers: auth });
      if (!response.ok) throw new Error("Could not load the feed.");
      const data = await response.json();
      setPosts((current) => nextCursor ? [...current, ...data] : data);
      setCursor(response.headers.get("X-Next-Cursor") || "");
    } catch (error) {
      setToast(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!sentinel.current || !cursor) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) load(cursor);
    }, { rootMargin: "300px" });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [cursor]);

  const follow = async (post) => {
    if (!post.authorUuid || post.authorUuid === "ELE") return;
    const auth = await headers();
    await fetch(`${API_URL}/api/users/${encodeURIComponent(post.authorUuid)}/follow`, {
      method: "POST",
      headers: auth,
    });
  };

  const share = async (post) => {
    const url = `${window.location.origin}/post/${post.id}`;
    const data = { title: "ELEVEN post", text: post.caption || "View this ELEVEN post", url };
    if (navigator.share && window.matchMedia("(max-width: 1023px)").matches) {
      await navigator.share(data);
    } else {
      await navigator.clipboard.writeText(url);
      setToast("Link copied!");
      setTimeout(() => setToast(""), 2200);
    }
  };

  const seeStats = async (post) => {
    await fetch(`${API_URL}/api/profile-views`, {
      method: "POST",
      headers: await headers(true),
      body: JSON.stringify({ playerUuid: post.authorUuid }),
    }).catch(() => {});
    navigate(`/player/${post.authorUuid}`);
  };

  const visiblePosts = posts.filter((post) => mode === "CLIP"
    ? post.postType === "CLIP"
    : post.postType !== "CLIP");

  return (
    <section className="eleven-feed-page">
      <header className="eleven-feed-header">
        <div>
          <p>ELEVEN</p>
          <h1>Home</h1>
        </div>
        <button type="button" onClick={() => setComposerOpen(true)} aria-label="Create clip or post">＋</button>
      </header>

      <div className="eleven-feed-toggle" role="tablist" aria-label="Feed type">
        <button type="button" className={mode === "CLIP" ? "active" : ""} onClick={() => setMode("CLIP")}>Clips</button>
        <button type="button" className={mode === "STANDARD" ? "active" : ""} onClick={() => setMode("STANDARD")}>Posts</button>
      </div>

      {mode === "CLIP" ? (
        <div className="eleven-clips">
          {visiblePosts.map((post) => (
            <article className="eleven-clip" key={post.id}>
              {post.media?.[0]?.type === "video"
                ? <video src={post.media[0].url} controls playsInline muted loop />
                : post.media?.[0]?.url
                  ? <img src={post.media[0].url} alt="" />
                  : <div className="eleven-clip-empty">ELEVEN</div>}
              <div className="eleven-clip-overlay">
                <div className="eleven-clip-author">
                  <strong>{post.authorName}</strong>
                  <button type="button" onClick={() => follow(post)}>+ Follow</button>
                </div>
                {post.caption && <p>{post.caption}</p>}
              </div>
              <div className="eleven-clip-actions">
                <button type="button" onClick={() => share(post)}>↗<span>Share</span></button>
                <button type="button" onClick={() => seeStats(post)}>▥<span>Stats</span></button>
              </div>
            </article>
          ))}
          {visiblePosts.length === 0 && <p className="eleven-feed-empty">No clips yet. Create the first Eleven highlight.</p>}
        </div>
      ) : (
        <div className="eleven-posts">
          {visiblePosts.map((post) => (
            <article className="eleven-post" key={post.id}>
              <header>
                <div className="eleven-post-avatar">{post.authorName?.charAt(0)}</div>
                <div><strong>{post.authorName}</strong><small>{post.authorUuid}</small></div>
                <button type="button" onClick={() => follow(post)}>+ Follow</button>
              </header>
              {post.caption && <p>{post.caption}</p>}
              {post.media?.map((media, index) => media.type === "video"
                ? <video key={index} src={media.url} controls />
                : <img key={index} src={media.url} alt="" />)}
              <footer>
                <button type="button" onClick={() => share(post)}>↗ Share</button>
                <button type="button" onClick={() => seeStats(post)}>▥ See Stats</button>
              </footer>
            </article>
          ))}
          {visiblePosts.length === 0 && <p className="eleven-feed-empty">No posts yet. Share the first Eleven update.</p>}
        </div>
      )}
      <div ref={sentinel} className="eleven-feed-sentinel" />
      {loading && <p className="eleven-feed-loading">Loading…</p>}
      {composerOpen && <UploadComposer onClose={() => setComposerOpen(false)} onPublished={() => { setComposerOpen(false); setPosts([]); setCursor(""); load(); }} />}
      {toast && <div className="eleven-toast" role="status">{toast}</div>}
    </section>
  );
}

function UploadComposer({ onClose, onPublished }) {
  const { getToken } = useAuth();
  const [kind, setKind] = useState("CLIP");
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState("");
  const [publishing, setPublishing] = useState(false);

  const selectFile = (event) => {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;
    if (nextFile.type.startsWith("video/")) {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        setDuration(Math.ceil(video.duration));
        if (video.duration > 300) setError("Clips and videos must be five minutes or shorter.");
      };
      video.src = URL.createObjectURL(nextFile);
    }
    setFile(nextFile);
  };

  const publish = async () => {
    setPublishing(true);
    setError("");
    try {
      if (!caption.trim() && !file) throw new Error("Add a caption or media.");
      if (duration > 300) throw new Error("Clips and videos must be five minutes or shorter.");
      const token = await getToken();
      const auth = token ? { Authorization: "Bearer " + token } : {};
      let media = [];
      if (file) {
        const form = new FormData();
        form.append("media", file);
        form.append("mediaType", file.type.startsWith("video/") ? "video" : "image");
        form.append("durationSeconds", String(duration));
        const upload = await fetch(`${API_URL}/api/posts/media`, { method: "POST", headers: auth, body: form });
        if (!upload.ok) throw new Error(await upload.text());
        const uploaded = await upload.json();
        media = [{ key: uploaded.key, mediaType: uploaded.mediaType, durationSeconds: uploaded.durationSeconds }];
      }
      const response = await fetch(`${API_URL}/api/posts`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ caption: caption.trim(), visibility: "public", postType: kind, media }),
      });
      if (!response.ok) throw new Error(await response.text());
      onPublished();
    } catch (caught) {
      setError(caught.message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="eleven-composer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="eleven-composer" role="dialog" aria-modal="true" aria-label="Create content">
        <div className="eleven-composer-grip" />
        <header><h2>Create</h2><button type="button" onClick={onClose} aria-label="Close">×</button></header>
        <div className="eleven-composer-kind">
          <button type="button" className={kind === "CLIP" ? "active" : ""} onClick={() => setKind("CLIP")}>Highlight Clip</button>
          <button type="button" className={kind === "STANDARD" ? "active" : ""} onClick={() => setKind("STANDARD")}>Standard Post</button>
        </div>
        <textarea value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={1000} placeholder="Share your football journey…" />
        <label className="eleven-media-picker">Choose photo or video<input type="file" accept="image/*,video/mp4,video/webm" onChange={selectFile} /></label>
        {file && <p className="eleven-selected-file">{file.name}</p>}
        {error && <p className="eleven-feed-error">{error}</p>}
        <button type="button" className="eleven-publish" onClick={publish} disabled={publishing}>{publishing ? "Publishing…" : "Publish"}</button>
      </section>
    </div>
  );
}
