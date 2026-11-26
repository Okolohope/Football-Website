import { useEffect, useState } from "react";
import { useAuth, useClerk } from "@clerk/clerk-react";
import { Link } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export default function ElevenSettings() {
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const [profile, setProfile] = useState(null);
  const [viewers, setViewers] = useState([]);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [position, setPosition] = useState("");
  const [darkMode, setDarkMode] = useState(true);
  const [statsPrivacy, setStatsPrivacy] = useState("EVERYONE");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [logoutOpen, setLogoutOpen] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const token = await getToken();
      const headers = token ? { Authorization: "Bearer " + token } : {};
      const profileResponse = await fetch(`${API_URL}/api/users/me`, { headers });
      if (profileResponse.ok) {
        const data = await profileResponse.json();
        if (!active) return;
        setProfile(data);
        setDisplayName(data.displayName || "");
        setUsername(data.username || "");
        setPosition(data.position || "");
        setDarkMode(data.darkMode !== false);
        setStatsPrivacy(data.statsPrivacy || "EVERYONE");
        document.documentElement.dataset.theme = data.darkMode === false ? "light" : "dark";
      }
      const viewerResponse = await fetch(`${API_URL}/api/profile-views/me`, { headers });
      if (viewerResponse.ok && active) setViewers(await viewerResponse.json());
    })();
    return () => { active = false; };
  }, [getToken]);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/users/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ username, displayName, position, darkMode, statsPrivacy }),
      });
      if (!response.ok) throw new Error(await response.text());
      document.documentElement.dataset.theme = darkMode ? "dark" : "light";
      setMessage("Settings saved.");
    } catch (caught) {
      setMessage(caught.message);
    } finally {
      setSaving(false);
    }
  };

  const copyUuid = async () => {
    if (!profile?.playerUuid) return;
    await navigator.clipboard.writeText(profile.playerUuid);
    setMessage("ELEVEN UUID copied.");
  };

  return (
    <section className="eleven-settings-page">
      <header className="eleven-page-header-simple"><p>ELEVEN</p><h1>Settings</h1></header>
      <form className="eleven-settings-grid" onSubmit={save}>
        <section className="eleven-setting-card">
          <h2>Edit Profile</h2>
          <label>Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={100} required /></label>
          <label>Username<input value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={80} required /></label>
          <label>Position<input value={position} onChange={(event) => setPosition(event.target.value)} maxLength={40} placeholder="Forward / Midfielder / Defender" /></label>
          <label>ELEVEN UUID<button type="button" onClick={copyUuid}>{profile?.playerUuid || "Loading…"} <span>⧉</span></button></label>
        </section>

        <section className="eleven-setting-card">
          <h2>Privacy & Viewers</h2>
          <label>Stats privacy<select value={statsPrivacy} onChange={(event) => setStatsPrivacy(event.target.value)}><option value="EVERYONE">Everyone</option><option value="SQUAD_ONLY">Squad only</option><option value="FRIENDS_ONLY">Friends only</option></select></label>
          <div className="eleven-recent-viewers">
            <h3>Recent profile viewers</h3>
            {viewers.length
              ? viewers.map((viewer) => <button type="button" key={`${viewer.playerUuid}-${viewer.viewedAt}`}><strong>{viewer.displayName}</strong><small>{viewer.playerUuid}</small></button>)
              : <p>No profile views yet.</p>}
          </div>
        </section>

        <section className="eleven-setting-card">
          <h2>Appearance</h2>
          <label className="eleven-toggle-row"><span><strong>Dark mode</strong><small>Persistent ELEVEN theme</small></span><input type="checkbox" checked={darkMode} onChange={(event) => setDarkMode(event.target.checked)} /></label>
        </section>

        <section className="eleven-setting-card">
          <h2>Policies</h2>
          <div className="eleven-policy-links">
            <Link to="/terms">Terms of Service</Link>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/policies/nff">NFF Loan & University Guidelines</Link>
          </div>
        </section>

        <section className="eleven-setting-card eleven-account-card">
          <h2>Account</h2>
          <button type="button" className="eleven-logout-button" onClick={() => setLogoutOpen(true)}>Log Out</button>
        </section>

        <div className="eleven-settings-save">
          {message && <p>{message}</p>}
          <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save Settings"}</button>
        </div>
      </form>

      {logoutOpen && (
        <div className="eleven-composer-backdrop">
          <section className="eleven-composer eleven-reason-modal" role="dialog" aria-modal="true" aria-label="Confirm log out">
            <h2>Log out of ELEVEN?</h2>
            <p>You will need to sign in again to access your account.</p>
            <div className="eleven-logout-actions">
              <button type="button" onClick={() => setLogoutOpen(false)}>Cancel</button>
              <button type="button" className="danger" onClick={() => signOut({ redirectUrl: "/account" })}>Log Out</button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
