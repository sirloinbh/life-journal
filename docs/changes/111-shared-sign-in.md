# #111 Require the shared sign-in

- Issue: [#111](https://github.com/sirloinbh/life-journal/issues/111)
- Branch: `chore/standards-sync-b3f43a7`
- Pattern: the workout-memo pilot (sirloinbh/workout-memo#303)

## Change

- `backend/src/app.ts`: `createApp` takes an `auth` middleware and mounts it on `/api` before any route; `/api/health` stays open (the middleware's `publicPaths`). New `GET /api/me` returns the signed-in user.
- `backend/src/server.ts`: passes `sharedAuth()` (managed `backend/src/standard/auth.ts`) to `createApp`. It builds the middleware when `AUTH_INTERNAL_URL` is set and refuses to start in production without it.
- `compose.yaml`: the API joins the external `shared-auth` network and checks sessions at `http://shared-auth-api:3110`.
- `frontend/src/app.tsx`: the app is wrapped in `SignInGate` and the top bar shows `AccountActions`. On localhost and IP addresses nothing changes.
- `backend/test/sign-in.test.ts`: 401 without a session, `/api/health` open, `/api/me` returns the user.
- `.env.example`: a note on the optional `AUTH_INTERNAL_URL`.

## Reason

- The app relied only on the IP allow list. The shared sign-in is live (sirloinbh/project-standards ADR-0015, #550, #551); workout-memo was the pilot.

## Limits

- This app has no `docs/api.md`, `backend/src/openapi.ts`, or `docs/openapi.json`, so the `/api/me` row and the sign-in rule are not documented there.
- `/api/health` stays public, so deploy health checks keep working.

## Verification

- Local: format, lint and typecheck pass; backend `sign-in` and `health` tests (7 pass); frontend `app` and `auth-origin` tests (6 pass); `node .standards/check.mjs` passes. The tests that need PostgreSQL and the rest of the frontend run in CI.
- `npm install --ignore-scripts` (user step) and `node .standards/lockfiles.mjs --write` updated the lockfiles for `@sirloinbh/auth-client` 1.0.0.
