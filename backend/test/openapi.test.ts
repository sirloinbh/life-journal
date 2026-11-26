import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import type { Pool } from 'pg';
import { z } from 'zod/v4';

import { createApp } from '../src/app.js';
import { document, operations } from '../src/openapi.js';
import { buildOpenApi, schemaOf } from '../src/standard/openapi.js';

// Routes are only registered here, never called, so no database is needed.
const app = () => createApp({} as Pool);

type Layer = {
  route?: { path: string; methods: Record<string, boolean> };
  name?: string;
  handle?: { stack?: Layer[] };
  matchers?: ((path: string) => unknown)[];
};
// Express 5 keeps no mount path on a router layer, so each router is matched against these known mounts.
const mounts = ['/api/items', '/api/terms', '/api/calendar'];
function routesOf(stack: Layer[], prefix: string): string[] {
  return stack.flatMap((layer) => {
    if (layer.route) {
      const path = layer.route.path === '/' ? prefix : prefix + layer.route.path;
      return Object.keys(layer.route.methods).map((m) => `${m.toUpperCase()} ${path}`);
    }
    if (layer.name !== 'router' || !layer.handle?.stack) return [];
    const mount = mounts.find((m) => layer.matchers?.some((match) => match(m)));
    if (!mount) throw new Error('A router is mounted at a path that is not listed in `mounts`');
    return routesOf(layer.handle.stack, prefix + mount);
  });
}
const registeredRoutes = (instance: ReturnType<typeof app>) =>
  routesOf((instance as unknown as { router: { stack: Layer[] } }).router.stack, '');

test('docs/openapi.json is up to date with the operation table', async () => {
  const committed = JSON.parse(
    await readFile(new URL('../../docs/openapi.json', import.meta.url), 'utf8'),
  ) as unknown;
  assert.deepEqual(
    committed,
    JSON.parse(JSON.stringify(document)),
    'run `npm run openapi -w backend` and commit',
  );
});

test('the operation table and the registered routes are the same set', () => {
  const routes = registeredRoutes(app());
  assert.deepEqual(Object.keys(operations).sort(), [...routes].sort());
});

test('API paths start with /api and use lowercase words joined by hyphens', () => {
  const routes = registeredRoutes(app());
  assert.ok(routes.includes('GET /api/health'));
  for (const route of routes)
    assert.match(route, /^[A-Z]+ \/api(\/(:\w+|[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+)?))*$/);
});

test('guarded routes document the sign-in, 401 and 429; the public route does not', () => {
  const paths = document.paths as Record<
    string,
    Record<string, { security?: unknown[]; responses: Record<string, unknown> }>
  >;
  assert.deepEqual(paths['/api/health']!.get!.security, []);
  assert.ok(!('401' in paths['/api/health']!.get!.responses));
  assert.ok('401' in paths['/api/me']!.get!.responses);
  assert.ok('429' in paths['/api/me']!.get!.responses);
});

test('unsupported schemas and undocumented routes fail instead of being skipped', () => {
  assert.throws(() => schemaOf(z.date()), /Date cannot be represented/);
  const extended = app();
  extended.get('/api/undocumented', (_req, res) => void res.json({}));
  assert.ok(registeredRoutes(extended).includes('GET /api/undocumented'));
  assert.ok(!('GET /api/undocumented' in operations));
  assert.ok(buildOpenApi({ title: 'T', description: 'd', operations: {} }));
});
