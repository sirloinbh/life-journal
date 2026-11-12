# Policy for the agent to merge PRs automatically (#1)

- Issue: https://github.com/sirloinbh/life-journal/issues/1
- Date: 2026-10-21 (Asia/Seoul)

## Purpose

On 2026-10-21 the repository owner explicitly instructed a change to the merge policy. The rule "only the user merges PRs" becomes "the agent merges when all required CI checks pass", so that the same request does not have to be repeated in every project.

## Changes

- Step 5 of the implementation procedure in `AGENTS.md`: after CI passes, the main agent or a local worker merges without asking with `pr merge <url> --merge --match-head-commit <head SHA>` (merge commit) and checks that the linked issue was closed. It spells out the order for consecutive PRs and the prohibitions (failing or running checks, bypassing with `--admin`, self-approval, direct commits and pushes to `main`, and force push). It states that in this project a merge to `main` does not trigger a deploy.
- `skills/life-journal-implementation/SKILL.md`: changed the front matter description and step 5 to "merge after CI passes".
- `skills/life-journal-foundation/SKILL.md`, `skills/life-journal-testing/SKILL.md`: changed the user-only merge wording to the new policy.
- `.claude/skills/`: updated with `npm run skills:sync` (not edited directly).
- `README.md`, `docs/project-setup.md` (safety rule 2, Git strategy, file roles table, AGENTS template): aligned with the same policy.
- Past records (`docs/changes/bootstrap.md`, `docs/daily`) were not changed.

## Verification

- `npm run skills:sync` → `npm run skills:check`: `.claude/skills matches skills/.`
- `npm run test:skills`: **4 pass / 0 fail / 0 skip**
- skill-creator `quick_validate.py` (`PYTHONUTF8=1`) on the 3 skills: all `Skill is valid!`
- Format of the changed files: this repository has no `node_modules`, so we ran `prettier --check` with prettier 3.9.10 of the same version (the workout-memo install): pass
- There was no app code change, so no app tests were added. We did not run the whole local `npm run check` because dependencies were not installed (installing packages needs the user to reconfirm), and we check it with `npm run check` in GitHub Actions.

## Limits and follow-up

- Branch protection (naming required checks) cannot be queried because of a private repository plan limit (HTTP 403). "Required CI checks" is read as all CI checks reported on the PR.

## 2026-10-21 — Automated review after the PR (at most 2 rounds)

### Purpose

The repository owner asked to complete the merge policy. After a PR is opened, it goes through automated code review at most 2 times (review → fix commit → second review → fix commit). A fix that is too large for this PR is split into a new issue card, and after that the PR is merged once the required CI on the final head passes. If a review finds nothing to fix, it goes straight to the CI check and the merge.

### Changes

- `skills/life-journal-implementation/SKILL.md`: added "5. Automated code review after the PR (at most 2 rounds)" between "4. Open a PR after testing" and the merge. The content is the first and second reviews, fix commits, no third review, the criteria for splitting large fixes into a new issue, the conditions for holding the merge, a record per round, and merging after CI on the final head. The existing merge section was renumbered "6. Merge after CI passes". The YAML description and the introduction were also changed to include the review step.
- Reflected a short summary in step 5 of the implementation procedure in `AGENTS.md`, the order of progress in `README.md`, `docs/project-setup.md` (safety rule 2, the order in the Git strategy, a new review item, the file roles table, and step 5 of the AGENTS template), the foundation skill (introduction, step 7), and the testing skill (introduction, run criteria).
- Kept the existing safety prohibitions (merging with failing or running checks, bypassing protection such as `--admin`, approving your own PR, direct commits and pushes to `main`, and force push) and the handling of stacked PRs.
- Updated `.claude/skills/` with `npm run skills:sync`. Past records (`docs/changes/bootstrap.md`, `docs/daily`) were not changed.

### Verification

- `npm run skills:sync`, then `npm run skills:check`: `.claude/skills matches skills/.`
- `npm run test:skills`: 4 pass / 0 fail / 0 skip
- `PYTHONUTF8=1 python quick_validate.py skills/<skill>` (codex skill-creator, 3 skills: implementation, foundation, testing): all `Skill is valid!`
- `npx --no-install prettier --check AGENTS.md README.md docs skills .claude/skills` (prettier 3.9.10): pass
- We did not run lint, typecheck, app tests, and build (the whole `npm run check`). This checkout has no `node_modules`, and `AGENTS.md` makes package installs subject to the user's reconfirmation. It is a docs and skills change with no app code change, and the full check is done in GitHub Actions CI.
