# #96 Translate past records in docs to English

- Issue: [#96](https://github.com/sirloinbh/life-journal/issues/96)
- Branch: `docs/96-english-records`
- Parent: sirloinbh/project-standards#487

## Changes — 2026-11-13

Translated the past records to English: 25 files in `docs/changes/` and 3 files in `docs/daily/` (`2026-10-19.md`, `2026-11-01.md`, `2026-11-02.md`). Headings, command output, file paths, identifiers, dates, and issue and PR numbers were kept. There is no `docs/adr/` folder in this repository.

The README files of `docs/changes/` and `docs/daily/` are index pages and are translated in #97.

Hangul kept on purpose:

- The Korean term names in the lists of `70-wine-terms.md`, `71-whisky-terms.md`, `72-literature-terms.md`, and `73-stage-screen-terms.md`. They are the app data stored in `backend/src/terms-data.ts`, and the lists show them as stored.
- Short Korean UI strings quoted with an English gloss in parentheses, in `23-bucket-list.md`, `41-item-link.md`, `69-terms-screen.md`, `74-coffee-category.md`, and one command output line in `83-migrate-command.md`.
- One quoted term, "악극" (music drama), in `73-stage-screen-terms.md`.

## Verification

- Prettier `--check` on the changed files: pass
- Hangul search over `docs/changes/` and `docs/daily/` (README files excluded): only the items above remain
