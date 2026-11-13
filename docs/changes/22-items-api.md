# #22 Item storage API for 5 areas

- Issue: [#22](https://github.com/sirloinbh/life-journal/issues/22)
- Branch: `feat/22-items-api`

## Purpose

Make it possible to store, read, update, and delete the item data that the bucket list, ratings, reviews, and table view are built on.

## Decision

Follow the user decision recorded in the issue comment.

- Keep the bucket list and completion records in one table and tell them apart by `status` (`wishlist` / `done`).
- Cost is an integer in won (`cost_krw`), and KRW is the only currency.
- Keep the per-area details in a single `details` (`jsonb`) column and validate them with a per-area Zod schema.
- If `done`, the completion date is required, and it cannot be later than today (Asia/Seoul). A completion date cannot be set on `wishlist`. The planned date has no limit.

The values decided during implementation are as follows. They may change in the #23 screen work.

| Area (`category`) | Subtype (`subtype`)                       | Per-area details (`details`, all optional) |
| ----------------- | ----------------------------------------- | ------------------------------------------ |
| `reading`         | none                                      | `author`, `publisher`                      |
| `screen`          | `movie`, `drama`                          | `director`, `cast`                         |
| `stage`           | `play`, `performance`, `musical`, `opera` | `venue`, `cast`                            |
| `drink`           | `wine`, `whisky`, `sake`                  | `producer`, `region`, `vintage` (year)     |
| `travel`          | none                                      | `country`, `city`                          |

## Changes — 2026-10-31

- `database/migrations/002_items.sql`: the `items` table and an index for list sorting. The DB also blocks the area, status, cost, title, and the rule "a completed status and a completion date go together" with `CHECK`.
- `backend/src/items.ts`: `GET/POST /api/items`, `GET/PATCH/DELETE /api/items/:id`, and validation.
- `PATCH`: takes only some values, merges them with the current row, and re-checks all the rules. It is handled inside a transaction that locks the row, so a concurrent edit does not make values disappear. `details` is replaced as a whole, not merged.
- `backend/src/app.ts`: replaced the own error handling with `errorHandler` and `notFound` of the central `standard/http.ts`. A malformed JSON body now gives a Korean 400 instead of 500. The BIGINT `id` is sent as a JSON number.
- Search, filters, and pagination are in the scope of #26, so they are not included.

## Tests

- `backend/test/items.test.ts` (no DB): checks that input such as an invalid area, date, cost, subtype, per-area details, the completion date rule, and a NUL character is rejected with a Korean 400 before it reaches the DB, and that a completion date of today is accepted.
- `backend/test/db.integration.test.ts` (real DB): checks re-applying the migration, saving, re-reading, and list order for the 5 areas, update, reopen, area change, delete, 404, and the behavior of the DB `CHECK`.
- `backend/test/helpers.ts`: made it possible to put a method and a body in a request. It uses `node:http` instead of `fetch`. On a Windows PC where the temporary port range starts at 1024, the test server got a port that `fetch` blocks and failed with `bad port`; this fixes it.

## Verification — 2026-10-31

Ran on Windows with a temporary PostgreSQL 17.11 (`journal_test`, migrations 001 and 002 applied) set as `TEST_DATABASE_URL`.

- `npm run check`: pass (format, lint, types, tests, skill sync check, build).
- `npm test`: backend 37 passed and 0 skipped, frontend 52 passed.
- `npm run knip`: pass.
- `npm test -w backend` without `TEST_DATABASE_URL`: 32 passed, and 5 DB integration tests skipped. A skipped result does not count as DB verification.
- There is no screen change, so we did not check in a browser.

## First review applied — 2026-10-31

The findings of an agent review separated from the authoring context, and how they were handled.

| Finding                                                                       | Handling                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| If the DB connection drops during PATCH, the API process dies                 | During the transaction, receive the connection `error` and log it. The request ends with 500 and the process stays alive                                                                                            |
| If an idle pool connection drops, the process dies (the existing `server.ts`) | Not a change of this PR; split out as [#31](https://github.com/sirloinbh/life-journal/issues/31)                                                                                                                    |
| A ROLLBACK failure masked the original error                                  | Keep the original error and discard that connection from the pool                                                                                                                                                   |
| No tests verified the lock and the rollback                                   | Added tests for concurrent PATCH, rollback on COMMIT failure, a dropped connection, and a future completion date in PATCH                                                                                           |
| The same error message appeared twice for `costKrw: -1.5`                     | Fixed it by combining the cost and vintage checks so it appears once                                                                                                                                                |
| The `CodeQL` check failed (5 `js/missing-rate-limiting` alerts)               | By the user decision, instead of dismissing it as a false positive, add a request limit to the app. Split out as [#32](https://github.com/sirloinbh/life-journal/issues/32). Do not merge this PR before that merge |

### Verification

Ran with the same temporary DB.

- `npm run check`: pass.
- `npm test -w backend`: 44 passed and 0 skipped.
- We removed the safeguards from the code one at a time, ran `npm test -w backend`, and checked that the new tests fail. After checking, we reverted the code.
  - Remove `FOR UPDATE`: the concurrent PATCH test fails.
  - Remove the connection `error` listener: the dropped connection test fails.
  - Remove `ROLLBACK`: the COMMIT failure rollback test and the ROLLBACK failure test fail.

## Second review — 2026-10-31

We reviewed head `62597f1`. There was nothing to fix in code, tests, or migrations, and we confirmed that the first-round findings were fixed. We ran `npm test -w backend` 12 times without load and 6 times under CPU load, and each time 44 passed (no instability). One finding that the test count in the PR body was out of date was applied by fixing the body. The review ends after 2 rounds.

## Merge of `origin/main` — 2026-10-31

#32 (app-level request limit, PR #33) was merged, so we merged `origin/main` into this branch. There were no conflicts. `npm run check` passed with the same temporary DB, with backend 45 passed and 0 skipped and frontend 52 passed.
