# Export format

The app exports every record as one JSON file (`GET /api/export`, Settings › Back up records) and the items as a CSV file (`GET /api/export/items.csv`). Restore (#209) reads the JSON file back. This page is the contract between the two, and between them and every table added later.

The code is `backend/src/export.ts`. Both routes sit under `/api`, so they need the shared sign-in like every other record (#111).

## JSON file

File name: `life-journal-YYYY-MM-DD.json` (the service date, Asia/Seoul).

```json
{
  "format": "life-journal-export",
  "version": 1,
  "exportedAt": "2026-11-26T09:05:01.123+09:00",
  "tables": {
    "items": [{ "id": 1, "category": "reading", "...": "..." }],
    "item_quotes": [{ "id": 1, "item_id": 1, "...": "..." }],
    "item_logs": [{ "id": 1, "item_id": 1, "...": "..." }],
    "journal_entries": [{ "id": 1, "entry_date": "2026-11-02", "...": "..." }],
    "journal_entry_items": [
      { "entry_id": 1, "item_id": 2, "linked_at": "2026-11-02T14:05:00.000003Z" }
    ],
    "learned_terms": [{ "term_id": "wine-tannin", "learned_at": "2026-11-20T00:00:00.000004Z" }],
    "essays": [{ "id": 1, "title": "On wine", "written_date": "2026-11-20", "...": "..." }],
    "notion_pages": [{ "id": 1, "notion_id": "1111...", "parent_notion_id": null, "...": "..." }],
    "audit_log": [{ "id": 1, "at": "2026-11-25T14:59:59.000009Z", "...": "..." }]
  }
}
```

| Field        | Meaning                                                                                                   |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| `format`     | Always `life-journal-export`. A file without it is not an export of this app.                             |
| `version`    | The format version, an integer. It goes up when a change would make an older restore read the file wrong. |
| `exportedAt` | When the file was made, ISO 8601 in Asia/Seoul with its offset (`+09:00`).                                |
| `tables`     | One array of rows per table, in restore order: a table comes after the tables it refers to.               |

All tables are read in one `REPEATABLE READ` snapshot, so the tables of a file agree with each other.

The file holds personal data (reviews, quotes, log notes, the names in `companions`, and the before and after snapshots in `audit_log`), so keep it private: it is for my own backup, not for sharing.

### Value rules

- Every column of the table is in every row, with `null` for an empty column. A row never leaves a column out.
- `timestamptz` columns are UTC text with microseconds: `2026-11-20T01:11:12.123456Z`. A JavaScript `Date` keeps only milliseconds, so this keeps the exact value for restore.
- `date` columns are `YYYY-MM-DD`.
- `bigint` and `integer` columns are JSON numbers. `numeric` columns (such as `rating` of `items` and `item_logs`) are JSON numbers.
- `jsonb` columns are JSON values as stored (objects for `details` and `sub_ratings`; any JSON value or `null` for `before` and `after` of `audit_log`).
- `text[]` columns (`tags`, `companions`) are JSON arrays of strings; an empty list is `[]`.
- Rows are sorted by primary key.

### Tables in version 1

`items` (ordered by `id`): `id`, `category`, `subtype`, `title`, `status`, `cost_krw`, `planned_date`, `completed_date`, `details`, `rating`, `sub_ratings`, `review`, `link`, `tags`, `companions`, `created_at`, `updated_at`. The column meanings and checks are in `database/migrations/002_items.sql` to `010_item_tags_companions.sql`.

`item_quotes` (ordered by `id`, #217): `id`, `item_id`, `text`, `page`, `note`, `created_at`, `updated_at`. Quotes of a book; `item_id` refers to `items.id`. See `database/migrations/011_item_quotes.sql`.

`item_logs` (ordered by `id`, #214): `id`, `item_id`, `logged_on`, `rating`, `note`, `cost_krw`, `created_at`, `updated_at`. More visits or tastings of an item; `item_id` refers to `items.id`. See `database/migrations/013_item_logs.sql`.

`journal_entries` (ordered by `id`, #210, #233): `id`, `entry_date`, `title`, `body`, `created_at`, `updated_at`. One diary entry per date; `title` may be `null`. See `database/migrations/016_journal_entries.sql`.

`journal_entry_items` (ordered by `entry_id`, `item_id`, #211, #233): `entry_id`, `item_id`, `linked_at`. The items linked to an entry; `entry_id` refers to `journal_entries.id` and `item_id` to `items.id`. See `database/migrations/017_journal_entry_items.sql`.

`notion_pages` (ordered by `id`, #241): `id`, `notion_id`, `parent_notion_id`, `kind`, `title`, `body`, `path`, `notion_edited_at`, `imported_at`, `deleted_at`. The pages and databases imported from Notion, with the tree kept by Notion ids (`parent_notion_id` is `null` for a top page); `deleted_at` is set for a page that is gone from Notion. See `database/migrations/018_notion_pages.sql`.

`essays` (ordered by `id`, #239, #253): `id`, `title`, `body`, `written_date`, `status`, `tags`, `created_at`, `updated_at`. `status` is `draft` or `done`; `tags` is an array of strings. See `database/migrations/015_essays.sql`.

`learned_terms` (ordered by `term_id`): `term_id`, `learned_at`. A `term_id` refers to a term in `backend/src/terms-data.ts`; ids are never renamed (`backend/test/term-ids.txt`).

`audit_log` (ordered by `id`): `id`, `at`, `actor_type`, `actor_id`, `client`, `tool`, `action`, `entity`, `entity_id`, `result`, `before`, `after`, `request_id`. The change history of AI tool calls and routes; it is in the export so a restore keeps it (owner decision on #208, option B, 2026-11-26). See `database/migrations/008_audit_log.sql`. The nightly backup deletes rows older than a year, so the file holds only what is left.

### Not in the export

- `app_settings`: no code reads or writes it yet. It joins the export when a setting is stored there.
- `schema_migrations`: the migration runner's own table.
- Photos (#29): not included until that issue decides where they are stored.

## Restore

`POST /api/restore` (Settings › Restore records, #209) takes the JSON file as the request body, up to 100 MB (`backend/src/restore.ts`; every other route keeps the 256 kB limit).

- The whole file is checked before anything changes: `format`, `version` 1, the tables, and every row's fields and types. `item_quotes`, `item_logs`, `audit_log`, `journal_entries`, `journal_entry_items`, `notion_pages`, and `essays` may be missing (files made before #217, #214, the 2026-11-26 owner decision on #208, #233, #241, and #253 have none; a missing table restores as empty); `items` and `learned_terms` may not. A quote or log must belong to an item in the file, of a category that takes it (quotes: `reading`; logs: `LOG_CATEGORIES`, now `drink` and `travel`), as the API requires. Two entries may not share a date, and a link needs its entry and its item in the file, with the item completed on the entry's date (the API's rule, #211). Unknown fields and tables are refused, not dropped, so a file from a newer app is never restored with data missing. Two rows with the same key are refused. The answer names the first problems by path, such as `tables.items.2.title: Title must not be empty`.
- Then, in one transaction: lock the tables (`items` first), delete every row (children first; the entries' links and the entries go before `items`, whose delete would cascade into the links), insert the file's rows with their own ids (`OVERRIDING SYSTEM VALUE`, parents first), and move the id sequences of `items`, `item_quotes`, `item_logs`, `journal_entries`, `notion_pages`, `essays`, and `audit_log` past their largest id, so a new row gets the next id. A row the database refuses (a CHECK) rolls everything back and answers 400 with the rule's name.
- A restore replaces all data; it never merges (owner decision on #209). The screen shows the counts in the file and asks for confirmation first, and suggests downloading a fresh export before.

## Adding a column

A new column of an exported table is added to its `columns` list and its `SELECT` in `EXPORT_TABLES` in the same PR, and to restore (the row schema and the column lists of the `INSERT` in `backend/src/restore.ts`). A column added after version 1 should be optional in the row schema, so older files still restore; `jsonb_to_recordset` gives `NULL` for a missing field, so the `INSERT` uses `COALESCE` to the column default where the column is `NOT NULL`. `backend/test/export.integration.test.ts` compares the exported columns of `items`, `item_quotes`, `item_logs`, `journal_entries`, `journal_entry_items`, `notion_pages`, `essays`, and `audit_log` with each table's columns, so a forgotten column fails the test.

## Adding a table

A lane that adds a data table adds it to the export and to restore in the same PR:

1. Add the table to `EXPORT_TABLES` in `backend/src/export.ts`, after the tables it refers to, with every column (timestamps through `utc()`, `numeric` cast to `float8`) and `ORDER BY` its primary key.
2. Add it to the table list above.
3. Add it to restore: its row schema and the `tables` object in `exportFile`, and its delete and insert in `replaceRecords` (`backend/src/restore.ts`; delete children before parents, insert parents first). A table added after version 1 should be optional in `tables` (missing means empty), so older files still restore.
4. Extend the export and restore integration tests (`backend/test/export.integration.test.ts`, `backend/test/restore.integration.test.ts`) with a seeded row.

Adding a table or a column keeps `version` at 1 as long as restore treats a missing table as empty. Raise `version` when a column is renamed or removed or a value changes meaning, and teach restore to read the older version or to refuse it with a clear message.

## Items CSV

File name: `life-journal-items-YYYY-MM-DD.csv`. It is for reading in a spreadsheet; restore uses the JSON file.

- UTF-8 with a byte order mark, so Excel shows Korean text correctly.
- RFC 4180: a header row with the `items` column names above, then one row per item, CRLF line ends.
- Every value is quoted, and a quote inside a value is doubled, so commas, quotes, and line breaks stay inside their field.
- `null` is an empty unquoted field; an empty text is `""`.
- `details`, `sub_ratings`, `tags`, and `companions` are JSON text. Timestamps, dates, and numbers are written as in the JSON file.
- Values are not changed to stop a spreadsheet from reading a leading `=`, `+`, `-`, or `@` as a formula: the file holds only my own records, and changing them would break the round trip.
