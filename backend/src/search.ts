import { Router } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod/v4';

import { isStorable } from './validation.js';

// #277: the top bar search over this app's records (project-standards docs/directory-rules.md, "Content search").
// `GET /api/search?q=` answers { results } with at most 20 records, newest first: items, essays, day log entries
// and imported documents. A record matches when every word of the query appears, ignoring case, in its text.

export const MAX_RESULTS = 20;
const MAX_QUERY_LENGTH = 100;
const MAX_TITLE_LENGTH = 80;
const MAX_SNIPPET_LENGTH = 120;

const queryMessage = 'Search term must be 1 to 100 characters';
export const searchQuery = z.strictObject(
  {
    q: z
      .string({ error: queryMessage })
      .trim()
      .refine((value) => value.length >= 1 && value.length <= MAX_QUERY_LENGTH, queryMessage)
      .refine(isStorable, 'Search term contains a character that is not allowed'),
  },
  {
    error: (issue) =>
      issue.code === 'unrecognized_keys'
        ? 'The search request contains an unknown filter'
        : queryMessage,
  },
);

/** One ILIKE pattern per word; `\`, `%` and `_` in a word match literally. */
export const wordPatterns = (query: string) =>
  query
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `%${word.replace(/[\\%_]/g, '\\$&')}%`);

const flat = (column: string) => `regexp_replace(${column}, '\\s+', ' ', 'g')`;

// Each branch: a sort time, a title, a path, a snippet and the text the words are looked up in.
const BRANCHES = `
  SELECT created_at AS recorded, title, '/table?q=' AS path, id::text AS key,
         concat_ws(' · ', category, subtype, left(${flat("coalesce(review, '')")}, 100)) AS snippet,
         concat_ws(' ', title, subtype, review, array_to_string(tags, ' '), array_to_string(companions, ' '),
           (SELECT string_agg(field.value, ' ') FROM jsonb_each_text(details) AS field)) AS haystack
    FROM items
  UNION ALL
  SELECT updated_at, title, '/essays/' || id, id::text,
         left(${flat('body')}, ${MAX_SNIPPET_LENGTH}),
         concat_ws(' ', title, body, array_to_string(tags, ' '))
    FROM essays
  UNION ALL
  SELECT updated_at, coalesce(title, to_char(entry_date, 'YYYY-MM-DD')), '/journal/' || to_char(entry_date, 'YYYY-MM-DD'),
         to_char(entry_date, 'YYYY-MM-DD'), left(${flat('body')}, ${MAX_SNIPPET_LENGTH}),
         concat_ws(' ', title, body, to_char(entry_date, 'YYYY-MM-DD'))
    FROM journal_entries
  UNION ALL
  SELECT notion_edited_at, title, '/documents/' || id, id::text,
         left(${flat('body')}, ${MAX_SNIPPET_LENGTH}), concat_ws(' ', title, body)
    FROM notion_pages
   WHERE deleted_at IS NULL`;

type Row = { title: string; path: string; snippet: string | null };

export function createSearchRouter(pool: Pool) {
  const router = Router();
  router.get('/', async (req, res) => {
    const { q } = searchQuery.parse(req.query);
    const { rows } = await pool.query<Row>(
      `SELECT title, path, snippet FROM (${BRANCHES}) AS records
        WHERE haystack ILIKE ALL ($1::text[])
        ORDER BY recorded DESC, key DESC LIMIT ${MAX_RESULTS}`,
      [wordPatterns(q)],
    );
    res.json({
      results: rows.map((row) => ({
        title:
          row.title.length > MAX_TITLE_LENGTH
            ? `${row.title.slice(0, MAX_TITLE_LENGTH - 1)}…`
            : row.title,
        // Items have no screen of their own: the table opens filtered to the title.
        href: row.path === '/table?q=' ? `/table?q=${encodeURIComponent(row.title)}` : row.path,
        kind: 'content',
        ...(row.snippet ? { snippet: row.snippet } : {}),
      })),
    });
  });
  return router;
}
