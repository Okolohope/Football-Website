# ELEVN Coach API

This is the Python/FastAPI service for coach profiles and squads. It is separate
from the Go player API, which remains in `backend/` and listens on port 8080.
The coach API listens on port 8000 and does not create or alter database tables.
Stage Three must inspect Neon and install the approved schema before database
endpoints can return records.

## Configuration

Coach settings are read only from `backend/coach/.env`; the Go service continues
to use its own `backend/.env`. The settings loader is `config.py`. Do not put
private values in `frontend/.env`, because Vite exposes `VITE_` variables to the
browser. Never commit either real `.env` file.

If `backend/coach/.env` does not exist, copy `.env.example` to `.env`. If it
already exists, edit it carefully rather than overwriting it. Set these values:

| Variable                | Obtain it from                                                    | Used by                                           |
| ----------------------- | ----------------------------------------------------------------- | ------------------------------------------------- |
| `DATABASE_URL`          | Neon Console, the intended project/database connection details    | `config.py`, then `database.py`                   |
| `CLERK_ISSUER_URL`      | The same Clerk instance configured by the frontend and player API | `config.py`, then `auth.py` to build the JWKS URL |
| `FRONTEND_ORIGIN`       | The exact browser origin, such as `http://localhost:5173`         | `config.py`, then `main.py` CORS                  |
| `COACH_PORT`            | Use `8000` locally                                                | `config.py`, then `run.py`                        |
| `AWS_ENDPOINT_URL_S3`   | Neon Console, Object Storage endpoint                             | `config.py`, then `storage.py`                    |
| `COACH_STORAGE_BUCKET`  | The exact separate coach-logo bucket name in Neon                 | `config.py`, then `storage.py`                    |
| `COACH_TOURNAMENT_STORAGE_BUCKET` | The separate private tournament-banner bucket in Neon     | `config.py`, then `storage.py`                    |
| `AWS_REGION`            | The Object Storage bucket/credential configuration                | `config.py`, then `storage.py`                    |
| `AWS_ACCESS_KEY_ID`     | Neon Object Storage access credentials                            | `config.py`, then `storage.py`                    |
| `AWS_SECRET_ACCESS_KEY` | Neon Object Storage access credentials                            | `config.py`, then `storage.py`                    |

Use the same Clerk issuer as the existing application; the backend fetches
`<issuer>/.well-known/jwks.json` to verify session-token signatures. A Clerk
secret key is not required for this verification and is not used by this API.
The database URL and storage keys are secrets. The endpoint, bucket name, region,
issuer, and frontend origin are configuration values, not authentication
secrets.

The repository currently identifies a `player-avatars` bucket for the Go
service. Do not put that bucket name in `COACH_STORAGE_BUCKET`; choose the actual
coach bucket in Neon and enter its exact name. Logo upload remains unavailable
until all five storage settings are configured together.
Tournament banner uploads also require `COACH_TOURNAMENT_STORAGE_BUCKET`; they
reuse the same server-side endpoint, region, and credentials as coach logos.
Keep both buckets private and grant the configured credentials access to each.

Use an exact origin in `FRONTEND_ORIGIN`: `http://localhost:5173` and
`http://127.0.0.1:5173` are different browser origins. CORS does not allow
wildcard origins.

## Run locally

From the repository's `backend` directory, create the isolated environment and
install coach-only dependencies:

```powershell
python -m venv coach/.venv
coach/.venv/Scripts/python.exe -m pip install -r coach/requirements.txt
```

After configuring `coach/.env`, start the service from the same `backend`
directory:

```powershell
coach/.venv/Scripts/python.exe -m coach.run
```

The health endpoint is `http://127.0.0.1:8000/healthz`; interactive API docs
are at `http://127.0.0.1:8000/docs`. Health confirms that the API process is
running, not that Neon or its tables are ready.

## API

- `POST /api/coaches/onboarding` creates a coach and first squad in one database
  transaction. It accepts the frontend's camelCase fields as multipart form
  values and an optional `teamLogo` file.
- `GET /api/coaches/me` returns the authenticated coach profile and squads.
- `POST /api/coaches/squads` creates another squad for the authenticated coach.
- `GET /api/coaches/squads` lists only the authenticated coach's squads and
  returns short-lived signed logo URLs when storage is configured.
- `POST /api/coaches/tournaments/{tournament_id}/banner` accepts a multipart
  field named `banner` for a draft owned by the authenticated coach. It accepts
  JPEG, PNG, and WebP files up to 5 MB and returns the saved tournament with a
  15-minute signed `bannerUrl`. Only the object key is stored in
  `tournaments.banner_key`.

Every protected route derives the Clerk user ID from the verified bearer token.
No request field selects the owner. The database must enforce a unique
`coaches.clerk_user_id` and a foreign key from each squad to its coach; Stage
Three will inspect and design those constraints before writing any migration.
Once player/match/statistics models exist, add query endpoints that scope each
record through the same verified coach identity. This stage returns no fake
counts or match statistics.

## Tests

The tests use signed local test tokens and fake settings; they do not call Clerk,
Neon, or object storage and do not create tables. From `backend` run:

```powershell
coach/.venv/Scripts/python.exe -m pytest coach/tests -q
```
