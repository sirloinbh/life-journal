// Reading a chosen export file before a restore (#209). The server checks every row again; this only
// catches the wrong file early and gives the counts for the confirmation.

/** The server's body limit for a restore (backend/src/restore.ts). */
export const MAX_RESTORE_BYTES = 20 * 1024 * 1024;

export type ExportSummary = {
  /** When the file was made, as written in it (Asia/Seoul), cut to minutes for the screen. */
  exportedAt: string;
  items: number;
  /** Book quotes and tastings or visits; files from before #217 and #214 have none. */
  quotes: number;
  logs: number;
  learnedTerms: number;
  /** Change history rows (audit_log); files from before 2026-11-26 have none. */
  history: number;
  /** Journal entries and their item links; files from before #233 have none. */
  entries: number;
  entryLinks: number;
  /** Pages imported from Notion (#241); files from before it have none. */
  notionPages: number;
  /** The parsed file, sent as it is. */
  body: unknown;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The summary of an export file's text, or an Error that says what is wrong with it. */
export function summarizeExport(text: string): ExportSummary {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error('This file is not a JSON export');
  }
  if (!isObject(body) || body.format !== 'life-journal-export') {
    throw new Error('This file is not a life-journal export');
  }
  if (body.version !== 1) {
    throw new Error('This app restores export version 1 only');
  }
  const tables = isObject(body.tables) ? body.tables : {};
  if (!Array.isArray(tables.items) || !Array.isArray(tables.learned_terms)) {
    throw new Error('The file has no items or learned terms table');
  }
  const exportedAt = typeof body.exportedAt === 'string' ? body.exportedAt : '';
  return {
    exportedAt: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(exportedAt)
      ? exportedAt.slice(0, 16).replace('T', ' ')
      : 'an unknown time',
    items: tables.items.length,
    quotes: Array.isArray(tables.item_quotes) ? tables.item_quotes.length : 0,
    logs: Array.isArray(tables.item_logs) ? tables.item_logs.length : 0,
    learnedTerms: tables.learned_terms.length,
    history: Array.isArray(tables.audit_log) ? tables.audit_log.length : 0,
    entries: Array.isArray(tables.journal_entries) ? tables.journal_entries.length : 0,
    entryLinks: Array.isArray(tables.journal_entry_items) ? tables.journal_entry_items.length : 0,
    notionPages: Array.isArray(tables.notion_pages) ? tables.notion_pages.length : 0,
    body,
  };
}

const count = (value: number, one: string, many: string) => `${value} ${value === 1 ? one : many}`;

/** "2 items, 1 quote, and 1 learned term": quotes, tastings or visits, and history only when there are some. */
export function describeCounts({
  items,
  quotes,
  logs,
  learnedTerms,
  history = 0,
  entries = 0,
  entryLinks = 0,
  notionPages = 0,
}: Pick<ExportSummary, 'items' | 'quotes' | 'logs' | 'learnedTerms'> &
  Partial<Pick<ExportSummary, 'history' | 'entries' | 'entryLinks' | 'notionPages'>>) {
  const parts = [
    count(items, 'item', 'items'),
    quotes > 0 && count(quotes, 'quote', 'quotes'),
    logs > 0 && count(logs, 'tasting or visit', 'tastings or visits'),
    entries > 0 && count(entries, 'journal entry', 'journal entries'),
    entryLinks > 0 && count(entryLinks, 'entry link', 'entry links'),
    count(learnedTerms, 'learned term', 'learned terms'),
    notionPages > 0 && count(notionPages, 'imported Notion page', 'imported Notion pages'),
    history > 0 && count(history, 'history entry', 'history entries'),
  ].filter((part): part is string => typeof part === 'string');
  return parts.length === 2
    ? parts.join(' and ')
    : `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}`;
}
