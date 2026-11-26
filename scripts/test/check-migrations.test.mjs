import assert from 'node:assert/strict';
import { test } from 'node:test';

import { findProblems } from '../check-migrations.mjs';

const base = ['001_a.sql', '013_item_logs.sql'];

test('a new file after the highest base file is fine', () => {
  assert.deepEqual(findProblems([...base, '014_b.sql'], base), []);
});

test('a new file before the highest base file is reported', () => {
  const problems = findProblems(['001_a.sql', '012_b.sql', '013_item_logs.sql'], base);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /012_b\.sql sorts before 013_item_logs\.sql/);
});

test('a duplicate number is reported', () => {
  assert.equal(findProblems([...base, '014_b.sql', '014_c.sql'], base).length, 1);
});

test('without a base only the number check runs', () => {
  assert.deepEqual(findProblems(['001_a.sql', '002_b.sql'], []), []);
});
