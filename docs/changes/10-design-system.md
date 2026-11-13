# #10 Switch screens to the shared design system

- Issue: [#10](https://github.com/sirloinbh/life-journal/issues/10) (central tracking issue sirloinbh/project-standards#126)
- Branch: `feat/10-design-system`

## Purpose

The 8 apps agreed to use the same tokens, components, layout, and PWA settings (central ADR-0007 and ADR-0008). We followed "Converting an existing app" in the central `docs/design-system.md` (workout-memo#160 applied it first).

## Changes — 2026-10-26

### Packages

The user installed them directly. They are the packages in the central ADR-0007 table (pre-approved 2026-10-22) and react-router, vitest, jsdom, and Testing Library (approved 2026-10-26). All are pinned versions, 14 days since publication, and `--ignore-scripts`.

- dependencies: `@sirloinbh/design-tokens` 1.0.0, `class-variance-authority` 0.7.1, `clsx` 2.1.1, `radix-ui` 1.7.0, `react-router` 8.4.0, `sonner` 2.0.8, `tailwind-merge` 3.7.0, `tw-animate-css` 1.4.0, `vaul` 1.1.2, `lucide-react` 0.468.0 → 1.52.0
- devDependencies: `tailwindcss`·`@tailwindcss/vite` 4.3.3, `vitest` 5.0.3, `jsdom` 30.1.2, `@testing-library/react` 16.3.3, `@testing-library/dom` 10.4.2, `@testing-library/jest-dom` 7.0.1
- Two lockfiles (root and `frontend/`): no packages were removed, and the only version that changed is `lucide-react`. All new entries come from the official registry, have integrity values, and have no install script. `ioc-scan`: no suspicious items

### Shared files (centrally managed)

They are exactly what was extracted from a sync preview with this app's `features.ui` and `features.vitest` turned on centrally: 15 files in `frontend/src/components/ui/` with tests, `components/layout/`, `lib/utils.ts` and `theme.ts`, `public/theme-init.js`, and `frontend/vitest.config.ts`.

### App code

- **Screens:** replaced the own shell (sidebar and header) with `AppShell` and attached page addresses (`/`, `/settings`). The own `style.css` was removed, and the shared tokens and `EmptyState` are used.
- **Entry points:** `app.tsx` (screen), `main.tsx` (rendering, and service worker registration only in the production build), and `index.css` (Tailwind, `tw-animate-css`, shared tokens).
- **PWA:** 4 icons (central `scripts/pwa-icons.mjs`), and in `index.html` the manifest, icons, light/dark `theme-color`, `viewport-fit=cover`, and a flash-prevention script.
- **Tests and build:** put a `test` (vitest) script and `src/test/setup.ts` in `frontend`, and the root `npm test` also runs the frontend tests. The production build excludes test files with `tsconfig.build.json`. A Tailwind plugin in `vite.config.ts`.
- **Removed the screen test in the backend:** `backend/test/app-ui.test.ts` was a temporary test that ran `main.tsx` with a fake React when there was no Vitest. The frontend Vitest tests check the same things (title, server state, error alert, menu navigation) with real React, so we removed it.
- **Screen test (`app.test.tsx`):** showing the server date, the server error alert, moving between pages with the menu and showing the current page, and handling unknown addresses.

## Verification

- Prettier, ESLint, `tsc` (all), 40 frontend tests passed, `vite build`, `ioc-scan`
- Backend tests need a DB, so they are checked in CI.
