import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { describeCounts, MAX_RESTORE_BYTES, summarizeExport } from './restore-file';
import { json, openAt } from './test/app';
import { dialogClosed, openDialog } from './test/dialog';
import { findLive, queryLive } from './test/live';

const exportBody = {
  format: 'life-journal-export',
  version: 1,
  exportedAt: '2026-11-26T09:05:01.123+09:00',
  tables: {
    items: [{ id: 1 }, { id: 2 }],
    learned_terms: [{ term_id: 'wine-tannin' }],
  },
};

function fakeApi(
  answer: () => Response = () =>
    json({
      restored: { items: 2, item_quotes: 0, item_logs: 0, learned_terms: 1, audit_log: 0 },
    }),
) {
  const sent: { path: string; method: string; body: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string, init: { method?: string; body?: string } = {}) => {
      if (path === '/api/health') return Promise.resolve(json({ today: '2026-11-26' }));
      if (path === '/api/notion/import')
        return Promise.resolve(json({ configured: false, state: 'idle' }));
      sent.push({
        path,
        method: init.method ?? 'GET',
        body: init.body === undefined ? undefined : JSON.parse(init.body),
      });
      return Promise.resolve(answer());
    }),
  );
  return sent;
}

const restoreCard = () =>
  screen
    // hidden: true, because an open dialog hides the rest of the page from the accessibility tree.
    .getByRole('heading', { level: 2, name: 'Restore records', hidden: true })
    .closest<HTMLElement>('[data-slot="card"]')!;

async function chooseFile(content: string, name = 'life-journal-2026-11-26.json') {
  const input = await screen.findByLabelText('Export file (JSON)');
  fireEvent.change(input, { target: { files: [new File([content], name)] } });
  return input;
}

test('a chosen export shows its counts and is restored after the confirmation', async () => {
  const sent = fakeApi();
  openAt('/settings');
  const input = await chooseFile(JSON.stringify(exportBody));
  expect(
    await within(restoreCard()).findByText(
      'life-journal-2026-11-26.json, made 2026-11-26 09:05, holds 2 items and 1 learned term.',
    ),
  ).toBeInTheDocument();
  expect(sent).toEqual([]);

  const dialog = await openDialog('Restore from this file');
  expect(dialog.getByText('Replace all records?')).toBeInTheDocument();
  expect(
    dialog.getByText(/replaced by the 2 items and 1 learned term in life-journal-2026-11-26\.json/),
  ).toBeInTheDocument();
  fireEvent.click(dialog.getByRole('button', { name: 'Replace all records' }));
  expect(await findLive('status', restoreCard())).toHaveTextContent(
    'Restored 2 items and 1 learned term from life-journal-2026-11-26.json.',
  );
  await dialogClosed();
  expect(sent).toEqual([{ path: '/api/restore', method: 'POST', body: exportBody }]);
  // The file is cleared, so a second click cannot restore it again by mistake.
  expect(screen.queryByRole('button', { name: 'Restore from this file' })).toBeNull();
  expect(input).toHaveValue('');
});

test('cancelling the confirmation sends nothing', async () => {
  const sent = fakeApi();
  openAt('/settings');
  await chooseFile(JSON.stringify(exportBody));
  const dialog = await openDialog('Restore from this file');
  fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
  await dialogClosed();
  expect(sent).toEqual([]);
  expect(screen.getByRole('button', { name: 'Restore from this file' })).toBeInTheDocument();
});

test('a file the server refuses shows its message in the card and changes nothing on screen', async () => {
  fakeApi(() =>
    json(
      { error: 'The file was not restored. tables.items.1.title: Title must not be empty' },
      400,
    ),
  );
  openAt('/settings');
  await chooseFile(JSON.stringify(exportBody));
  const dialog = await openDialog('Restore from this file');
  fireEvent.click(dialog.getByRole('button', { name: 'Replace all records' }));
  expect(await findLive('alert', restoreCard())).toHaveTextContent(
    'The file was not restored. tables.items.1.title: Title must not be empty',
  );
  await dialogClosed();
  // The same file can be tried again after fixing the cause on the server side.
  expect(screen.getByRole('button', { name: 'Restore from this file' })).toBeInTheDocument();
});

test.each([
  ['text that is not JSON', 'not json', 'This file is not a JSON export'],
  ['another JSON file', '{"hello": 1}', 'This file is not a life-journal export'],
  ['a newer export version', JSON.stringify({ ...exportBody, version: 2 }), 'version 1 only'],
])('choosing %s says so and offers no restore', async (_name, content, message) => {
  const sent = fakeApi();
  openAt('/settings');
  await chooseFile(content);
  expect(await findLive('alert', restoreCard())).toHaveTextContent(message);
  expect(screen.queryByRole('button', { name: 'Restore from this file' })).toBeNull();
  expect(sent).toEqual([]);
});

test('choosing another file replaces the earlier summary and message', async () => {
  fakeApi();
  openAt('/settings');
  await chooseFile('not json');
  await findLive('alert', restoreCard());
  await chooseFile(JSON.stringify(exportBody), 'second.json');
  await waitFor(() => expect(queryLive('alert', restoreCard())).toBeNull());
  expect(within(restoreCard()).getByText(/^second\.json, made/)).toBeInTheDocument();
});

test('summarizeExport reads the counts and refuses files it cannot restore', () => {
  expect(summarizeExport(JSON.stringify(exportBody))).toMatchObject({
    exportedAt: '2026-11-26 09:05',
    items: 2,
    quotes: 0,
    logs: 0,
    learnedTerms: 1,
    history: 0,
    entries: 0,
    entryLinks: 0,
    essays: 0,
  });
  const withChildren = {
    ...exportBody,
    tables: {
      ...exportBody.tables,
      item_quotes: [{ id: 1 }],
      item_logs: [{ id: 1 }, { id: 2 }],
      audit_log: [{ id: 1 }, { id: 2 }, { id: 3 }],
      journal_entries: [{ id: 1 }, { id: 2 }],
      journal_entry_items: [{ entry_id: 1, item_id: 1 }],
      essays: [{ id: 1 }, { id: 2 }],
    },
  };
  expect(summarizeExport(JSON.stringify(withChildren))).toMatchObject({
    quotes: 1,
    logs: 2,
    history: 3,
    entries: 2,
    entryLinks: 1,
    essays: 2,
  });
  expect(summarizeExport(JSON.stringify({ ...exportBody, exportedAt: 7 })).exportedAt).toBe(
    'an unknown time',
  );
  expect(() => summarizeExport(JSON.stringify({ ...exportBody, tables: { items: [] } }))).toThrow(
    'The file has no items or learned terms table',
  );
  expect(() => summarizeExport('[]')).toThrow('not a life-journal export');
  expect(MAX_RESTORE_BYTES).toBe(100 * 1024 * 1024);
});

test('describeCounts names essays only when the file has some', () => {
  expect(describeCounts({ items: 1, quotes: 0, logs: 0, learnedTerms: 1, essays: 2 })).toBe(
    '1 item, 2 essays, and 1 learned term',
  );
});

test('describeCounts names imported Notion pages only when the file has some', () => {
  expect(describeCounts({ items: 1, quotes: 0, logs: 0, learnedTerms: 0, notionPages: 4 })).toBe(
    '1 item, 0 learned terms, and 4 imported Notion pages',
  );
});

test('describeCounts names journal entries and links only when the file has some', () => {
  expect(
    describeCounts({ items: 2, quotes: 0, logs: 0, learnedTerms: 1, entries: 3, entryLinks: 1 }),
  ).toBe('2 items, 3 journal entries, 1 entry link, and 1 learned term');
});

test('describeCounts names quotes and tastings or visits only when the file has some', () => {
  expect(describeCounts({ items: 2, quotes: 0, logs: 0, learnedTerms: 1 })).toBe(
    '2 items and 1 learned term',
  );
  expect(describeCounts({ items: 1, quotes: 3, logs: 0, learnedTerms: 0 })).toBe(
    '1 item, 3 quotes, and 0 learned terms',
  );
  expect(describeCounts({ items: 5, quotes: 1, logs: 2, learnedTerms: 4 })).toBe(
    '5 items, 1 quote, 2 tastings or visits, and 4 learned terms',
  );
  expect(describeCounts({ items: 1, quotes: 0, logs: 0, learnedTerms: 2, history: 1 })).toBe(
    '1 item, 2 learned terms, and 1 history entry',
  );
});
