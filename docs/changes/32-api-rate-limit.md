# #32 Add an app-level request limit to the API

- Issue: [#32](https://github.com/sirloinbh/life-journal/issues/32)
- Branch: `feat/32-api-rate-limit`

## Purpose

The `CodeQL` check of PR #30 failed with a `js/missing-rate-limiting` warning. The user decided to add a limit to the app instead of dismissing the warning as a false positive (2026-10-31). The limit also applies to paths that do not go through nginx.

## Changes — 2026-10-31

- `backend/src/app.ts`: a limit of 600 per minute per IP on all of `/api`. Beyond it, the response is 429 with a Korean message. The user decided the value, and it is at the same level as 10r/s in `frontend/nginx.conf`.
- The limit is checked before the JSON body is read.
- The counter is in process memory, so it resets when the API restarts.
- Behind nginx, all requests are counted under the IP of nginx. There is one user, so we leave it as is. We will look at it again when it is exposed externally.

### Package

The user checked the risk and installed it directly (`npm install --ignore-scripts --save-exact -w backend express-rate-limit@8.7.1`). `backend/package-lock.json` was aligned with `npm run lockfiles:sync`.

| Package                        | Published  | Note                                                                          |
| ------------------------------ | ---------- | ----------------------------------------------------------------------------- |
| `express-rate-limit` 8.7.1     | 2026-10-06 | Direct dependency, 25 days since publication. No install script               |
| `ip-address` 10.7.5 (indirect) | 2026-10-25 | 6th day since publication. npm picked the latest within the range (`^10.2.0`) |

`debug` uses the version that was already there. The versions of other packages did not change.

## Tests

- `backend/test/health.test.ts`: confirms that requests up to the 600th pass and the next request gets 429 and a Korean message.

## Verification — 2026-10-31

Ran on Windows with a temporary PostgreSQL 17.11 (`journal_test`) set as `TEST_DATABASE_URL`.

- `npm run check`: pass. Backend 6 passed and 0 skipped, frontend 52 passed.
- `npm run knip`: pass.
- `node .standards/ioc-scan.mjs`: no suspicious items.
- Whether the `CodeQL` warning goes away is checked after this change is merged into PR #30. The path of #30 is not in `main` yet, so it cannot be checked in this PR.

## Review — 2026-10-31

A separate agent reviewed head `4eb27fc`. There was one finding and no code change, so there is no second review.

- The comment "The API itself has no limit" in `frontend/nginx.conf` is no longer true after this change. It is a centrally managed file, so we split it out as [#34](https://github.com/sirloinbh/life-journal/issues/34).
- The reviewer ran the build output and confirmed the 429 on the 601st request, the `{ error }` format, and that a forged `X-Forwarded-For` does not bypass the limit.
- If the first request after the API starts has a client-sent `X-Forwarded-For` or `Forwarded`, the package logs a warning once. The response is normal, so we leave it.
