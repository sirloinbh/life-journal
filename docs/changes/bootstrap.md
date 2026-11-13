# Initial development environment setup (before issues)

- Date: 2026-10-19 (Asia/Seoul)
- Baseline: the workout-memo [development environment setup document](../project-setup.md) (workout-memo PR #57)

## Purpose

Prepare the development environment, a minimal app, verification, and repositories so that the life-journal project can be developed issue by issue. Detailed features proceed after the user registers issue cards.

## Content

- Stack: React 19 + Vite + TypeScript, Express 5 + pg + Zod, PostgreSQL 17, npm workspaces, Docker Compose, GitHub Actions. Node 24.21.0 / npm 11.19.0.
- Dependencies: used only the same packages and versions as the workout-memo lockfile (only the workspace names changed). Installed with `npm ci --ignore-scripts` with the user's approval, and added no new packages. `npm audit`: 0 vulnerabilities.
- Minimal app: `GET /api/health` (DB check, service date), Korean 404 and 500 error handling, sidebar, page header, status display, empty state screen, and CSS-variable design tokens.
- DB: `database/migrations/001_initial.sql` (`app_settings`, safe to run again). For applying to an existing DB, only the `psql -f` method is described.
- Tests: unit (`health.test.ts`), DB integration (`db.integration.test.ts`, skipped if there is no `TEST_DATABASE_URL`), UI (`app-ui.test.ts`, vm harness), and the skill sync check.
- AI instructions: `AGENTS.md`, `CLAUDE.md`, and 3 skills (originals in `skills/`, copies in `.claude/skills/`).
- Repositories: the umbrella `sirloinbh/life-journal` + the private deployment sub-repositories `life-journal-frontend`, `life-journal-backend`, and `life-journal-db` (subtree). AWS uses the shared `shared-aws-infrastructure`.

## Verification

- Applied the migrations as UTF-8 to a dedicated test DB `life_journal_test` (the test container of workout-memo) and ran `npm run check`: **exit 0**.
  - App and DB tests **8 pass / 0 fail / 0 skip** (the DB integration test actually ran)
  - Skill check **4 pass / 0 fail / 0 skip**
  - Format, lint, and types pass, and the frontend and backend builds pass
- The real browser check was done in study-log, which was made from the same template (no horizontal scroll at mobile 390px, status and menu switching normal, PC 1440px normal). This project differs only in title and port, and was checked with the UI tests.
- The initial commit was pushed directly to `main` to create the repositories. All later changes go through issue → branch → PR.
- The Docker image build is checked with the `docker-build` job of GitHub Actions. We did not run a local `docker compose up`.
