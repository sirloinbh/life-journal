# Research on external information sources by area

- Issue: [#24](https://github.com/sirloinbh/life-journal/issues/24)
- Research date: 2026-10-31. Terms and limits can change, so check them again right before implementation.

## Decision

| Area             | Source to use                      | User decision                                                |
| ---------------- | ---------------------------------- | ------------------------------------------------------------ |
| Books            | YES24 Open API                     | Kyobo Book Centre first, otherwise YES24                     |
| Movies and shows | TMDB                               | Research recommendation (free for non-commercial use)        |
| Performances     | KOPIS                              | Research recommendation (specialist source for performances) |
| Alcohol          | None. Manual entry plus link       | Recommended option chosen                                    |
| Travel           | Korea Tourism Organization TourAPI | Focus on sights and events                                   |

External ratings, prices, and images are only displayed, not recorded.

No public Open API was found for Kyobo Book Centre, so YES24 was chosen. A search did not find developer documentation, and the guessed `developers.kyobobook.co.kr` had no address. This does not confirm that there is no partner API that is not public.

## Sources not used, and why

| Area             | Source                                       | Reason                                                                                                                                                                                                                    |
| ---------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Books            | Aladin                                       | [Ended 2026-10-30](https://blog.aladin.co.kr/cscenter/17483675)                                                                                                                                                           |
| Books            | Naver book search                            | Ended 2026-07-31, no replacement API ([secondary source](https://newsway.co.kr/news/view?ud=2026090215314059117), official notice not confirmed)                                                                          |
| Books            | Kakao book search                            | No ratings, and the alcohol-service restriction in Article 4, item 10 of its [operating policy](https://developers.kakao.com/terms/ko/site-policies) applies                                                              |
| Books            | National Library of Korea, Library Info Naru | No ratings confirmed, and terms and limits not confirmed                                                                                                                                                                  |
| Movies and shows | KOBIS                                        | Its [terms](https://www.kobis.or.kr/kobisopenapi/homepg/board/findProvisionInfo.do) forbid copying and storing, and it has no TV dramas                                                                                   |
| Movies and shows | KMDb                                         | The terms could not be read, and TV drama support is not confirmed. Review again if there are many older Korean films                                                                                                     |
| Performances     | National performance and event standard data | Local-government event data on [data.go.kr](https://www.data.go.kr/data/15013106/standard.do), updated quarterly, with no poster field. Not confirmed whether it includes private performances                            |
| Alcohol          | Vivino, Distiller                            | The terms of [Vivino](https://www.vivino.com/terms) and [Distiller](https://distiller.com/terms-of-service) forbid scraping, and no official API was found                                                                |
| Alcohol          | Whiskybase                                   | The price of the licensed [API](https://www.whiskybase.com/wp/api) is not confirmed, and the [terms](https://www.whiskybase.com/page/disclaimer) limit copying and collecting (from a summary; the original returned 403) |
| Alcohol          | Wine-Searcher                                | The [API](https://www.wine-searcher.com/trade/api) starts at $335 per month (from search results; the page itself returned 403)                                                                                           |
| Travel           | Kakao Local, Naver Local, Google Places      | The user chose a focus on sights and events. Kakao has the alcohol clause, Naver announced a move to paid, and Google has paid tiers and storage limits                                                                   |

## Conditions of the sources to use

### YES24 Open API (books)

- Provides: title, author, publisher, ISBN, list and sale price, cover URL, and the average star rating on a detail lookup ([API reference](https://github.com/yes24-AX/yes24-openapi-samples/blob/main/docs/api-reference.md)).
- Authentication and limits: `X-Api-Key` header, 10 calls per second and 20,000 per day for the basic key ([docs](https://developers.yes24.com/docs)). The sample repository says 5 per second and 5,000 per day, but follow the values in the official docs. The Basic plan is planned to stay free ([developer center](https://developers.yes24.com)).
- Terms ([original](https://developers.yes24.com/support/terms)):
  - Temporary caching to improve performance is allowed. For prices and stock, keep to the refresh cycle in the operating policy.
  - You must not build a separate DB by bulk or systematic accumulation, or provide the data to a third party.
  - On screens that show the data, show the source and include a link to the product detail page.
- Who may use it: Article 2 of the terms defines it as "an individual, corporation, or organization that operates in its own name". Check the actual issuance in #40.
- Not confirmed: the refresh cycle for prices and stock, and the clause on cover images.

### TMDB (movies and shows)

- Provides: combined movie and TV search, poster paths, overview, rating, and language selection ([search](https://developer.themoviedb.org/reference/search-multi)). Director and cast fields are not confirmed.
- Authentication and limits: Bearer token, about 40 calls per second ([limits](https://developer.themoviedb.org/docs/rate-limiting)). Free for non-commercial use.
- Terms ([original](https://www.themoviedb.org/api-terms-of-use)): the cache must not exceed 6 months, and the logo and notice must be shown.

### KOPIS (performances)

- Provides: performance list and poster URLs. Price, cast, and venue fields are not confirmed ([guide](https://kopis.or.kr/por/cs/openapi/openApiInfo.do?menuId=MNU_00074)).
- Conditions: one authentication key per person, and you must state that the data is based on KOPIS. The key is valid for 1 year, and approval is cancelled after 3 months of no use.
- Not confirmed: call limits, cost, storage and cache conditions, and the full terms. The body of the official page could not be read, so the conditions above were checked only from search result text. Check again after getting a key.

### Korea Tourism Organization TourAPI (travel)

- Provides: about 260,000 domestic tourism records, search by location, region, and keyword, events, lodging, and images ([API](https://www.data.go.kr/data/15101578/openapi.do)).
- Authentication and cost: `serviceKey` from data.go.kr, free. The development account limit is 1,000 calls based on another API from the same organization; the figure for this API is not confirmed.
- Conditions: photos are KOGL type 1 and 3, so a source credit is required, and type 3 forbids changes.
- Limit: how far ordinary restaurants and shops are covered is not confirmed.

### Alcohol: manual entry plus link

- Enter the name, producer, region of origin, vintage, and so on directly, and store the link the user pastes.
- Do not add a feature where the server fetches that link to fill in the content, because that is automated access.
- Do not crawl, because an open robots.txt does not remove the ban in the terms.

## How to store

Do not store search results; link only the one result the user picks to the item.

| Value                                     | Handling                                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| Values the user entered or edited         | Store                                                                                    |
| Values filled from outside and not edited | Store, and record the field name in `source_fields`                                      |
| Source information                        | Store `source`, `external_id`, `source_url`, `fetched_at`                                |
| External ratings and prices               | Load when the item is viewed and cache briefly. Do not record                            |
| Covers and posters                        | Show only from the external URL. Use a fallback image if it breaks. Do not save as files |

Values taken from TMDB are looked up again and refreshed within 6 months. A refresh overwrites only the fields in `source_fields`; a field the user edited is removed from that list, so it is left alone. The terms do not say whether the 6-month limit also applies to values the user confirmed, so they are handled conservatively like this. Long-term keeping of the one book picked from YES24 is not covered directly by the terms, so check it again in the implementation card.

There is no item detail screen now. Where to show external ratings, prices, and images is decided in the first card that is implemented.

## Keeping API keys

- Keep keys only in the backend `.env`. In `.env.example`, put only the names. Do not leave them in commits, docs, PRs, or logs.
- Do not use the `VITE_` prefix, because it is exposed to the browser. All external calls go through Express.
- Variable names: `YES24_API_KEY`, `TMDB_READ_ACCESS_TOKEN`, `KOPIS_SERVICE_KEY`, `TOURAPI_SERVICE_KEY`.
- The KOPIS and TourAPI keys are passed in the query string, so mask them in URL logs.
- If a key is missing or expired, turn off only the auto-fill for that area and keep manual entry. KOPIS cancels after 3 months of no use, so apply right before you implement #44, do not make calls just to keep the key alive, and reissue it when needed.

## Limits of the research

- Among the terms quoted, YES24, Kakao Article 4 item 10, and the Aladin notice were checked again on the original pages. The rest went through web page summaries, so compare them with the originals before implementation.
- Pages that could not be read: `developers.naver.com`, the Wine-Searcher API docs and terms (403), the Whiskybase API page and terms (403), the KMDb terms, and the KOPIS body.

## Implementation cards

| Card | Content                                             |
| ---- | --------------------------------------------------- |
| #40  | [Manual] Get API keys                               |
| #41  | Store item links (complements manual alcohol entry) |
| #42  | Fill book items from book search (YES24)            |
| #43  | Fill movie and show items from search (TMDB)        |
| #44  | Fill performance items from search (KOPIS)          |
| #45  | Fill travel place items from search (TourAPI)       |
