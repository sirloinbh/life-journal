# #97 Translate the current Korean docs to English

- Issue: [#97](https://github.com/sirloinbh/life-journal/issues/97)
- Branch: `docs/97-english-docs`
- Parent: sirloinbh/project-standards#487

## Changes — 2026-11-13

Translated the current Korean markdown files outside `docs/changes/` and `docs/daily/` to English. Commands, paths, identifiers, issue and PR numbers, and code blocks were kept.

- `README.md`, `backend/README.md`, `frontend/README.md`, `database/README.md`
- `AGENTS.project.md`
- `docs/project-setup.md` (the heading anchor in the introduction is now `#11-bootstrap-checklist`)
- `docs/research/external-sources.md`, `docs/next-steps/README.md`
- the READMEs of `docs/changes/` and `docs/daily/`
- `skills/life-journal-*/SKILL.md` and their copies in `.claude/skills/` (synced from `skills/`)

Skipped because they are centrally managed: `AGENTS.md`, `skills/std-git-writing/SKILL.md` and its copy, and `.standards/lib/render.mjs`. The central repository translates them.

Hangul kept on purpose: one quoted data example in `docs/project-setup.md` (the brand name `'기타'`, meaning "other", in the PowerShell encoding pitfall).

## Verification

- `node node_modules/prettier/bin/prettier.cjs --check` on the changed files: pass
- `npm run skills:check`: pass (`.claude/skills` matches `skills/`)
- `npm run test:skills`: pass (4 tests)
- Hangul search over the scope: only the item above remains
