// The API's operation table. The document is built by the managed standard/openapi.ts from Zod schemas
// (z.toJSONSchema). `npm run openapi -w backend` writes docs/openapi.json; a test fails when it is out of date or
// when the table and the registered routes differ.
import { calendarQuery } from './calendar.js';
import { essayInput, essayListQuery, essayPatch } from './essays.js';
import { logFields, logPatch } from './item-logs.js';
import { quoteFields, quotePatch } from './item-quotes.js';
import { itemFields, itemPatch, listQuery } from './items.js';
import { entryDate, entryInput, journalListQuery } from './journal.js';
import { exportFile } from './restore.js';
import { buildOpenApi, type Operation } from './standard/openapi.js';
import { statsQuery } from './stats.js';

// Every registered route must appear here exactly once (checked in test/openapi.test.ts).
export const operations: Record<string, Operation> = {
  'GET /api/me': { summary: 'Get the signed-in user', status: [200, 401, 503] },
  'GET /api/health': {
    summary: 'Check that the server and database respond',
    status: [200, 500],
    public: true,
  },
  'GET /api/items': {
    summary:
      'List one page of items, filtered and sorted (the start date must not be after the end date; limit 1-500, default 100; offset); answers { items, nextOffset, total }',
    query: listQuery,
    status: [200, 400, 401, 500, 503],
  },
  'POST /api/items': {
    summary:
      'Create an item (category rules, subtype, dates, rating and review depend on category and status)',
    body: ['ItemInput', itemFields],
    status: [201, 400, 401, 413, 500, 503],
  },
  'GET /api/items/names': {
    summary:
      'List the tags and companions already used, the most used first (names that differ only in letter case count as one); answers { tags, companions }',
    status: [200, 401, 500, 503],
  },
  'GET /api/items/:id': { summary: 'Get one item', status: [200, 400, 401, 404, 500, 503] },
  'PATCH /api/items/:id': {
    summary: 'Update some fields of an item; the merged item must still follow the category rules',
    body: ['ItemPatch', itemPatch],
    status: [200, 400, 401, 404, 413, 500, 503],
  },
  'DELETE /api/items/:id': {
    summary: 'Delete an item, with its quotes, logs, and journal links',
    status: [204, 400, 401, 404, 500, 503],
  },
  'GET /api/items/:id/quotes': {
    summary:
      'List the quotes of an item in page order (quotes without a page last); answers { quotes }',
    status: [200, 400, 401, 404, 500, 503],
  },
  'POST /api/items/:id/quotes': {
    summary: 'Add a quote to a reading item (text up to 1,000 characters, optional page and note)',
    body: ['QuoteInput', quoteFields],
    status: [201, 400, 401, 404, 413, 500, 503],
  },
  'PATCH /api/items/:id/quotes/:quoteId': {
    summary: 'Update some fields of a quote',
    body: ['QuotePatch', quotePatch],
    status: [200, 400, 401, 404, 413, 500, 503],
  },
  'DELETE /api/items/:id/quotes/:quoteId': {
    summary: 'Delete a quote',
    status: [204, 400, 401, 404, 500, 503],
  },
  'GET /api/items/:id/logs': {
    summary: 'List the tastings and visits of an item, newest first; answers { logs }',
    status: [200, 400, 401, 404, 500, 503],
  },
  'POST /api/items/:id/logs': {
    summary:
      'Add a tasting or visit to a drink or travel item (a date up to today, optional rating, note, and cost)',
    body: ['LogInput', logFields],
    status: [201, 400, 401, 404, 413, 500, 503],
  },
  'PATCH /api/items/:id/logs/:logId': {
    summary: 'Update some fields of a tasting or visit',
    body: ['LogPatch', logPatch],
    status: [200, 400, 401, 404, 413, 500, 503],
  },
  'DELETE /api/items/:id/logs/:logId': {
    summary: 'Delete a tasting or visit',
    status: [204, 400, 401, 404, 500, 503],
  },
  'GET /api/terms': {
    summary: 'List the study terms with whether each one is learned',
    status: [200, 401, 500, 503],
  },
  'PUT /api/terms/:termId/learned': {
    summary: 'Mark a term as learned',
    status: [204, 401, 404, 500, 503],
  },
  'DELETE /api/terms/:termId/learned': {
    summary: 'Mark a term as not learned',
    status: [204, 401, 404, 500, 503],
  },
  'GET /api/essays': {
    summary:
      'List essays, newest written date first, without their text (q searches title and text; tag; status draft or done; limit 1-100, default 20; offset); answers { essays, nextOffset, total }',
    query: essayListQuery,
    status: [200, 400, 401, 500, 503],
  },
  'GET /api/essays/tags': {
    summary: 'List the tags already used on essays, the most used first; answers { tags }',
    status: [200, 401, 500, 503],
  },
  'GET /api/essays/:id': {
    summary: 'Get one essay with its text',
    status: [200, 400, 401, 404, 500, 503],
  },
  'POST /api/essays': {
    summary:
      'Create an essay (title up to 200 characters, blank becomes Untitled; Markdown text up to 50,000 characters; written date, default today; status, default draft; tags)',
    body: ['EssayInput', essayInput],
    status: [201, 400, 401, 413, 500, 503],
  },
  'PATCH /api/essays/:id': {
    summary: 'Update some fields of an essay',
    body: ['EssayPatch', essayPatch],
    status: [200, 400, 401, 404, 413, 500, 503],
  },
  'DELETE /api/essays/:id': {
    summary: 'Delete an essay',
    status: [204, 400, 401, 404, 500, 503],
  },
  'GET /api/notion/import': {
    summary:
      'Get the state of the Notion import: whether a token is set, and the progress or result of the last run since the server started',
    status: [200, 401, 500, 503],
  },
  'POST /api/notion/import': {
    summary:
      'Start importing the pages shared with the Notion integration and all their descendants in the background (400 without a token, 409 while a run is going); poll GET /api/notion/import',
    status: [202, 400, 401, 409, 500, 503],
  },
  'GET /api/documents': {
    summary:
      'List every imported Notion page and database without its text; the tree follows parentNotionId (deletedAt is set for a page that is gone from Notion)',
    status: [200, 401, 500, 503],
  },
  'GET /api/documents/:id': {
    summary: 'Get one imported Notion page with its Markdown text',
    status: [200, 400, 401, 404, 500, 503],
  },
  'POST /api/documents/:id/essay': {
    summary:
      'Copy an imported page into a new draft essay (title and text; 400 when the text is longer than an essay can be); answers { id }',
    status: [201, 400, 401, 404, 500, 503],
  },
  'GET /api/journal': {
    summary:
      'List journal entries, newest date first (limit 1-100, default 20; offset; optional from and to dates, both included); answers { entries, nextOffset, total }',
    query: journalListQuery,
    status: [200, 400, 401, 500, 503],
  },
  'GET /api/journal/:date': {
    summary: 'Get the journal entry of a date',
    params: { date: entryDate },
    status: [200, 400, 401, 404, 500, 503],
  },
  'PUT /api/journal/:date': {
    summary:
      'Write the journal entry of a date (optional title up to 200 characters, plain text up to 10,000 characters; not after today in Asia/Seoul); 201 when new, 200 when it replaced the entry',
    params: { date: entryDate },
    body: ['JournalEntryInput', entryInput],
    status: [200, 201, 400, 401, 413, 500, 503],
  },
  'DELETE /api/journal/:date': {
    summary: 'Delete the journal entry of a date, with its item links',
    params: { date: entryDate },
    status: [204, 400, 401, 404, 500, 503],
  },
  'GET /api/journal/:date/items': {
    summary:
      'List the items linked to the journal entry of a date and the items completed that day that are not linked yet; answers { linked, suggestions }',
    params: { date: entryDate },
    status: [200, 400, 401, 500, 503],
  },
  'PUT /api/journal/:date/items/:itemId': {
    summary:
      'Link an item completed on that day to the journal entry of the date; 201 when new, 200 when it was already linked',
    params: { date: entryDate },
    status: [200, 201, 400, 401, 404, 500, 503],
  },
  'DELETE /api/journal/:date/items/:itemId': {
    summary: 'Unlink an item from the journal entry of a date',
    params: { date: entryDate },
    status: [204, 400, 401, 404, 500, 503],
  },
  'GET /api/export': {
    summary:
      'Download every record as one JSON file (docs/export-format.md): { format, version, exportedAt, tables: { items, item_quotes, item_logs, learned_terms, audit_log } }',
    status: [200, 401, 500, 503],
  },
  'GET /api/export/items.csv': {
    summary:
      'Download the items as CSV (UTF-8 with BOM; details, sub_ratings, tags, and companions as JSON text; null is an empty unquoted field)',
    status: [200, 401, 500, 503],
  },
  'POST /api/restore': {
    summary:
      'Replace every record with a JSON export (docs/export-format.md, up to 100 MB). The whole file is checked first and written in one transaction, so a refused file changes nothing; answers { restored: { items, item_quotes, item_logs, learned_terms, audit_log } }',
    body: ['ExportFile', exportFile],
    status: [200, 400, 401, 413, 500, 503],
  },
  'GET /api/calendar': {
    summary:
      'List the items with a planned or completed date in a month (month YYYY-MM, default this month in Asia/Seoul); answers { month, items }',
    query: calendarQuery,
    status: [200, 400, 401, 500, 503],
  },
  'GET /api/stats': {
    summary:
      'Statistics of the items completed in a year (year YYYY, default this year in Asia/Seoul): count per month and category, spending, average rating per category, top 5 rated; answers { year, completed, spendingKrw, months, categories, topRated }',
    query: statsQuery,
    status: [200, 400, 401, 500, 503],
  },
};

export const document = buildOpenApi({
  title: 'Life Journal API',
  description:
    'Dates are YYYY-MM-DD (Asia/Seoul). Every route except /api/health needs the shared sign-in. Every error response is { error: English message }. Any /api path can also answer 429 (rate limit) with the same body.',
  errorDescription: 'English error message',
  operations,
  statusText: {
    200: 'Success',
    204: 'Success, no content',
    503: 'The shared sign-in service could not be reached',
  },
});
