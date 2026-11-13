# Review and Journal App specific instructions

This file holds rules that apply only to life-journal. The shared instructions are in [AGENTS.md](AGENTS.md), which becomes a centrally managed file after the central standards (`sirloinbh/project-standards`) sync. If the two files differ, this file wins.

## Work procedure (in addition to the shared procedure)

- **After you open a PR, it goes through automated code review at most 2 times. If a review finds something to fix, apply it in an extra commit, and get one more review after the first round of fixes. Do not review again after the second round of fixes. If a review finds nothing, go straight to the next step. A fix that is too large for this PR becomes a new issue card. After that, once all required CI checks on the final head pass, the agent (the main agent or a local worker) merges the PR without asking.** The detailed review steps follow section 5 of the implementation skill. With the project wrapper, run `pr merge <url> --merge --match-head-commit <confirmed head SHA>` (merge commit) and check that the linked issue (`Closes #N`) was closed. Merge consecutive PRs in order. After the earlier PR merges, merge `origin/main` into the next branch, resolve conflicts, re-run the related tests, push normally (no force), and merge after CI passes. Do not merge with a failing or running check, bypass branch protection (for example with `--admin`), approve your own PR as a substitute for review, commit or push directly to `main`, or force push. In this project a merge to `main` does not trigger a deploy (deploy only on a separate request).

## Project skills

- [life-journal-implementation](skills/life-journal-implementation/SKILL.md), [life-journal-testing](skills/life-journal-testing/SKILL.md), [life-journal-foundation](skills/life-journal-foundation/SKILL.md): these contain this project's review and merge steps, so they are kept even after the shared skills (std-*) arrive.

## Service rules

- None yet. When a domain rule that applies only to this project comes up, write it here.
