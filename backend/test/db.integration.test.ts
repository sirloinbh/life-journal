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
  for (const file of [
    '002_items.sql',
    '003_item_ratings.sql',
    '004_item_review.sql',
    '005_item_link.sql',
  ]) {
    const sql = await readFile(
      new URL(`../../database/migrations/${file}`, import.meta.url),
      'utf8',
    );
    await pool.query(sql);
    await pool.query(sql);
  }
  const tables = await pool.query(
    "SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'items'",
  );
  assert.equal(tables.rowCount, 1);
});

test(
  'the ratings and review migrations apply to a table that already has rows',
  { skip: !url },
  async (t) => {
    const pool = new Pool({ connectionString: url, max: 1 });
    const migration = (file: string) =>
      readFile(new URL(`../../database/migrations/${file}`, import.meta.url), 'utf8');
    const schema = 'test_ratings_migration';
    t.after(async () => {
      await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await pool.end();
    });
    await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE; CREATE SCHEMA ${schema}`);
    await pool.query(`SET search_path TO ${schema}`);
    await pool.query(await migration('002_items.sql'));
    await pool.query(`INSERT INTO items (category, title) VALUES ('reading', 'wishlist');
    INSERT INTO items (category, title, status, completed_date)
    VALUES ('reading', 'done', 'done', '2026-10-01')`);
    await pool.query(await migration('003_item_ratings.sql'));
    await pool.query(await migration('004_item_review.sql'));
    await pool.query(await migration('005_item_link.sql'));
    const { rows } = await pool.query('SELECT rating, sub_ratings, review, link FROM items');
    assert.deepEqual(rows, [
      { rating: null, sub_ratings: {}, review: null, link: null },
      { rating: null, sub_ratings: {}, review: null, link: null },
    ]);
  },
);

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
          rating: null,
          subRatings: {},
          review: null,
          link: null,
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

test('ratings of a done item are stored, kept, and cleared with it', { skip: !url }, async (t) => {
  const pool = new Pool({ connectionString: url });
  t.after(() => pool.end());
  await withApi(
    pool,
    async (call) => {
      const created = await call('/api/items', {
        method: 'POST',
        body: {
          category: 'drink',
          subtype: 'wine',
          title: '샤블리',
          status: 'done',
          completedDate: TODAY,
          rating: 4.5,
          subRatings: { aroma: 4, value: 5 },
        },
      });
      assert.equal(created.status, 201);
      assert.equal(created.data.rating, 4.5);
      assert.deepEqual(created.data.subRatings, { aroma: 4, value: 5 });
      const path = `/api/items/${String(created.data.id)}`;
      const patch = (body: unknown) => call(path, { method: 'PATCH', body });

      const edited = await patch({ title: '샤블리 2019' });
      assert.equal(edited.data.rating, 4.5, 'Another edit keeps the rating');
      // zod 4 applies a default inside .optional(), which would overwrite these on every PATCH.
      assert.equal(edited.data.status, created.data.status, 'Another edit keeps the status');
      assert.deepEqual(edited.data.details, created.data.details, 'Another edit keeps the details');
      assert.deepEqual(edited.data.subRatings, created.data.subRatings);

      const empty = await patch({});
      assert.equal(empty.status, 400);
      assert.deepEqual(empty.data, { error: '수정할 내용이 없습니다' });

      const keptRating = await patch({ status: 'wishlist', completedDate: null });
      assert.equal(keptRating.status, 400);
      assert.deepEqual(keptRating.data, {
        error: '완료하지 않은 항목에는 평점을 넣을 수 없습니다',
      });

      const wrongCriterion = await patch({ subRatings: { acting: 4 } });
      assert.equal(wrongCriterion.status, 400);
      assert.deepEqual(wrongCriterion.data, {
        error: '와인·위스키·사케 세부 평점에 없는 항목이 있습니다',
      });

      const movedWithRatings = await patch({ category: 'travel', subtype: null });
      assert.equal(movedWithRatings.status, 400, 'Old criteria do not fit the new category');
      const moved = await patch({
        category: 'travel',
        subtype: null,
        subRatings: { food: 3 },
      });
      assert.equal(moved.status, 200);
      assert.deepEqual(moved.data.subRatings, { food: 3 });

      const reopened = await patch({
        status: 'wishlist',
        completedDate: null,
        rating: null,
        subRatings: {},
      });
      assert.equal(reopened.status, 200);
      assert.equal(reopened.data.rating, null);
      assert.deepEqual(reopened.data.subRatings, {});
    },
    { today: () => TODAY },
  );
  for (const sql of [
    "INSERT INTO items (category, title, rating) VALUES ('reading', '데미안', 4)",
    "INSERT INTO items (category, title, status, completed_date, rating) VALUES ('reading', '데미안', 'done', '2026-10-01', 4.3)",
    `INSERT INTO items (category, title, sub_ratings) VALUES ('reading', '데미안', '{"content": 4}')`,
  ]) {
    await assert.rejects(pool.query(sql), { code: '23514' }, sql);
  }
});

test('a review of a done item is stored, kept, edited, and cleared', { skip: !url }, async (t) => {
  const pool = new Pool({ connectionString: url });
  t.after(() => pool.end());
  await withApi(
    pool,
    async (call) => {
      const created = await call('/api/items', {
        method: 'POST',
        body: {
          category: 'reading',
          title: '데미안',
          status: 'done',
          completedDate: TODAY,
          review: '  첫 줄\r\n둘째 줄 ',
        },
      });
      assert.equal(created.status, 201);
      assert.equal(created.data.review, '첫 줄\n둘째 줄');
      const path = `/api/items/${String(created.data.id)}`;
      const patch = (body: unknown) => call(path, { method: 'PATCH', body });

      const edited = await patch({ title: '데미안 2' });
      assert.equal(edited.data.review, '첫 줄\n둘째 줄', 'Another edit keeps the review');

      const longer = await patch({ review: '줄\n줄\n줄\n줄\n줄\n줄' });
      assert.equal(longer.status, 400);
      assert.deepEqual(longer.data, { error: '감상문은 5줄 이하로 입력해 주세요' });

      const keptReview = await patch({ status: 'wishlist', completedDate: null });
      assert.equal(keptReview.status, 400);
      assert.deepEqual(keptReview.data, {
        error: '완료하지 않은 항목에는 감상문을 넣을 수 없습니다',
      });

      const rewritten = await patch({ review: '고친 감상문' });
      assert.equal(rewritten.status, 200);
      assert.equal(rewritten.data.review, '고친 감상문');

      await assert.rejects(
        pool.query("UPDATE items SET status = 'wishlist', completed_date = NULL WHERE id = $1", [
          rewritten.data.id,
        ]),
        { code: '23514' },
        'The database refuses a review on a wishlist item',
      );

      const blanked = await patch({ review: '   ' });
      assert.equal(blanked.status, 200);
      assert.equal(blanked.data.review, null);

      await patch({ review: '다시 쓴 감상문' });
      const reopened = await patch({ status: 'wishlist', completedDate: null, review: null });
      assert.equal(reopened.status, 200);
      assert.equal(reopened.data.status, 'wishlist');
      assert.equal(reopened.data.review, null);
    },
    { today: () => TODAY },
  );
  for (const sql of [
    "INSERT INTO items (category, title, review) VALUES ('reading', '데미안', '좋았다')",
    `INSERT INTO items (category, title, status, completed_date, review)
     VALUES ('reading', '데미안', 'done', '2026-10-01', repeat('가', 501))`,
  ]) {
    await assert.rejects(pool.query(sql), { code: '23514' }, sql);
  }
});

test('search, filters, and sorting return the right items', { skip: !url }, async (t) => {
  const pool = new Pool({ connectionString: url });
  t.after(() => pool.end());
  await pool.query('DELETE FROM items');
  const done = (completedDate: string) => ({ status: 'done', completedDate });
  const samples = [
    { category: 'reading', title: '데미안', costKrw: 12000, details: { author: '헤르만 헤세' } },
    {
      category: 'reading',
      title: '100% 완독',
      costKrw: 20000,
      plannedDate: '2026-03-01',
    },
    {
      category: 'stage',
      subtype: 'opera',
      title: '라 보엠',
      costKrw: 150000,
      plannedDate: '2026-01-01',
      rating: 4.5,
      ...done('2026-05-01'),
    },
    {
      category: 'travel',
      title: '교토',
      details: { city: '헤세 마을' },
      rating: 3,
      ...done('2026-02-01'),
    },
    {
      category: 'drink',
      subtype: 'wine',
      title: 'under_score',
      plannedDate: '2026-06-01',
      costKrw: 0,
    },
    { category: 'screen', subtype: 'movie', title: 'back\\slash', costKrw: null },
  ];
  await withApi(
    pool,
    async (call) => {
      for (const body of samples) {
        const created = await call('/api/items', { method: 'POST', body });
        assert.equal(created.status, 201, body.title);
      }
      const titles = async (query: string) => {
        const { status, data } = await call(`/api/items?${query}`);
        assert.equal(status, 200, query);
        return (data.items as { title: string }[]).map((item) => item.title);
      };
      const sameItems = async (query: string, expected: string[]) => {
        assert.deepEqual((await titles(query)).sort(), [...expected].sort(), query);
      };
      const encoded = encodeURIComponent;

      await sameItems(`q=${encoded('보엠')}`, ['라 보엠']);
      await sameItems(`q=${encoded('헤세')}`, ['데미안', '교토']);
      await sameItems(`q=${encoded('BO')}&category=stage`, []);
      await sameItems('q=UNDER', ['under_score']);
      await sameItems(`q=${encoded('\\')}`, ['back\\slash']);
      await sameItems('q=author', []);
      await sameItems(`q=${encoded('%')}`, ['100% 완독']);
      await sameItems(`q=${encoded('_')}`, ['under_score']);
      await sameItems(
        `q=${encoded(' ')}`,
        samples.map(({ title }) => title),
      );
      await sameItems('category=reading', ['데미안', '100% 완독']);
      await sameItems('status=done', ['라 보엠', '교토']);
      await sameItems('status=wishlist&category=reading', ['데미안', '100% 완독']);
      await sameItems('from=2026-03-01', ['100% 완독', '라 보엠', 'under_score']);
      await sameItems('to=2026-02-01', ['교토']);
      await sameItems('from=2026-05-01&to=2026-05-01', ['라 보엠']);
      await sameItems('costMin=20000', ['100% 완독', '라 보엠']);
      await sameItems('costMax=20000', ['데미안', '100% 완독', 'under_score']);
      await sameItems('costMin=0', ['데미안', '100% 완독', '라 보엠', 'under_score']);
      await sameItems('costMax=0', ['under_score']);
      await sameItems('costMin=12000&costMax=20000&status=wishlist', ['데미안', '100% 완독']);
      await sameItems(`q=${encoded('헤세')}&status=done&to=2026-02-01`, ['교토']);

      // Items without a cost come last in either direction.
      assert.deepEqual((await titles('sort=costKrw&order=asc')).slice(0, 3), [
        'under_score',
        '데미안',
        '100% 완독',
      ]);
      // Categories sort in menu order, and the newer item comes first within one.
      assert.deepEqual(await titles('sort=category&order=asc'), [
        '100% 완독',
        '데미안',
        'back\\slash',
        '라 보엠',
        'under_score',
        '교토',
      ]);
      assert.deepEqual((await titles('sort=costKrw&order=desc')).slice(0, 3), [
        '라 보엠',
        '100% 완독',
        '데미안',
      ]);
      assert.deepEqual((await titles('sort=rating&order=desc')).slice(0, 2), ['라 보엠', '교토']);
      assert.deepEqual((await titles('sort=rating&order=asc')).slice(0, 2), ['교토', '라 보엠']);
      assert.deepEqual(await titles(''), samples.map(({ title }) => title).reverse());
    },
    { today: () => TODAY },
  );
});

test('a link is stored, kept by other edits, and cleared', { skip: !url }, async (t) => {
  const pool = new Pool({ connectionString: url });
  t.after(() => pool.end());
  await withApi(pool, async (call) => {
    const created = await call('/api/items', {
      method: 'POST',
      body: {
        category: 'drink',
        subtype: 'wine',
        title: '샤블리',
        link: 'https://example.com/wine',
      },
    });
    assert.equal(created.status, 201);
    assert.equal(created.data.link, 'https://example.com/wine');
    const path = `/api/items/${String(created.data.id)}`;
    const patch = (body: unknown) => call(path, { method: 'PATCH', body });

    assert.equal((await patch({ title: '샤블리 2019' })).data.link, 'https://example.com/wine');
    assert.equal((await patch({ link: 'javascript:alert(1)' })).status, 400);
    assert.equal((await call(path)).data.link, 'https://example.com/wine');
    assert.equal(
      (await patch({ link: 'http://example.com/new' })).data.link,
      'http://example.com/new',
    );
    assert.equal((await patch({ link: '' })).data.link, null);
  });
  for (const sql of [
    "INSERT INTO items (category, title, link) VALUES ('reading', '데미안', 'javascript:alert(1)')",
    "INSERT INTO items (category, title, link) VALUES ('reading', '데미안', 'https://' || repeat('a', 2000))",
  ]) {
    await assert.rejects(pool.query(sql), { code: '23514' }, sql);
  }
});

const createTestItem = async (pool: Pool) => {
  const { rows } = await pool.query<{ id: number }>(
    "INSERT INTO items (category, title, cost_krw) VALUES ('reading', '원래 제목', 1000) RETURNING id",
  );
  return rows[0]!.id;
};

// Waits until `count` connections of this database are blocked behind a lock.
async function waitForLockWaiters(pool: Pool, count: number) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const { rows } = await pool.query<{ pid: number }>(
      "SELECT pid FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'",
    );
    if (rows.length === count) return rows;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Expected ${count} connections waiting for a lock`);
}

test('concurrent patches of different fields both survive', { skip: !url }, async (t) => {
  const pool = new Pool({ connectionString: url });
  t.after(() => pool.end());
  const id = await createTestItem(pool);
  await withApi(pool, async (call) => {
    const holder = await pool.connect();
    try {
      await holder.query('BEGIN');
      await holder.query('SELECT 1 FROM items WHERE id = $1 FOR UPDATE', [id]);
      const patches = Promise.all([
        call(`/api/items/${id}`, { method: 'PATCH', body: { title: '새 제목' } }),
        call(`/api/items/${id}`, { method: 'PATCH', body: { costKrw: 2000 } }),
      ]);
      await waitForLockWaiters(pool, 2);
      await holder.query('COMMIT');
      const results = await patches;
      assert.deepEqual(
        results.map((result) => result.status),
        [200, 200],
      );
    } finally {
      holder.release();
    }
    const { data } = await call(`/api/items/${id}`);
    assert.equal(data.title, '새 제목');
    assert.equal(data.costKrw, 2000);
  });
});

test('a patch that fails after its UPDATE leaves the row unchanged', { skip: !url }, async (t) => {
  const pool = new Pool({ connectionString: url });
  t.after(() => pool.end());
  const id = await createTestItem(pool);
  const failingCommit = {
    connect: async () => {
      const client = await pool.connect();
      const query = client.query.bind(client) as (sql: string, values?: unknown[]) => unknown;
      return new Proxy(client, {
        get: (target, key) =>
          key === 'query'
            ? (sql: string, values?: unknown[]) =>
                sql === 'COMMIT' ? Promise.reject(new Error('commit failed')) : query(sql, values)
            : (Reflect.get(target, key) as unknown),
      });
    },
  } as unknown as Pool;
  const original = console.error;
  console.error = () => {};
  try {
    await withApi(failingCommit, async (call) => {
      const { status } = await call(`/api/items/${id}`, {
        method: 'PATCH',
        body: { title: '사라질 제목' },
      });
      assert.equal(status, 500);
    });
  } finally {
    console.error = original;
  }
  const { rows } = await pool.query('SELECT title FROM items WHERE id = $1', [id]);
  assert.equal(rows[0].title, '원래 제목');
});

test(
  'losing the connection during a patch answers 500 and keeps the API alive',
  { skip: !url },
  async (t) => {
    const pool = new Pool({ connectionString: url });
    t.after(() => pool.end());
    const id = await createTestItem(pool);
    const original = console.error;
    console.error = () => {};
    try {
      await withApi(pool, async (call) => {
        const holder = await pool.connect();
        try {
          await holder.query('BEGIN');
          await holder.query('SELECT 1 FROM items WHERE id = $1 FOR UPDATE', [id]);
          const patch = call(`/api/items/${id}`, { method: 'PATCH', body: { title: '끊김' } });
          const [waiter] = await waitForLockWaiters(pool, 1);
          await holder.query('SELECT pg_terminate_backend($1)', [waiter!.pid]);
          assert.equal((await patch).status, 500);
          await holder.query('ROLLBACK');
        } finally {
          holder.release();
        }
        const { status, data } = await call(`/api/items/${id}`);
        assert.equal(status, 200);
        assert.equal(data.title, '원래 제목');
      });
    } finally {
      console.error = original;
    }
  },
);

test('a patch cannot set a completed date after the service date', { skip: !url }, async (t) => {
  const pool = new Pool({ connectionString: url });
  t.after(() => pool.end());
  const id = await createTestItem(pool);
  await withApi(
    pool,
    async (call) => {
      const { status, data } = await call(`/api/items/${id}`, {
        method: 'PATCH',
        body: { status: 'done', completedDate: '2026-11-01' },
      });
      assert.equal(status, 400);
      assert.deepEqual(data, { error: '완료일은 오늘보다 뒤일 수 없습니다' });
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
