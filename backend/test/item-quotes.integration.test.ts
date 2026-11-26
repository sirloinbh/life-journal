import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { testPool, withApi } from './helpers.js';

const url = process.env.TEST_DATABASE_URL;
const TODAY = '2026-10-31';

// Requires a dedicated test DB with database/migrations applied. Skipped (not passed) without it.
test('the quotes migration can be applied again', { skip: !url }, async (t) => {
  const pool = testPool();
  t.after(() => pool.end());
  const sql = await readFile(
    new URL('../../database/migrations/011_item_quotes.sql', import.meta.url),
    'utf8',
  );
  await pool.query(sql);
  await pool.query(sql);
  const { rowCount } = await pool.query(
    "SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'item_quotes'",
  );
  assert.equal(rowCount, 1);
});

test(
  'quotes of a book are added, listed in page order, edited, and deleted',
  { skip: !url },
  async (t) => {
    const pool = testPool();
    t.after(() => pool.end());
    await withApi(
      pool,
      async (call) => {
        const book = await call('/api/items', {
          method: 'POST',
          body: { category: 'reading', title: '데미안' },
        });
        const base = `/api/items/${String(book.data.id)}/quotes`;
        const add = (body: unknown) => call(base, { method: 'POST', body });

        const late = await add({ text: '새는 알에서 나오려고 투쟁한다.', page: 120, note: '핵심' });
        assert.equal(late.status, 201);
        assert.deepEqual(
          { ...late.data, id: 0, createdAt: 0, updatedAt: 0 },
          {
            id: 0,
            itemId: book.data.id,
            text: '새는 알에서 나오려고 투쟁한다.',
            page: 120,
            note: '핵심',
            createdAt: 0,
            updatedAt: 0,
          },
        );
        assert.equal((await add({ text: '페이지 없는 메모' })).status, 201);
        assert.equal((await add({ text: '앞부분', page: 3 })).status, 201);

        const texts = async () =>
          ((await call(base)).data.quotes as { text: string }[]).map((quote) => quote.text);
        assert.deepEqual(await texts(), [
          '앞부분',
          '새는 알에서 나오려고 투쟁한다.',
          '페이지 없는 메모',
        ]);

        const path = `${base}/${String(late.data.id)}`;
        const edited = await call(path, { method: 'PATCH', body: { note: null, page: 1 } });
        assert.equal(edited.status, 200);
        assert.deepEqual(
          [edited.data.text, edited.data.page, edited.data.note],
          ['새는 알에서 나오려고 투쟁한다.', 1, null],
        );
        assert.equal((await texts())[0], '새는 알에서 나오려고 투쟁한다.');

        // A quote is reached only through its own item.
        const other = await call('/api/items', {
          method: 'POST',
          body: { category: 'reading', title: '싯다르타' },
        });
        const wrongItem = `/api/items/${String(other.data.id)}/quotes/${String(late.data.id)}`;
        assert.deepEqual((await call(wrongItem, { method: 'DELETE' })).data, {
          error: 'Quote not found',
        });

        assert.equal((await call(path, { method: 'DELETE' })).status, 204);
        assert.equal((await call(path, { method: 'DELETE' })).status, 404);
        assert.deepEqual(await texts(), ['앞부분', '페이지 없는 메모']);
      },
      { today: () => TODAY },
    );
  },
);

test(
  'only reading items take quotes, and a quoted item stays in Reading',
  { skip: !url },
  async (t) => {
    const pool = testPool();
    t.after(() => pool.end());
    await withApi(
      pool,
      async (call) => {
        const film = await call('/api/items', {
          method: 'POST',
          body: { category: 'screen', subtype: 'movie', title: '기생충' },
        });
        const refused = await call(`/api/items/${String(film.data.id)}/quotes`, {
          method: 'POST',
          body: { text: '아들아, 너는 계획이 다 있구나' },
        });
        assert.deepEqual(
          [refused.status, refused.data],
          [400, { error: 'Only reading items can have quotes' }],
        );
        const missing = await call('/api/items/999999999/quotes', {
          method: 'POST',
          body: { text: 'x' },
        });
        assert.deepEqual([missing.status, missing.data], [404, { error: 'Item not found' }]);
        assert.equal((await call('/api/items/999999999/quotes')).status, 404);

        const book = await call('/api/items', {
          method: 'POST',
          body: { category: 'reading', title: '데미안' },
        });
        const path = `/api/items/${String(book.data.id)}`;
        const quoted = await call(`${path}/quotes`, { method: 'POST', body: { text: '알' } });
        const move = () =>
          call(path, { method: 'PATCH', body: { category: 'travel', title: '데미안 여행' } });
        assert.deepEqual((await move()).data, {
          error: 'Delete the quotes of this item before moving it out of Reading',
        });
        assert.equal((await call(path)).data.category, 'reading');
        // Other edits of a quoted book still work.
        assert.equal(
          (await call(path, { method: 'PATCH', body: { title: '데미안 2' } })).status,
          200,
        );
        await call(`${path}/quotes/${String(quoted.data.id)}`, { method: 'DELETE' });
        assert.equal((await move()).status, 200);
      },
      { today: () => TODAY },
    );
  },
);

test('quotes go with their item, and the table refuses bad rows', { skip: !url }, async (t) => {
  const pool = testPool();
  t.after(() => pool.end());
  await withApi(pool, async (call) => {
    const book = await call('/api/items', {
      method: 'POST',
      body: { category: 'reading', title: '데미안' },
    });
    const id = book.data.id as number;
    await call(`/api/items/${String(id)}/quotes`, { method: 'POST', body: { text: '하나' } });
    await call(`/api/items/${String(id)}/quotes`, { method: 'POST', body: { text: '둘' } });
    assert.equal((await call(`/api/items/${String(id)}`, { method: 'DELETE' })).status, 204);
    const { rowCount } = await pool.query('SELECT 1 FROM item_quotes WHERE item_id = $1', [id]);
    assert.equal(rowCount, 0);
  });
  const { rows } = await pool.query<{ id: number }>(
    "INSERT INTO items (category, title) VALUES ('reading', 'x') RETURNING id",
  );
  const itemId = rows[0]!.id;
  for (const [columns, values] of [
    ['text', "' '"],
    ['text', "repeat('a', 1001)"],
    ['text, page', "'ok', 0"],
    ['text, page', "'ok', 100000"],
    ['text, note', "'ok', ' '"],
    ['text, note', "'ok', repeat('a', 501)"],
  ]) {
    const sql = `INSERT INTO item_quotes (item_id, ${columns}) VALUES (${String(itemId)}, ${values})`;
    await assert.rejects(pool.query(sql), { code: '23514' }, sql);
  }
  await assert.rejects(
    pool.query("INSERT INTO item_quotes (item_id, text) VALUES (999999999, 'x')"),
    { code: '23503' },
  );
});
