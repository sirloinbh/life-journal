import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { testPool, withApi } from './helpers.js';
import { fakeNotion, ids, makeWorld, plain, type World } from './notion-fixtures.js';

const url = process.env.TEST_DATABASE_URL;
const SCHEMA = 'test_notion';
const TODAY = '2026-11-27';

const migration = (file: string) =>
  readFile(new URL(`../../database/migrations/${file}`, import.meta.url), 'utf8');

// notion_pages in its own schema; essays (015) and what it needs (tags rule 010, audit log 008) for the copy.
async function scratchPool(t: { after: (fn: () => Promise<void>) => void }) {
  const setup = testPool({ max: 1 });
  await setup.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE; CREATE SCHEMA ${SCHEMA}`);
  await setup.query(`SET search_path TO ${SCHEMA}`);
  for (const file of [
    '002_items.sql',
    '003_item_ratings.sql',
    '004_item_review.sql',
    '005_item_link.sql',
    '007_coffee_category.sql',
    '008_audit_log.sql',
    '009_items_check_names.sql',
    '010_item_tags_companions.sql',
    '015_essays.sql',
    '018_notion_pages.sql',
  ]) {
    await setup.query(await migration(file));
  }
  // Applied twice to show it is safe to run again.
  await setup.query(await migration('018_notion_pages.sql'));
  await setup.end();
  const pool = testPool({ options: `-c search_path=${SCHEMA}` });
  t.after(async () => {
    try {
      await pool.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    } finally {
      await pool.end();
    }
  });
  return pool;
}

type Call = Parameters<Parameters<typeof withApi>[1]>[0];
type Doc = {
  id: number;
  notionId: string;
  parentNotionId: string | null;
  kind: string;
  title: string;
  path: string;
  deletedAt: string | null;
  body?: string;
};
type Status = {
  state: string;
  configured: boolean;
  seen: number;
  created: number;
  updated: number;
  unchanged: number;
  deleted: number;
  error: string | null;
};

const notion = (world: World, options: { pageSize?: number; limitOnce?: boolean } = {}) => {
  const fake = fakeNotion(world, options);
  return {
    fake,
    config: { token: 'test-token', fetch: fake.fetch, delayMs: 0, sleep: async () => {} },
  };
};

const poll = async (call: Call): Promise<Status> => {
  for (;;) {
    const status = (await call('/api/notion/import')).data as unknown as Status;
    if (status.state !== 'running') return status;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
};

async function runImport(call: Call): Promise<Status> {
  assert.equal((await call('/api/notion/import', { method: 'POST' })).status, 202);
  return poll(call);
}

const documents = async (call: Call) => (await call('/api/documents')).data.documents as Doc[];
const byTitle = (docs: Doc[], title: string) => docs.find((d) => d.title === title)!;
const read = async (call: Call, id: number) =>
  (await call(`/api/documents/${id}`)).data as unknown as Doc;
const live = async (call: Call) =>
  (await documents(call)).filter((d) => d.deletedAt === null).length;

test(
  'importing walks every descendant, keeps the tree, and a second run writes only changes',
  { skip: !url },
  async (t) => {
    const pool = await scratchPool(t);
    const world = makeWorld();
    // Pages of 2 results, so search, block lists, and database queries are all read across pages.
    const { fake, config } = notion(world, { pageSize: 2 });
    await withApi(
      pool,
      async (call) => {
        const first = await runImport(call);
        assert.equal(first.state, 'done');
        assert.equal(first.error, null);
        assert.equal(first.seen, 7);
        assert.equal(first.created, 7);

        const docs = await documents(call);
        assert.deepEqual(docs.map((d) => d.title).sort(), [
          'Dune',
          'Emma',
          'Japan',
          'Kyoto notes',
          'Notes',
          'Reading list',
          'Travel',
        ]);
        assert.equal(byTitle(docs, 'Travel').parentNotionId, null);
        assert.equal(byTitle(docs, 'Notes').parentNotionId, null);
        assert.equal(byTitle(docs, 'Japan').parentNotionId, plain(ids.travel));
        assert.equal(byTitle(docs, 'Reading list').kind, 'database');
        assert.equal(byTitle(docs, 'Reading list').parentNotionId, plain(ids.travel));
        assert.equal(byTitle(docs, 'Dune').parentNotionId, plain(ids.reading));
        assert.equal(byTitle(docs, 'Kyoto notes').parentNotionId, plain(ids.japan));
        assert.equal(byTitle(docs, 'Kyoto notes').path, 'Travel / Japan / Kyoto notes');

        assert.equal(
          (await read(call, byTitle(docs, 'Japan').id)).body,
          '# Japan 2027\n\n- Tokyo\n  - Shibuya\n- [x] Book flights\n- Cities',
        );
        assert.equal(
          (await read(call, byTitle(docs, 'Kyoto notes').id)).body,
          '```python\nprint("kyoto")\n```\n\n[Guide](https://example.com/kyoto)',
        );

        // The token goes out as a bearer header on every request, with a Notion version.
        assert.ok(
          fake.headers.every((h) => h.Authorization === 'Bearer test-token' && h['Notion-Version']),
        );

        // Second run, nothing changed in Notion: nothing is written.
        const rows = () => pool.query('SELECT id, imported_at FROM notion_pages ORDER BY id');
        const before = (await rows()).rows;
        const second = await runImport(call);
        assert.equal(second.state, 'done');
        assert.deepEqual(
          [second.created, second.updated, second.unchanged, second.deleted],
          [0, 0, 7, 0],
        );
        assert.deepEqual((await rows()).rows, before);

        // One page changes in Notion: only it is written.
        world.objects.get(ids.emma)!.last_edited_time = '2026-11-20T00:00:00.000Z';
        world.blocks.get(ids.emma)!.push({
          object: 'block',
          id: 'b-emma-2',
          type: 'paragraph',
          has_children: false,
          paragraph: { rich_text: [{ plain_text: 'Updated', annotations: {} }] },
        });
        const third = await runImport(call);
        assert.deepEqual(
          [third.created, third.updated, third.unchanged, third.deleted],
          [0, 1, 6, 0],
        );
        assert.equal(
          (await read(call, byTitle(await documents(call), 'Emma').id)).body,
          'Austen\n\nUpdated',
        );
      },
      { today: () => TODAY, notion: config },
    );
  },
);

test(
  'a page removed from Notion is marked deleted, and comes back when it returns',
  { skip: !url },
  async (t) => {
    const pool = await scratchPool(t);
    const world = makeWorld();
    const { config } = notion(world);
    await withApi(
      pool,
      async (call) => {
        await runImport(call);
        const dune = world.objects.get(ids.dune)!;
        world.rows.set(ids.reading, [ids.emma]);
        world.objects.delete(ids.dune);
        const run = await runImport(call);
        assert.equal(run.deleted, 1);
        const docs = await documents(call);
        assert.notEqual(byTitle(docs, 'Dune').deletedAt, null);
        assert.equal(byTitle(docs, 'Emma').deletedAt, null);
        // The row and its text are kept.
        assert.equal(docs.length, 7);

        world.rows.set(ids.reading, [ids.emma, ids.dune]);
        world.objects.set(ids.dune, dune);
        const back = await runImport(call);
        assert.equal(back.updated, 1);
        assert.equal(byTitle(await documents(call), 'Dune').deletedAt, null);
      },
      { notion: config },
    );
  },
);

test('a failed run deletes nothing; a missing token is refused', { skip: !url }, async (t) => {
  const pool = await scratchPool(t);
  const world = makeWorld();
  await withApi(
    pool,
    async (call) => {
      assert.equal((await runImport(call)).state, 'done');
    },
    { notion: notion(world).config },
  );
  // A wrong token: Notion answers 401, and the message does not repeat the token.
  await withApi(
    pool,
    async (call) => {
      const failed = await runImport(call);
      assert.equal(failed.state, 'failed');
      assert.equal(failed.error, 'Notion rejected the token');
      assert.equal(await live(call), 7);
    },
    { notion: { ...notion(world).config, token: 'wrong-token' } },
  );
  // Nothing shared: nothing to import, and nothing is marked deleted.
  const empty = makeWorld();
  empty.objects.clear();
  await withApi(
    pool,
    async (call) => {
      const failed = await runImport(call);
      assert.equal(failed.state, 'failed');
      assert.match(failed.error ?? '', /No pages are shared/);
      assert.equal(await live(call), 7);
    },
    { notion: notion(empty).config },
  );
  await withApi(
    pool,
    async (call) => {
      const status = (await call('/api/notion/import')).data as unknown as Status;
      assert.equal(status.configured, false);
      const refused = await call('/api/notion/import', { method: 'POST' });
      assert.equal(refused.status, 400);
      assert.match(String(refused.data.error), /NOTION_TOKEN/);
    },
    { notion: { token: '' } },
  );
});

test(
  'a rate-limited request is retried, and a second start while running is refused',
  { skip: !url },
  async (t) => {
    const pool = await scratchPool(t);
    const { fake, config } = notion(makeWorld(), { limitOnce: true });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    // The first request waits for the gate, so the run is still going when the second start arrives.
    const held = async (...args: Parameters<typeof fetch>) => {
      await gate;
      return fake.fetch(...args);
    };
    await withApi(
      pool,
      async (call) => {
        assert.equal((await call('/api/notion/import', { method: 'POST' })).status, 202);
        assert.equal((await call('/api/notion/import', { method: 'POST' })).status, 409);
        release();
        const status = await poll(call);
        assert.equal(status.state, 'done');
        assert.equal(status.created, 7);
        assert.equal(
          fake.calls.filter((c) => c === 'POST /search').length,
          2,
          'the limited call was retried',
        );
      },
      { notion: { ...config, fetch: held as typeof fetch } },
    );
  },
);

test(
  'copying a page into an essay leaves the page alone, and a re-import never touches essays',
  { skip: !url },
  async (t) => {
    const pool = await scratchPool(t);
    const world = makeWorld();
    await withApi(
      pool,
      async (call) => {
        await runImport(call);
        const japan = byTitle(await documents(call), 'Japan');
        const copied = await call(`/api/documents/${japan.id}/essay`, { method: 'POST' });
        assert.equal(copied.status, 201);
        const essay = (await call(`/api/essays/${copied.data.id}`)).data;
        assert.equal(essay.title, 'Japan');
        assert.equal(
          essay.body,
          '# Japan 2027\n\n- Tokyo\n  - Shibuya\n- [x] Book flights\n- Cities',
        );
        assert.equal(essay.status, 'draft');
        assert.equal(essay.writtenDate, TODAY);

        // The essay is edited and the page changes in Notion: the re-import changes only the page.
        await call(`/api/essays/${copied.data.id}`, {
          method: 'PATCH',
          body: { title: 'My Japan' },
        });
        world.objects.get(ids.japan)!.last_edited_time = '2026-11-21T00:00:00.000Z';
        assert.equal((await runImport(call)).updated, 1);
        assert.equal((await call(`/api/essays/${copied.data.id}`)).data.title, 'My Japan');
        assert.equal((await call('/api/essays')).data.total, 1);

        assert.equal((await call('/api/documents/999999/essay', { method: 'POST' })).status, 404);
        assert.equal((await call('/api/documents/abc')).status, 400);

        // A page longer than an essay can be is refused with a clear message.
        await pool.query(`UPDATE notion_pages SET body = repeat('x', 60000) WHERE id = $1`, [
          japan.id,
        ]);
        const tooLong = await call(`/api/documents/${japan.id}/essay`, { method: 'POST' });
        assert.equal(tooLong.status, 400);
        assert.match(String(tooLong.data.error), /longer than an essay/);
        assert.equal((await call('/api/essays')).data.total, 1);

        const { rows } = await pool.query<{ after: Record<string, unknown> }>(
          `SELECT after FROM audit_log WHERE entity = 'essay' ORDER BY id`,
        );
        assert.equal(rows.length, 2); // the copy and the title edit
        assert.equal(rows[0].after.copiedFromDocument, japan.id);
      },
      { today: () => TODAY, notion: notion(world).config },
    );
  },
);
