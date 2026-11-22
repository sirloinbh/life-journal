# #158 Install @tanstack/react-query on the sync PR that brings the shared query layer

- Issue: [#158](https://github.com/sirloinbh/life-journal/issues/158) (step 1 of 2; the screen migration follows in its own PR)
- Sync PR: #181 (branch `chore/standards-sync-845dbce`, project-standards@ed89066)
- Central: sirloinbh/project-standards#1013 (PR #1014) set `features.query` to `true` for life-journal, so this sync brings `frontend/src/lib/query.ts` and `query.test.tsx`

## Why on the sync PR

`query.ts` imports `@tanstack/react-query`, so the sync PR cannot pass typecheck without it. An install-only PR before the flag fails the CI knip step instead, because this app has `knipStrict: true` and nothing would import the package yet. project-standards AGENTS.md allows a commit on a sync PR when it is not titled `chore: sync central standards ...`.

## Change — 2026-11-23

- `npm install --ignore-scripts --save-exact @tanstack/react-query@5.104.1 -w frontend`, reconfirmed by the user on 2026-11-23 (comment on #158). `frontend/package.json` gains one dependency line (npm re-sorted the devDependencies; the original order was restored so the diff is one line). `package-lock.json` gains `@tanstack/react-query` 5.104.1 and `@tanstack/query-core` 5.104.1 only.
- `npm run lockfiles:sync` from the card does not exist any more (project-standards ADR-0022 removed the sub-lockfiles), so it was not run.

## Package review (docs/dependency-policy.md in project-standards)

| Check                 | @tanstack/react-query 5.104.1                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| Released              | 2026-10-02                                                                                               |
| License               | MIT (lockfile entry)                                                                                     |
| Publisher, repository | TanStack, github.com/TanStack/query                                                                      |
| Install scripts       | None                                                                                                     |
| Dependencies          | One: @tanstack/query-core 5.104.1 (MIT)                                                                  |
| Approval              | User decision A on 2026-11-19 (project-standards#690, ADR-0027); install reconfirmed on #158, 2026-11-23 |

## Verification

- `node .standards/ioc-scan.mjs`: `ioc-scan: no suspicious items` (it also notes the existing esbuild and fsevents install scripts, which do not run with `--ignore-scripts`).
- `npm ci --ignore-scripts` after the install leaves the tree clean; `npm audit` during install: 0 vulnerabilities.
- `npm run standards:check`: passed (central sirloinbh/project-standards@ed89066).
- `npm run check` with `TEST_DATABASE_URL` set to a throwaway PostgreSQL 17 (`journal_test`, migrations 001-009): pass. Backend 191 passed, 0 skipped; frontend tests include the synced `lib/query.test.tsx`; contract 3; skills 4; build.
- `npm run knip` (with `TEST_DATABASE_URL`, as in CI): no findings (only configuration hints).
