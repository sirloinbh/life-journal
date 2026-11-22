import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import { CATEGORIES, CATEGORY_KEYS, SCORES } from '../src/contract.js';

const migrations = new URL('../../database/migrations/', import.meta.url);

// #146: a category added to shared/contract.ts also needs a migration, and the other way round.
test('the latest items.category CHECK lists the same keys as the shared table', () => {
  const checks = readdirSync(migrations)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .flatMap((file) => [
      ...readFileSync(new URL(file, migrations), 'utf8').matchAll(/category IN \(([^)]*)\)/g),
    ]);
  const latest = checks.at(-1)?.[1];
  assert.ok(latest, 'no migration sets the category CHECK');
  const keys = [...latest.matchAll(/'([^']+)'/g)].map(([, key]) => key);
  assert.deepEqual(keys, CATEGORY_KEYS);
});

test('the shared table has unique keys inside each list and a usable score scale', () => {
  const unique = (values: string[]) => assert.equal(new Set(values).size, values.length);
  unique(CATEGORIES.map(({ key }) => key));
  for (const category of CATEGORIES) {
    unique(category.subtypes.map(({ value }) => value));
    unique(category.fields.map(({ key }) => key));
    unique(category.criteria.map(({ key }) => key));
    assert.ok(category.criteria.length > 0, category.key);
  }
  assert.deepEqual(
    [...SCORES],
    [...SCORES].sort((a, b) => a - b),
  );
});
