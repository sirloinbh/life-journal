import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const backendDir = fileURLToPath(new URL('..', import.meta.url));

// Starts the real server.ts and returns its first api_listening line (#141).
function startServer(env: Record<string, string>) {
  const { AUTH_INTERNAL_URL: _auth, HOST: _host, ...inherited } = process.env;
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
    cwd: backendDir,
    env: { ...inherited, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const line = new Promise<Record<string, unknown>>((resolve, reject) => {
    let out = '';
    let err = '';
    const timer = setTimeout(
      () => reject(new Error(`No api_listening line. stderr: ${err}`)),
      20_000,
    );
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => (err += chunk));
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      out += chunk;
      // Only whole lines: a chunk can end in the middle of the JSON line.
      const found = out
        .split('\n')
        .slice(0, -1)
        .find((text) => text.includes('"api_listening"'));
      if (found) {
        clearTimeout(timer);
        resolve(JSON.parse(found) as Record<string, unknown>);
      }
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`server.ts exited with ${code}. stderr: ${err}`));
    });
  });
  return { line, stop: () => child.kill() };
}

test('without the sign-in the API listens on 127.0.0.1 only and says so', async (t) => {
  const server = startServer({
    AUTH_DISABLED: '1',
    PORT: '0',
    DATABASE_URL: 'postgres://unused@127.0.0.1:1/unused',
  });
  t.after(server.stop);
  const line = await server.line;
  assert.equal(line.host, '127.0.0.1');
  assert.equal(line.signIn, false);
  assert.equal(typeof line.port, 'number');
  assert.notEqual(line.port, 0);
});
