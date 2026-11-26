// Export of every record (#208) as one JSON file, and of the items as a CSV file. The JSON format is
// described in docs/export-format.md; restore (#209) reads it back. The routes sit under /api, so the
// shared sign-in guards them like every other record.
import { Router } from 'express';
import type { Pool, PoolClient } from 'pg';

import { serviceDate } from './standard/http.js';

const EXPORT_FORMAT = 'life-journal-export';
const EXPORT_VERSION = 1;

// Timestamps as UTC text with microseconds: a JS Date keeps only milliseconds, so a restore could not
// write back the same value.
const utc = (column: string) =>
  `to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS ${column}`;

/**
 * Every data table in the export, in restore order (a table after the tables it refers to), with its
 * columns in file order. A new data table is added here, to docs/export-format.md, and to restore.
 * DATE columns come back as YYYY-MM-DD and BIGINT as numbers (pool.ts); rating (items and item_logs) is
 * numeric(2,1), sent as a number; text[] columns (tags, companions) are JSON arrays of strings.
 */
export const EXPORT_TABLES = {
  items: {
    columns: [
      'id',
      'category',
      'subtype',
      'title',
      'status',
      'cost_krw',
      'planned_date',
      'completed_date',
      'details',
      'rating',
      'sub_ratings',
      'review',
      'link',
      'tags',
      'companions',
      'created_at',
      'updated_at',
    ],
    sql: `SELECT id, category, subtype, title, status, cost_krw, planned_date, completed_date, details,
            rating::float8 AS rating, sub_ratings, review, link, tags, companions, ${utc('created_at')}, ${utc('updated_at')}
          FROM items ORDER BY id`,
  },
  item_quotes: {
    columns: ['id', 'item_id', 'text', 'page', 'note', 'created_at', 'updated_at'],
    sql: `SELECT id, item_id, text, page, note, ${utc('created_at')}, ${utc('updated_at')}
          FROM item_quotes ORDER BY id`,
  },
  item_logs: {
    columns: [
      'id',
      'item_id',
      'logged_on',
      'rating',
      'note',
      'cost_krw',
      'created_at',
      'updated_at',
    ],
    sql: `SELECT id, item_id, logged_on, rating::float8 AS rating, note, cost_krw, ${utc('created_at')}, ${utc('updated_at')}
          FROM item_logs ORDER BY id`,
  },
  learned_terms: {
    columns: ['term_id', 'learned_at'],
    sql: `SELECT term_id, ${utc('learned_at')} FROM learned_terms ORDER BY term_id`,
  },
} as const;

type ExportTable = keyof typeof EXPORT_TABLES;
type Row = Record<string, unknown>;

export type ExportFile = {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  tables: Record<ExportTable, Row[]>;
};

/** The time in Asia/Seoul with its offset, such as 2026-11-26T09:05:01.123+09:00. Korea has no DST. */
export function seoulTime(now: Date) {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().replace('Z', '+09:00');
}

/** Reads every table with `db`; the caller gives one snapshot (a REPEATABLE READ transaction). */
export async function readExport(db: Pick<PoolClient, 'query'>, now: Date): Promise<ExportFile> {
  const tables = {} as Record<ExportTable, Row[]>;
  for (const [name, table] of Object.entries(EXPORT_TABLES) as [
    ExportTable,
    (typeof EXPORT_TABLES)[ExportTable],
  ][]) {
    const { rows } = await db.query<Row>(table.sql);
    tables[name] = rows;
  }
  return { format: EXPORT_FORMAT, version: EXPORT_VERSION, exportedAt: seoulTime(now), tables };
}

// One snapshot, so the tables of a file agree with each other even while a record changes.
async function inSnapshot<T>(pool: Pool, read: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const result = await read(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

// Written as a char code: an invisible character in the source is easy to lose.
const BOM = String.fromCharCode(0xfeff);

function csvField(value: unknown) {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

/**
 * CSV text (RFC 4180, CRLF line ends) with a UTF-8 BOM so Excel reads Korean correctly. Every value is
 * quoted, so commas, quotes, and line breaks stay inside their field; null is an empty unquoted field,
 * which keeps it apart from an empty text (""). Objects such as details are JSON text.
 */
export function toCsv(columns: readonly string[], rows: readonly Row[]) {
  const lines = [
    columns.join(','),
    ...rows.map((row) => columns.map((column) => csvField(row[column])).join(',')),
  ];
  return `${BOM}${lines.join('\r\n')}\r\n`;
}

export function createExportRouter(
  pool: Pool,
  today: () => string = () => serviceDate(),
  now: () => Date = () => new Date(),
) {
  const router = Router();

  router.get('/', async (_req, res) => {
    const file = await inSnapshot(pool, (client) => readExport(client, now()));
    res.set('Cache-Control', 'no-store');
    res.attachment(`life-journal-${today()}.json`);
    res.json(file);
  });

  router.get('/items.csv', async (_req, res) => {
    const { rows } = await inSnapshot(pool, (client) => client.query<Row>(EXPORT_TABLES.items.sql));
    res.set('Cache-Control', 'no-store');
    res.attachment(`life-journal-items-${today()}.csv`);
    res.type('text/csv; charset=utf-8');
    res.send(toCsv(EXPORT_TABLES.items.columns, rows));
  });

  return router;
}
