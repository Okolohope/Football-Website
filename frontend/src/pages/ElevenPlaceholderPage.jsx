import { useNavigate } from "react-router-dom";

export default function ElevenPlaceholderPage({ title, eyebrow, message }) {
  const navigate = useNavigate();

  return (
    <section className="eleven-page-placeholder">
      <button type="button" className="eleven-back" onClick={() => navigate(-1)} aria-label="Go to previous page">‹</button>
      <p>{eyebrow}</p>
      <h1>{title}</h1>
      <div className="eleven-placeholder-card">
        <span aria-hidden="true">11</span>
        <strong>{message}</strong>
      </div>
    </section>
  );
}
