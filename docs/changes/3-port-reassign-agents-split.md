# #3 Change ports to the central standard (slot 04) and split the AGENTS project-specific rules

- Issue: https://github.com/sirloinbh/life-journal/issues/3
- Central tracking issue: https://github.com/sirloinbh/project-standards/issues/99

## Purpose

- Apply the ports that the central registry reassigned so that the ports of the 8 apps do not overlap (project-standards ADR-0006).
- Before the first central standards sync turns AGENTS.md into the shared instructions, move this project's PR review and merge rules to AGENTS.project.md and keep them.

## Changes

| Kind                       | Before | After         |
| -------------------------- | ------ | ------------- |
| Web                        | 8094   | 8104          |
| API                        | 3014   | 3104          |
| Vite                       | 5174   | 5204          |
| Host DB                    | 55444  | 15404         |
| e2e API and web (reserved) | none   | 3204 and 5304 |

- Files whose ports changed: `.env.example`, `README.md`, `backend/Dockerfile`, `backend/src/server.ts`, `compose.yaml`, `frontend/nginx.conf`, `frontend/vite.config.ts`, `AGENTS.md`
- Moved step 5 of `AGENTS.md` (the automated code review and merge rules) word for word into the "Work procedure" of `AGENTS.project.md`, and made `AGENTS.md` require reading that file.
- Past records in `docs/changes/`, `docs/daily/`, and `docs/next-steps/` were not changed, because they describe the state at that time.

## What the user does

- In the local `.env`, change the `DATABASE_URL` port from `55444` to `15404` and `PORT` from `3014` to `3104`. Do not commit `.env`.

## Verification

- 2026-10-22: the result is written in the PR body.
