# Review and Journal App

A personal service for recording experiences such as book and movie reviews, diary entries, plays, and concerts. The only user is the owner, and it runs locally without a login.

## Development baseline

Node.js **24.21.0**, npm **11.19.0**. Install with `npm ci --ignore-scripts` (after the user confirms), format with `npm run format`, and run the full verification with `npm run check`. Follow the [development environment document](docs/project-setup.md) and [AGENTS.md](AGENTS.md) for the full baseline.

Changes go through these steps in order: **GitHub issue → branch named with the issue number → implementation, tests, and docs record → `npm run check` → PR → automated code review (at most 2 rounds; large fixes are split into a new issue) → agent merges after CI passes**.

## Run

```powershell
Copy-Item .env.example .env
docker compose up --build -d
```

Open http://localhost:8104 . Change the password in `.env` before you run it. Data is stored in the `life-journal-data` volume, and `docker compose down -v` deletes the data.

Development run:

```powershell
docker compose up -d db
npm run dev
```

Vite http://localhost:5204, API http://localhost:3104/api/health, host DB port 15404.

## Verification

- `npm run check`: format, lint, types, tests, skill sync check, build.
- The DB integration tests need `TEST_DATABASE_URL`, pointing to a dedicated test DB with the migrations applied. They are skipped when it is not set.
- GitHub Actions runs the full check with a PostgreSQL service and builds the Docker images.

## Repository layout

This repository is an umbrella monorepo that holds all the source. `frontend`, `backend`, and `database` are synced with `git subtree split` to the private deployment repositories `life-journal-frontend`, `life-journal-backend`, and `life-journal-db` (`scripts/push-repositories.ps1`, only on request). AWS infrastructure is managed in the shared repository `shared-aws-infrastructure`.

## Docs

- [AI instructions](AGENTS.md) · [Claude instructions](CLAUDE.md) · [DB](database/README.md)
- [Change records](docs/changes/README.md) · [Daily logs](docs/daily/README.md) · [Next steps](docs/next-steps/README.md)
