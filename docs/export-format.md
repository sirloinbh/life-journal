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
    "learned_terms": [{ "term_id": "wine-tannin", "learned_at": "2026-11-20T00:00:00.000004Z" }]
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

### Value rules

- Every column of the table is in every row, with `null` for an empty column. A row never leaves a column out.
- `timestamptz` columns are UTC text with microseconds: `2026-11-20T01:11:12.123456Z`. A JavaScript `Date` keeps only milliseconds, so this keeps the exact value for restore.
- `date` columns are `YYYY-MM-DD`.
- `bigint` and `integer` columns are JSON numbers. `numeric` columns (such as `rating`) are JSON numbers.
- `jsonb` columns are JSON values as stored (objects for `details` and `sub_ratings`).
- Rows are sorted by primary key.

### Tables in version 1

`items` (ordered by `id`): `id`, `category`, `subtype`, `title`, `status`, `cost_krw`, `planned_date`, `completed_date`, `details`, `rating`, `sub_ratings`, `review`, `link`, `created_at`, `updated_at`. The column meanings and checks are in `database/migrations/002_items.sql` to `009_items_check_names.sql`.

`learned_terms` (ordered by `term_id`): `term_id`, `learned_at`. A `term_id` refers to a term in `backend/src/terms-data.ts`; ids are never renamed (`backend/test/term-ids.txt`).

### Not in the export

- `audit_log`: an operations log, not a record (owner decision on #208).
- `app_settings`: no code reads or writes it yet. It joins the export when a setting is stored there.
- `schema_migrations`: the migration runner's own table.
- Photos (#29): not included until that issue decides where they are stored.

## Adding a column

A new column of an exported table is added to its `columns` list and its `SELECT` in `EXPORT_TABLES` in the same PR, and to restore. `backend/test/export.integration.test.ts` compares the exported `items` columns with the table's columns, so a forgotten column fails the test.

## Adding a table

A lane that adds a data table adds it to the export and to restore in the same PR:

1. Add the table to `EXPORT_TABLES` in `backend/src/export.ts`, after the tables it refers to, with every column (timestamps through `utc()`, `numeric` cast to `float8`) and `ORDER BY` its primary key.
2. Add it to the table list above.
3. Add it to restore (#209), and extend the export integration test (`backend/test/export.integration.test.ts`) with a seeded row.

Adding a table or a column keeps `version` at 1 as long as restore treats a missing table as empty. Raise `version` when a column is renamed or removed or a value changes meaning, and teach restore to read the older version or to refuse it with a clear message.

## Items CSV

File name: `life-journal-items-YYYY-MM-DD.csv`. It is for reading in a spreadsheet; restore uses the JSON file.

- UTF-8 with a byte order mark, so Excel shows Korean text correctly.
- RFC 4180: a header row with the `items` column names above, then one row per item, CRLF line ends.
- Every value is quoted, and a quote inside a value is doubled, so commas, quotes, and line breaks stay inside their field.
- `null` is an empty unquoted field; an empty text is `""`.
- `details` and `sub_ratings` are JSON text. Timestamps, dates, and numbers are written as in the JSON file.
- Values are not changed to stop a spreadsheet from reading a leading `=`, `+`, `-`, or `@` as a formula: the file holds only my own records, and changing them would break the round trip.
