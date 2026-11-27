// Restore of a JSON export (#209, docs/export-format.md). The whole file is checked before anything
// changes; then every record is replaced (not merged) in one transaction, so any error leaves the
// database as it was. Owner decision on #209: replace all data after a confirmation on the screen.
import express, { Router } from 'express';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod/v4';

import { CATEGORY_KEYS, LOG_CATEGORIES } from './contract.js';
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

const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const optionalText = z.string().nullable();

// The database checks the lengths, the page range, and the rating steps (011, 013).
const quoteRow = z.strictObject({
  id,
  item_id: id,
  text: z.string().refine((text) => text.trim() !== '', 'Quote must not be empty'),
  page: z.number().int().nullable(),
  note: optionalText,
  created_at: timestamp,
  updated_at: timestamp,
});

const logRow = z.strictObject({
  id,
  item_id: id,
  logged_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date such as 2026-11-26'),
  rating: z.number().nullable(),
  note: optionalText,
  cost_krw: z.number().int().min(0).max(2_147_483_647).nullable(),
  created_at: timestamp,
  updated_at: timestamp,
});

const learnedTermRow = z.strictObject({
  term_id: z.string().min(1).max(200),
  learned_at: timestamp,
});

// The change history (008_audit_log.sql), in the export since the owner's decision on #208 (option B).
// before and after are any JSON value; z.json() still requires the field, so a missing one is refused.
const auditRow = z.strictObject({
  id,
  at: timestamp,
  actor_type: z.enum(['user', 'ai-tool', 'system']),
  actor_id: optionalText,
  client: optionalText,
  tool: optionalText,
  action: z.enum(['read', 'create', 'update', 'delete']),
  entity: z.string().min(1),
  entity_id: optionalText,
  result: z.enum(['ok', 'denied', 'error']),
  before: z.json(),
  after: z.json(),
  request_id: optionalText,
});

// The database checks the lengths and the one-entry-per-date rule (016).
const journalEntryRow = z.strictObject({
  id,
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date such as 2026-11-26'),
  title: optionalText,
  body: z.string().refine((body) => body.trim() !== '', 'Entry must not be empty'),
  created_at: timestamp,
  updated_at: timestamp,
});

const journalLinkRow = z.strictObject({
  entry_id: id,
  item_id: id,
  linked_at: timestamp,
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

// A quote or log must belong to an item of the file, of a category that takes it (the API's rule:
// quotes on reading items, #217; logs on LOG_CATEGORIES, #214).
function belongs(
  rows: readonly { item_id: number }[],
  categories: ReadonlyMap<number, string>,
  allowed: readonly string[],
  ctx: z.RefinementCtx,
  table: string,
  what: string,
) {
  rows.forEach((row, index) => {
    const category = categories.get(row.item_id);
    const message =
      category === undefined
        ? `Item ${row.item_id} is not in the file`
        : allowed.includes(category)
          ? null
          : `${what} only on ${allowed.join(', ')} items, not ${category}`;
    if (message)
      ctx.addIssue({ code: 'custom', path: ['tables', table, index, 'item_id'], message });
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
      // Added after the first version-1 files (#217, #214): a file without them has none.
      item_quotes: z.array(quoteRow).default([]),
      item_logs: z.array(logRow).default([]),
      learned_terms: z.array(learnedTermRow),
      // Added on 2026-11-26 (#208, option B): a file without it restores an empty history.
      audit_log: z.array(auditRow).default([]),
      // Added with the journal (#233): a file without them has no entries or links.
      journal_entries: z.array(journalEntryRow).default([]),
      journal_entry_items: z.array(journalLinkRow).default([]),
    }),
  })
  .superRefine((file, ctx) => {
    const { items, item_quotes, item_logs, learned_terms, audit_log } = file.tables;
    const { journal_entries, journal_entry_items } = file.tables;
    unique(audit_log, (row) => row.id, ctx, 'audit_log');
    unique(items, (row) => row.id, ctx, 'items');
    unique(item_quotes, (row) => row.id, ctx, 'item_quotes');
    unique(item_logs, (row) => row.id, ctx, 'item_logs');
    unique(learned_terms, (row) => row.term_id, ctx, 'learned_terms');
    const categories = new Map(items.map((row) => [row.id, row.category]));
    belongs(item_quotes, categories, ['reading'], ctx, 'item_quotes', 'Quotes');
    belongs(item_logs, categories, LOG_CATEGORIES, ctx, 'item_logs', 'Logs');
    unique(journal_entries, (row) => row.id, ctx, 'journal_entries');
    unique(journal_entries, (row) => row.entry_date, ctx, 'journal_entries');
    unique(
      journal_entry_items,
      (row) => `${row.entry_id}-${row.item_id}`,
      ctx,
      'journal_entry_items',
    );
    // A link needs its entry and its item in the file, and the item completed on the entry's date (the API's rule, #211).
    const entryDates = new Map(journal_entries.map((row) => [row.id, row.entry_date]));
    const completed = new Map(items.map((row) => [row.id, row.completed_date]));
    journal_entry_items.forEach((row, index) => {
      const entryDate = entryDates.get(row.entry_id);
      const message =
        entryDate === undefined
          ? `Entry ${row.entry_id} is not in the file`
          : !completed.has(row.item_id)
            ? `Item ${row.item_id} is not in the file`
            : completed.get(row.item_id) !== entryDate
              ? `Item ${row.item_id} was not completed on ${entryDate}`
              : null;
      if (message)
        ctx.addIssue({ code: 'custom', path: ['tables', 'journal_entry_items', index], message });
    });
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

const QUOTE_COLUMNS = 'id, item_id, text, page, note, created_at, updated_at';
const LOG_COLUMNS = 'id, item_id, logged_on, rating, note, cost_krw, created_at, updated_at';
// Quoted: at, before, and after are SQL keywords.
const ENTRY_COLUMNS = 'id, entry_date, title, body, created_at, updated_at';
const AUDIT_COLUMNS = `id, "at", actor_type, actor_id, client, tool, action, entity, entity_id, result,
  "before", "after", request_id`;

/** Replaces every record with the file's rows. Runs inside the caller's transaction. */
export async function replaceRecords(client: Pick<PoolClient, 'query'>, file: ExportInput) {
  const { items, item_quotes, item_logs, learned_terms, audit_log } = file.tables;
  const { journal_entries, journal_entry_items } = file.tables;
  // Nothing else may write while the tables are replaced. items first, as a cascading DELETE FROM
  // items takes its locks, so the two cannot deadlock.
  await client.query(
    `LOCK TABLE items, item_quotes, item_logs, learned_terms, audit_log, journal_entries,
       journal_entry_items IN EXCLUSIVE MODE`,
  );
  // Children before their parents.
  await client.query('DELETE FROM journal_entry_items');
  await client.query('DELETE FROM journal_entries');
  await client.query('DELETE FROM item_logs');
  await client.query('DELETE FROM item_quotes');
  await client.query('DELETE FROM learned_terms');
  await client.query('DELETE FROM items');
  await client.query('DELETE FROM audit_log');
  // One statement per table: jsonb_to_recordset turns the rows into a table, so the file is sent once.
  await client.query(
    `INSERT INTO items (${ITEM_COLUMNS}) OVERRIDING SYSTEM VALUE
     SELECT ${ITEM_COLUMNS} FROM jsonb_to_recordset($1::jsonb) AS r(
       id bigint, category text, subtype text, title text, status text, cost_krw integer,
       planned_date date, completed_date date, details jsonb, rating numeric, sub_ratings jsonb,
       review text, link text, tags text[], companions text[], created_at timestamptz,
       updated_at timestamptz)`,
    [JSON.stringify(items)],
  );
  await client.query(
    `INSERT INTO item_quotes (${QUOTE_COLUMNS}) OVERRIDING SYSTEM VALUE
     SELECT ${QUOTE_COLUMNS} FROM jsonb_to_recordset($1::jsonb) AS r(
       id bigint, item_id bigint, text text, page integer, note text, created_at timestamptz,
       updated_at timestamptz)`,
    [JSON.stringify(item_quotes)],
  );
  await client.query(
    `INSERT INTO item_logs (${LOG_COLUMNS}) OVERRIDING SYSTEM VALUE
     SELECT ${LOG_COLUMNS} FROM jsonb_to_recordset($1::jsonb) AS r(
       id bigint, item_id bigint, logged_on date, rating numeric, note text, cost_krw integer,
       created_at timestamptz, updated_at timestamptz)`,
    [JSON.stringify(item_logs)],
  );
  await client.query(
    `INSERT INTO learned_terms (term_id, learned_at)
     SELECT term_id, learned_at FROM jsonb_to_recordset($1::jsonb) AS r(term_id text, learned_at timestamptz)`,
    [JSON.stringify(learned_terms)],
  );
  await client.query(
    `INSERT INTO journal_entries (${ENTRY_COLUMNS}) OVERRIDING SYSTEM VALUE
     SELECT ${ENTRY_COLUMNS} FROM jsonb_to_recordset($1::jsonb) AS r(
       id bigint, entry_date date, title text, body text, created_at timestamptz,
       updated_at timestamptz)`,
    [JSON.stringify(journal_entries)],
  );
  await client.query(
    `INSERT INTO journal_entry_items (entry_id, item_id, linked_at)
     SELECT entry_id, item_id, linked_at FROM jsonb_to_recordset($1::jsonb) AS r(
       entry_id bigint, item_id bigint, linked_at timestamptz)`,
    [JSON.stringify(journal_entry_items)],
  );
  await client.query(
    `INSERT INTO audit_log (${AUDIT_COLUMNS}) OVERRIDING SYSTEM VALUE
     SELECT ${AUDIT_COLUMNS} FROM jsonb_to_recordset($1::jsonb) AS r(
       id bigint, "at" timestamptz, actor_type text, actor_id text, client text, tool text,
       action text, entity text, entity_id text, result text, "before" jsonb, "after" jsonb,
       request_id text)`,
    [JSON.stringify(audit_log)],
  );
  // The ids came from the file, so the next new row of each table continues after the largest one.
  for (const table of ['items', 'item_quotes', 'item_logs', 'journal_entries', 'audit_log']) {
    await client.query(
      `SELECT setval(pg_get_serial_sequence('${table}', 'id'),
         COALESCE((SELECT max(id) FROM ${table}), 1), (SELECT count(*) > 0 FROM ${table}))`,
    );
  }
  return {
    items: items.length,
    item_quotes: item_quotes.length,
    item_logs: item_logs.length,
    learned_terms: learned_terms.length,
    audit_log: audit_log.length,
    journal_entries: journal_entries.length,
    journal_entry_items: journal_entry_items.length,
  };
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
