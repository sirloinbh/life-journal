# Write essays (#239)

## Purpose

User requirement of 2026-11-26: add essay writing to life-journal. An Essays page lists the essays and opens an editor with a title, a Markdown body, a written date, a status, and tags; drafts save on their own.

## Changes

- Migration `015_essays.sql`: table `essays` (title 1 to 200 characters, body up to 50,000 characters, written date, status draft or done, tags with the item tag rules, created and updated times). Safe to run again.
- API `/api/essays`: list (search in title and text, tag, status, paging; the list has word counts and no text), `GET /api/essays/tags` (tags already used), get, create (an empty body makes an untitled draft of today), partial update, delete. Every change writes an `audit_log` row in the same transaction, without the text (`omit: ['body']`). OpenAPI updated.
- Essays page (`/essays`, menu entry after 12 weeks, before the other pages): filters by search, tag (picked from used tags) and status (picked); "New essay" creates an untitled draft and opens it.
- Editor (`/essays/<id>`): title, written date, Draft or Done, tags (used tags are suggested, new ones can be typed), Markdown text with a Write and Preview switch and a word count. It saves by itself 3 seconds after the last change, on "Save now", and when the editor is left; the status line shows saved or unsaved.
- The Markdown preview (`markdown.tsx`) is written here, with no new package: headings, paragraphs, lists, quotes, code blocks, bold, italic, code, and web links. It builds elements, so typed HTML never reaches the page.

## Verification

- `npm run check`: see the PR.
- Tests: `essays.test.ts` (refused input), `essays.integration.test.ts` (runs with the test database in CI), `essays.test.tsx`, `markdown.test.tsx`, menu order in `app.test.tsx`.

## Limits

- Essays are not part of the export and restore file, like the journal entries; the nightly database backup includes them.
- Two tabs editing the same essay overwrite each other's last save (one user, no merge).
