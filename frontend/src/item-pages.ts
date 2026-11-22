import type { Item } from './items';
import { requestJson } from './lib/api';

/** One page of `GET /api/items` (#144): the items, the offset of the next page (null on the last), the total. */
export type ItemPage = { items: Item[]; nextOffset: number | null; total: number };

/** The largest page the API answers; the bucket list asks for it so it needs the fewest requests. */
export const MAX_PAGE_SIZE = 500;

/**
 * Asks for the page at `offset` of the list `search` (the query string without `offset`). An answer without the
 * paging fields counts as the whole list, and a next offset that does not move forward ends the list, so a loop
 * over the pages always stops.
 */
export async function fetchItemPage(search: string, offset = 0): Promise<ItemPage> {
  const query = offset > 0 ? [search, `offset=${offset}`].filter(Boolean).join('&') : search;
  const data = await requestJson<{ items: Item[]; nextOffset?: unknown; total?: unknown }>(
    `/api/items${query ? `?${query}` : ''}`,
  );
  const nextOffset =
    typeof data.nextOffset === 'number' && data.nextOffset > offset ? data.nextOffset : null;
  const total = typeof data.total === 'number' ? data.total : offset + data.items.length;
  return { items: data.items, nextOffset, total };
}

/** Every item, page by page until the next offset is null (the bucket list groups them on the client). */
export async function fetchAllItems(): Promise<Item[]> {
  const items: Item[] = [];
  let offset: number | null = 0;
  while (offset !== null) {
    const page = await fetchItemPage(`limit=${MAX_PAGE_SIZE}`, offset);
    items.push(...page.items);
    offset = page.nextOffset;
  }
  return items;
}
