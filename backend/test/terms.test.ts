import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { TERM_DOMAINS, TERMS } from '../src/terms-data.js';
import { withApi } from './helpers.js';

const noDatabase = {
  query: () => Promise.reject(new Error('No query is expected')),
} as unknown as Pool;

test('every term has a unique id, belongs to a domain and has text in every field', () => {
  assert.equal(new Set(TERMS.map(({ id }) => id)).size, TERMS.length);
  const domains = new Set<string>(TERM_DOMAINS.map(({ key }) => key));
  for (const term of TERMS) {
    assert.ok(domains.has(term.domain), term.id);
    assert.match(term.id, new RegExp(`^${term.domain}-[a-z0-9-]+$`));
    assert.ok(term.term.trim() && term.original.trim() && term.meaning.trim(), term.id);
  }
});

test('a term name appears only once in its domain', () => {
  const names = TERMS.map(({ domain, term }) => `${domain}:${term}`);
  assert.equal(new Set(names).size, names.length);
});

for (const method of ['PUT', 'DELETE']) {
  for (const id of ['no-such-term', '__proto__', 'wine-tannin%00']) {
    test(`${method} on the unknown term ${id} is a Korean 404`, async () => {
      await withApi(noDatabase, async (call) => {
        const { status, data } = await call(`/api/terms/${id}/learned`, { method });
        assert.equal(status, 404);
        assert.equal(data.error, '용어를 찾을 수 없습니다');
      });
    });
  }
}
