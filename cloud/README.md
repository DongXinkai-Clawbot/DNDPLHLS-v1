# Cloud backend (P0-1 / P0-2)

This repo includes a self-contained backend under `backend/` that implements:

- P0-1 Auth (email magic link, sessions, access JWT)
- P0-2 Projects + Snapshots (append-only versions, restore, dedupe)

## Run locally

1. Copy env:
   - `cp .env.backend.example .env`
   - set `JWT_SECRET` (>= 16 chars)

2. Install deps:
   - `npm i`

3. Run:
   - frontend: `npm run dev`
   - backend: `npm run backend:dev`

Backend: `http://localhost:8787/v1`

## Magic link flow

- `POST /v1/auth/start { email }`
  - If SMTP is not configured, the backend prints a URL in console:
    `[magic-link] to=... url=http://localhost:5173/?magic_token=...&email=...`

- Frontend should read `magic_token` + `email` from URL query and call:
  - `POST /v1/auth/verify { email, magic_token }`
  - server returns `access_token` and sets a `refresh_token` HttpOnly cookie

## Storage schema

- `projects` table holds metadata and `current_snapshot_id`
- `snapshots` holds append-only JSON payloads + a stable hash for dedupe

See `backend/migrations/001_init.sql`.
