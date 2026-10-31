import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { Pool } from 'pg';

import { withApi } from './helpers.js';

const url = process.env.TEST_DATABASE_URL;
const TODAY = '2026-10-31';

// Requires a dedicated test DB with database/migrations applied. Skipped (not passed) without it.
test(
  'baseline schema is applied and health answers against the real database',
  { skip: !url },
  async (t) => {
    const pool = new Pool({ connectionString: url });
    t.after(() => pool.end());
    const tables = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_settings'",
    );
    assert.equal(tables.rowCount, 1, 'Apply database/migrations/001_initial.sql to the test DB');
    await withApi(pool, async (call) => {
      const { status, data } = await call('/api/health');
      assert.equal(status, 200);
      assert.equal(data.ok, true);
    });
  },
);

test('the items migration can be applied again without errors', { skip: !url }, async (t) => {
  const pool = new Pool({ connectionString: url });
  t.after(() => pool.end());
  const sql = await readFile(
    new URL('../../database/migrations/002_items.sql', import.meta.url),
    'utf8',
  );
  await pool.query(sql);
  await pool.query(sql);
  const tables = await pool.query("SELECT 1 FROM pg_tables WHERE tablename = 'items'");
  assert.equal(tables.rowCount, 1);
});

test('items of all five categories are stored and read back', { skip: !url }, async (t) => {
  const pool = new Pool({ connectionString: url });
  t.after(() => pool.end());
  await pool.query('DELETE FROM items');
  const samples = [
    { category: 'reading', title: '데미안', details: { author: '헤르만 헤세' } },
    {
      category: 'screen',
      subtype: 'movie',
      title: '기생충',
      costKrw: 15000,
      details: { director: '봉준호' },
    },
    {
      category: 'stage',
      subtype: 'opera',
      title: '라 보엠',
      plannedDate: '2027-03-01',
      details: { venue: '예술의전당' },
    },
    {
      category: 'drink',
      subtype: 'wine',
      title: '샤블리',
      status: 'done',
      completedDate: TODAY,
      details: { vintage: 2019, region: '부르고뉴' },
    },
    {
      category: 'travel',
      title: '교토 단풍',
      costKrw: 0,
      details: { country: '일본', city: '교토' },
    },
  ];
  await withApi(
    pool,
    async (call) => {
      const ids: unknown[] = [];
      for (const sample of samples) {
        const created = await call('/api/items', { method: 'POST', body: sample });
        assert.equal(created.status, 201, sample.category);
        assert.equal(typeof created.data.id, 'number');
        ids.push(created.data.id);
        const read = await call(`/api/items/${String(created.data.id)}`);
        assert.equal(read.status, 200);
        assert.deepEqual(read.data, created.data);
        assert.deepEqual(read.data, {
          id: created.data.id,
          subtype: null,
          status: 'wishlist',
          costKrw: null,
          plannedDate: null,
          completedDate: null,
          createdAt: created.data.createdAt,
          updatedAt: created.data.updatedAt,
          ...sample,
        });
      }
      const list = await call('/api/items');
      assert.equal(list.status, 200);
      const listed = (list.data.items as { id: unknown }[]).map((item) => item.id);
      assert.deepEqual(listed, [...ids].reverse());
    },
    { today: () => TODAY },
  );
});

test('items are updated, checked as a whole, and deleted', { skip: !url }, async (t) => {
  const pool = new Pool({ connectionString: url });
  t.after(() => pool.end());
  await withApi(
    pool,
    async (call) => {
      const created = await call('/api/items', {
        method: 'POST',
        body: {
          category: 'screen',
          subtype: 'drama',
          title: '  시그널  ',
          costKrw: 1000,
          details: { director: '김원석' },
        },
      });
      assert.equal(created.data.title, '시그널');
      const path = `/api/items/${String(created.data.id)}`;
      const patch = (body: unknown) => call(path, { method: 'PATCH', body });

      const edited = await patch({ title: '비밀의 숲', costKrw: null });
      assert.equal(edited.status, 200);
      assert.equal(edited.data.title, '비밀의 숲');
      assert.equal(edited.data.costKrw, null);
      assert.equal(edited.data.subtype, 'drama');
      assert.deepEqual(edited.data.details, { director: '김원석' });

      const noDate = await patch({ status: 'done' });
      assert.equal(noDate.status, 400);
      assert.deepEqual(noDate.data, { error: '완료한 항목에는 완료일을 입력해 주세요' });

      const done = await patch({ status: 'done', completedDate: '2026-10-30' });
      assert.equal(done.status, 200);
      assert.equal(done.data.completedDate, '2026-10-30');

      const keptDate = await patch({ status: 'wishlist' });
      assert.equal(keptDate.status, 400);
      assert.deepEqual(keptDate.data, {
        error: '완료하지 않은 항목에는 완료일을 넣을 수 없습니다',
      });

      const reopened = await patch({ status: 'wishlist', completedDate: null });
      assert.equal(reopened.status, 200);
      assert.equal(reopened.data.completedDate, null);

      // The old subtype and details do not fit the new category, so nothing may change.
      const moved = await patch({ category: 'travel' });
      assert.equal(moved.status, 400);
      const unchanged = await call(path);
      assert.equal(unchanged.data.category, 'screen');
      assert.equal(unchanged.data.title, '비밀의 숲');

      const movedWhole = await patch({
        category: 'travel',
        subtype: null,
        details: { city: '교토' },
      });
      assert.equal(movedWhole.status, 200);
      assert.equal(movedWhole.data.category, 'travel');

      const removed = await call(path, { method: 'DELETE' });
      assert.equal(removed.status, 204);
      for (const init of [
        { method: 'GET' },
        { method: 'DELETE' },
        { method: 'PATCH', body: { title: '없음' } },
      ]) {
        const missing = await call(path, init);
        assert.equal(missing.status, 404, init.method);
        assert.deepEqual(missing.data, { error: '항목을 찾을 수 없습니다' });
      }
    },
    { today: () => TODAY },
  );
});

test(
  'the database itself refuses a done item without a completed date',
  { skip: !url },
  async (t) => {
    const pool = new Pool({ connectionString: url });
    t.after(() => pool.end());
    await assert.rejects(
      pool.query(
        "INSERT INTO items (category, title, status) VALUES ('reading', '데미안', 'done')",
      ),
      { code: '23514' },
    );
  },
);
