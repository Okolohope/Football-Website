import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useParams } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export default function ElevenPlayerProfile() {
  const { uuid } = useParams();
  const { getToken } = useAuth();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/player/${encodeURIComponent(uuid)}`, {
        headers: token ? { Authorization: "Bearer " + token } : {},
      });
      if (!response.ok) { setError("Player profile could not be loaded."); return; }
      setProfile(await response.json());
    })();
  }, [uuid, getToken]);

  const follow = async () => {
    const token = await getToken();
    await fetch(`${API_URL}/api/users/${encodeURIComponent(uuid)}/follow`, {
      method: "POST",
      headers: token ? { Authorization: "Bearer " + token } : {},
    });
  };

  if (error) return <section className="eleven-stats-page"><p className="eleven-feed-error">{error}</p></section>;
  if (!profile) return <section className="eleven-stats-page"><p className="eleven-feed-loading">Loading player…</p></section>;

  return (
    <section className="eleven-stats-page">
      <header className="eleven-page-header">
        <div className="eleven-profile-avatar">{profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : profile.displayName?.charAt(0)}</div>
        <div><h1>{profile.displayName}</h1><p>{uuid} · @{profile.username}</p>{profile.position && <p>{profile.position}</p>}</div>
        <button type="button" className="eleven-share-profile" onClick={follow}>+ Follow</button>
      </header>
      <div className="eleven-follow-counts"><button type="button"><strong>{profile.followersCount}</strong><span>Followers</span></button><button type="button"><strong>{profile.followingCount}</strong><span>Following</span></button></div>
      {profile.statsVisible
        ? <div className="eleven-stats-grid"><article><strong>{profile.metrics?.matches || 0}</strong><span>Matches</span></article><article><strong>{profile.metrics?.goals || 0}</strong><span>Goals</span></article><article><strong>{profile.metrics?.assists || 0}</strong><span>Assists</span></article><article><strong>{profile.metrics?.rating ? Number(profile.metrics.rating).toFixed(1) : "0.0"}</strong><span>Avg Rating</span></article></div>
        : <div className="eleven-no-squad"><strong>Private stats</strong><p>This player's stats privacy is set to {profile.statsPrivacy.replace("_", " ").toLower()}.</p></div>}
    </section>
  );
}
