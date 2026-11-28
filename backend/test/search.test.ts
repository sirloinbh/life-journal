import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { wordPatterns } from '../src/search.js';
import { withApi } from './helpers.js';

// #277: the search endpoint refuses a bad query before any database use, escapes the words, and maps the rows.
function untouchedPool() {
  const fail = () => {
    throw new Error('The database must not be used for invalid input');
  };
  return { query: fail, connect: fail } as unknown as Pool;
}

const message = 'Search term must be 1 to 100 characters';
const refused: { name: string; query: string; error: string }[] = [
  { name: 'a missing term', query: '', error: message },
  { name: 'a blank term', query: 'q=%20%20', error: message },
  { name: 'a term over 100 characters', query: `q=${'a'.repeat(101)}`, error: message },
  { name: 'two terms', query: 'q=a&q=b', error: message },
  {
    name: 'a NUL character',
    query: 'q=a%00b',
    error: 'Search term contains a character that is not allowed',
  },
  {
    name: 'an unknown filter',
    query: 'q=a&limit=5',
    error: 'The search request contains an unknown filter',
  },
];

for (const { name, query, error } of refused) {
  test(`the search refuses ${name}`, async () => {
    await withApi(untouchedPool(), async (call) => {
      const { status, data } = await call(`/api/search?${query}`);
      assert.equal(status, 400);
      assert.equal(data.error, error);
    });
  });
}

test('every word becomes one pattern, and % _ and backslash match literally', () => {
  assert.deepEqual(wordPatterns('  coffee  100%_a\\b '), ['%coffee%', '%100\\%\\_a\\\\b%']);
});

test('the search asks for the word patterns and answers { results } of content records', async () => {
  const asked: { text: string; params: unknown[] }[] = [];
  const pool = {
    query: (text: string, params: unknown[]) => {
      asked.push({ text, params });
      return Promise.resolve({
        rows: [
          { title: 'Coffee notes', path: '/essays/7', snippet: 'Beans from Ethiopia' },
          { title: 'x'.repeat(100), path: '/journal/2026-11-10', snippet: null },
          { title: 'Dune & more', path: '/table?q=', snippet: 'reading' },
        ],
      });
    },
  } as unknown as Pool;
  await withApi(pool, async (call) => {
    const { status, data } = await call('/api/search?q=%20Coffee%20beans%20');
    assert.equal(status, 200);
    assert.deepEqual(asked[0]?.params, [['%Coffee%', '%beans%']]);
    assert.match(asked[0]?.text ?? '', /LIMIT 20/);
    assert.deepEqual(data.results, [
      { title: 'Coffee notes', href: '/essays/7', kind: 'content', snippet: 'Beans from Ethiopia' },
      { title: `${'x'.repeat(79)}…`, href: '/journal/2026-11-10', kind: 'content' },
      {
        title: 'Dune & more',
        href: '/table?q=Dune%20%26%20more',
        kind: 'content',
        snippet: 'reading',
      },
    ]);
  });
});
