// The API's operation table. The document is built by the managed standard/openapi.ts from Zod schemas
// (z.toJSONSchema). `npm run openapi -w backend` writes docs/openapi.json; a test fails when it is out of date or
// when the table and the registered routes differ.
import { calendarQuery } from './calendar.js';
import { quoteFields, quotePatch } from './item-quotes.js';
import { itemFields, itemPatch, listQuery } from './items.js';
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
  'GET /api/items/:id': { summary: 'Get one item', status: [200, 400, 401, 404, 500, 503] },
  'PATCH /api/items/:id': {
    summary: 'Update some fields of an item; the merged item must still follow the category rules',
    body: ['ItemPatch', itemPatch],
    status: [200, 400, 401, 404, 413, 500, 503],
  },
  'DELETE /api/items/:id': {
    summary: 'Delete an item, with its quotes',
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
