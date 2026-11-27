// #241: a small Notion workspace with the response shapes of the Notion API (version 2022-06-28), served by a fake
// `fetch`. No token or network is used. The shapes follow the API reference; the check against the real API is a
// user step (see docs/changes/241-notion-import.md).
//
//   Travel (top page)
//   ├── Japan (child page)  ── Kyoto notes (child page inside a toggle)
//   └── Reading list (child database) ── Dune, Emma (rows)
//   Notes (top page, no children)

type Json = Record<string, unknown>;

export const ids = {
  travel: '11111111-1111-4111-8111-111111111111',
  japan: '22222222-2222-4222-8222-222222222222',
  kyoto: '33333333-3333-4333-8333-333333333333',
  reading: '44444444-4444-4444-8444-444444444444',
  dune: '55555555-5555-4555-8555-555555555555',
  emma: '66666666-6666-4666-8666-666666666666',
  notes: '77777777-7777-4777-8777-777777777777',
} as const;

export const plain = (id: string) => id.replace(/-/g, '');

export const text = (content: string, annotations: Json = {}, href: string | null = null) => ({
  type: 'text',
  plain_text: content,
  href,
  annotations: { bold: false, italic: false, strikethrough: false, code: false, ...annotations },
});

export const block = (id: string, type: string, payload: Json, hasChildren = false): Json => ({
  object: 'block',
  id,
  type,
  has_children: hasChildren,
  [type]: payload,
});

const page = (id: string, title: string, parent: Json, edited: string, extra: Json = {}): Json => ({
  object: 'page',
  id,
  parent,
  last_edited_time: edited,
  archived: false,
  in_trash: false,
  properties: { Name: { id: 'title', type: 'title', title: [text(title)] } },
  ...extra,
});

export type World = {
  objects: Map<string, Json>;
  blocks: Map<string, Json[]>;
  rows: Map<string, string[]>;
};

export function makeWorld(): World {
  const objects = new Map<string, Json>();
  const add = (object: Json) => objects.set(object.id as string, object);
  add(
    page(ids.travel, 'Travel', { type: 'workspace', workspace: true }, '2026-11-01T00:00:00.000Z'),
  );
  add(
    page(ids.japan, 'Japan', { type: 'page_id', page_id: ids.travel }, '2026-11-02T00:00:00.000Z'),
  );
  add(
    page(
      ids.kyoto,
      'Kyoto notes',
      { type: 'block_id', block_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
      '2026-11-03T00:00:00.000Z',
    ),
  );
  add({
    object: 'database',
    id: ids.reading,
    parent: { type: 'page_id', page_id: ids.travel },
    last_edited_time: '2026-11-04T00:00:00.000Z',
    archived: false,
    in_trash: false,
    title: [text('Reading list')],
  });
  add(
    page(
      ids.dune,
      'Dune',
      { type: 'database_id', database_id: ids.reading },
      '2026-11-05T00:00:00.000Z',
    ),
  );
  add(
    page(
      ids.emma,
      'Emma',
      { type: 'database_id', database_id: ids.reading },
      '2026-11-06T00:00:00.000Z',
    ),
  );
  add(page(ids.notes, 'Notes', { type: 'workspace', workspace: true }, '2026-11-07T00:00:00.000Z'));

  const blocks = new Map<string, Json[]>();
  blocks.set(ids.travel, [
    block('b-travel-1', 'paragraph', {
      rich_text: [text('Trips I '), text('plan', { bold: true })],
    }),
    block(ids.japan, 'child_page', { title: 'Japan' }),
    block(ids.reading, 'child_database', { title: 'Reading list' }),
  ]);
  blocks.set(ids.japan, [
    block('b-japan-1', 'heading_1', { rich_text: [text('Japan 2027')] }),
    block('b-japan-2', 'bulleted_list_item', { rich_text: [text('Tokyo')] }, true),
    block('b-japan-3', 'to_do', { rich_text: [text('Book flights')], checked: true }),
    block('b-japan-4', 'toggle', { rich_text: [text('Cities')] }, true),
  ]);
  blocks.set('b-japan-2', [
    block('b-japan-2a', 'bulleted_list_item', { rich_text: [text('Shibuya')] }),
  ]);
  blocks.set('b-japan-4', [block(ids.kyoto, 'child_page', { title: 'Kyoto notes' })]);
  blocks.set(ids.kyoto, [
    block('b-kyoto-1', 'code', { rich_text: [text('print("kyoto")')], language: 'python' }),
    block('b-kyoto-2', 'paragraph', {
      rich_text: [text('Guide', {}, 'https://example.com/kyoto')],
    }),
  ]);
  blocks.set(ids.dune, [
    block('b-dune-1', 'quote', { rich_text: [text('Fear is the mind-killer')] }),
  ]);
  blocks.set(ids.emma, [block('b-emma-1', 'paragraph', { rich_text: [text('Austen')] })]);
  blocks.set(ids.notes, [block('b-notes-1', 'paragraph', { rich_text: [text('Loose notes')] })]);

  const rows = new Map<string, string[]>([[ids.reading, [ids.dune, ids.emma]]]);
  return { objects, blocks, rows };
}

/** A fake `fetch` that answers like Notion. `calls` records "METHOD path" of every request; `pageSize` forces paging. */
export function fakeNotion(world: World, options: { pageSize?: number; limitOnce?: boolean } = {}) {
  const calls: string[] = [];
  const headers: Record<string, string>[] = [];
  let limited = options.limitOnce === true;
  const paged = (all: Json[], cursor: string | undefined) => {
    const size = options.pageSize ?? 100;
    const start = cursor ? Number(cursor) : 0;
    const slice = all.slice(start, start + size);
    const next = start + size < all.length ? String(start + size) : null;
    return { object: 'list', results: slice, has_more: next !== null, next_cursor: next };
  };
  const reply = (status: number, body: unknown, extra: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...extra },
    });

  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const path = url.pathname.replace(/^\/v1/, '');
    calls.push(`${method} ${path}`);
    headers.push(init?.headers as Record<string, string>);
    const body = init?.body ? (JSON.parse(String(init.body)) as Json) : {};
    const cursor =
      (body.start_cursor as string | undefined) ??
      url.searchParams.get('start_cursor') ??
      undefined;
    if ((init?.headers as Record<string, string>).Authorization !== 'Bearer test-token')
      return reply(401, {
        object: 'error',
        code: 'unauthorized',
        message: 'API token is invalid.',
      });
    if (limited) {
      limited = false;
      return reply(
        429,
        { object: 'error', code: 'rate_limited', message: 'slow down' },
        { 'retry-after': '1' },
      );
    }
    if (method === 'POST' && path === '/search')
      return reply(200, paged([...world.objects.values()], cursor));
    let match = /^\/blocks\/([^/]+)\/children$/.exec(path);
    if (match) return reply(200, paged(world.blocks.get(match[1]) ?? [], cursor));
    match = /^\/databases\/([^/]+)\/query$/.exec(path);
    if (match) {
      const rows = (world.rows.get(match[1]) ?? []).map((id) => world.objects.get(id)!);
      return reply(200, paged(rows, cursor));
    }
    match = /^\/(pages|databases)\/([^/]+)$/.exec(path);
    if (match && world.objects.has(match[2])) return reply(200, world.objects.get(match[2]));
    return reply(404, { object: 'error', code: 'object_not_found', message: 'Could not find it.' });
  }) as typeof fetch;

  return { fetch: impl, calls, headers };
}
