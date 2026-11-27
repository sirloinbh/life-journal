# #253 Add essays to export and restore

Essays (#239) were missing from the backup file: `docker compose down -v` lost them, and a restore left the current essays next to the restored records.

- `backend/src/export.ts`: `essays` is exported (`id`, `title`, `body`, `written_date`, `status`, `tags`, `created_at`, `updated_at`).
- `backend/src/restore.ts`: strict row schema, optional in `tables` (a file from before this change restores with no essays), delete, insert, id sequence reset. A restore now replaces essays like every other table, so essays written after the file was made are replaced too; the restore card says so.
- `frontend/src/restore-file.ts`, `frontend/src/restore.tsx`, `frontend/src/backup.tsx`: the counts name essays; the card texts mention them.
- `docs/export-format.md`: the table, the optional list, and the restore steps.
- Tests: unit tests of both routes, the export and restore DB round trips (including a Korean title with quotes, line breaks, tags, microsecond timestamps, and the id sequence), and the frontend counts.

## Verification

See the PR for the `npm run check` result.
