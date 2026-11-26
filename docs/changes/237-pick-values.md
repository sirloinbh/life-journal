# Pick values instead of typing them in forms (#237)

## Purpose

User requirement of 2026-11-26 (central rule project-standards#1130): fields whose values come from a known set are picked, not typed.

## Inventory of free-text inputs

| Field                                                                                                          | Decision                                                                                          |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Table filter: Tag, Companion                                                                                   | Picker of the names already used (new `GET /api/items/names`); was free text                      |
| Table filter: Category, Status                                                                                 | Already pickers                                                                                   |
| Item form: Subtype                                                                                             | Already a picker                                                                                  |
| Item form, log and quote forms, filters: dates                                                                 | Already date pickers                                                                              |
| Item form: Tags, Companions                                                                                    | Already offer the names already used as buttons, plus a typed new name (open set, like "add new") |
| Item form: Cost, Rating (score field), Page, minimum and maximum cost                                          | Numbers, kept as numeric inputs (open values)                                                     |
| Title, Link, category details (author, venue, and so on), notes, quote, review, search, journal title and text | Open values, kept as free text                                                                    |

## Changes

- `GET /api/items/names` returns `{ tags, companions }`, the most used first, names that differ only in letter case counted as one; OpenAPI updated.
- The table's Tag and Companion filters are pickers filled from it; a name that is only in the address stays on the list so the field shows it.

## Verification

- `npm run check`: see the PR.
- Tests: `items-names.test.ts`, the tag and companion filter tests in `items-table.test.tsx`.
