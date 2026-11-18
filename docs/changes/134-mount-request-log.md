# #134 Mount requestLog so every request has an ID

- Issue: [#134](https://github.com/sirloinbh/life-journal/issues/134)
- Branch: `fix/134-mount-request-log`
- Central issue: sirloinbh/project-standards#658

## Purpose

`backend/src/app.ts` imported the managed `standard/http.ts` but never mounted `requestLog`. No response had an `X-Request-Id` header and no request log line was written, so project-standards#552 was not in effect.

## Changes

- `app.use(requestLog)` is the first middleware in `createApp`, so even a rate-limit 429 or a body-parse error has a request ID.
- `backend/test/health.test.ts` checks that a response has `X-Request-Id`, that a valid incoming ID is kept, a 404 has one, and the log line carries it.
- `backend/test/helpers.ts`: `withApi`'s `call` accepts request `headers` and returns the response `headers`.
- `backend/src/standard/*` is unchanged (managed files).

## Verification

See the PR body for the commands and results.

## Limits

- Every request now writes one JSON line to stdout (stderr for 5xx). No existing test asserts exact log output.
