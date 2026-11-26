// Restore of a JSON export (#209, docs/export-format.md). The whole file is checked before anything
// changes; then every record is replaced (not merged) in one transaction, so any error leaves the
// database as it was. Owner decision on #209: replace all data after a confirmation on the screen.
import express, { Router } from 'express';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod/v4';

import { CATEGORY_KEYS } from './contract.js';
import { EXPORT_FORMAT, EXPORT_VERSION } from './export.js';
import { withTransaction } from './standard/db.js';
import { HttpError, sendError } from './standard/http.js';

/** The restore body may be much larger than the 256 kB other routes accept (app.ts skips its parser here). */
export const RESTORE_PATH = '/api/restore';
const RESTORE_BODY_LIMIT = '20mb';

const timestamp = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/,
    'Use a UTC time such as 2026-11-26T00:00:00.000000Z',
  );
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date such as 2026-11-26')
  .nullable();
const object = z.record(z.string(), z.unknown());

// The shape of each row. The database checks the rest (category rules, rating steps, link format) and
// a row it refuses rolls the whole restore back.
const itemRow = z.strictObject({
  id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  category: z.enum(CATEGORY_KEYS),
  subtype: z.string().nullable(),
  // A check, not .trim(): the title is written back exactly as exported.
  title: z.string().refine((title) => title.trim() !== '', 'Title must not be empty'),
  status: z.enum(['wishlist', 'done']),
  cost_krw: z.number().int().min(0).max(2_147_483_647).nullable(),
  planned_date: date,
  completed_date: date,
  details: object,
  rating: z.number().nullable(),
  sub_ratings: object,
  review: z.string().nullable(),
  link: z.string().nullable(),
  // The database checks the names (at most 20, 1-50 characters, no repeats); #215.
  tags: z.array(z.string()),
  companions: z.array(z.string()),
  created_at: timestamp,
  updated_at: timestamp,
});

const learnedTermRow = z.strictObject({
  term_id: z.string().min(1).max(200),
  learned_at: timestamp,
});

function unique<T>(
  rows: readonly T[],
  key: (row: T) => unknown,
  ctx: z.RefinementCtx,
  table: string,
) {
  const seen = new Set<unknown>();
  rows.forEach((row, index) => {
    const value = key(row);
    if (seen.has(value)) {
      ctx.addIssue({
        code: 'custom',
        path: ['tables', table, index],
        message: `Duplicate key ${String(value)}`,
      });
    }
    seen.add(value);
  });
}

// Unknown fields and tables are refused rather than dropped, so a file from a newer app version is
// never restored with data silently missing.
export const exportFile = z
  .strictObject({
    format: z.literal(EXPORT_FORMAT, { error: 'This is not a life-journal export file' }),
    version: z.literal(EXPORT_VERSION, {
      error: `This app restores export version ${EXPORT_VERSION} only`,
    }),
    exportedAt: z.string(),
    tables: z.strictObject({
      items: z.array(itemRow),
      learned_terms: z.array(learnedTermRow),
    }),
  })
  .superRefine((file, ctx) => {
    unique(file.tables.items, (row) => row.id, ctx, 'items');
    unique(file.tables.learned_terms, (row) => row.term_id, ctx, 'learned_terms');
  });

type ExportInput = z.infer<typeof exportFile>;

/** "tables.items.3.title: Title must not be empty" for the first few problems of a refused file. */
function describe(error: z.ZodError) {
  const shown = error.issues.slice(0, 3).map((issue) => {
    const path = issue.path.map(String).join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
  });
  const more = error.issues.length - shown.length;
  return `The file was not restored. ${shown.join('; ')}${more > 0 ? `; and ${more} more` : ''}`;
}

const ITEM_COLUMNS = `id, category, subtype, title, status, cost_krw, planned_date, completed_date,
  details, rating, sub_ratings, review, link, tags, companions, created_at, updated_at`;

/** Replaces every record with the file's rows. Runs inside the caller's transaction. */
export async function replaceRecords(client: Pick<PoolClient, 'query'>, file: ExportInput) {
  // Nothing else may write while the tables are replaced.
  await client.query('LOCK TABLE items, learned_terms IN EXCLUSIVE MODE');
  await client.query('DELETE FROM learned_terms');
  await client.query('DELETE FROM items');
  // One statement per table: jsonb_to_recordset turns the rows into a table, so the file is sent once.
  await client.query(
    `INSERT INTO items (${ITEM_COLUMNS}) OVERRIDING SYSTEM VALUE
     SELECT ${ITEM_COLUMNS} FROM jsonb_to_recordset($1::jsonb) AS r(
       id bigint, category text, subtype text, title text, status text, cost_krw integer,
       planned_date date, completed_date date, details jsonb, rating numeric, sub_ratings jsonb,
       review text, link text, tags text[], companions text[], created_at timestamptz,
       updated_at timestamptz)`,
    [JSON.stringify(file.tables.items)],
  );
  await client.query(
    `INSERT INTO learned_terms (term_id, learned_at)
     SELECT term_id, learned_at FROM jsonb_to_recordset($1::jsonb) AS r(term_id text, learned_at timestamptz)`,
    [JSON.stringify(file.tables.learned_terms)],
  );
  // The ids came from the file, so the next new item continues after the largest one.
  await client.query(
    `SELECT setval(pg_get_serial_sequence('items', 'id'),
       COALESCE((SELECT max(id) FROM items), 1), (SELECT count(*) > 0 FROM items))`,
  );
  return { items: file.tables.items.length, learned_terms: file.tables.learned_terms.length };
}

// A row the database refuses (a CHECK, a bad value) is the file's fault: a 400 that names the rule.
function refusedRow(error: unknown) {
  const { code, constraint } = (error ?? {}) as { code?: unknown; constraint?: unknown };
  if (typeof code !== 'string' || !/^2[23]/.test(code)) return null;
  const rule = typeof constraint === 'string' ? ` (${constraint})` : '';
  return new HttpError(400, `The file was not restored. A row breaks a database rule${rule}`);
}

export function createRestoreRouter(pool: Pool) {
  const router = Router();

  router.post('/', express.json({ limit: RESTORE_BODY_LIMIT }), async (req, res) => {
    const parsed = exportFile.safeParse(req.body);
    if (!parsed.success) {
      sendError(
        res,
        400,
        describe(parsed.error),
        parsed.error.issues.slice(0, 10).map((issue) => ({
          path: issue.path.map(String).join('.'),
          message: issue.message,
        })),
      );
      return;
    }
    try {
      const restored = await withTransaction(pool, (client) => replaceRecords(client, parsed.data));
      res.json({ restored });
    } catch (error) {
      throw refusedRow(error) ?? error;
    }
  });

  return router;
}
