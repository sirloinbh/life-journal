# #128 Use patched minimatch 11 for ESLint packages

- Issue: [#128](https://github.com/sirloinbh/life-journal/issues/128) (parent [#127](https://github.com/sirloinbh/life-journal/issues/127))
- Branch: `chore/128-minimatch-11`

## Changes — 2026-11-18

Dependabot alert #10 ([GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), moderate) covers `minimatch >= 7.0.0, < 11.0.1`. `eslint`, `@eslint/config-array`, `typescript-eslint` and `eslint-plugin-jsx-a11y-x` ask for `minimatch ^10`, so the lockfile had `10.2.6`. The fix will not be backported to 10.x, so we force 11.x with overrides. This is a dev-only dependency; the app does not ship it.

- Root `package.json`: added `overrides` that pin `minimatch` to `11.0.4` under `eslint`, `typescript-eslint` and `eslint-plugin-jsx-a11y-x`. The overrides are scoped to these packages so that `rimraf`'s `glob@7`, which needs `minimatch` 3, is not touched. `11.0.4` is the same version that sirloinbh/dev-career-portfolio and sirloinbh/plan-routine use, and it was released more than two weeks ago.
- `package-lock.json`: updated with `npm install --ignore-scripts` (the user approved the package change). Only the `node_modules/minimatch` entry changed, from `10.2.6` to `11.0.4`. Its new dependencies (`@isaacs/nonrecursive-glob-match` 1.1.0, `brace-expansion` 5.0.12) were already in the lockfile.
- Compatibility: these packages use only `new Minimatch()`, `.match()`, `.pattern` and `minimatch()`, which 11.x keeps. 11.x removes `makeRe` and the `AST` export, which none of them use.
- `docs/next-steps/README.md`: replaced the `minimatch` line with the Dependabot `basic-ftp` PR #119.

## Verification

- `npm ls minimatch --all`: no 10.x left. The ESLint packages use `11.0.4`, `glob@14` (through `@lhci/cli`) keeps `11.0.9`, and `rimraf`'s `glob@7` keeps `3.1.5`, which the advisory does not cover. No invalid or missing entries.
- `npm audit`: `minimatch` is no longer listed. `basic-ftp` (PR #119) and `picomatch` remain; they are outside this card.
- `npm run check`: format, lint (`eslint . --max-warnings 0`, which runs every file through the overridden `minimatch`), contract check and typecheck passed. The backend DB integration tests failed with `ECONNREFUSED 127.0.0.1:5432` because the local PostgreSQL service was stopped and could not be started without admin rights.
- Without `TEST_DATABASE_URL`, the remaining steps passed: `npm test` (backend 143 passed, 22 skipped DB tests, 0 failed; frontend 164 passed, 3 skipped), `npm run test:skills` (4 passed) and `npm run build`. The DB tests run in the PR CI, which has its own PostgreSQL.
- No app code or screen changed, so we did not check in a browser.

## Follow-up

- Remove the overrides once these packages accept `minimatch` 11 (the same follow-up as sirloinbh/dev-career-portfolio#62).
