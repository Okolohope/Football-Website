export class BannerUploadPendingError extends Error {
  constructor(tournament, cause) {
    super(`${tournament.name} draft was saved, but its banner upload failed.`);
    this.name = "BannerUploadPendingError";
    this.tournament = tournament;
    this.cause = cause;
  }
}

export async function saveTournamentWithBanner({
  tournamentId,
  retryTournamentId,
  payload,
  bannerFile,
  token,
  create,
  update,
  upload,
}) {
  if (retryTournamentId) {
    if (!bannerFile) {
      throw new Error("Select the banner file again before retrying its upload.");
    }
    return upload(retryTournamentId, bannerFile, token);
  }

  const saved = tournamentId
    ? await update(tournamentId, payload, token)
    : await create(payload, token);
  if (!bannerFile) return saved;

  try {
    return await upload(saved.id, bannerFile, token);
  } catch (error) {
    throw new BannerUploadPendingError(saved, error);
  }
}
