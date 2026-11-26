import { Link } from "react-router-dom";

export default function ElevenPolicies() {
  return (
    <section className="eleven-settings-page">
      <header className="eleven-page-header-simple"><p>ELEVEN</p><h1>NFF Loan & University Club Guidelines</h1></header>
      <article className="eleven-setting-card">
        <h2>Primary and Loan Clubs</h2>
        <p className="eleven-muted-copy">A player may have one active Primary regulated club and one active On-Loan regulated club. Loans require parent-club approval and a loan end date.</p>
      </article>
      <article className="eleven-setting-card">
        <h2>University / School Clubs</h2>
        <p className="eleven-muted-copy">University and school teams are separate from NFF-regulated Primary and Loan squad slots. A player may have one active University club without affecting regulated club slots.</p>
      </article>
      <article className="eleven-setting-card">
        <h2>Career History</h2>
        <p className="eleven-muted-copy">Leaving, transferring, or completing a loan preserves match, goal, rating, and club history.</p>
      </article>
      <Link className="eleven-policy-back" to="/settings">← Back to Settings</Link>
    </section>
  );
}
