import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { expect, test } from 'vitest';

// #236: no Korean text on any screen. The screen text lives in the frontend source and in the server
// messages and seed values, so none of their non-test files may hold a Hangul letter. Vitest runs in
// the frontend folder.
const HANGUL = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7A3]/;
const roots = [resolve(process.cwd(), 'src'), resolve(process.cwd(), '../backend/src')];

const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.(ts|tsx|css)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });

test('no frontend or server source file has Korean text', () => {
  const files = roots.flatMap(sources);
  expect(files.length).toBeGreaterThan(50);
  expect(files.filter((file) => HANGUL.test(readFileSync(file, 'utf8')))).toEqual([]);
});
