# 246: Renumber unapplied migrations

Production deploys failed with `A new file sorts before the applied 013_item_logs.sql: 012_journal_entries.sql`: production had applied up to 013 (#214) when 012 (#210) reached main.

- `012_journal_entries.sql` is renamed to `016_journal_entries.sql` and `014_journal_entry_items.sql` to `017_journal_entry_items.sql` (it depends on the journal table). `015_essays.sql` is unchanged. None of the three had been applied in production, so no data or history row changes. The two integration tests that apply these files use the new names.
- New check `npm run migrations:check` (part of `npm run check`): migration numbers must be unique, and a file that is not on `origin/main` must not sort before the highest file that is. It prints a warning and runs only the number check when `origin/main` is missing. Unit tests are in `scripts/test/check-migrations.test.mjs`.
- Older change records that mention `012_` and `014_` describe the history at the time and are not edited.
