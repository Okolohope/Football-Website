import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export default function ElevenTraining() {
  const { getToken } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [reasonSession, setReasonSession] = useState(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    const token = await getToken();
    const response = await fetch(`${API_URL}/api/training`, {
      headers: token ? { Authorization: "Bearer " + token } : {},
    });
    if (response.ok) setSessions(await response.json());
  };

  useEffect(() => { load(); }, [getToken]);

  const submitRsvp = async (session, rsvp, reasonText = "") => {
    if ((rsvp === "RUNNING_LATE" || rsvp === "NOT_ATTENDING") && !reasonText.trim()) {
      setReasonSession({ session, rsvp });
      return;
    }
    setError("");
    const token = await getToken();
    const response = await fetch(`${API_URL}/api/training/rsvp/${session.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ rsvp, reason: reasonText }),
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    setReason("");
    setReasonSession(null);
    await load();
  };

  return (
    <section className="eleven-training-page">
      <header className="eleven-page-header-simple"><p>ELEVEN</p><h1>Training</h1></header>
      {error && <p className="eleven-feed-error">{error}</p>}
      <div className="eleven-training-columns">
        <div>
          {sessions.length === 0 && <article className="eleven-training-card"><h2>No upcoming training</h2><p>Your squad coach will add the next training session here.</p></article>}
          {sessions.map((session) => {
            const date = new Date(session.startsAt);
            return (
              <article className="eleven-training-card" key={session.id}>
                <header>
                  <div><small>{session.squadName}</small><h2>{session.title}</h2></div>
                  <time>{date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}<strong>{date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</strong></time>
                </header>
                {session.location && <p className="eleven-training-location">⌖ {session.location}</p>}
                <div className="eleven-attendance-status">
                  <span>Your RSVP<strong>{statusLabel(session.playerRsvp)}</strong></span>
                  <span>Coach Verification<strong className={session.coachStatus === "UNVERIFIED" ? "pending" : "verified"}>{coachLabel(session.coachStatus)}</strong></span>
                </div>
                <div className="eleven-rsvp-buttons">
                  <button type="button" className={session.playerRsvp === "ATTENDING" ? "active" : ""} onClick={() => submitRsvp(session, "ATTENDING")}>I Am Attending</button>
                  <button type="button" className={session.playerRsvp === "RUNNING_LATE" ? "active" : ""} onClick={() => submitRsvp(session, "RUNNING_LATE")}>Running Late</button>
                  <button type="button" className={session.playerRsvp === "NOT_ATTENDING" ? "active" : ""} onClick={() => submitRsvp(session, "NOT_ATTENDING")}>Not Attending</button>
                </div>
              </article>
            );
          })}
        </div>
        <aside className="eleven-training-card">
          <h2>Official Attendance History</h2>
          {sessions.filter((session) => session.coachStatus !== "UNVERIFIED").length
            ? sessions.filter((session) => session.coachStatus !== "UNVERIFIED").map((session) => <div className="eleven-attendance-row" key={session.id}><strong>{session.title}</strong><small>{coachLabel(session.coachStatus)}</small></div>)
            : <p className="eleven-muted-copy">Verified attendance will appear here.</p>}
        </aside>
      </div>

      {reasonSession && (
        <div className="eleven-composer-backdrop">
          <section className="eleven-composer eleven-reason-modal" role="dialog" aria-modal="true" aria-label="Attendance reason">
            <header><h2>Reason required</h2><button type="button" onClick={() => setReasonSession(null)}>×</button></header>
            <p>Send a reason to your coach.</p>
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder="Explain your status…" />
            <button type="button" className="eleven-publish" disabled={!reason.trim()} onClick={() => submitRsvp(reasonSession.session, reasonSession.rsvp, reason)}>Send to Coach</button>
          </section>
        </div>
      )}
    </section>
  );
}

function statusLabel(value) {
  return ({ ATTENDING: "Attending", RUNNING_LATE: "Running Late", NOT_ATTENDING: "Not Attending", NOT_RESPONDED: "Not Responded" })[value] || "Not Responded";
}

function coachLabel(value) {
  return ({ UNVERIFIED: "Pending", VERIFIED_PRESENT: "Verified Present", VERIFIED_LATE: "Verified Late", VERIFIED_ABSENT: "Verified Absent" })[value] || "Pending";
}
