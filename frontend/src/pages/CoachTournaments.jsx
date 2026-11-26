import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createTournament,
  listTournaments,
  publishTournament,
  uploadTournamentBanner,
  updateTournament,
} from "../services/coach";
import {
  BannerUploadPendingError,
  saveTournamentWithBanner,
} from "../services/tournamentSave";
import "./CoachTournaments.css";

const tournamentStatuses = [
  "All Tournaments",
  "Draft",
  "Published",
  "In Progress",
  "Upcoming",
  "Ongoing",
  "Completed",
  "Archived",
];
const tournamentFormats = [
  {
    value: "League",
    title: "League",
    description: "Teams play a series of matches and standings decide the winner.",
  },
  {
    value: "Knockout",
    title: "Knockout",
    description: "Teams are eliminated after a loss until a champion remains.",
  },
  {
    value: "Groups + Knockout",
    title: "Groups + Knockout",
    description: "Group-stage matches lead into a knockout final phase.",
  },
];

function getTournamentStatus(tournament) {
  const now = new Date();
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  if (tournament.endDate < today) return "Completed";
  if (tournament.startDate <= today) return "Ongoing";
  return "Upcoming";
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateRange(startDate, endDate) {
  return `${formatDate(startDate)} – ${formatDate(endDate)}`;
}

function getLifecycleLabel(status) {
  return {
    draft: "Draft",
    published: "Published",
    in_progress: "In Progress",
    completed: "Completed",
    archived: "Archived",
  }[status] || status;
}

function getStatusClassName(status) {
  return status.toLowerCase().replaceAll(" ", "-");
}

function matchesTournamentFilter(tournament, filter) {
  if (filter === "All Tournaments") return true;
  if (filter === "Draft") return tournament.status === "draft";
  if (filter === "Published") return tournament.status === "published";
  if (filter === "In Progress") return tournament.status === "in_progress";
  if (filter === "Archived") return tournament.status === "archived";
  return tournament.competitionStatus === filter;
}

function CoachTournaments({ coach, getToken }) {
  const navigate = useNavigate();
  const formRef = useRef(null);
  const loadRequestId = useRef(0);
  const mutationInProgress = useRef(false);
  const [tournaments, setTournaments] = useState([]);
  const [activeStatus, setActiveStatus] = useState("All Tournaments");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewPayload, setReviewPayload] = useState(null);
  const [reviewError, setReviewError] = useState("");
  const [editingTournamentId, setEditingTournamentId] = useState("");
  const [bannerRetryTournamentId, setBannerRetryTournamentId] = useState("");
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [publishError, setPublishError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [publishingTournamentId, setPublishingTournamentId] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!bannerPreview) return undefined;
    return () => URL.revokeObjectURL(bannerPreview);
  }, [bannerPreview]);

  const loadTournamentList = useCallback(async () => {
    const requestId = ++loadRequestId.current;
    try {
      const token = await getToken();
      if (requestId !== loadRequestId.current) return;
      setIsLoading(true);
      setLoadError("");
      const records = await listTournaments(token);
      if (requestId === loadRequestId.current) setTournaments(records);
    } catch (error) {
      if (requestId === loadRequestId.current) {
        setLoadError(error.message || "Tournaments could not be loaded.");
      }
    } finally {
      if (requestId === loadRequestId.current) setIsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    const requestId = ++loadRequestId.current;
    let active = true;
    const loadInitialTournaments = async () => {
      try {
        const token = await getToken();
        const records = await listTournaments(token);
        if (active && requestId === loadRequestId.current) setTournaments(records);
      } catch (error) {
        if (active && requestId === loadRequestId.current) {
          setLoadError(error.message || "Tournaments could not be loaded.");
        }
      } finally {
        if (active && requestId === loadRequestId.current) setIsLoading(false);
      }
    };
    loadInitialTournaments();
    return () => {
      active = false;
      loadRequestId.current += 1;
    };
  }, [getToken]);

  const tournamentsWithStatus = useMemo(
    () => tournaments.map((tournament) => ({
      ...tournament,
      lifecycleLabel: getLifecycleLabel(tournament.status),
      competitionStatus: getTournamentStatus(tournament),
    })),
    [tournaments],
  );
  const visibleTournaments = tournamentsWithStatus.filter((tournament) => (
    matchesTournamentFilter(tournament, activeStatus)
  ));
  const editingTournament = tournaments.find(
    (tournament) => tournament.id === editingTournamentId,
  );
  const counts = {
    total: tournamentsWithStatus.length,
    Upcoming: tournamentsWithStatus.filter((item) => item.competitionStatus === "Upcoming").length,
    Ongoing: tournamentsWithStatus.filter((item) => item.competitionStatus === "Ongoing").length,
    Completed: tournamentsWithStatus.filter((item) => item.competitionStatus === "Completed").length,
  };

  const handleBannerChange = (event) => {
    const file = event.target.files?.[0] ?? null;
    setFormError("");
    if (!file) {
      setBannerFile(null);
      setBannerPreview("");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setFormError("Choose an image file for the tournament banner.");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormError("The tournament image must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  };

  const clearBanner = () => {
    setBannerFile(null);
    setBannerPreview("");
    const input = formRef.current?.querySelector('input[name="banner"]');
    if (input) input.value = "";
  };

  const handleCancel = () => {
    formRef.current?.reset();
    clearBanner();
    setFormError("");
    setReviewError("");
    setReviewPayload(null);
    setIsReviewOpen(false);
    setBannerRetryTournamentId("");
    setEditingTournamentId("");
    setIsFormOpen(false);
  };

  const handleContinueToReview = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const location = String(formData.get("location") ?? "").trim();
    const startDate = String(formData.get("startDate") ?? "");
    const endDate = String(formData.get("endDate") ?? "");
    const registrationDeadline = String(formData.get("registrationDeadline") ?? "");
    const maxTeams = Number(formData.get("maxTeams"));

    if (name.length < 2) {
      setFormError("Enter a tournament name with at least two characters.");
      return;
    }
    if (!location) {
      setFormError("Enter a tournament location.");
      return;
    }
    if (endDate < startDate) {
      setFormError("The end date must be on or after the start date.");
      return;
    }
    if (registrationDeadline > startDate) {
      setFormError("The registration deadline must be on or before the start date.");
      return;
    }
    if (!Number.isSafeInteger(maxTeams) || maxTeams < 2 || maxTeams > 256) {
      setFormError("Set a maximum between 2 and 256 participating teams.");
      return;
    }

    const payload = {
      name,
      location,
      startDate,
      endDate,
      registrationDeadline,
      ageCategory: String(formData.get("ageCategory") ?? ""),
      maxTeams,
      format: String(formData.get("format") ?? ""),
      description: String(formData.get("description") ?? "").trim() || null,
      organizerContact: String(formData.get("organizerContact") ?? "").trim() || null,
    };

    setFormError("");
    setReviewError("");
    setReviewPayload(payload);
    setIsReviewOpen(true);
  };

  const handleConfirmSave = async () => {
    if (!reviewPayload || mutationInProgress.current) return;
    const isEditing = Boolean(editingTournamentId);
    setReviewError("");
    setNotice("");
    mutationInProgress.current = true;
    setIsSaving(true);
    try {
      const token = await getToken();
      const saved = await saveTournamentWithBanner({
        tournamentId: editingTournamentId,
        retryTournamentId: bannerRetryTournamentId,
        payload: reviewPayload,
        bannerFile,
        token,
        create: createTournament,
        update: updateTournament,
        upload: uploadTournamentBanner,
      });
      setTournaments((current) => {
        if (current.some((item) => item.id === saved.id)) {
          return current.map((item) => (item.id === saved.id ? saved : item));
        }
        return [saved, ...current.filter((item) => item.id !== saved.id)];
      });
      setActiveStatus("All Tournaments");
      setNotice(bannerFile
        ? `${saved.name} draft and banner were saved.`
        : isEditing
          ? `${saved.name} draft changes were saved.`
          : `${saved.name} was saved as a draft.`);
      formRef.current?.reset();
      clearBanner();
      setReviewPayload(null);
      setReviewError("");
      setIsReviewOpen(false);
      setBannerRetryTournamentId("");
      setEditingTournamentId("");
      setIsFormOpen(false);
    } catch (error) {
      if (error instanceof BannerUploadPendingError) {
        setTournaments((current) => {
          if (current.some((item) => item.id === error.tournament.id)) {
            return current.map((item) => (
              item.id === error.tournament.id ? error.tournament : item
            ));
          }
          return [error.tournament, ...current];
        });
        setEditingTournamentId(error.tournament.id);
        setBannerRetryTournamentId(error.tournament.id);
        setReviewError(
          `${error.tournament.name} draft was saved, but the banner upload needs to be retried. ${error.cause?.message || "Use Retry Banner Upload to try again."}`,
        );
      } else if (bannerRetryTournamentId) {
        setReviewError(
          `The tournament draft is saved, but its banner upload still needs to be retried. ${error.message || "Try again."}`,
        );
      } else {
        setReviewError(error.message || "The tournament could not be saved. Please try again.");
      }
    } finally {
      mutationInProgress.current = false;
      setIsSaving(false);
    }
  };

  const beginEditing = (tournament) => {
    if (tournament.status !== "draft" || isSaving || publishingTournamentId) return;
    setNotice("");
    setFormError("");
    setReviewError("");
    setReviewPayload(null);
    setIsReviewOpen(false);
    setBannerRetryTournamentId("");
    setEditingTournamentId(tournament.id);
    setIsFormOpen(true);
    clearBanner();
  };

  const handlePublish = async (tournament) => {
    if (tournament.status !== "draft" || mutationInProgress.current || isSaving || publishingTournamentId) return;
    setNotice("");
    setPublishError("");
    mutationInProgress.current = true;
    setPublishingTournamentId(tournament.id);
    try {
      const token = await getToken();
      const published = await publishTournament(tournament.id, token);
      setTournaments((current) => current.map((item) => (
        item.id === published.id ? published : item
      )));
      setNotice(`${published.name} was published.`);
    } catch (error) {
      setPublishError(error.message || "The tournament could not be published.");
    } finally {
      mutationInProgress.current = false;
      setPublishingTournamentId("");
    }
  };

  return (
    <section className="coach-tournaments" aria-labelledby="coach-tournaments-title">
      <header className="coach-tournaments__header">
        <div>
          <p className="coach-tournaments__breadcrumb">COACH WORKSPACE / TOURNAMENTS</p>
          <h1 id="coach-tournaments-title">Tournaments</h1>
          <p className="coach-tournaments__intro">
            Organise competitions, set tournament formats and keep every event on track.
          </p>
        </div>
        {!isReviewOpen && (
          <button
            type="button"
            className="coach-tournaments__primary-button"
            onClick={() => {
              if (isFormOpen) {
                handleCancel();
                return;
              }
              setEditingTournamentId("");
              setReviewPayload(null);
              setReviewError("");
              setIsReviewOpen(false);
              setFormError("");
              setNotice("");
              setIsFormOpen(true);
            }}
            disabled={isLoading || isSaving || Boolean(publishingTournamentId)}
          >
            <span aria-hidden="true">+</span>
            {isFormOpen ? "Close form" : "Create Tournament"}
          </button>
        )}
      </header>

      <div className="coach-tournaments__preview-notice" role="status">
        <strong>Tournament banners upload after confirmation.</strong>
        <span>The selected image stays a local preview until the tournament draft is saved.</span>
      </div>

      {notice && (
        <p className="coach-tournaments__success" role="status">{notice}</p>
      )}

      {!isReviewOpen && (
        <section className="coach-tournaments__overview" aria-label="Tournament overview">
          <OverviewCard label="Total Tournaments" value={counts.total} detail="saved tournaments" />
          <OverviewCard label="Upcoming" value={counts.Upcoming} detail="not started yet" />
          <OverviewCard label="Ongoing" value={counts.Ongoing} detail="currently running" />
          <OverviewCard label="Completed" value={counts.Completed} detail="finished events" />
        </section>
      )}

      {isFormOpen && (
        <>
          <form
            ref={formRef}
            key={editingTournamentId || "new-tournament"}
            className="coach-tournaments__form"
            onSubmit={handleContinueToReview}
            hidden={isReviewOpen}
          >
          <div className="coach-tournaments__section-heading">
            <div>
              <p className="coach-tournaments__eyebrow">TOURNAMENT SETUP</p>
              <h2>{editingTournament ? "Edit draft tournament" : "Create a tournament"}</h2>
            </div>
            <span className="coach-tournaments__preview-badge">Saved as draft</span>
          </div>

          <div className="coach-tournaments__form-grid">
            <label className="coach-tournaments__field coach-tournaments__field--wide">
              Tournament name
              <input
                name="name"
                type="text"
                required
                minLength="2"
                maxLength="100"
                defaultValue={editingTournament?.name ?? ""}
                placeholder="e.g. ELEVN Youth Cup"
              />
            </label>

            <div className="coach-tournaments__field coach-tournaments__field--wide">
              <span>Tournament logo or banner <span className="coach-tournaments__optional">(optional)</span></span>
              <small className="coach-tournaments__field-hint">
                Preview only. The image is not uploaded or saved.
              </small>
              <label className="coach-tournaments__upload">
                <input
                  name="banner"
                  type="file"
                  accept="image/*"
                  onChange={handleBannerChange}
                  aria-label="Upload tournament logo or banner"
                />
                <span>{bannerFile ? "Choose a different image" : "Choose an image (up to 5 MB)"}</span>
              </label>
              {bannerPreview && (
                <div className="coach-tournaments__banner-preview">
                  <img src={bannerPreview} alt="Tournament banner preview" />
                  <button type="button" onClick={clearBanner}>Remove image</button>
                </div>
              )}
            </div>

            <label className="coach-tournaments__field">
              Location
              <input
                name="location"
                type="text"
                required
                maxLength="120"
                defaultValue={editingTournament?.location ?? ""}
                placeholder="City, venue or ground"
              />
            </label>
            <label className="coach-tournaments__field">
              Age category
              <select name="ageCategory" required defaultValue={editingTournament?.ageCategory ?? ""}>
                <option value="" disabled>Select age category</option>
                {["U9", "U10", "U11", "U12", "U13", "U14", "U15", "U16", "U17", "U18", "U19", "Open / Senior", "Mixed / Other"].map((item) => (
                  <option value={item} key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="coach-tournaments__field">
              Start date
              <input name="startDate" type="date" required defaultValue={editingTournament?.startDate ?? ""} />
            </label>
            <label className="coach-tournaments__field">
              End date
              <input
                name="endDate"
                type="date"
                required
                defaultValue={editingTournament?.endDate ?? ""}
              />
            </label>
            <label className="coach-tournaments__field">
              Registration deadline
              <input
                name="registrationDeadline"
                type="date"
                required
                defaultValue={editingTournament?.registrationDeadline ?? ""}
              />
            </label>
            <label className="coach-tournaments__field">
              Maximum participating teams
              <input
                name="maxTeams"
                type="number"
                min="2"
                max="256"
                step="1"
                required
                defaultValue={editingTournament?.maxTeams ?? ""}
                placeholder="e.g. 16"
              />
            </label>
          </div>

          <fieldset className="coach-tournaments__format-picker">
            <legend>Tournament format</legend>
            <div className="coach-tournaments__format-grid">
              {tournamentFormats.map((format) => (
                <label className="coach-tournaments__format-option" key={format.value}>
                  <input
                    type="radio"
                    name="format"
                    value={format.value}
                    required
                    defaultChecked={editingTournament
                      ? format.value === editingTournament.format
                      : format.value === "League"}
                  />
                  <span className="coach-tournaments__format-card">
                    <strong>{format.title}</strong>
                    <small>{format.description}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="coach-tournaments__form-grid">
            <label className="coach-tournaments__field coach-tournaments__field--wide">
              Tournament rules / description <span className="coach-tournaments__optional">(optional)</span>
              <textarea
                name="description"
                rows="4"
                maxLength="2000"
                defaultValue={editingTournament?.description ?? ""}
                placeholder="Add tournament rules, eligibility and other details."
              />
            </label>
            <div className="coach-tournaments__field">
              Organizer
              <div className="coach-tournaments__organizer">
                <strong>{coach?.fullName || "Coach profile unavailable"}</strong>
                <small>From your coach profile</small>
              </div>
            </div>
            <label className="coach-tournaments__field">
              Organizer contact <span className="coach-tournaments__optional">(optional)</span>
              <input
                name="organizerContact"
                type="text"
                maxLength="160"
                defaultValue={editingTournament?.organizerContact ?? ""}
                placeholder="Email or phone number"
              />
            </label>
          </div>

          {formError && <p className="coach-tournaments__error" role="alert">{formError}</p>}

          <div className="coach-tournaments__form-actions">
            <p>{editingTournament
              ? "Only draft tournaments can be edited. Saving keeps this tournament as a draft."
              : "New tournaments are saved as drafts and are not published automatically."}</p>
            <div>
              <button
                type="button"
                className="coach-tournaments__secondary-button"
                onClick={handleCancel}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button type="submit" className="coach-tournaments__primary-button">
                Continue
              </button>
            </div>
          </div>
          </form>
          {isReviewOpen && reviewPayload && (
            <TournamentReview
              payload={reviewPayload}
              bannerPreview={bannerPreview}
              bannerName={bannerFile?.name}
              isEditing={Boolean(editingTournamentId)}
              bannerRetryPending={Boolean(bannerRetryTournamentId)}
              isSaving={isSaving}
              error={reviewError}
              onBack={() => {
                setReviewError("");
                setBannerRetryTournamentId("");
                setIsReviewOpen(false);
              }}
              onConfirm={handleConfirmSave}
            />
          )}
        </>
      )}

      {!isReviewOpen && (
        <section className="coach-tournaments__list-panel" aria-labelledby="my-tournaments-title">
        <div className="coach-tournaments__list-heading">
          <div>
            <p className="coach-tournaments__eyebrow">COMPETITIONS</p>
            <h2 id="my-tournaments-title">My Tournaments</h2>
          </div>
          <span className="coach-tournaments__preview-badge">Server-saved tournaments</span>
        </div>

        <div className="coach-tournaments__status-tabs" aria-label="Filter tournaments by status">
          {tournamentStatuses.map((status) => (
            <button
              type="button"
              key={status}
              aria-pressed={activeStatus === status}
              className={activeStatus === status ? "is-active" : ""}
              onClick={() => setActiveStatus(status)}
            >
              {status}
            </button>
          ))}
        </div>

        {loadError && (
          <div className="coach-tournaments__request-error" role="alert">
            <span>{loadError}</span>
            <button type="button" className="coach-tournaments__secondary-button" onClick={loadTournamentList} disabled={isLoading}>
              {isLoading ? "Retrying..." : "Retry"}
            </button>
          </div>
        )}
        {publishError && <p className="coach-tournaments__error" role="alert">{publishError}</p>}
        {isLoading && tournaments.length > 0 && (
          <p className="coach-tournaments__loading" role="status">Refreshing tournaments...</p>
        )}

        {isLoading && !tournaments.length ? (
          <p className="coach-tournaments__loading" role="status">Loading tournaments...</p>
        ) : visibleTournaments.length ? (
          <div className="coach-tournaments__cards">
            {visibleTournaments.map((tournament) => (
              <TournamentCard
                key={tournament.id}
                tournament={tournament}
                onView={() => {
                  setIsFormOpen(false);
                  setEditingTournamentId("");
                  navigate(`/coach/tournaments/${encodeURIComponent(tournament.id)}`);
                }}
                onEdit={() => beginEditing(tournament)}
                onPublish={() => handlePublish(tournament)}
                isPublishing={publishingTournamentId === tournament.id}
                actionsDisabled={isSaving || Boolean(publishingTournamentId)}
              />
            ))}
          </div>
        ) : !tournaments.length && !loadError ? (
          <div className="coach-tournaments__empty">
            <span className="coach-tournaments__empty-mark" aria-hidden="true">✦</span>
            <h3>No tournaments yet</h3>
            <p>Create a tournament to see its schedule, format and team capacity here.</p>
            <button
              type="button"
              className="coach-tournaments__secondary-button"
              onClick={() => {
                setEditingTournamentId("");
                setIsFormOpen(true);
              }}
            >
              Create your first tournament
            </button>
          </div>
        ) : (
          <div className="coach-tournaments__empty">
            <span className="coach-tournaments__empty-mark" aria-hidden="true">✦</span>
            <h3>No {activeStatus.toLowerCase()} tournaments</h3>
            <p>Try another lifecycle or competition-status filter.</p>
          </div>
        )}
        </section>
      )}
    </section>
  );
}

function OverviewCard({ label, value, detail }) {
  return (
    <article className="coach-tournaments__overview-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function TournamentReview({
  payload,
  bannerPreview,
  bannerName,
  isEditing,
  bannerRetryPending,
  isSaving,
  error,
  onBack,
  onConfirm,
}) {
  return (
    <section className="coach-tournaments__review" aria-labelledby="tournament-review-title">
      <header className="coach-tournaments__review-heading">
        <div>
          <p className="coach-tournaments__eyebrow">FINAL CHECK</p>
          <h2 id="tournament-review-title">Review &amp; Confirmation</h2>
          <p>Check the details before saving this tournament as a draft.</p>
        </div>
        <span className="coach-tournaments__preview-badge">
          {isEditing ? "Draft changes" : "New draft"}
        </span>
      </header>

      <div className="coach-tournaments__review-sections">
        <section className="coach-tournaments__review-section">
          <h3>Tournament Information</h3>
          <div className="coach-tournaments__review-grid">
            <ReviewField label="Tournament name" value={payload.name} />
            <ReviewField label="Location" value={payload.location} />
            <ReviewField label="Age category" value={payload.ageCategory} />
            <ReviewField label="Tournament format" value={payload.format} />
            <ReviewField
              label="Description"
              value={payload.description}
              fallback="Not provided (optional)"
              isMultiline
            />
          </div>
        </section>

        <section className="coach-tournaments__review-section">
          <h3>Tournament Schedule</h3>
          <div className="coach-tournaments__review-grid">
            <ReviewField label="Start date" value={formatDate(payload.startDate)} />
            <ReviewField label="End date" value={formatDate(payload.endDate)} />
            <ReviewField
              label="Registration deadline"
              value={formatDate(payload.registrationDeadline)}
            />
          </div>
        </section>

        <section className="coach-tournaments__review-section">
          <h3>Registration Capacity</h3>
          <div className="coach-tournaments__review-grid">
            <ReviewField label="Maximum number of teams" value={`${payload.maxTeams} teams`} />
          </div>
        </section>

        <section className="coach-tournaments__review-section">
          <h3>Organizer Information</h3>
          <div className="coach-tournaments__review-grid">
            <ReviewField
              label="Organizer contact"
              value={payload.organizerContact}
              fallback="Not provided (optional)"
            />
          </div>
        </section>

        <section className="coach-tournaments__review-section coach-tournaments__review-section--banner">
          <h3>Tournament Banner</h3>
          {bannerPreview ? (
            <div className="coach-tournaments__review-banner">
              <img src={bannerPreview} alt="Selected tournament banner preview" />
              {bannerName && <span>{bannerName}</span>}
            </div>
          ) : (
            <p className="coach-tournaments__review-empty">No banner selected.</p>
          )}
          <p className="coach-tournaments__review-note">
            This local preview will be uploaded after you confirm the draft.
          </p>
        </section>
      </div>

      {error && <p className="coach-tournaments__error" role="alert">{error}</p>}

      <div className="coach-tournaments__review-actions">
        <p>{bannerRetryPending
          ? "The tournament draft is already saved. Retry uploads the selected banner to that same draft."
          : isEditing
          ? "Confirming saves these changes to your draft. It will remain unpublished."
          : "Confirming creates a draft only. It will not be published."}</p>
        <div>
          <button
            type="button"
            className="coach-tournaments__secondary-button"
            onClick={onBack}
            disabled={isSaving}
          >
            Back to Edit
          </button>
          <button
            type="button"
            className="coach-tournaments__primary-button"
            onClick={onConfirm}
            disabled={isSaving}
          >
            {isSaving
              ? "Saving..."
              : bannerRetryPending
                ? "Retry Banner Upload"
              : isEditing
                ? "Confirm & Save Draft Changes"
                : "Confirm & Save as Draft"}
          </button>
        </div>
      </div>
    </section>
  );
}

function ReviewField({ label, value, fallback = "Not provided", isMultiline = false }) {
  const hasValue = value !== null && value !== undefined && String(value).trim() !== "";
  return (
    <div className="coach-tournaments__review-field">
      <span>{label}</span>
      <strong className={isMultiline ? "is-multiline" : ""}>
        {hasValue ? value : fallback}
      </strong>
    </div>
  );
}

function TournamentCard({
  tournament,
  onView,
  onEdit,
  onPublish,
  isPublishing,
  actionsDisabled,
}) {
  const isDraft = tournament.status === "draft";
  return (
    <article className="coach-tournaments__card">
      <div className="coach-tournaments__card-banner">
        <span aria-hidden="true">ELEVN CUP</span>
        <span className={`coach-tournaments__status is-${getStatusClassName(tournament.lifecycleLabel)}`}>
          {tournament.lifecycleLabel}
        </span>
      </div>
      <div className="coach-tournaments__card-body">
        <h3>{tournament.name}</h3>
        <p className="coach-tournaments__card-location">{tournament.location}</p>
        <div className="coach-tournaments__card-meta">
          <span>{tournament.ageCategory}</span>
          <span>{tournament.format}</span>
          <span>{formatDateRange(tournament.startDate, tournament.endDate)}</span>
          <span>Competition: {tournament.competitionStatus}</span>
          <span>Capacity: {tournament.maxTeams} teams</span>
        </div>
        <button type="button" className="coach-tournaments__view-button" onClick={onView}>
          View Tournament <span aria-hidden="true">→</span>
        </button>
        {isDraft && (
          <div className="coach-tournaments__card-actions">
            <button
              type="button"
              className="coach-tournaments__secondary-button"
              onClick={onEdit}
              disabled={actionsDisabled}
            >
              Edit draft
            </button>
            <button
              type="button"
              className="coach-tournaments__primary-button"
              onClick={onPublish}
              disabled={actionsDisabled}
            >
              {isPublishing ? "Publishing..." : "Publish"}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

export default CoachTournaments;
