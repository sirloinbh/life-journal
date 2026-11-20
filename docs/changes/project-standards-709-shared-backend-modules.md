# Adopt the shared db, rate-limit and OpenAPI modules (project-standards#709)

- `server.ts` uses `createPool(new Pool(...))` from `standard/db.ts`; `src/pool.ts` and its test are removed (the managed module has its own tests).
- `PATCH /api/items/:id` uses `withTransaction` instead of a hand-written BEGIN/COMMIT/ROLLBACK block.
- `app.ts` uses `apiRateLimit(app)` (600 per minute per client IP, `trust proxy` 1, the health check is not counted). The 429 message is now the managed text.
- `openapi.ts` is only the operation table; the document comes from `standard/openapi.ts` (`z.toJSONSchema`). The route param of the term routes is `:termId` so the managed builder does not describe a string term id as an integer.
- `docs/openapi.json` is regenerated: it gains the shared sign-in security scheme and the default 401, 413 and 429 responses.
- Verification: typecheck, eslint, prettier, non-DB tests. Tests that need Postgres run in CI.
