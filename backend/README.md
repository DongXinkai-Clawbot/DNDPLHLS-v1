# Backend (fixed, works with cross-origin dev)

## Quick start
```bash
npm i
cp .env.example .env
npm run dev
```

Default:
- Backend: http://localhost:8787
- API prefix: /v1

## Endpoints
- POST `/v1/auth/start`  `{ email }`
  - Sends magic-link email if SMTP is configured.
  - Otherwise returns `magic_link` in JSON (dev-friendly).

- POST `/v1/auth/verify` `{ email, magic_token }`
  - Sets httpOnly cookie `refresh_token` (cross-site safe).
  - Returns `{ access_token, user }`

- POST `/v1/auth/refresh`
  - Requires cookie `refresh_token`
  - Returns new `{ access_token }` (and rotates refresh cookie)

- POST `/v1/auth/logout`
  - Clears refresh cookie + session.

- GET `/health`
  - simple health check

## Frontend fetch/axios must include credentials
fetch:
```js
fetch("http://localhost:8787/v1/auth/verify", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, magic_token })
})
```

axios:
```js
axios.post("http://localhost:8787/v1/auth/verify", { email, magic_token }, { withCredentials: true })
```

## Cookie notes (important)
For cross-origin dev (e.g. 5173 -> 8787), cookies must be:
- SameSite=None
- Secure=false on http (dev), Secure=true on https (prod)

This repo supports:
- COOKIE_SAMESITE=none
- COOKIE_SECURE=auto
