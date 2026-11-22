import type { Item } from './items';
import { requestJson } from './lib/api';
import { apiKey } from './lib/query';

/** One page of `GET /api/items` (#144): the items, the offset of the next page (null on the last), the total. */
export type ItemPage = { items: Item[]; nextOffset: number | null; total: number };

/** The largest page the API answers; the bucket list asks for it so it needs the fewest requests. */
const MAX_PAGE_SIZE = 500;

/**
 * Query keys of the item list (#158). Both start with `/api/items`, so invalidating `apiKey('/api/items')` refreshes the
 * table and the bucket list. The second part keeps a table address apart from the bucket list's every-page list.
 */
export const allItemsKey = apiKey('/api/items', 'every page');
/** Every table address: a change on the bucket list marks them stale, so the table asks again when it opens. */
export const tablePagesKey = apiKey('/api/items', 'pages');
export const itemPagesKey = (search: string) => [...tablePagesKey, search];

/**
 * Asks for the page at `offset` of the list `search` (the table address; its own `offset` is replaced). An answer without the
 * paging fields counts as the whole list, and a next offset that does not move forward ends the list, so a loop
 * over the pages always stops. `signal` cancels the request when the screen no longer needs it.
 */
export async function fetchItemPage(
  search: string,
  offset = 0,
  signal?: AbortSignal,
): Promise<ItemPage> {
  // An offset already in the address (typed by hand) is replaced, not sent twice.
  const rest = search
    .split('&')
    .filter((part) => part && !part.startsWith('offset='))
    .join('&');
  const query = offset > 0 ? [rest, `offset=${offset}`].filter(Boolean).join('&') : search;
  const data = await requestJson<{ items: Item[]; nextOffset?: unknown; total?: unknown }>(
    `/api/items${query ? `?${query}` : ''}`,
    { signal },
  );
  const nextOffset =
    typeof data.nextOffset === 'number' && data.nextOffset > offset ? data.nextOffset : null;
  const total = typeof data.total === 'number' ? data.total : offset + data.items.length;
  return { items: data.items, nextOffset, total };
}

/** Every item, page by page until the next offset is null (the bucket list groups them on the client). */
export async function fetchAllItems(signal?: AbortSignal): Promise<Item[]> {
  const items: Item[] = [];
  let offset: number | null = 0;
  while (offset !== null) {
    const page = await fetchItemPage(`limit=${MAX_PAGE_SIZE}`, offset, signal);
    items.push(...page.items);
    offset = page.nextOffset;
  }
  return items;
}
