import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { withApi } from './helpers.js';

// #239: input that breaks the essay rules is refused before any query reaches the database.
const untouched = {
  query: () => {
    throw new Error('The database must not be used for invalid input');
  },
  connect: () => {
    throw new Error('The database must not be used for invalid input');
  },
} as unknown as Pool;

const refused: { name: string; method: string; path: string; body?: unknown; error: string }[] = [
  { name: 'a bad id', method: 'GET', path: '/api/essays/abc', error: 'Invalid essay ID' },
  {
    name: 'an unknown field',
    method: 'POST',
    path: '/api/essays',
    body: { color: 'red' },
    error: 'The request contains an unknown field',
  },
  {
    name: 'a title that is too long',
    method: 'POST',
    path: '/api/essays',
    body: { title: 'x'.repeat(201) },
    error: 'Title must be 200 characters or fewer',
  },
  {
    name: 'a status that does not exist',
    method: 'POST',
    path: '/api/essays',
    body: { status: 'published' },
    error: 'Status must be draft or done',
  },
  {
    name: 'a written date that does not exist',
    method: 'POST',
    path: '/api/essays',
    body: { writtenDate: '2026-02-30' },
    error: 'Written date must be a real date in YYYY-MM-DD format',
  },
  {
    name: 'a text that is too long',
    method: 'PATCH',
    path: '/api/essays/1',
    body: { body: 'x'.repeat(50_001) },
    error: 'Text must be 50,000 characters or fewer',
  },
  {
    name: 'an empty update',
    method: 'PATCH',
    path: '/api/essays/1',
    body: {},
    error: 'Nothing to update',
  },
  {
    name: 'an unknown list filter',
    method: 'GET',
    path: '/api/essays?color=red',
    error: 'The essay request contains an unknown filter',
  },
  {
    name: 'a page size that is too large',
    method: 'GET',
    path: '/api/essays?limit=101',
    error: 'Page size must be a whole number from 1 to 100',
  },
];

for (const { name, method, path, body, error } of refused) {
  test(`essays refuse ${name}`, async () => {
    await withApi(untouched, async (call) => {
      const { status, data } = await call(path, { method, body });
      assert.equal(status, 400);
      assert.equal(data.error, error);
    });
  });
}
