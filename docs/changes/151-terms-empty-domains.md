# #151 Stop the terms page crashing on an empty domain list

- Issue: [#151](https://github.com/sirloinbh/life-journal/issues/151)
- Branch: `fix/151-terms-empty-domains`

## Purpose

`frontend/src/terms-study.tsx` sent an unknown or missing domain to `data.domains[0].key`. When the server answered with no domains, that threw a TypeError, and with no error boundary the whole page went blank.

## Changes

- `TermsStudy` reads the first domain with `data.domains.at(0)`. With no domain it shows an empty state ("No terms yet") under the page heading instead of redirecting.
- `terms-study.test.tsx`: the fake API's domain list is now a field (`api.domains`), and a new test opens `/terms` and `/terms/wine` with `domains: []` and checks the empty state, the page heading, and that the address stays as it was.

## Verification

- `npm run test -w frontend -- src/terms-study.test.tsx`: 21 passed. With the old `terms-study.tsx` the two new cases fail (checked once by hand).
- Browser: Vite dev server on 5204 with `/api/health` and `/api/terms` stubbed by Playwright (`domains: []`), Chrome at mobile 390×844 and PC 1440×900, at `/terms` and `/terms/wine`: the empty state shows under the "Study terms" heading, the address does not change, no horizontal overflow, 0 console errors.
- `npm run check`: see the PR body.

## Limits

- The real server always returns its fixed domains, so the empty case was checked only with a stubbed API.
