import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { Client } from 'pg';

import { migrate, readMigrations } from '../src/migrations.js';

// The migration runner against a real database (#83). deploy/remote-deploy.sh runs the built
// command as `node dist/migrate.js`; these tests run its source the same way through tsx.
const url = process.env.TEST_DATABASE_URL;
const backendDir = fileURLToPath(new URL('..', import.meta.url));
const repoMigrations = fileURLToPath(new URL('../../database/migrations/', import.meta.url));

// A connection string whose search_path is a schema of its own, so a test never touches public.
function inSchema(schema: string) {
  const address = new URL(url ?? '');
  address.searchParams.set('options', `-c search_path=${schema}`);
  return address.toString();
}

function runCommand(databaseUrl: string) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
    execFile(
      process.execPath,
      ['--import', 'tsx', 'src/migrate.ts'],
      { cwd: backendDir, env: { ...process.env, DATABASE_URL: databaseUrl } },
      (error, stdout, stderr) => {
        const code = error ? (typeof error.code === 'number' ? error.code : 1) : 0;
        resolve({ code, stdout, stderr });
      },
    );
  });
}

// A client on a fresh schema, dropped again after the test.
async function freshSchema(t: { after: (fn: () => Promise<void>) => void }, schema: string) {
  const client = new Client({ connectionString: url });
  await client.connect();
  t.after(async () => {
    await client.query('ROLLBACK').catch(() => {});
    try {
      await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    } finally {
      await client.end();
    }
  });
  await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE; CREATE SCHEMA ${schema}`);
  await client.query(`SET search_path TO ${schema}`);
  return client;
}

test('the migrate command fails with a Korean message without DATABASE_URL', async () => {
  const { code, stderr } = await runCommand('');
  assert.equal(code, 1);
  assert.match(stderr, /DATABASE_URL이 필요합니다/);
});

test(
  'the runner applies every file to an empty database, then nothing',
  { skip: !url },
  async (t) => {
    const client = await freshSchema(t, 'test_runner_empty');
    const files = await readMigrations(repoMigrations);
    assert.deepEqual(
      await migrate(client, files),
      files.map(({ name }) => name),
    );
    assert.deepEqual(await migrate(client, files), []);
    const { rows } = await client.query('SELECT name FROM schema_migrations ORDER BY name');
    assert.deepEqual(
      rows.map(({ name }) => name),
      files.map(({ name }) => name),
    );
  },
);

test(
  'the runner records a database that psql already migrated, keeping its rows',
  { skip: !url },
  async (t) => {
    const client = await freshSchema(t, 'test_runner_existing');
    const files = await readMigrations(repoMigrations);
    // What the Docker init or an earlier manual psql run left behind: every file, no history.
    for (const file of files) await client.query(file.sql);
    await client.query("INSERT INTO items (category, title) VALUES ('coffee', '케냐')");
    assert.deepEqual(
      await migrate(client, files),
      files.map(({ name }) => name),
    );
    assert.deepEqual(await migrate(client, files), []);
    const { rows } = await client.query('SELECT category, title FROM items');
    assert.deepEqual(rows, [{ category: 'coffee', title: '케냐' }]);
  },
);

test(
  'the migrate command succeeds twice, then exits non-zero on a changed applied file',
  { skip: !url },
  async (t) => {
    const schema = 'test_runner_command';
    const client = await freshSchema(t, schema);
    const first = await runCommand(inSchema(schema));
    assert.equal(first.code, 0, first.stderr);
    assert.match(first.stdout, /적용 완료: 001_initial\.sql/);
    const second = await runCommand(inSchema(schema));
    assert.equal(second.code, 0, second.stderr);
    assert.match(second.stdout, /적용할 마이그레이션이 없습니다/);

    await client.query(
      "UPDATE schema_migrations SET checksum = 'changed' WHERE name = '007_coffee_category.sql'",
    );
    const failed = await runCommand(inSchema(schema));
    assert.equal(failed.code, 1);
    assert.match(
      failed.stderr,
      /적용된 마이그레이션 파일의 내용이 바뀌었습니다: 007_coffee_category\.sql/,
    );
  },
);

test(
  'a file that fails while applying is rolled back alone, and earlier files stay recorded',
  { skip: !url },
  async (t) => {
    const client = await freshSchema(t, 'test_runner_failure');
    const dir = await mkdtemp(join(tmpdir(), 'migrations-'));
    t.after(() => rm(dir, { recursive: true, force: true }));
    await writeFile(join(dir, '001_ok.sql'), 'CREATE TABLE IF NOT EXISTS ok_table (id int);');
    // The table is created first, so a rollback is the only way it can be missing afterwards.
    await writeFile(
      join(dir, '002_bad.sql'),
      'CREATE TABLE IF NOT EXISTS bad_table (id int);\nSELECT * FROM no_such_table;',
    );
    await assert.rejects(migrate(client, await readMigrations(dir)), /002_bad\.sql 적용 실패/);
    const { rows } = await client.query('SELECT name FROM schema_migrations ORDER BY name');
    assert.deepEqual(rows, [{ name: '001_ok.sql' }]);
    const tables = await client.query(
      "SELECT to_regclass('ok_table') IS NOT NULL AS ok, to_regclass('bad_table') IS NOT NULL AS bad",
    );
    assert.deepEqual(tables.rows, [{ ok: true, bad: false }]);
  },
);
