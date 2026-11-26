// Quotes and highlights of reading items (#217): /api/items/:id/quotes. Each quote has its text, an optional page,
// and an optional note. Only reading items take quotes, and items.ts keeps an item with quotes in Reading.
import type { Router } from 'express';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod/v4';

import { MAX_QUOTE_LENGTH, MAX_QUOTE_NOTE_LENGTH, MAX_QUOTE_PAGE } from './contract.js';
import { withTransaction } from './standard/db.js';
import { HttpError, parseId } from './standard/http.js';
import { isStorable, lines, strictObject } from './validation.js';

const QUOTE_COLUMNS = `id, item_id AS "itemId", text, page, note,
  created_at AS "createdAt", updated_at AS "updatedAt"`;

const quoteText = z
  .string({
    error: (issue) => (issue.input === undefined ? 'Quote is required' : 'Quote must be text'),
  })
  .transform(lines)
  .refine((value) => value.length > 0, 'Quote is required')
  .refine(
    (value) => value.length <= MAX_QUOTE_LENGTH,
    `Quote must be ${MAX_QUOTE_LENGTH} characters or fewer`,
  )
  .refine(isStorable, 'Quote contains a character that is not allowed');

const pageMessage = `Page must be a whole number from 1 to ${MAX_QUOTE_PAGE}`;
const quotePage = z
  .number({ error: pageMessage })
  .refine((page) => Number.isInteger(page) && page >= 1 && page <= MAX_QUOTE_PAGE, pageMessage)
  .nullable()
  .optional();

// A blank note is no note.
const quoteNote = z
  .string({ error: 'Note must be text' })
  .transform(lines)
  .refine(
    (value) => value.length <= MAX_QUOTE_NOTE_LENGTH,
    `Note must be ${MAX_QUOTE_NOTE_LENGTH} characters or fewer`,
  )
  .refine(isStorable, 'Note contains a character that is not allowed')
  .transform((value) => value || null)
  .nullable()
  .optional();

const quoteObject = <Shape extends z.ZodRawShape>(shape: Shape) =>
  strictObject(shape, 'The request contains an unknown field', (input) =>
    input === undefined ? 'Request body is required' : 'Request body is not valid',
  );

export const quoteFields = quoteObject({ text: quoteText, page: quotePage, note: quoteNote });
export const quotePatch = quoteObject({
  text: quoteText,
  page: quotePage,
  note: quoteNote,
}).partial();

const itemNotFound = () => new HttpError(404, 'Item not found');
const quoteNotFound = () => new HttpError(404, 'Quote not found');

/** The category of the item, locked against a change until the transaction ends. */
async function lockedCategory(client: PoolClient, id: number) {
  const { rows } = await client.query<{ category: string }>(
    'SELECT category FROM items WHERE id = $1 FOR SHARE',
    [id],
  );
  if (rows.length === 0) throw itemNotFound();
  return rows[0].category;
}

/** Adds the quote routes to the items router (mounted at /api/items). */
export function addQuoteRoutes(router: Router, pool: Pool) {
  router.get('/:id/quotes', async (req, res) => {
    const id = parseId(req.params.id, 'item');
    const [item, quotes] = await Promise.all([
      pool.query('SELECT 1 FROM items WHERE id = $1', [id]),
      // Page order, as in the book; quotes without a page last, each group in the order they were added.
      pool.query(
        `SELECT ${QUOTE_COLUMNS} FROM item_quotes WHERE item_id = $1
         ORDER BY page ASC NULLS LAST, id ASC`,
        [id],
      ),
    ]);
    if (item.rowCount === 0) throw itemNotFound();
    res.json({ quotes: quotes.rows });
  });

  router.post('/:id/quotes', async (req, res) => {
    const id = parseId(req.params.id, 'item');
    const quote = quoteFields.parse(req.body);
    const created = await withTransaction(pool, async (client: PoolClient) => {
      if ((await lockedCategory(client, id)) !== 'reading') {
        throw new HttpError(400, 'Only reading items can have quotes');
      }
      const { rows } = await client.query(
        `INSERT INTO item_quotes (item_id, text, page, note) VALUES ($1, $2, $3, $4)
         RETURNING ${QUOTE_COLUMNS}`,
        [id, quote.text, quote.page ?? null, quote.note ?? null],
      );
      return rows[0];
    });
    res.status(201).json(created);
  });

  router.patch('/:id/quotes/:quoteId', async (req, res) => {
    const id = parseId(req.params.id, 'item');
    const quoteId = parseId(req.params.quoteId, 'quote');
    const patch = quotePatch.parse(req.body);
    const columns = (['text', 'page', 'note'] as const).filter((key) => key in patch);
    if (columns.length === 0) throw new HttpError(400, 'Nothing to update');
    const values = columns.map((key) => patch[key] ?? null);
    const { rows } = await pool.query(
      `UPDATE item_quotes
       SET ${columns.map((key, index) => `${key} = $${index + 3}`).join(', ')}, updated_at = now()
       WHERE id = $1 AND item_id = $2
       RETURNING ${QUOTE_COLUMNS}`,
      [quoteId, id, ...values],
    );
    if (rows.length === 0) throw quoteNotFound();
    res.json(rows[0]);
  });

  router.delete('/:id/quotes/:quoteId', async (req, res) => {
    const id = parseId(req.params.id, 'item');
    const quoteId = parseId(req.params.quoteId, 'quote');
    const { rowCount } = await pool.query(
      'DELETE FROM item_quotes WHERE id = $1 AND item_id = $2',
      [quoteId, id],
    );
    if (rowCount === 0) throw quoteNotFound();
    res.status(204).end();
  });
}

/** Refuses moving an item that has quotes out of Reading (call inside the item's locked PATCH). */
export async function keepQuotedItemInReading(
  client: PoolClient,
  id: number,
  from: string,
  to: string,
) {
  if (from !== 'reading' || to === 'reading') return;
  const { rowCount } = await client.query('SELECT 1 FROM item_quotes WHERE item_id = $1 LIMIT 1', [
    id,
  ]);
  if (rowCount !== 0) {
    throw new HttpError(400, 'Delete the quotes of this item before moving it out of Reading');
  }
}
