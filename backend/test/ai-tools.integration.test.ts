import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { createServer } from 'node:http';
import { test } from 'node:test';

import { createApp } from '../src/app.js';
import { testPool } from './helpers.js';
import { listenLocally } from './standard/api.js';

// project-standards#711: shared-ai calls the AI tool with a signed token; each call is checked for
// its scope and leaves one audit_log row. Needs the dedicated test DB with the migrations applied.
const skip = process.env.TEST_DATABASE_URL ? false : 'TEST_DATABASE_URL is not set';
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
// One owner per run, so the audit rows of an earlier run on the same DB do not count.
const owner = `owner-${randomUUID()}`;
// project-standards#670, #822: a token names its tool ('@list' for the list) and has its own jti; the app requires both.
function token(scope: string, tool: string, key = privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64({ alg: 'EdDSA', typ: 'JWT' })}.${b64({ iss: 'shared-ai', aud: 'life-journal', sub: owner, client: 'stdio', scope, tool, jti: randomUUID(), iat: now, exp: now + 60 })}`;
  return `${body}.${sign(null, Buffer.from(body), key).toString('base64url')}`;
}

test('AI tools: list_items with scopes, signatures and audit rows', { skip }, async () => {
  const pool = testPool();
  const toolsPublicKey = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  // #187: listenLocally skips ports fetch refuses ("bad port").
  const server = createServer(createApp(pool, { toolsPublicKey }));
  const port = await listenLocally(server);
  const base = `http://127.0.0.1:${port}/internal/tools`;
  const call = (name: string, auth: string | null, body: unknown = {}) =>
    fetch(`${base}/${name}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(auth ? { authorization: `Bearer ${auth}` } : {}),
      },
      body: JSON.stringify(body),
    });
  // A title no other test uses, so the text filter finds exactly these rows.
  const marker = `aitool${randomUUID().replaceAll('-', '')}`;
  try {
    for (const n of [1, 2, 3]) {
      await pool.query(
        "INSERT INTO items (category, title, tags, companions) VALUES ('reading', $1, '{book club}', '{엄마}')",
        [`${marker} ${n}`],
      );
    }

    const listed = await fetch(base, {
      headers: { authorization: `Bearer ${token('life-journal:read', '@list')}` },
    });
    assert.equal(listed.status, 200);
    const { tools } = (await listed.json()) as {
      tools: { name: string; annotations: { readOnlyHint: boolean } }[];
    };
    assert.deepEqual(
      tools.map((t) => [t.name, t.annotations.readOnlyHint]),
      [['list_items', true]],
    );

    assert.equal((await call('list_items', null, { q: marker })).status, 401);
    assert.equal(
      (
        await call(
          'list_items',
          token('life-journal:read', 'list_items', generateKeyPairSync('ed25519').privateKey),
          { q: marker },
        )
      ).status,
      401,
    );
    assert.equal(
      (await call('list_items', token('life-journal:write', 'list_items'), { q: marker })).status,
      403,
    );

    const read = await call('list_items', token('life-journal:read', 'list_items'), { q: marker });
    assert.equal(read.status, 200);
    const { result } = (await read.json()) as { result: { items: { title: string }[] } };
    assert.equal(result.items.length, 3);
    assert.ok(result.items.every((item) => item.title.startsWith(marker)));
    // #215: companion names are personal data and never reach shared-ai; tags do.
    for (const item of result.items as Record<string, unknown>[]) {
      assert.deepEqual(item.tags, ['book club']);
      assert.equal('companions' in item, false);
    }

    const limited = await call('list_items', token('life-journal:read', 'list_items'), {
      q: marker,
      limit: 2,
    });
    assert.equal(limited.status, 200);
    assert.equal(
      ((await limited.json()) as { result: { items: unknown[] } }).result.items.length,
      2,
    );

    assert.equal(
      (await call('list_items', token('life-journal:read', 'list_items'), { limit: 201 })).status,
      400,
    );

    const rows = (
      await pool.query(
        "SELECT action,result,tool,entity,client,actor_type FROM audit_log WHERE actor_type='ai-tool' AND actor_id=$1 ORDER BY id",
        [owner],
      )
    ).rows;
    assert.deepEqual(
      rows.map((r) => [r.tool, r.action, r.result]),
      [
        ['list_items', 'read', 'denied'],
        ['list_items', 'read', 'ok'],
        ['list_items', 'read', 'ok'],
        ['list_items', 'read', 'error'],
      ],
    );
    assert.equal(rows[1].entity, 'item');
    assert.equal(rows[1].client, 'stdio');
  } finally {
    await pool.query('DELETE FROM items WHERE title LIKE $1', [`${marker}%`]);
    server.close();
    await pool.end();
  }
});

test('AI tools are off without the shared-ai public key', { skip }, async () => {
  const pool = testPool();
  const server = createServer(createApp(pool));
  const port = await listenLocally(server);
  try {
    assert.equal((await fetch(`http://127.0.0.1:${port}/internal/tools`)).status, 404);
  } finally {
    server.close();
    await pool.end();
  }
});
