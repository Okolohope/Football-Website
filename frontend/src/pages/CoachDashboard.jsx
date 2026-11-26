import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth, useClerk } from "@clerk/clerk-react";
import { NavLink, useLocation, useParams } from "react-router-dom";
import { getCoachMe } from "../services/coach";
import CoachTraining from "./CoachTraining";
import CoachTournamentDashboard from "./CoachTournamentDashboard";
import CoachTournaments from "./CoachTournaments";
import "./CoachDashboard.css";

const navigationItems = [
  { label: "Dashboard", icon: "dashboard", path: "/coach" },
  { label: "My Squad", icon: "squad" },
  { label: "Training", icon: "training", path: "/coach/training" },
  { label: "Matches", icon: "matches" },
  { label: "Attendance", icon: "attendance" },
  { label: "Lineup Builder", icon: "lineup" },
  { label: "Tournaments", icon: "tournaments", path: "/coach/tournaments" },
  { label: "Statistics", icon: "statistics" },
  { label: "Calendar", icon: "calendar" },
  { label: "Team Settings", icon: "settings" },
  { label: "Coach Profile", icon: "profile" },
];

const dashboardData = {
  squadSize: 0,
  matchesPlayed: 0,
  upcomingTraining: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  goalsScored: 0,
  goalsConceded: 0,
  activities: [],
  recentActivities: [],
};

function formatAgeGroup(ageGroup) {
  if (ageGroup === "OPEN_SENIOR") return "Open / Senior";
  if (ageGroup === "OTHER") return "Other";
  return ageGroup;
}

function NavigationIcon({ name }) {
  const iconContent = {
    dashboard: (
      <>
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="3.5" width="7" height="4" rx="1.5" />
        <rect x="13.5" y="9.5" width="7" height="11" rx="1.5" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      </>
    ),
    squad: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.8M17 14a5 5 0 0 1 3.5 4.8" />
      </>
    ),
    training: (
      <>
        <path d="m14.5 4.5 5 5M4 20l4.3-1 10.9-10.9a2.1 2.1 0 0 0-3-3L5.3 16 4 20Z" />
        <path d="m13 6 5 5" />
      </>
    ),
    matches: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m12 7 3 2.2-1.1 3.6h-3.8L9 9.2 12 7Zm-3 5.8-3.1 2.3m10-2.3 3.2 2.3M9 9.2 7.3 6.7m7.7 2.5 1.7-2.5m-6.6 6.1L9 17.3m4.4-4.1 1.1 4.1" />
      </>
    ),
    attendance: (
      <>
        <rect x="3.5" y="5" width="17" height="16" rx="2" />
        <path d="M7.5 3v4m9-4v4M3.5 9.5h17m-12 5 2.2 2.2 4.8-4.8" />
      </>
    ),
    lineup: (
      <>
        <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
        <path d="M12 3.5v17M3.5 12h17M8 8h.01M16 8h.01M8 16h.01M16 16h.01" />
      </>
    ),
    tournaments: (
      <>
        <path d="M8 4h8v4a4 4 0 0 1-8 0V4Zm4 8v5m-4 3h8m-7-3h6M8 6H5v2a4 4 0 0 0 4 4m7-6h3v2a4 4 0 0 1-4 4" />
      </>
    ),
    statistics: (
      <>
        <path d="M4 20V10m5 10V4m5 16v-7m5 7V7" />
        <path d="M2.5 20.5h19" />
      </>
    ),
    calendar: (
      <>
        <rect x="3.5" y="5" width="17" height="16" rx="2" />
        <path d="M7.5 3v4m9-4v4M3.5 9.5h17M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" />
      </>
    ),
    settings: (
      <>
        <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
        <path d="m19.4 15 .1.1a1.8 1.8 0 0 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3.1 1.3v.2a1.8 1.8 0 0 1-3.6 0v-.2a1.8 1.8 0 0 0-3.1-1.3l-.1.1a1.8 1.8 0 0 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-1.3-3.1h-.2a1.8 1.8 0 0 1 0-3.6h.2a1.8 1.8 0 0 0 1.3-3.1l-.1-.1a1.8 1.8 0 0 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3.1-1.3v-.2a1.8 1.8 0 0 1 3.6 0v.2a1.8 1.8 0 0 0 3.1 1.3l.1-.1a1.8 1.8 0 0 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 1.3 3.1h.2a1.8 1.8 0 0 1 0 3.6h-.2a1.8 1.8 0 0 0-1.3 3.1Z" />
      </>
    ),
    profile: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
      </>
    ),
    bell: (
      <>
        <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0" />
      </>
    ),
    plus: <path d="M12 5v14m-7-7h14" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    goal: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m12 7 3 2.2-1.1 3.6h-3.8L9 9.2 12 7Zm-3 5.8-3.1 2.3m10-2.3 3.2 2.3M9 9.2 7.3 6.7m7.7 2.5 1.7-2.5" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 20 6v5c0 5-3.4 8.3-8 10-4.6-1.7-8-5-8-10V6l8-3Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    activity: (
      <>
        <path d="M3 12h4l3-8 4 16 3-8h4" />
      </>
    ),
    logout: (
      <>
        <path d="M10 17l5-5-5-5m5 5H3.5M13 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5" />
      </>
    ),
  }[name];

  return (
    <svg
      aria-hidden="true"
      className="coach-dashboard__nav-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconContent}
    </svg>
  );
}

function SectionHeading({ eyebrow, title, action }) {
  return (
    <div className="coach-dashboard__section-heading">
      <div>
        {eyebrow && <p className="coach-dashboard__section-eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function OverviewCard({ icon, label, value, detail, tone }) {
  return (
    <article className="coach-dashboard__overview-card">
      <span className={`coach-dashboard__card-icon is-${tone}`} aria-hidden="true">
        <NavigationIcon name={icon} />
      </span>
      <span className="coach-dashboard__overview-label">{label}</span>
      <strong className="coach-dashboard__overview-value">{value}</strong>
      <span className="coach-dashboard__overview-detail">{detail}</span>
    </article>
  );
}

function EmptyState({ icon, title, children, action }) {
  return (
    <div className="coach-dashboard__empty-state">
      <span className="coach-dashboard__empty-icon" aria-hidden="true">
        <NavigationIcon name={icon} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}

function BrandMark() {
  return (
    <span className="coach-dashboard__brand" aria-label="ELEVN">
      <span className="coach-dashboard__brand-mark" aria-hidden="true">
        E
      </span>
      <span className="coach-dashboard__brand-name">ELEVN</span>
    </span>
  );
}

function CoachDashboard() {
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const location = useLocation();
  const { tournamentId } = useParams();
  const isTrainingPage = location.pathname === "/coach/training";
  const isTournamentsPage = location.pathname === "/coach/tournaments";
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [coachResult, setCoachResult] = useState(null);
  const [isLoadingCoach, setIsLoadingCoach] = useState(true);
  const [coachError, setCoachError] = useState("");
  const [logoUnavailable, setLogoUnavailable] = useState(false);
  const [logoLoadError, setLogoLoadError] = useState("");
  const [profileRequest, setProfileRequest] = useState(0);
  const logoRefreshAttempted = useRef(false);
  const firstSquad = coachResult?.squads?.[0] ?? null;
  const teamLogoUrl = firstSquad?.teamLogoUrl;
  const fetchCoachProfile = useCallback(async () => {
    const token = await getToken();
    return getCoachMe(token);
  }, [getToken]);
  const winRate = dashboardData.matchesPlayed > 0
    ? `${Math.round((dashboardData.wins / dashboardData.matchesPlayed) * 100)}%`
    : "—";

  useEffect(() => {
    let isCurrent = true;

    fetchCoachProfile()
      .then((result) => {
        if (!isCurrent) return;
        setCoachResult(result);
        setCoachError("");
        setLogoUnavailable(false);
        setLogoLoadError("");
        logoRefreshAttempted.current = false;
      })
      .catch((error) => {
        if (isCurrent) {
          setCoachError(error.message || "Your coach profile could not be loaded.");
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoadingCoach(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [fetchCoachProfile, profileRequest]);

  useEffect(() => {
    if (!isMobileMenuOpen) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === "Escape") setIsMobileMenuOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isMobileMenuOpen]);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const handleTeamLogoError = async () => {
    if (logoRefreshAttempted.current) {
      setLogoUnavailable(true);
      setLogoLoadError("The team logo could not be loaded. Showing the default shield.");
      return;
    }

    logoRefreshAttempted.current = true;
    try {
      const result = await fetchCoachProfile();
      const refreshedLogoUrl = result.squads[0]?.teamLogoUrl;
      setCoachResult(result);
      if (!refreshedLogoUrl || refreshedLogoUrl === teamLogoUrl) {
        setLogoUnavailable(true);
        setLogoLoadError("The team logo could not be refreshed. Showing the default shield.");
        return;
      }

      setLogoUnavailable(false);
      setLogoLoadError("");
    } catch {
      setLogoUnavailable(true);
      setLogoLoadError("The team logo could not be refreshed. Showing the default shield.");
    }
  };

  return (
    <div className="coach-dashboard">
      {isMobileMenuOpen && (
        <button
          type="button"
          className="coach-dashboard__backdrop"
          aria-label="Close navigation menu"
          onClick={closeMobileMenu}
        />
      )}

      <aside
        className={`coach-dashboard__sidebar${isMobileMenuOpen ? " is-open" : ""}`}
        aria-label="Coach dashboard sidebar"
      >
        <div className="coach-dashboard__sidebar-top">
          <BrandMark />
          <span className="coach-dashboard__role">COACH WORKSPACE</span>
        </div>

        <nav
          id="coach-dashboard-navigation"
          className="coach-dashboard__navigation"
          aria-label="Main navigation"
        >
          <p className="coach-dashboard__nav-heading">MENU</p>
          {navigationItems.map((item) => (
            item.path ? (
              <NavLink
                to={item.path}
                end={item.path === "/coach"}
                key={item.label}
                className={({ isActive }) =>
                  `coach-dashboard__nav-item${isActive ? " is-active" : ""}`
                }
                onClick={closeMobileMenu}
              >
                <NavigationIcon name={item.icon} />
                <span>{item.label}</span>
                {location.pathname === item.path && (
                  <span className="coach-dashboard__active-dot" />
                )}
              </NavLink>
            ) : (
              <button
                type="button"
                key={item.label}
                className="coach-dashboard__nav-item"
                onClick={closeMobileMenu}
              >
                <NavigationIcon name={item.icon} />
                <span>{item.label}</span>
              </button>
            )
          ))}
        </nav>

        <div className="coach-dashboard__sidebar-bottom">
          <button
            type="button"
            className="coach-dashboard__nav-item coach-dashboard__logout"
            onClick={() => signOut({ redirectUrl: "/account" })}
          >
            <NavigationIcon name="logout" />
            <span>Log Out</span>
          </button>
          <p className="coach-dashboard__sidebar-note">Built for the love of the game.</p>
        </div>
      </aside>

      <main className="coach-dashboard__main">
        <header className="coach-dashboard__mobile-header">
          <button
            type="button"
            className={`coach-dashboard__menu-toggle${isMobileMenuOpen ? " is-open" : ""}`}
            aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isMobileMenuOpen}
            aria-controls="coach-dashboard-navigation"
            onClick={() => setIsMobileMenuOpen((isOpen) => !isOpen)}
          >
            <span />
            <span />
            <span />
          </button>
          <BrandMark />
        </header>

        <div className="coach-dashboard__content">
          {isTrainingPage ? (
            <CoachTraining
              squads={coachResult?.squads ?? []}
              isLoadingSquads={isLoadingCoach}
              squadsError={coachError}
              onRetrySquads={() => {
                setIsLoadingCoach(true);
                setCoachError("");
                setProfileRequest((current) => current + 1);
              }}
            />
          ) : tournamentId ? (
            <CoachTournamentDashboard
              key={tournamentId}
              tournamentId={tournamentId}
              getToken={getToken}
            />
          ) : isTournamentsPage ? (
            <CoachTournaments coach={coachResult?.coach ?? null} getToken={getToken} />
          ) : (
            <>
          {location.state?.onboardingSuccess && (
            <p className="coach-dashboard__status-message is-success" role="status">
              Your coach profile and first squad were saved successfully.
            </p>
          )}
          {coachError && (
            <div className="coach-dashboard__status-message is-error" role="alert">
              <span>{coachError}</span>
              <button
                type="button"
                onClick={() => {
                  setIsLoadingCoach(true);
                  setCoachError("");
                  setProfileRequest((current) => current + 1);
                }}
              >
                Try again
              </button>
            </div>
          )}
          <div className="coach-dashboard__welcome-row">
            <div className="coach-dashboard__welcome">
              <div className="coach-dashboard__page-label">
                <span className="coach-dashboard__page-label-mark" />
                COACH DASHBOARD
              </div>
              <h1>
                Welcome{coachResult?.coach?.fullName ? `, ${coachResult.coach.fullName}` : " back"}
              </h1>
              <p className="coach-dashboard__intro">
                Your coaching workspace, all in one place. Here&apos;s your team at a glance.
              </p>
            </div>
            <div className="coach-dashboard__welcome-tools">
              <button
                type="button"
                className="coach-dashboard__icon-button"
                aria-label="Notifications"
              >
                <NavigationIcon name="bell" />
                <span className="coach-dashboard__notification-dot" />
              </button>
              <button
                type="button"
                className="coach-dashboard__avatar-button"
                aria-label="Coach profile placeholder"
              >
                <NavigationIcon name="profile" />
              </button>
            </div>
          </div>

          <section className="coach-dashboard__team-banner" aria-label="Team identity">
            <div className="coach-dashboard__team-identity">
              <div className="coach-dashboard__team-crest" aria-hidden="true">
                {teamLogoUrl && !logoUnavailable ? (
                  <img src={teamLogoUrl} alt="" onError={handleTeamLogoError} />
                ) : (
                  <NavigationIcon name="shield" />
                )}
              </div>
              <div className="coach-dashboard__team-copy">
                <span className="coach-dashboard__banner-eyebrow">TEAM IDENTITY</span>
                <h2>
                  {isLoadingCoach
                    ? "Loading team..."
                    : firstSquad?.teamName || (coachError ? "Team details unavailable" : "No squad found")}
                </h2>
                <div className="coach-dashboard__team-meta">
                  <span>
                    <NavigationIcon name="profile" />
                    {isLoadingCoach
                      ? "Loading location..."
                      : firstSquad?.cityLocation || (coachError ? "Location unavailable" : "No location set")}
                  </span>
                  <i aria-hidden="true" />
                  <span>
                    {isLoadingCoach
                      ? "Loading age group..."
                      : firstSquad?.ageGroup
                        ? formatAgeGroup(firstSquad.ageGroup)
                        : coachError
                          ? "Age group unavailable"
                          : "No age group set"}
                  </span>
                </div>
              </div>
            </div>
            <span className="coach-dashboard__banner-watermark" aria-hidden="true">
              E
            </span>
            <span className="coach-dashboard__team-tag">COACH WORKSPACE</span>
          </section>
          {logoLoadError && (
            <p className="coach-dashboard__logo-error" role="status">
              {logoLoadError}
            </p>
          )}

          <section className="coach-dashboard__overview-grid" aria-label="Team overview statistics">
            <OverviewCard
              icon="squad"
              label="Total Players"
              value={dashboardData.squadSize}
              detail="players in your squad"
              tone="green"
            />
            <OverviewCard
              icon="matches"
              label="Matches Played"
              value={dashboardData.matchesPlayed}
              detail="completed matches"
              tone="blue"
            />
            <OverviewCard
              icon="training"
              label="Upcoming Training"
              value={dashboardData.upcomingTraining}
              detail="sessions scheduled"
              tone="amber"
            />
            <OverviewCard
              icon="statistics"
              label="Win Rate"
              value={winRate}
              detail={dashboardData.matchesPlayed ? "of completed matches" : "no matches played"}
              tone="violet"
            />
          </section>

          <section className="coach-dashboard__panel coach-dashboard__performance">
            <SectionHeading
              eyebrow="SEASON SNAPSHOT"
              title="Match Performance"
              action={
                <span className="coach-dashboard__panel-status">
                  <span />
                  {dashboardData.matchesPlayed} matches played
                </span>
              }
            />
            <div className="coach-dashboard__performance-grid">
              <div className="coach-dashboard__result-stat is-win">
                <span>Wins</span>
                <strong>{dashboardData.wins}</strong>
              </div>
              <div className="coach-dashboard__result-stat is-draw">
                <span>Draws</span>
                <strong>{dashboardData.draws}</strong>
              </div>
              <div className="coach-dashboard__result-stat is-loss">
                <span>Losses</span>
                <strong>{dashboardData.losses}</strong>
              </div>
              <div className="coach-dashboard__performance-divider" />
              <div className="coach-dashboard__goal-stat">
                <span>Goals scored</span>
                <strong>{dashboardData.goalsScored}</strong>
              </div>
              <div className="coach-dashboard__goal-stat">
                <span>Goals conceded</span>
                <strong>{dashboardData.goalsConceded}</strong>
              </div>
              <div className="coach-dashboard__win-rate-stat">
                <span>Win percentage</span>
                <strong>{winRate}</strong>
              </div>
            </div>
          </section>

          <div className="coach-dashboard__dashboard-grid">
            <section className="coach-dashboard__panel coach-dashboard__activities">
              <SectionHeading
                eyebrow="WHAT'S AHEAD"
                title="Upcoming Activities"
                action={
                  <button type="button" className="coach-dashboard__text-action">
                    <NavigationIcon name="plus" />
                    Schedule activity
                  </button>
                }
              />
              {dashboardData.activities.length === 0 ? (
                <EmptyState
                  icon="calendar"
                  title="No activities scheduled yet"
                  action={
                    <button type="button" className="coach-dashboard__primary-action">
                      <NavigationIcon name="plus" />
                      Schedule your first activity
                    </button>
                  }
                >
                  Training sessions, matches and team events will show up here when they&apos;re
                  scheduled.
                </EmptyState>
              ) : (
                <div className="coach-dashboard__activity-list">
                  {dashboardData.activities.map((activity) => (
                    <article className="coach-dashboard__activity-item" key={activity.id}>
                      <span className="coach-dashboard__activity-icon">
                        <NavigationIcon name={activity.icon} />
                      </span>
                      <div>
                        <h3>{activity.title}</h3>
                        <p>{activity.date || "Date to be confirmed"} · {activity.time || "Time to be confirmed"}</p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="coach-dashboard__panel coach-dashboard__recent">
              <SectionHeading
                eyebrow="THE LATEST"
                title="Recent Activity"
                action={
                  <span className="coach-dashboard__activity-count">
                    {dashboardData.recentActivities.length} updates
                  </span>
                }
              />
              {dashboardData.recentActivities.length === 0 ? (
                <EmptyState icon="activity" title="Your team story starts here">
                  New players, completed training, match results and attendance updates will appear
                  here.
                </EmptyState>
              ) : (
                <div className="coach-dashboard__activity-list">
                  {dashboardData.recentActivities.map((activity) => (
                    <article className="coach-dashboard__activity-item" key={activity.id}>
                      <span className="coach-dashboard__activity-icon">
                        <NavigationIcon name={activity.icon} />
                      </span>
                      <div>
                        <h3>{activity.title}</h3>
                        <p>{activity.description}</p>
                      </div>
                      <time>{activity.time}</time>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="coach-dashboard__dashboard-grid coach-dashboard__lower-grid">
            <section className="coach-dashboard__panel coach-dashboard__squad-overview">
              <SectionHeading eyebrow="YOUR TEAM" title="Team Overview" />
              <div className="coach-dashboard__team-stats">
                <div className="coach-dashboard__team-stat coach-dashboard__team-stat--featured">
                  <span>Squad size</span>
                  <strong>{dashboardData.squadSize}</strong>
                  <small>players</small>
                </div>
                <div className="coach-dashboard__team-stat">
                  <span>Matches played</span>
                  <strong>{dashboardData.matchesPlayed}</strong>
                </div>
                <div className="coach-dashboard__team-stat">
                  <span>Wins</span>
                  <strong className="is-win-text">{dashboardData.wins}</strong>
                </div>
                <div className="coach-dashboard__team-stat">
                  <span>Draws</span>
                  <strong className="is-draw-text">{dashboardData.draws}</strong>
                </div>
                <div className="coach-dashboard__team-stat">
                  <span>Losses</span>
                  <strong className="is-loss-text">{dashboardData.losses}</strong>
                </div>
                <div className="coach-dashboard__team-stat">
                  <span>Win rate</span>
                  <strong>{winRate}</strong>
                </div>
              </div>
            </section>

            <section className="coach-dashboard__quick-actions">
              <SectionHeading eyebrow="GET STARTED" title="Quick Actions" />
              <div className="coach-dashboard__quick-action-grid">
                {[
                  { icon: "squad", label: "Add Players", tone: "green" },
                  { icon: "training", label: "Schedule Training", tone: "amber" },
                  { icon: "matches", label: "Schedule Match", tone: "blue" },
                  { icon: "lineup", label: "Create Lineup", tone: "violet" },
                  { icon: "statistics", label: "View Statistics", tone: "green" },
                  { icon: "tournaments", label: "Manage Tournaments", tone: "amber" },
                ].map((action) => (
                  <button
                    type="button"
                    className="coach-dashboard__quick-action"
                    key={action.label}
                  >
                    <span className={`coach-dashboard__quick-action-icon is-${action.tone}`}>
                      <NavigationIcon name={action.icon} />
                    </span>
                    <span>{action.label}</span>
                    <span className="coach-dashboard__quick-action-arrow" aria-hidden="true">
                      ↗
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default CoachDashboard;
