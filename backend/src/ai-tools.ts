// The AI tools of Reviews & Diary (project-standards#711, ADR-0017). shared-ai lists and calls them over
// /internal/tools; standard/tools.ts checks the signed call, the scope, and writes the audit row.
import { z } from 'zod/v4';

import { type Db, listItems, listQuery } from './items.js';
import { defineTool } from './standard/tools.js';

// The route's own filters (so the tool cannot drift from it) plus a bound: a call returns at most 200 items.
const MAX_LIMIT = 200;
const listItemsInput = listQuery
  .pick({ q: true, category: true, status: true, from: true, to: true })
  .extend({
    limit: z
      .number({ error: 'The limit must be a number' })
      .int('The limit must be a whole number')
      .min(1, 'The limit must be at least 1')
      .max(MAX_LIMIT, `The limit is at most ${MAX_LIMIT}`)
      .default(50),
  });

export const tools = [
  defineTool({
    name: 'list_items',
    description:
      'List the journal items (reviews, wishlist and done entries), newest first. Optional filters: q (text in the title or details), category, status (wishlist or done), from and to (YYYY-MM-DD, by completed or planned date). At most 200 items per call (default 50).',
    input: listItemsInput,
    access: 'read',
    action: 'read',
    entity: 'item',
    run: async ({ limit, ...filters }, { db }: { db: Db }) => ({
      result: await listItems(db, filters, limit),
    }),
  }),
];
