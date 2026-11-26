// Items linked to a journal entry (#211): /api/journal/:date/items. Link rule (owner decision on #211, option A):
// only items completed on the entry's date can be linked, and migration 014
// removes a link when its item's completed date moves to another day or the item is marked as not done.
import type { Router } from 'express';
import type { Pool, PoolClient } from 'pg';
import type { z } from 'zod/v4';

import { withTransaction } from './standard/db.js';
import { HttpError, parseId } from './standard/http.js';

// What the journal shows of an item and what opens it on the bucket list.
const ITEM_COLUMNS = `items.id, items.category, items.subtype, items.title,
  items.completed_date AS "completedDate", items.rating::float8 AS rating`;

const entryNotFound = () => new HttpError(404, 'Journal entry not found');
const itemNotFound = () => new HttpError(404, 'Item not found');

/** The id of the entry of the date, locked against a delete until the transaction ends. */
async function lockedEntry(client: PoolClient, date: string) {
  const { rows } = await client.query<{ id: number }>(
    'SELECT id FROM journal_entries WHERE entry_date = $1 FOR SHARE',
    [date],
  );
  if (rows.length === 0) throw entryNotFound();
  return rows[0].id;
}

/**
 * Adds the linked-item routes to the journal router (mounted at /api/journal). The journal module passes its date
 * schema in, so the two modules do not import each other.
 */
export function addJournalItemRoutes(router: Router, pool: Pool, entryDate: z.ZodType<string>) {
  // The items linked to the day's entry (oldest link first) and the items completed that day that are not linked
  // yet. A day without an entry has no links, but its completed items are still suggested.
  router.get('/:date/items', async (req, res) => {
    const date = entryDate.parse(req.params.date);
    const [linked, suggestions] = await Promise.all([
      pool.query(
        `SELECT ${ITEM_COLUMNS} FROM journal_entry_items AS link
         JOIN journal_entries AS entry ON entry.id = link.entry_id
         JOIN items ON items.id = link.item_id
         WHERE entry.entry_date = $1
         ORDER BY link.linked_at, items.id`,
        [date],
      ),
      pool.query(
        `SELECT ${ITEM_COLUMNS} FROM items
         WHERE items.completed_date = $1
           AND NOT EXISTS (
             SELECT 1 FROM journal_entry_items AS link
             JOIN journal_entries AS entry ON entry.id = link.entry_id
             WHERE link.item_id = items.id AND entry.entry_date = $1
           )
         ORDER BY items.id`,
        [date],
      ),
    ]);
    res.json({ linked: linked.rows, suggestions: suggestions.rows });
  });

  // Linking twice is not an error: 201 when the link is new, 200 when it was already there.
  router.put('/:date/items/:itemId', async (req, res) => {
    const date = entryDate.parse(req.params.date);
    const itemId = parseId(req.params.itemId, 'item');
    const result = await withTransaction(pool, async (client) => {
      const entryId = await lockedEntry(client, date);
      // The item is locked too, so its completed date cannot change before the link is written.
      const { rows } = await client.query<{ sameDay: boolean }>(
        `SELECT ${ITEM_COLUMNS}, items.completed_date IS NOT DISTINCT FROM $2::date AS "sameDay"
         FROM items WHERE items.id = $1 FOR SHARE`,
        [itemId, date],
      );
      if (rows.length === 0) throw itemNotFound();
      const { sameDay, ...item } = rows[0];
      if (!sameDay)
        throw new HttpError(400, 'Only items completed on the day of the entry can be linked');
      const inserted = await client.query(
        `INSERT INTO journal_entry_items (entry_id, item_id) VALUES ($1, $2)
         ON CONFLICT (entry_id, item_id) DO NOTHING`,
        [entryId, itemId],
      );
      return { created: inserted.rowCount === 1, item };
    });
    res.status(result.created ? 201 : 200).json(result.item);
  });

  router.delete('/:date/items/:itemId', async (req, res) => {
    const date = entryDate.parse(req.params.date);
    const itemId = parseId(req.params.itemId, 'item');
    const { rowCount } = await pool.query(
      `DELETE FROM journal_entry_items AS link
       USING journal_entries AS entry
       WHERE entry.id = link.entry_id AND entry.entry_date = $1 AND link.item_id = $2`,
      [date, itemId],
    );
    if (rowCount === 0) throw new HttpError(404, 'Link not found');
    res.status(204).end();
  });
}
