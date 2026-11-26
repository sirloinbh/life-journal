import { vi } from 'vitest';

import type { Quote } from '../item-quotes';
import type { Item } from '../items';
import { json } from './app';

/** A whole item with defaults; `fields` overrides any of them. */
export const itemRow = (id: number, fields: Partial<Item> = {}): Item => ({
  id,
  category: 'reading',
  subtype: null,
  title: '',
  status: 'wishlist',
  costKrw: null,
  plannedDate: null,
  completedDate: null,
  details: {},
  rating: null,
  subRatings: {},
  review: null,
  link: null,
  tags: [],
  companions: [],
  ...fields,
});

/**
 * An in-memory items API with the rules the bucket list depends on. `failNext` answers the next
 * change with an error, `failList` fails the list, `gate` holds every request and `listGate` the
 * lists until it resolves. A held list answers with what was true when it was asked.
 */
export function fakeItemsApi(initial: Partial<Item>[] = [], today = '2026-10-31') {
  let nextId = 1;
  const row = (fields: Partial<Item>) => itemRow(nextId++, fields);
  const api = {
    items: initial.map(row),
    requests: [] as { method: string; path: string; body: Record<string, unknown> }[],
    failNext: null as { status: number; error: string } | null,
    failList: false,
    gate: null as Promise<void> | null,
    listGate: null as Promise<void> | null,
    /** Quotes of reading items (#217), kept apart from the items as the server does. */
    quotes: [] as (Quote & { itemId: number })[],
  };
  let nextQuoteId = 1;
  // `/api/items/<item>/quotes[/<quote>]`: list, add, edit, and delete; only reading items take quotes.
  const quotesApi = (method: string, itemId: number, quoteId: number | null, body: Quote) => {
    const item = api.items.find(({ id }) => id === itemId);
    if (!item) return json({ error: 'Item not found' }, 404);
    if (method === 'GET') {
      const quotes = api.quotes.filter((quote) => quote.itemId === itemId);
      return json({ quotes });
    }
    if (method === 'POST') {
      if (item.category !== 'reading') {
        return json({ error: 'Only reading items can have quotes' }, 400);
      }
      if (!body.text.trim()) return json({ error: 'Quote is required' }, 400);
      const quote = { ...body, id: nextQuoteId++, itemId };
      api.quotes.push(quote);
      return json(quote, 201);
    }
    const found = api.quotes.find((quote) => quote.id === quoteId && quote.itemId === itemId);
    if (!found) return json({ error: 'Quote not found' }, 404);
    if (method === 'DELETE') {
      api.quotes = api.quotes.filter((quote) => quote !== found);
      return json(undefined, 204);
    }
    Object.assign(found, body);
    return json(found);
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init: { method?: string; body?: string } = {}) => {
      const method = init.method ?? 'GET';
      if (path === '/api/health') return json({ today });
      if (api.gate) await api.gate;
      const quotePath = /^\/api\/items\/(\d+)\/quotes(?:\/(\d+))?$/.exec(path);
      if (quotePath) {
        const body = (init.body ? JSON.parse(init.body) : {}) as Quote;
        if (method !== 'GET') api.requests.push({ method, path, body });
        const quoteId = quotePath[2] === undefined ? null : Number(quotePath[2]);
        return quotesApi(method, Number(quotePath[1]), quoteId, body);
      }
      if (method === 'GET') {
        const items = api.items;
        if (api.listGate) {
          await api.listGate;
          return json({ items });
        }
        return api.failList
          ? json({ error: 'A server error occurred' }, 500)
          : json({ items: api.items });
      }
      const body = (init.body ? JSON.parse(init.body) : {}) as Record<string, unknown>;
      api.requests.push({ method, path, body });
      if (api.failNext) {
        const { status, error } = api.failNext;
        api.failNext = null;
        return json({ error }, status);
      }
      if (body.title === '') return json({ error: 'Title is required' }, 400);
      if (method === 'POST') {
        const created = row(body);
        api.items.push(created);
        return json(created, 201);
      }
      const id = Number(path.split('/').pop());
      if (method === 'DELETE') {
        api.items = api.items.filter((item) => item.id !== id);
        return json(undefined, 204);
      }
      api.items = api.items.map((item) => (item.id === id ? { ...item, ...body } : item));
      return json(api.items.find((item) => item.id === id));
    }),
  );
  return api;
}
