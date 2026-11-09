# ProPitch player API

This service stores player profiles in Neon Postgres and authenticates requests with Clerk JWTs.

## Run locally

1. Copy `.env.example` to `.env` and set `DATABASE_URL`, `CLERK_ISSUER_URL`, and `FRONTEND_ORIGIN`. Never commit `.env`.
2. Apply [`schema.sql`](./schema.sql) to the Neon branch.
3. Configure the Neon Object Storage variables in `.env` to enable player avatar uploads. Without them, the rest of the profile API still works, but avatar upload returns `503`.
4. Run `go mod tidy`, then `go run .`.
5. Set `VITE_API_URL=http://localhost:8080` in `frontend/.env`.

The API uses the authenticated Clerk token subject as `user_id`; it never accepts an owner ID from the browser. Queries use pgx parameters (`$1`, `$2`, etc.), and request bodies reject unknown JSON fields, oversized payloads, invalid enum values, and overlong text.

Avatar files are stored in Neon Object Storage and only their object keys are stored in PostgreSQL. The backend returns short-lived signed URLs; storage credentials never reach the browser.
