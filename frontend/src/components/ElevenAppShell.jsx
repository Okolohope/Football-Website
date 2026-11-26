import { NavLink, Outlet } from "react-router-dom";

const navigation = [
  ["feed", "⌂", "Home"],
  ["stats", "↗", "Stats"],
  ["training", "✓", "Training"],
  ["messages", "◫", "Messages"],
  ["settings", "⚙", "Settings"],
];

export default function ElevenAppShell() {
  return (
    <div className="eleven-shell">
      <aside className="eleven-sidebar" aria-label="Primary navigation">
        <NavLink className="eleven-brand" to="/feed" aria-label="ELEVEN home">
          <span>11</span>
          <strong>ELEVEN</strong>
        </NavLink>
        <nav>
          {navigation.map(([path, icon, label]) => (
            <NavLink key={path} to={`/${path}`} className={({ isActive }) => isActive ? "active" : ""}>
              <b aria-hidden="true">{icon}</b>
              <span>{label}</span>
              {path === "messages" && <i className="eleven-unread">3</i>}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="eleven-content">
        <Outlet />
      </main>

      <nav className="eleven-bottom-nav" aria-label="Mobile navigation">
        {navigation.map(([path, icon, label]) => (
          <NavLink key={path} to={`/${path}`} className={({ isActive }) => isActive ? "active" : ""}>
            <b aria-hidden="true">{icon}</b>
            <span>{label}</span>
            {path === "messages" && <i className="eleven-unread">3</i>}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
