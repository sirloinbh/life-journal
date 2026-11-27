import { meHandler } from '@sirloinbh/auth-client';
import express from 'express';
import type { Pool } from 'pg';

import { tools } from './ai-tools.js';
import { createCalendarRouter } from './calendar.js';
import { createEssaysRouter } from './essays.js';
import { createExportRouter } from './export.js';
import { createItemsRouter } from './items.js';
import { createJournalRouter } from './journal.js';
import { createDocumentsRouter, createNotionRouter, type NotionConfig } from './notion.js';
import { createRestoreRouter, RESTORE_PATH } from './restore.js';
import { errorHandler, notFound, requestLog, serviceDate } from './standard/http.js';
import { apiRateLimit } from './standard/rate-limit.js';
import { registerToolRoutes } from './standard/tools.js';
import { createStatsRouter } from './stats.js';
import { createTermsRouter } from './terms.js';

export function createApp(
  pool: Pool,
  options: {
    today?: () => string;
    auth?: express.RequestHandler;
    /** shared-ai's public key (PEM); without it the AI tool routes are off (project-standards#711). */
    toolsPublicKey?: string;
    /** #241: the Notion token and, in tests, recorded responses. The token defaults to NOTION_TOKEN. */
    notion?: NotionConfig;
  } = {},
) {
  const today = options.today ?? (() => serviceDate());
  const app = express();
  app.disable('x-powered-by');
  // project-standards#658: a request ID and one JSON log line for every request, first so a 401 has them too.
  app.use(requestLog);
  apiRateLimit(app);
  // #209: a restore file can be far larger than 256 kB, so that route reads its own body, after the
  // sign-in check below; every other route keeps the small limit.
  const smallJson = express.json({ limit: '256kb' });
  app.use((req, res, next) => (req.path === RESTORE_PATH ? next() : smallJson(req, res, next)));
  // #111: the shared sign-in guards every /api route except /api/health, before any route registers.
  if (options.auth) app.use('/api', options.auth);
  app.get('/api/me', meHandler);
  app.get('/api/health', async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ ok: true, service: 'life-journal', today: today() });
  });
  app.use('/api/items', createItemsRouter(pool, today));
  app.use('/api/terms', createTermsRouter(pool));
  app.use('/api/export', createExportRouter(pool, today));
  app.use(RESTORE_PATH, createRestoreRouter(pool));
  app.use('/api/calendar', createCalendarRouter(pool, today));
  app.use('/api/stats', createStatsRouter(pool, today));
  app.use('/api/journal', createJournalRouter(pool, today));
  app.use('/api/essays', createEssaysRouter(pool, today));
  app.use(
    '/api/notion',
    createNotionRouter(pool, { token: process.env.NOTION_TOKEN, ...options.notion }),
  );
  app.use('/api/documents', createDocumentsRouter(pool, today));
  // AI tools for shared-ai on /internal/tools: outside /api, so nginx never forwards them and the signed
  // call token, not the session, is the check. The token must name its tool and carry a jti (#822).
  registerToolRoutes(app, {
    app: 'life-journal',
    tools,
    pool,
    publicKey: options.toolsPublicKey,
    requireBinding: true,
  });
  app.use('/api', notFound);
  app.use(errorHandler);
  return app;
}
