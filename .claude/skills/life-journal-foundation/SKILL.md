---
name: life-journal-foundation
description: Establish or improve the repeatable development foundation of the life-journal app, covering stack, structure, conventions, API contracts, design, tests, AI guidance, and deployment. Use for project foundation requests; apply only the requested scope through the life-journal-implementation issue-to-PR workflow.
---

# Review and Journal App development foundation

Organize how this app is developed, verified, and operated so that it can be repeated. First read `AGENTS.md` in the project root and `skills/life-journal-implementation/SKILL.md`, then work through these steps: issue → numbered branch → implementation and docs record → tests and PR → automated code review (at most 2 rounds) → merge after CI passes. This skill does not skip the issue and PR steps and does not grant deploy permission.

## Baseline

- The baseline document is `docs/project-setup.md`. Check the current package.json, lockfile, API and SQL, Compose, and CI to tell what is actually implemented from what is only recommended (not adopted). Do not install the whole recommendation list automatically.
- The only user is the owner, and a login is not in the current requirements. Dates are in Asia/Seoul.
- When you change or add a tool, first write down the real problem, the effect on data, and the verification method, and install packages only after the user reconfirms.

## Steps

1. Decide the current state and the issue done criteria, and record the reason for the choice, the structure, and the contracts in the docs.
2. Align tool settings, run commands, CI, and docs in the same change. Do not create unused settings, scripts, or empty modules.
3. For API and DB changes, keep the meaning of existing data and of dates and units, and verify how migrations are applied and how a failure is recovered. Decide on a single source for DB migrations.
4. For screen changes, keep the design tokens (the CSS variables in `frontend/src/style.css`) and the existing components, and handle loading, empty results, errors, and keyboard access within the relevant scope.
5. Apply `skills/life-journal-testing/SKILL.md` as well. Write the implementation and the tests together, add a regression test for a bug, and record the actual results in the docs and the PR.
6. Deploy only within the scope the user requested. Prepare image versions, health checks, secret management, backup and restore, and rollback to the previous version.
7. Include a docs record in each work commit and open a verified PR. After the PR, go through automated code review at most 2 times, apply findings in extra commits, and split large fixes into new issue cards. When all required CI on the final head passes, merge with a merge commit as the implementation procedure says.

## Done criteria

The docs must be enough to reproduce install, run, and verification in a new environment, and the chosen tools must show up in the real code, commands, and CI. State tools that are not installed, checks that were skipped, and deploys that were not actually done as follow-up work.
