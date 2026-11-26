// Reading a chosen export file before a restore (#209). The server checks every row again; this only
// catches the wrong file early and gives the counts for the confirmation.

/** The server's body limit for a restore (backend/src/restore.ts). */
export const MAX_RESTORE_BYTES = 20 * 1024 * 1024;

export type ExportSummary = {
  /** When the file was made, as written in it (Asia/Seoul), cut to minutes for the screen. */
  exportedAt: string;
  items: number;
  learnedTerms: number;
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
    learnedTerms: tables.learned_terms.length,
    body,
  };
}
