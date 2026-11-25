import { vi } from 'vitest';

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
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init: { method?: string; body?: string } = {}) => {
      const method = init.method ?? 'GET';
      if (path === '/api/health') return json({ today });
      if (api.gate) await api.gate;
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
