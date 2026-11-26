import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export default function ElevenStats() {
  const { getToken } = useAuth();
  const [stats, setStats] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState("PRIMARY");
  const [query, setQuery] = useState("");
  const [squads, setSquads] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const token = await getToken();
        const response = await fetch(`${API_URL}/api/stats/me`, {
          headers: token ? { Authorization: "Bearer " + token } : {},
        });
        if (!response.ok) throw new Error("Stats could not be loaded.");
        const data = await response.json();
        if (active) setStats(data);
      } catch (caught) {
        if (active) setError(caught.message);
      }
    })();
    return () => { active = false; };
  }, [getToken]);

  useEffect(() => {
    if (query.trim().length < 2) { setSquads([]); return; }
    const timer = setTimeout(async () => {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/squads/search?q=${encodeURIComponent(query.trim())}`, {
        headers: token ? { Authorization: "Bearer " + token } : {},
      });
      if (response.ok) setSquads(await response.json());
    }, 250);
    return () => clearTimeout(timer);
  }, [query, getToken]);

  if (error) return <section className="eleven-stats-page"><p className="eleven-feed-error">{error}</p></section>;
  if (!stats) return <section className="eleven-stats-page"><p className="eleven-feed-loading">Loading stats…</p></section>;

  const metrics = stats.metrics || {};
  const hasSquad = Object.keys(stats.slots || {}).length > 0;
  const slotLabels = [
    ["PRIMARY", "Primary Squad"],
    ["LOAN", "On Loan"],
    ["UNIVERSITY", "University"],
  ];

  return (
    <section className="eleven-stats-page">
      <header className="eleven-page-header">
        <div className="eleven-profile-avatar">{stats.avatarUrl ? <img src={stats.avatarUrl} alt="" /> : stats.displayName?.charAt(0)}</div>
        <div>
          <h1>{stats.displayName}</h1>
          <button type="button" className="eleven-player-uuid" onClick={async () => { await navigator.clipboard.writeText(stats.playerUuid); }}>ELEVEN {stats.playerUuid} ⧉</button>
          {stats.position && <p>{stats.position}</p>}
        </div>
        <button type="button" className="eleven-share-profile" onClick={() => navigator.share?.({ title: stats.displayName, url: `${window.location.origin}/player/${stats.playerUuid}` })}>Share Profile</button>
      </header>

      <div className="eleven-follow-counts">
        <button type="button"><strong>{stats.followersCount || 0}</strong><span>Followers</span></button>
        <button type="button"><strong>{stats.followingCount || 0}</strong><span>Following</span></button>
      </div>

      <div className="eleven-squad-switcher" role="tablist" aria-label="Squad slots">
        {slotLabels.map(([slot, label]) => (
          <button type="button" key={slot} className={selectedSlot === slot ? "active" : ""} onClick={() => setSelectedSlot(slot)}>
            <small>{label}</small>
            <strong>{stats.slots?.[slot]?.name || "No squad"}</strong>
          </button>
        ))}
      </div>

      <div className="eleven-stats-grid">
        <article><strong>{hasSquad ? metrics.matches : 0}</strong><span>Matches</span></article>
        <article><strong>{hasSquad ? metrics.goals : 0}</strong><span>Goals</span></article>
        <article><strong>{hasSquad ? metrics.assists : 0}</strong><span>Assists</span></article>
        <article><strong>{hasSquad ? (metrics.rating ?? 0).toFixed?.(1) || metrics.rating : "0.0"}</strong><span>Avg Rating</span></article>
      </div>

      {!hasSquad && <div className="eleven-no-squad"><strong>0-0-0</strong><p>Join a squad to build your stats.</p></div>}

      <div className="eleven-stats-columns">
        <section className="eleven-stat-card">
          <header><h2>Squad Ratings</h2>{stats.slots?.[selectedSlot]?.topEleven && <span>Top 11</span>}</header>
          {stats.slots?.[selectedSlot]
            ? <div className="eleven-ratings-empty"><p>{stats.slots[selectedSlot].name}</p><p>Match ratings will appear when your coach adds them.</p></div>
            : <div className="eleven-ratings-empty"><p>No {slotLabels.find(([slot]) => slot === selectedSlot)?.[1].toLower()} slot selected.</p></div>}
        </section>

        <section className="eleven-stat-card">
          <h2>Squad Offers</h2>
          <p className="eleven-muted-copy">No pending offers.</p>
        </section>

        <section className="eleven-stat-card">
          <h2>Find a Squad</h2>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search squad or SE-xxxx" />
          <div className="eleven-squad-results">
            {squads.map((squad) => <button type="button" key={squad.code}><strong>{squad.name}</strong><small>{squad.code} · {squad.category === "UNIVERSITY_SCHOOL" ? "University" : "Regulated"}</small></button>)}
          </div>
        </section>

        <section className="eleven-stat-card">
          <h2>Career History</h2>
          {stats.careerHistory?.length
            ? stats.careerHistory.map((item, index) => <div className="eleven-history-row" key={index}><strong>{item.squadName}</strong><small>{item.membershipType} · {item.matches} matches · {item.goals} goals</small></div>)
            : <p className="eleven-muted-copy">Permanent career history appears here after squad transfers.</p>}
        </section>
      </div>
    </section>
  );
}
