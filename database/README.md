# Review and Journal App PostgreSQL

PostgreSQL 17. The only source of migrations is `migrations/NNN_<description>.sql`. Follow the central standard's [DB migration rules](https://github.com/sirloinbh/project-standards/blob/main/docs/conventions/database.md).

## How to apply

Apply them with the shared runner (`backend/src/migrations.ts`; the command is `backend/src/migrate.ts`). Run it from the repository root; it uses `DATABASE_URL` from `.env`.

```powershell
npm run db:migrate -- --status   # Only lists applied and pending files. It does not change the DB
npm run db:migrate               # Applies the pending files in name order
```

- The runner wraps each file in a transaction and records every applied file in `schema_migrations` with its checksum. If a file fails, only that file is rolled back and the runner stops with a non-zero exit code.
- On a DB with no record table (a DB that was set up earlier with psql), the first run applies everything again from `001` and records it. This is why every file must be safe to run again.
- On an empty Docker volume, all files are applied automatically in name order on the first start (with no record). Then run `npm run db:migrate` once to create the record.
- For a production deploy, `deploy/remote-deploy.sh` takes a dump and then runs the same runner inside the API image with `node dist/migrate.js`.
- CI applies the files once with psql and then runs the runner, which also checks that running them again is safe.

## Writing rules

- Write every migration so that it is safe to run again (`IF NOT EXISTS`, drop by name and re-create, and so on).
- Do not use `BEGIN` or `COMMIT` in a file. The runner wraps it. Do not use psql meta commands (`\i`, `\set`) either.
- Do not edit a file that has been applied. Even one character in a comment changes the checksum and the runner stops. Add the change as a new numbered file.
- Parallel branches reserve their number when they start. Keep the meaning of existing data, and leave values you could not confirm as NULL. For Korean literals in SQL, use the `U&'\\XXXX'` escape where possible.
- When you must apply a file directly with psql, do not pipe it through PowerShell, as in `Get-Content … | psql`. Windows PowerShell 5.1 sends ASCII to the external program, so Korean text turns into `?`. The runner lets Node read the file directly as UTF-8.
