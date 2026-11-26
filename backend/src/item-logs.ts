// Repeated tastings and visits of an item (#214): /api/items/:id/logs. The item keeps its own completed date,
// rating, and review as the first completion; each log is one more visit with a date and an optional rating, note,
// and cost. Only the categories in LOG_CATEGORIES take logs, and items.ts keeps an item with logs in its category.
import type { Router } from 'express';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod/v4';

import { LOG_CATEGORIES, MAX_LOG_NOTE_LENGTH } from './contract.js';
import { withTransaction } from './standard/db.js';
import { HttpError, parseId } from './standard/http.js';
import { costKrw, date, isStorable, lines, score, strictObject } from './validation.js';

const LOG_COLUMNS = `id, item_id AS "itemId", logged_on AS date, rating::float8 AS rating, note,
  cost_krw AS "costKrw", created_at AS "createdAt", updated_at AS "updatedAt"`;

const logCategories: readonly string[] = LOG_CATEGORIES;

// A note is stored trimmed, with plain line ends (see `lines`). A blank note is no note.
const logNote = z
  .string({ error: 'Note must be text' })
  .transform(lines)
  .refine(
    (value) => value.length <= MAX_LOG_NOTE_LENGTH,
    `Note must be ${MAX_LOG_NOTE_LENGTH} characters or fewer`,
  )
  .refine(isStorable, 'Note contains a character that is not allowed')
  .transform((value) => value || null)
  .nullable()
  .optional();

const logShape = {
  date: date('Date'),
  rating: score('Rating').nullable().optional(),
  note: logNote,
  costKrw: costKrw.nullable().optional(),
};

const logObject = <Shape extends z.ZodRawShape>(shape: Shape) =>
  strictObject(shape, 'The request contains an unknown field', (input) =>
    input === undefined ? 'Request body is required' : 'Request body is not valid',
  );

export const logFields = logObject(logShape);
export const logPatch = logObject(logShape).partial();

// The request names fields, the table has columns.
const PATCH_COLUMNS = { date: 'logged_on', rating: 'rating', note: 'note', costKrw: 'cost_krw' };

const itemNotFound = () => new HttpError(404, 'Item not found');
const logNotFound = () => new HttpError(404, 'Log not found');

const notAfterToday = (value: string | undefined, today: string) => {
  if (value !== undefined && value > today) throw new HttpError(400, 'Date cannot be after today');
};

/** Adds the log routes to the items router (mounted at /api/items). */
export function addLogRoutes(router: Router, pool: Pool, today: () => string) {
  router.get('/:id/logs', async (req, res) => {
    const id = parseId(req.params.id, 'item');
    const [item, logs] = await Promise.all([
      pool.query('SELECT 1 FROM items WHERE id = $1', [id]),
      // Newest first; of two logs on one day, the one added last comes first.
      pool.query(
        `SELECT ${LOG_COLUMNS} FROM item_logs WHERE item_id = $1
         ORDER BY logged_on DESC, id DESC`,
        [id],
      ),
    ]);
    if (item.rowCount === 0) throw itemNotFound();
    res.json({ logs: logs.rows });
  });

  router.post('/:id/logs', async (req, res) => {
    const id = parseId(req.params.id, 'item');
    const log = logFields.parse(req.body);
    notAfterToday(log.date, today());
    const created = await withTransaction(pool, async (client: PoolClient) => {
      // Locked against a category change until the log is in.
      const { rows } = await client.query<{ category: string }>(
        'SELECT category FROM items WHERE id = $1 FOR SHARE',
        [id],
      );
      if (rows.length === 0) throw itemNotFound();
      if (!logCategories.includes(rows[0].category)) {
        throw new HttpError(400, 'Only drink and travel items can have tastings and visits');
      }
      const { rows: inserted } = await client.query(
        `INSERT INTO item_logs (item_id, logged_on, rating, note, cost_krw)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${LOG_COLUMNS}`,
        [id, log.date, log.rating ?? null, log.note ?? null, log.costKrw ?? null],
      );
      return inserted[0];
    });
    res.status(201).json(created);
  });

  router.patch('/:id/logs/:logId', async (req, res) => {
    const id = parseId(req.params.id, 'item');
    const logId = parseId(req.params.logId, 'log');
    const patch = logPatch.parse(req.body);
    const keys = (['date', 'rating', 'note', 'costKrw'] as const).filter((key) => key in patch);
    if (keys.length === 0) throw new HttpError(400, 'Nothing to update');
    notAfterToday(patch.date, today());
    const { rows } = await pool.query(
      `UPDATE item_logs
       SET ${keys.map((key, index) => `${PATCH_COLUMNS[key]} = $${index + 3}`).join(', ')},
           updated_at = now()
       WHERE id = $1 AND item_id = $2
       RETURNING ${LOG_COLUMNS}`,
      [logId, id, ...keys.map((key) => patch[key] ?? null)],
    );
    if (rows.length === 0) throw logNotFound();
    res.json(rows[0]);
  });

  router.delete('/:id/logs/:logId', async (req, res) => {
    const id = parseId(req.params.id, 'item');
    const logId = parseId(req.params.logId, 'log');
    const { rowCount } = await pool.query('DELETE FROM item_logs WHERE id = $1 AND item_id = $2', [
      logId,
      id,
    ]);
    if (rowCount === 0) throw logNotFound();
    res.status(204).end();
  });
}

/** Refuses moving an item that has logs to another category (call inside the item's locked PATCH). */
export async function keepLoggedItemInLogCategory(
  client: PoolClient,
  id: number,
  from: string,
  to: string,
) {
  if (from === to || !logCategories.includes(from)) return;
  const { rowCount } = await client.query('SELECT 1 FROM item_logs WHERE item_id = $1 LIMIT 1', [
    id,
  ]);
  if (rowCount !== 0) {
    throw new HttpError(
      400,
      'Delete the tastings and visits of this item before moving it to another category',
    );
  }
}
