import { useRef, useState } from "react";
import "./CoachTraining.css";

const sessionStatuses = ["Upcoming", "Completed", "Cancelled"];
const attendanceStatuses = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "late", label: "Late" },
  { value: "excused", label: "Excused" },
];
const previewRosterTemplate = [
  { name: "Alex Morgan", initials: "AM", jerseyNumber: 7 },
  { name: "Jamie Taylor", initials: "JT", jerseyNumber: 10 },
  { name: "Sam Williams", initials: "SW", jerseyNumber: 14 },
  { name: "Casey Brown", initials: "CB", jerseyNumber: 21 },
];

const demoPreviewSquad = {
  id: "demo-preview-squad",
  teamName: "Demo Training Squad",
  ageGroup: "DEMO",
};

const suggestedActivities = [
  {
    id: "dynamic-warm-up",
    name: "Dynamic warm-up",
    detail: "Mobility, movement and ball activation",
    durationMinutes: 10,
  },
  {
    id: "rondo",
    name: "Rondo",
    detail: "Quick decisions and close control",
    durationMinutes: 15,
  },
  {
    id: "passing-patterns",
    name: "Passing patterns",
    detail: "Build rhythm and movement off the ball",
    durationMinutes: 20,
  },
  {
    id: "small-sided-game",
    name: "Small-sided game",
    detail: "Apply the session focus under pressure",
    durationMinutes: 25,
  },
];

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const parts = [];

  if (hours) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  if (remainingMinutes) {
    parts.push(`${remainingMinutes} ${remainingMinutes === 1 ? "minute" : "minutes"}`);
  }

  return parts.join(" ") || "0 minutes";
}

function formatSessionDate(dateValue) {
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getPreviewRoster(squadId) {
  return previewRosterTemplate.map((player, index) => ({
    ...player,
    id: `${squadId}-preview-${index + 1}`,
  }));
}

function attendanceIsSaved(record) {
  if (!record?.savedAt) return false;
  const draftEntries = Object.entries(record.draft ?? {});
  const savedEntries = Object.entries(record.saved ?? {});
  return draftEntries.length === savedEntries.length
    && draftEntries.every(([playerId, status]) => record.saved[playerId] === status);
}

function getAttendanceRecordStatus(record) {
  if (attendanceIsSaved(record)) return "Preview saved";
  if (record?.savedAt) return "Unsaved corrections";
  if (Object.keys(record?.draft ?? {}).length > 0) return "In progress · preview";
  return "Not recorded";
}

function makePreviewId() {
  return globalThis.crypto?.randomUUID?.()
    ?? `preview-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function CoachTraining({ squads, isLoadingSquads, squadsError, onRetrySquads }) {
  const [activeStatus, setActiveStatus] = useState("Upcoming");
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isAttendanceOpen, setIsAttendanceOpen] = useState(false);
  const [selectedAttendanceSessionId, setSelectedAttendanceSessionId] = useState("");
  const [previewSessions, setPreviewSessions] = useState([]);
  const [attendanceBySessionId, setAttendanceBySessionId] = useState({});
  const [plannerError, setPlannerError] = useState("");
  const composerRef = useRef(null);
  const [selectedActivities, setSelectedActivities] = useState([]);
  const [activityDurations, setActivityDurations] = useState({});
  const [editingActivityId, setEditingActivityId] = useState("");
  const [durationDraft, setDurationDraft] = useState("");
  const [selectedSquadId, setSelectedSquadId] = useState("");
  const selectedSquad = squads.find((squad) => squad.id === selectedSquadId)
    ?? squads[0]
    ?? (isLoadingSquads ? null : demoPreviewSquad);
  const selectedActivityDetails = suggestedActivities.filter((activity) =>
    selectedActivities.includes(activity.id)
  ).map((activity) => ({
    ...activity,
    durationMinutes: activityDurations[activity.id] ?? activity.durationMinutes,
  }));
  const totalActivityMinutes = selectedActivityDetails.reduce(
    (total, activity) => total + activity.durationMinutes,
    0,
  );
  const visibleSessions = previewSessions.filter((session) => session.status === activeStatus);
  const selectedAttendanceSession = previewSessions.find(
    (session) => session.id === selectedAttendanceSessionId,
  );

  const durationIsValid = /^\d+$/.test(durationDraft)
    && Number.isSafeInteger(Number(durationDraft))
    && Number(durationDraft) > 0;

  const toggleActivity = (activityId) => {
    if (selectedActivities.includes(activityId) && editingActivityId === activityId) {
      setEditingActivityId("");
      setDurationDraft("");
    }

    setSelectedActivities((current) => (
      current.includes(activityId)
        ? current.filter((id) => id !== activityId)
        : [...current, activityId]
    ));
  };

  const startEditingDuration = (activity) => {
    setEditingActivityId(activity.id);
    setDurationDraft(String(activity.durationMinutes));
  };

  const cancelDurationEdit = () => {
    setEditingActivityId("");
    setDurationDraft("");
  };

  const saveActivityDuration = (event, activityId) => {
    event.preventDefault();
    if (!durationIsValid) return;

    setActivityDurations((current) => ({
      ...current,
      [activityId]: Number(durationDraft),
    }));
    cancelDurationEdit();
  };

  const addPreviewSession = () => {
    const formData = new FormData(composerRef.current);
    const title = String(formData.get("title") ?? "").trim();
    const date = String(formData.get("date") ?? "");
    const squadId = String(formData.get("squad") ?? "");
    const squad = squads.find((item) => item.id === squadId)
      ?? (squadId === demoPreviewSquad.id ? demoPreviewSquad : null);

    if (!title || !date || !squad) {
      setPlannerError("Add a session title and date, and choose a squad before previewing.");
      return;
    }

    const session = {
      id: makePreviewId(),
      title,
      date,
      startTime: String(formData.get("startTime") ?? ""),
      endTime: String(formData.get("endTime") ?? ""),
      squadId: squad.id,
      squadName: squad.teamName,
      squadAgeGroup: squad.ageGroup,
      status: "Upcoming",
      activities: selectedActivityDetails.map((activity) => ({ ...activity })),
    };

    setPreviewSessions((current) => [session, ...current]);
    setAttendanceBySessionId((current) => ({
      ...current,
      [session.id]: { draft: {}, saved: null, savedAt: null },
    }));
    setActiveStatus("Upcoming");
    setPlannerError("");
    setIsComposerOpen(false);
  };

  const updateAttendance = (sessionId, playerId, nextStatus) => {
    setAttendanceBySessionId((current) => {
      const record = current[sessionId] ?? { draft: {}, saved: null, savedAt: null };
      const draft = { ...record.draft };
      if (nextStatus) draft[playerId] = nextStatus;
      else delete draft[playerId];
      return { ...current, [sessionId]: { ...record, draft } };
    });
  };

  const markSessionPresent = (sessionId, players) => {
    const draft = Object.fromEntries(players.map((player) => [player.id, "present"]));
    setAttendanceBySessionId((current) => {
      const record = current[sessionId] ?? { draft: {}, saved: null, savedAt: null };
      return { ...current, [sessionId]: { ...record, draft } };
    });
  };

  const saveAttendancePreview = (sessionId, draft) => {
    setAttendanceBySessionId((current) => {
      const record = current[sessionId] ?? { draft: {}, saved: null, savedAt: null };
      return {
        ...current,
        [sessionId]: {
          ...record,
          saved: { ...draft },
          savedAt: new Date().toISOString(),
        },
      };
    });
  };

  return (
    <section className="coach-training" aria-labelledby="coach-training-title">
      <div className="coach-training__heading">
        <div>
          <p className="coach-training__eyebrow">COACH WORKSPACE / TRAINING</p>
          <h1 id="coach-training-title">Training</h1>
          <p className="coach-training__intro">
            Plan focused sessions for each squad and keep your training organised.
          </p>
        </div>
        <button
          type="button"
          className="coach-training__new-session"
          onClick={() => setIsComposerOpen((isOpen) => !isOpen)}
        >
          <span aria-hidden="true">+</span>
          {isComposerOpen ? "Close session form" : "Plan a session"}
        </button>
      </div>

      <div className="coach-training__preview-note" role="status">
        <span className="coach-training__preview-mark" aria-hidden="true">i</span>
        <p>
          <strong>Design preview.</strong> Session details and activity selections are not saved or
          published yet.
        </p>
      </div>

      <form
        ref={composerRef}
        className="coach-training__composer"
        hidden={!isComposerOpen}
        onSubmit={(event) => event.preventDefault()}
      >
          <div className="coach-training__composer-heading">
            <div>
              <p className="coach-training__eyebrow">SESSION PLANNER</p>
              <h2>New training session</h2>
            </div>
            <span className="coach-training__draft-badge">Draft preview</span>
          </div>

          <div className="coach-training__form-grid">
            <label className="coach-training__field coach-training__field--wide">
              Session title
              <input name="title" type="text" placeholder="e.g. Build-up play and possession" />
            </label>

            <label className="coach-training__field">
              Squad
              <select
                name="squad"
                value={selectedSquad?.id ?? ""}
                onChange={(event) => setSelectedSquadId(event.target.value)}
                disabled={isLoadingSquads}
              >
                <option value="">
                  {isLoadingSquads
                    ? "Loading squads..."
                    : squadsError
                      ? "Squad data unavailable"
                      : squads.length === 0
                        ? "No squads available"
                        : "Select a squad"}
                </option>
                {squads.map((squad) => (
                  <option value={squad.id} key={squad.id}>
                    {squad.ageGroup === "OPEN_SENIOR"
                      ? "Open / Senior"
                      : squad.ageGroup === "OTHER"
                        ? "Other"
                        : squad.ageGroup}
                    {" · "}
                    {squad.teamName}
                  </option>
                ))}
                {!isLoadingSquads && squads.length === 0 && (
                  <option value={demoPreviewSquad.id}>
                    Demo preview squad · no real squad loaded
                  </option>
                )}
              </select>
              {isLoadingSquads && (
                <span className="coach-training__field-hint" role="status">
                  Loading your coach squads...
                </span>
              )}
              {selectedSquad && !isLoadingSquads && (
                <span className="coach-training__selected-squad">
                  Selected squad: {selectedSquad.ageGroup === "OPEN_SENIOR"
                    ? "Open / Senior"
                    : selectedSquad.ageGroup === "OTHER"
                      ? "Other"
                      : selectedSquad.ageGroup}
                  {" · "}
                  {selectedSquad.teamName}
                </span>
              )}
              {!isLoadingSquads && squadsError && squads.length === 0 && (
                <span className="coach-training__field-hint">
                  Squad information could not be loaded. Retry before choosing a squad.
                </span>
              )}
              {!isLoadingSquads && !squadsError && squads.length === 0 && (
                <span className="coach-training__field-hint">
                  No real squad is loaded. You can still create a clearly labelled demo preview
                  session using the demo preview squad.
                </span>
              )}
            </label>

            <label className="coach-training__field">
              Location
              <input name="location" type="text" placeholder="Training ground or pitch" />
            </label>

            <label className="coach-training__field">
              Date
              <input name="date" type="date" />
            </label>

            <div className="coach-training__field-pair">
              <label className="coach-training__field">
                Start time
                <input name="startTime" type="time" />
              </label>
              <label className="coach-training__field">
                End time
                <input name="endTime" type="time" />
              </label>
            </div>

            <label className="coach-training__field coach-training__field--wide">
              Training focus
              <input
                name="focus"
                type="text"
                placeholder="e.g. First touch and quick decision-making"
              />
            </label>

            <label className="coach-training__field coach-training__field--wide">
              Session description
              <textarea
                name="description"
                rows="3"
                placeholder="Add notes about the goals and structure for this session."
              />
            </label>
          </div>

          <fieldset className="coach-training__activity-picker">
            <legend>
              <span className="coach-training__eyebrow">BUILD THE SESSION</span>
              <strong>Training activities</strong>
              <span>Choose one or more activities for this session.</span>
            </legend>
            <div className="coach-training__activity-options">
              {suggestedActivities.map((activity) => {
                const isSelected = selectedActivities.includes(activity.id);
                return (
                  <button
                    className={`coach-training__activity-option${isSelected ? " is-selected" : ""}`}
                    type="button"
                    key={activity.id}
                    aria-pressed={isSelected}
                    onClick={() => toggleActivity(activity.id)}
                  >
                    <span className="coach-training__activity-check" aria-hidden="true">
                      {isSelected ? "✓" : "+"}
                    </span>
                    <span className="coach-training__activity-copy">
                      <strong>{activity.name}</strong>
                      <small>{activity.detail}</small>
                    </span>
                    <span className="coach-training__activity-duration">
                      {activity.durationMinutes} min
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <section className="coach-training__selected-activities" aria-labelledby="selected-activities-title">
            <div className="coach-training__selected-heading">
              <div>
                <p className="coach-training__eyebrow">SESSION CONTENT</p>
                <h3 id="selected-activities-title">Selected Activities</h3>
              </div>
              <span className="coach-training__selected-count">
                {selectedActivityDetails.length} selected
              </span>
            </div>

            {selectedActivityDetails.length > 0 ? (
              <>
                <ul className="coach-training__selected-list">
                  {selectedActivityDetails.map((activity) => (
                    <li className="coach-training__selected-item" key={activity.id}>
                      <div className="coach-training__selected-item-content">
                        <span className="coach-training__selected-name">{activity.name}</span>
                        <span className="coach-training__selected-duration">
                          {activity.durationMinutes} min
                        </span>
                        <button
                          type="button"
                          aria-label={`Edit duration for ${activity.name}`}
                          onClick={() => startEditingDuration(activity)}
                        >
                          Edit duration
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove ${activity.name}`}
                          onClick={() => toggleActivity(activity.id)}
                        >
                          Remove
                        </button>
                      </div>
                      {editingActivityId === activity.id && (
                        <div
                          className="coach-training__duration-editor"
                          role="group"
                          aria-label={`Edit ${activity.name} duration`}
                        >
                          <label htmlFor={`activity-duration-${activity.id}`}>
                            Duration in minutes
                          </label>
                          <div className="coach-training__duration-editor-controls">
                            <input
                              id={`activity-duration-${activity.id}`}
                              type="number"
                              min="1"
                              step="1"
                              inputMode="numeric"
                              value={durationDraft}
                              aria-invalid={!durationIsValid}
                              onChange={(event) => setDurationDraft(event.target.value)}
                            />
                            <button
                              type="button"
                              disabled={!durationIsValid}
                              onClick={(event) => saveActivityDuration(event, activity.id)}
                            >
                              Save
                            </button>
                            <button type="button" onClick={cancelDurationEdit}>Cancel</button>
                          </div>
                          {!durationIsValid && (
                            <span className="coach-training__duration-error" role="status">
                              Enter a positive whole number of minutes.
                            </span>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="coach-training__selected-total">
                  <span>Total activity duration</span>
                  <strong>{formatDuration(totalActivityMinutes)}</strong>
                </div>
              </>
            ) : (
              <p className="coach-training__selected-empty">
                No activities selected yet. Choose suggested activities above to build this
                session.
              </p>
            )}
          </section>

          <div className="coach-training__composer-footer">
            <p>
              Add a local-only session preview to exercise attendance. Real saving and publishing
              remain disabled until the training service is connected.
            </p>
            <div className="coach-training__composer-actions">
              <button
                type="button"
                className="coach-training__preview-session-button"
                onClick={addPreviewSession}
              >
                Add to preview schedule
              </button>
              <button type="button" className="coach-training__save-button" disabled>
                Save session
              </button>
            </div>
          </div>
          {plannerError && (
            <p className="coach-training__planner-error" role="alert">{plannerError}</p>
          )}
      </form>

      {isAttendanceOpen && selectedAttendanceSession ? (
        <AttendanceChecker
          key={selectedAttendanceSession.id}
          session={selectedAttendanceSession}
          sessions={previewSessions}
          record={attendanceBySessionId[selectedAttendanceSession.id]}
          onChangeSession={setSelectedAttendanceSessionId}
          onChangeStatus={updateAttendance}
          onMarkAllPresent={markSessionPresent}
          onSave={saveAttendancePreview}
          onClose={() => setIsAttendanceOpen(false)}
        />
      ) : (
        <div className="coach-training__session-panel">
        <div className="coach-training__session-heading">
          <div>
            <p className="coach-training__eyebrow">YOUR SCHEDULE</p>
            <h2>Training sessions</h2>
          </div>
          <span className="coach-training__session-count">Schedule not connected</span>
        </div>

        <div className="coach-training__status-tabs" aria-label="Session status">
          {sessionStatuses.map((status) => (
            <button
              type="button"
              aria-pressed={activeStatus === status}
              className={activeStatus === status ? "is-active" : ""}
              key={status}
              onClick={() => setActiveStatus(status)}
            >
              {status}
            </button>
          ))}
        </div>

        {squadsError && (
          <div className="coach-training__squad-error" role="alert">
            <span>
              {squads.length > 0
                ? `Could not refresh squad information. Previously loaded squads remain available. ${squadsError}`
                : squadsError}
            </span>
            <button type="button" onClick={onRetrySquads}>Try again</button>
          </div>
        )}

        {visibleSessions.length > 0 ? (
          <div className="coach-training__preview-sessions">
            {visibleSessions.map((session) => {
              const record = attendanceBySessionId[session.id];
              return (
                <article className="coach-training__preview-session" key={session.id}>
                  <div className="coach-training__preview-session-heading">
                    <div>
                      <p className="coach-training__eyebrow">LOCAL PREVIEW SESSION</p>
                      <h3>{session.title}</h3>
                    </div>
                    <span className="coach-training__draft-badge">Preview only</span>
                  </div>
                  <div className="coach-training__preview-session-details">
                    <span>{formatSessionDate(session.date)}</span>
                    {session.startTime && (
                      <span>
                        {session.startTime}
                        {session.endTime ? `–${session.endTime}` : ""}
                      </span>
                    )}
                    <span>{session.squadAgeGroup === "DEMO" ? "Demo" : session.squadAgeGroup} · {session.squadName}</span>
                    <span>{previewRosterTemplate.length} fictional demo players</span>
                  </div>
                  <div className="coach-training__preview-session-footer">
                    <span className="coach-training__attendance-record-status">
                      Attendance: {getAttendanceRecordStatus(record)}
                    </span>
                    <button
                      type="button"
                      className="coach-training__attendance-open"
                      onClick={() => {
                        setSelectedAttendanceSessionId(session.id);
                        setIsAttendanceOpen(true);
                      }}
                    >
                      {record?.savedAt ? "Review / correct attendance" : "Open attendance checker"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="coach-training__empty-state">
            <span className="coach-training__empty-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="3.5" y="5" width="17" height="16" rx="2" />
                <path d="M7.5 3v4m9-4v4M3.5 9.5h17M8 14h3m2 0h3m-8 3h3" />
              </svg>
            </span>
            <h3>No {activeStatus.toLowerCase()} sessions in this preview</h3>
            <p>
              Training sessions will appear here when session management is connected. You can
              create local-only preview sessions to exercise attendance; nothing is published.
            </p>
            {!isComposerOpen && (
              <button
                type="button"
                className="coach-training__empty-action"
                onClick={() => setIsComposerOpen(true)}
              >
                Preview session planner
              </button>
            )}
          </div>
        )}
      </div>
      )}
    </section>
  );
}

function AttendanceChecker({
  session,
  sessions,
  record,
  onChangeSession,
  onChangeStatus,
  onMarkAllPresent,
  onSave,
  onClose,
}) {
  const [search, setSearch] = useState("");
  const [isConfirmingSave, setIsConfirmingSave] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");
  const players = getPreviewRoster(session.squadId);
  const draft = record?.draft ?? {};
  const counts = attendanceStatuses.reduce(
    (current, status) => ({
      ...current,
      [status.value]: players.filter((player) => draft[player.id] === status.value).length,
    }),
    {},
  );
  const markedCount = Object.values(counts).reduce((total, count) => total + count, 0);
  const notMarkedCount = players.length - markedCount;
  const attendancePercentage = players.length
    ? Math.round((counts.present / players.length) * 100)
    : 0;
  const isSaved = attendanceIsSaved(record);
  const matchingPlayers = players.filter((player) => {
    const query = search.trim().toLowerCase();
    return !query
      || player.name.toLowerCase().includes(query)
      || String(player.jerseyNumber).includes(query);
  });

  const requestSave = () => {
    if (notMarkedCount > 0) {
      setValidationMessage(
        `Mark all ${players.length} preview players before saving. ${notMarkedCount} still need a status.`,
      );
      return;
    }
    setValidationMessage("");
    setIsConfirmingSave(true);
  };

  const confirmSave = () => {
    onSave(session.id, draft);
    setIsConfirmingSave(false);
  };

  return (
    <section className="coach-training__attendance" aria-labelledby="attendance-title">
      <div className="coach-training__attendance-header">
        <div>
          <p className="coach-training__eyebrow">SESSION ATTENDANCE / PREVIEW</p>
          <h2 id="attendance-title">{session.title}</h2>
        </div>
        <button
          type="button"
          className="coach-training__attendance-back"
          onClick={onClose}
        >
          Back to sessions
        </button>
      </div>

      <div className="coach-training__attendance-preview-note" role="status">
        <strong>Demo roster only.</strong>
        <span>
          All four players below are fictional demo entries, not registered players. The real
          squad roster will appear when player integration is connected.
        </span>
      </div>

      <div className="coach-training__attendance-context">
        <label className="coach-training__attendance-session-picker">
          Select training session
          <select
            value={session.id}
            onChange={(event) => onChangeSession(event.target.value)}
          >
            {sessions.map((item) => (
              <option value={item.id} key={item.id}>
                {item.title} · {formatSessionDate(item.date)}
              </option>
            ))}
          </select>
        </label>
        <div className="coach-training__attendance-context-item">
          <span>Session date</span>
          <strong>
            {formatSessionDate(session.date)}
            {session.startTime ? ` · ${session.startTime}` : ""}
          </strong>
        </div>
        <div className="coach-training__attendance-context-item">
          <span>Selected squad</span>
          <strong>{session.squadAgeGroup} · {session.squadName}</strong>
        </div>
        <div className="coach-training__attendance-context-item">
          <span>Expected players</span>
          <strong>{players.length} preview entries</strong>
        </div>
        <div className="coach-training__attendance-context-item">
          <span>Recording status</span>
          <strong>{getAttendanceRecordStatus(record)}</strong>
        </div>
      </div>

      <div className="coach-training__attendance-summary" aria-live="polite">
        <div className="coach-training__attendance-stat coach-training__attendance-stat--total">
          <span>Expected</span>
          <strong>{players.length}</strong>
          <small>preview players</small>
        </div>
        {attendanceStatuses.map((status) => (
          <div
            className={`coach-training__attendance-stat coach-training__attendance-stat--${status.value}`}
            key={status.value}
          >
            <span>{status.label}</span>
            <strong>{counts[status.value]}</strong>
          </div>
        ))}
        <div className="coach-training__attendance-stat coach-training__attendance-stat--unmarked">
          <span>Not marked</span>
          <strong>{notMarkedCount}</strong>
        </div>
        <div className="coach-training__attendance-stat coach-training__attendance-stat--percentage">
          <span>Present rate</span>
          <strong>{attendancePercentage}%</strong>
        </div>
      </div>

      <div className="coach-training__attendance-toolbar">
        <label className="coach-training__attendance-search">
          Search players
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search demo player name or jersey number"
          />
        </label>
        <button
          type="button"
          className="coach-training__mark-present"
          onClick={() => {
            onMarkAllPresent(session.id, players);
            setValidationMessage("");
          }}
        >
          Mark all present
        </button>
      </div>

      <div className="coach-training__player-list">
        <div className="coach-training__demo-roster-heading">
          <strong>Fictional demo players</strong>
          <span>{matchingPlayers.length} of {players.length} shown</span>
        </div>
        {matchingPlayers.length > 0 ? matchingPlayers.map((player) => {
          const status = draft[player.id] ?? "";
          return (
            <article className="coach-training__player-row" key={player.id}>
              <div className="coach-training__player-identity">
                <span className="coach-training__player-avatar" aria-hidden="true">
                  {player.initials}
                </span>
                <span className="coach-training__player-copy">
                  <strong>{player.name}</strong>
                  <small>Jersey #{player.jerseyNumber} · preview entry</small>
                </span>
              </div>
              <span className="coach-training__player-number" aria-hidden="true">
                #{player.jerseyNumber}
              </span>
              <label className="coach-training__player-status">
                <span className="coach-training__visually-hidden">Attendance status</span>
                <select
                  aria-label={`Attendance status for ${player.name}`}
                  className="coach-training__attendance-select"
                  data-status={status || "unmarked"}
                  value={status}
                  onChange={(event) => {
                    onChangeStatus(session.id, player.id, event.target.value);
                    setValidationMessage("");
                  }}
                >
                  <option value="">Not marked</option>
                  {attendanceStatuses.map((option) => (
                    <option value={option.value} key={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </article>
          );
        }) : (
          <p className="coach-training__player-search-empty">
            No preview players match "{search}".
          </p>
        )}
      </div>

      <div className="coach-training__attendance-footer">
        <div>
          <p>Changes are held in this page preview only; nothing is sent to Neon.</p>
          {validationMessage && (
            <span className="coach-training__attendance-validation" role="alert">
              {validationMessage}
            </span>
          )}
        </div>
        <button
          type="button"
          className="coach-training__attendance-save"
          disabled={isSaved}
          onClick={requestSave}
        >
          {isSaved
            ? "Preview saved"
            : record?.savedAt
              ? "Save preview corrections"
              : "Save preview attendance"}
        </button>
      </div>

      {isConfirmingSave && (
        <div className="coach-training__confirm-backdrop">
          <div
            className="coach-training__confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="attendance-confirm-title"
            aria-describedby="attendance-confirm-description"
          >
            <p className="coach-training__eyebrow">PREVIEW CONFIRMATION</p>
            <h3 id="attendance-confirm-title">Save attendance preview?</h3>
            <p id="attendance-confirm-description">
              This records the current statuses for {session.title} in this page preview only.
              It will not be stored on the server or in Neon.
            </p>
            <div className="coach-training__confirm-actions">
              <button type="button" onClick={() => setIsConfirmingSave(false)}>
                Keep editing
              </button>
              <button type="button" onClick={confirmSave}>
                Confirm preview save
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default CoachTraining;
