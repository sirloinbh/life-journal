import type { Pool } from 'pg';

import { blocks as toMarkdown, type NotionBlock } from './notion-markdown.js';
import { isStorable } from './validation.js';

// #241: import the pages shared with a Notion integration, and every descendant, into `notion_pages`.
// The walk starts at the top pages (found with the search API), follows `child_page` and `child_database`
// blocks, converts each page's blocks to Markdown, writes only pages that are new or changed, and marks a page
// that is gone from Notion as deleted. Notion allows about 3 requests a second, so calls are spaced out.

const NOTION_VERSION = '2022-06-28';
const API = 'https://api.notion.com/v1';
const DEFAULT_DELAY_MS = 350;
const MAX_RETRIES = 5;
const MAX_TITLE = 500;
const MAX_BODY = 2_000_000;

export class NotionError extends Error {}
/** Notion says the page, database, or block does not exist or is not shared (404, or 403 restricted). */
class NotionMissing extends NotionError {}

export type NotionOptions = {
  token: string;
  /** Replaced in tests with recorded responses; the real `fetch` otherwise. */
  fetch?: typeof fetch;
  /** The least time between two requests; 0 in tests. */
  delayMs?: number;
  /** Replaced in tests so the waits cost nothing. */
  sleep?: (ms: number) => Promise<void>;
};

type Json = Record<string, unknown>;

export class NotionClient {
  private last = 0;
  private readonly send: typeof fetch;
  private readonly delay: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly options: NotionOptions) {
    this.send = options.fetch ?? fetch;
    this.delay = options.delayMs ?? DEFAULT_DELAY_MS;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async request(method: 'GET' | 'POST', path: string, body?: Json): Promise<Json> {
    for (let attempt = 0; ; attempt += 1) {
      const wait = this.last + this.delay - Date.now();
      if (wait > 0) await this.sleep(wait);
      this.last = Date.now();
      let response: Response;
      try {
        response = await this.send(`${API}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${this.options.token}`,
            'Notion-Version': NOTION_VERSION,
            ...(body ? { 'Content-Type': 'application/json' } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(30_000),
        });
      } catch {
        throw new NotionError('Cannot reach Notion');
      }
      if (response.status === 429 && attempt < MAX_RETRIES) {
        const seconds = Number(response.headers.get('retry-after'));
        await this.sleep((Number.isFinite(seconds) && seconds > 0 ? seconds : 2) * 1000);
        continue;
      }
      if (response.status === 401) throw new NotionError('Notion rejected the token');
      const data = (await response.json().catch(() => null)) as Json | null;
      if (response.status === 404 || response.status === 403)
        throw new NotionMissing(`Notion answered ${response.status}`);
      if (!response.ok) {
        const message = typeof data?.message === 'string' ? `: ${data.message}` : '';
        throw new NotionError(`Notion answered ${response.status}${message}`);
      }
      return data ?? {};
    }
  }

  /** Every result of a paged call, following `next_cursor`. */
  async all(method: 'GET' | 'POST', path: string, body: Json = {}): Promise<Json[]> {
    const results: Json[] = [];
    let cursor: string | undefined;
    do {
      const data =
        method === 'GET'
          ? await this.request(
              'GET',
              `${path}${path.includes('?') ? '&' : '?'}page_size=100${cursor ? `&start_cursor=${encodeURIComponent(cursor)}` : ''}`,
            )
          : await this.request('POST', path, {
              ...body,
              page_size: 100,
              ...(cursor ? { start_cursor: cursor } : {}),
            });
      results.push(...((data.results as Json[] | undefined) ?? []));
      cursor =
        data.has_more === true && typeof data.next_cursor === 'string'
          ? data.next_cursor
          : undefined;
    } while (cursor);
    return results;
  }
}

export type ImportStatus = {
  state: 'idle' | 'running' | 'done' | 'failed';
  startedAt: string | null;
  finishedAt: string | null;
  seen: number;
  created: number;
  updated: number;
  unchanged: number;
  deleted: number;
  skipped: number;
  current: string | null;
  error: string | null;
};

const emptyStatus = (): ImportStatus => ({
  state: 'idle',
  startedAt: null,
  finishedAt: null,
  seen: 0,
  created: 0,
  updated: 0,
  unchanged: 0,
  deleted: 0,
  skipped: 0,
  current: null,
  error: null,
});

const clean = (value: string) => [...value].filter((c) => isStorable(c)).join('');

const titleOf = (object: Json): string => {
  const properties = object.properties as Record<string, Json> | undefined;
  let parts: unknown;
  if (object.object === 'database') parts = object.title;
  else parts = Object.values(properties ?? {}).find((property) => property.type === 'title')?.title;
  const text = Array.isArray(parts)
    ? parts.map((part) => (part as { plain_text?: string }).plain_text ?? '').join('')
    : '';
  return clean(text).trim().slice(0, MAX_TITLE) || 'Untitled';
};

const normalizeId = (id: string) => id.replace(/-/g, '').toLowerCase();

type Existing = {
  notion_id: string;
  parent_notion_id: string | null;
  title: string;
  path: string;
  notion_edited_at: Date | string;
  deleted_at: Date | null;
};

/** Run one import. Progress is reported through `status`, which is updated in place. */
async function runImport(pool: Pool, client: NotionClient, status: ImportStatus) {
  const found = await client.all('POST', '/search', {});
  const known = new Map<string, Json>();
  for (const object of found) known.set(normalizeId(String(object.id)), object);
  const parentOf = (object: Json) => {
    const parent = object.parent as Json | undefined;
    const id = parent?.page_id ?? parent?.database_id;
    return typeof id === 'string' ? normalizeId(id) : null;
  };
  // A top page's parent is the workspace, or a page that is not shared, so it is not in the search results.
  const tops = found.filter((object) => {
    if (object.archived === true || object.in_trash === true) return false;
    const parent = object.parent as Json | undefined;
    if (parent?.type === 'block_id') return false;
    const id = parentOf(object);
    return id === null || !known.has(id);
  });
  if (tops.length === 0)
    throw new NotionError('No pages are shared with the integration, so nothing was imported');

  const { rows } = await pool.query<Existing>(
    `SELECT notion_id, parent_notion_id, title, path, notion_edited_at, deleted_at FROM notion_pages`,
  );
  const existing = new Map(rows.map((row) => [row.notion_id, row]));
  const seen = new Set<string>();

  const save = async (
    object: Json,
    kind: 'page' | 'database',
    parentId: string | null,
    path: string,
    body: string,
  ) => {
    const id = normalizeId(String(object.id));
    const title = titleOf(object);
    const edited = new Date(String(object.last_edited_time));
    const before = existing.get(id);
    const same =
      before !== undefined &&
      before.deleted_at === null &&
      new Date(before.notion_edited_at).getTime() === edited.getTime() &&
      before.parent_notion_id === parentId &&
      before.title === title &&
      before.path === path;
    if (same) {
      status.unchanged += 1;
      return;
    }
    await pool.query(
      `INSERT INTO notion_pages (notion_id, parent_notion_id, kind, title, body, path, notion_edited_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (notion_id) DO UPDATE SET parent_notion_id = $2, kind = $3, title = $4, body = $5,
         path = $6, notion_edited_at = $7, imported_at = now(), deleted_at = NULL`,
      [id, parentId, kind, title, body, path, edited],
    );
    if (before) status.updated += 1;
    else status.created += 1;
  };

  type Ref = { kind: 'page' | 'database'; id: string; object?: Json };
  // The blocks of a page with their children attached; child pages and databases are returned as refs instead.
  const fetchBlocks = async (blockId: string, refs: Ref[]): Promise<NotionBlock[]> => {
    const list = (await client.all('GET', `/blocks/${blockId}/children`)) as NotionBlock[];
    for (const block of list) {
      if (block.type === 'child_page') refs.push({ kind: 'page', id: block.id });
      else if (block.type === 'child_database') refs.push({ kind: 'database', id: block.id });
      else if (block.has_children === true) block.children = await fetchBlocks(block.id, refs);
    }
    return list;
  };

  const lookup = async (ref: Ref): Promise<Json> =>
    ref.object ??
    known.get(normalizeId(ref.id)) ??
    (await client.request('GET', `/${ref.kind === 'page' ? 'pages' : 'databases'}/${ref.id}`));

  const walk = async (
    object: Json,
    kind: 'page' | 'database',
    parentId: string | null,
    parentPath: string,
  ): Promise<void> => {
    const id = normalizeId(String(object.id));
    if (seen.has(id) || object.archived === true || object.in_trash === true) return;
    const title = titleOf(object);
    status.current = title;
    const path = parentPath ? `${parentPath} / ${title}` : title;
    const refs: Ref[] = [];
    let body = '';
    try {
      if (kind === 'page') {
        body = clean(toMarkdown(await fetchBlocks(String(object.id), refs))).slice(0, MAX_BODY);
      } else {
        for (const row of await client.all('POST', `/databases/${object.id}/query`, {}))
          refs.push({ kind: 'page', id: String(row.id), object: row });
      }
    } catch (cause) {
      // Deleted, moved out of the shared tree, or unshared while the walk ran: leave it out of `seen`, so the
      // end of the run marks it as removed, and carry on with the rest.
      if (!(cause instanceof NotionMissing)) throw cause;
      status.skipped += 1;
      return;
    }
    seen.add(id);
    status.seen = seen.size;
    await save(object, kind, parentId, path, body);
    for (const ref of refs) {
      // A database's rows are in the query result; a child_page block needs its own page object.
      let child: Json;
      try {
        child = await lookup(ref);
      } catch (cause) {
        if (!(cause instanceof NotionMissing)) throw cause;
        status.skipped += 1;
        continue;
      }
      await walk(child, ref.kind, id, path);
    }
  };

  for (const top of tops)
    await walk(top, top.object === 'database' ? 'database' : 'page', null, '');

  // Reached only when the whole walk worked, so a failed run never marks pages as deleted.
  const gone = await pool.query(
    `UPDATE notion_pages SET deleted_at = now() WHERE deleted_at IS NULL AND notion_id <> ALL($1::text[])`,
    [[...seen]],
  );
  status.deleted = gone.rowCount ?? 0;
}

/** One import at a time, run in the background; the screen polls `status`. */
export function createImportRunner(pool: Pool, makeClient: () => NotionClient | null) {
  let status = emptyStatus();
  return {
    status: (): ImportStatus => ({ ...status }),
    /** Starts a run; false when one is already running. Throws NotionError when there is no token. */
    start(): boolean {
      if (status.state === 'running') return false;
      const client = makeClient();
      if (!client) throw new NotionError('The Notion token is not set (NOTION_TOKEN)');
      const run: ImportStatus = {
        ...emptyStatus(),
        state: 'running',
        startedAt: new Date().toISOString(),
      };
      status = run;
      void runImport(pool, client, run)
        .then(() => {
          run.state = 'done';
        })
        .catch((cause: unknown) => {
          run.state = 'failed';
          run.error =
            cause instanceof NotionError ? cause.message : 'The import failed; see the server log';
          if (!(cause instanceof NotionError)) console.error(cause);
        })
        .finally(() => {
          run.current = null;
          run.finishedAt = new Date().toISOString();
          if (status === run) status = { ...run };
        });
      return true;
    },
  };
}
