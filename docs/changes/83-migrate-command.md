# #83 Create the migration command for the deploy script

- Issue: [#83](https://github.com/sirloinbh/life-journal/issues/83)
- Branch: `chore/83-migrate-command`

## Changes — 2026-11-04

There was no source for `node dist/migrate.js`, which `deploy/remote-deploy.sh` runs. We brought in the shared migration runner of the central standard so that this command works. We followed section 8, "Bringing the runner into an existing app", of the standard document [DB migration rules](https://github.com/sirloinbh/project-standards/blob/main/docs/conventions/database.md).

- `backend/src/migrations.ts`, `backend/src/migrate.ts`, `backend/test/migrations.test.ts`: copied from `scaffold/app/backend/` of `sirloinbh/project-standards` (main `6b0e57e`).
  - We changed one place only. The regular expression in `checksum()` contained a literal BOM character, which was caught by the ESLint `no-irregular-whitespace` of this repository. We replaced it with the escape `﻿` of the same meaning. The tests still pass.
- How the runner behaves: it applies `database/migrations/NNN_*.sql` in name order, each file inside a transaction, and records the name and checksum in `schema_migrations`. If a recorded file changed, disappeared, or is out of order, it applies nothing and fails. On failure it ends with exit code 1, so the deploy script (`set -e`) stops.
- Scripts: added `db:migrate` to `backend/package.json` and the root `package.json`. There are no new packages (`pg` and `tsx` are already dependencies). When `db:migrate` exists, the shared CI runs the runner after applying with psql.
- Paths: in the container, `/app/dist/migrate.js` reads `../../database/migrations/`, that is, `/database/migrations`, which the deploy script mounts. Locally it reads `database/migrations` of the repository.
- Removed `BEGIN` and `COMMIT` from `007_coffee_category.sql`. The standard rule says not to write them in the file, because the runner wraps each file in a transaction. A `COMMIT` inside the file would end the runner transaction before the record row is inserted. No DB has `schema_migrations` yet, so editing this file now causes no checksum problem. From now on, we do not edit applied files.
- `database/README.md`: replaced the guidance of applying files one by one with psql with the runner guidance, and added the writing rules (no `BEGIN` or `COMMIT`, do not edit applied files).
- `docs/next-steps/README.md`: changed the existing local DB guidance to `npm run db:migrate` and removed the #83 line.

## Tests

- `backend/test/migrations.test.ts` (copy of the standard): without a DB, it checks checksum normalization, file name and number checks, the pending list, and changed, missing, and out-of-order files.
- `backend/test/migrate-command.test.ts` (newly written)
  - If `DATABASE_URL` is missing, the command ends with a Korean message and exit code 1.
  - On an empty schema the runner applies and records every file, and on the second run it applies nothing.
  - On a schema where every file was already applied with psql (no record), the runner applies them all again and records them, and the existing rows stay.
  - The command (`node --import tsx src/migrate.ts`) ends with exit code 0 twice in a row, and if the checksum of a recorded file differs, it ends with exit code 1 and a Korean message.
  - For a file that failed during SQL execution, only that file is rolled back (the table it created does not remain), the records of earlier successful files remain, and the error shows the file name.
  - The DB tests change `search_path` in the connection string to a test-only schema, so they do not touch `public`.

## Verification

- After the build, `backend/dist/migrate.js` exists. We ran this file twice on a temporary schema with `node dist/migrate.js`. The first run applied 7 files, and the second ended with "적용할 마이그레이션이 없습니다" (no migrations to apply).
- `npm run knip`: pass.
- `npm run check`: pass (backend 155 passed, 0 skipped, frontend 150 passed, 2 skipped, skills 4 passed). The DB integration tests ran with `TEST_DATABASE_URL` set.
- Comparison with the standard original: `migrate.ts` and `migrations.test.ts` are the same, and `migrations.ts` differs only in the regular expression line above.
- There is no screen change, so we did not check in a browser.

## Follow-up

- The `migrations.ts` of the standard scaffold also contains the same BOM character. This regular expression is caught by the ESLint `no-irregular-whitespace`, so it is better to fix it in the central repository. We will open the central repository issue after the user confirms.
- The existing local DB and the production DB do not have `schema_migrations` yet. Locally, running `npm run db:migrate` once records it. In production, the deploy script records it at the first deploy.

## Review

We applied the 2 findings of the first round (both low).

- The failure test only checked a checksum mismatch (a path that fails before applying). We added a DB test that checks that when a failure happens during SQL execution, only that file is rolled back and the earlier file records remain.
- The cleanup-step comment in `backend/test/db.integration.test.ts` said "007 opens the transaction", which is no longer correct because `BEGIN` was removed from 007. We fixed the comment.

For reference only: if the connection drops, `pg_advisory_unlock` of the runner also fails and can mask the original error message. The exit code is still non-zero, so the deploy stops. It is central code, so we did not fix it in this PR.

After applying the first review, `npm run check`: pass (backend 156 passed, 0 skipped, frontend 150 passed, 2 skipped, skills 4 passed).

Second review: both first-round findings were applied and there was nothing to fix.
