import { vi } from 'vitest';

import type { Log } from '../item-logs';
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
    /** Tastings and visits of drink and travel items (#214). */
    logs: [] as (Log & { itemId: number })[],
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
  let nextLogId = 1;
  // `/api/items/<item>/logs[/<log>]`: list newest first, add, edit, and delete; drink and travel items only.
  const logsApi = (method: string, itemId: number, logId: number | null, body: Log) => {
    const item = api.items.find(({ id }) => id === itemId);
    if (!item) return json({ error: 'Item not found' }, 404);
    if (method === 'GET') {
      const logs = api.logs
        .filter((log) => log.itemId === itemId)
        .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
      return json({ logs });
    }
    if (method === 'POST') {
      if (item.category !== 'drink' && item.category !== 'travel') {
        return json({ error: 'Only drink and travel items can have tastings and visits' }, 400);
      }
      if (body.date > today) return json({ error: 'Date cannot be after today' }, 400);
      const log = { ...body, id: nextLogId++, itemId };
      api.logs.push(log);
      return json(log, 201);
    }
    const found = api.logs.find((log) => log.id === logId && log.itemId === itemId);
    if (!found) return json({ error: 'Log not found' }, 404);
    if (method === 'DELETE') {
      api.logs = api.logs.filter((log) => log !== found);
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
      const logPath = /^\/api\/items\/(\d+)\/logs(?:\/(\d+))?$/.exec(path);
      if (logPath) {
        const body = (init.body ? JSON.parse(init.body) : {}) as Log;
        if (method !== 'GET') api.requests.push({ method, path, body });
        const logId = logPath[2] === undefined ? null : Number(logPath[2]);
        return logsApi(method, Number(logPath[1]), logId, body);
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
