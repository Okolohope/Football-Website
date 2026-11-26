# ELEVN player and community API

This service stores player profiles in Neon Postgres and authenticates requests with Clerk JWTs.

## Run locally

1. Copy `.env.example` to `.env` and set `DATABASE_URL`, `CLERK_ISSUER_URL`, and `FRONTEND_ORIGIN`. Never commit `.env`.
2. Apply [`schema.sql`](./schema.sql) to the Neon branch.
3. Configure the Neon Object Storage variables in `.env` to enable player avatar uploads. Without them, the rest of the profile API still works, but avatar upload returns `503`.
4. Run `go mod tidy`, then `go run ./onboarding`.
5. Set `VITE_API_URL=http://localhost:8080` in `frontend/.env`.

The API uses the authenticated Clerk token subject as `user_id`; it never accepts an owner ID from the browser. Queries use pgx parameters (`$1`, `$2`, etc.), and request bodies reject unknown JSON fields, oversized payloads, invalid enum values, and overlong text.

Avatar files are stored in Neon Object Storage and only their object keys are stored in PostgreSQL. The backend returns short-lived signed URLs; storage credentials never reach the browser.

## Neon setup

1. Create a Neon project and copy the pooled connection string into `DATABASE_URL`.
2. Open the Neon SQL editor and run [`schema.sql`](./schema.sql).
3. Create a Neon Object Storage bucket and set `NEON_STORAGE_BUCKET`.
4. Set `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION`.
5. Create a Clerk application and set `CLERK_ISSUER_URL` to its issuer URL.
6. Set `FRONTEND_ORIGIN` to the deployed frontend URL.
7. Set `VITE_CLERK_PUBLISHABLE_KEY` and `VITE_API_URL` in `frontend/.env`.
8. In Clerk, create a webhook endpoint pointing to `<API_URL>/api/webhooks/clerk` and add `CLERK_WEBHOOK_SIGNING_SECRET`.
9. Subscribe the webhook to `user.created`, `user.updated`, and `user.deleted`.

Never commit real database, Clerk, or object-storage credentials.

## Community behavior and limits

- Posts are public or followers-only and are limited to three per account per UTC day.
- Images and MP4/WebM videos are uploaded to Neon Object Storage.
- Video uploads must be five minutes or shorter.
- Likes, comments, follows, and search use authenticated Clerk users.
- Users under 18 require guardian name, guardian phone, and guardian consent.
- Player profiles and guardian details are stored in Neon, never in browser local storage.
- Player statistics remain associated with the player after a squad membership ends.
