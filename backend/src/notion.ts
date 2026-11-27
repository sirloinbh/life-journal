import { Router } from 'express';
import type { Pool } from 'pg';

import {
  createImportRunner,
  NotionClient,
  NotionError,
  type NotionOptions,
} from './notion-import.js';
import { auditContext, writeAudit } from './standard/audit.js';
import { withTransaction } from './standard/db.js';
import { HttpError, parseId } from './standard/http.js';

// #241: the Notion import (Settings) and the Documents list. Imported pages live in `notion_pages`, apart from
// essays; a page is copied into an essay only when asked, and a re-import never touches essays.

const MAX_ESSAY_LENGTH = 50_000;

export type NotionConfig = Partial<Omit<NotionOptions, 'token'>> & { token?: string };

const SUMMARY = `id, notion_id AS "notionId", parent_notion_id AS "parentNotionId", kind, title, path,
  notion_edited_at AS "notionEditedAt", imported_at AS "importedAt", deleted_at AS "deletedAt"`;

export function createNotionRouter(pool: Pool, config: NotionConfig = {}) {
  const router = Router();
  const token = config.token?.trim() || undefined;
  const runner = createImportRunner(pool, () =>
    token ? new NotionClient({ ...config, token }) : null,
  );

  router.get('/import', (_req, res) => {
    res.json({ configured: token !== undefined, ...runner.status() });
  });

  router.post('/import', (_req, res) => {
    let started: boolean;
    try {
      started = runner.start();
    } catch (cause) {
      if (cause instanceof NotionError) throw new HttpError(400, cause.message);
      throw cause;
    }
    if (!started) throw new HttpError(409, 'An import is already running');
    res.status(202).json({ configured: true, ...runner.status() });
  });

  return router;
}

export function createDocumentsRouter(pool: Pool, today: () => string) {
  const router = Router();
  const notFound = () => new HttpError(404, 'Document not found');

  // The whole tree without the text: the screen builds it from parentNotionId.
  router.get('/', async (_req, res) => {
    const { rows } = await pool.query(`SELECT ${SUMMARY} FROM notion_pages ORDER BY path, id`);
    res.json({ documents: rows });
  });

  router.get('/:id', async (req, res) => {
    const id = parseId(req.params.id, 'document');
    const { rows } = await pool.query(`SELECT ${SUMMARY}, body FROM notion_pages WHERE id = $1`, [
      id,
    ]);
    if (rows.length === 0) throw notFound();
    res.json(rows[0]);
  });

  // Copy a page into a new draft essay. The page itself is not changed.
  router.post('/:id/essay', async (req, res) => {
    const id = parseId(req.params.id, 'document');
    const created = await withTransaction(pool, async (client) => {
      const { rows } = await client.query<{ title: string; body: string }>(
        `SELECT title, body FROM notion_pages WHERE id = $1`,
        [id],
      );
      if (rows.length === 0) throw notFound();
      const { title, body } = rows[0];
      if (body.length > MAX_ESSAY_LENGTH)
        throw new HttpError(
          400,
          `This page is longer than an essay can be (${MAX_ESSAY_LENGTH.toLocaleString('en-US')} characters)`,
        );
      const essay = await client.query<{ id: number; title: string; writtenDate: string }>(
        `INSERT INTO essays (title, body, written_date, status, tags) VALUES ($1, $2, $3, 'draft', '{}')
         RETURNING id, title, written_date AS "writtenDate"`,
        [title.slice(0, 200), body, today()],
      );
      await writeAudit(client, {
        ...auditContext(req, res),
        action: 'create',
        entity: 'essay',
        entityId: essay.rows[0].id,
        after: { ...essay.rows[0], status: 'draft', copiedFromDocument: id },
      });
      return essay.rows[0];
    });
    res.status(201).json({ id: created.id });
  });

  return router;
}
