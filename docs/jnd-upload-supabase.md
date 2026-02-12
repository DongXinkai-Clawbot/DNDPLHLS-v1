# JND Upload Backend (Supabase + Vercel)

This project can upload **anonymized JND estimates** (Ear Training Part II) to a Supabase Postgres database via a Vercel Serverless Function.

**Security redline:** The Supabase **service role key must never ship to the client**. It must live only in server-side environment variables. Do **not** put it in Vite-prefixed env vars or any frontend bundle.

## What gets uploaded
- `estimate_cents` (final JND estimate)
- `trials_counted`
- `conditions` (task conditions snapshot: timbre, durations, ranges, base mode)
- `metrics` (avg/max answer time)
- `anon_user_id` (random UUID stored in the browser)

No names/emails are collected by the uploader.

## 1) Create the Supabase table
Run this SQL in Supabase SQL Editor:

```sql
create table if not exists public.jnd_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  anon_user_id text not null,
  estimate_cents double precision not null,
  trials_counted integer not null,
  method text not null default '',
  conditions jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb
);

create index if not exists jnd_sessions_created_at_idx on public.jnd_sessions (created_at desc);
create index if not exists jnd_sessions_conditions_gin on public.jnd_sessions using gin (conditions);
```

## 2) Configure Vercel environment variables
In Vercel Project → Settings → Environment Variables, set:

- `SUPABASE_URL` = your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` = Supabase service role key (server-only!)

Optional:
- `ALLOWED_ORIGIN` / `ALLOWED_ORIGINS` = comma-separated allowed origins (blocks cross-origin posts)

The repo includes `.env.example` with the required variable names (no secrets).

## 3) Deployment boundary (server vs frontend)
Choose one and keep the boundary explicit:

**Option A: Serverless (recommended)**
- Deploy this repo to Vercel (or any platform that treats `api/` as serverless functions).
- The endpoint is `POST /api/jnd/submit` (see `api/jnd/submit.ts`).
- Only the serverless runtime receives `SUPABASE_SERVICE_ROLE_KEY`.

**Option B: Separate backend**
- Deploy `api/jnd/submit.ts` in a dedicated backend service.
- Configure the frontend to call that backend URL.
- Do **not** expose service-role keys to the frontend runtime.

## 4) Runtime safeguards (current handler)
- Rejects requests when env vars are missing (explicit error).
- Enforces body size and basic field validation.
- CORS is enforced when `ALLOWED_ORIGIN(S)` is set.
- Rate limits requests (IP + anonUserId).
- Does not return raw Supabase errors to clients (logs server-side only).

## 5) Notes / Security
- The service role key must **never** be exposed to the client; it stays in server env vars only.
- If you expect public traffic, consider adding stronger rate limiting (Upstash Redis, Vercel KV, etc.).
- For strict verification, upload minimal recent-trial proofs and validate server-side.

