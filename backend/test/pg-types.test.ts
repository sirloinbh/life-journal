import assert from 'node:assert/strict';
import { test } from 'node:test';

import { types } from 'pg';

import { createApp } from '../src/app.js';
import { connectPool, pgTypes } from '../src/pool.js';

const url = process.env.TEST_DATABASE_URL;
const DATE_OID = 1082;
const INT8_OID = 20;

// #143: importing app.ts (scripts, tests, the OpenAPI CLI) leaves pg's global parsers alone.
test('importing the app does not change the global pg type parsers', () => {
  assert.equal(typeof createApp, 'function');
  assert.ok(types.getTypeParser(DATE_OID)('2026-11-23') instanceof Date);
  assert.equal(types.getTypeParser(INT8_OID)('42'), '42');
});

// pg's typings say a parser takes a number; text parsers take the column text.
const parse = (oid: number, text: string) =>
  (pgTypes.getTypeParser(oid, 'text') as unknown as (value: string) => unknown)(text);

test('the app pool parsers keep DATE as text and BIGINT as a safe number', () => {
  assert.equal(parse(DATE_OID, '2026-11-23'), '2026-11-23');
  assert.equal(parse(INT8_OID, '42'), 42);
  assert.throws(() => parse(INT8_OID, '9007199254740993'), /safe integer/);
});

test(
  'a pool from connectPool reads DATE and BIGINT with the app parsers',
  { skip: !url },
  async (t) => {
    const pool = connectPool(url);
    t.after(() => pool.end());
    const { rows } = await pool.query("SELECT DATE '2026-11-23' AS day, 42::bigint AS id");
    assert.deepEqual(rows, [{ day: '2026-11-23', id: 42 }]);
  },
);
