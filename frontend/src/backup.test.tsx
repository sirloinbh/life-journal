import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { attachmentName } from './backup-download';
import { gate, json, openAt } from './test/app';
import { findLive } from './test/live';

// The downloads the screen started: the file name and the text of the file.
let saved: { name: string; blob: Blob }[] = [];
let blobs = new Map<string, Blob>();

beforeEach(() => {
  saved = [];
  blobs = new Map();
  let next = 0;
  // jsdom has no object URLs; keep each blob under a made-up address instead.
  URL.createObjectURL = (blob: Blob) => {
    const url = `blob:test/${next++}`;
    blobs.set(url, blob);
    return url;
  };
  URL.revokeObjectURL = (url: string) => void blobs.delete(url);
  // jsdom does not download; record what the link would save instead.
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    saved.push({ name: this.download, blob: blobs.get(this.href)! });
  });
});

afterEach(() => vi.restoreAllMocks());

function fakeApi(answer: (path: string) => Response | Promise<Response>) {
  const asked: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) => {
      if (path === '/api/health') return json({ today: '2026-11-26' });
      asked.push(path);
      return answer(path);
    }),
  );
  return asked;
}

// The page header has its own status line (the server check), so messages are looked up in the card.
const backupCard = () =>
  screen
    .getByRole('heading', { level: 2, name: 'Back up records' })
    .closest<HTMLElement>('[data-slot="card"]')!;

const file = (body: string, name: string, type: string) =>
  new Response(body, {
    headers: { 'Content-Type': type, 'Content-Disposition': `attachment; filename=${name}` },
  });

test('the settings page downloads every record as a dated JSON file', async () => {
  const body = JSON.stringify({ format: 'life-journal-export', version: 1, tables: {} });
  const asked = fakeApi(() => file(body, 'life-journal-2026-11-26.json', 'application/json'));
  openAt('/settings');
  fireEvent.click(await screen.findByRole('button', { name: 'Download all records (JSON)' }));
  expect(await findLive('status', backupCard())).toHaveTextContent(
    'Downloaded life-journal-2026-11-26.json',
  );
  expect(asked).toEqual(['/api/export']);
  expect(saved.map(({ name }) => name)).toEqual(['life-journal-2026-11-26.json']);
  expect(await saved[0].blob.text()).toBe(body);
});

test('the settings page downloads the items as a dated CSV file', async () => {
  const body = '\uFEFFid,title\r\n"1","A, ""B"""\r\n';
  const asked = fakeApi(() => file(body, 'life-journal-items-2026-11-26.csv', 'text/csv'));
  openAt('/settings');
  fireEvent.click(await screen.findByRole('button', { name: 'Download items (CSV)' }));
  expect(await findLive('status', backupCard())).toHaveTextContent(
    'Downloaded life-journal-items-2026-11-26.csv',
  );
  expect(asked).toEqual(['/api/export/items.csv']);
  expect(saved.map(({ name }) => name)).toEqual(['life-journal-items-2026-11-26.csv']);
  // The BOM stays in the file, so Excel reads Korean text as UTF-8 (text() would drop it).
  const bytes = new Uint8Array(await saved[0].blob.arrayBuffer());
  expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  expect(await saved[0].blob.text()).toBe(body.slice(1));
});

test('a failed download shows the server message and saves nothing', async () => {
  fakeApi(() => json({ error: 'Sign in again' }, 401));
  openAt('/settings');
  fireEvent.click(await screen.findByRole('button', { name: 'Download all records (JSON)' }));
  expect(await findLive('alert', backupCard())).toHaveTextContent('Sign in again');
  expect(saved).toEqual([]);
});

test('an unreachable server is reported', async () => {
  fakeApi(() => Promise.reject(new TypeError('Failed to fetch')));
  openAt('/settings');
  fireEvent.click(await screen.findByRole('button', { name: 'Download items (CSV)' }));
  expect(await findLive('alert', backupCard())).toHaveTextContent('Cannot reach the server');
});

test('more clicks during a download start nothing and keep the keyboard focus', async () => {
  const hold = gate();
  const asked = fakeApi(async () => {
    await hold.promise;
    return file('{}', 'life-journal-2026-11-26.json', 'application/json');
  });
  openAt('/settings');
  const button = await screen.findByRole('button', { name: 'Download all records (JSON)' });
  button.focus();
  fireEvent.click(button);
  fireEvent.click(button);
  fireEvent.click(screen.getByRole('button', { name: 'Download items (CSV)' }));
  expect(await findLive('status', backupCard())).toHaveTextContent('Preparing the download');
  expect(button).toHaveAttribute('aria-disabled', 'true');
  expect(button).toHaveFocus();
  await act(async () => {
    hold.open();
    await hold.promise;
  });
  await waitFor(() => expect(saved).toHaveLength(1));
  expect(asked).toEqual(['/api/export']);
  expect(button).not.toHaveAttribute('aria-disabled');
});

test.each([
  ['attachment; filename=life-journal-2026-11-26.json', 'life-journal-2026-11-26.json'],
  ['attachment; filename="life-journal-2026-11-26.json"', 'life-journal-2026-11-26.json'],
  ['attachment', null],
  [null, null],
])('the file name in %j is %j', (header, name) => {
  expect(attachmentName(header)).toBe(name);
});
