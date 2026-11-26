import { Router } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod/v4';

import { HttpError } from './standard/http.js';

// #210: one journal entry per date. Entry rules (owner decision recorded on #210, the issue's
// recommendation): plain text with line breaks, up to 10,000 characters, no title, no dates after today.

const MAX_ENTRY_LENGTH = 10_000;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_OFFSET = 1_000_000;

const COLUMNS = `entry_date AS date, body, created_at AS "createdAt", updated_at AS "updatedAt"`;

const isRealDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '0001-01-01') return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
};

const dateMessage = 'Entry date must be a real date in YYYY-MM-DD format';
export const entryDate = z.string({ error: dateMessage }).refine(isRealDate, dateMessage);

// PostgreSQL text cannot hold NUL, and a lone surrogate would be stored as a replacement character.
const isStorable = (value: string) => !value.includes('\0') && !/\p{Cs}/u.test(value);

// Every kind of line break becomes a plain line feed (the same rule as an item review).
const LINE_BREAKS = /\r\n?|[\u0085\u2028\u2029]/g;
const LINE_FEED = String.fromCharCode(10);

export const entryInput = z.strictObject(
  {
    body: z
      .string({
        error: (issue) =>
          issue.input === undefined ? 'Entry text is required' : 'Entry text must be text',
      })
      .transform((value) => value.replace(LINE_BREAKS, LINE_FEED).trim())
      .refine((value) => value.length > 0, 'Entry text is required')
      .refine(
        (value) => value.length <= MAX_ENTRY_LENGTH,
        `Entry text must be ${MAX_ENTRY_LENGTH.toLocaleString('en-US')} characters or fewer`,
      )
      .refine(isStorable, 'Entry text contains a character that is not allowed'),
  },
  {
    error: (issue) =>
      issue.code === 'unrecognized_keys'
        ? 'The request contains an unknown field'
        : issue.input === undefined
          ? 'Request body is required'
          : 'Request body is not valid',
  },
);

const whole = (label: string, min: number, max: number) => {
  const message = `${label} must be a whole number from ${min} to ${max}`;
  return z
    .string({ error: message })
    .refine(
      (value) => /^\d{1,7}$/.test(value) && Number(value) >= min && Number(value) <= max,
      message,
    )
    .transform(Number)
    .optional();
};

export const journalListQuery = z.strictObject(
  {
    limit: whole('Page size', 1, MAX_PAGE_SIZE),
    offset: whole('Offset', 0, MAX_OFFSET),
  },
  {
    error: (issue) =>
      issue.code === 'unrecognized_keys'
        ? 'The journal request contains an unknown filter'
        : 'Journal filters are not valid',
  },
);

const notFound = () => new HttpError(404, 'Journal entry not found');

export function createJournalRouter(pool: Pool, today: () => string) {
  const router = Router();

  // Newest date first, one page at a time, with the offset of the next page (null on the last one).
  router.get('/', async (req, res) => {
    const query = journalListQuery.parse(req.query);
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const offset = query.offset ?? 0;
    const [{ rows }, counted] = await Promise.all([
      pool.query(
        `SELECT ${COLUMNS} FROM journal_entries ORDER BY entry_date DESC LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
      pool.query<{ total: number }>('SELECT count(*)::int AS total FROM journal_entries'),
    ]);
    const total = counted.rows[0]?.total ?? 0;
    const next = offset + rows.length;
    res.json({
      entries: rows,
      nextOffset: rows.length > 0 && next < total ? next : null,
      total,
    });
  });

  router.get('/:date', async (req, res) => {
    const date = entryDate.parse(req.params.date);
    const { rows } = await pool.query(
      `SELECT ${COLUMNS} FROM journal_entries WHERE entry_date = $1`,
      [date],
    );
    if (rows.length === 0) throw notFound();
    res.json(rows[0]);
  });

  // Saving again on the same date replaces the text of the one entry: 201 when it was new, 200 otherwise.
  router.put('/:date', async (req, res) => {
    const date = entryDate.parse(req.params.date);
    const { body } = entryInput.parse(req.body);
    if (date > today()) throw new HttpError(400, 'Entry date cannot be after today');
    const { rows } = await pool.query<{ created: boolean }>(
      `INSERT INTO journal_entries (entry_date, body) VALUES ($1, $2)
       ON CONFLICT (entry_date) DO UPDATE SET body = EXCLUDED.body, updated_at = now()
       RETURNING ${COLUMNS}, (xmax = 0) AS created`,
      [date, body],
    );
    const { created, ...entry } = rows[0];
    res.status(created ? 201 : 200).json(entry);
  });

  router.delete('/:date', async (req, res) => {
    const date = entryDate.parse(req.params.date);
    const { rowCount } = await pool.query('DELETE FROM journal_entries WHERE entry_date = $1', [
      date,
    ]);
    if (rowCount === 0) throw notFound();
    res.status(204).end();
  });

  return router;
}
