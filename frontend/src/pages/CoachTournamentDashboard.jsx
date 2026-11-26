import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getTournament } from "../services/coach";
import "./CoachTournamentDashboard.css";

const tournamentIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const dashboardSections = [
  { id: "overview", label: "Overview" },
  { id: "teams", label: "Teams & Registration" },
  { id: "fixtures", label: "Fixtures" },
  { id: "results", label: "Results" },
  { id: "standings", label: "Standings" },
  { id: "statistics", label: "Top Scorers & Statistics" },
  { id: "staff", label: "Staff & Permissions" },
  { id: "settings", label: "Settings" },
];

const unavailableDescriptions = {
  teams: "Team invitations, registrations, rosters and approval controls are not available yet.",
  fixtures: "Tournament fixtures are not available yet.",
  results: "Tournament results are not available yet.",
  standings: "Tournament standings are not available yet.",
  statistics: "Top scorers and tournament statistics are not available yet.",
  staff: "Tournament staff management is not available yet. Planned roles include Tournament Owner, Tournament Administrator, Statistics Manager and Match Official.",
  settings: "Tournament-specific settings are not available yet.",
};

function formatDate(value) {
  if (!value) return "Not provided";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "Not provided";
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "Not returned by the service";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not returned by the service";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getLifecycleLabel(status) {
  return {
    draft: "Draft",
    published: "Published",
    in_progress: "In Progress",
    completed: "Completed",
    archived: "Archived",
  }[status] || status || "Unknown";
}

function isTournamentNotFound(errorMessage) {
  return /tournament not found|http 404|valid uuid/i.test(errorMessage);
}

function CoachTournamentDashboard({ tournamentId, getToken }) {
  const hasValidTournamentId = tournamentIdPattern.test(tournamentId);
  const [tournament, setTournament] = useState(null);
  const [activeSection, setActiveSection] = useState("overview");
  const [isLoading, setIsLoading] = useState(hasValidTournamentId);
  const [isNotFound, setIsNotFound] = useState(!hasValidTournamentId);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!hasValidTournamentId) return undefined;

    let active = true;
    const loadTournament = async () => {
      try {
        const token = await getToken();
        const result = await getTournament(tournamentId, token);
        if (active) setTournament(result);
      } catch (requestError) {
        if (active) {
          const message = requestError.message || "Tournament details could not be loaded.";
          if (isTournamentNotFound(message)) {
            setIsNotFound(true);
          } else {
            setError(message);
          }
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };

    loadTournament();
    return () => {
      active = false;
    };
  }, [getToken, hasValidTournamentId, retryCount, tournamentId]);

  const retryLoading = () => {
    setTournament(null);
    setIsNotFound(false);
    setError("");
    setIsLoading(true);
    setRetryCount((current) => current + 1);
  };

  const refreshTournamentBanner = async () => {
    const token = await getToken();
    const refreshedTournament = await getTournament(tournamentId, token);
    setTournament(refreshedTournament);
    return refreshedTournament.bannerUrl || null;
  };

  if (isLoading) {
    return (
      <TournamentDashboardState
        title="Loading tournament"
        message="Retrieving the saved tournament details..."
        backHref="/coach/tournaments"
      />
    );
  }

  if (isNotFound) {
    return (
      <TournamentDashboardState
        title="Tournament not found"
        message="This tournament could not be found, or you do not have access to it."
        backHref="/coach/tournaments"
      />
    );
  }

  if (error || !tournament) {
    return (
      <TournamentDashboardState
        title="Tournament unavailable"
        message={error || "Tournament details could not be loaded."}
        backHref="/coach/tournaments"
        onRetry={retryLoading}
      />
    );
  }

  const activeSectionLabel = dashboardSections.find(
    (section) => section.id === activeSection,
  )?.label;

  return (
    <section
      className="coach-tournament-dashboard"
      aria-labelledby="coach-tournament-dashboard-title"
    >
      <div className="coach-tournament-dashboard__topline">
        <Link className="coach-tournament-dashboard__back-link" to="/coach/tournaments">
          <span aria-hidden="true">←</span> All tournaments
        </Link>
        <span className="coach-tournament-dashboard__eyebrow">TOURNAMENT WORKSPACE</span>
      </div>

      <header className="coach-tournament-dashboard__header">
        <div>
          <p className="coach-tournament-dashboard__eyebrow">{activeSectionLabel}</p>
          <h1 id="coach-tournament-dashboard-title">{tournament.name}</h1>
          <p className="coach-tournament-dashboard__intro">
            Manage this tournament from its dedicated workspace.
          </p>
        </div>
        <span
          className={`coach-tournament-dashboard__lifecycle is-${tournament.status}`}
          aria-label={`Tournament status: ${getLifecycleLabel(tournament.status)}`}
        >
          {getLifecycleLabel(tournament.status)}
        </span>
      </header>

      <nav className="coach-tournament-dashboard__navigation" aria-label="Tournament sections">
        {dashboardSections.map((section) => (
          <button
            type="button"
            key={section.id}
            className={activeSection === section.id ? "is-active" : ""}
            aria-pressed={activeSection === section.id}
            onClick={() => setActiveSection(section.id)}
          >
            {section.label}
          </button>
        ))}
      </nav>

      {activeSection === "overview" ? (
        <TournamentOverview
          tournament={tournament}
          onRefreshBanner={refreshTournamentBanner}
        />
      ) : (
        <UnavailableSection
          title={activeSectionLabel}
          message={unavailableDescriptions[activeSection]}
        />
      )}
    </section>
  );
}

function TournamentOverview({ tournament, onRefreshBanner }) {
  const bannerUrl = typeof tournament.bannerUrl === "string" && tournament.bannerUrl
    ? tournament.bannerUrl
    : null;
  const [bannerRefreshAttemptedFor, setBannerRefreshAttemptedFor] = useState(null);
  const [bannerLoadFailed, setBannerLoadFailed] = useState(false);
  const [isRefreshingBanner, setIsRefreshingBanner] = useState(false);

  const handleBannerError = async () => {
    if (bannerRefreshAttemptedFor === tournament.id) {
      setBannerLoadFailed(true);
      return;
    }

    setBannerRefreshAttemptedFor(tournament.id);
    setIsRefreshingBanner(true);
    try {
      const refreshedUrl = await onRefreshBanner();
      if (!refreshedUrl || refreshedUrl === bannerUrl) {
        setBannerLoadFailed(true);
      }
    } catch {
      setBannerLoadFailed(true);
    } finally {
      setIsRefreshingBanner(false);
    }
  };

  return (
    <div className="coach-tournament-dashboard__overview">
      <section className="coach-tournament-dashboard__panel coach-tournament-dashboard__banner-panel">
        <div className="coach-tournament-dashboard__panel-heading">
          <div>
            <p className="coach-tournament-dashboard__eyebrow">TOURNAMENT OVERVIEW</p>
            <h2>{tournament.name}</h2>
          </div>
        </div>
        {bannerUrl && !bannerLoadFailed ? (
          <img
            className="coach-tournament-dashboard__banner"
            src={bannerUrl}
            alt={`${tournament.name} banner`}
            onError={handleBannerError}
          />
        ) : (
          <p className="coach-tournament-dashboard__banner-empty">
            {tournament.bannerKey
              ? "The tournament banner could not be loaded. Refresh tournament details to try again."
              : "No tournament banner is available."}
          </p>
        )}
        {isRefreshingBanner && (
          <p className="coach-tournament-dashboard__banner-empty" role="status">
            Refreshing the secure banner link...
          </p>
        )}
      </section>

      <section className="coach-tournament-dashboard__panel">
        <h2>Tournament Information</h2>
        <div className="coach-tournament-dashboard__information-grid">
          <InformationItem
            label="Description"
            value={tournament.description}
            isWide
          />
          <InformationItem label="Location" value={tournament.location} />
          <InformationItem label="Age category" value={tournament.ageCategory} />
          <InformationItem label="Tournament format" value={tournament.format} />
          <InformationItem label="Start date" value={formatDate(tournament.startDate)} />
          <InformationItem label="End date" value={formatDate(tournament.endDate)} />
          <InformationItem
            label="Registration deadline"
            value={formatDate(tournament.registrationDeadline)}
          />
          <InformationItem
            label="Maximum team capacity"
            value={Number.isInteger(tournament.maxTeams)
              ? `${tournament.maxTeams} teams`
              : null}
          />
          <InformationItem label="Organizer contact" value={tournament.organizerContact} />
          <InformationItem label="Created" value={formatDateTime(tournament.createdAt)} />
        </div>
      </section>
    </div>
  );
}

function InformationItem({ label, value, isWide = false }) {
  const displayValue = typeof value === "string" && value.trim()
    ? value
    : "Not provided";

  return (
    <div className={`coach-tournament-dashboard__information-item${isWide ? " is-wide" : ""}`}>
      <span>{label}</span>
      <strong>{displayValue}</strong>
    </div>
  );
}

function UnavailableSection({ title, message }) {
  return (
    <section className="coach-tournament-dashboard__placeholder">
      <span className="coach-tournament-dashboard__placeholder-mark" aria-hidden="true">✦</span>
      <p className="coach-tournament-dashboard__eyebrow">COMING SOON</p>
      <h2>{title}</h2>
      <p>{message}</p>
      <span className="coach-tournament-dashboard__placeholder-note">
        No data or actions are available in this section yet.
      </span>
    </section>
  );
}

function TournamentDashboardState({ title, message, backHref, onRetry }) {
  return (
    <section className="coach-tournament-dashboard__state" aria-live="polite">
      <p className="coach-tournament-dashboard__eyebrow">TOURNAMENT WORKSPACE</p>
      <h1>{title}</h1>
      <p>{message}</p>
      <div className="coach-tournament-dashboard__state-actions">
        {onRetry && (
          <button type="button" className="coach-tournament-dashboard__button" onClick={onRetry}>
            Retry
          </button>
        )}
        <Link className="coach-tournament-dashboard__button is-secondary" to={backHref}>
          Back to tournaments
        </Link>
      </div>
    </section>
  );
}

export default CoachTournamentDashboard;
