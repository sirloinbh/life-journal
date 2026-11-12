# #24 Research on external information sources by area

- Issue: [#24](https://github.com/sirloinbh/life-journal/issues/24)
- Branch: `docs/24-external-sources`

## Purpose

Decide which sources to use for the requirement "use a source API if there is one". The app code is not changed.

## Changes — 2026-10-31

- `docs/research/external-sources.md`: the source to use per area, why other sources are not used, the terms conditions, how to store, how to keep API keys, and the limits of the research.
- Recorded the user decisions in issue comments and registered the implementation cards.
- Aladin, the first candidate, has ended and Naver book search also appears to have ended, so YES24 was added to the research. The user had put Kyobo Book Centre first, but no public API was found, so YES24 was chosen as the user decided.

## Verification

- Only docs changed, so no app tests were added.
- `npm run format:check`: pass.
- We reread the original pages to check the Aladin notice, the YES24 terms, and Article 4 item 10 of the Kakao operating policy. The limits of the other terms are written in "Limits of the research" in the document.
- We could not check the limits and provided fields with real calls because there is no key. They are checked in the implementation cards.

## First review applied — 2026-10-31

A separate agent reviewed head `16aebd4`. We applied all 8 findings (0 blocking the merge, 4 to fix, 4 minor).

- Fixed the YES24 limit to the official documentation values (10 per second, 20,000 per day). We reread the official documentation to check.
- Added the work to show external ratings, prices, and images to cards #42 to #45.
- Set the `source_fields` rule so that values the user edited are not overwritten.
- Added the unused sources for performances and the reasons, and removed the "only" wording that lacked evidence.
- Wrote the YES24 eligible user according to Article 2 of the terms.
- Moved the KOPIS key out of #40 and changed it to be applied for right before implementing #44.
- Added source links to the grounds for excluding alcohol sources.
- Matched the Naver end wording in the PR body to the document.

## Second review applied — 2026-10-31

A separate agent reviewed head `b5597c1`. We applied all 7 findings (0 blocking the merge, 2 to fix, 5 minor). As the rule says, there is no third review.

- Matched the display work and done criteria of cards #42 to #45 to the information the source provides. Also put tests for the terms obligations and the `source_fields` rule into the done criteria.
- Added the KOPIS key application step and the `needs-user` label to #44.
- Removed wording in the summaries of #42 and #43 that assumed a detail screen that does not exist.
- Document: fixed the assertive wording about the YES24 sample values, put KOPIS cost under not confirmed, and filled in the list of pages that could not be read.
