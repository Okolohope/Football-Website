const COACH_API_URL = (
  import.meta.env.VITE_COACH_API_URL || "http://127.0.0.1:8000"
).replace(/\/+$/, "");

export async function submitCoachOnboarding(form, teamLogo, token) {
  if (!token) {
    throw new Error("Your sign-in session has expired. Please sign in again.");
  }

  const body = new FormData();
  Object.entries(form).forEach(([field, value]) => body.append(field, value));
  if (teamLogo) body.append("teamLogo", teamLogo);

  let response;
  try {
    response = await fetch(`${COACH_API_URL}/api/coaches/onboarding`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body,
    });
  } catch {
    throw new Error(
      "Could not reach the coach service. Check that the FastAPI server is running and the coach API URL is correct.",
    );
  }

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(formatError(result?.detail, response.status));
  }
  if (!result?.coach || !result?.squad) {
    throw new Error("The coach service returned an unexpected response.");
  }

  return result;
}

export async function getCoachMe(token) {
  if (!token) {
    throw new Error("Your sign-in session has expired. Please sign in again.");
  }

  let response;
  try {
    response = await fetch(`${COACH_API_URL}/api/coaches/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new Error(
      "Could not reach the coach service. Check that the FastAPI server is running and the coach API URL is correct.",
    );
  }

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(formatError(result?.detail, response.status));
  }
  if (!result?.coach || !Array.isArray(result.squads)) {
    throw new Error("The coach service returned an unexpected response.");
  }

  return result;
}

export async function listTournaments(token) {
  const result = await requestTournament("/api/coaches/tournaments", token);
  if (!Array.isArray(result)) {
    throw new Error("The coach service returned an unexpected tournament list.");
  }
  return result;
}

export async function createTournament(tournament, token) {
  return validateTournamentResponse(
    await requestTournament("/api/coaches/tournaments", token, {
      method: "POST",
      body: tournament,
    }),
  );
}

export async function getTournament(tournamentId, token) {
  return validateTournamentResponse(
    await requestTournament(
      `/api/coaches/tournaments/${encodeURIComponent(tournamentId)}`,
      token,
    ),
  );
}

export async function updateTournament(tournamentId, changes, token) {
  return validateTournamentResponse(
    await requestTournament(
      `/api/coaches/tournaments/${encodeURIComponent(tournamentId)}`,
      token,
      { method: "PATCH", body: changes },
    ),
  );
}

export async function publishTournament(tournamentId, token) {
  return validateTournamentResponse(
    await requestTournament(
      `/api/coaches/tournaments/${encodeURIComponent(tournamentId)}/publish`,
      token,
      { method: "POST" },
    ),
  );
}

export async function uploadTournamentBanner(tournamentId, file, token) {
  if (!token) {
    throw new Error("Your sign-in session has expired. Please sign in again.");
  }

  const body = new FormData();
  body.append("banner", file);

  let response;
  try {
    response = await fetch(
      `${COACH_API_URL}/api/coaches/tournaments/${encodeURIComponent(tournamentId)}/banner`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      },
    );
  } catch {
    throw new Error(
      "Could not reach the coach service. Check that the FastAPI server is running and the coach API URL is correct.",
    );
  }

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(formatTournamentError(result?.detail, response.status));
  }
  return validateTournamentResponse(result);
}

async function requestTournament(path, token, { method = "GET", body } = {}) {
  if (!token) {
    throw new Error("Your sign-in session has expired. Please sign in again.");
  }

  const headers = { Authorization: `Bearer ${token}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response;
  try {
    response = await fetch(`${COACH_API_URL}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new Error(
      "Could not reach the coach service. Check that the FastAPI server is running and the coach API URL is correct.",
    );
  }

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(formatTournamentError(result?.detail, response.status));
  }
  return result;
}

function validateTournamentResponse(result) {
  if (!result || typeof result !== "object" || typeof result.id !== "string") {
    throw new Error("The coach service returned an unexpected tournament response.");
  }
  return result;
}

function formatTournamentError(detail, responseStatus) {
  if (responseStatus === 401) {
    return "Your sign-in session has expired. Please sign in again.";
  }
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail.map((item) => {
      const field = Array.isArray(item.loc)
        ? item.loc.filter((part) => part !== "body").join(".")
        : "";
      return field ? `${field}: ${item.msg}` : item.msg;
    }).filter(Boolean);
    if (messages.length) return messages.join(" ");
  }
  return `The tournament request failed (HTTP ${responseStatus}). Please try again.`;
}

function formatError(detail, status) {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail.map((item) => {
      const field = Array.isArray(item.loc)
        ? item.loc.filter((part) => part !== "body").join(".")
        : "";
      return field ? `${field}: ${item.msg}` : item.msg;
    }).filter(Boolean);
    if (messages.length) return messages.join(" ");
  }
  return `The coach service could not save your team (HTTP ${status}). Please try again.`;
}